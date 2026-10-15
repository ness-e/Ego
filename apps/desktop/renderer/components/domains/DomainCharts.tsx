import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface TelemetryChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  yKey: string;
  gradientId: string;
  stroke?: string;
}

/**
 * T08 (UI-05): recharts aislado en módulo propio para `React.lazy`
 * (el bundle de charts ~384KB deja de cargarse en el arranque).
 *
 * T-contraste: strokes/fondos vía `var(--color-*, fallback)` — el hex queda
 * como fallback (render idéntico sin tokens) y el token manda con tema.
 */
export function TelemetryChart({ data, xKey, yKey, gradientId, stroke = "var(--color-success, #10b981)" }: TelemetryChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={stroke} stopOpacity={0.4} />
            <stop offset="95%" stopColor={stroke} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline, #262626)" vertical={false} />
        <XAxis dataKey={xKey} stroke="var(--color-dim, #737373)" fontSize={10} tickLine={false} />
        <YAxis stroke="var(--color-dim, #737373)" fontSize={10} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ backgroundColor: "var(--color-raised, #171717)", borderColor: "var(--color-hairline, #262626)", borderRadius: "8px" }}
          labelStyle={{ color: "var(--color-faint, #a3a3a3)", fontSize: "11px" }}
        />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={stroke}
          strokeWidth={2}
          fillOpacity={1}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
