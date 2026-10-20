# Plan A7 — Calidad, CI/CD, seguridad de dependencias y deuda técnica

**Agente:** A7 (sesión `ses_ea9e4f317ffeg0NR20fx0xU9DY`) · **Persona:** `.opencode/agents/ego-harness.md`
**Zona exclusiva:** `.github/workflows/**`, `.github/dependabot.yml`, `package.json` (raíz), `.oxlintrc.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tests/gui/**`, `tests/e2e/**`, `scripts/**`, `.husky/**`, `.markdownlint.json`
**Prohibido:** `packages/*/src/**`, `apps/desktop/src/**`, `apps/desktop/renderer/**`, `docs/**` (salvo `docs/dev/e2e-skip-inventory.md` → hándalo a A1)

## Objetivo

**Restablecer la capacidad de decidir.** Hoy CI nunca se ejecuta, `pnpm test` está en rojo, hay 64 advisories de seguridad y la suite E2E vive fuera del workspace. Sin esto, nada de lo que hagan los demás agentes es verificable.

## Tareas

### T1 — CI inerte: la rama no existe (`EGO-FIND-18`) — **CRÍTICO / BLOQUEA TODO**
**Verificado por el orquestador**: `git branch -r` → solo `origin/master`; `git rev-parse --abbrev-ref HEAD` → `master`.
- `.github/workflows/ci.yml:5` (`push: branches: [main]`) y `:7` (`pull_request: branches: [main]`) → **el job `verify` (lint + typecheck + test + build) no se ejecuta jamás en push**.
- `.github/workflows/release-please.yml:7` → idéntico.
- `.github/workflows/smoke-native.yml` → `pull_request: branches: [main]` + `paths:`.
- **Solución**: `branches: ['main', 'master']` en **los 6 workflows**. Verifica después que **cada workflow** tiene un trigger que efectivamente puede dispararse en `master`.
- **Verificable**: `grep -rn "branches:" .github/workflows/` → ninguna rama que no exista en el remoto.

### T2 — `pnpm test` en rojo (`EGO-FIND-19`) — **CRÍTICO**
`tests/e2e/floating-minimize.test.ts:281,296` — 2 asserts que inspeccionan texto de fuente obsoleto:
- `expect(mainSrc).toContain("shouldAutoShow(floatingSnapshot())")` → la función **existe** (`main.ts:511`) pero el call site cambió (`main.ts:3469` usa `const snap = floatingSnapshot()` + `updateState({attentionState:"hidden"})` + `hide()`).
- `expect(html).toContain('id="ticker"')` → `floating.html` ya solo tiene `id="floating-root"`; los ids `ticker`/`approval-card`/`countdown` viven ahora en los componentes React.
- **Reescribe los asserts para el comportamiento actual** (no por texto de fuente): verifica que `floating.html` monta `floating-root`, que el código de React define los ids esperados, y que el wiring `minimize → autoshow → track` existe con los nombres actuales. Si un comportamiento se perdió en `d50a050`, **repáralo** (no rebajes el assert).
- **Verificable**: `pnpm test` → exit 0.

### T3 — 64 advisories de seguridad (`EGO-FIND-23`) — **CRÍTICO**
`pnpm audit --json` → 4 críticos + 24 altos: `tinypool` ×2 (RCE por prototype pollution), `node-tar` (DoS + 7 traversal), `vitest` UI (ejecución arbitraria), **`electron` 33.4.11 EOL con 25+ CVE**, `vite` (bypass de `fs.deny`), `electron-updater` (fuga de credenciales), `extract-zip` ×2.
**Decisión del owner (D1): subir TODO (Electron + transitivas), sin esperar verificación del binding en CI.**
- Actualiza a las ramas soportadas: `electron` (estable actual), `tinypool`, `node-tar`, `vite`, `vitest`, `electron-updater`, `extract-zip`. **No** apliques `pnpm.overrides` para congelar Electron.
- **Mitigación obligatoria — verificación LOCAL contra el binding real.** El binding napi-rs real existe en esta máquina en `C:\Users\Eros\VantaDB Proyect\VantaDB\vantadb-node`. Ejecuta el smoke real:
  `apps/desktop/scripts/smoke-native-packaged.cjs` (carga del `.node` con `ELECTRON_RUN_AS_NODE` + `connect()` sobre disco + roundtrip put/get) **contra el binding real en local**, y reporta el resultado del ABI (`NODE_MODULE_VERSION`).
  - Si el smoke local **falla** → **revierte el upgrade de Electron** (vuelve a la última versión compatible verificada) y repórtalo como bloqueo.
  - Si el smoke local **pasa** → el upgrade es seguro en local; **déjalo registrado como pendiente de verificación en CI** (Ola 2, ligado a `DIST-09`, que sigue bloqueado por el path `file:`).
- **Añade `pnpm audit --json` como job bloqueante** en CI.
- `node_modules` es tuyo: **tú eres el único que puede ejecutar `pnpm install`**. Ejecuta las instalaciones **una vez**, de forma agrupada, no repetidamente.

### T4 — `tests/gui` fuera del workspace (`EGO-FIND-62`) — **ALTA**
`pnpm-workspace.yaml:1-4` lista `apps/**`, `packages/**`, `tests` — **`tests/gui` no es miembro** → `pnpm -r test` nunca corre la suite Playwright (16 specs). El `package.json` de `tests/gui` dice literalmente *"standalone, fuera del workspace pnpm: no corre en `pnpm -r test`"*.
- Añade `tests/gui` al workspace (o `tests/**` con exclusión de `tests/gui/node_modules`).
- Ejecuta la suite en el job `verify` con `xvfb-run` (el harness Electron real ya existe: `tests/gui/electron/*.electron.ts`).
- **Reactivar los 12 `describe.skip("requiere backend Electron vivo")`** de `tests/gui/specs/02..13` si el backend Electron puede levantarse en CI. Si alguno **no** puede, clasifícalo con la taxonomía de `docs/dev/e2e-skip-inventory.md` (Clase A–D) y deja la justificación.
- Actualiza `docs/dev/e2e-skip-inventory.md` — **no es tu zona** → hándalo a A1.

### T5 — Endurecer el lint (`EGO-FIND-65`) — **ALTA**
- `.oxlintrc.json:3-11` activa solo **7 reglas `deny`** de corrección. No hay `no-explicit-any`, `no-empty`, `no-console`.
- `package.json:19` — `oxlint --ignore-path .gitignore apps packages tests`: **`scripts/` y `eval/` quedan fuera del lint** → añádelos.
- `pnpm lint` no usa `--max-warnings` → 136 warnings no bloquean.
- **Plan**: activa `no-explicit-any` como **warn** (no rompas el build de golpe), `no-empty` como warn, `no-console` con allow-list. Documenta el **baseline** actual (cuántos `any` hay) para que el endurecimiento sea medible.
- Elimina las **10 `eslint-disable-next-line` huérfanas** (referencian reglas de ESLint que oxlint no ejecuta → no suprimen nada).
- Los **12 `any` en producción** (5 en `ApprovalEngine.ts:393-422` → **ruta sensible de seguridad**, zona de A2): hándalo a A2 con la lista exacta.
- Los **18 `catch {}` vacíos** (13 en producción): hándalo a A2/A3/A4 según el fichero. Tu zona: los de `tests/` y `scripts/`.

### T6 — Permisos, pins de SHA y dependabot (`EGO-FIND-65` parcial)
- 5 de 6 workflows **sin bloque `permissions:`** → añade `permissions: {contents: read}` por defecto (solo `release-please.yml` necesita `contents: write`).
- **48 acciones `uses:` sin pin de SHA** (todas por tag mutable) → superficie de supply chain. Pínéalas a SHA (usa `zizmor`/`actionlint` para validar; si no hay SHA disponible offline, deja el TODO con la lista exacta).
- Crea `.github/dependabot.yml` (electron, vite, vitest, node-tar, tinypool, playwright).
- No hay `CODEOWNERS` → créalo (protege `.github/workflows/**`, `packages/security/**`, `packages/memory/**`).
- No hay `actionlint` → añádelo como step del job `verify`.

### T7 — `vantadb-node` por path `file:` (`EGO-FIND-64`) — **ALTA**
`apps/desktop/package.json:35` y `packages/memory/package.json:27` → `file:../../../VantaDB/vantadb-node`. CI crea un **stub no-op** (`put(){}` / `get(){return null}`) → el job `verify` verde **nunca ejercita VantaDB real**.
- Publica `vantadb-node` como tarball vendorizado (con hash en el lockfile) o documenta el pin a un SHA de release.
- **Los `package.json` de paquetes NO son tu zona** → hándalo a A2 (`packages/memory/package.json`) y A4 (`apps/desktop/package.json`). Tú preparas el **tarball/tarball+hash** y el diff del lockfile.
- Además, 3 workflows hacen checkout de `ness-e/Vantadb@develop` (**rama mutable**) → no reproducible. Pinea a un SHA/tag de release.
- **DIST-09 ya está abierto** en el Backlog por esto → no lo cierres tú (es de A1).

### T8 — Tests tautológicos por inspección de texto (`EGO-FIND-63`) — **ALTA**
25 ficheros de test (8 % del total) hacen `expect(mainSrc).toContain('win.on("minimize"')` — frágiles: un refactor rompe el test **sin cambio de comportamiento**. Fue exactamente la causa raíz de `EGO-FIND-19`.
- Convierte los de **tu zona** (`tests/e2e/**`, `tests/gui/**`) en asserts de **comportamiento** (DOM, eventos, estado), o aíslalos como *lint-tests* en una suite separada claramente etiquetada.
- **Inventaría** los 25 (ruta + técnica) y **hándalo a A4** los que están en `apps/desktop/`.
- **Heurística para decidir**: si el assert falla cuando el comportamiento es correcto → es tautológico → reescribir o marcar.

### T9 — I/O síncrono y deuda cuantificada (`EGO-FIND-66` parcial)
59 llamadas sync I/O en `packages/*/src` (53 en `recovery`, 12 en `tools`) y 7 ficheros de producción pendientes de `fs/promises` (`SkillScanner`, `SnapshotManager`, `SchemaMigrator`, `ProjectExport/Import`, `FileLockManager`, `PathValidator`, `DiagnosticsLogger`).
- **Tu zona**: ninguna de esas (son de A2/A3). Tu trabajo: **crear un script de detección de deuda** en `scripts/` (p. ej. `scripts/audit-debt.mjs`) que cuente y liste `any`, `catch {}`, sync I/O, `eslint-disable`, `transition-all`, hex hardcodeados, god files, skips — **para que la deuda sea medible en CI en el futuro**.
- Conecta el script a un job de CI **informativo** (no bloqueante hasta que haya baseline).
- `scripts/ensure-fresh-dist.cjs:37-41` no cubre `packages/avatar` (sin `src/` → `collectTsFiles` devuelve 0 → `stale:false`) y reconstruye en orden **alfabético**, no topológico → corrígelo (orden topológico + tratamiento de paquetes JS sin `src/`).
- `scripts/generate-checksums.cjs` genera `SHASUMS.txt` pero **no está cableado** en ningún script ni workflow → conéctalo al script `dist` de `@ego/desktop`.

### T10 — Observabilidad y correlación (`EGO-FIND-74`)
`packages/decision/src/Telemetry.ts:30` — `DecisionTelemetry` guarda **500 muestras en RAM** (se pierden al reiniciar, nunca se exportan). `packages/events/src/StructuredLogger.ts:35` — el logger estructurado escribe a **`console.log`** por defecto (nunca a disco). `grep correlationId` → **0**.
- **Tu zona**: `scripts/**` y `.github/**` — **no** puedes tocar `packages/` (A2). Tu parte: **crea el script de exportación** `scripts/export-telemetry.mjs` y el **sink de disco rotado** que A2 pueda inyectar, y el **hilo de `correlationId`** (patrón + helper) que A2 use en el EventBus.
- **Handoff a A2**: define la interfaz del sink y del helper de correlación.

### T11 — Rack de seguridad del harness (`EGO-FIND-64` parcial, `.opencode/**`)
- El repo tiene `.agents/agents/*.md` (19 personas) pero **OpenCode no las registraba** (no había clave `agent` en la config y no existía `.opencode/`). **Ya está arreglado**: se creó `.opencode/agents/` (18 agentes con frontmatter válido), `.opencode/command/` (13 comandos) y `opencode.json` con `permission.task`.
- **Verifica** que `.opencode/agents/*.md` tiene frontmatter válido (`description` + `mode` + `permission` con claves de OpenCode: `read`, `edit`, `glob`, `grep`, `list`, `bash`, `task`, `external_directory`, `webfetch`, `websearch`, `lsp`, `skill`, `question`).
- **El generador `.agents/dev-tools/sync-opencode-agents.ps1` es tuyo** (`.agents/dev-tools/`): mézclalo con `check-agents-refs.ps1` y conéctalo al job `verify` como gate de drift (`.opencode/` desincronizado con `.agents/` → fallo).
- **Bug ya corregido por ti**: `.agents/agents/ego-desktop.md` no tenía frontmatter y declaraba `name: ego-chaos` (colisión con `ego-chaos.md`) → frontmatter añadido con `name: ego-desktop`, descripción y permisos propios.

## DoD específico

- `pnpm typecheck` → exit 0. `pnpm test` → **exit 0** (hoy exit 1). `pnpm lint` → exit 0.
- `pnpm audit --json` → **0 críticos** (los altos quedan documentados con justificación si no hay fix sin romper Electron).
- Los 6 workflows tienen un trigger alcanzable en `master`.
- `tests/gui` es miembro del workspace y su suite corre.
- `.opencode/` sin drift respecto a `.agents/` (el script `-Check` devuelve exit 0).
- `scripts/audit-debt.mjs` corre y emite un informe JSON con la línea base de deuda.

## Handoff

`docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A7.md`
Incluye: (a) cambios de `package.json` de paquetes que necesitas (A2/A4), (b) el tarball de `vantadb-node` y el diff del lockfile, (c) la lista de `any`/`catch{}` por fichero para A2/A3/A4, (d) la interfaz del sink de telemetría para A2.
