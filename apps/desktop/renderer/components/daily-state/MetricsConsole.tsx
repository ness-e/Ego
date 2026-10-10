import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { CurrencyDollar, Cpu, Clock, CheckCircle } from "@phosphor-icons/react";

export interface MetricsConsoleProps {
  totalTokensToday: number;
  estimatedCostUsd: number;
  p99LatencyMs: number;
  completedTasksCount: number;
  pendingTasksCount: number;
  hourlyTelemetry?: Array<{ hour: string; tokens: number; costUsd: number }>;
}

export function MetricsConsole({
  totalTokensToday,
  estimatedCostUsd,
  p99LatencyMs,
  completedTasksCount,
  pendingTasksCount,
  hourlyTelemetry,
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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

      {/* Gráfico interactivo Recharts */}
      <div className="mt-1 rounded border border-hairline bg-panel p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium text-dim">Distribución Temporal de Tokens</span>
          <span className="font-mono text-[10px] text-faint">Área de Inferencia</span>
        </div>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="hour"
                stroke="#71717a"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#71717a"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  borderColor: "#27272a",
                  borderRadius: "6px",
                  fontSize: "11px",
                  color: "#f4f4f5",
                }}
                labelStyle={{ color: "#a1a1aa", marginBottom: "4px" }}
                formatter={(value: any) => [`${Number(value).toLocaleString()} tokens`, "Tokens"]}
              />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#tokenGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
