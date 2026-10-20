# Handoff A6 (Ola 1b) — 2026-10-20 — Cadena MIT resoluble + cierre de deuda de avatar #

> Agente: **A6** · Plan: `docs/agent-ops/plans/2026-10-19-remediation-wave1/A6-avatar.md`
> Zona: `packages/avatar/**`, `apps/desktop/renderer/floating/vendor/avatar/**`,
> `docs/product/mascota.md`, `docs/product/character-art-direction.md`,
> `docs/architecture/character-system.md`, `docs/research/character-audit-and-coucou-inventory.md`
> Continuación de `handoff/A6.md` (Ola 1). Sin commits.

---

## 1. Qué estaba roto y qué se ha hecho ##

El orquestador detectó un **hueco de atribución legal**: `repos-referencia/`
está en `.gitignore` (línea 49), así que **no está en el repositorio**, y las
rutas que citan `LICENSE.md` y las cabeceras de `src/` apuntaban a ficheros
que un auditor que clone el repo **no tiene**. La cláusula MIT exige que el
aviso de copyright sea resoluble.

Causa raíz medida: las 5 familias de `LICENSE.md` no son ficheros sueltos sino
**globs y expansiones de llaves** (`vendor/agent-robot-avatar/*.js`,
`vendor/coucou/core/{anim,bridge,layout,state}.ts`, …). "0 de 5 resuelven" no
era un problema de rutas mal escritas, sino de que **el corpus no estaba en el
repo**.

### B1 — Corpus de atribución portado y cadena cerrada ###

| Acción | Detalle |
|---|---|
| Corpus portado | `repos-referencia/avatar/vendor/` (30 ficheros) → `packages/avatar/vendor/` |
| **Corpus completado** | El upstream **omitía `coucou/core/sound.ts`** pese a que `src/runtime/sound.js` deriva de él. Portado desde `repos-referencia/coucou/windows/src/core/sound.ts` (MIT © Louis Raillard) → **31 ficheros** |
| `packages/avatar/vendor/README.md` | **nuevo** — declara sin ambigüedad que es un corpus de atribución de **solo lectura**, que **NO es código de runtime**, que **no debe importarse**, y la licencia de cada subárbol (`agent-robot-avatar` MIT © CX ART Lab · `coucou` y `coucou-swift` MIT © Louis Raillard). Incluye el mapa corpus → fichero de `src/` derivado |
| Corpus replicado | `apps/desktop/renderer/floating/vendor/avatar/vendor/` (32 ficheros) → la atribución es resoluble **desde cualquiera de las dos copias** |
| `packages/avatar/LICENSE.md` | Fila del corpus corregida: `vendor/coucou/core/{anim,bridge,layout,state}.ts` → `{anim,bridge,layout,state,sound}.ts` (el corpus real incluye `sound.ts`; la tabla upstream era internamente inconsistente) |
| Cabeceras normalizadas | **25 líneas** de 9 ficheros de `src/` normalizadas a rutas `vendor/...` resolubles. Corregido además `vendor/coucou/anim.ts` → `vendor/coucou/core/anim.ts` (la ruta estaba mal en el propio upstream) |
| `packages/avatar/NOTICE` | Reescrito: la frase sobre `vendor/` **es ahora veraz** (vive en el repo, es corpus de atribución de solo lectura, replicado en la copia vendorizada) |
| `apps/.../vendor/avatar/NOTICE` | Ídem, con la advertencia de que es corpus de solo lectura |

**Decisión de diseño (B1.4)**: *replicar* el corpus en la copia vendorizada, no
apuntar a `packages/avatar/vendor/`. Motivo: la copia vendorizada **se
distribuye dentro del app de Electron**, y una cadena de atribución que sólo
resuelve desde el árbol de trabajo no cumple el requisito de la cláusula MIT
en el artefacto distribuido. Coste: 388 KB por copia. Consecuencia asumida:
`sync-check.mjs` compara **también** el subárbol `vendor/` (SHA-256), de modo
que las dos copias del corpus no pueden divergir en silencio.

### B1 — Herramienta de verificación (nueva) ###

`packages/avatar/scripts/check-attribution.mjs` — comprueba, y **sale con exit 1**
si algo queda colgando:

1. que existen `LICENSE`, `LICENSE.md` y `NOTICE` en la raíz del paquete;
2. que **toda familia de rutas** citada en `LICENSE.md` expande a ficheros
   reales (globs y llaves incluidos);
3. que **toda ruta** citada en las cabeceras de `src/` existe;
4. que **`src/` no importa nada de `vendor/`** (0 imports — el corpus no puede
   colarse en el bundle);
5. que la copia vendorizada lleva su `vendor/` y coincide **por SHA-256**.

`$lang
$ node packages/avatar/scripts/check-attribution.mjs
atribucion: 3 ficheros legales, 5 familias en LICENSE.md -> 31 ficheros, 9 rutas en cabeceras, 32 ficheros de corpus
  CADENA MIT RESOLUBLE: toda ruta citada existe en el repositorio.
exit=0

```text

### B1 — `sync-check.mjs` ampliado ###

Compara ahora **tres** cosas entre el paquete y la copia vendorizada: el
árbol de código (`src/`), los ficheros legales (`LICENSE`, `LICENSE.md`,
`NOTICE`) y el subárbol del corpus (`vendor/`). `--write` replica los tres.

### B2 — Deuda de la Ola 1 cerrada ###

| Deuda | Estado |
|---|---|
| `any` justificado del puente con el studio | **Documentado con precisión**: fichero y línea exactos, lista de campos privados afectados, motivo, **condición de cierre** y alcance del riesgo (ninguno en runtime). Ver §2 de este handoff. |
| `packages/avatar/dist/` versionado | **No**: `.gitignore:16` ya cubre `dist/` (verificado con `git check-ignore`); 0 ficheros versionados. |
| `package.json` sin `files`/`description`/`license`/`keywords` | **Corregido en la Ola 1** y verificado: los 10 campos presentes, más `exports` ampliados (ver §3). |

### B3 — El paquete sigue huérfano: documentado, no cableado ###

**No lo he cableado** (`CharacterBadge.tsx` y `floating-avatar.tsx` son de A4).
Lo que sí he hecho:

- `packages/avatar/README.md` tiene una sección nueva **"Estado honesto: qué
  copia ejecuta el runtime"** que dice, sin rodeos: el paquete es canónico
  *en el papel* y la copia vendorizada es *la que corre*; `grep -rn
  "@ego/avatar" apps packages` → **0 resultados**; y por qué el flotante
  seguirá necesitando el specifier literal.
- `packages/avatar/package.json` tiene ahora los **subpaths de export** que
  hacen posibles las diffs de A4 (§3). Verificado: `import("@ego/avatar/runtime/avatar-element.js")`
  y `import("@ego/avatar/runtime/sound.js")` **ya resuelven** hoy.

---

## 2. Texto para A1 — excepción de tipado del motor de avatar ##

> A1 lo está anotando en `AGENTS.md` (reasignación R12). Copiar tal cual.

### Texto exacto ###

`$lang
### Excepción de tipado — motor de personaje (`packages/avatar`)

`packages/avatar` es **JavaScript plano** (ESM, sin build) con los tipos
públicos declarados en `index.d.ts` y con **tipado real activo**:
`tsc -p tsconfig.json` corre con `allowJs` + `checkJs` y falla si algo se
rompe. No es TypeScript estricto, y hay **una** excepción acotada:

- **Dónde**: `packages/avatar/src/runtime/studio-bridge.js:34` (typedef) y sus
  usos en `:39`, `:50`, `:59`, `:145`, `:169`; y
  `packages/avatar/src/runtime/svg-export.js:22` (typedef) y sus usos en
  `:27`, `:38`.
- **Qué es**: `@typedef {any} AvatarElementInternals` — el tipo del elemento
  con sus campos **privados por convención** (`_studioHost`, `_n`, `_state`,
  `_mounted`, `_emote`, `_action`, `_pointer`, `_onPointerMove`,
  `_onVisibility`, `_onStudioResize`, `_resizeObserver`, `_renderMode`, …).
- **Por qué**: el puente con el motor canvas y la serialización a SVG operan
  sobre la **instancia interna** del elemento, no sobre su superficie pública.
  Esos campos se declaran en el constructor de `EgoAvatar` y los consumen esa
  misma familia de módulos; no forman parte del contrato público de
  `index.d.ts`. Declararlos uno a uno (o en un `.d.ts` interno) duplicaría la
  superficie y la desincronizaría en cada cambio del elemento.
- **Alcance del riesgo**: **ninguno en runtime**. Un `any` en un *type* de
  JSDoc no genera código ni cambia el comportamiento; sólo relaja la
  comprobación estática de esos parámetros.
- **Condición de cierre**: al migrar `packages/avatar/src/runtime/avatar-element.js`
  a TypeScript, la typedef se sustituye por el tipo real de la clase
  (`EgoAvatar`) y el `any` desaparece. Sin esa migración, la alternativa sería
  mantener un `.d.ts` interno con ~20 campos privados, que es peor.
```

### Referencia canónica en el propio código ###

La justificación completa (con las líneas exactas) está escrita en el código,
en los dos sitios donde aparece el `any`:
`packages/avatar/src/runtime/studio-bridge.js:31-56` y
`packages/avatar/src/runtime/svg-export.js:14-27`. Un revisor no tiene que ir
a ningún documento externo para ver **por qué** y **cuándo** se cierra.

---

## 3. Para A4 — diffs de una línea para que `@ego/avatar` sea el canónico ##

> Las cuatro diffs son de **una línea** cada una. Ninguna es necesaria para el
> funcionamiento actual (el motor vive en la copia vendorizada); son el
> camino para cerrar `EGO-FIND-25` (paquete huérfano).
>
> **Los subpaths de export ya existen** en `packages/avatar/package.json` y se
> han verificado: `import("@ego/avatar/runtime/avatar-element.js")` y
> `import("@ego/avatar/runtime/sound.js")` resuelven hoy mismo.

### 3.1 `apps/desktop/package.json` — declarar la dependencia ###

`$lang
   "dependencies": {
+    "@ego/avatar": "workspace:*",
     "@ego/dailystate": "workspace:*",

```text

### 3.2 `apps/desktop/renderer/components/character/CharacterBadge.tsx:13` ###

`$lang
-  import "../../floating/vendor/avatar/runtime/avatar-element.js";
+  import "@ego/avatar/runtime/avatar-element.js";
```

### 3.3 `apps/desktop/renderer/floating/floating-avatar.tsx:70` ###

`$lang
-          await import("./vendor/avatar/runtime/avatar-element.js");
+          await import("@ego/avatar/runtime/avatar-element.js");

```text

### 3.4 `apps/desktop/renderer/floating/floating-sound.ts:380` ###

`$lang
-      const mod = (await import("./vendor/avatar/runtime/sound.js")) as {
+      const mod = (await import("@ego/avatar/runtime/sound.js")) as {
```

### 3.5 ⚠️ Advertencia que A4 debe validar antes de aplicar ###

El **specifier literal dentro del root servido** no era un capricho: existe
por el hallazgo `FIND-12-01`. El specifier original
(`repos-referencia/avatar/src/index.js`) apuntaba **fuera** del root del
dev-server y producía un **404 en dev y en prod**, dejando el `<ego-avatar>`
inerte (box 0×0). La copia vendorizada bajo `renderer/floating/vendor/avatar/`
lo resolvió.

Un specifier de **paquete** (`@ego/avatar/...`) sí lo resuelve Vite
estáticamente, así que **debería** funcionar; pero A4 debe verificarlo, porque
el flotante es una entrada MPA separada (`floating/floating.html`) y el
especificador de `FIND-12-01` sigue activo:

- `pnpm --filter @ego/desktop build` + `build:verify` (que `A7` ejecuta).
- El spec E2E `tests/gui/specs/floating-full.spec.ts` (toleraba el 404
  conocido; si desaparece, el spec sigue verde, pero conviene confirmarlo).
- Que `customElements.get("ego-avatar")` siga definido y el canvas mida
  > 0 en `/floating/floating.html`.

**Si el specifier de paquete no funciona en la MPA**, la alternativa es
**mantener la copia vendorizada sólo para el flotante** y migrar el resto
(`CharacterBadge.tsx`). El paquete seguiría siendo canónico para todo lo
demás.

### 3.6 Lo que NO hay que hacer ###

- **No borrar** `apps/desktop/renderer/floating/vendor/avatar/` sin aplicar
  antes las cuatro diffs: `sync-check.mjs` lo compara con el paquete.
- **No borrar** `packages/avatar/vendor/` (el corpus de atribución): lo
  verifica `check-attribution.mjs` y la cadena MIT depende de él.

---

## 4. Verificación ##

| Comando | Exit | Resumen |
|---|---|---|
| `node --test packages/avatar/tests/` | **0** | **266 pass / 0 fail** |
| `pnpm --filter @ego/avatar typecheck` | **0** | `tsc -p tsconfig.json`, 0 errores |
| `node packages/avatar/scripts/compare-geometry.mjs --check packages/avatar/tests/golden/geometry.json packages/avatar/src` | **0** | **168/168** combinaciones idénticas a la golden (B4: el corpus no alteró ninguna ruta de carga) |
| `node packages/avatar/scripts/sync-check.mjs` | **0** | SIN DRIFT: código + ficheros legales + corpus `vendor/` |
| `node packages/avatar/scripts/check-attribution.mjs` | **0** | 5 familias de `LICENSE.md` → **31 ficheros**; 9 rutas de cabeceras; 32 ficheros de corpus; 0 imports desde `src/` |
| `pnpm --filter @ego/avatar build` | **0** | 50 ficheros en `dist/` + manifiesto SHA-256 |

**Demostración de la deriva (la puerta sigue mordiendo)**:

`$lang
$ node packages/avatar/scripts/sync-check.mjs
  DRIFT DETECTADO entre el paquete y la copia vendorizada:
    canon->vendor: DIFIERE   runtime/states.js
  exit=1
$ node packages/avatar/scripts/sync-check.mjs --write
$ node packages/avatar/scripts/sync-check.mjs
  SIN DRIFT: la copia vendorizada es identica al paquete (SHA-256).
  exit=0

```text

---

## 5. Ficheros tocados en esta Ola 1b ##

| Fichero | Cambio |
|---|---|
| `packages/avatar/vendor/**` | **nuevo** — 31 ficheros de corpus + `README.md` (32) |
| `packages/avatar/LICENSE.md` | fila del corpus: se incluye `sound.ts` (el upstream lo omitía pese a derivarse de él) |
| `packages/avatar/NOTICE` | reescrito: frase de `vendor/` veraz + aviso del corpus |
| `packages/avatar/README.md` | sección "Estado honesto: qué copia ejecuta el runtime"; sección "La cadena de atribución MIT"; `vendor/` en el árbol; scripts nuevos |
| `packages/avatar/DESIGN.md` | §13: el corpus vive en `packages/avatar/vendor/`, no en `repos-referencia/` |
| `packages/avatar/package.json` | `exports` ampliados con `./runtime/avatar-element.js` y `./runtime/sound.js`; script `attribution:check` |
| `packages/avatar/scripts/check-attribution.mjs` | **nuevo** — puerta de cadena MIT resoluble |
| `packages/avatar/scripts/sync-check.mjs` | compara también los ficheros legales y el subárbol `vendor/` |
| `packages/avatar/src/**` (9 ficheros) | 25 cabeceras normalizadas a rutas `vendor/...` resolubles |
| `packages/avatar/src/runtime/studio-bridge.js` | typedef `any` documentada con precisión (líneas, campos, motivo, condición de cierre) |
| `packages/avatar/src/runtime/svg-export.js` | ídem |
| `apps/desktop/renderer/floating/vendor/avatar/**` | `LICENSE.md` actualizado, `NOTICE` reescrito, corpus `vendor/` replicado, `src/` re-sincronizado |
| `docs/research/character-audit-and-coucou-inventory.md` | §6.4 actualizado: la cadena MIT es resoluble y dónde vive el corpus |

---

## 6. Deuda / no resuelto ##

| # | Deuda | Dónde |
|---|---|---|
| 1 | **`@ego/avatar` sigue huérfano** (0 imports). Es la consecuencia de D5 y de que el flotante necesita el specifier literal. Las 4 diffs de §3 son el camino de cierre, pero **aplicarlas y validarlas es de A4**. | A4 |
| 2 | **`vendor/` (corpus) no se distribuye dentro del app.** Vive en el repo y en la copia vendorizada, pero Vite no lo emite al bundle (nadie lo importa) → el artefacto distribuido **no** lleva el corpus. Si la atribución debe viajar en la app, A7 debe copiarlo al `out/` (p. ej. un `postbuild` que copie `packages/avatar/vendor/` al lado del `LICENSE.md` de la copia vendorizada). | A7 |
| 3 | **El motor sigue en JavaScript plano.** `checkJs` activo y tipos públicos en `index.d.ts`, pero no TS estricto. El `any` tiene excepción documentada (§2). Cierra al migrar `runtime/avatar-element.js`. | Ola 2 |
| 4 | **La `golden` geométrica pesa 280 KB.** Aceptable; comprimible con `zlib` si A7 lo pide. | A7 (opcional) |
| 5 | **El upstream sigue con el working tree sucio.** No se ha tocado (material de referencia). `packages/avatar` es su descendiente bifurcado: **28/44 byte-idénticos, 16 bifurcados, 5 nuevos**. Riesgo de pérdida si alguien lo limpia. | owner |
| 6 | **`LICENSE.md` deja de ser copia byte-idéntica del upstream** (una fila corregida: `sound.ts` añadido al corpus). Es una **corrección** del upstream, que era internamente inconsistente. Documentado aquí y en `docs/research/…` §6.4. | — |
| 7 | **`repos-referencia/coucou` sigue siendo la única fuente de `coucou/core/sound.ts`.** Está portado al corpus, así que la cadena no depende del upstream; pero si el upstream se limpia, el corpus de este repo es la única copia. | — |

---

RESULTADO: {
  agente: A6-avatar-ola1b,
  status: COMPLETED,
  archivos_modificados: [
    "packages/avatar/vendor/** (nuevo: 31 ficheros de corpus + README.md)",
    "packages/avatar/LICENSE.md (fila del corpus: +sound.ts)",
    "packages/avatar/NOTICE (reescrito: frase de vendor/ veraz)",
    "packages/avatar/README.md (seccion 'Estado honesto' + 'Cadena de atribucion MIT' + arbol + scripts)",
    "packages/avatar/DESIGN.md (13: ubicacion real del corpus)",
    "packages/avatar/package.json (exports ./runtime/* + script attribution:check)",
    "packages/avatar/scripts/check-attribution.mjs (nuevo)",
    "packages/avatar/scripts/sync-check.mjs (compara codigo + legales + vendor/)",
    "packages/avatar/src/core/{anim,config,timeline}.js (cabeceras normalizadas)",
    "packages/avatar/src/render/{projection,static,ara-head}.js (cabeceras normalizadas)",
    "packages/avatar/src/runtime/{avatar-element,extension-host,micro,presence,sound,states,pointer,fx-eyes}.js (cabeceras normalizadas)",
    "packages/avatar/src/runtime/studio-bridge.js (excepcion de tipado documentada con precision)",
    "packages/avatar/src/runtime/svg-export.js (excepcion de tipado documentada con precision)",
    "apps/desktop/renderer/floating/vendor/avatar/LICENSE.md (actualizado)",
    "apps/desktop/renderer/floating/vendor/avatar/NOTICE (reescrito)",
    "apps/desktop/renderer/floating/vendor/avatar/vendor/** (nuevo: corpus replicado)",
    "apps/desktop/renderer/floating/vendor/avatar/** (src re-sincronizado por SHA-256)",
    "docs/research/character-audit-and-coucou-inventory.md (6.4 actualizado)"
  ],
  hallazgos_resueltos: ["EGO-FIND-24 (cadena MIT ahora resoluble en el repositorio)"],
  verify: {
    tests: "266 passed / 0 failed",
    typecheck: "exit 0 (tsc --checkJs real)",
    geometry: "168/168 identicas a la golden (B4)",
    sync: "exit 0 (codigo + legales + corpus vendor/)",
    attribution: "exit 0 (5 familias -> 31 ficheros; 9 rutas de cabeceras; 0 imports desde src/)",
    build: "exit 0"
  },
  solicitudes_handoff: 4,
  solicitudes_handoff_detalle: [
    "A1: texto exacto de la excepcion de tipado para AGENTS.md (R12) — seccion 2 de este handoff",
    "A4: 4 diffs de una linea para que @ego/avatar sea el canonico (seccion 3) + validacion de la MPA del flotante",
    "A7: copiar el corpus vendor/ al artefacto distribuido (postbuild) + comprimir la golden si hace falta",
    "owner: confirmar que se archiva o no el working tree sucio de repos-referencia/avatar"
  ],
  deuda_abierta: [
    "@ego/avatar sigue huerfano (0 imports): depende de A4 (4 diffs de una linea, con validacion de la MPA del flotante)",
    "El corpus vendor/ no viaja en el artefacto distribuido: depende de A7 (postbuild)",
    "El motor sigue en JavaScript plano: la excepcion de tipado esta documentada y se cierra al migrar runtime/avatar-element.js",
    "LICENSE.md deja de ser copia byte-identica del upstream (correccion de la fila del corpus: +sound.ts)"
  ],
  SKILLS_CARGADAS: [
    "test-driven-development (TDD: 266 tests como red de seguridad antes de tocar cabeceras y corpus)",
    "systematic-debugging (causa raiz del '0 de 5 resuelven': globs y expansiones de llaves, no rutas mal escritas)",
    "documentation-and-adrs (texto de la excepcion de tipado para A1)",
    "code-review-and-quality (5 ejes; revision de la cadena legal como criterio de envio)"
  ]
}
