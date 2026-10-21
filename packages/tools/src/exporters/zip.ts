import { deflateRawSync, inflateRawSync, crc32 as zlibCrc32 } from "node:zlib";

/**
 * zip.ts — escritor ZIP mínimo, sin dependencias, para los formatos OOXML.
 *
 * CONTEXTO (E4, Ola 3)
 * ---------------------
 * DOCX, XLSX y PPTX son contenedores **ZIP + XML**. Node trae `zlib` con
 * `deflateRawSync` (método 8 del ZIP) y `crc32` (Node ≥ 20.15). Con eso se
 * puede escribir un ZIP válido con **cero dependencias**.
 *
 * POR QUÉ NO UNA LIBRERÍA DE ZIP
 * ------------------------------
 * Las candidatas (`jszip` MIT/GPL dual, `archiver` MIT, `fflate` MIT) obligan
 * a un ciclo de instalación de A7 y `jszip` es *dual* (MIT OR GPL-3.0), que
 * es exactamente el tipo de cláusula que el guardrail de licencias quiere
 * evitar. `zlib` es parte del runtime: no hay superficie de suministro.
 *
 * FORMATO IMPLEMENTADO (PKWARE APPNOTE 6.3.3, sólo lo necesario)
 * ---------------------------------------------------------------
 * - Local file header (0x04034b50) + datos + descriptor de datos (bit 3).
 * - Directorio central (0x02014b50) por entrada.
 * - End of central directory (0x06054b50).
 * - Métodos: 0 (store) y 8 (deflate).
 */

/** Entrada de un archivo ZIP. */
export interface ZipEntry {
  /** Ruta dentro del contenedor (separador `/`). */
  readonly name: string;
  /** Contenido (texto o bytes). */
  readonly data: string | Uint8Array;
  /** Fuerza el método 0 (store) en vez de 8 (deflate). */
  readonly store?: boolean;
}

/** Resultado de construir un ZIP. */
export interface ZipArchive {
  /** Bytes del archivo ZIP completo. */
  readonly bytes: Uint8Array;
  /** Nombres de las entradas, en orden. */
  readonly names: string[];
}

/**
 * CRC-32 (IEEE 802.3) de un buffer.
 * Usa `zlib.crc32` (Node ≥ 20.15) y cae a una implementación por tabla si
 * el runtime no lo expone.
 */
export function crc32(data: Uint8Array): number {
  if (typeof zlibCrc32 === "function") {
    return zlibCrc32(data) >>> 0;
  }
  // Fallback: tabla polinómica 0xEDB88320.
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Marca de tiempo DOS fija (2024-01-01 00:00:00) → salidas deterministas. */
const DOS_TIME = 0;
/** Fecha DOS: (año-1980)<<9 | mes<<5 | día. */
const DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1;

/** Codifica una cadena a UTF-8. */
function toBytes(data: string | Uint8Array): Uint8Array {
  return typeof data === "string" ? new TextEncoder().encode(data) : data;
}

/** Escribe un entero little-endian de 2 bytes. */
function writeU16(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

/** Escribe un entero little-endian de 4 bytes. */
function writeU32(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

/**
 * Construye un archivo ZIP válido a partir de sus entradas.
 */
export function buildZip(entries: readonly ZipEntry[]): ZipArchive {
  const localParts: number[] = [];
  const centralParts: number[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const raw = toBytes(entry.data);

    let method = 0;
    let payload = raw;
    if (!entry.store && raw.length > 0) {
      const deflated = deflateRawSync(raw, { level: 6 });
      // Sólo merece la pena comprimir si no crece (p.ej. datos ya comprimidos).
      if (deflated.length < raw.length) {
        method = 8;
        payload = new Uint8Array(deflated);
      }
    }

    const crc = crc32(raw);

    // --- Local file header ---
    writeU32(localParts, 0x04034b50);
    writeU16(localParts, 20); // version needed
    writeU16(localParts, 0); // flags
    writeU16(localParts, method);
    writeU16(localParts, DOS_TIME);
    writeU16(localParts, DOS_DATE);
    writeU32(localParts, crc);
    writeU32(localParts, payload.length);
    writeU32(localParts, raw.length);
    writeU16(localParts, nameBytes.length);
    writeU16(localParts, 0); // extra length
    localParts.push(...nameBytes);
    localParts.push(...payload);

    // --- Central directory entry ---
    writeU32(centralParts, 0x02014b50);
    writeU16(centralParts, 20); // version made by
    writeU16(centralParts, 20); // version needed
    writeU16(centralParts, 0); // flags
    writeU16(centralParts, method);
    writeU16(centralParts, DOS_TIME);
    writeU16(centralParts, DOS_DATE);
    writeU32(centralParts, crc);
    writeU32(centralParts, payload.length);
    writeU32(centralParts, raw.length);
    writeU16(centralParts, nameBytes.length);
    writeU16(centralParts, 0); // extra
    writeU16(centralParts, 0); // comment
    writeU16(centralParts, 0); // disk number
    writeU16(centralParts, 0); // internal attrs
    writeU32(centralParts, 0); // external attrs
    writeU32(centralParts, offset);
    centralParts.push(...nameBytes);

    offset += 30 + nameBytes.length + payload.length;
  }

  const centralSize = centralParts.length;
  const centralOffset = offset;

  // --- End of central directory ---
  const end: number[] = [];
  writeU32(end, 0x06054b50);
  writeU16(end, 0); // disk number
  writeU16(end, 0); // disk with CD
  writeU16(end, entries.length);
  writeU16(end, entries.length);
  writeU32(end, centralSize);
  writeU32(end, centralOffset);
  writeU16(end, 0); // comment length

  const bytes = new Uint8Array([...localParts, ...centralParts, ...end]);
  return { bytes, names: entries.map((e) => e.name) };
}

/**
 * Lee los nombres de las entradas de un ZIP (sólo el directorio central).
 *
 * Lo usan los tests para verificar la estructura del artefacto generado
 * (y cualquier consumidor que quiera inspeccionarlo sin descomprimir).
 */
export function listZipEntryNames(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const names: string[] = [];

  // Busca el End of central directory desde el final.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65535; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error("ZIP inválido: no se encuentra el End of Central Directory.");
  }

  const total = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);

  for (let i = 0; i < total; i++) {
    if (view.getUint32(pointer, true) !== 0x02014b50) {
      throw new Error("ZIP inválido: firma del directorio central incorrecta.");
    }
    const nameLen = view.getUint16(pointer + 28, true);
    const extraLen = view.getUint16(pointer + 30, true);
    const commentLen = view.getUint16(pointer + 32, true);
    const name = new TextDecoder().decode(
      bytes.subarray(pointer + 46, pointer + 46 + nameLen)
    );
    names.push(name);
    pointer += 46 + nameLen + extraLen + commentLen;
  }

  return names;
}

/**
 * Extrae el contenido (descomprimido) de una entrada del ZIP.
 */
export function readZipEntry(bytes: Uint8Array, entryName: string): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65535; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error("ZIP inválido: no se encuentra el End of Central Directory.");
  }

  const total = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);

  for (let i = 0; i < total; i++) {
    const nameLen = view.getUint16(pointer + 28, true);
    const extraLen = view.getUint16(pointer + 30, true);
    const commentLen = view.getUint16(pointer + 32, true);
    const name = new TextDecoder().decode(
      bytes.subarray(pointer + 46, pointer + 46 + nameLen)
    );
    if (name === entryName) {
      const localOffset = view.getUint32(pointer + 42, true);
      const localNameLen = view.getUint16(localOffset + 26, true);
      const localExtraLen = view.getUint16(localOffset + 28, true);
      const method = view.getUint16(localOffset + 8, true);
      const compressedSize = view.getUint32(localOffset + 18, true);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      const payload = bytes.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return new Uint8Array(payload);
      if (method === 8) {
        return new Uint8Array(inflateRawSync(payload));
      }
      throw new Error(`Método de compresión ZIP no soportado: ${method}`);
    }
    pointer += 46 + nameLen + extraLen + commentLen;
  }

  throw new Error(`La entrada '${entryName}' no existe en el ZIP.`);
}
