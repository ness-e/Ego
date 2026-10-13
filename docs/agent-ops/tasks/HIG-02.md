# HIG-02 — Gate automático contra `dist/` obsoleto

- **Estado:** ⏳ EN PROGRESO
- **Plan:** `docs/agent-ops/plans/2026-10-13-plan-deuda-residual.md` (Task 2)
- **Archivos clave:** `apps/desktop/test/*.test.ts` (consumen `@ego/*` → `dist`), `packages/*/package.json` (`main`/`exports` → `dist`), `packages/*/dist/`, `scripts/ensure-fresh-dist.cjs` (nuevo), `apps/desktop/package.json` + `tests/package.json` (hook `pretest`)
- **Contrato:** suite que consuma `dist/` falla en rojo si el dist está obsoleto, o pre-test reconstruye automáticamente; 0 regresiones.
- **Skills (SDP):** `campaign-executor` (base), `test-driven-development` (pinned), `systematic-debugging` (pinned, decisión HITL ya tomada: rebuild pre-test)
- **Referencias leídas:** `pipeline-full.md` (completo), `definition-of-done.md` (completo), `dev-tools.md` (completo), `clean-code-clean-architecture.md` (Apéndice V completo + §7 TDD/FIRST + §8.2)

## Spec (decisiones HITL del plan + zero-code planning)

| Decisión no declarada en el plan | Opción elegida (recomendada) | Fundamento |
|---|---|---|
| Gate rojo vs rebuild pre-test | **Rebuild pre-test automático solo-si-obsoleto** (recomendado) | HITL del plan ya decidió "rebuild pre-test". Solo-si-obsoleto (mtime `src` > `dist`) evita reconstruir 17 paquetes en cada corrida; si el build falla → exit 1 rojo con mensaje. Cubre ambas ramas del contrato en un solo mecanismo. |
| Dónde vive el gate | **Script compartido en raíz `scripts/ensure-fresh-dist.cjs` + hook `pretest` en `apps/desktop` y `tests`** | Ponytail: un solo script, dos consumidores (`apps/desktop/test` y `tests/e2e` consumen `dist`; HIG-01 §Spec fijó identidad `dist`). CJS sin dependencias (estilo `verify-dist.cjs` existente) → cero installs, funciona con `node` pelado. |
| Alcance de paquetes escaneados | **Todos `packages/*` con script `build`** (superconjunto) | Más simple y robusto que resolver el closure de deps por package.json; el costo extra es solo un walk de mtimes. Prohibido tocar `packages/*/src`. |
| Criterio de staleness | **`dist` ausente O cualquier `src/**/*.ts` más nuevo que el `dist` más nuevo** | Heurística mtime pura, sin hashes ni estado. Falsos positivos (rebuild de más) son inocuos; falsos negativos requerirían clock-skew, fuera de alcance. |
| Test del gate | **Unit test vitest `ensure-fresh-dist.test.ts` con dirs temporales** (fresh / src-stale / dist-ausente) | FIRST: rápido, aislado, determinista. Prueba estado (qué devuelve `isStale`), no interacciones. El modo de fallo end-to-end se demuestra con el `dist` real ya obsoleto (knowledge `src` 6:35pm > `dist` 6:17pm el 2026-10-12). |

## Impacto mapeado (Regla 0)

- **Archivos leídos completos:** `apps/desktop/test/knowledge-ipc.test.ts` (245L — importa `@ego/knowledge`+`@ego/memory` → `dist`), `apps/desktop/package.json`, `tests/package.json`, `packages/knowledge/package.json`, `packages/memory/package.json`, `apps/desktop/scripts/verify-dist.cjs` (85L), `apps/desktop/vitest.config.ts`, `docs/agent-ops/tasks/HIG-01.md` (deuda: identidad `dist` + frescura delegada a HIG-02).
- **Referencias hacia dentro (tests → paquetes):** `apps/desktop/test/*.test.ts` → `@ego/*` resuelve a `packages/*/dist/index.js` vía `main`/`exports` (verificado: 1 solo import directo a `dist` — `canvas-interaction.test.ts:14` vía `ui-runtime/dist`; el resto vía specifier `@ego/*`). `tests/e2e/*.test.ts` → mismo patrón (HIG-01).
- **Referencias entrantes del cambio:** hook `pretest` se dispara en `pnpm test` / `pnpm --filter ... test` (npm/pnpm lifecycle); no afecta `vitest` directo ni watch. `pnpm -r test` en raíz invoca cada `test` → cada consumidor reconstruye lo obsoleto (idempotente).
- **Veredicto:** blast radius = `scripts/ensure-fresh-dist.cjs` (nuevo) + 2 líneas `pretest` + 1 test nuevo. Prohibidos intactos: `packages/*/src`, `.agents/**`. `dist/` se regenera con el toolchain del repo (`tsc -p`), sin cambios de comportamiento.

## Steps de ejecución

- [x] Step 0 (DISCOVERY): inventario + taskfile con Spec/Impacto/Steps/Review
- [x] Step 1 (RED): `apps/desktop/test/ensure-fresh-dist.test.ts` que falla (módulo inexistente) — confirmado rojo
- [x] Step 2 (GREEN): creado `scripts/ensure-fresh-dist.cjs` + hooks `pretest` → test 5/5 verde. Hallazgos en GREEN: (a) orden alfabético ≠ topológico → loop multi-pass (máx 3); (b) `packages/memory` sin `src/` (layout raíz F6T13) → `sourceFiles()` con exclusiones
- [x] Step 3 (VERIFY fallo): 16 paquetes obsoletos detectados+reconstruidos exit 0; memory tocado a propósito → detectado+reconstruido; desktop 27f/138t ✅, e2e 8f/45t ✅, knowledge 17f/65t ✅, typechecks desktop+e2e exit 0
- [x] Step 4: CIERRE con bloque RESULTADO (sin commit — ego-worker no commitea)

## Review (self-harness: propose → evaluate → accept)

- Propose: gate mtime-only + rebuild vía `pnpm --filter <pkg> build`, un script compartido, dos hooks.
- Evaluate: (a) correctitud — mtime es la señal que el propio FS ya da; rebuild usa el build canónico de cada paquete; fallo de build → exit 1 (rama roja del contrato); (b) simplicidad — ~80 líneas CJS, sin deps, sin estado, mismo estilo que `verify-dist.cjs`; (c) consistencia — respeta guardrails y la decisión HITL "rebuild pre-test".
- Accept: pendiente de VERIFY mecánico (Step 3).

## Apéndice V (clean-code: mapa de adaptación aplicado)

- Funciones ≤20 líneas, un nivel de abstracción por función (SLAP); nombres del dominio (`isStale`, `findStalePackages`, `rebuildPackage`).
- Sin `any` (CJS con JSDoc mínimo); errores con mensaje accionable (qué paquete, qué archivo src es más nuevo, qué comando correr).
- Tests DAMP + FIRST: cada caso es autocontenido con dirs temporales propios.
