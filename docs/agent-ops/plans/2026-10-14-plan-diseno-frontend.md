# Plan — Auditoría y corrección diseño frontend (UI-01 código + UI-02 docs)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cerrar los hallazgos visuales verificados en código + las 11 contradicciones de docs con decisiones HITL del owner (2026-10-13/14).

**Architecture:** Tokens como fuente única; kit base con cva; temas reales vía `--ego-*`; a11y WCAG AA; docs sincronizados con el código.

**Tech Stack:** React 19, Tailwind v4, Vite, vitest, Playwright, axe.

**Decisiones HITL aplicadas:** Geist por import; accent ámbar #f59e0b; app-region en CSS; ego-chat a tokens; borrado total; clsx en kit; 4 presets funcionales; paletas unificadas; registry Zod-inferido; boundary global; skeletons; reservas anti-shift; lazy sí; virtualización sí; focus-visible global; trap+Escape; dim #8a8a92; D1 producto; D2 MONOLITO (silueta por defecto); D4 sí; D6 superficies; D9 formalizar; D10 dark-first; D11 sí; D12 sí; kit completo; split sí; a11y completo; axe+Playwright sí; radios/tipos sí. Pendiente: D3 (verificación CHAR en curso).

## Índice ejecutable (10 columnas canónicas)

| ID | Severidad | Hallazgo | Archivo:línea | Esfuerzo | Prioridad | Estado | Descripción | Relaciones | Dependencias |
|---|---|---|---|---|---|---|---|---|---|
| `UI-01` | 🔴 Crítica | **Tokens y tema reales** | `renderer/src/index.css` · `canvas/DesignSystemProvider.tsx` | 🟡 1-2d | 🔴 P0 | 🆕 Pendiente | Geist por import; accent ámbar; app-region CSS; conectar `--ego-*` (4 presets); chequear dim AA. Ver Task 1. | Plan §Task 1 | — |
| `UI-02` | 🔴 Crítica | **Chat al design system** | `components/ego-chat.tsx` | 🟢 1d | 🔴 P0 | 🆕 Pendiente | 13 inline → tokens; aria-label envío; skeleton. Ver Task 2. | Plan §Task 2 | `UI-01` |
| `UI-03` | 🟠 Alta | **Kit base + limpieza** | `components/ui-kit/` | 🟡 2-3d | 🟠 P1 | 🆕 Pendiente | Button/Input/Modal/Tabs/Badge cva; borrar muertos; registry tipado; radios/tipos. Ver Task 3. | Plan §Task 3 | `UI-01` |
| `UI-04` | 🟠 Alta | **A11y WCAG AA** | `renderer/` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | focus-visible global; trap+Escape; aria/tabs/teclado; axe CI; Playwright snapshots. Ver Task 4. | Plan §Task 4 | `UI-03` |
| `UI-05` | 🟡 Media | **Robustez render** | `src/main.tsx` · modales | 🟢 1d | 🟠 P1 | 🆕 Pendiente | Boundary global; split sidebar; skeletons; reservas anti-shift; lazy; virtualización. Ver Task 5. | Plan §Task 5 | `UI-03` |
| `UI-06` | 🟡 Media | **Docs diseño** | `docs/design/design-system.md` | 🟡 2d | 🟠 P1 | 🆕 Pendiente | design-system.md + D1–D12 (D3 tras verificación). Ver Task 6. | Plan §Task 6 | `UI-01` |

### Task 1: UI-01 — Tokens y tema reales
- **Ruta:** ego-desktop · **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/renderer typecheck` + tests renderer verdes + diff visual nulo salvo accent/dim/font.
- **Files:** `index.css` (accent, app-region, dim #8a8a92, radius-card real), `main.tsx` (import geist), `DesignSystemProvider.tsx` (consumo `--ego-*`), `ThemeControl` (4 presets).
- **Skills:** `test-driven-development`. **Verify:** typecheck + tests + grep 0 hex fuera de tokens en tocados.

### Task 2: UI-02 — Chat al design system
- **Ruta:** ego-desktop · **Estado:** ⬜ PENDING
- **Contrato:** 0 `style={{}}` con hex en `ego-chat.tsx` + aria-label envío + skeleton de turno.
- **Files:** `ego-chat.tsx`, `markdown-text.tsx` (accent), `ask-directive.tsx` (accent). **Verify:** grep + tests chat verdes.

### Task 3: UI-03 — Kit base + limpieza
- **Ruta:** ego-desktop · **Estado:** ⬜ PENDING
- **Contrato:** kit `ui-kit/` con 5 componentes + muertos borrados + registry sin `any` + radios/tipos unificados; suites verdes.
- **Files:** nuevo `components/ui-kit/`, borrar `union.tsx`/`ui.tsx`/`mock.ts`/streamdown/radius-card/electronAPI, `canvas/registry.ts`, paletas zinc→tokens, Recharts→tokens.
- **Verify:** typecheck + tests + `pnpm build`.

### Task 4: UI-04 — A11y WCAG AA
- **Ruta:** ego-desktop · **Estado:** ⬜ PENDING
- **Contrato:** focus-visible global, trap+Escape en 6 modales, aria/tabs/teclado, axe en CI en verde, snapshots Playwright base.
- **Files:** CSS global, modales, `DomainSelector.tsx`, `ci.yml`, `tests/` visual. **Verify:** axe 0 violaciones + snapshots base generados.

### Task 5: UI-05 — Robustez render
- **Ruta:** ego-desktop · **Estado:** ⬜ PENDING
- **Contrato:** boundary global + sidebar dividida + lazy + virtualización chat/tablas; suites verdes.
- **Files:** `main.tsx` (boundary), `sidebar.tsx` → 3 modales, `React.lazy` charts/dominios, windowing hilo/tablas.
- **Verify:** tests + build + medición antes/después (bundle + fps humo).

### Task 6: UI-06 — Docs diseño
- **Ruta:** ego-docs · **Estado:** ⬜ PENDING (D3 resuelto: parcial honesto)
- **Contrato:** `design-system.md` + D1/D2/D4–D12 aplicadas + `check-agents-refs.ps1` verde.
- **Files:** `docs/design/design-system.md`, `ux-ui.md`, `character-art-direction.md` (monolito por defecto), `character-system.md` (**parcial honesto**: implementado excepto persistencia UI CHAR-10, tests motor CHAR-05, benchmarks CHAR-11), `Backlog.md` (fila CHAR-03), `mascota.md` (superficies), `workspace-dinamico.md` (4 elementos), `hermes-agent.md` (cita B/N válida tras D9), `gui-desktop.md` (matiz dark-first), `roadmap.md`, `docs/index.md`.
- **Deuda registrada a UI-05:** tests motor CHAR-05, cableado persistencia UI CHAR-10, benchmarks+golden frames CHAR-11.
- **Verify:** refs + grep 0 contradicciones residuales.
