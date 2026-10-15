# T-isla-12-docs — Cierre formal isla flotante (docs-only, Task 12)

- **Plan file:** `docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md` (Task 12, Wave 7 paralelo con Task11-E2E — DISJUNTOS docs vs tests)
- **Tipo:** docs-only, cero código. Archivos permitidos SOLO: `docs/roadmap/Backlog.md`, `docs/review/backlog-coucou.md`, `docs/architecture/character-system.md`, `docs/product/ux-ui.md`, plan file (correcciones comando/motion), este task file (crear). `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` solo si aplica workaround (no aplica — ver DoD).
- **Prohibidos:** `apps/*`, `packages/*`, `tests/*`, `repos-referencia/*` (lectura ok), `verify-audit.jsonl`, `Arreglar-OpenCode.ps1`, `Untitled-1.py`, `__pycache__/`, `robot-chat-follow.png`, Task11 files. **NO commit (orquestador), NUNCA push.**

## Spec — decisiones de estado (excepción docs-only NO aplica: SÍ hay decisiones)

| D | Decisión | Alternativas | Recomendado + evidencia |
|---|----------|--------------|-------------------------|
| D1 | Estado COUC-19 | (a) ✅ Completada / (b) ✅ Parcial / (c) dejar 📋 Planificada | **(a) Completada.** Evidencia: `6de7291` — `tray-status.ts` (TRAY_COLORS tricolor + tooltips idle/pensando/HITL, `pauseAllTasks`/`resumeAllTasks`), `main.ts` (`createTrayIcon`, `refreshTrayStatus`, menú Open/Settings/Pause/Quit, click-restore), `WindowStateManager.ts` (key `floating_window` + debounce 500ms + `validateBoundsAgainstDisplays`), tests `floating-persist` + `tasks-wiring`. Nada pendiente del contrato. (c) es falso: el trabajo existe. |
| D2 | Estado COUC-20 | (a) ✅ Parcial procedural + WAV futuro P2 / (b) ✅ Completada / (c) 🚫 Descartada | **(a) Parcial.** Evidencia: `4f90fa2` — `floating-sound.ts` envuelve `repos-referencia/avatar/src/runtime/sound.js` (SOUND_NAMES/STATE_SOUND/EMOTE_SOUND/ACTION_SOUND, volumen 0.12.bounds [0,0.2], idle-suspend 1500ms; cero WAV binarios). (b) es falso: motor WAV completo pendiente P2. (c) prohibida por contrato (sin descarte). |
| D3 | COUC-17/18 | (a) ✅ Completada real / (b) mantener "absorbida" T09 | **(a) Completada real.** Evidencia: COUC-17 → `0a3ef0e` (floating.html+contenido), `06bb54b` (autoshow), `f129dc2` (vistas), `8b24737` (HITL ACK), `6de7291` (persist); COUC-18 → `e3b3903` (`floating-anim.ts`: Spring/Tracked/Ease, islandSize, RAF detenido en hidden, click-through event-driven). "Absorbida" era marcador T09, ya superado por implementación. |
| D4 | Paths WIDG-01/02/04 | (a) corregir los 3 a `src/` / (b) solo WIDG-02 | **(a) los 3.** `git grep "apps/desktop/main/windows" docs/roadmap/Backlog.md` debe dar 0 matches (aceptación); WIDG-01 y WIDG-04 contienen el mismo path obsoleto (líneas 336, 339). Real verificado: `apps/desktop/src/windows/FloatingWindow.ts` + `apps/desktop/renderer/floating/floating.html` existen. |
| D5 | Plan: comandos + motion | (a) `@ego/renderer` + `motion="reduce"` / (b) dejar como está | **(a).** Evidencia: `apps/desktop/renderer/package.json` = `@ego/renderer` con `test: vitest run`; los 5 suites floating viven en `apps/desktop/renderer/test/` (anim/avatar/sound/upload/views). `policy.js:11-26`: `motion=auto|reduce|full` — `"still"` es valor inexistente. Main-process tests (FloatingWindow/autoshow/persist) quedan en `@ego/desktop`. |

Gate D: sin bifurcación real — la evidencia de commits dirime D1–D5. No dispara pregunta; tabla Spec arriba es el registro.

## Impacto mapeado (Regla 0)

- **Leídos completos:** plan Task 12 (`:626-660`) + Task 2 `:166` + comandos renderer (10 líneas); `Backlog.md:336-339,426`; `backlog-coucou.md:40-59,63-102`; `character-system.md` §6 (`:178-217`) + §7 (`:219-231`); `ux-ui.md` D8 (`:63-64`); `.agents/references/backlog-format.md` (10 columnas); `tray-status.ts` (vía `git show 6de7291`), `policy.js:11-26`, `sound.js:7-38`, T-isla-04/05/06/07/09/10 + T-isla-gates (invariantes y precedentes).
- **Referencias hacia dentro:** ninguna (markdown, cero imports).
- **Referencias entrantes:** plan file Task 12 apunta a estos docs; Task11-E2E paralelo no toca docs (disjunto).
- **Veredicto:** impacto aislado a 6 markdown; una columna rota invalida validate → editar solo celdas, no reformatear; verificar 10 pipes por fila editada + validator antes/después.

## Steps

- [x] 1. Discovery: evidencia commits (10/10 en log) + paths reales + baseline validator (Backlog 0E/0W; coucou 0E/4W conocidos).
- [x] 2. Backlog.md: WIDG-01/02/04 → paths `src/`; grep 0 matches.
- [x] 3. backlog-coucou.md: COUC-17/18 ✅ real, COUC-19 ✅ Completada, COUC-20 ✅ Parcial (WAV P2, sin descarte).
- [x] 4. character-system.md §7 + ux-ui.md D8: triple superficie (in-app vs Tray OS vs desktop-float).
- [x] 5. Plan: 10 comandos → `@ego/renderer` + `motion="still"` → `motion="reduce"` + Task12 Step 3 alineado.
- [x] 6. VantaDB governance: sin workaround → sin entrada (declarado).
- [x] 7. Verify: grep + validator sin errores nuevos + conteo de columnas; §Review Fast; RESULTADO + STOP.

## Verify (contrato)

- `git grep "apps/desktop/main/windows" docs/roadmap/Backlog.md` → exit 1, 0 matches.
- `format-validator.mjs` Backlog.md + backlog-coucou.md → 0 errores; warnings ≤ baseline (4 conocidos, COUC-19 sale de la lista).
- Docs lint `scripts/validate-docs-coverage.ps1` → no existe → N/A declarado.

### Resultados obtenidos 2026-10-15

- grep path obsoleto → 0 matches (exit 1); `motion="still"` → 0 matches; suites renderer con `@ego/desktop` → 0 matches; `@ego/renderer test` ×11; main-process `@ego/desktop` ×6 intactos.
- validator: Backlog.md 0E/0W (= baseline); backlog-coucou.md 0E/3W (baseline 0E/4W; sale warning COUC-19; COUC-20 warning con texto nuevo por estado `✅ Parcial` mandado por contrato; COUC-22/23 intactos). Cero errores nuevos.
- Filas editadas con 10 celdas: WIDG-01/02/04, COUC-17/18/19/20.
- `scripts/validate-docs-coverage.ps1` inexistente → docs lint N/A.
- Sin commit (orquestador con mensaje `docs: cierre formal isla flotante COUC-17/18/19/20`); sin push.

## DoD docs

Tablas 10 columnas válidas; paths verificados por lectura (`Test-Path` FloatingWindow.ts + floating.html = True); sin secretos; LICENSE-ASSETS respetada (cero afirmaciones de clon Mochi); VantaDB: persistencia isla usa namespace/key estándar (`system/window-state` + `floating_window`, mismo patrón que `main_window`), cero workarounds → sin entrada `VDB-BUG-*` (DoD no bloquea).

## §Review (P2-01 Fast, docs/*)

Spot-check del reviewer: cada fila editada conserva 10 celdas (conteo de pipes); estados COUC con evidencia commit citada; paths `src/` existen en disco; D8 ya no declara "island completa" como futuro; plan ya no contiene `motion="still"` ni comandos `@ego/desktop` para suites renderer. Veredicto: **approve**. Colaterales fuera de blast radius intactos y no commiteados: `verify-audit.jsonl` (M pre-tarea), `Arreglar-OpenCode.ps1`/`Untitled-1.py`/`__pycache__`/`robot-chat-follow.png` (untracked), `FloatingWindow.test.ts` x6 (Task11, owner SEC-01).

**Skills cargadas (SDP manual):** campaign-executor (gates D/V/C + RESULTADO §7) · progreso (tracking + cierre en este archivo) · writing-guidelines (estilo, tablas intactas) · documentation-and-adrs (sin ADR nuevo: no hay decisión arquitectónica, solo estados) · code-review-and-quality (§Review Fast). SDP manual: sin MCP `campaign_discover_skills_v2` en este harness (precedente T-isla-04/05); keywords docs/backlog/validate → skills arriba, 1 línea cada una.
