import { useMemo, Suspense, lazy } from "react";
import { CurrencyDollar, Cpu, Clock, CheckCircle } from "@phosphor-icons/react";

// T08: recharts fuera del arranque — el chart carga lazy tras la primera pintura.
const LazyTelemetryChart = lazy(() =>
  import("../domains/DomainCharts.js").then((m) => ({ default: m.TelemetryChart }))
);

export interface TurnUsage {
  turnId?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  estimatedCostUsd: number;
}

/** Estrecha un `usage` desconocido (bridge lo tipa `unknown`) a números finitos. */
export function toTurnUsage(value: unknown, turnId?: string): TurnUsage | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const promptTokens = num(r.promptTokens);
  const completionTokens = num(r.completionTokens);
  const estimatedCostUsd = num(r.estimatedCostUsd);
  if (promptTokens === null || completionTokens === null || estimatedCostUsd === null) {
    return null;
  }
  const total = num(r.totalTokens) ?? promptTokens + completionTokens;
  return { turnId, promptTokens, completionTokens, totalTokens: total, estimatedCostUsd };
}

export interface MetricsConsoleProps {
  totalTokensToday: number;
  estimatedCostUsd: number;
  p99LatencyMs: number;
  completedTasksCount: number;
  pendingTasksCount: number;
  hourlyTelemetry?: Array<{ hour: string; tokens: number; costUsd: number }>;
  /** T19: turnos reales con `usage` (HERM-21). Ausente/vacío = vacío honesto. */
  turns?: TurnUsage[];
}

export function MetricsConsole({
  totalTokensToday,
  estimatedCostUsd,
  p99LatencyMs,
  completedTasksCount,
  pendingTasksCount,
  hourlyTelemetry,
  turns,
}: MetricsConsoleProps) {
  // Generar datos de serie temporal si no se proporcionan
  const chartData = useMemo(() => {
    if (hourlyTelemetry && hourlyTelemetry.length > 0) {
      return hourlyTelemetry;
    }
    // Datos simulados estructurados a lo largo de las horas del día para visualización fluida
    const hours = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];
    const baseTokens = Math.floor(totalTokensToday / (hours.length || 1));
    return hours.map((h, i) => ({
      hour: h,
      tokens: Math.max(0, Math.floor(baseTokens * (0.6 + i * 0.2))),
      costUsd: Number((estimatedCostUsd * (0.1 + i * 0.15)).toFixed(4)),
    }));
  }, [hourlyTelemetry, totalTokensToday, estimatedCostUsd]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-raised/30 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-dim" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
            Consola de Consumo y Telemetría
          </h3>
        </div>
        <span className="font-mono text-[11px] text-faint">Fast-Path · $0 Overhead</span>
      </div>

      {/* Grid de 4 tarjetas de métricas */}
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {/* Tokens */}
        <div className="flex flex-col rounded border border-hairline bg-panel p-2.5">
          <span className="text-[10px] uppercase tracking-wide text-faint">Tokens Hoy</span>
          <span className="mt-1 font-mono text-sm font-bold text-ink">
            {totalTokensToday.toLocaleString()}
          </span>
          <span className="text-[9px] text-dim">Prompt + Inferencia</span>
        </div>

        {/* Coste USD */}
        <div className="flex flex-col rounded border border-hairline bg-panel p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-faint">Coste Estimado</span>
            <CurrencyDollar size={12} className="text-dim" />
          </div>
          <span className="mt-1 font-mono text-sm font-bold text-ink">
            ${estimatedCostUsd.toFixed(4)}
          </span>
          <span className="text-[9px] text-dim">USD Tarifado</span>
        </div>

        {/* Latencia p99 */}
        <div className="flex flex-col rounded border border-hairline bg-panel p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-faint">Latencia p99</span>
            <Clock size={12} className="text-dim" />
          </div>
          <span className="mt-1 font-mono text-sm font-bold text-ink">
            {p99LatencyMs} ms
          </span>
          <span className="text-[9px] text-dim">Percentil 99</span>
        </div>

        {/* Tareas */}
        <div className="flex flex-col rounded border border-hairline bg-panel p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-faint">Tareas</span>
            <CheckCircle size={12} className="text-dim" />
          </div>
          <span className="mt-1 font-mono text-sm font-bold text-ink">
            {completedTasksCount} / {completedTasksCount + pendingTasksCount}
          </span>
          <span className="text-[9px] text-dim">{pendingTasksCount} en background</span>
        </div>
      </div>

      {/* T19: coste real por turno (HERM-21). Sin `turns`: vacío honesto. */}
      <div className="mt-1 rounded border border-hairline bg-panel p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium text-dim">Coste por Turno</span>
          <span className="font-mono text-[10px] text-faint">usage real · sin estimaciones</span>
        </div>
        {turns && turns.length > 0 ? (
          <div data-testid="metrics-turns-table" className="flex flex-col gap-1">
            <div className="grid grid-cols-[1fr_repeat(3,auto)] items-center gap-3 px-1 font-mono text-[9px] uppercase tracking-wide text-faint">
              <span>Turno</span>
              <span className="text-right">Prompt</span>
              <span className="text-right">Respuesta</span>
              <span className="text-right">USD</span>
            </div>
            {turns.map((t, i) => (
              <div
                key={t.turnId ?? `turn-${i}`}
                className="grid grid-cols-[1fr_repeat(3,auto)] items-center gap-3 rounded border border-hairline bg-raised/40 px-2 py-1 font-mono text-[11px] text-ink"
              >
                <span className="truncate text-dim">{t.turnId ?? `turno ${i + 1}`}</span>
                <span className="text-right">{t.promptTokens.toLocaleString()}</span>
                <span className="text-right">{t.completionTokens.toLocaleString()}</span>
                <span className="text-right">${t.estimatedCostUsd.toFixed(4)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div
            data-testid="metrics-turns-empty"
            className="px-1 py-2 font-mono text-[11px] italic text-faint"
          >
            Sin turnos registrados en la jornada — el coste por turno aparece aquí
            cuando haya inferencia real (vacío honesto, sin estimaciones).
          </div>
        )}
      </div>

      {/* Gráfico interactivo Recharts */}
      <div className="mt-1 rounded border border-hairline bg-panel p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium text-dim">Distribución Temporal de Tokens</span>
          <span className="font-mono text-[10px] text-faint">Área de Inferencia</span>
        </div>
        <div className="h-40 w-full">
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center font-mono text-[11px] text-dim">
                Cargando telemetría…
              </div>
            }
          >
            <LazyTelemetryChart
              data={chartData}
              xKey="hour"
              yKey="tokens"
              gradientId="tokenGradient"
              stroke="var(--color-brand, #3b82f6)"
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
