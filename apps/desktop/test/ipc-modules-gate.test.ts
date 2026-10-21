/**
 * T3 (Ola 5) — Gate de la división de IPC por DOMINIO DE CANAL.
 *
 * ## El criterio (decidido aquí, con A1 pidiendo que se decidiera)
 * **Un módulo por dominio de canal**: `ipc.<dominio>.*` → un fichero en
 * `src/main/ipc/domains/`.
 *
 * Motivos:
 * 1. El nombre del canal **ya** codifica el dominio: la división no es
 *    arbitraria, es la taxonomía que el producto expone (preload, esquemas,
 *    renderer).
 * 2. Los canales de un dominio comparten estado e invariantes: juntos, sus
 *    invariantes quedan en un sitio y el dominio de fallo es evidente.
 * 3. Es **estable**: añadir un canal a un dominio no toca otro fichero.
 * 4. Es **verificable**: este gate.
 *
 * ## Lo que vigila
 * - (a) Ningún fichero de IPC (`src/main/ipc/**`) supera el umbral.
 * - (b) Cada canal registrado en el `preload` se registra en EXACTAMENTE un
 *       módulo de dominio (ni dos, ni ninguno).
 * - (c) La raíz de composición registra todos los dominios.
 * - (d) El módulo de un dominio sólo contiene canales de ESE dominio.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";

const SRC = join(process.cwd(), "src");
const IPC_DIR = join(SRC, "main", "ipc");
const DOMAIN_DIR = join(IPC_DIR, "domains");

/** Umbral de líneas por fichero de IPC (la puerta de tamaño). */
const MAX_LINES = 400;

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

/**
 * Canales INVOCABLES declarados en el `preload` (el contrato público).
 *
 * Ojo: el preload tiene DOS arrays — `EgoIpcInvokeChannels` (los handlers que
 * el renderer invoca) y `EgoIpcPushChannels` (los push que el main envía).
 * Sólo los primeros se registran con `ipcMain.handle`.
 */
function preloadChannels(): string[] {
  const src = readFileSync(join(SRC, "ipc.ts"), "utf8");
  const start = src.indexOf("export const EgoIpcInvokeChannels = [");
  if (start < 0) throw new Error("no se encontró EgoIpcInvokeChannels");
  // El array termina en `] as const;` (no en `];`).
  const end = src.indexOf("] as const;", start);
  // Los comentarios del preload mencionan canales de PUSH (p. ej.
  // `ipc.event`): hay que ignorarlos o el gate creería que falta un handler.
  const block = src
    .slice(start, end)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
  const set = new Set<string>();
  for (const m of block.matchAll(/["'`](ipc\.[a-zA-Z0-9.-]+)["'`]/g)) {
    if (m[1]) set.add(m[1]);
  }
  return [...set].sort();
}

/** Canales que registra cada módulo de dominio. */
function channelsOf(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const out: string[] = [];
  for (const m of src.matchAll(/ipcMain\.handle\(\s*["'`](ipc\.[a-zA-Z0-9.-]+)["'`]/g)) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

describe("T3 — gate de la división de IPC por dominio de canal", () => {
  it("(a) ningún fichero de IPC supera el umbral de líneas", () => {
    const files = [...listFiles(IPC_DIR), ...listFiles(DOMAIN_DIR)];
    const oversized = files
      .map((f) => ({ file: relative(SRC, f).replace(/\\/g, "/"), lines: readFileSync(f, "utf8").split(/\r?\n/).length }))
      .filter((f) => f.lines > MAX_LINES)
      .sort((a, b) => b.lines - a.lines);
    expect(
      oversized,
      `ficheros de IPC por encima de ${MAX_LINES} líneas:\n${JSON.stringify(oversized, null, 2)}`
    ).toEqual([]);
  });

  it("(a2) la raíz de composición es una raíz (no un god-file)", () => {
    const lines = readFileSync(join(IPC_DIR, "register-ipc.ts"), "utf8").split(/\r?\n/).length;
    expect(
      lines,
      `register-ipc.ts tiene ${lines} líneas: debe ser una raíz de composición, no un god-file`
    ).toBeLessThanOrEqual(MAX_LINES);
  });

  it("(b) cada canal del preload se registra en EXACTAMENTE un módulo", () => {
    const modules = listFiles(DOMAIN_DIR).map((f) => ({
      file: relative(IPC_DIR, f).replace(/\\/g, "/"),
      domain: f.replace(/\.ts$/, ""),
      channels: channelsOf(f),
    }));

    const seen = new Map<string, string[]>();
    for (const m of modules) {
      for (const c of m.channels) {
        if (!seen.has(c)) seen.set(c, []);
        seen.get(c)!.push(m.domain);
      }
    }
    const duplicates = [...seen.entries()]
      .filter(([, mods]) => mods.length > 1)
      .map(([c, mods]) => `${c} en ${mods.join(" + ")}`);
    expect(duplicates, `canales registrados en más de un módulo:\n${duplicates.join("\n")}`).toEqual([]);

    const expected = preloadChannels();
    const missing = expected.filter((c) => !seen.has(c));
    expect(
      missing,
      `canales del preload sin registrar:\n${missing.join("\n")}`
    ).toEqual([]);
  });

  it("(c) la raíz de composición registra todos los dominios", () => {
    const root = readFileSync(join(IPC_DIR, "register-ipc.ts"), "utf8");
    const domains = listFiles(DOMAIN_DIR).map((f) => basename(f, ".ts"));
    const missing = domains.filter(
      (d) => !new RegExp(`register${d.charAt(0).toUpperCase()}${d.slice(1)}Ipc\\(deps\\)`).test(root)
    );
    expect(missing, `dominios no registrados en la raíz:\n${missing.join("\n")}`).toEqual([]);
  });

  it("(d) un módulo sólo contiene canales de SU dominio", () => {
    const offenders: string[] = [];
    for (const f of listFiles(DOMAIN_DIR)) {
      const domain = basename(f, ".ts");
      for (const c of channelsOf(f)) {
        // El dominio puede ser el canal entero (`ipc.memory`) o su prefijo
        // (`ipc.settings.*`).
        if (c !== `ipc.${domain}` && !c.startsWith(`ipc.${domain}.`)) {
          offenders.push(`${domain} registra ${c}`);
        }
      }
    }
    expect(offenders, `canales fuera de su dominio:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("(e) el número de canales sigue siendo 81 (el contrato no cambia)", () => {
    let total = 0;
    for (const f of listFiles(DOMAIN_DIR)) total += channelsOf(f).length;
    expect(total).toBe(81);
  });
});
