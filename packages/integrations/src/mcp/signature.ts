import { createPublicKey, verify } from "node:crypto";
import type { McpServerConfig } from "./types.js";

/**
 * Dominio de firma de servidores MCP (R10). Versionado: cualquier cambio
 * del formato invalida firmas previas por diseño (fail-closed ante
 * downgrade).
 */
export const MCP_SIGNATURE_DOMAIN = "mcp-server-signature-v1";

/**
 * Payload canónico sujeto a firma: liga identidad (`id`, `name`) con el
 * binario spawnable (`command`). `args`/`env` se excluyen a propósito:
 * rotan por entorno sin exigir re-firmar; el spawn sigue protegido por la
 * allowlist H31 y la prohibición de `shell:true`.
 */
export function buildSignaturePayload(
  config: Pick<McpServerConfig, "id" | "name" | "command">,
): Buffer {
  return Buffer.from(
    `${MCP_SIGNATURE_DOMAIN}\n${config.id}\n${config.name}\n${config.command}\n`,
    "utf8",
  );
}

function toPublicKeyObject(publicKey: string): ReturnType<typeof createPublicKey> {
  const trimmed = publicKey.trim();
  if (trimmed.includes("BEGIN PUBLIC KEY")) {
    return createPublicKey(trimmed);
  }
  const raw = Buffer.from(trimmed, "base64");
  if (raw.length !== 32) {
    throw new Error(
      "[mcp-signature] publicKey base64 debe ser una clave Ed25519 cruda de 32 bytes.",
    );
  }
  return createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), raw]), format: "der", type: "spki" });
}

/**
 * Verifica la firma Ed25519 declarada en la config (R10, fail-closed).
 * Devuelve `true` solo si: `trustLevel` es `official`/`verified` Y hay
 * `publicKey` + `signature` presentes Y la firma verifica sobre el payload
 * canónico. Cualquier ausencia, malformación o error cripto → `false`.
 * Nunca lanza: el llamador (`isSignedServer`) traduce `false` a HITL.
 */
export function verifyServerSignature(config: McpServerConfig): boolean {
  try {
    if (config.trustLevel !== "official" && config.trustLevel !== "verified") {
      return false;
    }
    if (typeof config.signature !== "string" || config.signature.trim().length === 0) {
      return false;
    }
    if (typeof config.publicKey !== "string" || config.publicKey.trim().length === 0) {
      return false;
    }
    const key = toPublicKeyObject(config.publicKey);
    const signature = Buffer.from(config.signature.trim(), "base64");
    if (signature.length === 0) {
      return false;
    }
    return verify(null, buildSignaturePayload(config), key, signature);
  } catch {
    return false;
  }
}
