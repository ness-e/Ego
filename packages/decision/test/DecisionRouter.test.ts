import { describe, it, expect } from 'vitest';
import { DecisionRouter } from '../src/DecisionRouter.js';
import { DecisionVerdictSchema } from '../src/schemas/verdict.js';

describe('DecisionRouter (DEC-01, OCLW-01)', () => {
  const router = new DecisionRouter();

  it('debe generar un DecisionVerdict estricto válido conforme a Zod', async () => {
    const verdict = await router.decide({
      prompt: 'Analizar el archivo tests/unit.test.ts',
      projectId: 'project-123',
      workspacePath: 'C:/app/workspace'
    });

    const parsed = DecisionVerdictSchema.safeParse(verdict);
    expect(parsed.success).toBe(true);
    expect(verdict.domain).toBe('engineering');
    expect(verdict.subEgoId).toBe('ego.dev');
    // A2-12 / EGO-FIND-34: esquema canónico de namespaces
    // (`dominio/subespacio`): antes `proj/<id>` y `agent/<id>`, que no
    // existen en `ego.namespaces.json`.
    expect(verdict.namespaceTargets).toContain('projects/project-123');
    expect(verdict.namespaceTargets).toContain('egos/ego.dev/state');
    expect(verdict.namespaceTargets).not.toContain('proj/project-123');
    expect(verdict.namespaceTargets).not.toContain('agent/ego.dev');
    expect(verdict.admittedRunContext.runId).toBeDefined();
    expect(verdict.admittedRunContext.depth).toBe(0);
  });

  it('debe heredar el AdmittedRunContext si se proporciona en la solicitud (OCLW-01)', async () => {
    const customContext = {
      runId: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: 1728570000000,
      depth: 2,
      origin: 'subego_delegation' as const
    };

    const verdict = await router.decide({
      prompt: 'Crear resumen del backlog',
      projectId: 'proj-456',
      runContext: customContext
    });

    expect(verdict.admittedRunContext.runId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(verdict.admittedRunContext.depth).toBe(2);
    expect(verdict.admittedRunContext.origin).toBe('subego_delegation');
  });

  it('debe forzar requiresApproval a true si una precondición falla', async () => {
    const verdict = await router.decide({
      prompt: 'Leer código en index.ts',
      projectId: 'proj-789'
      // sin workspacePath requerida para leer código
    });

    expect(verdict.requiresApproval).toBe(true);
    expect(verdict.preconditions.some(p => p.name === 'workspace_available' && !p.satisfied)).toBe(true);
  });
});
