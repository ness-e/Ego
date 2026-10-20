# Plan A6 — Subsistema avatar: licencia, tests, docs y sincronización

**Agente:** A6 (sesión `ses_ea9e4f319ffenXL18zb58t6rLF`) · **Persona:** `.opencode/agents/ego-worker.md`
**Zona exclusiva:** `packages/avatar/**`, `apps/desktop/renderer/floating/vendor/avatar/**`, `docs/product/mascota.md`, `docs/product/character-art-direction.md`, `docs/architecture/character-system.md`, `docs/research/character-audit-and-coucou-inventory.md`
**Prohibido:** resto de `packages/**`, resto de `apps/desktop/**`, resto de `docs/**`, `tests/gui/**`

## Decisión del owner (2026-10-19)

**Mantener las TRES copias por ahora** (upstream `repos-referencia/avatar`, paquete `packages/avatar`, vendorizada `apps/desktop/renderer/floating/vendor/avatar/`). **NO consolidas** en esta ola. Lo que sí se cierra: **licencia, tests, docs y un mecanismo de sincronización verificable** que impida que las tres diverjan en silencio.

## Estado verificado

- Upstream: MIT, 137 ficheros, `src/` = 44 `.js` (9 964 LOC), `tests/` = 29 ficheros (265 tests), `vendor/agent-robot-avatar/` = 30 ficheros, `captures/` = 23 PNG, `demo/robot-studio/` = 3, `LICENSE`, `LICENSE.md` (tabla de atribuciones **obligatoria**), `RESEARCH.md`, `DESIGN.md`, `README.md` (205 líneas).
- `packages/avatar`: 44 `.js` + 2 `.d.ts` generados, `DESIGN.md`, `README.md`, `index.d.ts`, `package.json`. **Faltan** `tests/`, `vendor/`, `RESEARCH.md`, `LICENSE`, `LICENSE.md`, `demo/`, `captures/`.
- `packages/avatar/src` vs `apps/desktop/renderer/floating/vendor/avatar/`: **byte-idénticos** (44/44, 0 diff). Es la copia que **efectivamente se ejecuta**.
- vs upstream: **38 idénticos / 6 bifurcados** (Ego va por delante: fix hsl→hex, `preset` en `observedAttributes`, `toSVGString()`, `setPointerFollow()`, preset `ego-nucleus`, DPR, `applyGenomeToStudio`).
- `packages/avatar/package.json`: `typecheck: node -e "process.exit(0)"` (**no-op**), `build` emite un stub de 33 B (`export * from '../src/index.js'`), sin script `test`, sin `files`/`description`/`license`/`keywords`.
- Motor sano: `node --test repos-referencia/avatar/tests/` → **265 pass / 0 fail** (3.74 s). En Ego: **0 tests**.
- `packages/avatar` es **huérfano**: 0 imports de `@ego/avatar` en todo el repo; `pnpm-lock.yaml` lo lista con `{}`; fuera del grafo de chunks de Vite.

## Tareas

### T1 — Licencia MIT: cerrar el incumplimiento (`EGO-FIND-24`) — **CRÍTICO / BLOQUEA DISTRIBUCIÓN**
Ni `packages/avatar/` ni `apps/desktop/renderer/floating/vendor/avatar/` incluyen `LICENSE` ni `LICENSE.md`, pese a que **7 ficheros de fuente remiten a `LICENSE.md`** y `src/render/ara-head.js:2-3` es declarado *"COPIA LITERAL … MIT © CX ArtLab - ver LICENSE.md"* de `agent-robot-avatar/core.js:261`.
- **Copia `LICENSE` (MIT) y `LICENSE.md` (tabla de atribuciones) del upstream a AMBAS copias de Ego.**
- Añade un `NOTICE` con las atribuciones de terceros (coucou / Louis Raillart / CX ArtLab).
- **Verificable**: `grep -rn "LICENSE.md" packages/avatar/src apps/desktop/renderer/floating/vendor/avatar` → toda referencia resuelve a un fichero existente; el `LICENSE` está en ambas raíces.

### T2 — Tests: portar los 265 al paquete (`EGO-FIND-67`)
- **Porta `tests/`** (29 ficheros) del upstream a `packages/avatar/tests/` y añade `"test": "node --test tests/"` al `package.json`.
- Verifica que pasan: `node --test packages/avatar/tests/` → **265/265**.
- Si el upstream tiene tests que fallan contra los **6 ficheros bifurcados** de Ego (fix hsl→hex, `toSVGString`, `setPointerFollow`, preset `ego-nucleus`…), **corrige el test para el comportamiento de Ego** y documenta la divergencia en `DESIGN.md` (no elimines el test).
- **Handoff a A7**: `packages/avatar` debe entrar en `pnpm -r test` (A7 escribe el `pnpm-workspace.yaml`/scripts; tú solo el `package.json` de tu zona).

### T3 — `build` y `typecheck` reales (`EGO-FIND-67` parcial)
- `build` actual emite un stub de 33 B. **Opción recomendada**: bundle ESM real con `esbuild`/`rollup` hacia `dist/`, o `tsc --allowJs --declaration --emitDeclarationOnly` para tipos reales. **Dependencia nueva → hándalo a A7; no ejecutes `pnpm install`.** Si no puedes añadir bundler, usa `node --experimental-strip-types`? No: **el paquete es JS plano** → la alternativa sin dependencias es copiar `src/` a `dist/` con un script Node (fiel y sin toolchain).
- `typecheck` es un no-op. **Opción sin dependencias**: `tsc --noEmit --allowJs --checkJs` con un `tsconfig.json` propio en el paquete (JavaScript plano con `checkJs`). Si el tipado estricto completo es inviable en JS, documenta la excepción en `AGENTS.md` (no es tu zona → hándalo a A1) y deja el `typecheck` realChecking al menos los errores de sintaxis/imports con `node --check`.
- **Borra `dist/`** del árbol versionado (no está trackeado: verificado) y añade el `ignore` correspondiente.

### T4 — Script de sincronización verificable (`EGO-FIND-25`)
El riesgo real de mantener 3 copias es la **divergencia silenciosa** (47 ficheros duplicados sin sync).
- Crea un script (en `packages/avatar/scripts/`, tu zona) que **verifique por SHA-256** que `packages/avatar/src` ≡ `apps/desktop/renderer/floating/vendor/avatar/` y que reporte las diferencias frente al upstream. Debe **fallar con exit ≠ 0** si hay drift.
- Conecta el script al `package.json` del paquete (`"sync:check"`) y **hándalo a A7** para que lo ejecute en CI como gate (A7 es dueño de `.github/workflows`).
- Documenta en `packages/avatar/README.md` el modelo de 3 copias y por qué existe (decisión del owner 2026-10-19).

### T5 — Sustituir los puertos verbatim de Mochi por geometría propia (`EGO-FIND-70`) — **DECIDIDO**
`packages/avatar/src/studio/render/{body,ears,eyes,mouth,accessories}.js` dicen *"Puerto verbatim de avatar_studio_cx_artlab_mochi_2_0.html"* y `avatar-element.js:2052` conserva el preset `'coucou-mochi'`. Contradice `AGENTS.md` §2 ("no copiar código directamente — extraer patterns y adaptar") y la decisión de producto *"ningún nombre, dibujo, sonido ni icono de Mochi entra al producto"*.
**Decisión del owner (D4): sustituir por geometría propia.** No es opcional ni queda en el limbo.
- Reescribe los **6 ficheros** (`body`, `ears`, `eyes`, `mouth`, `accessories`, `helpers` si porta código de Mochi) con **geometría propia** que mantenga el comportamiento visual. Adapta los *patrones* (no copies las coordenadas literales del HTML original).
- **Elimina** el preset `'coucou-mochi'` de `avatar-element.js:2052` y cualquier otra referencia a Mochi en el código.
- **Normaliza las cabeceras** de atribución al formato canónico `Adapted from <upstream> (MIT), <ruta>` (hoy `grep "Louis-CFM"` en `packages/`+`apps/` → **0**).
- **Validación visual obligatoria**: captura antes/después (skill `vision-skills` o script de `scripts/`) para comprobar que **no hay regresión**. Si un fichero no se puede sustituir sin regresión → **hándalo con el diff propuesto y la captura**, no lo abandones en silencio.
- El **inventario de puertos** está en `docs/research/character-audit-and-coucou-inventory.md` (tu zona) → actualízalo con el estado real tras la sustitución.

### T6 — Docs canónicos del personaje (`EGO-FIND-68`, `EGO-FIND-69`)
`docs/product/mascota.md:10` afirma *"El personaje **NO es un avatar**"* y sitúa el código en `apps/desktop/renderer/components/character/`. `docs/architecture/character-system.md:2,15` describe el motor **legacy** (`CharacterEngine`) y dice *"motor real (~2000 líneas) pero 0 tests dedicados"* — son 998 líneas y hay 2 ficheros de test. `docs/product/character-art-direction.md:8` igual. **0 menciones de `ego-avatar`** en los 3 docs.
- **Reescribe los 3 docs contra el motor real**: `@ego/avatar`, Web Component `<ego-avatar>`, **14 estados runtime + 11 emotes** (`states.js`), **22 estados studio** (`studio/config.js`), puente `EGO_TO_STUDIO_STATE` / `STUDIO_TO_EGO_STATE` (`studio/adapter.js:19,123`), vocabulario `delta-core` / `squircle-core` como **legacy**.
- **Documenta el doble motor**: `@ego/avatar` (vigente) vs `components/character/core/CharacterEngine.ts` (legacy). Deja constancia de que la **decisión de consolidación está pendiente del owner** (mantener 3 copias, 2026-10-19).
- `docs/research/character-audit-and-coucou-inventory.md` — actualiza el inventario de ports (6 bifurcados, 38 idénticos, 265 tests).

### T7 — Componentes legacy y FSM (`EGO-FIND-69`)
- `apps/desktop/renderer/components/character/CharacterCanvas.tsx` y `CharacterMiniBadge.tsx` están **definidos y nunca renderizados** (0 usos JSX) → están en zona de A4: **hándalo a A4** para que decida archivar o eliminar. Tu parte: documentar en `character-system.md` que son legacy sin consumidores.
- `components/character/state/CharacterStateMachine.ts:203` — la FSM de 14 estados **nunca se instancia** (solo se importa su *tipo*); el estado real lo computa un `useMemo` en `ego-chat.tsx:773` → **hándalo a A4**.

### T8 — README y `DESIGN.md` del paquete (`A6-11`, `A6-12`)
- `packages/avatar/README.md` (byte-idéntico al upstream) tiene **6 enlaces relativos rotos**: `RESEARCH.md`, `LICENSE.md`, `vendor/`, `demo/`, `captures/`, `tests/` → **porta los ficheros** (o reescribe el árbol del README).
- Inconsistencia interna: L149 dice "248 tests", L197 dice "265 tests" → unifica a 265.
- `DESIGN.md` (byte-idéntico al upstream, 7.4 KB) **no refleja el fork de 6 ficheros** → actualiza con el estado real (preset `ego-nucleus`, eye styles sin `mochi-sphere`, `preset` como atributo observado, `toSVGString()`).
- `packages/avatar/README.md` y `DESIGN.md` **son tuyos**; el `README.md` del upstream también (documenta que es un fork de 6 ficheros).
- `src/runtime/avatar-element.js` = **2 360 líneas / 85 KB** (monolito: FSM + política + sonido + render SVG + host de studio + `toSVGString`). Extrae el host de studio y el export SVG a módulos propios, con tests verdes.

### T9 — Congelar el upstream
`repos-referencia/avatar` tiene **working tree sucio** (19 ficheros, +449/−3482) y HEAD `c942a54` ("antes de limpieza") desfasado. La copia de Ego refleja el working tree, no el commit.
- Documenta en `packages/avatar/README.md` que es descendiente **forked** de ese working tree, con el diff de los 6 ficheros.
- **No commitees ni modifiques `repos-referencia/`** (es material de referencia). Si crees que hay riesgo de pérdida, anótalo en el handoff.

## DoD específico

- `node --test packages/avatar/tests/` → **265 pass / 0 fail**.
- 0 referencias a `LICENSE.md` sin fichero correspondiente.
- `pnpm --filter @ego/avatar typecheck` → **exit 0 real** (no un no-op).
- El script de sincronización **falla con exit ≠ 0** si alguien modifica uno de los duplicados sin el otro (demuéstralo: modifica, comprueba que falla, revierte).
- Los 3 docs del personaje citan `@ego/avatar` y marcan el motor legacy como tal.
- 0 `TODO`/`FIXME` reales en `packages/avatar/src` (hoy 0 — no lo rompas).

## Handoff

`docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A6.md`
Incluye: (a) deps necesarias para build/typecheck (para A7), (b) la integración del script de sync en CI (para A7), (c) la decisión pendiente de Mochi para el owner, (d) los archivos legacy a archivar (para A4).
