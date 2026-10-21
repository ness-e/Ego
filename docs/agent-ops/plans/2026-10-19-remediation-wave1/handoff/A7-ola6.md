# Handoff A7 — Ola 6 (higiene: .gitignore de auditoría + ratchet con presupuesto) — 2026-10-21

> **Agente:** A7 (calidad / CI-CD / seguridad de dependencias / deuda técnica).
> **Ola 6 (tarea corta de higiene):** (T1) `.gitignore` de los artefactos de
> auditoría · (T2) el ratchet de lint con **fuente única** y puerta que impide
> subirlo · (T3) el estado final de los overrides de `pnpm`.
>
> **Continuación de** `A7-ola5.md`.

## 0. Resumen ejecutivo

| | Antes | Ahora |
|---|---|---|
| Patrón de artefactos de auditoría en `.gitignore` | **ninguno** | 5 patrones **anclados a la raíz** |
| Ratchet de lint: dónde vive | número suelto en `package.json` | **`scripts/lint-budget.json`** (fuente única) |
| Ratchet en CI | **NO se aplicaba** (el paso de lint corría oxlint sin `--max-warnings`) | se aplica + puerta bloqueante |
| ¿Se puede subir el presupuesto a voluntad? | sí | **no**: la puerta lo detecta y falla |
| Overrides de `pnpm` | 5 (4 + 1 temporal) | **4, todos load-bearing** (probado 1 a 1) |

---

## 1. T1 — `.gitignore` de los artefactos de auditoría

### 1.1 Dónde ensucia DE VERDAD

Los tres generadores de la auditoría visual:
`apps/desktop/scripts/run-design-audit.ps1`, `design-audit-headless.mjs` y
`ego-browser-audit.mjs`.

- Su `OUT` por defecto es **`%TEMP%\ego-audit`** (fuera del repo) →
  `run-design-audit.ps1:49`: `[string]$Out = "$env:TEMP\ego-audit"`.
- Pero `OUT` es configurable (`-Out` en el `.ps1`, y el `dir` de
  `%TEMP%\ego-audit-config.json` en los `.mjs`), y `SHOTS = join(OUT, "shots")`
  → si alguien lo apunta al repo, deja:
  - `<OUT>/shots/*.png` → `shots/` en la raíz
  - `<OUT>/report.json` → `report.json` en la raíz
- La herramienta externa **`playwright-cli`** deja su directorio de salida
  `.playwright-cli/` en el **CWD** → en la raíz si se lanza desde el repo.

### 1.2 El patrón exacto añadido

```gitignore
# ── Artefactos de auditoría visual (Ola 6, A7) ─────────────────────────────
# Los generadores (`apps/desktop/scripts/run-design-audit.ps1`,
# `design-audit-headless.mjs`, `ego-browser-audit.mjs`) escriben capturas
# (`<OUT>/shots/*.png`) y un `<OUT>/report.json`. Por defecto `OUT` es
# `%TEMP%\ego-audit` (fuera del repo), pero si se lanzan con `-Out` apuntando
# al repo —o con la config `%TEMP%\ego-audit-config.json` con `dir` así—
# dejan artefactos sueltos que hay que limpiar a mano.
#
# PATRONES ANCLADOS A LA RAÍZ a propósito: el repo versiona 36 PNG legítimos
# (`docs/public/…`, `images/`, `packages/avatar/captures/…`,
# `.agents/skills/*/assets/`). Un `*.png` global los ignoraría.
#   · `/*.png`             → capturas sueltas en la raíz
#   · `/.playwright-cli/`  → directorio de salida de la herramienta playwright-cli
#   · `/audit-artifacts/`  → artefactos de auditoría agrupados
#   · `/shots/`            → `<OUT>/shots/` cuando OUT = raíz del repo
#   · `/report.json`       → `<OUT>/report.json` cuando OUT = raíz del repo
/*.png
/.playwright-cli/
/audit-artifacts/
/shots/
/report.json
```

### 1.3 Por qué NO es global (y por qué es seguro)

El repo versiona **36 PNG** legítimos: `docs/public/quickstart/*.png`,
`images/image.png`, `packages/avatar/captures/**/*.png`,
`.agents/skills/*/assets/*.png`, `apps/desktop/assets/icon.png`. Un `*.png`
global los borraría del índice. Los 5 patrones llevan **ancla de raíz** (`/`):
sólo afectan a la raíz del repo, nunca a un subdirectorio.

**Comprobado antes de escribir:**

- `git ls-files "*.png"` filtrando por raíz → **0** → `/*.png` no pisa nada
  versionado.
- `git ls-files` buscando `report.json` / `shots` / `audit-artifacts` /
  `playwright-cli` → sólo aparecen ficheros de **documentación** de la skill
  (`.agents/skills/playwright-cli/SKILL.md`, etc.), que no son el directorio
  de salida → `/.playwright-cli/` no los pisa.

### 1.4 Verificado (rojo→verde)

```text
=== TDD ROJO: crear los artefactos y ver si git los lista ===
  artefactos creados: A7_TEST.png, .playwright-cli/, audit-artifacts/, shots/, report.json
  ✓ NINGUNO aparece en git status (están ignorados)

=== control: ¿un PNG de verdad NO se ignora? ===
  ✓ los PNG versionados NO están ignorados
     (docs/public/quickstart/frame-01.png, packages/avatar/captures/after/cx-faithful--idle.png,
      images/image.png → git check-ignore no los marca)

=== limpieza verificada ===
  A7_TEST.png existe: False · .playwright-cli: False · audit-artifacts: False
  shots: False · report.json: False
```

> Nota: el `.gitignore` **no tenía newline final** (último byte 47) → se
> corrigió al añadir la sección (si no, el patrón nuevo se pegaría a la última
> línea y no aplicaría).

---

## 2. T2 — El ratchet de lint: fuente única + puerta que impide subirlo

### 2.1 El diagnóstico (por qué era deuda de proceso)

En la Ola 5 el ratchet se re-baseló **tres veces** (324 → 361 → 350). La causa
no era el código, era el **mecanismo**:

1. El número vivía **sólo** en `package.json` → no había ninguna puerta que
   lo verificara, así que subirlo era una edición libre e invisibles.
2. **CI no lo aplicaba**: el paso de lint del job `verify` corría
   `pnpm exec oxlint --ignore-path .gitignore apps packages tests scripts eval`
   **sin `--max-warnings`** → en CI el presupuesto no restringía nada. El ratchet
   era *local-only*.

### 2.2 La fuente única: `scripts/lint-budget.json`

```json
{
  "maxWarnings": 317,
  "previousMaxWarnings": 350,
  "raisedBecause": "",
  "countedAt": "2026-10-21",
  "scope": "apps packages tests scripts eval",
  "command": "oxlint --ignore-path .gitignore apps packages tests scripts eval",
  "notes": "…"
}
```

**Valor final: `maxWarnings = 317`** = recuento real medido (**309-310**) +
margen 8. Los overrides de `package.json` han desaparecido: `pnpm lint` y
`pnpm lint:oxlint` leen **este** fichero.

### 2.3 La puerta: `scripts/verify-lint-budget.mjs`

Reglas (falla si alguna se incumple):

1. **Regresión**: el recuento real no puede superar `maxWarnings`.
2. **Subida sin justificar**: `maxWarnings` no puede ser mayor que
   `previousMaxWarnings` sin (a) `raisedBecause` no vacío **y** (b) que el
   recuento real también haya subido por encima del valor anterior.
   → **el ratchet sólo puede bajar**; subirlo exige justificarlo Y que haya
   avisos nuevos de verdad que absorber.
3. Si el recuento real queda por debajo del presupuesto, la puerta **avisa**
   de cuánto margen hay (para poder apretarlo) pero no falla.

`--budget <fichero>` y `--count <n>` permiten auditar un fixture sin lanzar
oxlint (los usa el test).

### 2.4 TDD: `scripts/test-verify-lint-budget.mjs` (5 casos, rojo y verde)

```text
=== TDD de la puerta del presupuesto de lint ===

OK    1. presupuesto respetado (real == presupuesto)
        función=ok · binario exit=0 (esperado 0)
[verify-lint-budget] REGRESIÓN: el recuento real (317) supera el presupuesto (300) → corrige 17 aviso(s), …
OK    2. REGRESIÓN: presupuesto por debajo del recuento real
        función=KO · binario exit=1 (esperado 1)
[verify-lint-budget] el presupuesto SUBIÓ de 350 a 999 sin justificación: rellena "raisedBecause" en … o, mejor, baja el presupuesto
OK    3. SUBIDA sin justificar: maxWarnings inflado
        función=KO · binario exit=1 (esperado 1)
OK    4. SUBIDA justificada Y el recuento real también subió
        función=ok · binario exit=0 (esperado 0)
OK    5. presupuesto APRETADO (max < previous)
        función=ok · binario exit=0 (esperado 0)

=== casos fallidos: 0 ===
```

El caso 3 es exactamente el escenario que se pedía: **subir `maxWarnings` a un
valor inflado sin tocar el código → exit 1**.

### 2.5 Conectado a CI (job `verify`, bloqueante)

```yaml
      - name: Run Linter (oxlint pinned via devDependencies)
        # El tope de avisos vive en `scripts/lint-budget.json` (FUENTE ÚNICA), no
        # en un número de package.json: este paso lo lee y lo aplica. Antes
        # corría oxlint SIN `--max-warnings` → el ratchet no restringía nada en CI.
        run: pnpm lint:oxlint

      - name: Puerta del presupuesto de lint (sólo puede bajar)
        run: node scripts/verify-lint-budget.mjs

      - name: Test de la puerta del presupuesto de lint
        run: node scripts/test-verify-lint-budget.mjs
```

### 2.6 Efecto secundario que arregla la causa del churn

El aviso de la puerta ("quedan N avisos de margen; puedes BAJAR el presupuesto a
X") convierte el re-baselado de **reactivo** (cuando el gate ya está rojo) en
**proactivo** (antes de que lo esté). Y como la subida está bloqueada, la
tendencia natural es **bajar** el presupuesto, no subirlo.

---

## 3. T3 — El estado final de los overrides

### 3.1 Cuántos quedan: **4** (los temporales ya se habían borrado)

Los **5 temporales** que cité en el handoff de la Ola 5 son en realidad **4**
(`vitest`, `electron`, `electron-builder` y `@vitest/coverage-v8`): se borraron
en la Ola 5 **cuando A2/A3/A4 subieron sus manifiestos** (los 20 paquetes
declaran ya `vitest@^3.2.7` y `apps/desktop` declara `electron@^41.10.7` y
`electron-builder@^26.15.3`). **Esa parte de la deuda ya estaba cerrada.**

### 3.2 Los 4 que quedan, probados UNO A UNO

Método riguroso: quitar **un** override → **resolución real** (`pnpm install`, no
`--lockfile-only`: éste reutiliza la resolución previa y da falsos negativos) →
leer el informe de advisories → restaurar.

```text
CON los 4 overrides: 3 advisories · {"moderate":3}

  SIN app-builder-lib:      16 · {high:9, moderate:6, critical:1}
     nuevos: app-builder-lib@<26.15.0 [high] + cadena tar (tar@<=7.5.18 [critical] + 9 high)
  SIN builder-util-runtime:  4 · {high:1, moderate:3}
     nuevos: builder-util-runtime@<9.7.0 [high]
  SIN tinypool:              5 · {moderate:3, critical:2}
     nuevos: tinypool@<=2.1.0 [critical] | tinypool@<2.1.2 [critical]
  SIN vitepress>vite:       10 · {moderate:8, high:2}
     nuevos: vite@<=6.4.2 [high] | vite@<=6.4.3 [high] | esbuild@<=0.24.2 [moderate]
```

**Veredicto: los 4 son load-bearing — NO se puede borrar ninguno.** Los
temporales (los que dependían de que los agentes subieran sus manifiestos) ya
no existen; los que quedan son **permanentes por naturaleza**: son
dependencias **transitivas que nadie declara** (`app-builder-lib` y
`builder-util-runtime` los arrastra el peer automático
`electron-builder-squirrel-windows@25.1.8`; `tinypool` y `vite` son
implementación interna de `vitest` y `vitepress` respectivamente).

> **Aviso metodológico (la lección de este bloque):** el primer intento de
> prueba usó `pnpm install --lockfile-only` y dio un **falso negativo** para
> `tinypool` ("sin cambio"). Con `--lockfile-only` pnpm **reutiliza** la
> resolución ya presente en el lockfile, así que `tinypool` se quedaba en 2.2.0
> y no aparecía el advisory. Con un `pnpm install` real, `tinypool` baja a
> **1.1.1** y aparecen **2 CRITICAL**. Para probar el efecto de un override hay
> que **re-resolver de verdad**.

### 3.3 Estado final verificado

```text
overrides: app-builder-lib, builder-util-runtime, tinypool, vitepress>vite
tinypool en el lockfile: 2.2.0
[audit-security] advisories: critical=0 high=0 moderate=3 low=0
pnpm build → exit 0 · verify-dist → exit 0
```

**Nada que borrar**: los 4 overrides se quedan, cada uno con su motivo medido.
Los 3 advisories moderate restantes (`vitest`, `@vitest/mocker`, `sprintf-js`)
no tienen fix upstream → informativos, con revisión fijada para **2026-12-20**.

---

## 4. Verificación final (24 checks) — **24/24 en exit 0**

| # | Check | Exit | Tiempo |
|---|---|---:|---:|
| 1 | `pnpm -r typecheck` | **0** | 31 s |
| 2 | `pnpm lint` (con el presupuesto) | **0** | 33 s |
| 3 | `lint:budget:check` | **0** | 0,7 s |
| 4 | `lint:budget:test` (TDD de la puerta) | **0** | 0,5 s |
| 5 | `pnpm test` (con preflight de disco) | **0** | 239 s |
| 6 | `pnpm build` | **0** | 77 s |
| 7 | `node apps/desktop/scripts/verify-dist.cjs` | **0** | 0,1 s |
| 8 | ode scripts/audit-security.mjs | **0** | 3,3 s |

pnpm audit --json sale **1** (esperado: hay advisories); la puerta real
(udit-security.mjs, check 8) sale **0** con **0 críticos / 0 altos**.
| 9 | `node scripts/verify-vantadb-resolution.mjs` | **0** | 0,1 s |
| 10 | `node scripts/verify-real-binding.mjs` | **0** | 0,4 s |
| 11 | `node scripts/preflight-disk.mjs` | **0** | 0,1 s |
| 12 | `node scripts/audit-extraction-gates.mjs` | **0** | 0,2 s |
| 13 | `node scripts/test-audit-extraction-gates.mjs` | **0** | 0,4 s |
| 14 | `node scripts/check-docs-lint.mjs` | **0** | 12 s |
| 15 | `node docs/testing/check-docs-paths.mjs` | **0** | 0,5 s |
| 16 | `node scripts/verify-paths.mjs` | **0** | 0,5 s |
| 17 | `node scripts/verify-ci-triggers.mjs` | **0** | 0,2 s |
| 18 | `node scripts/verify-harness.mjs` | **0** | 0,1 s |
| 19 | `node scripts/verify-vantadb-ids.mjs` | **0** | 0,2 s |
| 20 | `pnpm --filter @ego/avatar sync:check` | **0** | 0,7 s |
| 21 | `pnpm --filter @ego/avatar geometry:check` | **0** | 0,7 s |
| 22 | `pnpm --filter @ego/avatar attribution:check` | **0** | 0,5 s |
| 23 | `pnpm --filter @ego/gui-tests test` | **0** | 0,5 s |
| 24 | `node scripts/audit-debt.mjs` | **0** | 0,3 s |

`pnpm audit --json` sale **1** (esperado: hay advisories); la puerta real
(`audit-security.mjs`, check 8) sale **0** con **0 críticos / 0 altos**.

---

## 5. Ficheros tocados por A7 (Ola 6)

| Fichero | Cambio | Tarea |
|---|---|---|
| `.gitignore` | 5 patrones anclados a la raíz para los artefactos de auditoría (+ newline final) | T1 |
| `scripts/lint-budget.json` | **nuevo**: la fuente única del ratchet (`maxWarnings: 317`, `previousMaxWarnings: 350`) | T2 |
| `scripts/verify-lint-budget.mjs` | **nuevo**: la puerta (regresión + subida sin justificar) | T2 |
| `scripts/test-verify-lint-budget.mjs` | **nuevo**: TDD de la puerta (5 casos) | T2 |
| `package.json` | `lint` y `lint:oxlint` leen el presupuesto (ya no hay número suelto) · `lint:budget:check` · `lint:budget:test` | T2 |
| `.github/workflows/ci.yml` | el lint de CI **aplica** el presupuesto + puerta + su test | T2 |
| `pnpm-lock.yaml` | regenerado (sin cambios netos: los 4 overrides siguen) | T3 |

**No tocado**: `packages/**`, `apps/**`, `docs/**` (salvo este handoff),
`.npmrc` (sigue **sin** `public-hoist-pattern`, a propósito).

---

## 6. Deuda / no resuelto

1. **El install en Windows sigue siendo frágil**: `ERR_PNPM_EPERM` al
   desenlazar binarios recién escritos (Defender). Mitigación aplicada en esta
   ola: parar los `electron`/`vite` vivos y **borrar los `.bin` con shims
   bloqueados** antes de reintentar. Es una condición del **entorno**, no del
   repo (CI, en Linux, no la sufre). **No se aplicó `public-hoist-pattern`**:
   purga `node_modules` y con agentes vivos es inviable.
2. **El presupuesto de lint es una foto del momento**: si los agentes añaden
   código con avisos, el gate se pondrá rojo (que es lo que se quiere) y
   habrá que **bajarlo** al nuevo recuento real — o, si los avisos nuevos son
   inevitables, subirlos **con `raisedBecause` y con el recuento real por
   encima del valor anterior**. La puerta deja explícito qué hacer en cada
   caso.
3. **`.gitignore` cubre 5 rutas conocidas; si una herramienta nueva escribe en
   otra**, hay que añadirla anclada. La puerta de `verify-paths` no cubre
   binarios: es una revisión manual, no automática.
4. **3 advisories moderate sin fix upstream** (`vitest`, `@vitest/mocker`,
   `sprintf-js`) → informativos; revisión **2026-12-20**.
5. **Los overrides no se pueden tocar** hasta que el upstream arregle
   `app-builder-lib`/`builder-util-runtime`/`tinypool`/`vite`, o hasta que
   `electron-builder` deje de arrastrar el peer
   `electron-builder-squirrel-windows@25.1.8`.
