import React, { useMemo } from 'react';

export type SvgExpression = 'neutral' | 'happy' | 'thinking' | 'surprised' | 'error';

export interface SvgGeometricMascotProps {
  size?: number;
  primaryColor?: string;
  accentColor?: string;
  expression?: SvgExpression;
  isHovered?: boolean;
  className?: string;
}

/**
 * SvgGeometricMascot — Mascota vectorial paramétrica de alta fidelidad
 * Diseñada según principios de silueta limpia y expresiones faciales analíticas.
 */
export const SvgGeometricMascot: React.FC<SvgGeometricMascotProps> = ({
  size = 120,
  primaryColor = '#0284c7',
  accentColor = '#00f0ff',
  expression = 'neutral',
  isHovered = false,
  className = '',
}) => {
  // Configuración de boca según expresión
  const mouthData = useMemo(() => {
    switch (expression) {
      case 'happy':
        return { path: 'M -12 2 C -6 12, 6 12, 12 2 Z', fill: accentColor };
      case 'surprised':
        return { path: 'M -5 2 A 5 7 0 1 0 5 2 A 5 7 0 1 0 -5 2 Z', fill: accentColor };
      case 'thinking':
        return { path: 'M -8 6 C -2 3, 2 8, 8 4', fill: 'none' };
      case 'error':
        return { path: 'M -10 8 C -5 2, 5 2, 10 8', fill: 'none' };
      case 'neutral':
      default:
        return { path: 'M -8 4 C -3 7, 3 7, 8 4', fill: 'none' };
    }
  }, [expression, accentColor]);

  // Cejas
  const browAngle = expression === 'error' ? 12 : expression === 'thinking' ? -8 : 0;

  return (
    <svg
      viewBox="-50 -50 100 100"
      width={size}
      height={size}
      className={`svg-geometric-mascot ${className}`}
      role="img"
      aria-label={`Mascota vectorial en expresión ${expression}`}
    >
      <defs>
        <radialGradient id="svgMascotShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0f172a" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>
        <filter id="svgMascotGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Sombra de contacto */}
      <ellipse cx="0" cy="42" rx="26" ry="6" fill="url(#svgMascotShadow)" />

      {/* Torso cilíndrico */}
      <rect x="-22" y="2" width="44" height="38" rx="12" fill={primaryColor} />

      {/* Emblema en el pecho */}
      <circle cx="0" cy="20" r="6" fill={accentColor} filter="url(#svgMascotGlow)" />

      {/* Cabeza (Squircle con transform-origin en cuello) */}
      <g
        id="mascot-head"
        style={{
          transformOrigin: '0px 2px',
          transform: isHovered ? 'rotate(-4deg) translateY(-2px)' : 'none',
          transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Carcasa */}
        <rect x="-30" y="-34" width="60" height="42" rx="16" fill={primaryColor} />

        {/* Visor oscuro */}
        <rect x="-24" y="-28" width="48" height="28" rx="10" fill="#090d16" />

        {/* Ojos emisivos */}
        <g filter="url(#svgMascotGlow)">
          <circle cx="-11" cy="-14" r="4.5" fill={accentColor} />
          <circle cx="11" cy="-14" r="4.5" fill={accentColor} />
          {/* Brillos especulares */}
          <circle cx="-9.5" cy="-15.5" r="1.5" fill="#ffffff" />
          <circle cx="12.5" cy="-15.5" r="1.5" fill="#ffffff" />
        </g>

        {/* Cejas */}
        <line
          x1="-16" y1="-21" x2="-6" y2={-21 + browAngle * 0.3}
          stroke={primaryColor} strokeWidth="2.5" strokeLinecap="round"
        />
        <line
          x1="6" y1={-21 - browAngle * 0.3} x2="16" y2="-21"
          stroke={primaryColor} strokeWidth="2.5" strokeLinecap="round"
        />

        {/* Boca */}
        <path
          d={mouthData.path}
          fill={mouthData.fill}
          stroke={accentColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Antena */}
        <line x1="0" y1="-34" x2="0" y2="-43" stroke={primaryColor} strokeWidth="3" strokeLinecap="round" />
        <circle cx="0" cy="-46" r="4" fill={accentColor} filter="url(#svgMascotGlow)" />
      </g>
    </svg>
  );
};
