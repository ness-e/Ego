import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DecisionRouter,
  DecisionAuditor,
  DecisionTelemetry,
  LoopBreaker,
  IntentRequestSchema
} from '@ego/decision';
import { type EgoMemoryAdapter } from '@ego/memory';
import { EventBus } from '@ego/events';

describe('Decision Intelligence Layer Desktop Integration (DEC-01..DEC-08)', () => {
  let mockAdapter: EgoMemoryAdapter;
  let eventBus: EventBus;
  let decisionRouter: DecisionRouter;
  let decisionAuditor: DecisionAuditor;
  let decisionTelemetry: DecisionTelemetry;
  let loopBreaker: LoopBreaker;
  const inMemoryStorage = new Map<string, unknown>();

  beforeEach(() => {
    inMemoryStorage.clear();

    mockAdapter = {
      ready: true,
      put: vi.fn().mockImplementation(async ({ namespace, key, payload }) => {
        inMemoryStorage.set(`${namespace}:${key}`, payload);
      }),
      get: vi.fn().mockImplementation(async (namespace, key) => {
        return inMemoryStorage.get(`${namespace}:${key}`) || null;
      }),
      list: vi.fn().mockImplementation(async (namespace) => {
        const results = [];
        for (const [k, v] of inMemoryStorage.entries()) {
          if (k.startsWith(`${namespace}:`)) {
            const shortKey = k.replace(`${namespace}:`, '');
            results.push({ key: shortKey, payload: v });
          }
        }
        return results;
      })
    } as unknown as EgoMemoryAdapter;

    eventBus = new EventBus();
    decisionRouter = new DecisionRouter();
    decisionAuditor = new DecisionAuditor(mockAdapter);
    decisionTelemetry = new DecisionTelemetry(eventBus);
    loopBreaker = new LoopBreaker({ maxDepth: 4 });
  });

  it('DEC-01 & DEC-02: valida peticiones con IntentRequestSchema y genera veredicto tipado', async () => {
    const rawReq = {
      prompt: 'Revisa el código en src/main.ts y compila con pnpm build',
      projectId: 'proj-omega',
      workspacePath: 'C:/repos/ego'
    };

    const parseResult = IntentRequestSchema.safeParse(rawReq);
    expect(parseResult.success).toBe(true);

    const verdict = await decisionRouter.decide(parseResult.data!);
    expect(verdict.domain).toBe('engineering');
    expect(verdict.subEgoId).toBe('ego.dev');
    expect(verdict.toolsEnabled).toContain('fs');
    expect(verdict.toolsEnabled).toContain('terminal');
    expect(verdict.confidence).toBeGreaterThanOrEqual(0.9);
    expect(verdict.admittedRunContext.depth).toBe(0);
  });

  it('DEC-07: persiste el veredicto en VantaDB bajo gov/audit y lo recupera intacto', async () => {
    const verdict = await decisionRouter.decide({
      prompt: 'Buscar especificaciones de la arquitectura en docs/',
      projectId: 'proj-omega'
    });

    const auditKey = await decisionAuditor.recordVerdict(verdict);
    expect(auditKey).toContain('verdict:');
    expect(mockAdapter.put).toHaveBeenCalled();

    const recovered = await decisionAuditor.getVerdict(auditKey);
    expect(recovered).not.toBeNull();
    expect(recovered?.domain).toBe('knowledge');
    expect(recovered?.subEgoId).toBe('ego.research');
    expect(recovered?.intentDigest).toBe(verdict.intentDigest);
  });

  it('DEC-08: DecisionTelemetry registra latencias y calcula cumplimiento de presupuesto (<= 150ms)', async () => {
    const recorded = decisionTelemetry.record({
      runId: '550e8400-e29b-41d4-a716-446655440000',
      intentId: '123e4567-e89b-12d3-a456-426614174000',
      classifyMs: 5,
      subEgoSelectMs: 2,
      preconditionsMs: 1,
      totalDecisionMs: 18,
      decidedBy: 'deterministic_rule'
    });

    expect(recorded.withinBudget).toBe(true);

    const summary = decisionTelemetry.getSummary();
    expect(summary.sampleCount).toBe(1);
    expect(summary.p50Ms).toBe(18);
    expect(summary.budgetComplianceRatio).toBe(1.0);
  });

  it('DEC-06: LoopBreaker intercepta delegación recursiva excesiva (depth > 4)', async () => {
    const verdict = await decisionRouter.decide({
      prompt: 'Delegar subtarea de optimización',
      projectId: 'proj-omega',
      runContext: {
        runId: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: Date.now(),
        depth: 5,
        origin: 'subego_delegation'
      }
    });

    const breakCheck = loopBreaker.evaluate(
      verdict.subEgoId,
      verdict.intentDigest,
      verdict.admittedRunContext,
      verdict.confidence
    );

    expect(breakCheck.shouldBreak).toBe(true);
    expect(breakCheck.reason).toBe('max_depth_exceeded');
    expect(breakCheck.clarification?.options).toBeDefined();
  });
});
