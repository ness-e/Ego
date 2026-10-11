# Lumi — Mascota 3D Suave & Expresiva (Soft 3D Companion)

Suite de demostración y producción para mascotas 3D estilizadas, suaves y personalizables con actuación emocional en WebGL/Three.js.

## Componentes

1. **`types.ts`**: Tipos de datos para 8 expresiones, 10 actuaciones, 5 materiales y parámetros físicos.
2. **`Soft3DCompanionEngine.ts`**: Motor cinemático y de actuación desacoplado con conservación de volumen $S_{xz} = 1/\sqrt{S_y}$, acoplamiento de sombra de contacto y física de orejas.
3. **`tests/run-tests.ts`**: Suite automatizada con 13 pruebas unitarias e integración de inyección/reparación de `DEF-ANI-BLOB`.
4. **`soft-3d-companion-viewer.html`**: Visor 3D interactivo en Three.js con órbita 360°, selector de materiales, selector de 8 expresiones, disparador de 10 actuaciones y telemetría de GPU/FPS.

## Ejecución de Pruebas

```bash
npx tsx .agents/skills/character-forge/examples/soft-3d-companion/tests/run-tests.ts
```
