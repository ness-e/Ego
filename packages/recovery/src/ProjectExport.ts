import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import * as crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import {
  ProjectExportOptions,
  ProjectExportResult,
  VdbdumpManifest,
  DumpRecord,
  RecoveryMemoryAdapter,
} from "./types.js";
import { ensureDir, removeIfExists } from "./fsAsync.js";

/**
 * Tamaño de página para barridos de exportación (H20).
 * La exportación NUNCA usa `list(ns, 50000)`: pagina con cursor para
 * mantener memoria acotada incluso con namespaces de decenas de miles.
 */
export const EXPORT_PAGE_SIZE = 500;

/** Límite de respaldo cuando el adapter no expone `listPaged()` (mocks legacy). */
const EXPORT_FALLBACK_LIMIT = 50000;

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class ProjectExport {
  constructor(private readonly adapter: RecoveryMemoryAdapter) {}

  /**
   * Exporta soberanamente un proyecto y sus namespaces a un archivo .vdbdump
   * con streaming NDJSON, cabecera VDBJSON-V1 y sumas criptográficas SHA-256.
   *
   * Memoria acotada (H20): los registros se leen por páginas (`listPaged` +
   * cursor) y se escriben en streaming a un cuerpo temporal; solo los hashes
   * y conteos viven en memoria. El manifiesto se antepone al ensamblar el
   * archivo final, con renombrado atómico.
   */
  public async exportProject(options: ProjectExportOptions): Promise<ProjectExportResult> {
    const startTime = Date.now();
    const compress = options.compress ?? true;
    const outputPath = options.outputPath;
    const tempPath = `${outputPath}.tmp`;
    const bodyPath = `${outputPath}.body.tmp`;
    const targetProjectId = options.projectId ?? "project-ego-nucleus";
    const targetProjectName = options.projectName ?? "Ego Project Nucleus";

    // Asegurar directorio destino
    const outDir = path.dirname(outputPath);
    await ensureDir(outDir);

    // Resolver namespaces a exportar
    let namespaces = options.namespaces;
    if (!namespaces || namespaces.length === 0) {
      try {
        const db = this.adapter.getDb ? this.adapter.getDb() : null;
        if (db && typeof db.listNamespaces === "function") {
          namespaces = await db.listNamespaces();
        }
      } catch {
        // Fallback a namespaces canónicos
      }
      if (!namespaces || namespaces.length === 0) {
        namespaces = ["core", "knowledge", "tasks", "gov", "domains", "system", "daily_state"];
      }
    }

    const recordCounts: Record<string, number> = {};
    const checksums: Record<string, string> = {};
    let totalRecords = 0;
    const totalHasher = crypto.createHash("sha256");
    let manifest: VdbdumpManifest;

    try {
      // Etapa 1: volcar registros paginados al cuerpo temporal en streaming.
      const bodyStream = fs.createWriteStream(bodyPath);
      const bodyWriter = new ChunkedLineWriter(bodyStream);
      try {
        for (const ns of namespaces) {
          const nsHasher = crypto.createHash("sha256");
          let nsCount = 0;
          await this.dumpNamespace(ns, async (rec: DumpRecord) => {
            const line = JSON.stringify(rec);
            nsHasher.update(line);
            totalHasher.update(line);
            nsCount++;
            // Escritura por LOTES: un `await` por línea significa un
            // round-trip al SO por registro (2 s para 1 200 líneas en
            // Windows). El buffer agrupa 64 KB ⇒ ~20 escrituras en vez de
            // 1 200, con el mismo contenido byte a byte.
            bodyWriter.write(line + "\n");
          });
          recordCounts[ns] = nsCount;
          totalRecords += nsCount;
          checksums[ns] = nsHasher.digest("hex");
        }
      } finally {
        bodyWriter.flush();
        bodyStream.end();
        await streamFinished(bodyStream);
      }

      const totalChecksum = totalHasher.digest("hex");

      // Construir manifiesto de cabecera VDBJSON-V1
      manifest = {
        format: "VDBJSON-V1",
        projectId: targetProjectId,
        projectName: targetProjectName,
        createdAt: startTime,
        version: "0.1.0",
        namespaces,
        recordCounts,
        checksums,
        totalChecksum,
        totalRecords,
      };

      // Etapa 2: manifiesto + cuerpo → archivo final (gz o plano), atómico.
      const manifestLine = JSON.stringify(manifest) + "\n";
      const combined = Readable.from(generateCombined(manifestLine, bodyPath));
      const fileWriteStream = fs.createWriteStream(tempPath);
      if (compress) {
        const gzipStream = zlib.createGzip({ level: 6 });
        await pipeline(combined, gzipStream, fileWriteStream);
      } else {
        await pipeline(combined, fileWriteStream);
      }

      // Renombrado atómico para garantizar que nunca quede un archivo corrupto incompleto
      await removeIfExists(outputPath);
      await fs.promises.rename(tempPath, outputPath);
    } catch (exportErr) {
      for (const p of [tempPath, bodyPath]) {
        try {
          await removeIfExists(p);
        } catch {
          // ignore
        }
      }
      throw exportErr;
    } finally {
      try {
        await removeIfExists(bodyPath);
      } catch {
        // ignore
      }
    }

    const stat = await fs.promises.stat(outputPath);
    const durationMs = Date.now() - startTime;

    return {
      outputPath,
      manifest,
      bytesWritten: stat.size,
      totalRecords,
      durationMs,
    };
  }

  /**
   * Lee un namespace por páginas acotadas e invoca `onRecord` por registro.
   * Prefiere `listPaged()` con cursor; sin él, un único `list()` acotado
   * (vía legacy para mocks, documentada como no-escalable).
   */
  private async dumpNamespace(
    ns: string,
    onRecord: (rec: DumpRecord) => Promise<void>
  ): Promise<void> {
    if (typeof this.adapter.listPaged === "function") {
      let cursor: number | string | undefined;
      for (;;) {
        let page;
        try {
          page =
            cursor === undefined
              ? await this.adapter.listPaged(ns, EXPORT_PAGE_SIZE)
              : await this.adapter.listPaged(ns, EXPORT_PAGE_SIZE, cursor);
        } catch (err: unknown) {
          throw new Error(`[ProjectExport] Error al leer namespace '${ns}': ${describeError(err)}`);
        }
        for (const item of page.records) {
          await onRecord({
            namespace: ns,
            key: item.key,
            payload: item.payload,
            metadata: item.metadata,
          });
        }
        if (page.nextCursor === undefined) break;
        cursor = page.nextCursor;
      }
      return;
    }

    let items;
    try {
      items = await this.adapter.list(ns, EXPORT_FALLBACK_LIMIT);
    } catch (err: unknown) {
      throw new Error(`[ProjectExport] Error al leer namespace '${ns}': ${describeError(err)}`);
    }
    for (const item of items) {
      await onRecord({
        namespace: ns,
        key: item.key,
        payload: item.payload,
        metadata: item.metadata,
      });
    }
  }
}

/**
 * Escritor de líneas por lotes.
 *
 * Escribir NDJSON línea a línea con un `await` por línea fuerza un round-trip
 * al sistema de ficheros por registro (en Windows, ~2 s para 1 200 líneas).
 * Este escritor agrupa hasta 64 KB antes de volcar al stream: ~20 escrituras
 * en vez de 1 200, con contenido **byte a byte idéntico**.
 */
class ChunkedLineWriter {
  private buffer = "";
  private failed: Error | null = null;

  constructor(private readonly stream: fs.WriteStream) {
    this.stream.on("error", (err: Error) => {
      this.failed = err;
    });
  }

  /** Encola una línea (sin newline: el caller lo añade). */
  public write(line: string): void {
    if (this.failed) return;
    this.buffer += line;
    if (this.buffer.length >= 64 * 1024) {
      this.flush();
    }
  }

  /** Vuelca el buffer pendiente al stream. */
  public flush(): void {
    if (this.buffer.length === 0) return;
    const chunk = this.buffer;
    this.buffer = "";
    this.stream.write(chunk);
  }

  /** Error asíncrono del stream, si lo hubo. */
  public get error(): Error | null {
    return this.failed;
  }
}

/** Genera manifiesto seguido del cuerpo temporal, en streaming. */
async function* generateCombined(
  manifestLine: string,
  bodyPath: string
): AsyncGenerator<string, void, unknown> {
  yield manifestLine;
  const bodyIn = fs.createReadStream(bodyPath, { encoding: "utf8" });
  try {
    yield* bodyIn;
  } finally {
    bodyIn.destroy();
  }
}

/** Espera al cierre del stream de escritura. */
function streamFinished(stream: fs.WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.once("finish", () => resolve());
    stream.once("error", (err) => reject(err));
  });
}
