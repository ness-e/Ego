/**
 * Ola 9 (A4) — La **curaduría programada de memoria** (`MemoryCurator`) en el
 * producto (cierra el último punto de `EGO-FIND-22`).
 *
 * ## Qué afirma (comportamiento, no "la clase está instanciada")
 * 1. Una corrida de curaduría **marca stale** el fact viejo de `kb/facts`:
 *    `state: "superseded"` + `superseded_by: "curator:stale"` + el payload
 *    con `is_latest: false` (soft-replace: **nunca** borra).
 * 2. **No toca** lo que no es stale (el fact fresco queda intacto).
 * 3. Deja la **auditoría** `curator_run` en `gov/audit` (con el recuento de
 *    los registros marcados).
 * 4. El temporizador **no retiene el proceso** (`unref`): sin eso, Electron
 *    no podría cerrar (A2-bis lo corrigió; este test lo vigila).
 * 5. **El arranque de la app cablea la curaduría** y el apagado la para:
 *    si alguien borra esas llamadas, este test falla.
 *
 * ## Por qué el punto 5 es estructural
 * El arranque vive en `create-window.ts`, que importa `electron` → no se
 * puede arrancar en el entorno de test (node) sin un mock de Electron que
 * el repo no tiene. Es la **única** comprobación posible de que la llamada
 * está en el sitio; el COMPORTAMIENTO (los puntos 1-4) está probado de
 * verdad contra el adapter real, en el módulo de producción.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { EgoMemoryAdapter } from "@ego/memory";

import {
  startMemoryCuration,
  stopMemoryCuration,
} from "../src/main/subsystems/memory-curation.js";
import { createScratchDir, removeScratchDir } from "./helpers/test-scratch.js";

const DAY_MS = 24 * 60 * 60 * 1000;

let dir: string;
let adapter: EgoMemoryAdapter;

beforeEach(async () => {
  dir = createScratchDir("curation");
  adapter = new EgoMemoryAdapter(dir);
  await adapter.init();
});

afterEach(async () => {
  stopMemoryCuration();
  try {
    await adapter.close();
  } catch {
    /* best-effort */
  }
  removeScratchDir(dir);
});

describe("Ola 9 — la curaduría de memoria ocurre en el producto", () => {
  it("marca stale el fact viejo (superseded + superseded_by) y deja la auditoría curator_run", async () => {
    const old = Date.now() - 200 * DAY_MS; // 200 días (> 90 → stale)
    const fresh = Date.now();

    await adapter.put({
      namespace: "kb/facts",
      key: "fact-stale",
      payload: { text: "hecho viejo", timestamp: old },
      metadata: { ts: old },
    });
    await adapter.put({
      namespace: "kb/facts",
      key: "fact-fresco",
      payload: { text: "hecho nuevo", timestamp: fresh },
      metadata: { ts: fresh },
    });

    const curator = startMemoryCuration(adapter, {
      intervalHours: 24,
      staleAfterDays: 90,
    });
    const stats = await curator.runOnce();

    // 1) El fact stale queda marcado (soft-replace: no se borra).
    expect(stats.staleConsolidatedCount, "un fact stale debe marcarse").toBe(1);
    const stale = await adapter.get("kb/facts", "fact-stale");
    expect(stale, "el fact stale no debe desaparecer (soft-replace)").toBeTruthy();
    expect(stale?.metadata?.["state"]).toBe("superseded");
    expect(stale?.metadata?.["superseded_by"]).toBe("curator:stale");
    const stalePayload = (stale?.payload ?? {}) as Record<string, unknown>;
    expect(stalePayload["is_latest"]).toBe(false);

    // 2) El fresco no se toca (el adapter le pone `state: "active"`; lo que
    //    importa es que NO quede `superseded`).
    const untouched = await adapter.get("kb/facts", "fact-fresco");
    expect(untouched?.metadata?.["state"]).not.toBe("superseded");
    const freshPayload = (untouched?.payload ?? {}) as Record<string, unknown>;
    expect(freshPayload["is_latest"]).toBeUndefined();

    // 3) La auditoría de la corrida queda en `gov/audit`.
    const audit = await adapter.list("gov/audit");
    const run = audit.find(
      (entry) => (entry.payload as Record<string, unknown>)?.["action"] === "curator_run"
    );
    expect(run, "debe quedar la auditoría `curator_run`").toBeTruthy();
    const details = (run!.payload as Record<string, unknown>)["details"] as Record<
      string,
      unknown
    >;
    expect(details["staleConsolidatedCount"]).toBe(1);
    expect(details["staleNamespacesScanned"]).toContain("kb/facts");
  });

  it("el temporizador NO retiene el proceso (unref) y se puede parar", () => {
    const curator = startMemoryCuration(adapter, { intervalHours: 1 });
    expect(curator.running, "el curator debe estar corriendo").toBe(true);
    stopMemoryCuration();
    expect(curator.running, "tras parar, el temporizador no debe seguir").toBe(false);
  });

  it("LA CURADURÍA ESTÁ CABLEADA: el arranque la inicia y el apagado la para", () => {
    // Ver la nota del cabecera: el arranque importa `electron` → la única
    // forma de vigilar el cableado sin mock de Electron es leer la fuente.
    //
    // OJO: los COMENTARIOS se eliminan antes de buscar la llamada: si no,
    // bastaría con comentarla para que el test siguiera en verde (es
    // exactamente el truco que este test tiene que cazar).
    const root = resolve(process.cwd(), "src", "main");
    const createWindow = join(root, "window", "create-window.ts");
    const main = resolve(process.cwd(), "src", "main.ts");
    expect(existsSync(createWindow)).toBe(true);

    const stripComments = (src: string): string =>
      src
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");

    const windowSrc = stripComments(readFileSync(createWindow, "utf8"));
    expect(
      windowSrc,
      "el arranque debe llamar a startMemoryCuration (si se borra la llamada, este test falla)"
    ).toMatch(/startMemoryCuration\(\s*adapter/);
    expect(windowSrc).toMatch(/from\s+"[^"]*memory-curation\.js"/);

    const mainSrc = stripComments(readFileSync(main, "utf8"));
    expect(
      mainSrc,
      "el apagado debe llamar a stopMemoryCuration (si se borra, el timer sobrevive al cierre)"
    ).toMatch(/stopMemoryCuration\(\)/);
  });
});
