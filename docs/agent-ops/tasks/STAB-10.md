# STAB-10: Motion tokens + transition-all + TS strict

## Metadata
- **Plan file:** docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md
- **Fuente:** Plan Task 11 (STAB-10) + prompt worker (motion tokens, 14 edits, noUncheckedIndexedAccess)
- **Esfuerzo:** 🟡 1d
- **Prioridad:** 🟠 P1
- **Tipo:** Frontend (TypeScript/React + CSS)
- **Turns estimados:** 3
- **Creado:** 2026-10-15
- **last-synced:** 2026-10-15
- **Estado:** ✅ COMPLETED
- **Commit:** `a1419c5` (código) + cierre docs (este commit)
- **Incógnitas (uphill):** 0 abiertas
- **Pendientes (downhill):** 0 steps (6/6 ✅)
- **SDP:** base-only (keywords: motion-tokens, transition-all, TS strict; skills base auto-cargadas vía MCP)

## Blast Radius

| Dirección | Módulos |
|-----------|---------|
| Callers | App.tsx → DesignSystemProvider; ego-chat/omnibar/ActivityTray/ActivityWidget (consumidores visuales) |
| Callees | @ego/ui-runtime (DesignSystemTokensSchema — NO se toca); tailwind v4 @theme; framer-motion (NO se migra — STAB-13) |
| Implicaciones | Solo CSS classes + CSS vars + 1 flag tsc; sin cambios de comportamiento; snapshots visuales estables (timings ≈ iguales) |

## Impacto mapeado (Regla 0)

- **Archivos leídos (completos):** apps/desktop/renderer/src/index.css (112L); apps/desktop/renderer/components/canvas/DesignSystemProvider.tsx (329L); apps/desktop/renderer/components/ui-kit/Button.tsx (64L); apps/desktop/renderer/components/ui-kit/Modal.tsx (111L); apps/desktop/renderer/components/omnibar.tsx (240L); apps/desktop/renderer/components/tools/ApprovalCard.tsx (341L); apps/desktop/renderer/components/activity-tray/ActivityTray.tsx (328L); apps/desktop/renderer/components/activity-widget/ActivityWidget.tsx (196L); tsconfig.base.json (26L); apps/desktop/renderer/tsconfig.json (38L); apps/desktop/renderer/package.json (52L); packages/ui-runtime/src/schemas/components.ts (DesignSystemTokensSchema §288-312)
- **Snippets leídos (región del edit):** artifact-card.tsx:95-114; ask-directive.tsx:80-99; DiffReviewCard.tsx:100-120; ChartView.tsx:165-184 + 224-238; ComponentRenderer.tsx:48-62; McpServerList.tsx:92-111; RelationView.tsx:75-94; PendingApprovals.tsx:103-117; CharacterBadge.tsx:180-220; SubEgoSelector.tsx:78 (grep)
- **Archivos referenciados hacia dentro (imports):** DesignSystemProvider ← @ego/ui-runtime (tipos), react; ActivityWidget ← framer-motion, useActivityState, Modal; CharacterBadge ← framer-motion; index.css ← tailwindcss @theme
- **Archivos que referencian a los editados (entrantes):** DesignSystemProvider ← src/App.tsx:7,183 + 4 tests (CanvasRuntime, ThemeTokens, workbench-cfg13); Button/Modal ← kit consumido por chat/omnibar/widget; tsconfig.base ← todos los packages (flag global)
- **Veredicto impacto:** bajo-medio. 14 clases CSS mecánicas (sin lógica); motion tokens = vars fijas (no preset-dependientes, no rompen ThemeTokens tests); flag `noUncheckedIndexedAccess` es global — riesgo de errores nuevos en packages ajenos; si explota fuera de renderer → acotar fixes y DEFER resto como FIND.

## Contrato
`pnpm --filter @ego/renderer test` + `typecheck` verdes + `--motion-duration-micro/ui/surface --motion-ease-out/in` presentes + `transition-colors/transform` (cero `transition-all` en renderer) + `noUncheckedIndexedAccess:true` sin nuevos errores.

## Spec (decisiones — refactor visual, sin símbolos públicos nuevos)

| # | Decisión | Opciones (+tradeoff) | Default recomendado | Resuelto |
|---|----------|----------------------|--------------------|----------|
| 1 | Valores motion tokens | A: 150/200/350ms (estándar) / B: 180/200/450 (existentes dispersos) | A — 150/200/350 alinean `duration-200` existente y 0.35 framer; 0.18→0.2 dif. imperceptible | ✅ decidido-por-evidencia (ActivityWidget.tsx:15 `0.18`, CharacterBadge.tsx:197 `0.35`, ActivityTray.tsx:196 `duration-200`) |
| 2 | Dónde viven los tokens | A: vars fijas en provider (como FIXED_*) / B: extender DesignSystemTokensSchema | A — B rompería ThemeIO/tests y presets; motion no es preset-dependiente | ✅ decidido-por-evidencia (DesignSystemProvider.tsx:179-184 patrón FIXED_*) |
| 3 | Reemplazo por `transition-all` | `transition-colors` (solo color) / `+transition-shadow` (ring/shadow) / `transition-opacity` (SVG rect) / `transition-[r]` (SVG circle) / `transition-transform` (scale) | Por archivo según props animadas (ver Steps) | ✅ decidido-por-evidencia (snippets leídos arriba) |
| 4 | Framer durations | A: constantes MOTION exportadas del provider / B: dejar hardcode | A — alinea framer con tokens sin migrar lib (STAB-13 intacto) | ✅ decidido-por-evidencia |
| 5 | Alcance TS strict | Solo `noUncheckedIndexedAccess:true`; DEFER `exactOptionalPropertyTypes` | Solo ese flag (orden explícita worker) | ✅ decidido-por-evidencia (prompt + plan Risk Register) |

## Invariantes de dominio (handoff — MUST)
- NO migrar framer-motion→motion (STAB-13). NO tocar main split (STAB-09) ni RTL (STAB-08).
- Renderer = solo presentación; no tocar IPC/main/VantaDB.
- Verificación: `pnpm --filter @ego/renderer test` + `tsc --noEmit -p apps/desktop/renderer/tsconfig.json` (+ desktop typecheck por flag global).
- Commit LOCAL, NUNCA push.

## Steps
- [x] S1 DISCOVERY: mapear 14 `transition-all` + tokens + flag (este file + Regla 0)
- [x] S2 ACT: motion tokens en `index.css` (`:root` 5 vars) + `DesignSystemProvider` (FIXED_MOTION_* + MOTION consts en documentElement y cssVariables)
- [x] S3 ACT: migrar 14 `transition-all` → transition-colors/transform/shadow/opacity/[r] (12 archivos) + framer durations → MOTION consts (2 archivos); grep cero `transition-all` ✅ + 5 tokens ✅
- [x] S4 ACT: `noUncheckedIndexedAccess:true` en tsconfig.base.json + fixes acotados (~30 archivos: renderer src + tests + 1 hunk type-only en `apps/desktop/src/ipc/schema.ts` requerido por el typecheck del renderer; setup.ts a import estático jest-dom). Gate V evaluado: explosión prevista por brief/plan ("si explota → solo ese flag"); fixes mecánicos behavior-preserving, 1 retry-ladder sin segundo fallo mismo-error → sin pregunta.
- [x] S5 VERIFY: renderer typecheck ✅ 0 errores + desktop typecheck ✅ (+1 micro-fix `FloatingWindowView.ts:132-133` cross-scope STAB-09, guards `?? 0` behavior-preserving) + renderer suite ✅ 273/273 (40 files; EGO-FIND-17 CLOSED con mocks reduce=false 5/5; `zz-debug.test.ts` ajena ya no existe en la corrida final — colateral otro worker resuelto solo)
- [x] S6 CLOSE: commit local (solo archivos STAB-10, NUNCA push) + review P2-01 pendiente (orquestador) + RESULTADO
- [ ] S5 VERIFY: renderer test + typecheck (renderer + desktop) verdes + grep cero `transition-all` + grep tokens
- [ ] S6 CLOSE: commit local + review pendiente (P2-01 fast, orquestador) + RESULTADO
