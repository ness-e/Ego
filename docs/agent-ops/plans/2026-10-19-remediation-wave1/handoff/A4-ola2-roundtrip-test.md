# A4 — Ola 2 · El contrato del puente Ego ↔ studio (test actualizado)

> **Agente:** A4 · **Zona de escritura:** `apps/desktop/**` (EXCEPTO `apps/desktop/renderer/floating/vendor/avatar/**` → A6).
> **Tarea:** actualizar la línea base del contrato del round-trip tras la **deuda pagada** por A6 (el round-trip pasó de 11/15 a **15/15 en 1:1**).
> **Fecha:** 2026-10-20 · **Commits:** ninguno (árbol sucio a propósito, por instrucción del owner).
> **Entrada:** el diagnóstico de A6 (la premisa que me dio era incorrecta y A6 la verificó) + `A4-ola2-warning.md` §4.

---

## 1. El diagnóstico, verificado (no asumido)

A6 tenía razón en que **mi test codificaba como esperado un comportamiento que ya no existe**. Medido sobre el puente actual (`packages/avatar/src/studio/adapter.js`):

| | Antes de A6 | Ahora |
|---|---|---|
| Round-trip Ego → studio → Ego | 11/15 (4 con pérdida) | **15/15 en 1:1** ✅ |
| `ratelimit` | `bored` → `idle` (pérdida) | `ratelimit` → `ratelimit` (1:1) ✅ |
| `thinking` | `waiting` → `waiting` (pérdida) | `thinking` → `thinking` (1:1) ✅ |
| `approval` | `waiting` → `waiting` (pérdida) | `approval` → `approval` (1:1) ✅ |
| `question` | `inspect` → `searching` (pérdida) | `question` → `question` (1:1) ✅ |

**RED (el test viejo contra el puente nuevo):**

```
❯ test/avatar-studio-roundtrip.test.ts (4 tests | 2 failed)
  AssertionError: estados con pérdida de identidad en el round-trip (deuda de A6 en packages/avatar): : expected [] to deeply equal [ 'approval', 'question', …(2) ]
  AssertionError: expected 'ratelimit' to be 'bored' // Object.is equality
 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)
```

A6 lo dijo mejor que yo: *"es matemáticamente imposible que pase sin tocarlo: no existe implementación que satisfaga a la vez «el round-trip es 1:1» y «`lossy` contiene esos 4 estados»"*. Mi test **hacía bien su trabajo** (dejar la pérdida visible); lo que estaba mal era su **línea base**, que describía una deuda ya pagada.

**Mi test tenía razón** en lo esencial: la pérdida debía ser visible. Ahora la pérdida es 0, así que la línea base debe reflejarlo — **y el guard debe seguir siendo capaz de detectar una pérdida futura.**

---

## 2. El diff aplicado

### 2.1 `apps/desktop/renderer/test/avatar-studio-roundtrip.test.ts`

**La línea (la que pedía el brief):**

```diff
-const KNOWN_LOSSY: readonly string[] = [
-  "approval",
-  "question",
-  "ratelimit",
-  "thinking",
-];
+/**
+ * Deuda de **pérdida de identidad** en el round-trip: **VACÍA**.
+ *
+ * Antes eran 4 (`approval`, `question`, `ratelimit`, `thinking`): el studio
+ * no tenía estado propio para ellos y se caía al más próximo, que al volver
+ * no recuperaba el nombre original. **La deuda está pagada** (A6, Ola 2): el
+ * studio tiene ahora estado propio para los cuatro, el round-trip de los
+ * **15** estados de Ego es **1:1**, y los re-mapeos que quedan son los de
+ * los **11** estados canvas-native, que **no nacen de un estado de Ego** y
+ * por tanto no tienen un inverso exacto que perder (es diseño, no pérdida).
+ *
+ * Se mantiene como lista —vacía— porque su forma ES la puerta: si alguien
+ * añade un estado de Ego sin su inverso, esta lista deja de coincidir con
+ * la realidad y el test falla.
+ */
+const KNOWN_LOSSY: readonly string[] = [];
```

**El test 4, reescrito** (de "la pérdida de `ratelimit` es la documentada por A6 (bored → idle)" a la regla de diseño):

```diff
-  it("la pérdida de `ratelimit` es la documentada por A6 (bored → idle)", () => {
-    expect(studioStateForEgo("ratelimit")).toBe("bored");
-    expect(STUDIO_TO_EGO_STATE["bored"]).toBe("idle");
-  });
+  it("Regla 2: los 11 estados canvas-native se re-mapean al más próximo (enumerados)", () => {
+    for (const { studio, ego } of CANVAS_NATIVE) {
+      expect(
+        STUDIO_TO_EGO_STATE[studio],
+        `el estado canvas-native "${studio}" debe re-mapear a "${ego}"`
+      ).toBe(ego);
+    }
+  });
+
+  it("los canvas-native NO tienen inverso exacto: es diseño, no pérdida", () => {
+    const studioWithEgoOwner = new Set(EGO_STATES_1TO1.map((s) => s.studio));
+    for (const { studio } of CANVAS_NATIVE) {
+      expect(
+        studioWithEgoOwner.has(studio),
+        `"${studio}" está en ambos conjuntos: el contrato no está bien enumerado`
+      ).toBe(false);
+    }
+  });
```

**Los guards que faltaban** (T4: *"si alguien añade un estado sin su inverso, el test falla"*). Con solo `KNOWN_LOSSY = []` el test no detectaría un estado nuevo sin inverso; hacen falta las **enumeraciones completas**:

```diff
+  it("la enumeración de los estados de Ego está COMPLETA (guard de estados nuevos)", () => {
+    expect(sorted(Object.keys(EGO_TO_STUDIO_STATE))).toEqual(
+      sorted(EGO_STATES_1TO1.map((s) => s.ego))
+    );
+  });
+
+  it("la enumeración de los estados del studio está COMPLETA (26 = 15 + 11)", () => {
+    expect(sorted(Object.keys(STUDIO_TO_EGO_STATE))).toEqual(
+      sorted([
+        ...EGO_STATES_1TO1.map((s) => s.studio),
+        ...CANVAS_NATIVE.map((s) => s.studio),
+      ])
+    );
+    expect(sorted(STUDIO_STATES.map((s) => s.name))).toEqual(
+      sorted(Object.keys(STUDIO_TO_EGO_STATE))
+    );
+  });
```

**La consulta de la puerta de A6** (T2: *no la reimplemento, la consulto*):

```diff
+  it("el puente cumple su contrato COMPLETO (estados, emotes y sonidos)", () => {
+    // Puerta de A6 (`packages/avatar/scripts/check-bridge.mjs`): recorre
+    // TODOS los mapas que nombran estados del studio y falla si alguno
+    // apunta a un estado inexistente (el modo de fallo real: puntero
+    // colgante → `default` → estado perdido en silencio).
+    //
+    // NO se reimplementa aquí: se consulta. Así la puerta del puente
+    // también está en el CI del renderer (que corre este test) sin duplicar
+    // su lógica ni su lista de reglas.
+    const script = join(__dirname, "..", "..", "..", "..", "packages", "avatar", "scripts", "check-bridge.mjs");
+    let out = "";
+    let code = 0;
+    try {
+      out = execFileSync(process.execPath, [script], { encoding: "utf8" });
+    } catch (err) {
+      code = 1;
+      out = String((err as { stdout?: string }).stdout ?? "");
+    }
+    expect(
+      code,
+      `el contrato del puente no se cumple:\n${out}\n(ejecuta: pnpm --filter @ego/avatar bridge:check)`
+    ).toBe(0);
+  });
```

### 2.2 `apps/desktop/renderer/src/avatar-studio.d.ts`

Un tipo más en la declaración ambiental (el test necesita el catálogo del studio):

```diff
 declare module "@ego/avatar/studio" {
+  /** Catálogo de estados del studio (26: 15 con dueño de Ego + 11 canvas-native). */
+  export const STUDIO_STATES: ReadonlyArray<{ name: string; label: string; emoji: string }>;
   export const EGO_TO_STUDIO_STATE: Readonly<Record<string, string>>;
```

---

## 3. El contrato resultante, en prosa

El puente entre el motor de Ego (el vocabulario del chat: **15** estados que el renderer puede pedir) y el motor del studio (el vocabulario del canvas: **26** estados) se rige por **dos reglas** y no por una.

**Regla 1 — Los 15 estados de Ego hacen el round-trip 1:1.**
Para todo estado `e` de Ego: `STUDIO_TO_EGO_STATE[EGO_TO_STUDIO_STATE[e]] === e`. El avatar **nunca** puede mostrar un estado distinto del que el chat pidió. Los 15 con su imagen exacta:

| Ego | studio | Ego | studio | Ego | studio |
|---|---|---|---|---|---|
| `idle` | `idle` | `success` | `success` | `warning` | `warning` |
| `thinking` | `thinking` | `finished` | `wake` | `ratelimit` | `ratelimit` |
| `working` | `input` | `error` | `error` | `approval` | `approval` |
| `searching` | `inspect` | `dizzy` | `dizzy` | `question` | `question` |
| `listening` | `listen` | `sleeping` | `sleep` | | |
| `waiting` | `waiting` | | | | |

**Regla 2 — Los 11 estados canvas-native se re-mapean al más próximo, A PROPÓSITO.**
`talk`, `bored`, `send`, `failure`, `blocked`, `surprise`, `wave`, `poke`, `spin`, `box` y `love` **no nacen de un estado de Ego**: son imágenes de una interacción en el canvas (un saludo, un poke, un drop de caja). Su inverso va al estado de Ego más próximo:

| studio | → Ego | studio | → Ego | studio | → Ego | studio | → Ego |
|---|---|---|---|---|---|---|---|
| `talk` | `listening` | `failure` | `error` | `poke` | `idle` | `box` | `idle` |
| `bored` | `idle` | `blocked` | `error` | `spin` | `idle` | `love` | `idle` |
| `send` | `waiting` | `surprise` | `idle` | `wave` | `idle` | | |
| | | | | | | | | |

**Eso NO es pérdida: es diseño.** Y esa distinción es lo que hace que la señal signifique algo: *"el estado que pedí se ha perdido"* (bug) frente a *"este estado del canvas no tenía equivalente y se ha aproximado"* (decisión de diseño). Por eso el test **enumera los dos conjuntos** y comprueba que son exactamente los que el puente declara, y que **no se solapan** (si un canvas-native tuviera un inverso exacto, dejaría de serlo y los conjuntos se pisarían).

**El resto del contrato — emotes (11), sonidos (28) y punteros colgantes — NO se reimplementa en mi test**: lo cubre la puerta de A6 (`packages/avatar/scripts/check-bridge.mjs`, `pnpm --filter @ego/avatar bridge:check`), que recorre **todos** los mapas que nombran estados del studio y falla si alguno apunta a un estado inexistente — el modo de fallo real, donde un puntero colgante cae al `default` y **pierde el estado en silencio**. Mi test lo **consulta** (lo ejecuta y exige exit 0), de modo que la puerta también queda dentro del CI del renderer sin duplicar su lógica ni su lista de reglas.

---

## 4. TDD: el RED y el GREEN del diff de una línea

**RED** — el test **nuevo** (con los guards de enumeración ya en su sitio) y la **línea base vieja**:

```
línea base VIEJA aplicada (para el RED)
❯ test/avatar-studio-roundtrip.test.ts (8 tests | 1 failed)
  AssertionError: estados que pierden la identidad en el round-trip (deuda del puente): : expected [] to deeply equal [ 'approval', 'question', …(2) ]
 Test Files  1 failed (1)
      Tests  1 failed | 7 passed (8)
```

**GREEN** — con la línea base nueva:

```
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

(La demostración se hizo parcheando la constante, ejecutando y **restaurando** el fichero; no hay leftovers.)

---

## 5. Verificación

| Comprobación | Resultado |
|---|---|
| `pnpm --filter @ego/renderer test` | **70 ficheros / 493 tests, TODOS en verde** (antes de esta tarea: 70 / 489 → **+4 tests**) |
| `pnpm --filter @ego/renderer exec tsc --noEmit` | **exit 0** |
| `pnpm -r typecheck` | **exit 0** |
| `pnpm lint` | **exit 0** |
| `pnpm --filter @ego/avatar bridge:check` (consultado por mi test) | **exit 0** — *"puente Ego(15) ↔ studio(26): round-trip 1:1 = 15/15 \| colisiones = 0 \| estados de studio sin dueño Ego = 11"* |

**Recuento de tests del renderer: 489 → 493** (el fichero pasó de 4 a 8 tests: los 4 anteriores, con la línea base y el test 4 reescritos, más 4 guards nuevos de enumeración/completitud).

---

## 6. Ficheros tocados

| Fichero | Cambio |
|---|---|
| `renderer/test/avatar-studio-roundtrip.test.ts` | Línea base `[]` + test 4 reescrito + 4 guards de enumeración/completitud + la consulta de la puerta de A6. De 4 a 8 tests. |
| `renderer/src/avatar-studio.d.ts` | Un tipo más (`STUDIO_STATES`) en la declaración ambiental. |

**No tocado:** `packages/avatar/**` (A6) · `packages/avatar/scripts/check-bridge.mjs` (**A6**: solo se *consulta*, no se edita) · `scripts/**` (A7) · `docs/**` (A1) · `.github/**` · raíz.

---

## 7. Nota para A7 (si el contrato del puente cambiara de forma)

Mi test **consulta** `packages/avatar/scripts/check-bridge.mjs` con `execFileSync(process.execPath, [script])` y exige exit 0. Si A6 moviera ese script o cambiara su CLI, mi test necesita **una línea** de actualización (la ruta). No edito `scripts/**` (zona de A7) ni `packages/avatar/**` (zona de A6) por eso.

---

## 8. Checklist del DoD

- [x] **T1**: línea base `KNOWN_LOSSY = []` con el comentario que explica por qué ahora es vacía; test 4 reescrito (round-trip perfecto de `ratelimit` + los 11 canvas-native re-mapeados **enumerados**).
- [x] **T2**: la puerta de A6 (`bridge:check`) **se consulta**, no se reimplementa (ni emotes ni sonidos ni punteros colgantes).
- [x] **T3**: RED demostrado (línea base vieja → 1 fallo) y GREEN (8/8); suite del renderer verde; `pnpm -r typecheck` exit 0; `pnpm lint` exit 0.
- [x] **T4**: el test queda como la especificación ejecutable del contrato: 15 estados de Ego 1:1, 11 canvas-native con re-mapeo enumerado, enumeraciones **completas** (un estado nuevo sin inverso → el test falla), emotes y sonidos por `bridge:check`.
- [x] Sin commits · sin `git checkout/reset/stash/clean` · sin `pnpm install`.
- [x] No tocado: `packages/**` · `docs/**` · `scripts/**` · `.github/**` · raíz.
