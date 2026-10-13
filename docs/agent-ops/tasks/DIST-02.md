# DIST-02 — Configuración `asarUnpack: ["**/*.node"]`

| Campo | Valor |
|---|---|
| Estado | ⏳ IN PROGRESS (69e71751-dcf9-4d18-8b9b-b2e4e0a7b9c4 — no aplica; subagente sin MCP campaign) |
| Ruta | ego-lead (solo config; NO commit, NO tag, NO push) |
| Contrato | config con `asarUnpack: ["**/*.node"]` verificada + Backlog `DIST-02` a ✅ con evidencia. Compuerta HERM-15 (tabla extracción `Backlog.md:469`) |
| SDP | `ci-cd-and-automation` (skill cargada; resto base-only — tarea solo-config sin código nuevo) |
| Plan | `docs/agent-ops/plans/2026-10-13-plan-deuda-residual.md` §Task 7 |

## DISCOVERY (zero-code planning)

### Archivos leídos (completos)
- `apps/desktop/electron-builder.config.cjs` — `asar: true` (l.22) + `asarUnpack: ['**/*.node', '**/node_modules/vantadb/**', '**/node_modules/vantadb-node/**']` (l.23-27). Contrato ya presente.
- `apps/desktop/scripts/verify-dist.cjs` — chequeo exigible ya existe: artefactos (3) + carga config (1) + `asar===true` (1) + `asarUnpack` incluye `**/*.node` (1) + `files` dist/** y renderer/dist/** (2) + buildResources assets (1) = 9 chequeos. Invocado por `apps/desktop/package.json` script `build` (l.8).
- `docs/operations/despliegue.md` §Instalador P0 (l.15) — cita mandatoria `asarUnpack: ["**/*.node"]` para `vantadb-node`. ✅ cita verificada.
- `docs/roadmap/Backlog.md:469` — compuerta `HERM-15` (tabla extracción: exclusión ASAR → habilita `DIST-02`). `Backlog.md:477` — fila `DIST-02` 🆕 Pendiente, dep `DIST-01` (✅ Completada).
- Nota numeración: `docs/review/backlog-hermes.md` usa `HERM-16` para packaging/asarUnpack (✅ Completada) y `HERM-15` para health-check; la compuerta canónica para `DIST-02` es la tabla de extracción (`Backlog.md:469`, `HERM-15` = exclusión ASAR). Sin conflicto de fondo: ambas lecturas confirman asarUnpack implementado.

### Impacto mapeado (Regla 0)
- Archivos leídos completos: los 5 de arriba + `apps/desktop/package.json` + root `package.json` (script `build` = renderer + desktop).
- Referencias hacia dentro: `verify-dist.cjs` → `require('../electron-builder.config.cjs')`; `build` → `tsc && verify-dist`.
- Referencias entrantes: `DIST-10` depende de `DIST-02` (smoke headless futuro, fuera de alcance).
- Veredicto: cambio neto probable = CERO ediciones (config + gate ya existen). Solo verificación mecánica + actualización Backlog.

### Gate D (Zero Silent Assumptions)
Decisiones no declaradas: ninguna material. Tarea solo-config; si `pnpm build` falla por causa ajena (red, toolchain) → BLOQUEO con evidencia, no fix colateral (regla FIX_PROPUESTO del owner).

## Steps
1. ✅ Verificación mecánica: `pnpm build` → exit 0 con verify-dist 9/9 (incluye asar+asarUnpack).
2. ✅ Backlog `DIST-02` → ✅ con evidencia (gate pasó; SHA pendiente del lead).
3. ⬜ RESULTADO §7 (al cierre de esta invocación).

## EJECUCIÓN
(Se registra debajo al correr cada step.)

## Review
- Tier: Fast (solo docs/config tocados: `Backlog.md` celda Estado + taskfile nuevo; sin código `src/`, sin firmados, sin `.agents/**`).
- Verify mecánico: `pnpm build` exit 0; verify-dist 9/9 en verde. Veredicto: approve.

## Evidencia
- `pnpm build` (2026-10-13): renderer vite build ok (5997 módulos) + `tsc -p tsconfig.json` desktop ok + `verify-dist`:
  - `dist/src/main.js` (106537 bytes), `dist/src/preload.js` (7020 bytes), `renderer/dist/index.html` (1099 bytes)
  - `electron-builder.config.cjs` carga sin errores; `asar: true`; `asarUnpack` incluye `**/*.node` (+2 patrones extra); `files` dist/** + renderer/dist/**; buildResources `assets/` existe.
  - `TODOS LOS CHEQUEOS EN VERDE`, exit 0.
- Config: `apps/desktop/electron-builder.config.cjs:22-27`. Cita: `docs/operations/despliegue.md:15`. Gate: `Backlog.md:469` (HERM-15 extracción).
