/**
 * E6/Ola 2 (A4) — CONTRATO EJECUTABLE del puente Ego ↔ studio.
 *
 * ## Qué es este fichero
 * La especificación, ejecutable, del contrato del puente entre el motor de
 * Ego (el vocabulario del chat, 15 estados que el renderer puede pedir) y el
 * motor del studio (el vocabulario del canvas, 26 estados).
 *
 * ## El contrato, en dos reglas
 *
 * **Regla 1 — Los 15 estados de Ego hacen el round-trip 1:1.**
 * Para todo estado `e` de Ego: `STUDIO_TO_EGO_STATE[EGO_TO_STUDIO_STATE[e]] === e`.
 * El avatar **nunca** puede mostrar un estado distinto del que el chat pidió.
 * Es la regla que el motor en SVG ya cumplía de forma nativa.
 *
 * **Regla 2 — Los 11 estados canvas-native se re-mapean al más próximo.**
 * `talk`, `bored`, `send`, `failure`, `blocked`, `surprise`, `wave`, `poke`,
 * `spin`, `box` y `love` **no nacen de un estado de Ego**: son imágenes de
 * una interacción en el canvas (un saludo, un poke, un drop de caja). Su
 * inverso va al estado de Ego más próximo.
 *
 * **Eso NO es pérdida: es diseño.** La distinción es lo que hace que la
 * señal signifique algo: "el estado que pedí se ha perdido" (bug) frente a
 * "este estado del canvas no tenía equivalente y se ha aproximado" (decisión
 * de diseño). Por eso el test enumera los dos conjuntos y comprueba que son
 * EXACTAMENTE los que el puente declara: si alguien añade un estado de Ego
 * sin su inverso, este test falla.
 *
 * ## El resto del contrato (emotes, sonidos, punteros colgantes)
 * No se reimplementa aquí: lo cubre la puerta de A6
 * (`packages/avatar/scripts/check-bridge.mjs`, `pnpm --filter @ego/avatar
 * bridge:check`), que recorre **todos** los mapas que nombran estados del
 * studio (estados, emotes y sonidos) y falla si alguno apunta a un estado
 * inexistente — el modo de fallo real, donde un puntero colgante cae al
 * `default` y pierde el estado en silencio. Este test lo **consulta** (§6)
 * para que la puerta también esté en el CI del renderer, sin duplicar su
 * lógica.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
  EGO_TO_STUDIO_STATE,
  STUDIO_TO_EGO_STATE,
  STUDIO_STATES,
  studioStateForEgo,
} from "@ego/avatar/studio";

/** Regla 1 — los 15 estados de Ego y su imagen EXACTA en el studio. */
const EGO_STATES_1TO1: readonly { ego: string; studio: string }[] = [
  { ego: "idle", studio: "idle" },
  { ego: "thinking", studio: "thinking" },
  { ego: "working", studio: "input" },
  { ego: "searching", studio: "inspect" },
  { ego: "listening", studio: "listen" },
  { ego: "waiting", studio: "waiting" },
  { ego: "success", studio: "success" },
  { ego: "finished", studio: "wake" },
  { ego: "error", studio: "error" },
  { ego: "warning", studio: "warning" },
  { ego: "ratelimit", studio: "ratelimit" },
  { ego: "approval", studio: "approval" },
  { ego: "question", studio: "question" },
  { ego: "dizzy", studio: "dizzy" },
  { ego: "sleeping", studio: "sleep" },
];

/** Regla 2 — los 11 estados canvas-native y su re-mapeo INTENCIONADO. */
const CANVAS_NATIVE: readonly { studio: string; ego: string }[] = [
  { studio: "talk", ego: "listening" },
  { studio: "bored", ego: "idle" },
  { studio: "send", ego: "waiting" },
  { studio: "failure", ego: "error" },
  { studio: "blocked", ego: "error" },
  { studio: "surprise", ego: "idle" },
  { studio: "wave", ego: "idle" },
  { studio: "poke", ego: "idle" },
  { studio: "spin", ego: "idle" },
  { studio: "box", ego: "idle" },
  { studio: "love", ego: "idle" },
];

const sorted = (xs: readonly string[]): string[] => [...xs].sort();

/**
 * Deuda de **pérdida de identidad** en el round-trip: **VACÍA**.
 *
 * Antes eran 4 (`approval`, `question`, `ratelimit`, `thinking`): el studio
 * no tenía estado propio para ellos y se caía al más próximo, que al volver
 * no recuperaba el nombre original. **La deuda está pagada** (A6, Ola 2): el
 * studio tiene ahora estado propio para los cuatro, el round-trip de los
 * **15** estados de Ego es **1:1**, y los re-mapeos que quedan son los de
 * los **11** estados canvas-native, que **no nacen de un estado de Ego** y
 * por tanto no tienen un inverso exacto que perder (es diseño, no pérdida).
 *
 * Se mantiene como lista —vacía— porque su forma ES la puerta: si alguien
 * añade un estado de Ego sin su inverso, esta lista deja de coincidir con
 * la realidad y el test falla.
 */
const KNOWN_LOSSY: readonly string[] = [];

describe("E6 — contrato del puente Ego ↔ studio", () => {
  it("el round-trip no pierde NINGÚN estado de Ego (la deuda está pagada)", () => {
    const lossy = EGO_STATES_1TO1.filter(
      ({ ego }) => STUDIO_TO_EGO_STATE[EGO_TO_STUDIO_STATE[ego]!] !== ego
    ).map((s) => s.ego);
    expect(
      lossy,
      `estados que pierden la identidad en el round-trip (deuda del puente): ${lossy.join(", ")}`
    ).toEqual([...KNOWN_LOSSY]);
  });

  it("Regla 1: los 15 estados de Ego hacen el round-trip 1:1", () => {
    for (const { ego, studio } of EGO_STATES_1TO1) {
      expect(EGO_TO_STUDIO_STATE[ego], `Ego "${ego}" no declara su imagen`).toBe(
        studio
      );
      expect(
        STUDIO_TO_EGO_STATE[studio],
        `el studio "${studio}" no declara su inverso`
      ).toBe(ego);
      expect(
        STUDIO_TO_EGO_STATE[EGO_TO_STUDIO_STATE[ego]!],
        `el round-trip de "${ego}" no conserva la identidad`
      ).toBe(ego);
    }
  });

  it("la enumeración de los estados de Ego está COMPLETA (guard de estados nuevos)", () => {
    // Si el puente gana un estado de Ego, este test falla hasta que se
    // declare aquí Y se compruebe su inverso. Sin esto, un estado nuevo
    // podría entrar sin inverso y perder la identidad en silencio.
    expect(sorted(Object.keys(EGO_TO_STUDIO_STATE))).toEqual(
      sorted(EGO_STATES_1TO1.map((s) => s.ego))
    );
  });

  it("la enumeración de los estados del studio está COMPLETA (26 = 15 + 11)", () => {
    expect(sorted(Object.keys(STUDIO_TO_EGO_STATE))).toEqual(
      sorted([
        ...EGO_STATES_1TO1.map((s) => s.studio),
        ...CANVAS_NATIVE.map((s) => s.studio),
      ])
    );
    // Y el catálogo del studio tiene exactamente esos estados.
    expect(sorted(STUDIO_STATES.map((s) => s.name))).toEqual(
      sorted(Object.keys(STUDIO_TO_EGO_STATE))
    );
  });

  it("Regla 2: los 11 estados canvas-native se re-mapean al más próximo (enumerados)", () => {
    for (const { studio, ego } of CANVAS_NATIVE) {
      expect(
        STUDIO_TO_EGO_STATE[studio],
        `el estado canvas-native "${studio}" debe re-mapear a "${ego}"`
      ).toBe(ego);
    }
  });

  it("los canvas-native NO tienen inverso exacto: es diseño, no pérdida", () => {
    // Si un estado canvas-native tuviera un inverso exacto, dejaría de ser
    // canvas-native y sería un estado de Ego con dueño: la enumeración de
    // arriba se rompería (dos conjuntos se solaparían).
    const studioWithEgoOwner = new Set(
      EGO_STATES_1TO1.map((s) => s.studio)
    );
    for (const { studio } of CANVAS_NATIVE) {
      expect(
        studioWithEgoOwner.has(studio),
        `"${studio}" está en ambos conjuntos: el contrato no está bien enumerado`
      ).toBe(false);
    }
  });

  it("`warning` y `ratelimit` tienen dueño propio (no comparten imagen)", () => {
    // Los dos avisos de Ego son imágenes DISTINTAS del studio: `warning` es
    // el cartel ámbar con "!" y `ratelimit` las barras del regulador. Si
    // compartieran imagen, uno de los dos avisos se perdería.
    expect(EGO_TO_STUDIO_STATE["warning"]).toBe("warning");
    expect(EGO_TO_STUDIO_STATE["ratelimit"]).toBe("ratelimit");
    expect(EGO_TO_STUDIO_STATE["warning"]).not.toBe(
      EGO_TO_STUDIO_STATE["ratelimit"]
    );
    expect(studioStateForEgo("warning")).toBe("warning");
    expect(studioStateForEgo("ratelimit")).toBe("ratelimit");
    expect(STUDIO_TO_EGO_STATE["warning"]).toBe("warning");
    expect(STUDIO_TO_EGO_STATE["ratelimit"]).toBe("ratelimit");
  });

  it("el puente cumple su contrato COMPLETO (estados, emotes y sonidos)", () => {
    // Puerta de A6 (`packages/avatar/scripts/check-bridge.mjs`): recorre
    // TODOS los mapas que nombran estados del studio y falla si alguno
    // apunta a un estado inexistente (el modo de fallo real: puntero
    // colgante → `default` → estado perdido en silencio).
    //
    // NO se reimplementa aquí: se consulta. Así la puerta del puente
    // también está en el CI del renderer (que corre este test) sin duplicar
    // su lógica ni su lista de reglas.
    const script = join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "packages",
      "avatar",
      "scripts",
      "check-bridge.mjs"
    );
    let out = "";
    let code = 0;
    try {
      out = execFileSync(process.execPath, [script], { encoding: "utf8" });
    } catch (err) {
      code = 1;
      out = String((err as { stdout?: string }).stdout ?? "");
    }
    expect(
      code,
      `el contrato del puente no se cumple:\n${out}\n(ejecuta: pnpm --filter @ego/avatar bridge:check)`
    ).toBe(0);
  });
});
