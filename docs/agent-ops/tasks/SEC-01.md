# SEC-01 — Auditoría de Sandboxing y Context Isolation

| Campo | Valor |
|---|---|
| ID | SEC-01 |
| Plan | `docs/agent-ops/plans/2026-10-12-plan-backlog-10.md` Task 1 |
| Estado | COMPLETED (auditoría + 1 fix mínimo + test) |
| Worker | ego-audit (veredicto) + ego-desktop (fix mínimo) |
| Fecha | 2026-10-13 |

## Spec (contrato)

Auditoría PASS + `floor-guard.ps1` verde + 0 APIs Node/VantaDB en renderer.
Si hay hallazgo: fix mínimo + test. Sin commit, sin push.

## Impacto Regla 0

Aislamiento renderer↔main. Superficie: 2 `BrowserWindow` + preload + `window.ego` + CSP.
Sin lógica de negocio, sin cambios en `packages/**`, sin secretos tocados.

## Steps

- [x] DISCOVERY: leer `main.ts` (BrowserWindows), `preload.ts`, `FloatingWindowPrototype.ts`, `renderer/` (`require(`, `process.`, `window.ego`), `index.html` (CSP)
- [x] Compuertas Opción B: `docs/extractions/coucou.md` + `docs/review/backlog-coucou.md` (+ CARP-03/HERM-19) → veredictos abajo
- [x] Grep aislamiento en `apps/desktop/src` + `renderer/src`
- [x] Baseline: `floor-guard.ps1` verde + `typecheck` exit 0 (antes del fix)
- [x] Hallazgo único: sin meta CSP → fix mínimo + test TDD (RED en HEAD probado, GREEN con fix)
- [x] Suite SEC-01 (18/18) + typecheck + floor-guard en verde tras el fix

## Compuertas Opción B (veredictos)

- **Coucou §26 (secret handling) / §27 (typed bridge) / §33 (safe URL): ADAPTADA.** Ya implementadas en Ego: secretos solo en main vía `maskKey`/`encryptCredential`, puente tipado `window.ego` vía `contextBridge`, `ResourcePolicy` (COUC-13 ✅). SEC-01 verifica que se mantienen: PASS, sin código nuevo.
- **CARP-03 (path coverage, `backlog-career-ops.md`): ASIMILADA.** ✅ Completada en `PathValidator.ts`; es capa tools, complementa (defensa en profundidad) sin colisionar con aislamiento de ventanas. Sin acción en SEC-01.
- **HERM-19 (AST/skills linter, `backlog-hermes.md`): NO APLICA.** ✅ Completada; scope = validación de skills, no sandboxing de ventanas. Sin colisión, sin acción.
- Ninguna compuerta exige decisión de producto → sin BLOQUEO.

## Hallazgos

1. **FIND-SEC01-01 (único, FIXED): renderer sin CSP.** `renderer/index.html` no tenía meta
   `Content-Security-Policy`; `main.ts` tampoco inyecta CSP por sesión. Fix mínimo:
   meta CSP estricta (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`,
   con `style-src 'unsafe-inline'` + `connect ws:/wss:` para no romper HMR de Vite en dev).
2. **No-hallazgos (evidencia):** ambas ventanas con `sandbox:true` + `contextIsolation:true` +
   `nodeIntegration:false`; preload importa solo `electron` (`contextBridge`/`ipcRenderer`),
   0 `any` en código (solo mención en comentario); renderer sin `require(`/`process.`/
   imports `electron`/`node:`/`@ego/memory`/VantaDB (el `node:path` de `vite.config.ts` es
   build-time, no bundle); `window.ego` consumido tipado (`App.tsx:54`, `lib/ego.ts`,
   `window-ego.d.ts`); sin `window.open`/`shell`/`<a` en renderer; `electronAPI` en
   `ActivityTray.tsx:45` es código muerto defensivo (bridge inexistente, nunca se llama) —
   nota, no FAIL.

## Review (veredicto)

- Fix: `apps/desktop/renderer/index.html` (+7 líneas, solo meta CSP).
- Test: `apps/desktop/test/sandbox-isolation.test.ts` (5 tests, TDD: RED probado en HEAD
  con 0 matches CSP, GREEN con fix).
- `pnpm --filter @ego/desktop typecheck` → exit 0.
- `pwsh .agents/dev-tools/floor-guard.ps1` → verde (exit 0).
- Suite SEC-01: `sandbox-isolation` + `preload-bridge` + `FloatingWindow` + `ipc-contract` → 18/18.
- Suite completa desktop: 123/126 — 3 fallos PREEXISTENTES y ajenos (`decision-ipc`,
  `golden-path-alpha-full`, `mvp-software-loop`; reproducidos con mis cambios revertidos).
- Rollback: `git checkout HEAD -- apps/desktop/renderer/index.html` + borrar el test nuevo.
