# STAB-13 — UX motion/Modal/composer/targets/omnibar

- **Estado:** ⏳ IN PROGRESS (DISCOVERY completo → ACT)
- **Plan:** `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md` (Wave 4 P1)
- **Contrato:** `pnpm --filter @ego/renderer test` + `a11y.test` verdes + Modal fade+scale con reduced-motion + `layoutId composer-action` + copy-confirm + targets 44px + omnibar `role=option+aria-selected+activedescendant+↑↓`
- **Prohibidos:** main/shared/CI/MCP · **NO migrar framer→motion lib** (solo durations ya en MOTION)
- **SDP:** base + `frontend-ui-engineering` (cargada; justificación: targets táctiles, foco, live-regions, composición)

## Spec (Gate D — decisiones no declaradas, opciones con Recomendado primero)

| # | Decisión | Opciones | Elegida |
|---|----------|----------|---------|
| D1 | Salida animada del Modal (Radix desmonta el portal al cerrar) | a) `forceMount` + AnimatePresence, exit en Overlay/Content (Recomendado: patrón documentado Radix+framer) · b) Sin exit (solo entrada) · c) Estado `mounted` local | a) |
| D2 | `autoFocus` nativos en omnibar/SessionPicker/ModelPicker/ProjectsModal | a) Quitarlos, foco gobernado por Radix auto-focus=primer tabbable=input (Recomendado: contrato literal) · b) Sustituir por `onOpenAutoFocus` explícito | a) |
| D3 | Morph Send→Cancel | a) `layoutId="composer-action"` + AnimatePresence `mode="wait"` 150ms, reduced-motion→0 (Recomendado) · b) Crossfade simultáneo `mode="sync"` (riesgo salto, pre-mortem) | a) |
| D4 | Copy-confirm en ActionBar (primitiva no expone estado `copied`, solo attr `data-copied`) | a) CSS `button[data-copied="true"]::after "✓"` en index.css (Recomendado: ponytail, 0 JS) · b) Componente custom con `useActionBarPrimitiveCopy` + estado propio | a) |
| D5 | Targets 44px sin romper layout | a) Clases literales `min-h-[44px] min-w-[44px]` en targets nombrados (Recomendado: auditable por grep/test) · b) Hit-slop `::before -inset` (invisible al test) | a) |
| D6 | Pane colapsado (SplitPane hoy `return null`) | a) Render oculto `visibility:hidden + aria-hidden + inert + width:0` con children (Recomendado: landmark persiste, foco imposible) · b) `return null` actual (landmark aside desaparece) | a) — verificar axe empírico |
| D7 | Tests a11y con `querySelector(dialog)==null` tras Escape | Actualizar a `waitFor` (comportamiento real con exit 150ms; en test reduced-motion=true → casi instantáneo) | sí |

## Impacto mapeado (Regla 0)

- **Archivos leídos completos:** `renderer/components/ui-kit/Modal.tsx:1-111`, `renderer/components/omnibar.tsx:1-240`, `renderer/components/ego-chat.tsx` (composer 1107-1174, bubbles 30-120, error 1006-1035), `renderer/components/activity-widget/ActivityWidget.tsx:1-197`, `renderer/components/PaneShell.tsx:1-207`, `renderer/components/assistant-ui/markdown-text.tsx` (copy-confirm existente "Copiado"), `renderer/src/App.tsx` (usos SplitPane/inspector), `renderer/test/a11y.test.tsx:1-374`, `renderer/test/setup.ts` (WAAPI stub + reduced-motion=true en tests), `renderer/src/index.css:100-121`, `renderer/components/tools/ApprovalCard.tsx:260-339`, pickers + ProjectsModal (líneas autoFocus), `ActionBarCopy.d.ts` (solo `data-copied`, sin estado).
- **Referencias hacia dentro (lo que toco usa):** `@radix-ui/react-dialog` (Root/Portal/Overlay/Content/Close), `framer-motion` 14.x (motion/AnimatePresence/useReducedMotion — ya dep), `MOTION.micro=0.15` (150ms = fade contrato), `cn()` cva, `Modal` ← SessionPicker/ModelPicker/Omnibar/WhyButton/Mcp*/ProjectsModal/ActivityWidget.
- **Referencias entrantes (quién usa lo que toco):** tests `a11y.test.tsx` (Modal base, pickers, ActivityWidget approval, WhyButton, App shell landmarks incl. `aside[aria-label]`, separator), `Omnibar.rtl.test.tsx` (Ctrl+K), `ApprovalCard.rtl.test.tsx`, `PickersAndShell.test.tsx` (SplitPane), `a11y-snapshots.test.tsx` (posible snapshot Modal — verificar).
- **Veredicto:** blast radius renderer-only, 0 archivos prohibidos. Riesgo principal: exit-animation deja `[role=dialog]` en DOM ~150ms → tests con assert síncrono de desaparición (ActivityWidget approval, WhyButton) pasan a `waitFor`. En tests reduced-motion=true → duration 0.

## Steps

- [x] S1 DISCOVERY — cero-código, Spec D1-D7 + Regla 0 (este file)
- [x] S2 ACT — Modal AnimatePresence (fade 150ms + scale .96→1, reduced-motion) + quitar 4× autoFocus
- [x] S3 ACT — composer layoutId composer-action + copy-confirm CSS + targets 44px (Revisar/HITL/cerrar/limpiar/Reintentar)
- [x] S4 ACT — omnibar navegable (activedescendant + ↑↓ + Enter + aria-selected + role=status) + SplitPane hidden+aria-hidden+inert
- [x] S5 VERIFY — nuevo `test/Stab13UxMotion.test.tsx` + ajustes `waitFor` a11y + `pnpm --filter @ego/renderer test` + typecheck verdes
- [x] S6 CIERRE — commit local (NUNCA push) + plan file + RESULTADO

## Verify (mecánico, 2026-10-15)

- `pnpm --filter @ego/renderer typecheck` ✅ 0 errores
- `pnpm --filter @ego/renderer test` ✅ 41 files / 281 tests (incl. `a11y.test` 15/15 axe 0 violaciones + `Stab13UxMotion` 8/8)
- Review P2-01 por agente distinto: pendiente → orquestador (igual que STAB-02/04)

## Residual (no-contrato, fuera de scope)

- Botones icon-only `p-1` de burbujas (Copy/Reload) y `removeAttachment p-0.5` quedan <44px: no nombrados en el contrato; WCAG 2.5.8 AA pide 24px — posible FIND follow-up, no bloquea.
- `composer-file-input hidden` (display:none) y tabs inactivas (no render) ya fuera de AT: sin cambio.
