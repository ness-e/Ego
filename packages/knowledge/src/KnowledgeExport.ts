import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { EgoMemoryAdapter } from "@ego/memory";

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
   */
  public async exportPackage(
    projectId: string = "default",
    filePath?: string
  ): Promise<ExportPackage> {
    const namespaces = ["kb/facts", "kb/docs"];
    const allRecords: ExportPackage["records"] = [];

    for (const ns of namespaces) {
      try {
        const records = await this.adapter.list(ns, 500);
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

    const payloadString = JSON.stringify(allRecords);
    const checksum = createHash("sha256").update(payloadString, "utf8").digest("hex");

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
   */
  public async importPackage(packageOrPath: ExportPackage | string): Promise<{ imported: number }> {
    let pkg: ExportPackage;

    if (typeof packageOrPath === "string") {
      const content = await fs.readFile(packageOrPath, "utf-8");
      pkg = JSON.parse(content) as ExportPackage;
    } else {
      pkg = packageOrPath;
    }

    // Validación de integridad criptográfica
    const payloadString = JSON.stringify(pkg.records);
    const calculatedChecksum = createHash("sha256").update(payloadString, "utf8").digest("hex");

    if (calculatedChecksum !== pkg.checksum) {
      throw new Error("Fallo de integridad: Checksum SHA-256 no coincide. Archivo potencialmente corrupto.");
    }

    let imported = 0;
    for (const rec of pkg.records) {
      await this.adapter.put({
        namespace: rec.namespace,
        key: rec.key,
        payload: rec.payload,
        metadata: rec.metadata,
      });
      imported++;
    }

    return { imported };
  }
}
