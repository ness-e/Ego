import * as crypto from "node:crypto";

export type OpaquePrefix =
  | "sess"  // Sesión de conversación
  | "turn"  // Turno de interacción
  | "step"  // Paso cognitivo del modelo
  | "call"  // Llamada a herramienta / tool
  | "art"   // Artefacto generado
  | "snap"  // Snapshot o checkpoint
  | "msg"   // Mensaje individual
  | "sub"   // Sub-Ego dinámico
  | "task"; // Tarea en segundo plano

export interface ParsedOpaqueId {
  prefix: string;
  timestamp: number;
  entropy: string;
  isValid: boolean;
}

const OPAQUE_ID_REGEX = /^([a-z0-9]+)_([a-z0-9]{7,11})_([a-z0-9]{8,16})$/i;

/**
 * Genera un identificador opaco, inmutable y ordenable cronológicamente
 * siguiendo el patrón canónico de DeepSeek-Harness (DSEK-03).
 *
 * Formato: `${prefix}_${timestamp_base36}_${entropy}`
 * Ejemplo: `sess_m4k1l0p2_a7b9c1d2e3f4`
 */
export function generateOpaqueId(prefix: OpaquePrefix | string = "sess"): string {
  const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, "") || "id";
  const now = Date.now();
  // Timestamp base36 asegurando orden lexicográfico temporal
  const tsPart = now.toString(36).padStart(8, "0");
  // 6 bytes de entropía criptográfica segura en formato hex (12 chars)
  const entropy = crypto.randomBytes(6).toString("hex");

  return `${cleanPrefix}_${tsPart}_${entropy}`;
}

/**
 * Descompone y valida un identificador opaco generado por Ego.
 */
export function parseOpaqueId(id: string): ParsedOpaqueId {
  const match = OPAQUE_ID_REGEX.exec(id);
  if (!match) {
    return {
      prefix: "",
      timestamp: 0,
      entropy: "",
      isValid: false,
    };
  }

  const prefix = match[1];
  const tsRaw = match[2];
  const entropy = match[3];
  const timestamp = parseInt(tsRaw, 36);

  return {
    prefix,
    timestamp: Number.isSafeInteger(timestamp) ? timestamp : 0,
    entropy,
    isValid: true,
  };
}

/**
 * Verifica si una cadena cumple con la estructura canónica de ID opaco.
 */
export function isOpaqueId(id: string, expectedPrefix?: OpaquePrefix | string): boolean {
  const parsed = parseOpaqueId(id);
  if (!parsed.isValid) return false;
  if (expectedPrefix && parsed.prefix !== expectedPrefix.toLowerCase()) return false;
  return true;
}
