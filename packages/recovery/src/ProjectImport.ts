import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import * as readline from "node:readline";
import * as crypto from "node:crypto";
import {
  ProjectImportOptions,
  ProjectImportResult,
  VdbdumpManifest,
  VdbdumpManifestSchema,
  DumpRecord,
  DumpRecordSchema,
  RecoveryMemoryAdapter,
} from "./types.js";
import { pathExists, removeIfExists, writeTextFileAtomic } from "./fsAsync.js";
import type { SchemaMigrator } from "./SchemaMigrator.js";

export class ProjectImport {
  /**
   * @param adapter  Almacén de destino de la restauración.
   * @param schemaMigrator Migrador de esquema de la configuración de
   *   namespaces (DSEK-04, A5-S7). **Opcional**: si se inyecta, tras una
   *   importación correcta la configuración de namespaces se lleva a la
   *   versión de esquema vigente (migraciones aditivas, con snapshot
   *   pre-migración y rollback automático).
   *
   *   Antes `SchemaMigrator` era código asimilado sin caller.
   */
  constructor(
    private readonly adapter: RecoveryMemoryAdapter,
    private readonly schemaMigrator?: SchemaMigrator
  ) {}

  /**
   * Importa y restaura un archivo .vdbdump hacia el almacenamiento de VantaDB.
   * Adquiere un lock de importación exclusivo, valida cabecera e integridad criptográfica SHA-256.
   */
  public async importProject(options: ProjectImportOptions): Promise<ProjectImportResult> {
    const startTime = Date.now();
    const inputPath = options.inputPath;
    const batchSize = options.batchSize ?? 100;
    const verifyChecksums = options.verifyChecksums ?? true;

    if (!(await pathExists(inputPath))) {
      throw new Error(`[ProjectImport] El archivo a importar no existe: ${inputPath}`);
    }

    // Adquisición de lockfile de importación exclusivo (CARP-02)
    const lockFilePath = path.join(path.dirname(inputPath), "ego.import.lock");
    if (await pathExists(lockFilePath)) {
      throw new Error("[ProjectImport] Operación de importación en curso por otro proceso (ego.import.lock activo).");
    }

    // Escritura atómica del lock de importación (EJO-FIND-66, T11).
    await writeTextFileAtomic(
      lockFilePath,
      JSON.stringify({ pid: process.pid, startedAt: startTime })
    );

    try {
      // Determinar si el archivo está comprimido en gzip revisando los primeros 2 bytes (Magic numbers: 0x1f, 0x8b)
      const fileBuffer = Buffer.alloc(2);
      const handle = await fs.promises.open(inputPath, "r");
      try {
        await handle.read(fileBuffer, 0, 2, 0);
      } finally {
        await handle.close();
      }
      const isGzip = fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b;

      // Crear stream de lectura decodificado
      let lineReader: readline.Interface;
      if (isGzip) {
        const fileStream = fs.createReadStream(inputPath);
        const gunzipStream = zlib.createGunzip();
        fileStream.pipe(gunzipStream);
        lineReader = readline.createInterface({
          input: gunzipStream,
          crlfDelay: Infinity,
        });
      } else {
        const fileStream = fs.createReadStream(inputPath, { encoding: "utf8" });
        lineReader = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity,
        });
      }

      let manifest: VdbdumpManifest | null = null;
      let isFirstLine = true;
      const recordsToInsert: DumpRecord[] = [];
      const restoredNamespaces = new Set<string>();
      let importedRecords = 0;

      const totalHasher = crypto.createHash("sha256");
      const nsHashers = new Map<string, crypto.Hash>();

      for await (const line of lineReader) {
        if (!line || line.trim().length === 0) continue;

        if (isFirstLine) {
          isFirstLine = false;
          try {
            const rawManifest = JSON.parse(line);
            manifest = VdbdumpManifestSchema.parse(rawManifest);
          } catch (parseErr: unknown) {
            const detail = parseErr instanceof Error ? parseErr.message : String(parseErr);
            throw new Error(`[ProjectImport] Cabecera de manifiesto inválida o incompatible: ${detail}`);
          }

          // Inicializar hashers por namespace según manifiesto
          for (const ns of manifest.namespaces) {
            nsHashers.set(ns, crypto.createHash("sha256"));
          }
          continue;
        }

        // Parsear registro individual
        const rawRec = JSON.parse(line);
        const dumpRecord = DumpRecordSchema.parse(rawRec);

        // Acumular hash para validación de integridad
        if (verifyChecksums) {
          const recLine = JSON.stringify(dumpRecord);
          totalHasher.update(recLine);
          const nsHasher = nsHashers.get(dumpRecord.namespace);
          if (nsHasher) {
            nsHasher.update(recLine);
          }
        }

        recordsToInsert.push(dumpRecord);
        restoredNamespaces.add(dumpRecord.namespace);

        // Flushear en lotes controlados
        if (recordsToInsert.length >= batchSize) {
          await this.flushBatch(recordsToInsert);
          importedRecords += recordsToInsert.length;
          recordsToInsert.length = 0;
        }
      }

      if (!manifest) {
        throw new Error("[ProjectImport] Archivo vacío o sin cabecera de manifiesto.");
      }

      // Validar integridad criptográfica antes de flushear el remanente si está activado
      if (verifyChecksums) {
        const calculatedTotalChecksum = totalHasher.digest("hex");
        if (calculatedTotalChecksum !== manifest.totalChecksum) {
          throw new Error(
            `[ProjectImport] Corrupción detectada: Total SHA-256 no coincide (Esperado: ${manifest.totalChecksum}, Calculado: ${calculatedTotalChecksum})`
          );
        }

        for (const ns of manifest.namespaces) {
          const expectedNsChecksum = manifest.checksums[ns];
          const calculatedNsChecksum = nsHashers.get(ns)?.digest("hex");
          if (expectedNsChecksum && calculatedNsChecksum !== expectedNsChecksum) {
            throw new Error(
              `[ProjectImport] Corrupción en namespace '${ns}': SHA-256 no coincide (Esperado: ${expectedNsChecksum}, Calculado: ${calculatedNsChecksum})`
            );
          }
        }
      }

      // Flushear lote final restante
      if (recordsToInsert.length > 0) {
        await this.flushBatch(recordsToInsert);
        importedRecords += recordsToInsert.length;
        recordsToInsert.length = 0;
      }

      const durationMs = Date.now() - startTime;

      // DSEK-04: tras restaurar los datos, la configuración de namespaces se
      // lleva a la versión de esquema vigente (migraciones aditivas). El
      // migrador se inyecta; sin él, la importación no toca la configuración.
      let schemaMigration: { previousVersion: number; newVersion: number; appliedSteps: number } | null =
        null;
      if (this.schemaMigrator) {
        try {
          schemaMigration = await this.schemaMigrator.migrate();
        } catch (migrateErr: unknown) {
          // La migración falló: los datos ya están restaurados y son válidos.
          // Se propaga el error para que el llamante lo trate (el migrador
          // ya ha hecho su rollback por su cuenta).
          throw new Error(
            `[ProjectImport] Los datos se importaron, pero la migración de esquema falló: ${
              migrateErr instanceof Error ? migrateErr.message : String(migrateErr)
            }`
          );
        }
      }

      return {
        success: true,
        manifest,
        importedRecords,
        namespacesRestored: Array.from(restoredNamespaces),
        durationMs,
        schemaMigration,
      };
    } finally {
      // Liberar lock de importación
      try {
        await removeIfExists(lockFilePath);
      } catch {
        // ignore
      }
    }
  }

  private async flushBatch(records: DumpRecord[]): Promise<void> {
    const items = records.map((r) => ({
      namespace: r.namespace,
      key: r.key,
      payload: r.payload,
      metadata: r.metadata,
    }));

    if (typeof this.adapter.putMulti === "function") {
      await this.adapter.putMulti(items);
    } else if (typeof this.adapter.put === "function") {
      for (const item of items) {
        await this.adapter.put(item);
      }
    }
  }
}
