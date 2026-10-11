# Pipeline de Renderizado 2D, Oclusión por Capas y Escalabilidad Visual

Este módulo formaliza el pipeline de composición en Canvas 2D / SVG, estableciendo el orden determinista de dibujo en 9 capas, la reutilización eficiente de trazados mediante `Path2D` y la adaptación visual a resoluciones reducidas.

---

## 1. El Orden Canónico de Composición en 9 Capas

Para garantizar que sombras, oclusiones de accesorios, rasgos faciales y señalética de agentes se dibujen sin solapamientos incorrectos ni errores de profundidad, el renderizador sigue una secuencia determinista:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PIPELINE DE COMPOSICIÓN EN 9 CAPAS (Canvas 2D)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Sombra Proyectada en Suelo (Ground Drop Shadow con penumbra radial)      │
│ 2. Elementos y Accesorios Posteriores (Z < 0: dobladillo trasero de gorro)  │
│ 3. Cuerpo Base (Superelipse / Squircle con gradiente difuso de luz)         │
│ 4. Oclusión Interna de Cuerpo (Penumbra de terminador y luz de rebote)      │
│ 5. Rasgos Faciales y Expresión (Ojos esféricos anamórficos, boca y rubor)   │
│ 6. Accesorios Delanteros (Z >= 0: gafas, lazos, bufandas, coronas)          │
│ 7. Brillos Especulares de Superficie (Highlight de luz cenital / frontal)   │
│ 8. Indicadores Operativos y Badges (dots, bang, question de agentes)       │
│ 9. Partículas y Efectos Temporales (Corazones, estrellas, 'z' de sueño)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Reutilización Eficiente de Trazados con `Path2D`

Para maximizar el rendimiento y evitar la instanciación de cientos de puntos trigonométricos por fotograma:
* Las siluetas base del cuerpo y formas estáticas se precalculan como instancias de `Path2D`.
* Durante el bucle de animación, se aplican transformaciones afines de matriz (`ctx.translate`, `ctx.rotate`, `ctx.scale`) en lugar de reconstruir los vértices superelípticos en CPU.

```typescript
// Precomputación estática
const bodyCache = new Path2D();
// ...trazado superelíptico...

// Dibujo en runtime (O(1) en asignación de memoria)
ctx.save();
ctx.translate(cx, cy);
ctx.scale(sx, sy);
ctx.fillStyle = lightGradient;
ctx.fill(bodyCache);
ctx.restore();
```

---

## 3. Escalabilidad Visual y Adaptación a Modo Icono / Compact

Cuando el personaje se visualiza en áreas muy reducidas (ej. $\le 48\text{ px}$ en un notch o bandeja del sistema):
1. **Supresión de Micro-detalles**: Se ocultan brillos especulares secundarios, partículas y franjas finas de textura que generarían ruido visual (*aliasing*).
2. **Engrosamiento de Rasgos Clave**: El grosor de líneas de ojos y siluetas se incrementa proporcionalmente para mantener la legibilidad y el reconocimiento de silueta.
3. **Badges Prioritarios**: Los badges de alerta (`!`, `?`) aumentan su escala relativa un $25\%$ sobre el cuerpo.
