import { describe, it, expect, beforeEach } from 'vitest';
import { LoopBreaker } from '../src/LoopBreaker.js';
import { type DecisionRunContext } from '../src/schemas/verdict.js';

describe('LoopBreaker (DEC-06, OCLW-02, HERM-03)', () => {
  let breaker: LoopBreaker;

  beforeEach(() => {
    breaker = new LoopBreaker({ maxDepth: 4 });
  });

  const createContext = (depth: number, runId = '550e8400-e29b-41d4-a716-446655440000'): DecisionRunContext => ({
    runId,
    timestamp: Date.now(),
    depth,
    origin: 'user_prompt'
  });

  it('permite ejecuciones normales dentro de los límites de profundidad', () => {
    const result = breaker.evaluate('ego.dev', 'digest-1', createContext(1), 0.95);
    expect(result.shouldBreak).toBe(false);
  });

  it('interrumpe inmediatamente si la profundidad de delegación supera el límite (OCLW-02)', () => {
    const result = breaker.evaluate('ego.dev', 'digest-2', createContext(5), 0.90);
    expect(result.shouldBreak).toBe(true);
    expect(result.reason).toBe('max_depth_exceeded');
    expect(result.clarification?.question).toContain('profundidad máxima');
    expect(result.clarification?.options.length).toBeGreaterThanOrEqual(2);
  });

  it('detecta y rompe ciclos circulares repetidos en el mismo runId', () => {
    const context = createContext(2, 'run-circular-1');
    const digest = 'digest-circular-fixed';

    // Primera invocación válida
    const res1 = breaker.evaluate('ego.dev', digest, context, 0.90);
    expect(res1.shouldBreak).toBe(false);

    // Segunda invocación idéntica en el mismo run
    const res2 = breaker.evaluate('ego.dev', digest, context, 0.90);
    expect(res2.shouldBreak).toBe(true);
    expect(res2.reason).toBe('circular_delegation');
    expect(resultQuestion(res2)).toContain('delegación circular');
  });

  it('dispara clarificación interactiva ante estancamiento por baja confianza consecutiva (HERM-03)', () => {
    const context = createContext(1, 'run-low-conf');

    breaker.evaluate('ego.dev', 'd1', context, 0.50);
    breaker.evaluate('ego.research', 'd2', context, 0.45);
    const res3 = breaker.evaluate('ego.dev', 'd3', context, 0.40);

    expect(res3.shouldBreak).toBe(true);
    expect(res3.reason).toBe('stagnation_low_confidence');
    expect(res3.clarification?.options).toBeDefined();
  });

  function resultQuestion(res: { clarification?: { question: string } }) {
    return res.clarification?.question ?? '';
  }
});
