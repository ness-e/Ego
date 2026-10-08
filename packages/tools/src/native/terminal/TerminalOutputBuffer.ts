export interface TerminalBufferOptions {
  maxSizeBytes?: number;
  drainChunkBytes?: number;
}

export interface TerminalBufferChunk {
  data: string;
  bytes: number;
  timestamp: number;
}

/**
 * Búfer supervisor de salida de terminal y CLI.
 * Implementa coalescencia por cuotas de 16KB (HELM-01) y límite de ring-buffer a 2MB (HELM-02)
 * para evitar colapsos de memoria (OOM) o bloqueo del Event Loop ante comandos masivos.
 */
export class TerminalOutputBuffer {
  public static readonly DRAIN_CHUNK_BYTES = 16 * 1024; // 16KB por emisión
  public static readonly MAX_QUEUE_BYTES = 2 * 1024 * 1024; // 2MB tope de memoria en buffer

  private readonly maxSizeBytes: number;
  private readonly drainChunkBytes: number;
  private chunks: Buffer[] = [];
  private totalBytes = 0;
  private truncatedBytes = 0;

  constructor(options: TerminalBufferOptions = {}) {
    this.maxSizeBytes = options.maxSizeBytes ?? TerminalOutputBuffer.MAX_QUEUE_BYTES;
    this.drainChunkBytes = options.drainChunkBytes ?? TerminalOutputBuffer.DRAIN_CHUNK_BYTES;
  }

  /**
   * Agrega un nuevo fragmento de datos proveniente de stdout o stderr.
   */
  public append(data: Buffer | string): void {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf-8");
    this.chunks.push(buf);
    this.totalBytes += buf.length;

    // Si excede el tope configurado, compactar reteniendo mitad head y mitad tail
    if (this.totalBytes > this.maxSizeBytes) {
      this.compact();
    }
  }

  /**
   * Retorna el tamaño en bytes configurado para cuotas de drenado por tick.
   */
  public getDrainChunkBytes(): number {
    return this.drainChunkBytes;
  }

  /**
   * Determina si la salida fue truncada debido a exceder la cuota máxima de memoria.
   */
  public isTruncated(): boolean {
    return this.truncatedBytes > 0;
  }

  /**
   * Retorna la salida completa compactada como string UTF-8.
   */
  public getOutput(): string {
    const fullBuffer = Buffer.concat(this.chunks);
    let text = fullBuffer.toString("utf-8");

    if (this.truncatedBytes > 0) {
      text += `\n\n[TRUNCATED: buffer excedió ${this.maxSizeBytes} bytes, omitidos ${this.truncatedBytes} bytes para proteger la memoria]\n`;
    }

    return text;
  }

  /**
   * Retorna el número total de bytes procesados históricamente.
   */
  public getTotalBytes(): number {
    return this.totalBytes;
  }

  /**
   * Retorna los bytes omitidos por compactación.
   */
  public getTruncatedBytes(): number {
    return this.truncatedBytes;
  }

  /**
   * Compacta el buffer reteniendo la mitad al inicio (head) y la mitad al final (tail).
   */
  private compact(): void {
    const full = Buffer.concat(this.chunks);
    const half = Math.max(1, Math.floor(this.maxSizeBytes / 2));

    const head = full.subarray(0, half);
    const tail = full.subarray(full.length - half);

    const droppedBytes = full.length - (head.length + tail.length);
    this.truncatedBytes += droppedBytes;

    this.chunks = [head, tail];
    this.totalBytes = head.length + tail.length;
  }
}
