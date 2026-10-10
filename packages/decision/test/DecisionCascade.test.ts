import { describe, it, expect, vi } from 'vitest';
import { DecisionCascade } from '../src/DecisionCascade.js';
import { type DecisionScorerProvider } from '../src/providers/DecisionScorerProvider.js';

describe('DecisionCascade (DEC-03 — Reglas -> Jev -> LLM)', () => {
  it('resuelve en Nivel 1 (Reglas Deterministas) con $0 y latencia mínima para comandos típicos', async () => {
    const cascade = new DecisionCascade();

    const verdict = await cascade.evaluate({
      prompt: 'git commit -m "fix bug"',
      projectId: 'proj-1'
    });

    expect(verdict.decidedBy).toBe('deterministic_rule');
    expect(verdict.domain).toBe('engineering');
    expect(verdict.subEgoId).toBe('ego.dev');
    expect(verdict.toolsEnabled).toContain('git');
    expect(verdict.confidence).toBe(1.0);
  });

  it('resuelve en Nivel 2 (Scorer Especializado) cuando el Nivel 1 no produce match directo', async () => {
    const mockScorer: DecisionScorerProvider = {
      name: 'mock-scorer',
      isAvailable: () => true,
      evaluate: vi.fn().mockResolvedValue({
        chosenOption: 'analytics',
        confidence: 0.88,
        scores: { analytics: 0.88 },
        latencyMs: 120
      })
    };

    const cascade = new DecisionCascade({ scorerProvider: mockScorer });

    const verdict = await cascade.evaluate({
      prompt: '¿Cómo han variado las conversiones de usuarios durante la última semana?',
      projectId: 'proj-1'
    });

    expect(mockScorer.evaluate).toHaveBeenCalled();
    expect(verdict.decidedBy).toBe('specialized_scorer');
    expect(verdict.domain).toBe('analytics');
    expect(verdict.confidence).toBe(0.88);
  });

  it('resuelve en Nivel 3 (LLM Estructurado) cuando el Nivel 2 no está disponible o falla', async () => {
    const mockLLMFallback = vi.fn().mockResolvedValue({
      domain: 'product',
      subEgoId: 'ego.pm',
      tools: [],
      confidence: 0.91
    });

    const cascade = new DecisionCascade({
      scorerProvider: {
        name: 'offline-scorer',
        isAvailable: () => false,
        evaluate: vi.fn()
      },
      llmFallbackFn: mockLLMFallback
    });

    const verdict = await cascade.evaluate({
      prompt: 'Diseña la visión del producto para el siguiente trimestre',
      projectId: 'proj-1'
    });

    expect(mockLLMFallback).toHaveBeenCalled();
    expect(verdict.decidedBy).toBe('structured_llm');
    expect(verdict.domain).toBe('product');
    expect(verdict.subEgoId).toBe('ego.pm');
  });

  it('degrada a fallback_nucleus seguro si todos los niveles remotos fallan', async () => {
    const cascade = new DecisionCascade({
      scorerProvider: {
        name: 'failing-scorer',
        isAvailable: () => true,
        evaluate: vi.fn().mockRejectedValue(new Error('Network error'))
      },
      llmFallbackFn: vi.fn().mockRejectedValue(new Error('LLM error'))
    });

    const verdict = await cascade.evaluate({
      prompt: 'Una tarea no catalogada y compleja sin reglas claras',
      projectId: 'proj-1'
    });

    expect(verdict.decidedBy).toBe('fallback_nucleus');
    expect(verdict.subEgoId).toBeDefined();
    expect(verdict.confidence).toBeGreaterThan(0);
  });
});
