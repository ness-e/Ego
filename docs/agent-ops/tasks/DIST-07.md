# DIST-07 — Docs usuario final (guía + BYOK + troubleshooting)

| Campo | Valor |
|---|---|
| Estado | ✅ Verificada 2026-10-13 (continuación `ego-docs`; commit/tag/push pendientes del lead) |
| Ruta | ego-docs (solo esta task) |
| Contrato | `docs/user/` con guía + BYOK + troubleshooting; refs verdes. Backlog `DIST-07` (`docs/roadmap/Backlog.md:482`) |
| SDP | `documentation-and-adrs`, `writing-guidelines` (solo checklist). Resto base-only — docs puros sin código ni deps |
| Plan | `docs/agent-ops/plans/2026-10-13-plan-deuda-residual.md` §Task 12 |

## DISCOVERY (zero-code planning)

### Archivos leídos (completos)

- `README.md` — comandos (`pnpm install --frozen-lockfile`, `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm dev`), stack, jerarquía canónica.
- `docs/product/ux-ui.md` — Chat + Canvas, Estado Dinámico (5 preguntas), Activity Widget (reposo/trabajo/HITL), explicabilidad contextual 3 niveles, presencia Sub-Egos (no implica pantalla), atajos conceptuales.
- `docs/product/guia-mvp.md` — Golden Path 6 pasos (BYOK → proyecto → tarea NL → HITL → Canvas → multi-día), alcance MVP, DoD.
- `docs/architecture/navigation-sidebar.md` — Rail 54px / Sidebar 260px, bloques (Proyectos, Sub-Egos, Sesiones, Artifacts, MCP, Configuración), atajos `Ctrl+B`/`Ctrl+N`/`Ctrl+K`/`Ctrl+,`, mapeo IPC (`ipc.memory`, `ipc.subegos.*`, `ipc.settings.getModelConfig` vía Model Config).
- `docs/agent-ops/tasks/DIST-05.md` — patrón taskfile (Regla 0 + Gate D + Spec + verify mecánico, sin commit propio).
- `apps/desktop/src/ipc.ts` — contrato 50 invoke + 7 push; Settings = `ipc.settings.getModelConfig` / `ipc.settings.saveModelConfig` (l.37-39); push `ipc.event`, `ipc.approval.request`, `ipc.chat.error`.
- `apps/desktop/src/main.ts` §Settings (l.2016-2189+) — `ModelConfigSchema` zod, getter enmascarado (`toMaskedModelConfigResponse`), saver cifra por proveedor (`<p>KeyEncrypted` vía `encryptCredential`/safeStorage), migración plano→cifrado, máscara nunca persistida.
- `apps/desktop/src/updater.ts` — feed `{version, url?, notes?}`, `EGO_UPDATE_FEED_URL`, idle sin feed, `downloadUpdate()` stub `deferred` (DIST-04), 30s diferido + 6h, solo packaged.
- `apps/desktop/renderer/components/sidebar.tsx` — `isSettingsOpen`, tabs `models|memory|gov`, `activeProvider` enum (`openai|anthropic|google|deepseek|ollama|mock`), `Ctrl+B`/`Ctrl+N` por keydown (l.237-247), búsqueda `Ctrl+K` placeholder, gear abre Settings (l.380/598).
- `apps/desktop/package.json` — scripts `build`, `build:main`, `dist` (electron-builder), `dev` (`electron .`), `typecheck`, `test` (vitest), `pretest` ensure-fresh-dist.
- `.agents/references/definition-of-done.md`, `pipeline-full.md` (leídos).

### Impacto mapeado (Regla 0)

- Archivos leídos completos: los de arriba. Ningún `src/` modificado.
- Referencias hacia dentro: `docs/user/*.md` → solo enlaces relativos entre sí + una referencia a `../product/`, `../architecture/` (existentes); ninguna cita de código con línea que pueda pudrirse (se citan canales IPC y vars de entorno por nombre, estables por contrato).
- Referencias entrantes: ninguna (directorio nuevo; Backlog `DIST-07` apunta a `docs/user/` como ruta, se satisface al existir).
- Veredicto: creación acotada a 5 archivos nuevos en `docs/user/` + este taskfile. CERO `src/`, CERO `.agents/**`, CERO deps, CERO features inventadas (todo lo afirmado tiene fuente en código leído; lo no verificado en código —p.ej. instaladores NSIS/DMG/AppImage— viene de DIST-03 ✅ en el plan).

### Gate D (Zero Silent Assumptions)

Sin canal interactivo al owner; se aplica la recomendada y se registra:

1. **Sin capturas ni rutas de instalador** (URLs/artefactos de release no existen aún sin DIST-04 firmado) (Recomendado ✅ aplicado) vs documentar descargas ficticias (invento, descartado).
2. **`Ctrl+,` como documentado-en-spec**, botón ⚙️ como vía verificada en código (Recomendado ✅ aplicado) vs afirmar handler de `Ctrl+,` no verificado en `sidebar.tsx` (descartado — el keydown solo cubre B/N).
3. **Aviso de update = manual** (descargar instalador y reinstalar; `downloadUpdate()` retorna `deferred`) (Recomendado ✅ aplicado) vs prometer auto-instalación (falso hasta DIST-04, descartado).
4. **Español** para docs de usuario (Recomendado ✅ aplicado — repo y producto en español) vs inglés (inconsistente con `guia-mvp`/`ux-ui`, descartado).

### Spec (decisiones por evidencia)

| # | Decisión | Evidencia / fundamento |
|---|---|---|
| S1 | 5 archivos: `README` (índice) + `getting-started` + `configuration` (BYOK) + `concepts` + `troubleshooting` | Contrato plan §Task 12: "guía + BYOK + troubleshooting"; conceptos exigidos por Backlog ("conceptos clave") |
| S2 | BYOK documenta cifrado safeStorage + máscaras + migración plano→cifrado + precedencia UI>env | `main.ts:283-287` (safeStorage), `:2027-2039` (máscaras), `:2054-2074` (migración), `sidebar.tsx:127-156` (máscara conserva secreto) |
| S3 | Atajos afirmados solo si verificados en código: `Ctrl+B`/`Ctrl+N` (keydown l.237-247), `Ctrl+K` (placeholder l.439), `Enter`/`Esc` HITL (`ux-ui.md:56`) | Grep + lectura directa; `Ctrl+,` marcado como spec (`navigation-sidebar.md:72`) con botón como vía primaria |
| S4 | Sin URLs externas ni comandos no verificados | INV-INTERNET prohibida; instaladores citados por formato (DIST-03 ✅) sin links |
| S5 | Lenguaje atemporal, sin historial de cambios en los docs | `documentation-and-adrs`: docs describen estado actual, no el cambio |

## Steps

1. ✅ Crear `docs/user/README.md` (índice + convenciones).
2. ✅ Crear `docs/user/getting-started.md` (7 pasos Golden-Path resumido).
3. ✅ Crear `docs/user/configuration.md` (BYOK: proveedores, cifrado, env, updates).
4. ✅ Crear `docs/user/concepts.md` (Chat/Canvas/Sub-Egos/proyectos/HITL/datos).
5. ✅ Crear `docs/user/troubleshooting.md` (7 síntomas con causa→acción).
6. ✅ Verify: `check-agents-refs.ps1` + grep manual de enlaces + Backlog `DIST-07` → ✅ con evidencia + RESULTADO §7 (plan file lo sincroniza el lead).

## EJECUCIÓN

- Steps 1-5: 5 archivos creados (~250 líneas totales). Toda afirmación técnica trazada a fuente leída (ver Spec S2/S3). Sin features inventadas. ✅
- Step 6: verify mecánico (ver §Evidencia). ✅

## FIX_PROPUESTO

Ninguno (docs puros; lo fuera de alcance quedó documentado como estado —update manual hasta DIST-04—, no como fix de diseño).

## Review

- Tier: Fast (solo `docs/user/**` + taskfile; sin código, sin IPC, sin `.agents/**`, sin deps).
- Verify mecánico: `check-agents-refs.ps1` OK + 0 enlaces rotos en `docs/user/` (grep manual) + 0 afirmaciones sin fuente. Veredicto: PASS.

## Evidencia

- `pwsh .agents/dev-tools/check-agents-refs.ps1` → `check-agents-refs: OK (13 refs)` (el script cubre `AGENTS.md`; `docs/user/` no introduce refs en `AGENTS.md`, y el grep manual de `](…)` en `docs/user/` —8 enlaces, todos a `./getting-started.md`, `./configuration.md`, `./concepts.md`, `./troubleshooting.md` existentes— resuelve el 100%).
- `git status --short` → solo `docs/user/*.md` (5 nuevos) + este taskfile; CERO `src/`, CERO `.agents/**`.

## BLOQUEO

Ninguno.

## Rollback

`git revert` del commit del lead (archivos nuevos aislados en `docs/user/` + este taskfile). Sin migraciones ni datos.
