import { describe, it, expect, vi } from 'vitest';
import { DecisionAuditor } from '../src/DecisionAuditor.js';
import { type EgoMemoryAdapter } from '@ego/memory';
import { type DecisionVerdict } from '../src/schemas/verdict.js';

describe('DecisionAuditor (DEC-07 - Inmutabilidad en gov/audit)', () => {
  const mockVerdict: DecisionVerdict = {
    intentId: '123e4567-e89b-12d3-a456-426614174000',
    intentDigest: 'c'.repeat(64),
    domain: 'engineering',
    subEgoId: 'ego.dev',
    namespaceTargets: ['proj/test-1', 'agent/ego.dev'],
    requiresApproval: false,
    llmTier: 'fast',
    toolsEnabled: ['fs', 'git'],
    confidence: 0.96,
    decidedBy: 'deterministic_rule',
    preconditions: [{ name: 'project_active', satisfied: true }],
    admittedRunContext: {
      runId: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: 1728570000000,
      depth: 0,
      origin: 'user_prompt'
    }
  };

  it('guarda el veredicto en VantaDB bajo la clave canónica verdict:<runId>:<timestamp>', async () => {
    const putMock = vi.fn().mockResolvedValue(undefined);
    const mockAdapter = {
      put: putMock
    } as unknown as EgoMemoryAdapter;

    const auditor = new DecisionAuditor(mockAdapter);
    const key = await auditor.recordVerdict(mockVerdict);

    expect(key).toBe('verdict:550e8400-e29b-41d4-a716-446655440000:1728570000000');
    expect(putMock).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: 'gov/audit',
        key,
        payload: expect.objectContaining({
          type: 'decision_verdict',
          verdict: mockVerdict
        })
      })
    );
  });

  it('recupera y valida un veredicto existente desde gov/audit', async () => {
    const getMock = vi.fn().mockResolvedValue({
      key: 'verdict:550e8400-e29b-41d4-a716-446655440000:1728570000000',
      payload: {
        type: 'decision_verdict',
        verdict: mockVerdict
      },
      metadata: {}
    });

    const mockAdapter = {
      get: getMock
    } as unknown as EgoMemoryAdapter;

    const auditor = new DecisionAuditor(mockAdapter);
    const recovered = await auditor.getVerdict('verdict:550e8400-e29b-41d4-a716-446655440000:1728570000000');

    expect(recovered).not.toBeNull();
    expect(recovered?.domain).toBe('engineering');
    expect(recovered?.intentDigest).toBe('c'.repeat(64));
  });

  it('no interrumpe la ejecución si el put en memoria falla', async () => {
    const putMock = vi.fn().mockRejectedValue(new Error('VantaDB disk error'));
    const mockAdapter = {
      put: putMock
    } as unknown as EgoMemoryAdapter;

    const auditor = new DecisionAuditor(mockAdapter);
    const key = await auditor.recordVerdict(mockVerdict);

    expect(key).toBeDefined();
  });

  it('lista veredictos recientes vía list() con metadata desenvuelta (C03-list)', async () => {
    const listMock = vi.fn().mockResolvedValue([
      {
        key: 'verdict:550e8400-e29b-41d4-a716-446655440000:1728570000000',
        payload: { type: 'decision_verdict', verdict: mockVerdict },
        metadata: {
          run_id: '550e8400-e29b-41d4-a716-446655440000',
          domain: 'engineering',
          confidence: 0.96,
          ts: 1728570000000
        }
      }
    ]);
    const mockAdapter = {
      list: listMock
    } as unknown as EgoMemoryAdapter;

    const auditor = new DecisionAuditor(mockAdapter);
    const verdicts = await auditor.listRecentVerdicts();

    // PAYLOAD-ONLY: la metadata desenvuelta está presente pero se ignora; el payload manda.
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0].domain).toBe('engineering');
    expect(verdicts[0].confidence).toBe(0.96);
  });
});
