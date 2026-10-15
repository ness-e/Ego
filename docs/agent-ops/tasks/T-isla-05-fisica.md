# T-isla-05 — Física springs + geometría (COUC-18 real)

Estado: ✅ COMPLETED

Contrato (plan §Task 5):
- `islandSize(compact).w < islandSize(expanded).w`
- hidden=240x6 strip, compact=NOTCH_W(184x32), expanded=720x320, hitl=720x400
- RAF stop en hidden; sin polling 60 Hz (event-driven)
- NO tocar FloatingWindowView ni main. Spec aprobada GO (Gate D disparado por spec GO).

## Spec (decisiones)
| # | Decisión | Evidencia |
|---|----------|-----------|
| 1 | hidden=strip 240x6, NO notch 0 | `island.rs:21-22` STRIP_W/H (wake strip); contrato Task 5 lo fija |
| 2 | compact=184x32 (NOTCH_W/H) | `layout.ts:57-58`; contrato "compact=NOTCH_W" |
| 3 | expanded=720x320 (PANEL) | `layout.ts:53-54` + SPEC.md taille fixe 720x320 |
| 4 | hitl=720x400 | contrato Task 5 (approval card más alta que panel base) |
| 5 | open spring 0.5/0.72, close 340 ms (.45,0,.2,1) | `anim.ts:56,121,128` + `island.ts` openSpring/closeEase |
| 6 | Port verbatim Spring/Tracked + alias avatar `curveTo` | `anim.ts:49-155` + `avatar anim.js:91-142` (campo renombrado a `curveTarget` para evitar colisión TS con el método) |
| 7 | `IslandAnimator`: crecer→spring, encoger→curva; RAF solo si animating; stop en hidden; `onRect` solo al cambiar | `island.ts:453` islandSize + PollGate (island.rs:57): parado cuesta 0 |
| 8 | `shouldAcceptMouse(mode)`: solo `hitl` | contrato: click-through por defecto, false solo en hitl_approval (el Manager lo cablea; este módulo NO importa Electron) |
| 9 | Tests en `apps/desktop/test/` ADEMÁS de `renderer/test/` | `apps/desktop/vitest.config.ts:4-6` excluye `renderer/**`; sin espejo el verify del contrato no corre |

## Impacto mapeado (Regla 0)
- Leídos completos: `repos-referencia/avatar/src/core/anim.js`, `repos-referencia/coucou/windows/src/core/anim.ts`, `layout.ts`, `island.rs` (§PollGate/geometría).
- Referencias hacia dentro: ninguna (módulo puro, cero imports).
- Referencias entrantes: ninguna aún (floating.tsx futuro — Task 3/6 — consumirá `IslandAnimator.onRect` → `win.setSize`).
- Veredicto: impacto aislado; `FloatingWindow.test.ts` 6 fallos PRE-EXISTENTES por `FloatingWindowView.ts` modificado por Task 3 en curso (no tocado aquí).

## Steps
- [x] 1. Read fuentes anim (avatar + coucou) + layout + island.rs
- [x] 2. Failing test (primero "No test files found" por exclude renderer/** → espejo en `test/`; luego FAIL módulo inexistente)
- [x] 3. Impl `floating-anim.ts` (Spring/Tracked/Ease/cubicBezier/closeCurve/islandSize/IslandAnimator/shouldAcceptMouse)
- [x] 4. Verify: `@ego/desktop` 14/14 ✅, `@ego/renderer` 14/14 ✅, tsc strict ✅, sin warnings
- [x] 5. DoD: commit local solo archivos propios

## SDP
SDP: base-only (keywords: spring/physics/geometry/RAF/island) — sin MCP campaign disponible en este worker; discovery manual vía referencias.

## Deuda / colaterales
- `FloatingWindow.test.ts` (WIDG-01/02): 6 fallos por trabajo en curso de Task 3 (`FloatingWindowView.ts` modificado, ajeno). No bloquea este contrato.
- `renderer/tsconfig.json` include `floating` lo aportó otro worker; no se commitea aquí.
