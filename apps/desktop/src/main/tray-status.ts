/**
 * Estado y utilidades puras del tray (sin dependencias Electron runtime).
 *
 * Extraído de `../main.ts` (STAB-09). `createTrayIcon` / `ensureTray` /
 * `refreshTrayStatus` siguen en `main.ts`: necesitan `Tray`, `nativeImage`
 * y `backgroundEngine` en vivo. Todo lo aquí movido es determinista y
 * testeable en vitest node sin mocks.
 */

/** Estado visible del tray, derivado del engine real (COUC-19 mínimo). */
export type EgoTrayStatus = "idle" | "thinking" | "hitl";

/** Color sólido 16×16 por estado: verde / azul / rojo. */
export const TRAY_COLORS: Record<EgoTrayStatus, [number, number, number]> = {
  idle: [52, 211, 153], // verde esmeralda
  thinking: [56, 189, 248], // azul
  hitl: [251, 113, 133], // rojo
};

let crcTable: Int32Array | null = null;

/** Tabla CRC-32 (lazy singleton) para `pngChunk`. */
export function getCrcTable(): Int32Array {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c;
    }
  }
  return crcTable;
}

/** Chunk PNG (`len + type + data + crc`) para el icono generado en runtime. */
export function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([typeBuf, data])) {
    crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** Tooltip del tray por estado (texto visible al usuario). */
export function trayTooltipFor(status: EgoTrayStatus): string {
  if (status === "thinking") return "Ego — pensando…";
  if (status === "hitl") return "Ego — requiere aprobación (HITL)";
  return "Ego — inactivo";
}
