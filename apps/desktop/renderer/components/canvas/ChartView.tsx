import React from "react";
import type { ChartProps } from "@ego/ui-runtime";

interface ChartViewProps {
  props: ChartProps;
}

// T06: paleta categórica de datos + T-contraste: cada entrada resuelve vía
// `var(--color-*, fallback)` — el hex histórico queda como fallback (render
// idéntico) y el token semántico manda con tema. Excepción documentada en
// design-system.md §1: sin equivalente semántico puro para indigo/violeta
// (`--color-chart-*` fijos del sistema); Recharts→tokens vive en Task 8 lazy.
const PALETTE = [
  "var(--color-brand, #38bdf8)",
  "var(--color-chart-indigo, #818cf8)",
  "var(--color-success, #34d399)",
  "var(--color-warning, #fbbf24)",
  "var(--color-error, #f43f5e)",
  "var(--color-chart-violet, #a78bfa)",
];

export interface PieSlice {
  label: string;
  value: number;
  fraction: number;
  startAngle: number;
  endAngle: number;
  color: string;
}

export function computePieSlices(
  data: Array<Record<string, unknown>>,
  xKey: string,
  yKeys: string[]
): PieSlice[] {
  const yKey = yKeys[0];
  if (!yKey || data.length === 0) return [];
  const total = data.reduce((acc, d) => acc + (Number(d[yKey]) || 0), 0);
  if (total <= 0) return [];
  let angle = -Math.PI / 2;
  return data.map((d, idx) => {
    const value = Number(d[yKey]) || 0;
    const fraction = value / total;
    const startAngle = angle;
    const endAngle = angle + fraction * Math.PI * 2;
    angle = endAngle;
    return {
      label: String(d[xKey] ?? ""),
      value,
      fraction,
      startAngle,
      endAngle,
      // El fallback también es un token: un hex suelto aquí rompería R1
      // (design-system.md §1) y además congelaría la paleta fuera de tema.
      color: PALETTE[idx % PALETTE.length] ?? "var(--color-chart-indigo, #818cf8)",
    };
  });
}

function polar(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

export const ChartView: React.FC<ChartViewProps> = ({ props }) => {
  const { data, xKey, yKeys, chartType, title, legend } = props;

  // Encontrar valores máximos para normalizar escalas
  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => yKeys.map((k) => Number(d[k]) || 0))
  );

  const svgWidth = 460;
  const svgHeight = 200;
  const padding = 35;
  const plotWidth = svgWidth - padding * 2;
  const plotHeight = svgHeight - padding * 2;
  const pieSlices = chartType === "pie" ? computePieSlices(data, xKey, yKeys) : [];

  return (
    <div className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)] select-text">
      <div className="mb-3 flex items-center justify-between border-b border-hairline pb-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {legend && (
          <div className="flex items-center gap-3 font-mono text-xs">
            {yKeys.map((key, idx) => (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-[var(--legend-color)]"
                  // El color de la leyenda es dinámico (paleta de charts por
                  // serie): Tailwind no puede generar una clase para un valor
                  // runtime. Se inyecta como variable CSS para que el `style`
                  // siga siendo un token, no un color suelto.
                  // design-lint: allow
                  style={
                    { "--legend-color": PALETTE[idx % PALETTE.length] } as React.CSSProperties
                  }
                />
                <span className="text-dim">{key}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        {chartType === "pie" ? (
          <svg
            viewBox="0 0 200 200"
            role="img"
            aria-label={title}
            className="h-auto w-full max-w-[260px] overflow-visible font-mono text-xs"
          >
            {pieSlices.length === 0 ? (
              <text x={100} y={100} textAnchor="middle" className="fill-dim">
                Sin datos
              </text>
            ) : (
              pieSlices.map((s) => {
                const cx = 100;
                const cy = 100;
                const r = 80;
                const p1 = polar(cx, cy, r, s.startAngle);
                const p2 = polar(cx, cy, r, s.endAngle);
                const large = s.fraction > 0.5 ? 1 : 0;
                const d = `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y} Z`;
                return (
                  <path key={s.label} d={d} fill={s.color} stroke="var(--color-panel, #171717)" strokeWidth="2">
                    <title>{`${s.label}: ${s.value} (${Math.round(s.fraction * 100)}%)`}</title>
                  </path>
                );
              })
            )}
          </svg>
        ) : (
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-auto w-full max-w-[500px] overflow-visible font-mono text-xs"
        >
          {/* Ejes y líneas de fondo */}
          <line
            x1={padding}
            y1={svgHeight - padding}
            x2={svgWidth - padding}
            y2={svgHeight - padding}
            stroke="currentColor"
            className="text-hairline"
            strokeWidth="1"
          />
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={svgHeight - padding}
            stroke="currentColor"
            className="text-hairline"
            strokeWidth="1"
          />

          {/* Gráfico de Barras */}
          {chartType === "bar" &&
            data.map((d, dIdx) => {
              const groupWidth = plotWidth / data.length;
              const barWidth = Math.max(8, (groupWidth - 8) / yKeys.length);
              const groupX = padding + dIdx * groupWidth;

              return (
                <g key={dIdx}>
                  {yKeys.map((yKey, yIdx) => {
                    const val = Number(d[yKey]) || 0;
                    const barHeight = (val / maxVal) * plotHeight;
                    const barX = groupX + yIdx * barWidth + 4;
                    const barY = svgHeight - padding - barHeight;

                    return (
                      <rect
                        key={yKey}
                        x={barX}
                        y={barY}
                        width={barWidth - 2}
                        height={barHeight}
                        fill={PALETTE[yIdx % PALETTE.length]}
                        rx="2"
                        className="transition-opacity hover:opacity-80"
                      >
                        <title>{`${d[xKey]} - ${yKey}: ${val}`}</title>
                      </rect>
                    );
                  })}
                  {/* Etiqueta Eje X */}
                  <text
                    x={groupX + groupWidth / 2}
                    y={svgHeight - padding + 15}
                    textAnchor="middle"
                    className="fill-dim text-xs"
                  >
                    <title>{String(d[xKey])}</title>
                    {String(d[xKey]).slice(0, 8)}
                  </text>
                </g>
              );
            })}

          {/* Gráfico de Líneas o Área */}
          {(chartType === "line" || chartType === "area") &&
            yKeys.map((yKey, yIdx) => {
              const color = PALETTE[yIdx % PALETTE.length];
              const points = data.map((d, dIdx) => {
                const x = padding + (dIdx / (data.length - 1 || 1)) * plotWidth;
                const val = Number(d[yKey]) || 0;
                const y = svgHeight - padding - (val / maxVal) * plotHeight;
                return { x, y, val, label: String(d[xKey]) };
              });

              const pathD = points
                .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
                .join(" ");

              const areaD = `${pathD} L ${points[points.length - 1]?.x || padding} ${
                svgHeight - padding
              } L ${points[0]?.x || padding} ${svgHeight - padding} Z`;

              return (
                <g key={yKey}>
                  {chartType === "area" && (
                    <path d={areaD} fill={color} fillOpacity="0.15" />
                  )}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {points.map((pt, ptIdx) => (
                    <circle
                      key={ptIdx}
                      cx={pt.x}
                      cy={pt.y}
                      r="3.5"
                      fill={color}
                      className="cursor-pointer transition-[r] hover:r-5"
                    >
                      <title>{`${pt.label} - ${yKey}: ${pt.val}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })}
        </svg>
        )}
      </div>
    </div>
  );
};
