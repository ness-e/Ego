# Task: CHAR-07 — Presets y `TraitRegistry` de rasgos compatibles con la criatura

> **Fase:** 03 — Sub-Egos (P0-Alpha)  
> **Estado:** ✅ completed  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

Para distinguir instantáneamente a cada Sub-Ego del sistema manteniendo la coherencia de la familia biológica de la criatura, se requiere un registro modular de rasgos anatómicos y energéticos (`TraitRegistry.ts`), respetando la regla innegociable de **cero vestimenta humana** (sin ropa, gorros ni bufandas). La distinción se fundamenta en proporciones, rasgos geométricos, apéndices sensoriales, halos de resonancia y paletas cromáticas sobrias.

`CHAR-07` implementa:
1. `TraitRegistry` con categorías: `sensor`, `crest`, `visor`, `aura`, `glyph` y capas `back`, `body`, `front`, `overlay`.
2. Verificación y validación de compatibilidad anatómica entre traits (`validateCompatibility`).
3. 5 presets canónicos de dominio según `SubEgoFactory` y `domainTemplates`:
   - `researcher` (Cian zafiro, antena de escaneo orbital y visor analítico).
   - `code_reviewer` (Violeta índigo, cresta geométrica angular de precisión).
   - `copywriter` (Ámbar cálido / oro solar, halo perimetral de resonancia armónica).
   - `analyst` (Esmeralda menta, nodos bipolares de telemetría de datos).
   - `planner` (Amatista sobrio, corona geométrica de fases de roadmap).
   - `ego.nucleus` (Silueta pura, neutra y equilibrada sin apéndices).
4. Motor de dibujo por capas (`renderLayer`) compatible con Canvas 2D y proyección 3D simulada de `CharacterWardrobe`.

---

## 2. Criterios de Aceptación (DoD)

- [x] `TraitRegistry` implementado con registro y consulta fuertemente tipados.
- [x] Cero elementos de vestimenta humana en los traits registrados.
- [x] 5 presets canónicos de dominio implementados más el preset núcleo (`ego.nucleus`).
- [x] Validación de compatibilidad para evitar solapamientos visuales caóticos.
- [x] Suite de pruebas unitarias pasando al 100% (`apps/desktop/test/trait-registry.test.ts`).
- [x] `pnpm typecheck` exit 0 y `pnpm build` sin errores.
