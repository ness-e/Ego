# SVG Architecture, 2D Vector Geometry & Canvas Engineering

Este documento formaliza la ingeniería de personajes vectoriales 2D mediante SVG declarativo estructurado y Canvas 2D de alto rendimiento.

---

## 1. SVG como Geometría Paramétrica en React/DOM

Un personaje vectorial no es un archivo estático exportado desde Illustrator: **es un árbol de nodos del DOM estructurado semánticamente**, donde cada extremidad es un grupo con su centro de rotación alineado con la articulación biológica:

```tsx
// Regla Inquebrantable de Transform-Origin en SVG:
// Los elementos deben diseñarse con respecto al origen de su articulación,
// o especificar transformOrigin explícito en píxeles locales del viewBox.
<g id="arm-left-group" style={{ transformOrigin: '-30px 10px', transform: `rotate(${armAngle}deg)` }}>
  <path d="M -30 10 C -35 25, -35 45, -30 60" stroke="#0ea5e9" strokeWidth="8" strokeLinecap="round" />
  <circle cx="-30" cy="62" r="6" fill="#38bdf8" />
</g>
```

### 1.1. Reglas de Relleno: `nonzero` vs `evenodd`
- **`evenodd`**: Ideal para perforaciones de ojos o cavidades de boca en una sola etiqueta `<path>` sin recurrir a elementos de recorte adicionales:
  Un trazado exterior en sentido horario combinado con un trazado interior también en sentido horario generará automáticamente un hueco transparente si `fillRule="evenodd"`.

---

## 2. Interpolador Analítico de Morphing Vectorial

Para animar transiciones de boca (de neutra a alegre o abierta) sin dependencias pesadas:

```typescript
export interface PathCommand {
  type: 'M' | 'C';
  values: number[]; // Coordenadas [x, y] o [cp1x, cp1y, cp2x, cp2y, x, y]
}

export function interpolatePathCommands(
  pathA: PathCommand[],
  pathB: PathCommand[],
  t: number
): string {
  if (pathA.length !== pathB.length) {
    throw new Error('Los trazados deben poseer la misma topología de comandos para realizar morphing');
  }

  const parts: string[] = [];
  for (let i = 0; i < pathA.length; i++) {
    const cmdA = pathA[i];
    const cmdB = pathB[i];
    const interpolatedValues = cmdA.values.map((valA, idx) => {
      const valB = cmdB.values[idx];
      return valA + (valB - valA) * t;
    });

    parts.push(`${cmdA.type} ${interpolatedValues.map(v => v.toFixed(2)).join(' ')}`);
  }
  return parts.join(' ');
}
```

---

## 3. Filtros SVG Nativos de Alto Rendimiento

Los filtros SVG mal diseñados pueden forzar la rasterización por software en la CPU. Para mantener aceleración de hardware por GPU:

```xml
<defs>
  <!-- Resplandor emisivo optimizado: combina un blur rápido con la fuente original -->
  <filter id="neonGlow" x="-25%" y="-25%" width="150%" height="150%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="glowBlur" />
    <feColorMatrix in="glowBlur" type="matrix" values="
      1 0 0 0 0
      0 1 0 0 0
      0 0 1 0 0
      0 0 0 2 -0.1" result="boostedGlow" />
    <feMerge>
      <feMergeNode in="boostedGlow" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
</defs>
```

---

## 4. Canvas 2D de Alta Densidad: Patrón Path2D Reutilizable

Cuando se requiere renderizar decenas de clones de la mascota (ej. fondo dinámico o miniaturas múltiples), el DOM de SVG se satura. Se utiliza **Canvas 2D con objetos `Path2D` cacheados fuera del render loop**:

```typescript
export class CanvasMascotRenderer {
  private headPath: Path2D;
  private eyePath: Path2D;

  constructor() {
    // Inicializar geometría una sola vez (Cero allocations en render)
    this.headPath = new Path2D();
    this.headPath.roundRect(-25, -20, 50, 40, [14]);

    this.eyePath = new Path2D();
    this.eyePath.arc(-10, -2, 4, 0, Math.PI * 2);
    this.eyePath.arc(10, -2, 4, 0, Math.PI * 2);
  }

  public render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    scale: number,
    colorHex: string
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    // Dibujar cabeza
    ctx.fillStyle = colorHex;
    ctx.fill(this.headPath);

    // Dibujar ojos
    ctx.fillStyle = '#00f0ff';
    ctx.fill(this.eyePath);

    ctx.restore();
  }
}
```
Este enfoque procesa más de 500 instancias simultáneas a 60 FPS estables.
