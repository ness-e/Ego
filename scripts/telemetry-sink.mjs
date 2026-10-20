#!/usr/bin/env node
// scripts/telemetry-sink.mjs — T10 (EGO-FIND-74): sink de disco ROTADO para
// telemetría estructurada.
//
// POR QUÉ:
//   `packages/events/src/StructuredLogger.ts:35` escribe por defecto a
//   `console.log` → los logs estructurados nunca llegan a un archivo.
//   `packages/decision/src/Telemetry.ts:30` guarda 500 muestras EN RAM → se
//   pierden al reiniciar y nunca se exportan.
//
//   Este módulo es el sink que el main process puede inyectar (handoff A2):
//   una función `(line: string) => void` que escribe JSONL en disco con
//   rotación por tamaño, para que la telemetría sobreviva a los reinicios.
//
// CONTRATO (handoff A2 → inyectar en `packages/events` y `packages/decision`):
//
//   import { createRotatingFileSink } from "../../scripts/telemetry-sink.mjs";
//   const sink = createRotatingFileSink({ dir: join(appDir, "logs", "telemetry") });
//   const logger = new StructuredLogger({ outputStream: sink.write });
//   // y para DecisionTelemetry:
//   decisionTelemetry.setSink(sink.write);
//
//   El sink acepta CUALQUIER línea (JSON o texto). Si la línea es JSON
//   válido, se normaliza a una sola línea (JSONL) antes de escribir.
//
// ROTACIÓN: al superar `maxBytes`, el fichero activo se renombra a
// `<base>.1.jsonl` y se arrastran los anteriores (`<base>.2.jsonl`, ...).
// Se conservan `maxFiles` ficheros.
//
// USO:
//   node scripts/telemetry-sink.mjs --dir <dir> --print      // autotest
import { mkdirSync, existsSync, renameSync, statSync, unlinkSync, appendFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULTS = {
  dir: "logs/telemetry",
  baseName: "telemetry",
  maxBytes: 5 * 1024 * 1024, // 5 MB por fichero
  maxFiles: 5, // ficheros conservados tras la rotación
};

/** Nombre del fichero activo para una fecha (UTC). */
function activeFileName(baseName, date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${baseName}-${y}${m}${d}.jsonl`;
}

/**
 * Crea un sink de disco rotado.
 * @param {{dir?: string, baseName?: string, maxBytes?: number, maxFiles?: number, now?: () => Date}} options
 * @returns {{write: (line: string) => void, dir: string, file: () => string, rotate: () => void}}
 */
export function createRotatingFileSink(options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const now = options.now ?? (() => new Date());
  mkdirSync(opts.dir, { recursive: true });

  const activePath = () => join(opts.dir, activeFileName(opts.baseName, now()));

  function rotate() {
    const active = activePath();
    if (!existsSync(active)) return;
    // Arrastra: .1 -> .2, .2 -> .3, ...
    for (let i = opts.maxFiles - 1; i >= 1; i -= 1) {
      const from = `${active}.${i}.jsonl`;
      const to = `${active}.${i + 1}.jsonl`;
      if (existsSync(from)) {
        if (i + 1 > opts.maxFiles) {
          unlinkSync(from);
        } else {
          renameSync(from, to);
        }
      }
    }
    const first = `${active}.1.jsonl`;
    if (existsSync(first)) unlinkSync(first);
    renameSync(active, first);
  }

  function write(line) {
    const text = typeof line === "string" ? line : String(line);
    // JSONL: si es JSON, se compacta a una línea (los saltos de línea
    // romperían el formato). Si no es JSON, se escapan los saltos.
    let payload;
    try {
      payload = JSON.stringify(JSON.parse(text));
    } catch {
      payload = JSON.stringify({ ts: new Date().toISOString(), message: text });
    }
    const active = activePath();
    try {
      if (existsSync(active) && statSync(active).size >= opts.maxBytes) rotate();
      appendFileSync(active, `${payload}\n`, "utf8");
    } catch {
      // El sink NUNCA debe tumbar al producto: si el disco falla, se
      // descarta la línea (fail-soft explícito, documentado).
    }
  }

  return {
    write,
    dir: opts.dir,
    file: activePath,
    rotate,
  };
}

/** Lista los ficheros de telemetría de un directorio, del más nuevo al más viejo. */
export function listTelemetryFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort()
    .reverse()
    .map((f) => join(dir, f));
}

export { activeFileName, DEFAULTS };

// ── autotest (`--print`) ────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith("telemetry-sink.mjs") && process.argv.includes("--print")) {
  const os = await import("node:os");
  const tmp = join(os.tmpdir(), `ego-telemetry-sink-${randomUUID().slice(0, 8)}`);
  const sink = createRotatingFileSink({ dir: tmp, maxBytes: 200, maxFiles: 2 });
  sink.write(JSON.stringify({ hello: "world", n: 1 }));
  sink.write("línea suelta\ncon salto");
  console.log(`[telemetry-sink] dir=${sink.dir}`);
  console.log(`[telemetry-sink] ficheros: ${listTelemetryFiles(tmp).length}`);
  console.log("[telemetry-sink] ok");
}
