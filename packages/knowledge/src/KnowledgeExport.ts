import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { EgoMemoryAdapter, type EgoPut } from "@ego/memory";
import {
  flushBestEffort,
  listAllNamespaceRecords,
  unwrapTaggedMetadata,
} from "./cursorListing.js";

export interface ExportPackage {
  version: string;
  projectId: string;
  exportedAt: number;
  checksum: string;
  totalRecords: number;
  records: Array<{
    namespace: string;
    key: string;
    payload: unknown;
    metadata?: Record<string, unknown>;
  }>;
}

/** Tamaño de página para listar namespaces durante el export. */
const EXPORT_PAGE_SIZE = 500;
/** Tamaño de lote para escribir imports (acota picos de memoria y round-trips). */
const IMPORT_BATCH_SIZE = 200;

/**
 * Ordena recursivamente las claves de un valor JSON (M14). Los arrays
 * conservan su orden; los registros se ordenan por separado en
 * `canonicalExportChecksum`. Idempotente.
 */
export function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonKeys);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortJsonKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

function compareRecords(
  a: ExportPackage["records"][number],
  b: ExportPackage["records"][number]
): number {
  const ka = `${a.namespace}:${a.key}`;
  const kb = `${b.namespace}:${b.key}`;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/**
 * Checksum SHA-256 canónico de un conjunto de registros (M14): ordena por
 * `namespace:key` y serializa con claves ordenadas, de modo que reordenar
 * registros o claves no cambia el digest ni rompe la verificación.
 */
export function canonicalExportChecksum(records: ExportPackage["records"]): string {
  const canonical = [...records].sort(compareRecords).map((r) => sortJsonKeys(r));
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}
/**
 * Utilidad de portabilidad mnemónica: exportación e importación de datasets de conocimiento (KB-10).
 * Preserva soberanía de datos del usuario (Principio Innegociable §9) con verificación SHA-256.
 */
export class KnowledgeExport {
  private adapter: EgoMemoryAdapter;

  constructor(adapter: EgoMemoryAdapter) {
    this.adapter = adapter;
  }

  public setAdapter(adapter: EgoMemoryAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Exporta todo el conocimiento de un proyecto hacia un objeto serializable o archivo.
   *
   * M14: pagina cada namespace con cursor hasta agotar (sin ventana fija de
   * 500 que truncaba DBs grandes), ordena los registros por
   * `namespace:key` y firma con checksum canónico (insensible al orden).
   */
  public async exportPackage(
    projectId: string = "default",
    filePath?: string
  ): Promise<ExportPackage> {
    const namespaces = ["kb/facts", "kb/docs"];
    const allRecords: ExportPackage["records"] = [];

    for (const ns of namespaces) {
      try {
        const records = await listAllNamespaceRecords(this.adapter, ns, EXPORT_PAGE_SIZE);
        for (const rec of records) {
          allRecords.push({
            namespace: ns,
            key: rec.key,
            payload: rec.payload,
            metadata: rec.metadata as Record<string, unknown> | undefined,
          });
        }
      } catch {
        // Continuar si el namespace aún no tiene registros
      }
    }

    allRecords.sort(compareRecords);
    const checksum = canonicalExportChecksum(allRecords);

    const pkg: ExportPackage = {
      version: "1.0.0",
      projectId,
      exportedAt: Date.now(),
      checksum,
      totalRecords: allRecords.length,
      records: allRecords,
    };

    if (filePath) {
      await fs.writeFile(filePath, JSON.stringify(pkg, null, 2), "utf-8");
    }

    return pkg;
  }

  /**
   * Importa un paquete de conocimiento restaurándolo en VantaDB tras verificar el checksum.
   *
   * M14: verifica con checksum canónico (tolera reordenamientos inocuos),
   * normaliza metadata tagged legacy en el borde de importación (evita que
   * las claves auditadas de `putMulti` caigan a sus defaults) y escribe por
   * lotes acotados (`putMulti` + `flush`) en vez de N puts secuenciales.
   * Compatibilidad: sin `putMulti` degrada a puts secuenciales (mocks legacy).
   */
  public async importPackage(packageOrPath: ExportPackage | string): Promise<{ imported: number }> {
    let pkg: ExportPackage;

    if (typeof packageOrPath === "string") {
      const content = await fs.readFile(packageOrPath, "utf-8");
      pkg = JSON.parse(content) as ExportPackage;
    } else {
      pkg = packageOrPath;
    }

    // Validación de integridad criptográfica (canónica: insensible al orden)
    const calculatedChecksum = canonicalExportChecksum(pkg.records ?? []);

    if (calculatedChecksum !== pkg.checksum) {
      throw new Error("Fallo de integridad: Checksum SHA-256 no coincide. Archivo potencialmente corrupto.");
    }

    const pending: EgoPut[] = (pkg.records ?? []).map((rec) => ({
      namespace: rec.namespace,
      key: rec.key,
      payload: rec.payload,
      metadata: rec.metadata ? unwrapTaggedMetadata(rec.metadata) : undefined,
    }));

    const maybe = this.adapter as unknown as { putMulti?: unknown };
    if (typeof maybe.putMulti === "function") {
      const putMulti = maybe.putMulti as (items: EgoPut[]) => Promise<void>;
      for (let i = 0; i < pending.length; i += IMPORT_BATCH_SIZE) {
        await putMulti.call(this.adapter, pending.slice(i, i + IMPORT_BATCH_SIZE));
      }
      await flushBestEffort(this.adapter, "importPackage");
    } else {
      for (const item of pending) {
        await this.adapter.put(item);
      }
    }

    return { imported: pending.length };
  }
}
