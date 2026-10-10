import React from "react";
import type { ChartProps } from "@ego/ui-runtime";

interface ChartViewProps {
  props: ChartProps;
}

const PALETTE = ["#38bdf8", "#818cf8", "#34d399", "#fbbf24", "#f43f5e", "#a78bfa"];

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

  return (
    <div className="rounded-xl border border-hairline bg-panel p-4 shadow-xs select-text">
      <div className="flex items-center justify-between pb-3 border-b border-hairline mb-3">
        <h3 className="font-semibold text-sm text-ink">{title}</h3>
        {legend && (
          <div className="flex items-center gap-3 text-[11px] font-mono">
            {yKeys.map((key, idx) => (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
                />
                <span className="text-dim">{key}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full max-w-[500px] h-auto overflow-visible font-mono text-[10px]"
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
                        className="transition-all hover:opacity-80"
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
                    className="fill-zinc-400 text-[9px]"
                  >
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
                      className="hover:r-5 transition-all cursor-pointer"
                    >
                      <title>{`${pt.label} - ${yKey}: ${pt.val}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })}
        </svg>
      </div>
    </div>
  );
};
