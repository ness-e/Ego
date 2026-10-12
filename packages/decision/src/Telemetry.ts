import { type EventBus } from '@ego/events';

export interface DecisionTelemetryMetrics {
  runId: string;
  intentId: string;
  classifyMs: number;
  scorerMs?: number;
  subEgoSelectMs: number;
  preconditionsMs: number;
  totalDecisionMs: number;
  decidedBy: string;
  withinBudget: boolean; // Presupuesto de decisión: <= 150ms
  timestamp: number;
}

export interface TelemetrySummary {
  sampleCount: number;
  p50Ms: number;
  p90Ms: number;
  p99Ms: number;
  avgTotalMs: number;
  budgetComplianceRatio: number;
}

export class DecisionTelemetry {
  private eventBus?: EventBus;
  private maxHistory: number;
  private samples: DecisionTelemetryMetrics[] = [];

  constructor(eventBus?: EventBus, maxHistory = 500) {
    this.eventBus = eventBus;
    this.maxHistory = maxHistory;
  }

  /**
   * Registra una medición de latencia del ciclo de decisión y emite el evento al EventBus.
   */
  public record(metrics: Omit<DecisionTelemetryMetrics, 'timestamp' | 'withinBudget'>): DecisionTelemetryMetrics {
    const withinBudget = metrics.totalDecisionMs <= 150;
    const fullMetrics: DecisionTelemetryMetrics = {
      ...metrics,
      withinBudget,
      timestamp: Date.now()
    };

    this.samples.push(fullMetrics);
    if (this.samples.length > this.maxHistory) {
      this.samples.shift();
    }

    if (this.eventBus) {
      this.eventBus.emit(
        'metrics.turn',
        {
          runId: fullMetrics.runId,
          latencyMs: fullMetrics.totalDecisionMs,
          stage: 'decision_layer',
          withinBudget: fullMetrics.withinBudget
        },
        {
          source: 'decision-telemetry',
          severity: fullMetrics.withinBudget ? 'info' : 'warn'
        }
      );
    }

    return fullMetrics;
  }

  /**
   * Calcula percentiles p50, p90, p99 y ratio de cumplimiento de presupuesto.
   */
  public getSummary(): TelemetrySummary {
    if (this.samples.length === 0) {
      return {
        sampleCount: 0,
        p50Ms: 0,
        p90Ms: 0,
        p99Ms: 0,
        avgTotalMs: 0,
        budgetComplianceRatio: 1.0
      };
    }

    const sortedLatencies = [...this.samples]
      .map(s => s.totalDecisionMs)
      .sort((a, b) => a - b);

    const count = sortedLatencies.length;
    const p50 = sortedLatencies[Math.floor(count * 0.50)] ?? 0;
    const p90 = sortedLatencies[Math.floor(count * 0.90)] ?? 0;
    const p99 = sortedLatencies[Math.floor(count * 0.99)] ?? 0;

    const sum = sortedLatencies.reduce((acc, val) => acc + val, 0);
    const avg = sum / count;

    const compliantCount = this.samples.filter(s => s.withinBudget).length;
    const budgetComplianceRatio = compliantCount / count;

    return {
      sampleCount: count,
      p50Ms: Math.round(p50 * 100) / 100,
      p90Ms: Math.round(p90 * 100) / 100,
      p99Ms: Math.round(p99 * 100) / 100,
      avgTotalMs: Math.round(avg * 100) / 100,
      budgetComplianceRatio: Math.round(budgetComplianceRatio * 100) / 100
    };
  }

  public reset(): void {
    this.samples = [];
  }
}
