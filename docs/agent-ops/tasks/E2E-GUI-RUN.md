# E2E-GUI-RUN — Ejecución real Playwright `tests/gui/specs/floating-island.spec.ts` contra dev-server (cierre S3 T-isla-11-e2e)

Estado: ✅ COMPLETO (ejecución real Playwright PASS 2/2; dev-server matado, puerto 5173 libre, sin huérfanos)
Plan: docs/agent-ops/plans/2026-10-15-isla-flotante-ego-completa.md (Task 11, S3 pendiente)
Origen: docs/agent-ops/tasks/T-isla-11-e2e.md S3 — spec Playwright real pendiente con dev-server
SDP: campaign-executor/progreso (base 0.5) + test-driven-development + systematic-debugging (pinned 1.0)
Skills cargadas: test-driven-development, systematic-debugging.

## Contrato
(a) Leer spec + `tests/gui/playwright.config.ts` (baseURL, sin webServer) + `tests/gui/package.json` (scripts).
(b) Levantar el dev-server que sirve `/floating/floating.html` (candidato: `electron-vite dev` en `apps/desktop`, renderer MPA con input floating declarado en `apps/desktop/electron.vite.config.ts:41-45`; fallback: `vite preview` de `out/renderer` con bundle prod existente `out/renderer/floating/floating.html` 1538 bytes verificado Task11).
(c) Correr solo ese spec con Playwright (`npx playwright test specs/floating-island.spec.ts --reporter=list` o script del repo) desde `tests/gui`.
(d) Si faltan browsers, UN intento `npx playwright install chromium` (timeout generoso; si falla por red/espacio → INCOMPLETO con evidencia, no insistir).
(e) Al terminar MATAR el dev-server (no dejar puertos ocupados a otras campañas).
Acceptance: spec PASS con N tests en verde, o INCOMPLETO documentado con evidencia exacta del bloqueo.

## Spec (Gate D — ejecución de tests: D no dispara salvo que haya que cambiar conducta; Spec = evidencia de corrida)
| # | Decisión | Evidencia / valor |
|---|----------|-------------------|
| E1 | Servidor = `electron-vite dev` (`pnpm --filter @ego/desktop dev`), puerto 5173 `127.0.0.1` strictPort | `electron.vite.config.ts:67-71` server host/port/strictPort; `playwright.config.ts:16` baseURL `http://127.0.0.1:5173`; misma config que `renderer/vite.config.ts:48-52`. Sin webServer auto-start en config → owner/server manual (este worker lo levanta y lo mata) |
| E2 | Fallback = `vite preview` de `out/renderer` en 5173 si `electron-vite dev` no sirve `/floating/floating.html` | Bundle prod verificado Task11: `out/renderer/floating/floating.html` 1538 bytes con script `../assets/floating-*.js` + mount points; solo cambio de origen del mismo contenido, no de conducta del spec |
| E3 | Comando = `npx playwright test specs/floating-island.spec.ts --reporter=list` desde `tests/gui` | `tests/gui/package.json:10` `test:gui = playwright test`; scope a 1 spec por contrato (DISJUNTO de sonda-Electron `electron/` y resto de `specs/`) |
| E4 | Fix mínimo del spec (1-3 líneas) permitido SOLO si un bug menor impide correr (selector/URL) con evidencia | Contrato §2; PROHIBIDOS: `apps/*`, `packages/*`, otros tests, `docs/roadmap` + review, `verify-audit.jsonl`, junk untracked, `tests/gui/electron/*` |
| E5 | Browsers: 0 installs esperados — `ms-playwright/` ya contiene `chromium-12xx` + headless shells | Verificado por listado de directorio antes de correr; 1 intento install solo si el runner lo exige |
| E6 | Sin preguntas: sin decisiones de producto; bloqueo → INCOMPLETO con evidencia (no FAILED) si causa externa (red/espacio/display) | Brief §8; Playwright headless por defecto debe funcionar sin display |

## Impacto mapeado (Regla 0)
- Archivos leídos completos: `tests/gui/specs/floating-island.spec.ts` (46L: 2 tests, mount points + CSP + a11y), `tests/gui/playwright.config.ts` (26L: testDir `./specs`, baseURL 127.0.0.1:5173, sin webServer, 1 worker chromium), `tests/gui/electron.playwright.config.ts` (31L: suite separada `./electron`, NO tocada), `tests/gui/package.json` (scripts `test:gui`/`test:e2e:electron`), `tests/gui/fixtures/base.ts` (40L: `test`/`expect` re-export, `DEV_URL`), `apps/desktop/electron.vite.config.ts:41-45` (input MPA index+floating) + `:67-71` (server 5173), `apps/desktop/package.json` (`dev = electron-vite dev`), `apps/desktop/renderer/floating/floating.html` (37L fuente: mount points `#floating-root/#ticker/#approval-card/#countdown` + CSP + título), `apps/desktop/out/renderer/floating/floating.html` (bundle prod con assets).
- Referencias hacia dentro (lo que toco usa): `/floating/floating.html` mounts (`#floating-root/#ticker/#approval-card/#countdown`), título `Isla Flotante`, CSP `default-src 'self'`, `#status-pill` + botón sonido `aria-pressed` + foco visible.
- Referencias entrantes (quién usa lo que toco): `scripts/check-gui-coverage.cjs` exige cadena T10 en `*.spec.ts` (gate mecánico); suite GUI recoge `specs/*.spec.ts`. No creo símbolos nuevos de producción.
- Veredicto: impacto NULO en producción (solo ejecución; 0 ediciones `src/` previstas). Riesgo: `electron-vite dev` lanza ventana Electron (sin display puede fallar el shell pero el servidor Vite debe sobrevivir; mitigación: fallback preview + kill garantizado al cierre).

## Steps
- [x] S1 DISCOVERY: spec + config + scripts + MPA + bundle leídos; Regla 0 + Spec; task file creado
- [x] S2 SERVER: `pnpm --filter @ego/desktop dev` (electron-vite dev, bg) → `GET /floating/floating.html` 200 (1680 bytes, con `@vite/client` + react-refresh = dev real)
- [x] S3 RUN: `npx playwright test specs/floating-island.spec.ts --reporter=list` → 2 passed (2.9s), 0 installs (browsers `chromium-12xx` pre-existentes); 0 fixes al spec (no hizo falta)
- [x] S4 CIERRE: dev-server matado (taskkill PID listener 5173 + Electron main ya muerto; bg shell exit 1) + puerto 5173 LIBRE verificado (`PORT-5173-FREE`) + 0 `electron.exe` huérfanos con path Ego; Review Fast approve; RESULTADO §7 + GATES + SKILLS (NO commit de código — solo este task file commitea el orquestador; NUNCA push)

## Verify log
- S2 server: `Invoke-WebRequest http://127.0.0.1:5173/floating/floating.html` → STATUS 200, 1680 bytes (dev con HMR, no preview; fallback no necesario).
- S3 run (tests/gui): `Running 2 tests using 1 worker` → `ok 1 ... floating.html monta raíz + ticker + approval + countdown con CSP (1.1s)` + `ok 2 ... a11y: píldora de estado + botón sonido con aria-pressed y foco visible (444ms)` → `2 passed (2.9s)`.
- S4 cleanup: `taskkill /PID 22708 /F` OK (listener 5173); Electron main PID 26320 ya inexistente (murió con el server); `netstat ... 5173 LISTENING` → vacío (`PORT-5173-FREE`); `Win32_Process electron.exe + *Ego*` → 0 resultados.
- Review Fast: 1 archivo creado (este task file), 0 ediciones producción/tests; ejecución read-only contra dev-server efímero → approve.
