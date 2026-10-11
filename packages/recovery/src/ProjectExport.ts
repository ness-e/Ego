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
} from "./types.js";

export class ProjectExport {
  constructor(private readonly adapter: any) {}

  /**
   * Exporta soberanamente un proyecto y sus namespaces a un archivo .vdbdump
   * con streaming NDJSON, cabecera VDBJSON-V1 y sumas criptográficas SHA-256.
   */
  public async exportProject(options: ProjectExportOptions): Promise<ProjectExportResult> {
    const startTime = Date.now();
    const compress = options.compress ?? true;
    const outputPath = options.outputPath;
    const tempPath = `${outputPath}.tmp`;
    const targetProjectId = options.projectId ?? "project-ego-nucleus";
    const targetProjectName = options.projectName ?? "Ego Project Nucleus";

    // Asegurar directorio destino
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

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

    // Recolectar datos y calcular hashes por namespace
    const recordCounts: Record<string, number> = {};
    const checksums: Record<string, string> = {};
    const recordsByNamespace: Map<string, DumpRecord[]> = new Map();
    let totalRecords = 0;
    const totalHasher = crypto.createHash("sha256");

    for (const ns of namespaces) {
      let items: any[] = [];
      try {
        items = await this.adapter.list(ns, 50000);
      } catch (err: any) {
        throw new Error(`[ProjectExport] Error al leer namespace '${ns}': ${err.message}`);
      }

      const nsRecords: DumpRecord[] = items.map((item: any) => ({
        namespace: ns,
        key: item.key,
        payload: item.payload,
        metadata: item.metadata,
      }));

      recordsByNamespace.set(ns, nsRecords);
      recordCounts[ns] = nsRecords.length;
      totalRecords += nsRecords.length;

      const nsHasher = crypto.createHash("sha256");
      for (const rec of nsRecords) {
        const line = JSON.stringify(rec);
        nsHasher.update(line);
        totalHasher.update(line);
      }
      checksums[ns] = nsHasher.digest("hex");
    }

    const totalChecksum = totalHasher.digest("hex");

    // Construir manifiesto de cabecera VDBJSON-V1
    const manifest: VdbdumpManifest = {
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

    // Generar stream de líneas: manifiesto seguido de records NDJSON
    async function* generateLines(): AsyncGenerator<string, void, unknown> {
      // Primera línea: Manifiesto JSON
      yield JSON.stringify(manifest) + "\n";

      // Líneas subsecuentes: records en NDJSON
      for (const ns of namespaces!) {
        const records = recordsByNamespace.get(ns) || [];
        for (const rec of records) {
          yield JSON.stringify(rec) + "\n";
        }
      }
    }

    const inputStream = Readable.from(generateLines());
    const fileWriteStream = fs.createWriteStream(tempPath);

    try {
      if (compress) {
        const gzipStream = zlib.createGzip({ level: 6 });
        await pipeline(inputStream, gzipStream, fileWriteStream);
      } else {
        await pipeline(inputStream, fileWriteStream);
      }

      // Renombrado atómico para garantizar que nunca quede un archivo corrupto incompleto
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      fs.renameSync(tempPath, outputPath);
    } catch (exportErr) {
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // ignore
        }
      }
      throw exportErr;
    }

    const stat = fs.statSync(outputPath);
    const durationMs = Date.now() - startTime;

    return {
      outputPath,
      manifest,
      bytesWritten: stat.size,
      totalRecords,
      durationMs,
    };
  }
}
