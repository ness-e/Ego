import { EgoMemoryAdapter, type EgoPut } from "@ego/memory";
import { flushBestEffort, listAllNamespaceRecords } from "./cursorListing.js";

export interface EngineeringTrace {
  id: string;
  decisionId: string;
  adrId?: string;
  commitHash?: string;
  affectedFiles: string[];
  testFiles: string[];
  outcome: string;
  timestamp: number;
}

export interface TraceExplanation {
  traceId: string;
  decisionId: string;
  reasoning: string;
  commitHash?: string;
  tests: string[];
  files: string[];
  outcome: string;
}

interface FileRefRecord {
  key: string;
  payload: unknown;
}

/**
 * Grafo mnemónico del proyecto (Project Memory Graph v0 - KB-11).
 * Conecta la cadena causal de ingeniería de software:
 * Decisión (gov/audit) -> ADR -> Commit -> Código -> Tests -> Outcome.
 * Contrapartida directa de las capacidades upstream de VantaDB MEMG-03 / MGR-22..24.
 */
export class ProjectMemoryGraph {
  private adapter: EgoMemoryAdapter;

  constructor(adapter: EgoMemoryAdapter) {
    this.adapter = adapter;
  }

  public setAdapter(adapter: EgoMemoryAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Registra un eslabón completo de la cadena de ingeniería en el grafo de proyecto.
   *
   * M10: escribe traza + refs inversas en un solo `putMulti` con barrera
   * `flush` (durabilidad WAL), en vez de N+1 puts sin atomicidad.
   * Compatibilidad: si el adapter no expone `putMulti` (mocks legacy),
   * degrada a puts secuenciales; `flush` es best-effort con aviso.
   */
  public async recordEngineeringTrace(trace: EngineeringTrace): Promise<void> {
    const namespace = "proj/traces";
    const key = trace.id;

    const batch: EgoPut[] = [
      {
        namespace,
        key,
        payload: `Traza Causal ${trace.id}: Decisión ${trace.decisionId} -> Archivos: ${trace.affectedFiles.join(", ")}`,
        metadata: {
          trace_id: trace.id,
          decision_id: trace.decisionId,
          adr_id: trace.adrId || "",
          commit_hash: trace.commitHash || "",
          affected_files_json: JSON.stringify(trace.affectedFiles),
          test_files_json: JSON.stringify(trace.testFiles),
          outcome: trace.outcome,
          ts: trace.timestamp,
        },
      },
    ];

    // Registrar referencias inversas para búsqueda por archivo
    for (const filePath of trace.affectedFiles) {
      const fileRefKey = `ref:${Buffer.from(filePath).toString("hex")}:${trace.id}`;
      batch.push({
        namespace: "proj/file_traces",
        key: fileRefKey,
        payload: trace.id,
        metadata: {
          file_path: filePath,
          trace_id: trace.id,
          decision_id: trace.decisionId,
        },
      });
    }

    const maybe = this.adapter as unknown as { putMulti?: unknown };
    if (typeof maybe.putMulti === "function") {
      await (maybe.putMulti as (items: EgoPut[]) => Promise<void>).call(this.adapter, batch);
    } else {
      for (const item of batch) {
        await this.adapter.put(item);
      }
    }
    await flushBestEffort(this.adapter, "recordEngineeringTrace");
  }

  /**
   * Explica por qué existe o fue modificado un archivo en el proyecto ("¿Por qué?").
   *
   * M10: pagina `proj/file_traces` con cursor hasta agotar (vía `getDb()`,
   * mismo patrón probado en `BitemporalQueries` F2T3) en vez de una ventana
   * fija de 10 que perdía trazas. La coincidencia exige el separador `:`
   * tras el prefijo hex para no confundir un archivo con otro cuyo
   * hexadecimal lo extiende.
   */
  public async explainArtifact(filePath: string): Promise<TraceExplanation | null> {
    const fileRefPrefix = `ref:${Buffer.from(filePath).toString("hex")}:`;
    const refs = await this.listAllFileRefs();

    const matchingRef = refs.find((r) => r.key.startsWith(fileRefPrefix));
    if (!matchingRef) {
      return null;
    }

    const traceId = String(matchingRef.payload);
    const traceRecord = (await this.adapter.get("proj/traces", traceId)) as {
      key: string;
      payload: unknown;
      metadata: Record<string, unknown>;
    } | null;

    if (!traceRecord || !traceRecord.metadata) {
      return null;
    }

    const meta = traceRecord.metadata;
    let affectedFiles: string[] = [];
    let testFiles: string[] = [];

    try {
      affectedFiles = JSON.parse(String(meta["affected_files_json"] || "[]"));
      testFiles = JSON.parse(String(meta["test_files_json"] || "[]"));
    } catch {
      // Ignorar error de parsing y dejar vacíos
    }

    return {
      traceId,
      decisionId: String(meta["decision_id"] || ""),
      reasoning: `El archivo ${filePath} fue originado o modificado bajo la decisión ${meta["decision_id"]}`,
      commitHash: String(meta["commit_hash"] || ""),
      files: affectedFiles,
      tests: testFiles,
      outcome: String(meta["outcome"] || "Completado"),
    };
  }

  /**
   * Lista todas las refs de `proj/file_traces`. Vía preferida: cursor del
   * binding nativo hasta agotar (ver `listAllNamespaceRecords`); fallback
   * incremental vía `adapter.list` para adapters sin `getDb()`.
   */
  private async listAllFileRefs(): Promise<FileRefRecord[]> {
    const records = await listAllNamespaceRecords(this.adapter, "proj/file_traces");
    return records.map((r) => ({ key: r.key, payload: r.payload }));
  }
}
