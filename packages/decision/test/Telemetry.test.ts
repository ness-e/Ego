import { describe, it, expect, vi } from 'vitest';
import { DecisionTelemetry } from '../src/Telemetry.js';
import { type EventBus } from '@ego/events';

describe('DecisionTelemetry (DEC-08 — Medición de Latencias y Percentiles)', () => {
  it('registra métricas dentro de presupuesto (<= 150ms) y emite evento al EventBus', () => {
    const emitMock = vi.fn();
    const mockBus = { emit: emitMock } as unknown as EventBus;

    const telemetry = new DecisionTelemetry(mockBus);
    const recorded = telemetry.record({
      runId: 'run-1',
      intentId: 'intent-1',
      classifyMs: 2,
      subEgoSelectMs: 1,
      preconditionsMs: 1,
      totalDecisionMs: 14,
      decidedBy: 'deterministic_rule'
    });

    expect(recorded.withinBudget).toBe(true);
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(
      'metrics.turn',
      expect.objectContaining({
        runId: 'run-1',
        latencyMs: 14,
        withinBudget: true
      }),
      expect.objectContaining({ severity: 'info' })
    );
  });

  it('marca withinBudget como false y emite severidad warn si supera 150ms', () => {
    const emitMock = vi.fn();
    const mockBus = { emit: emitMock } as unknown as EventBus;

    const telemetry = new DecisionTelemetry(mockBus);
    const recorded = telemetry.record({
      runId: 'run-2',
      intentId: 'intent-2',
      classifyMs: 120,
      subEgoSelectMs: 20,
      preconditionsMs: 30,
      totalDecisionMs: 190,
      decidedBy: 'specialized_scorer'
    });

    expect(recorded.withinBudget).toBe(false);
    expect(emitMock).toHaveBeenCalledWith(
      'metrics.turn',
      expect.objectContaining({ latencyMs: 190, withinBudget: false }),
      expect.objectContaining({ severity: 'warn' })
    );
  });

  it('calcula correctamente los percentiles p50, p90, p99 y el ratio de cumplimiento', () => {
    const telemetry = new DecisionTelemetry();

    // 10 muestras con diferentes latencias
    const latencies = [5, 10, 15, 20, 25, 30, 50, 80, 120, 200];
    for (let i = 0; i < latencies.length; i++) {
      telemetry.record({
        runId: `run-${i}`,
        intentId: `intent-${i}`,
        classifyMs: 2,
        subEgoSelectMs: 1,
        preconditionsMs: 1,
        totalDecisionMs: latencies[i],
        decidedBy: 'rule'
      });
    }

    const summary = telemetry.getSummary();
    expect(summary.sampleCount).toBe(10);
    expect(summary.p50Ms).toBe(30);
    expect(summary.p90Ms).toBe(200);
    expect(summary.budgetComplianceRatio).toBe(0.9); // 9 de 10 <= 150ms
  });
});
