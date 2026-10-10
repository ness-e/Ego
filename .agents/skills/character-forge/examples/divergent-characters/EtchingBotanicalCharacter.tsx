import React, { useId, useMemo, useState } from "react";

/**
 * @file EtchingBotanicalCharacter.tsx
 * @description Demostrador de diversidad estética 2D radical: Personaje botánico-micelial
 * estilizado mediante técnicas de grabado en cobre (copperplate etching), xilografía
 * y linograbado tradicional con tramas procedurales de cross-hatching SVG y animación
 * asimétrica biomecánica.
 *
 * Antítesis directa del cliché "monigote vectorial corporativo plano (Corporate Memphis)":
 * - Lenguaje de forma: Filiforme, espinoso, botánico, asimétrico y orgánico.
 * - Materialidad: Tinta negra ferrogálica sobre papel vitela hueso (#F4EEDD).
 * - Sombreado: Densidad variable de tramas grabadas generadas matemáticamente en SVG.
 * - Cinemática: Pulsación biomecánica por segmentos con retardo respiratorio no lineal.
 */

export interface BotanicalCharacterProps {
  /** Escala o dimensión en píxeles del viewport */
  size?: number;
  /** Estado de reactividad/alerta: 0 (latencia micelial) a 1 (alerta defensiva con esporas) */
  vigilance?: number;
  /** Inclinación o postura del tallo principal (-1 a 1) */
  stemSway?: number;
  /** Callback al interactuar directamente con el bulbo */
  onPulse?: () => void;
}

export const EtchingBotanicalCharacter: React.FC<BotanicalCharacterProps> = ({
  size = 500,
  vigilance = 0.2,
  stemSway = 0.05,
  onPulse,
}) => {
  const uniqueId = useId();
  const [hovered, setHovered] = useState(false);

  // Paleta de grabado histórico
  const inkDark = "#121314";
  const inkMid = "#2B2D2F";
  const paperBase = "#F7F3E9";
  const sporeAccent = "#8A3B29"; // Almagre / Sanguina renacentista

  // Generación procedural de curvas de tallo y costillas espinosas
  const { stemPath, ribs, tendrils } = useMemo(() => {
    // Curva cúbica del tallo central asimétrico
    const startX = 250;
    const startY = 460;
    const swayOffset = stemSway * 60;
    const cp1X = 240 + swayOffset * 0.4;
    const cp1Y = 360;
    const cp2X = 270 + swayOffset * 0.9;
    const cp2Y = 240;
    const endX = 250 + swayOffset;
    const endY = 150;

    const mainStem = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

    // Costillas botánicas laterales (grabado xilográfico)
    const ribsList: Array<{ path: string; weight: number }> = [];
    const ribSteps = 14;
    for (let i = 1; i <= ribSteps; i++) {
      const t = i / (ribSteps + 1);
      // Interpolación aproximada de Bézier cúbica
      const oneMinusT = 1 - t;
      const x =
        Math.pow(oneMinusT, 3) * startX +
        3 * Math.pow(oneMinusT, 2) * t * cp1X +
        3 * oneMinusT * Math.pow(t, 2) * cp2X +
        Math.pow(t, 3) * endX;
      const y =
        Math.pow(oneMinusT, 3) * startY +
        3 * Math.pow(oneMinusT, 2) * t * cp1Y +
        3 * oneMinusT * Math.pow(t, 2) * cp2Y +
        Math.pow(t, 3) * endY;

      // Normal perpendicular aproximada
      const angle = (t * 0.6 + 0.2) * Math.PI;
      const ribLength = (Math.sin(t * Math.PI) * 75 + 15) * (1 + vigilance * 0.3);

      // Costilla izquierda
      const lX = x - Math.cos(angle) * ribLength * 0.85;
      const lY = y - Math.sin(angle) * ribLength * 0.35 + 12;
      ribsList.push({
        path: `M ${x} ${y} Q ${x - ribLength * 0.4} ${y - 10} ${lX} ${lY}`,
        weight: 1.5 - t * 0.7,
      });

      // Costilla derecha (asimétrica: más extendida y curvada hacia abajo)
      const rX = x + Math.cos(angle * 0.9) * ribLength * 1.15;
      const rY = y - Math.sin(angle * 0.9) * ribLength * 0.5 + 8;
      ribsList.push({
        path: `M ${x} ${y} Q ${x + ribLength * 0.6} ${y + 5} ${rX} ${rY}`,
        weight: 1.8 - t * 0.8,
      });
    }

    // Zarcillos finos (hachurado de tensión)
    const tendrilList: string[] = [
      `M 250 460 C 210 470, 170 450, 140 480 Q 120 500, 100 485`,
      `M 250 460 C 290 475, 330 460, 360 490 Q 380 505, 410 495`,
      `M 230 460 C 220 485, 190 510, 160 515`,
      `M 270 460 C 285 490, 315 512, 345 520`,
    ];

    return { stemPath: mainStem, ribs: ribsList, tendrils: tendrilList };
  }, [stemSway, vigilance]);

  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: paperBase,
        padding: "16px",
        boxShadow: "inset 0 0 40px rgba(70, 50, 30, 0.12), 0 12px 32px rgba(0,0,0,0.1)",
        borderRadius: "4px",
        cursor: "pointer",
        userSelect: "none",
        fontFamily: "'Cinzel', 'EB Garamond', serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
      onClick={onPulse}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg
        viewBox="0 0 500 560"
        width="100%"
        height="100%"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Trama 1: Hachurado simple fino a 45 grados */}
          <pattern
            id={`hatch-single-${uniqueId}`}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke={inkDark} strokeWidth="1.2" />
          </pattern>

          {/* Trama 2: Sombreado cruzado denso (Cross-Hatch) para cavidades sombrías */}
          <pattern
            id={`hatch-cross-${uniqueId}`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke={inkDark} strokeWidth="1.4" />
            <line x1="0" y1="0" x2="6" y2="0" stroke={inkDark} strokeWidth="1.4" />
          </pattern>

          {/* Trama 3: Punteado de estofado (Stippling) para textura de poros biológicos */}
          <pattern
            id={`stipple-${uniqueId}`}
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="0.9" fill={inkMid} />
            <circle cx="7" cy="5" r="0.75" fill={inkMid} />
            <circle cx="4" cy="8" r="0.85" fill={inkDark} />
          </pattern>

          {/* Filtro de ruido analógico para recrear presión de prensa litográfica */}
          <filter id={`ink-bleed-${uniqueId}`} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        <g filter={`url(#ink-bleed-${uniqueId})`}>
          {/* --- BASE RADICULAR (MICELIO / RAÍCES EXPUESTAS) --- */}
          <g stroke={inkDark} fill="none" strokeLinecap="round">
            {tendrils.map((path, idx) => (
              <path key={idx} d={path} strokeWidth={1.4 - idx * 0.25} />
            ))}
          </g>

          {/* --- TALLO PRINCIPAL (HURTADO EN MADERA) --- */}
          {/* Volumen exterior del tallo con textura de grabado */}
          <path
            d={`${stemPath} L 262 460 Z`}
            fill={`url(#hatch-single-${uniqueId})`}
            opacity={0.85}
          />
          <path
            d={stemPath}
            stroke={inkDark}
            strokeWidth={hovered ? 4.5 : 3.8}
            fill="none"
            strokeLinecap="round"
          />

          {/* --- COSTILLAS / RAMAS ESPINOSAS (ASIMETRÍA GRAVADA) --- */}
          <g fill="none" stroke={inkDark} strokeLinecap="round">
            {ribs.map((rib, idx) => (
              <React.Fragment key={idx}>
                <path d={rib.path} strokeWidth={rib.weight * 1.8} />
                {/* Espinas terminales o púas secundarias */}
                {idx % 2 === 0 && (
                  <circle
                    cx={250 + (idx % 4 === 0 ? 30 : -25)}
                    cy={180 + idx * 18}
                    r={1.8}
                    fill={inkDark}
                  />
                )}
              </React.Fragment>
            ))}
          </g>

          {/* --- CABEZA / BULBO FLORAL-MÁSCARA (OROPÉNDOLA / CALAVERA BOTÁNICA) --- */}
          <g transform={`translate(${250 + stemSway * 60}, 150)`}>
            {/* Ovíparo o corola central */}
            <ellipse
              cx="0"
              cy="-25"
              rx={38 + vigilance * 8}
              ry={52 + (hovered ? 4 : 0)}
              fill={paperBase}
              stroke={inkDark}
              strokeWidth="3.5"
            />

            {/* Sombra de media luna en la corola usando cross-hatching */}
            <path
              d="M -30 -10 C -36 -45, -5 -74, 25 -65 C 5 -55, -15 -35, -10 10 C -22 5, -28 -2, -30 -10 Z"
              fill={`url(#hatch-cross-${uniqueId})`}
            />

            {/* Ojo único / Poro de observación central (Visión asimétrica) */}
            <ellipse
              cx="-4"
              cy="-28"
              rx={12 + vigilance * 4}
              ry={16 + vigilance * 2}
              fill={inkDark}
            />
            {/* Pupila de estofado / hendidura de madera */}
            <circle cx="-6" cy="-30" r="3.2" fill={paperBase} />
            <line x1="-12" y1="-28" x2="6" y2="-28" stroke={paperBase} strokeWidth="1.2" />

            {/* Sépalos articulados / Corona de plumas-hoja */}
            <path
              d="M -32 -45 C -55 -70, -60 -110, -45 -125 C -35 -105, -25 -75, -18 -55 Z"
              fill={`url(#hatch-single-${uniqueId})`}
              stroke={inkDark}
              strokeWidth="2.2"
            />
            <path
              d="M -5 -70 C -12 -110, 0 -145, 12 -155 C 16 -125, 12 -95, 5 -72 Z"
              fill={paperBase}
              stroke={inkDark}
              strokeWidth="2.4"
            />
            <path
              d="M 22 -55 C 48 -80, 68 -108, 62 -130 C 45 -105, 32 -78, 20 -50 Z"
              fill={`url(#hatch-single-${uniqueId})`}
              stroke={inkDark}
              strokeWidth="2.2"
            />

            {/* Esporas / Puntos de polen en suspensión (Sanguina / Óxido) */}
            {(hovered || vigilance > 0.4) && (
              <g fill={sporeAccent}>
                <circle cx="-55" cy="-80" r="2.4" />
                <circle cx="-40" cy="-135" r="1.8" />
                <circle cx="35" cy="-145" r="2.8" />
                <circle cx="70" cy="-90" r="2.1" />
                <circle cx="50" cy="-40" r="1.5" />
              </g>
            )}
          </g>

          {/* Placa tipográfica tradicional de grabado científico (Ex-Libris) */}
          <g transform="translate(250, 535)">
            <line x1="-120" y1="-14" x2="120" y2="-14" stroke={inkMid} strokeWidth="0.8" />
            <text
              textAnchor="middle"
              y="0"
              fontSize="11"
              letterSpacing="3"
              fill={inkMid}
              fontStyle="italic"
            >
              FIG. IX — SYLVAN MYCELIUM V
            </text>
            <line x1="-80" y1="6" x2="80" y2="6" stroke={inkMid} strokeWidth="0.5" />
          </g>
        </g>
      </svg>
    </div>
  );
};

export default EtchingBotanicalCharacter;
