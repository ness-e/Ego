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
    // `@container`: el grid de KPIs se dimensiona según el ANCHO DEL
    // CONTENEDOR, no el del viewport. Antes se usaba `xl:grid-cols-4`
    // (breakpoint de VIEWPORT) y esta consola vive en una columna
    // estrecha del dashboard: el viewport daba 4 columnas para un
    // contenedor de 228 px, y las etiquetas quedaban cortadas a media
    // palabra ("COSTE ESTIMA|DO", "LATENCI|A P99", "TAREA|S").
    // El salto a 4 columnas lo decide el ancho real disponible.
    <div className="@container flex flex-col gap-3 rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Cpu size={16} className="shrink-0 text-dim" />
          <h3 className="min-w-0 text-sm font-semibold text-ink">
            Consola de Consumo y Telemetría
          </h3>
        </div>
        <span className="shrink-0 font-mono text-xs text-faint">Fast-Path · $0 Overhead</span>
      </div>

      {/* Grid Bento de 4 tarjetas de métricas. Los saltos son de CONTENEDOR
          (`@container`), no de viewport: esta consola vive en una columna
          del dashboard que puede medir 90 px o 560 px según el ancho real
          del panel, así que un `xl:grid-cols-4` (breakpoint de viewport)
          le encajaba 4 columnas en un contenedor de 228 px y las etiquetas
          quedaban cortadas a media palabra ("COSTE ESTIMA|DO",
          "LATENCI|A P99", "TAREA|S").
          - 1 columna por debajo de 380 px: la tarjeta queda ancha y la
            etiqueta cabe en UNA línea.
          - 2 columnas entre 380 y 700 px.
          - 4 columnas a partir de 700 px.
          `min-w-0` en la tarjeta, en la fila de la etiqueta y en la propia
          etiqueta permite que el texto ENCOJA y se parta por palabra
          (nunca a media palabra) en vez de desbordar y recortarse. */}
      <div className="grid grid-cols-1 gap-2.5 @[380px]:grid-cols-2 @[700px]:grid-cols-4">
        {/* Tokens */}
        <div className="flex min-w-0 flex-col rounded-[var(--radius-card)] border border-hairline bg-raised p-3 hover:border-strong transition-colors">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <span className="min-w-0 text-xs font-semibold uppercase tracking-wider text-faint [overflow-wrap:break-word]">
              Tokens Hoy
            </span>
          </div>
          <span className="mt-1 font-mono text-base font-bold text-ink">
            {totalTokensToday.toLocaleString()}
          </span>
          <span className="mt-0.5 text-xs text-dim">Prompt + Inferencia</span>
        </div>

        {/* Coste USD */}
        <div className="flex min-w-0 flex-col rounded-[var(--radius-card)] border border-hairline bg-raised p-3 hover:border-strong transition-colors">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <span className="min-w-0 text-xs font-semibold uppercase tracking-wider text-faint [overflow-wrap:break-word]">
              Coste Estimado
            </span>
            <CurrencyDollar size={13} className="shrink-0 text-success" />
          </div>
          <span className="mt-1 font-mono text-base font-bold text-ink">
            ${estimatedCostUsd.toFixed(4)}
          </span>
          <span className="mt-0.5 text-xs text-dim">USD Tarifado</span>
        </div>

        {/* Latencia p99 */}
        <div className="flex min-w-0 flex-col rounded-[var(--radius-card)] border border-hairline bg-raised p-3 hover:border-strong transition-colors">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <span className="min-w-0 text-xs font-semibold uppercase tracking-wider text-faint [overflow-wrap:break-word]">
              Latencia p99
            </span>
            <Clock size={13} className="shrink-0 text-brand" />
          </div>
          <span className="mt-1 font-mono text-base font-bold text-ink">
            {p99LatencyMs} ms
          </span>
          <span className="mt-0.5 text-xs text-dim">Percentil 99</span>
        </div>

        {/* Tareas */}
        <div className="flex min-w-0 flex-col rounded-[var(--radius-card)] border border-hairline bg-raised p-3 hover:border-strong transition-colors">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <span className="min-w-0 text-xs font-semibold uppercase tracking-wider text-faint [overflow-wrap:break-word]">
              Tareas
            </span>
            <CheckCircle size={13} className="shrink-0 text-brand" />
          </div>
          <span className="mt-1 font-mono text-base font-bold text-ink">
            {completedTasksCount} / {completedTasksCount + pendingTasksCount}
          </span>
          <span className="mt-0.5 text-xs text-dim">{pendingTasksCount} en background</span>
        </div>
      </div>

      {/* T19: coste real por turno (HERM-21). Sin `turns`: vacío honesto. */}
      <div className="mt-1 rounded-[var(--radius-card)] border border-hairline bg-raised p-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Coste por Turno</span>
          <span className="font-mono text-xs text-faint">usage real · sin estimaciones</span>
        </div>
        {turns && turns.length > 0 ? (
          <div data-testid="metrics-turns-table" className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[1fr_repeat(3,auto)] items-center gap-3 px-1 font-mono text-xs uppercase tracking-wider text-faint">
              <span>Turno</span>
              <span className="text-right">Prompt</span>
              <span className="text-right">Respuesta</span>
              <span className="text-right">USD</span>
            </div>
            {turns.map((t, i) => (
              <div
                key={t.turnId ?? `turn-${i}`}
                className="grid grid-cols-[1fr_repeat(3,auto)] items-center gap-3 rounded-md border border-hairline bg-panel px-2.5 py-1.5 font-mono text-xs text-ink"
              >
                <span className="truncate text-dim font-medium">{t.turnId ?? `turno ${i + 1}`}</span>
                <span className="text-right">{t.promptTokens.toLocaleString()}</span>
                <span className="text-right">{t.completionTokens.toLocaleString()}</span>
                <span className="text-right font-semibold text-success">${t.estimatedCostUsd.toFixed(4)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div
            data-testid="metrics-turns-empty"
            className="px-1 py-2 font-mono text-xs italic text-faint"
          >
            Sin turnos registrados en la jornada — el coste por turno aparece aquí
            cuando haya inferencia real (vacío honesto, sin estimaciones).
          </div>
        )}
      </div>

      {/* Gráfico interactivo Recharts */}
      <div className="mt-1 rounded-[var(--radius-card)] border border-hairline bg-raised p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Distribución Temporal de Tokens</span>
          <span className="font-mono text-xs text-faint">Área de Inferencia</span>
        </div>
        <div className="h-40 w-full">
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center font-mono text-xs text-dim">
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
