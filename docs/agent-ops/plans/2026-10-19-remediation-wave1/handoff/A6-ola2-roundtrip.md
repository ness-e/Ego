# Handoff A6 (Ola 2) — 2026-10-20 — Round-trip del puente Ego ⇄ studio

> Agente: **A6** · Plan: `docs/agent-ops/plans/2026-10-19-remediation-wave1/A6-avatar.md`
> Zona: `packages/avatar/**`, `apps/desktop/renderer/floating/vendor/avatar/**`,
> `docs/product/mascota.md`, `docs/product/character-art-direction.md`,
> `docs/architecture/character-system.md`, `docs/research/character-audit-and-coucou-inventory.md`
> Continuación de `handoff/A6.md` (Ola 1), `A6-ola1b.md` (Ola 1b) y
> `A6-ola2-warning.md` (estado `warning`). Sin commits.

---

## 0. Resumen ejecutivo (léase primero)

**El bug ya estaba cerrado en el árbol de trabajo antes de esta ola**, y el
diagnóstico que me llega describe un estado **intermedio** que ya no existe.

| Afirmación recibida | Estado real del repo (verificado) |
|---|---|
| «`EGO_TO_STUDIO_STATE.ratelimit = 'ratelimit'` pero ese estado de studio **no existe**» | **Falso.** `STUDIO_STATES` tiene **26** estados e **incluye `ratelimit`**. El catálogo nombra `bored` para *otra* imagen (la(canvas-native), que sigue existiendo). |
| «el catálogo real nombró `bored` para esa imagen» | **Fue verdad** en el estado intermedio (tras la ola de `warning`, antes de la ola del round-trip). Ya no: `bored` y `ratelimit` son **estados distintos**, con imágenes distintas. |
| «el round-trip pierde estados» | **Falso.** Round-trip **1:1 en los 15/15** estados de Ego. |

Lo que SÍ es cierto: **el test de A4 falla**, y falla porque **codifica la
deuda vieja como comportamiento esperado**. Eso es exactamente lo que hace
ese test (su `KNOWN_LOSSY` es la lista de estados que se perdían) — y la
deuda ya está pagada.

**Lo que pido a A4: actualizar su test (diff exacto en §6).** Es
imposible que pase sin tocarlo, y no es un defecto del arreglo: ver §5.

---

## 1. T1 — Diagnóstico completo (estado real, medido)

Cruce de las cuatro fuentes: `STATES` (15, `src/runtime/states.js`),
`STUDIO_STATES` (26, `src/studio/config.js`), `EGO_TO_STUDIO_STATE` (15) y
`STUDIO_TO_EGO_STATE` (26). Ejecutado con
`pnpm --filter @ego/avatar bridge:check` (nuevo, §4):

```text
puente Ego(15) <-> studio(26): round-trip 1:1 = 15/15 | colisiones = 0
  | estados de studio sin dueño Ego = 11
  CONTRATO CUMPLIDO
```

| Comprobación | Resultado |
|---|---|
| (a) Estado de Ego → estado de studio **inexistente** | **0** |
| (a′) Emote de Ego → estado de studio inexistente (`EGO_TO_STUDIO_EMOTE`) | **0** |
| (a″) Sonido de Ego → sonido de studio inexistente (`EGO_SOUND_TO_STUDIO_SOUND`) | **0** |
| (b) Estados de studio **huérfanos** (sin dueño Ego) | **11**: `talk`, `bored`, `send`, `failure`, `blocked`, `surprise`, `wave`, `poke`, `spin`, `box`, `love` |
| (c) **Colisiones** (dos estados Ego → el mismo studio) | **0** |
| (d) Inverso que **no** devuelve el original | **0** |
| (e) Estado de studio **sin inverso** | **0** |
| (f) **Round-trip 1:1** | **15/15** |

### Tabla de estados (completa)

| # | Ego (15) | → studio | → Ego | | # | Studio (26) | → Ego |
|--:|---|---|---|---|--:|---|---|
| 1 | `idle` | `idle` | `idle` ✔ | | 1 | `idle` | `idle` |
| 2 | `thinking` | `thinking` | `thinking` ✔ | | 2 | `talk` | `listening` (huérfano) |
| 3 | `working` | `input` | `working` ✔ | | 3 | `bored` | `idle` (huérfano) |
| 4 | `searching` | `inspect` | `searching` ✔ | | 4 | `waiting` | `waiting` |
| 5 | `listening` | `listen` | `listening` ✔ | | 5 | `input` | `working` |
| 6 | `waiting` | `waiting` | `waiting` ✔ | | 6 | `send` | `waiting` (huérfano) |
| 7 | `success` | `success` | `success` ✔ | | 7 | `success` | `success` |
| 8 | `finished` | `wake` | `finished` ✔ | | 8 | `failure` | `error` (huérfano) |
| 9 | `error` | `error` | `error` ✔ | | 9 | `warning` | `warning` |
| 10 | `warning` | `warning` | `warning` ✔ | | 10 | `inspect` | `searching` |
| 11 | `ratelimit` | `ratelimit` | `ratelimit` ✔ | | 11 | `blocked` | `error` (huérfano) |
| 12 | `approval` | `approval` | `approval` ✔ | | 12 | `error` | `error` |
| 13 | `question` | `question` | `question` ✔ | | 13 | `surprise` | `idle` (huérfano) |
| 14 | `dizzy` | `dizzy` | `dizzy` ✔ | | 14 | `sleep` | `sleeping` |
| 15 | `sleeping` | `sleep` | `sleeping` ✔ | | 15 | `wake` | `finished` |
| | | | | | 16 | `wave` | `idle` (huérfano) |
| | | | | | 17 | `poke` | `idle` (huérfano) |
| | | | | | 18 | `dizzy` | `dizzy` |
| | | | | | 19 | `spin` | `idle` (huérfano) |
| | | | | | 20 | `box` | `idle` (huérfano) |
| | | | | | 21 | `listen` | `listening` |
| | | | | | 22 | `love` | `idle` (huérfano) |
| | | | | | 23 | `thinking` | `thinking` |
| | | | | | 24 | `approval` | `approval` |
| | | | | | 25 | `question` | `question` |
| | | | | | 26 | `ratelimit` | `ratelimit` |

### La causa raíz original (para el registro)

El mapa inverso sólo puede devolver **un** estado de Ego por estado de studio,
así que **toda imagen de studio compartida por dos estados de Ego hace que uno
se pierda**:

| Estado de studio | Lo reclamaban | Se perdía |
|---|---|---|
| `waiting` | `thinking`, `waiting`, `approval` | `thinking`, `approval` |
| `inspect` | `searching`, `question` | `question` |
| `bored` | `ratelimit` (mapeado en la ola de `warning` para liberar la imagen `warning`) | `ratelimit` |

Las tres primeras pérdidas eran **preexistentes**; la cuarta la introdujo la
ola de `warning`. Todas están pagadas.

---

## 2. T2 — Desenlace: 1:1 con estados de studio propios

**Opción 1 (preferida por el encargo): renombrar `bored` → `ratelimit`.**
**Evaluada y DESCARTADA**, con evidencia: `bored` tiene **cuatro usos** que
romperían al renombrarlo.

| Uso de `bored` | Se rompe si se renombra |
|---|---|
| `EGO_TO_STUDIO_EMOTE.yawn = 'bored'` (el emote del bostezo) | el emote `yawn` apuntaría a un estado inexistente → **nuevo puntero colgante**, justo el patrón de bug que hay que cerrar |
| `studio/avatar.js` → `case 'bored'` (voz «Qué aburrimiento…») | el estado canvas-native desaparece del vocabulario del studio |
| `studio/render/overlays.js` → rama compartida `failure`/`bored` (gota de sudor) | la gota quedaría sin nombre |
| `STATE_ACCENT.bored = '#818cf8'` | el color quedaría sin nombre |

Renombrar un estado **preexistente** del studio para alojar el `ratelimit`
de Ego no es alinear: es **sustituir** el vocabulario del canvas por el de
Ego, y rompe el emote del bostezo.

**Opción 2 (adoptada): añadir los estados de studio que faltan.** Se
añadieron **cuatro** estados de studio —`thinking`, `approval`, `question`,
`ratelimit`— cada uno con **color, imagen de geometría propia (D4) y sonido
propios**. El studio pasa de 22 a **26** estados, y los 11 estados
canvas-native siguen siendo canvas-native (nadie los renombra, nadie se rompe).

| Estado de studio | Color | Imagen (geometría de Ego) | Sonido |
|---|---|---|---|
| `thinking` | `#a78bfa` violeta | arco girando, arriba a la izquierda | 2 tonos ascendentes |
| `approval` | `#fb923c` naranja | anillos concéntricos que rodean el cuerpo | 2 pulsos |
| `question` | `#2dd4bf` turquesa | cartel «?» arriba a la derecha | tono ascendente |
| `ratelimit` | `#facc15` amarillo | barras de regulador debajo del visor | 2 tonos descendentes |

**Opción 3 (no aplica):** no hay ambigüedad real entre estados de Ego —
cada uno tiene ahora color e imagen propios, y un test lo comprueba
comparando la **traza de operaciones de canvas** del overlay de cada estado.

**Efecto colateral bueno (deuda cerrada de paso).** El acento por estado
estaba **replicado en tres módulos** (`render/overlays.js`, `render/eyes.js`,
`render/helpers.js`): tres `switch` idénticos que había que mantener
sincronizados a mano y que se habrían desincronizado al añadir un estado
(un bug silencioso de color). Ahora hay **una fuente**, `STATE_ACCENT` en
`src/studio/config.js`, y los tres la reexportan.

---

## 3. Tabla antes/después del round-trip

| Estado de Ego | Antes: studio → vuelta | | Después: studio → vuelta | |
|---|---|---|---|---|
| `idle` | `idle` → `idle` | ✔ | `idle` → `idle` | ✔ |
| `thinking` | `waiting` → `waiting` | ✘ | `thinking` → `thinking` | ✔ |
| `working` | `input` → `working` | ✔ | `input` → `working` | ✔ |
| `searching` | `inspect` → `searching` | ✔ | `inspect` → `searching` | ✔ |
| `listening` | `listen` → `listening` | ✔ | `listen` → `listening` | ✔ |
| `waiting` | `waiting` → `waiting` | ✔ | `waiting` → `waiting` | ✔ |
| `success` | `success` → `success` | ✔ | `success` → `success` | ✔ |
| `finished` | `wake` → `finished` | ✔ | `wake` → `finished` | ✔ |
| `error` | `error` → `error` | ✔ | `error` → `error` | ✔ |
| `warning` | `warning` → `warning` | ✔ | `warning` → `warning` | ✔ |
| `ratelimit` | `bored` → `idle` | ✘ | `ratelimit` → `ratelimit` | ✔ |
| `approval` | `waiting` → `waiting` | ✘ | `approval` → `approval` | ✔ |
| `question` | `inspect` → `searching` | ✘ | `question` → `question` | ✔ |
| `dizzy` | `dizzy` → `dizzy` | ✔ | `dizzy` → `dizzy` | ✔ |
| `sleeping` | `sleep` → `sleeping` | ✔ | `sleep` → `sleeping` | ✔ |

**11/15 → 15/15.**

---

## 4. La puerta que faltaba (nueva, permanente)

`packages/avatar/scripts/check-bridge.mjs` →
`pnpm --filter @ego/avatar bridge:check`.

Comprueba **TODOS** los mapas que nombran estados del studio, no sólo el de
estados: el de estados, el de **emotes** y el de **sonidos**. Es
justamente el modo de fallo que casi.me salta: un mapa directo que nombra un
estado inexistente hace que el motor caiga a un `default` y **pierda el estado
en silencio**, sin error ni aviso.

Añadido además a `tests/studio-roundtrip.test.js` (8 casos, uno nuevo: «ningún
mapa del puente nombra un estado de studio inexistente»).

---

## 5. Estado del test del renderer (A4) — y por qué no puede pasar sin tocarlo

`apps/desktop/renderer/test/avatar-studio-roundtrip.test.ts` (zona de A4).
Medido contra el motor actual:

| Test de A4 | Qué asserta | Resultado actual | Motivo |
|---|---|---|---|
| 1. `warning` hace el round-trip perfecto | `studioStateForEgo("warning") === "warning"` y vuelve a `"warning"` | ✔ **verde** | — |
| 2. el round-trip no pierde ningún estado NUEVO | `lossy` debe ser exactamente `KNOWN_LOSSY` = `[approval, question, ratelimit, thinking]` | ❌ **rojo** | `lossy` es ahora **`[]`**: los 4 están pagados. La lista de deuda debe quedar vacía. |
| 3. `warning` NO está entre los con pérdida | `lossy` no contiene `"warning"` | ✔ **verde** | — |
| 4. la pérdida de `ratelimit` es la documentada (`bored` → `idle`) | `studioStateForEgo("ratelimit") === "bored"` | ❌ **rojo** (en la **primera** aserción) | Ahora es `"ratelimit"` (existe y vuelve a sí mismo). La segunda aserción (`bored` → `"idle"`) **sigue verde**. |

**Por qué no puede pasar sin tocarse.** El test 2 asserta que el conjunto de
estados con pérdida es *exactamente* la lista de deuda. Cualquier arreglo que
elimine las pérdidas hace que ese conjunto sea `[]` y la aserción falle: el
test **codifica la deuda como comportamiento esperado**, que es justo lo que
hace (su propósito es "dejar visible" la pérdida). Pagar la deuda implica
que la lista se vacíe. No existe implementación que satisfaga a la vez
«el round-trip es 1:1» y «`lossy` contiene esos 4 estados».

→ **A4 debe actualizar su test.** Diff exacto en §6.

---

## 6. Diff exacto para A4 (`apps/desktop/renderer/test/avatar-studio-roundtrip.test.ts`)

```diff
--- a/apps/desktop/renderer/test/avatar-studio-roundtrip.test.ts
+++ b/apps/desktop/renderer/test/avatar-studio-roundtrip.test.ts
@@ -38,10 +38,10 @@
  * "question" | "success" | "finished" | "error" | "ratelimit" |
  * "sleeping" | "dizzy" | "warning",
  ];
  
-/** Deuda DECLARADA (zona de A6): estados que pierden identidad al volver. */
-const KNOWN_LOSSY: readonly string[] = [
-  "approval",
-  "question",
-  "ratelimit",
-  "thinking",
-];
+/**
+ * Deuda DECLARADA (zona de A6): estados que pierden identidad al volver.
+ *
+ * VACÍA desde la Ola 2: A6 pagó la deuda del round-trip (era de 4 estados:
+ * thinking, approval, question y ratelimit). El puente ahora es 1:1 en los
+ * 15 estados de Ego, verificado por `pnpm --filter @ego/avatar bridge:check`.
+ *
+ * Se mantiene la lista (y este test) como GUARD: si alguien vuelve a
+ * compartir una imagen de studio entre dos estados de Ego, el round-trip
+ * vuelve a perder identidad y el guard salta.
+ */
+const KNOWN_LOSSY: readonly string[] = [];
 
 describe("E6 - round-trip del estado por el puente del studio", () => {
   it("`warning` hace el round-trip PERFECTO (Ego → studio → Ego)", () => {
```

```diff
@@ -100,14 +100,14 @@
     ).not.toContain("warning");
   });
 
-  it("la pérdida de `ratelimit` es la documentada por A6 (bored → idle)", () => {
-    // Verificado, no supuesto: el studio no tiene estado de "límite de
-    // peticiones", así que `ratelimit` viaja como `bored` (cansado) y vuelve
-    // como `idle`. Es la degradación que A6 dejó documentada en su handoff
-    // §2 y que este test hace visible.
-    expect(studioStateForEgo("ratelimit")).toBe("bored");
-    expect(STUDIO_TO_EGO_STATE["bored"]).toBe("idle");
+  it("`ratelimit` hace el round-trip PERFECTO (Ego → studio → Ego)", () => {
+    // El studio tiene su propio estado `ratelimit` (barras de regulador),
+    // añadido por A6 en la Ola 2 para que el round-trip fuese 1:1. Antes
+    // `ratelimit` viajaba como `bored` y volvía como `idle`: se perdía.
+    expect(studioStateForEgo("ratelimit")).toBe("ratelimit");
+    expect(STUDIO_TO_EGO_STATE["ratelimit"]).toBe("ratelimit");
+    // `bored` sigue siendo un estado nativo del canvas (sin dueño Ego):
+    // el emote del bostezo lo usa, y por eso NO se renombró.
+    expect(STUDIO_TO_EGO_STATE["bored"]).toBe("idle");
   });
 });
```

**Los tests 1, 2 y 3 no necesitan más cambios** (con `KNOWN_LOSSY = []` el test
2 pasa tal cual). El test 4 pasa con el diff de arriba.

**Nota para A4:** el studio pasó de **22 a 26** estados. Si su test afirma
sobre el **número** de estados del studio, ese número hay que actualizarlo.

---

## 7. Delta de la golden

**174 → 231** combinaciones (de 29 estados × 6 módulos a **33 × 7**).

Dos cambios:

1. **Se añadió el módulo `overlays` a la traza** (7 casos en vez de 6). Antes
   la golden **no cubría la imagen de los estados**: el overlay es
   precisamente lo que distingue visualmente a dos estados, así que una
   regresión en él habría pasado desapercibida.
2. **Se añadieron 4 combos** para los estados de studio nuevos
   (`studio-thinking`, `studio-approval`, `studio-question`,
   `studio-ratelimit`).

**Prueba de que las 174 anteriores no cambiaron** (diff traza a traza):

```text
  antes: 174  ahora: 231
  anadidas: 57   eliminadas: 0   PREEISTENTES MODIFICADAS: 0
```

Las 57 añadidas = 33 overlays (uno por estado previo) + 4 combos × 7 módulos.
**Cero** preexistentes modificadas: la consolidación del acento y los estados
nuevos no alteraron la geometría de lo que ya existía.

El mecanismo sigue siendo **determinista** (traza de operaciones de canvas),
no una comparación de píxeles: se midió hasta un 12 % de ruido entre sesiones
de navegador con el mismo código.

---

## 8. T3 — Verificación

| Comando | Exit | Resumen |
|---|---|---|
| `node --test packages/avatar/tests/` | **0** | **282 pass / 0 fail** (274 + 8 nuevos) |
| `pnpm --filter @ego/avatar typecheck` | **0** | `tsc -p tsconfig.json`, 0 errores |
| `pnpm --filter @ego/avatar build` | **0** | 50 ficheros en `dist/` + manifiesto SHA-256 |
| `pnpm --filter @ego/avatar build:check` | **0** | `dist/` al día |
| `node packages/avatar/scripts/compare-geometry.mjs --check …` | **0** | **231/231** combinaciones idénticas |
| `node packages/avatar/scripts/check-bridge.mjs` | **0** | **CONTRATO CUMPLIDO**: 0 targets inexistentes, 0 colisiones, 15/15 round-trip |
| `node packages/avatar/scripts/sync-check.mjs` | **0** | SIN DRIFT (código + legales + corpus) |
| `node packages/avatar/scripts/check-attribution.mjs` | **0** | cadena MIT resoluble |

---

## 9. Ficheros tocados en esta ola

| Fichero | Cambio |
|---|---|
| `packages/avatar/scripts/check-bridge.mjs` | **nuevo** — puerta del contrato del puente (estados + emotes + sonidos) |
| `packages/avatar/package.json` | script `bridge:check` |
| `packages/avatar/tests/studio-roundtrip.test.js` | +1 caso: «ningún mapa del puente nombra un estado de studio inexistente» (8 casos) |
| `packages/avatar/src/studio/adapter.js` | contrato escrito con precisión: qué garantiza, qué NO cubre (los 11 canvas-native) y cómo se verifica |
| `packages/avatar/README.md` · `DESIGN.md` | contrato real + las tres puertas (`bridge:check`, test, golden) + por qué hacía falta una puerta aparte |
| `docs/research/character-audit-and-coucou-inventory.md` | §6.5 con la puerta nueva y la lista de huérfanos |
| `apps/desktop/renderer/floating/vendor/avatar/**` | re-sincronizado (SHA-256) |

*(Los cambios de la ola del round-trip propiamente dicha —4 estados de studio,
mapas, imágenes, sonidos, golden 174→231— ya estaban aplicados y verificados;
esta ola añade la puerta permanente, afina la documentación y prepara el diff
para A4.)*

---

## 10. Deuda / no resuelto

| # | Deuda | Dónde |
|---|---|---|
| 1 | **El test de A4 sigue fallando** hasta que aplique el diff de §6 (2 líneas + 1 test reescrito). Motivo exacto en §5: el test codifica la deuda vieja como comportamiento esperado; pagar la deuda obliga a vaciar `KNOWN_LOSSY`. | **A4** |
| 2 | Los 11 estados de studio canvas-native (`talk`, `bored`, `send`, `failure`, `blocked`, `surprise`, `wave`, `poke`, `spin`, `box`, `love`) no tienen estado de Ego propio: el inverso los lleva al más próximo. Intencionado, no una pérdida. | — (documentado) |
| 3 | El **motor SVG** (15 estados) no está cubierto por la golden: la golden traza el motor canvas. La forma del SVG la fijan los tests unitarios. | Ola 2 (opcional) |
| 4 | `AGENTS.md` dice que el `any` del puente "está justificado en `packages/avatar/index.d.ts`"; la justificación vive en `src/runtime/studio-bridge.js` y `src/runtime/svg-export.js`. | **A1** |

---

RESULTADO: {
  agente: A6-avatar-ola2-roundtrip,
  status: COMPLETED,
  archivos_modificados: [
    "packages/avatar/scripts/check-bridge.mjs (nuevo: puerta del contrato del puente)",
    "packages/avatar/package.json (script bridge:check)",
    "packages/avatar/tests/studio-roundtrip.test.js (8 casos: + el de mapas colgantes)",
    "packages/avatar/src/studio/adapter.js (contrato escrito con precision)",
    "packages/avatar/README.md (contrato real + las tres puertas)",
    "packages/avatar/DESIGN.md (8c-bis: contrato, excepciones y puertas)",
    "docs/research/character-audit-and-coucou-inventory.md (6.5: puerta nueva y huerfanos)",
    "apps/desktop/renderer/floating/vendor/avatar/** (re-sincronizado por SHA-256)"
  ],
  hallazgos_resueltos: [
    "round-trip Ego->studio->Ego: 15/15 en 1:1 (antes 11/15)",
    "puerta permanente que detecta el patron de bug real: un mapa que nombra un estado de studio inexistente"
  ],
  verify: {
    tests: "282 passed / 0 failed (274 + 8 nuevos)",
    typecheck: "exit 0 (tsc --checkJs real)",
    geometry: "231/231 identicas a la golden (174 -> 231, 0 preexistentes modificadas)",
    bridge: "exit 0 (0 targets inexistentes, 0 colisiones, 15/15 round-trip)",
    sync: "exit 0 (codigo + legales + corpus)",
    attribution: "exit 0",
    build: "exit 0"
  },
  solicitudes_handoff: 2,
  solicitudes_handoff_detalle: [
    "A4: actualizar avatar-studio-roundtrip.test.ts (diff exacto en la seccion 6): KNOWN_LOSSY pasa a [] y el test 4 se reescribe a 'ratelimit hace el round-trip perfecto'. NO puede pasar sin tocarse: asserta que el conjunto de estados con perdida sea exactamente la lista de deuda, de modo que pagar la deuda lo hace fallar. Ademas, el studio paso de 22 a 26 estados.",
    "A1: corregir en AGENTS.md la ubicacion de la justificacion del `any` (esta en src/runtime/studio-bridge.js y src/runtime/svg-export.js, no en index.d.ts)"
  ],
  deuda_abierta: [
    "El test del renderer (A4) sigue en rojo hasta que aplique el diff de la seccion 6",
    "Los 11 estados de studio canvas-native no tienen estado de Ego propio por diseno",
    "El motor SVG no esta cubierto por la golden (que traza el canvas); lo fijan los tests unitarios"
  ],
  SKILLS_CARGADAS: [
    "systematic-debugging (el diagnostico recibido describia un estado intermedio: se verifico contra los ficheros antes de tocar nada)",
    "test-driven-development (el caso de mapas colgantes cubre el patron de bug, no solo el sintoma)",
    "code-review-and-quality (5 ejes; la puerta de contrato como criterio de envio)"
  ]
}
