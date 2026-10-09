# Task: CHAR-04 — Contrato CharacterProfile y vínculo con SubEgoManifest

> **Fase:** 03 — Multi-Sub-Ego Runtime & Governance  
> **Estado:** ✅ completed  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

`SubEgoManifest.ts` gestiona la configuración cognitiva de los Sub-Egos (roles, prompts, herramientas, namespaces y presupuestos), pero carecía de un contrato tipado Zod para la morfología visual del personaje. Además, las especificaciones anteriores arrastraban conceptos obsoletos de ropa humana (`outfits`, trajes, corbatas) que colisionaban con la dirección de arte canónica aprobada en `CHAR-03` (Monolito Cuántico Pulsante y criatura no humanoide basada en el motor vectorial Coucou Mochi).

`CHAR-04` implementa el contrato tipado `CharacterProfile` con esquemas Zod en `packages/subegos/src/CharacterProfile.ts`, define su paleta cromática, rasgos morfológicos (`traits` anatómicos no humanoides), expresiones faciales y dinámicas de aura, y lo vincula de forma bidireccional y retrocompatible con `SubEgoManifest`.

---

## 2. Criterios de Aceptación (DoD)

- [x] Esquema Zod `CharacterProfileSchema` y tipos TypeScript exportados en `packages/subegos/src/CharacterProfile.ts`:
  - `id`: identificador del perfil (`char_<id>` o `ego.<id>.char`).
  - `baseForm`: silueta geométrica canónica (`"quantum-monolith"` | `"energy-core"` | `"fractal-polyhedron"` | `"coucou-mochi"`).
  - `palette`: colores primario, secundario, acento, aura y resplandor (con validación de formato hex/rgba).
  - `traits`: ranuras anatómicas abstractas no humanas (`halo`, `energy-cores`, `antennae`, `floating-shards`, `aura-field`). Cero vestimenta humana.
  - `defaultEye` y `defaultMouth`: estilo de ojos y boca canónicas.
  - `scale` y `pulseRate`: reactividad y factor de escala.
- [x] Vínculo en `SubEgoManifestSchema`: campo opcional `character?: CharacterProfileSchema`.
- [x] Función fábrica `createDefaultCharacterProfile(subEgoId, domain)` para generar identidades visuales armónicas según el dominio.
- [x] Métodos auxiliares `saveCharacterProfile` y `loadCharacterProfile` sobre VantaDB en `egos/<id>/character`.
- [x] Suite de pruebas completa en `packages/subegos/test/CharacterProfile.test.ts` pasando al 100% (11 tests passing).
- [x] Compilación TypeScript y typecheck limpios (`pnpm typecheck` exit 0).
