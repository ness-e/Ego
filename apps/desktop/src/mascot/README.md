# Mascota Ego — carpeta estándar

Contrato: `mascot.ts` (`{area, mood}` + acentos). Main decide, renderer renderiza.

## Estructura

```text
apps/desktop/src/mascot/
  mascot.ts            # contrato (áreas P0 + 6 moods + acentos)
  README.md            # este spec
  rive/                # 1 mascot.riv + SM Area×Mood (ViewModels, DataBinding)
  lottie/              # .lottie multi-animación (fallback playback)
  spline/              # prototipo 3D (vars area/mood) — no always-on
  three/               # .glb Blender (shape keys por área) — opcional 3D
```

## Matriz P0

Áreas: kb, crm, gov, general. Moods: idle, thinking, approval, celebrate, error, support.
Enfoque/Celebración/Apoyo del blueprint = thinking/celebrate/support.

## Interacción

Click → trigger mood (celebrate/error) + evento IPC a main. Drag: wrapper DOM/Electron
(`app-region`/pointer events); dentro del canvas solo Rive/Spline lo soportan nativo.
Ventana: `frame:false + transparent:true + alwaysOnTop` + `setIgnoreMouseEvents` con forward.

## Plan de prueba (las 4, misma rúbrica)

Aspecto (fidelidad blueprint) / rendimiento (bundle, RAM, FPS, arranque) / viabilidad
(offline, licencia, MCP-autoría). Ganador provisional: Rive (ver `../../docs/product/mascota.md`).
