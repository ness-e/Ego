function sha256Sync(str: string): string {
  const msg = new TextEncoder().encode(str);
  const l = msg.length;
  const bitLen = l * 8;
  const k = ((56 - ((l + 1) % 64)) % 64 + 64) % 64;
  const padded = new Uint8Array(l + 1 + k + 8);
  padded.set(msg);
  padded[l] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen & 0xffffffff, false);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let chunk = 0; chunk < padded.length; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(chunk + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;
      const w16 = w[i - 16] ?? 0;
      const w7 = w[i - 7] ?? 0;
      const s0 =
        ((w15 >>> 7) | (w15 << 25)) ^
        ((w15 >>> 18) | (w15 << 14)) ^
        (w15 >>> 3);
      const s1 =
        ((w2 >>> 17) | (w2 << 15)) ^
        ((w2 >>> 19) | (w2 << 13)) ^
        (w2 >>> 10);
      w[i] = (w16 + s0 + w7 + s1) | 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + (K[i] ?? 0) + (w[i] ?? 0)) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4) + toHex(h5) + toHex(h6) + toHex(h7);
}

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
    const encoded = new TextEncoder().encode(serialized);
    const sizeBytes = encoded.length;
    const sha256 = sha256Sync(serialized);
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
   * Lista los payloads registrados como **descriptores** de recurso.
   *
   * Ola 1b T5.3 (COUC-08): `PayloadRegistry` era código asimilado sin caller.
   * Ahora es el proveedor de recursos del **servidor MCP de Ego**
   * (`EgoMcpServer` → `resources/list` / `resources/read`): el registro
   * expone la forma estructural que el servidor consume (`uri`, `name`,
   * `description`, `mimeType`).
   */
  public list(): Array<{
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
  }> {
    const out: Array<{
      uri: string;
      name: string;
      description?: string;
      mimeType?: string;
    }> = [];
    for (const [id, entry] of this.store) {
      out.push({
        uri: `payload://${id}`,
        name: entry.metadata.summary || id,
        description: `[${entry.metadata.kind}] ${entry.metadata.sizeBytes} bytes`,
        mimeType: entry.metadata.mimeType,
      });
    }
    return out;
  }

  /**
   * Lee un payload por su URI (`payload://<id>`).
   *
   * Devuelve `undefined` si el payload no existe o no está en caché.
   */
  public read(uri: string): { text?: string; blob?: string; mimeType?: string } | undefined {
    const id = uri.startsWith("payload://") ? uri.slice("payload://".length) : uri;
    const entry = this.store.get(id);
    if (!entry) return undefined;

    const mimeType = entry.metadata.mimeType;
    if (typeof entry.data === "string") {
      return { text: entry.data, mimeType };
    }
    if (entry.data === undefined || entry.data === null) {
      return { text: "", mimeType };
    }
    try {
      return { text: JSON.stringify(entry.data, null, 2), mimeType: mimeType ?? "application/json" };
    } catch {
      return { text: String(entry.data), mimeType: mimeType ?? "text/plain" };
    }
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
