import { createHash } from "node:crypto";

export type PayloadKind =
  | "diff"
  | "artifact"
  | "tool_output"
  | "decision"
  | "evidence"
  | "log"
  | "report";

export interface PayloadMetadata {
  readonly id: string;
  readonly kind: PayloadKind;
  readonly sizeBytes: number;
  readonly mimeType?: string;
  readonly summary: string;
  readonly sha256: string;
  readonly createdAt: number;
}

export interface PayloadRef<T = unknown> {
  readonly ref: PayloadMetadata;
  // En la estructura serializada o en el árbol UI, `data` es opcional (desacoplado)
  readonly data?: T;
}

/**
 * Registro y almacén de referencias inmutables a datos pesados (Patrón Coucou COUC-08).
 * Desacopla las filas visuales y contratos ligeros de la UI del contenido voluminoso,
 * previniendo congestión del árbol React DOM y de IPC.
 */
export class PayloadRegistry {
  private static instance: PayloadRegistry;
  private readonly store = new Map<string, { metadata: PayloadMetadata; data: unknown }>();
  private readonly maxEntries: number;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  public static getInstance(): PayloadRegistry {
    if (!PayloadRegistry.instance) {
      PayloadRegistry.instance = new PayloadRegistry();
    }
    return PayloadRegistry.instance;
  }

  /**
   * Registra un payload pesado, calculando su digest criptográfico y generando
   * un `PayloadMetadata` inmutable y ligero para la UI.
   */
  public register<T>(
    data: T,
    kind: PayloadKind,
    options: { summary?: string; mimeType?: string } = {}
  ): PayloadMetadata {
    const serialized = typeof data === "string" ? data : JSON.stringify(data);
    const sizeBytes = Buffer.byteLength(serialized, "utf8");
    const sha256 = createHash("sha256").update(serialized).digest("hex");
    const id = `pref_${sha256.slice(0, 16)}`;

    // Si ya existe en el store, refrescamos el metadata pero no duplicamos
    if (this.store.has(id)) {
      return this.store.get(id)!.metadata;
    }

    // Política de desalojo LRU si superamos el límite máximo
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
      }
    }

    const summary = options.summary ?? this.generateSummary(serialized, kind);
    const metadata: PayloadMetadata = {
      id,
      kind,
      sizeBytes,
      mimeType: options.mimeType ?? (typeof data === "string" ? "text/plain" : "application/json"),
      summary,
      sha256,
      createdAt: Date.now(),
    };

    this.store.set(id, { metadata, data });
    return metadata;
  }

  /**
   * Resuelve el payload completo bajo demanda a partir de su ID o Metadata.
   */
  public resolve<T>(refIdOrMeta: string | PayloadMetadata): T | undefined {
    const id = typeof refIdOrMeta === "string" ? refIdOrMeta : refIdOrMeta.id;
    const entry = this.store.get(id);
    if (!entry) return undefined;
    return entry.data as T;
  }

  /**
   * Obtiene sólo los metadatos ligeros de la referencia.
   */
  public getMetadata(refId: string): PayloadMetadata | undefined {
    return this.store.get(refId)?.metadata;
  }

  /**
   * Verifica si el payload referenciado sigue disponible en caché.
   */
  public has(refId: string): boolean {
    return this.store.has(refId);
  }

  /**
   * Elimina una referencia explícitamente.
   */
  public delete(refId: string): boolean {
    return this.store.delete(refId);
  }

  /**
   * Limpia el almacén en memoria.
   */
  public clear(): void {
    this.store.clear();
  }

  public size(): number {
    return this.store.size;
  }

  private generateSummary(text: string, kind: PayloadKind): string {
    const preview = text.slice(0, 80).replace(/\s+/g, " ").trim();
    return `[${kind}] ${preview}${text.length > 80 ? "..." : ""}`;
  }
}
