# Handoff A7 — Ola 11 (cerrar las 4 abiertas de la zona de A7) — 2026-10-21

> **Agente:** A7 (calidad / CI-CD / seguridad de dependencias / deuda técnica).
> **Ola 11:** (T1) cablear las 3 puertas de atribución de paquete ·
> (T2) el detector de tests tautológicos que no ve · (T3) el último fichero
> tautológico de la zona · (T4) el smoke test del bundle real.
>
> **Continuación de** `A7-ola9.md`.

## 0. Resumen ejecutivo

| Hallazgo | Antes | Ahora |
|---|---|---|
| `EGO-FIND-82` · puertas de atribución de paquete en CI | **0 de 3** | **3 de 3** (las 4 puertas, avatar incluida, por el delegador) |
| `EGO-FIND-108` · detector que no ve | 1 fichero / **3** asserts | **39 ficheros / 152 asserts** detectados; **52 tautológicos** clasificados |
| `EGO-FIND-63` · tautológicos en la zona de A7 | 3 asserts (a ciegas) | **16 asserts** (los que el detector ciego no veía) → **0** |
| `EGO-FIND-122` · smoke test del bundle | no existía | **existe**, cableado en CI, fail-soft, con 6 tests |
| Puertas de A4 (`lint:source-contracts`) en CI | **en ningún pipeline** | **en el job `verify`** (bloqueante) |
| Pasos del job `verify` | 26 | **30** |

**Verificación: 21/21 puertas en exit 0** + `pnpm -r typecheck` (21/21 paquetes) ·
`pnpm --filter @ego/desktop test` (430 pass) · `pnpm --filter @ego/e2e-tests test`
(84 pass) · `pnpm lint` (0).

---

## 1. T1 — `EGO-FIND-82`: las 3 puertas de paquete, en CI

### 1.1 Qué hay ahora en `packages/**`

| Paquete | Puerta | Modo |
|---|---|---|
| `packages/avatar` | `scripts/check-attribution.mjs` (A6) | `--fix` / `--fix --apply` (propuesta / aplica) |
| `packages/tool-call-repair` | `scripts/check-attribution.mjs` (A2-bis) | **implementación genérica** del plano 1; `--check` (NUNCA escribe) |
| `packages/tools` | `scripts/check-attribution.mjs` (delegador al anterior) | `--check` |
| `packages/ui-runtime` | `scripts/check-attribution.mjs` (delegador al anterior) | `--check` |

Las tres de A2-bis **ya son CI-safe sin clones**: cuando `repos-referencia/<upstream>`
no está, la puerta **anota** (`nota: origen no comprobable (clon ausente: openclaw): …`)
y sigue verificando lo verificable (cabeceras canónicas, cobertura del manifiesto,
`LICENSE.md`, `NOTICE`) → **exit 0**.

**Verificado empíricamente** (copia de los 3 paquetes en un árbol **sin**
`repos-referencia/`):

```text
tool-call-repair   exit=0   nota: origen no comprobable (clon ausente: openclaw): packages/tool-call-repair/src/grammar.ts
tools              exit=0   nota: origen no comprobable (clon ausente: coucou): NotchBuddy/Sources/CoucouKit/DiffEngine.swift
ui-runtime         exit=0   nota: origen no comprobable (clon ausente: hermes-agent): apps/desktop/src/lib/ansi.ts
```

⇒ **No hace falta ningún modo degradado nuevo**: el suyo ya lo es.

### 1.2 El delegador (extendido, NO reimplementado)

`scripts/verify-attribution.mjs` (187 líneas) pasa de 1 puerta a **4**, con una
tabla:

```js
const PUERTAS = [
  { etiqueta: "avatar",           impl: join("packages","avatar","scripts","check-attribution.mjs"),           cwd: join("packages","avatar"),           modo: "fix"   },
  { etiqueta: "tool-call-repair", impl: join("packages","tool-call-repair","scripts","check-attribution.mjs"), cwd: join("packages","tool-call-repair"), modo: "check" },
  { etiqueta: "tools",            impl: join("packages","tools","scripts","check-attribution.mjs"),            cwd: join("packages","tools"),            modo: "check" },
  { etiqueta: "ui-runtime",       impl: join("packages","ui-runtime","scripts","check-attribution.mjs"),       cwd: join("packages","ui-runtime"),       modo: "check" },
];
```

Sigue siendo un **delegador**: no reimplementa nada, sólo reenvía y propaga el
código de salida ⇒ no puede desincronizarse.

- `--json` → informe machine de cada puerta.
- `--only <paquete>` → sólo esa puerta (diagnóstico).
- `--only <paquete> --root <dir>` → esa puerta contra otro árbol.
- `--fix` → en las 3 puertas de paquete se traduce a `--check` (su puerta NUNCA
  escribe) y se **avisa** por stdout.
- `--root` sin `--only` → **exit 2** (sería ambiguo).

### 1.3 Test del delegador

`scripts/test-verify-attribution.mjs` — **8/8**:

```text
✔ 1. sin argumentos → ejecuta las 4 puertas y sale 0
✔ 2. una puerta que falla → el delegador sale 1
✔ 3. `--only <paquete>` → ejecuta sólo esa puerta
✔ 4. `--only <paquete> --root <dir>` → esa puerta contra otro árbol
✔ 5. uso inválido → exit 2 (no 1)
✔ 6. `--json` → informe machine parseable
✔ 7. una implementación ausente → exit 2 (no un crash)
✔ 8. el árbol de pruebas temporal no se deja sucio
```

### 1.4 CI

`.github/workflows/ci.yml:235` (paso renombrado) y `:253` (test nuevo):

```yaml
      - name: "Atribución: motor de avatar + 3 paquetes (cabeceras canónicas)"
        run: node scripts/verify-attribution.mjs

      - name: Test del delegador de atribución
        run: node scripts/test-verify-attribution.mjs
```

### 1.5 `verify-ci-gates.mjs`: **no ha hecho falta tocarlo**

El gate **descubre** las puertas por patrón de nombre (`check-*`, `verify-*`,
`audit-*`) y resuelve la cableado leyendo los workflows + los scripts npm. Con
las 3 puertas nuevas las ve **solas**:

```text
✓ packages/avatar/scripts/check-attribution.mjs           in CI (delegador verify-attribution.mjs)
✓ packages/tool-call-repair/scripts/check-attribution.mjs in CI (delegador verify-attribution.mjs)
✓ packages/tools/scripts/check-attribution.mjs            in CI (delegador verify-attribution.mjs)
✓ packages/ui-runtime/scripts/check-attribution.mjs       in CI (delegador verify-attribution.mjs)
[verify-ci-gates] OK: toda puerta está cableada en CI o exenta con motivo.
```

**Inventario actual: 25 ejecutables verificadores** (antes 22), 0 sin cablear.

---

## 2. T2 — `EGO-FIND-108`: el detector que no ve

### 2.1 El fallo (medido)

El regex anterior exigía `readFileSync(` **en la misma línea**:

```js
/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:readFileSync|readFile)\s*\(/
```

Las 4 formas que se escapaban, **con ejemplos reales del repo**:

| Forma | Ejemplo real | ¿Se veía? |
|---|---|---|
| lectura directa | `const src = readFileSync(p, "utf8")` | sí |
| **`await`** | `const diskContent = await fs.readFile(writtenFilePath, "utf-8")` (`tests/e2e/mvp-software-loop.test.ts:273`) | **no** |
| **`fs.`** | `const estrategia = fs.readFileSync(ESTRATEGIA_MD, "utf-8")` (`tests/security/injection-boundaries.test.ts:558`) | **no** |
| **helper** | `const read = (p: string): string => readFileSync(p, "utf-8")` (`tests/e2e/floating-minimize.test.ts:83`) → `const cfg = read(join(repoRoot, "apps","desktop","electron.vite.config.ts"))` (`:392`) | **no** |
| lectura anidada / en template | `const mainSrc = mainProcessFiles(mainRoot).map((abs) => \`…${readFileSync(abs, "utf-8")}\`).join("\n")` | **no** |

### 2.2 La medición **antes / después**

| | ANTES (detector viejo) | DESPUÉS (detector nuevo) |
|---|---:|---:|
| Ficheros con asserts sobre texto de fuente | **1** | **39** |
| Asserts detectados | **3** | **152** |
| **Tautológicos** (texto del CÓDIGO BAJO PRUEBA) | 3 (por casualidad) | **52** |

Reparto de los 52 tautológicos: **A4 → 34**, **A7 → 18**.

> La cifra "antes" era **falsa por construcción**: el detector sólo veía 3 de
> 52. La cifra "después" es la que el instrumento **de verdad** mide.

### 2.3 Cómo se detecta ahora

`scripts/inventory-tautological-tests.mjs` (656 líneas) — 4 capas:

1. **Lecturas**: `readFileSync`/`readFile` con o sin `fs.`, `fsp.`, `nodeFs.`, con
   o sin `await`.
2. **Helpers**: una función local (`function f(){}` o `const f = () => …`) cuyo
   cuerpo **devuelve** el resultado de una lectura. Si la lectura se pasa a un
   parser y lo que se devuelve es un AST, **no** cuenta (evita el falso positivo
   real de `packages/avatar/tests/public-surface.test.js:30` → `readDeclaration()`).
3. **Variables de fuente**: `const|let|var X = <expr>` cuya expresión contiene
   una lectura. La expresión se recorre con un escáner que respeta cadenas,
   plantillas (`` `${…}` ``), anidamiento y **saltos de línea** (el caso real
   `const mainSrc = f(x)\n  .map(…)`).
4. **Asserts**: `expect(<arg>).<matcher>(` con matcher de valor y con `<arg>`
   que contiene una variable de fuente (o una lectura directa).

### 2.4 La clasificación (para que el número signifique algo)

Cada lectura se clasifica resolviendo la ruta **estáticamente**:

| Tipo | Significado | ¿Tautológico? |
|---|---|---|
| `codigo-repo` | el fichero es CÓDIGO del repo (resuelto por literales **o** por una variable de ruta del propio test, p.ej. `mainRoot`) | **sí** |
| `dato-repo` | fichero del repo que no es código (informe, `LICENSE.md`) | no (contrato de entrega) |
| `dinamica` | la ruta se calcula en ejecución → no decidible | no se cuenta (se informa) |

> **Por qué esta clasificación**: sin ella, el detector contaría como
> tautológicos los asserts sobre **artefactos que el propio test acaba de
> escribir** (un `api.ts` generado en un workspace temporal), que son
> legítimos. La definición operativa es: *se afirma sobre el texto del código
> bajo prueba*.

### 2.5 TDD

`scripts/test-inventory-tautological-tests.mjs` — **11/11**, con fixtures:

```text
✔ (a) lectura directa en la misma línea → detectada
✔ (b) lectura dentro de un HELPER local → detectada
✔ (c) lectura con `await` → detectada
✔ (d) `fs.readFileSync(...)` → detectada
✔ (e) lectura DENTRO del expect → detectada
✔ (f) lectura SIN assert → no detectada
✔ (g) valor de runtime (sin lectura) → no detectada
✔ (h) helper que devuelve un AST (no texto) → NO detectada
✔ (i) lectura de un ARTEFACTO de la corrida → no tautológica
✔ (j) lectura de un fichero de CÓDIGO del repo → tautológica
✔ (k) el repo real → el detector corre y sale 0
```

El detector acepta `--root <dir>` (lo usa el test con un fixture).

---

## 3. T3 — `EGO-FIND-63`: el último fichero tautológico

### 3.1 Lo que el detector ciego no veía

En `tests/e2e/contract/floating-wiring.contract.test.ts` había **16** asserts
sobre texto de fuente, no 3:

- **3** sobre `viewSrc` (el texto de `apps/desktop/src/windows/FloatingWindow.ts`)
  — los que la fila del Backlog señalaba.
- **13** sobre `mainSrc` (el corpus concatenado de `apps/desktop/src/**`) — los
  que el detector NO veía porque la lectura vive dentro de un `.map()` en una
  línea posterior a la declaración.

### 3.2 Resolución: 3 caminos, según se pueda o no

| Asserts | ¿Comportamiento posible? | Destino |
|---|---|---|
| **3** (superficie pública: `shouldAutoShow`, `syncFromAttention`, `FloatingWindowManager`) | **sí** | `tests/e2e/floating-window-surface.test.ts` (**nuevo**, 15 asserts de comportamiento) |
| **13** (wiring de `main.ts`) | **no** (`main.ts` es un entry con efectos de módulo: `app.on`, `BrowserWindow`, tray) | `apps/desktop/scripts/lint/source-contracts.lint.mjs` — **6 contratos de corpus** (ejecutable, exit 1, fuera del árbol de tests) |
| **2** (config de electron-vite, en `tests/e2e/floating-minimize.test.ts:392`) | **sí** | convertidos a comportamiento (importar el módulo y mirar el valor exportado) |

**Explicación (lo que pedía el encargo)**: un aserto de forma que vive en un
`*.test.*` **no lo cuenta el inventario** ⇒ el inventario vuelve a medir
comportamiento. El contrato sigue siendo **igual de estricto** (exit 1) pero
**deja de contaminar** el recuento. Ése es el mecanismo que creó A4 en la Ola 10
(`source-contracts.lint.mjs`) y que A7 ha completado.

### 3.3 El test de comportamiento (nuevo)

`tests/e2e/floating-window-surface.test.ts` — **15 asserts, todos de comportamiento**:

- `shouldAutoShow`: sin trabajo → `false`; con trabajo → `true`; con HITL →
  `true`; `muted` → `false`; `disabled` → `false`.
- `isPresenceAllowed`: por defecto → `true`; `disabled` → `false`;
  `presenceMode: never` → `false`; `always` → `true`; **el `muted` NO bloquea la
  presencia** (el deadlock de `EGO-FIND-104`).
- `syncFromAttention`: identidad en los 5 estados de la FSM; fallback `hidden`.
- `FloatingWindowManager`: estado inicial (`visible:false`, `muted:false`,
  `attentionState:"hidden"`); `updateState`/`setMuted` se reflejan; modo de
  opacidad `auto` por defecto.

Mock de `electron` por ruta relativa (patrón de `floating-minimize.test.ts:33`).

### 3.4 Los contratos de corpus, en el lint de A4

`apps/desktop/scripts/lint/source-contracts.lint.mjs` — pasa de 14 a **20**
contratos. Los 6 nuevos leen el **corpus** de `apps/desktop/src/**` (los `.ts`,
excluyendo `test/` y `__tests__/`), con un separador por fichero para que un
patrón no "cruce" de uno a otro:

1. el `minimize` está registrado y muestra la isla sin robar el foco;
2. el gate de autoshow consulta el estado real de la isla;
3. la presencia pasa por `isPresenceAllowed` (**y la forma `!st.muted` queda
   PROHIBIDA** — fue el deadlock completo);
4. el `minimize` registra el movimiento de la isla para persistirla;
5. el cambio de display/DPI reposiciona la isla;
6. restore/focus auto-oculta la isla cuando no hay trabajo pendiente.

### 3.5 ⚠️ `lint:source-contracts` **no estaba en NINGÚN pipeline**

Al extenderlo para alojar los 6 contratos de corpus se comprobó que **el lint
de A4 no estaba cableado en ningún workflow** → sus contratos no se verificaban
nunca. Además, su ruta de `PaneShell.tsx` estaba **desactualizada**
(`ui-kit/PaneShell.tsx`; el componente se movió a `components/PaneShell.tsx`) ⇒
la puerta fallaba con *"el fichero no existe"* sin que nadie lo notase.

**A7 lo ha arreglado y lo ha cableado** (`.github/workflows/ci.yml:167`):

```yaml
      - name: "Contratos de fuente (apps/desktop/scripts/lint)"
        run: pnpm --filter @ego/desktop lint:source-contracts
```

### 3.6 Fichero borrado

`tests/e2e/contract/floating-wiring.contract.test.ts` — **borrado** (su contenido
vive en 3.3 y 3.4). El directorio `tests/e2e/contract/` queda vacío (git no
rastrea directorios vacíos).

### 3.7 La medición final

```text
ANTES (T2 aplicado, T3 sin hacer):  52 tautológicos  →  A4: 34 · A7: 18
DESPUÉS (T3 aplicado):              34 tautológicos  →  A4: 34 · A7: 0
```

**La zona de A7 queda en 0** (los 18 → 16 del contrato + 2 del config).

---

## 4. T4 — `EGO-FIND-122`: el smoke test del bundle real

### 4.1 Qué comprueba

`scripts/verify-bundle-runtime.mjs` (351 líneas), sobre el bundle **real**
(`apps/desktop/out/main/main.js`):

| Check | Qué hace |
|---|---|
| `bundle` | que el bundle existe y es real (tamaño, nº de JS en `out/{main,preload}`) |
| `sin-toolchain` | que el bundle **no invoca** ningún toolchain del sistema: se buscan `spawn/spawnSync/exec/execSync/execFile/execFileSync` con 30 nombres (`node`, `python3`, `cargo`, `rustc`, `npm`, `npx`, `gcc`, `g++`, `dotnet`, `java`, `make`, `cmake`, `wsl`…) |
| `asar-unpack-config` | que `electron-builder.config.cjs` declara los **3** patrones: `**/*.node`, `**/node_modules/vantadb/**`, `**/node_modules/vantadb-node/**` |
| `asar-unpack-bundle` | (con app desempaquetada) que el binario `.node` de VantaDB está **fuera** del `.asar` y que no hay ningún `.node` dentro |
| `dlls` | (con app desempaquetada) que no falta ninguna DLL de runtime de la plataforma (`win32`: `vcruntime140.dll`, `vcruntime140_1.dll`, `msvcp140.dll`; `linux`: `libstdc++.so.6`, `libgcc_s.so.1`; `darwin`: `libc++.1.dylib`) |

### 4.2 Modo fail-soft (como pide el encargo)

- **Sin bundle** → todo se marca omitido con el motivo → **exit 0**.
- **Sin app desempaquetada** → `asar-unpack-bundle` y `dlls` se omiten **con el
  comando exacto** que las haría: `pnpm --filter @ego/desktop dist`.
- El informe dice explícitamente: *"las comprobaciones omitidas **NO** son un
  visto bueno"*.

Salida real en local (bundle presente, app no empaquetada):

```text
[verify-bundle-runtime] smoke test del bundle real de la app de escritorio
  ✓ bundle: bundle real encontrado: apps/desktop/out/main/main.js (280 KB, 2 fichero(s) JS en out/{main,preload})
  ✓ sin-toolchain: el bundle NO invoca ningún toolchain del sistema (30 nombres vigilados: node, python, cargo, rustc, npm…)
  ✓ asar-unpack-config: asarUnpack declara los 3 patrones: **/*.node | **/node_modules/vantadb/** | **/node_modules/vantadb-node/**
  – asar-unpack-bundle: no hay app desempaquetada (apps/desktop/release/**): … Se hace con: pnpm --filter @ego/desktop dist
  – dlls: no hay app desempaquetada: … (win32: vcruntime140.dll, vcruntime140_1.dll, msvcp140.dll). Se hace con: pnpm --filter @ego/desktop dist

[verify-bundle-runtime] 5 comprobación(es): 3 ok · 2 omitida(s) con motivo · 0 fallos.
```

### 4.3 TDD

`scripts/test-verify-bundle-runtime.mjs` — **6/6** (con fixtures y `--bundle` /
`--config`):

```text
✔ 1. SIN bundle → todo OMITIDO con motivo · exit 0 (fail-soft)
✔ 2. bundle que invoca un toolchain del sistema → FALLA · exit 1
✔ 3. bundle limpio → la comprobación de toolchain OK
✔ 4. config SIN los 3 patrones de asarUnpack → FALLA · exit 1
✔ 5. config con los 3 patrones → OK
✔ 6. el repo real → exit 0
```

### 4.4 CI

`.github/workflows/ci.yml:198` y `:213` (job `verify`, **después** del build):

```yaml
      - name: "Smoke test del bundle real (EGO-FIND-122)"
        run: node scripts/verify-bundle-runtime.mjs

      - name: Test del smoke test del bundle
        run: node scripts/test-verify-bundle-runtime.mjs
```

---

## 5. Ficheros tocados por A7 (Ola 11)

| Fichero | Cambio |
|---|---|
| `scripts/verify-attribution.mjs` | **reescrito**: 1 → 4 puertas (`--only`, `--root`, traducción `--fix`→`--check`) |
| `scripts/test-verify-attribution.mjs` | **nuevo** (8 casos) |
| `scripts/inventory-tautological-tests.mjs` | **reescrito**: helpers, `await`, `fs.`, anidado, multi-línea, clasificación, `--root` |
| `scripts/test-inventory-tautological-tests.mjs` | **nuevo** (11 casos) |
| `scripts/verify-bundle-runtime.mjs` | **nuevo** (5 comprobaciones, fail-soft) |
| `scripts/test-verify-bundle-runtime.mjs` | **nuevo** (6 casos) |
| `tests/e2e/floating-window-surface.test.ts` | **nuevo** (15 asserts de comportamiento) |
| `tests/e2e/floating-minimize.test.ts:388-404` | los 2 asserts del config → **comportamiento** (import del módulo) |
| `tests/e2e/contract/floating-wiring.contract.test.ts` | **BORRADO** (16 asserts) |
| `apps/desktop/scripts/lint/source-contracts.lint.mjs` | **+6 contratos de corpus** (13 asserts) · ruta de `PaneShell.tsx` corregida |
| `.github/workflows/ci.yml:167,198,213,235,253` | **5 pasos** (4 nuevos + 1 renombrado) → **30 pasos** |
| `package.json` | `verify:attribution(:test)`, `verify:bundle(:test)`, `inventory:tautological(:test)`, `lint:source-contracts`; `verify:all` las incluye |

**No tocado**: `packages/**` (salvo leer) · `apps/desktop/src/**` ·
`apps/desktop/renderer/**` (A4/A6) · `docs/**` (salvo este handoff).

---

## 6. Verificación final

| | |
|---|---|
| Puertas ejecutadas | **21/21 en exit 0** |
| `pnpm -r typecheck` | **exit 0** (21/21 paquetes) |
| `pnpm --filter @ego/desktop test` | **exit 0** (430 pass, 5 skipped) |
| `pnpm --filter @ego/e2e-tests test` | **exit 0** (84 pass, 1 skipped) |
| `pnpm lint` | **exit 0** (presupuesto respetado) |

Las 21: `verify-ci-gates` · `test-verify-ci-gates` · `verify-attribution` ·
`test-verify-attribution` · `verify-lint-budget` · `inventory-tautological` ·
`test-inventory-tautological` · `verify-bundle-runtime` ·
`test-verify-bundle-runtime` · `lint:source-contracts` · `audit-security` ·
`verify-backlog-gates` · `check-docs-lint` · `verify-ci-triggers` ·
`verify-harness` · `verify-paths` · `provenance (local)` ·
`provenance --sin-clones` · `vantadb:check` · `preflight-disk` · `lint:oxlint`.

---

## 7. Texto EXACTO para A1

### 7.1 Las 4 filas del Backlog (`docs/roadmap/Backlog.md`)

En las 4 filas, cambiar la **columna 7 (estado)** de `⏳ Pendiente` / `⏳ Parcial`
a `✅ Completada` y **añadir** el avance al final de la columna de notas.

> ⚠️ Los 4 textos de abajo van **en una sola línea** a propósito: son celdas de
> la tabla del Backlog, y una celda no puede llevar saltos de línea (romperían
> la tabla). Por eso superan el límite de longitud de `MD013` — el gate de
> docs-lint los absorbe como formato de worklog (no canónico). **No los
> partas en varias líneas al pegarlos.**

**`EGO-FIND-63`** (L1178) — estado `✅ Completada`; añadir al final de las notas:

> **Cerrado 2026-10-21 (Ola 11, A7):** con el detector **arreglado** (ver `EGO-FIND-108`) el recuento real de tautológicos de la zona de A7 era **16 asserts** (no 3: 13 de ellos leían el corpus de `apps/desktop/src/**` mediante un `.map()` en una línea posterior a la declaración, forma que el detector no veía). Los **16** se han resuelto: **3** convertidos en **comportamiento** (nuevo `tests/e2e/floating-window-surface.test.ts`: importa el módulo y llama a `shouldAutoShow` / `isPresenceAllowed` / `syncFromAttention` / `FloatingWindowManager`), **13** aislados como **contratos de forma** en `apps/desktop/scripts/lint/source-contracts.lint.mjs` (6 contratos de corpus sobre `apps/desktop/src/**`, exit 1 si se violan) y **2** (la entrada MPA de electron-vite) convertidos en comportamiento importando el config. El fichero `tests/e2e/contract/floating-wiring.contract.test.ts` se ha **borrado**. **Inventario de la zona de A7: 16 → 0 tautológicos.** Quedan **34** en la zona de A4 (renderer), que no son de A7: seAvisa a A4 en el handoff.

**`EGO-FIND-82`** (L1207) — estado `✅ Completada`; añadir al final de las notas:

> **Cerrado 2026-10-21 (Ola 11, A7):** las **3** puertas nuevas de paquete (`packages/{tool-call-repair,tools,ui-runtime}/scripts/check-attribution.mjs`) **ya están cableadas en CI**: `scripts/verify-attribution.mjs` (delegador, **no** reimplementación) pasa a cubrir las **4** puertas (avatar + las 3), cada una con su raíz y su modo (`--fix`/`--apply` en el avatar; `--check`, que NUNCA escribe, en las 3 de paquete). **Verificado que las 3 son CI-safe sin los clones de `repos-referencia/`**: con el clon ausente anotan *"origen no comprobable"* y siguen verificando cabeceras, cobertura del manifiesto, `LICENSE.md` y `NOTICE` → exit 0 (probado con una copia de los paquetes en un árbol sin clones). El paso de CI se ha renombrado a *"Atribución: motor de avatar + 3 paquetes"* y se ha añadido el test del delegador (8 casos). **Pendiente (no bloqueante, no de A7):** la puerta de A2-bis peta con un `TypeError` (no con un diagnóstico) cuando falta `provenance.manifest.json` — ver el handoff §8.

**`EGO-FIND-108`** (L1255) — estado `✅ Completada`; sustituir la columna de notas por:

> **Cerrado 2026-10-21 (Ola 11, A7):** el detector (`scripts/inventory-tautological-tests.mjs`) ya ve las 4 formas que se escapaban — lectura directa, `await fs.readFile(...)`, `fs.readFileSync(...)` y lectura **envuelta en un helper** (`const read = (p) => readFileSync(p)`) — además de la lectura anidada en una expresión o dentro de un `${…}` de un template, y la lectura dentro del propio `expect`. Un helper sólo cuenta si **devuelve** el texto: si la lectura se pasa a un parser y lo que se devuelve es un AST, no cuenta (evita el falso positivo de `readDeclaration()` en `packages/avatar/tests/public-surface.test.js`). Cada lectura se **clasifica resolviendo la ruta estáticamente**: `codigo-repo` (texto del código bajo prueba ⇒ **tautológico**), `dato-repo` (fichero del repo que no es código ⇒ contrato de entrega) y `dinamica` (ruta calculada en ejecución ⇒ no decidible). **Medición:** el detector antiguo_marketa **1 fichero / 3 asserts** (por casualidad: sólo veía los de lectura en la misma línea); el nuevo detecta **39 ficheros / 152 asserts** y clasifica **52 tautológicos** (A4: 34 · A7: 18). Test con 11 fixtures (`scripts/test-inventory-tautological-tests.mjs`, 11/11).

**`EGO-FIND-122`** (L1269) — estado `✅ Completada`; sustituir la columna de notas por:

> **Cerrado 2026-10-21 (Ola 11, A7):** el smoke test del bundle real existe y está **cableado en CI** (job `verify`, después del build): `scripts/verify-bundle-runtime.mjs` comprueba (a) que el bundle **no resuelve** Node/Rust/Python (30 toolchains vigilados en las llamadas `spawn`/`exec*` del bundle), (b) que los `.node` de VantaDB salen de `asarUnpack` — los **3** patrones de `electron-builder.config.cjs` (`**/*.node`, `**/node_modules/vantadb/**`, `**/node_modules/vantadb-node/**`) y, si hay app desempaquetada, que el binario está **fuera** del `.asar` — y (c) que no faltan **DLLs** de runtime en el paquete (`vcruntime140.dll`, `vcruntime140_1.dll`, `msvcp140.dll` en Windows). Es **fail-soft**: sin bundle, o sin app empaquetada, la comprobación se **omite con el motivo y el comando exacto** (`pnpm --filter @ego/desktop dist`) y sale 0. Test de 6 casos. ⚠️ **NO sustituye a la VM limpia del owner (DIST-06)**: comprueba el *bundle*, no la instalación real en Windows; la VM sigue haciendo falta para la prueba Windows real.

### 7.2 `docs/dev/desktop/DEV_LOOP.md`

Añadir esta sección **al final** del fichero (después de `## Notas`):

````markdown
## Smoke test del bundle (EGO-FIND-122)

`pnpm build` deja el bundle real en `apps/desktop/out/{main,preload}`. El
smoke test lo comprueba sin necesidad de la VM limpia del owner:

```bash
pnpm run verify:bundle      # smoke test (fail-soft si no hay bundle)
pnpm run verify:bundle:test # 6 casos con fixtures
```

Qué comprueba:

1. **No resuelve Node/Rust/Python**: el bundle es de Electron; si invoca un
   toolchain del sistema (`node`, `python3`, `cargo`, `rustc`, `npm`…), la app
   funciona en la máquina del developer y se rompe en la del usuario.
2. **Los `.node` de VantaDB se cargan desde `asarUnpack`**: dentro del `.asar`
   el linker no puede cargarlos. Se verifican los 3 patrones de
   `apps/desktop/electron-builder.config.cjs` y, si hay app desempaquetada, que
   el binario está fuera del `.asar`.
3. **No hay DLLs ausentes** en el paquete (en Windows: `vcruntime140.dll`,
   `vcruntime140_1.dll`, `msvcp140.dll`).

**Fail-soft**: sin bundle (`apps/desktop/out/main/main.js`) no hay nada que
comprobar y el script sale 0 diciendo qué se ha omitido. Para las dos
comprobaciones que necesitan la app desempaquetada:

```bash
pnpm --filter @ego/desktop dist   # genera apps/desktop/release/**
```

**Lo que esto NO cubre**: la prueba en la VM limpia del owner (`DIST-06`) sigue
siendo necesaria para la instalación real en Windows (registro, firma, arranque
en frío). El smoke test deja de ser la única línea de defensa, no la
sustituye.
````

---

## 8. Solicitudes a los otros agentes

### A2-bis — la puerta de atribución peta con un `TypeError` cuando falta el manifiesto

`packages/tool-call-repair/scripts/check-attribution.mjs` (vuestra zona): la
salida anticipada de `runGate()` (L194) devuelve un `report` **sin el campo
`manifest`**, y `runGateCli` (L430) lo desreferencia:

```text
TypeError: Cannot read properties of undefined (reading 'derived')
    at runGateCli (packages/tool-call-repair/scripts/check-attribution.mjs:430:36)
```

**No lo he tocado** (zona de A2-bis). El efecto es cosmético para CI (el
delegador recibe exit 1 y lo reporta), pero el diagnóstico es inservible.
Fix sugerido (1 línea): incluir `manifest: null` en el `report` de la salida
anticipada, o desreferenciar con `report.manifest?.derived ?? 0` en L430.

### A4 — 34 tautológicos siguen en la zona del renderer

Con el detector arreglado aparecen **34 asserts tautológicos** en ficheros de
`apps/desktop/renderer/test/**` (`ThemeTokens.test.tsx` 17,
`CharacterLegacy.test.tsx` 12, `MarkdownSanitization.test.tsx` 5). Son asserts
sobre el texto de ficheros del repo (CSS, barrel, componentes). El mecanismo es
el de siempre: convertirlos en comportamiento o aislarlos como contratos de
forma en `apps/desktop/scripts/lint/source-contracts.lint.mjs`. **A7 no los ha
tocado** (zona de A4).

### A4 — dos cosas que A7 ha tocado en tu mecanismo (revisión)

1. `apps/desktop/scripts/lint/source-contracts.lint.mjs`: **+6 contratos** de
   corpus (el wiring de la isla flotante, 13 asserts que vivían en un
   `*.test.*`) y **corregida la ruta** de `PaneShell.tsx`
   (`renderer/components/ui-kit/PaneShell.tsx` → `renderer/components/PaneShell.tsx`;
   el componente se movió y el contrato apuntaba al sitio viejo ⇒ la puerta
   fallaba con *"el fichero no existe"*).
2. `.github/workflows/ci.yml`: el lint **estaba fuera de todos los pipelines**;
   ahora es un paso bloqueante del job `verify`.

### Orquestador — dos cosas que no dependen de un agente

1. **El presupuesto de lint (470) sigue siendo PROVISIONAL**: lo fija el
   trabajo en curso. Hay que **BAJARLO** a `recuento real + 8` cuando se
   asiente.
2. **La VM limpia del owner (`DIST-06`) sigue siendo necesaria**: el smoke test
   del bundle comprueba el *bundle*, no la instalación real en Windows.

---

## 9. Lo que NO se resuelve aquí

- **`DIST-06` (VM limpia del owner)**: no se sustituye. El smoke test verifica
  el bundle y la configuración de empaquetado; **no** verifica la instalación
  real en Windows (registro, firma, arranque en frío, DLLs del sistema).
  Siguen haciendo falta las dos comprobaciones que sí se hicieron: la del
  `.asar.unpacked` real y la de las DLLs, que requieren `pnpm --filter
  @ego/desktop dist`.
- **Los 34 tautológicos de la zona de A4**: no son de mi zona (ver §8).
- **`check-attribution.mjs` de A6**: sigue en `packages/avatar/**` (zona de A6);
  el delegador lo invoca sin tocarlo.
