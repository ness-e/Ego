/**
 * T11 (EGO-FIND-54) — extracción de bloques COHESIVOS de `main.ts`.
 *
 * Uso: node apps/desktop/scripts/t11-extract.cjs
 * Idempotente: si el módulo destino ya existe, no hace nada.
 */
const fs = require("node:fs");
const path = require("node:path");

const MAIN = path.join(__dirname, "..", "src", "main.ts");
const OUT = path.join(__dirname, "..", "src", "main");

const read = () => fs.readFileSync(MAIN, "utf8");
const write = (s) => fs.writeFileSync(MAIN, s, "utf8");

/** Corta el bloque [startMarker, endMarker] y lo devuelve. */
function cut(src, startMarker, endMarker) {
  const i = src.indexOf(startMarker);
  if (i < 0) throw new Error(`start no encontrado: ${startMarker}`);
  const j = src.indexOf(endMarker, i);
  if (j < 0) throw new Error(`end no encontrado: ${endMarker}`);
  const end = j + endMarker.length;
  return {
    block: src.slice(i, end),
    rest: src.slice(0, i) + src.slice(end),
  };
}

function writeModule(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
  console.log(`  escrito ${rel} (${content.split("\n").length} líneas)`);
}

function main() {
  let src = read();

  // ─── Bloque A: credenciales / vault (safeStorage) ────────────────────────
  if (!fs.existsSync(path.join(OUT, "credentials", "vault.ts"))) {
    const r = cut(
      src,
      "/**\n * Backend de cifrado canónico (@ego/security)",
      "export const maskKey = maskApiKey;"
    );
    src = r.rest;
    writeModule(
      path.join("credentials", "vault.ts"),
      `/**
 * T11 (EGO-FIND-54) — Vault de credenciales del main process.
 *
 * Extraído de \`main.ts\` (god-file) sin cambiar comportamiento:
 *  - \`encryptCredential\` / \`decryptCredential\`: safeStorage del SO
 *    (Keychain/DPAPI). Sin cifrado disponible → ofuscación legada \`obf:\`
 *    (migración), NUNCA texto plano.
 *  - \`maskApiKey\`: enmascarado para respuestas al renderer.
 *
 * Este módulo es la ÚNICA fuente de verdad del cifrado en el main: el
 * renderer nunca ve un secreto en claro.
 */
import { safeStorage } from "electron";
import { CredentialManager, SyncSafeStorageBackend } from "@ego/security";

${r.block}
`
    );
  }

  // ─── Bloque B: model-config (BYOK + ModelRouter) ─────────────────────────
  if (!fs.existsSync(path.join(OUT, "models", "model-config.ts"))) {
    const r = cut(
      src,
      "/**\n * Claves de proveedor resueltas SOLO en main",
      "  // 7. Mock siempre: fallback determinista sin keys ni red.\n  router.registerProvider(new MockProvider());\n}"
    );
    src = r.rest;
    // `currentModelConfig` pasa a ser estado del módulo: main.ts necesita
    // leerlo (binding vivo) y escribirlo (setter explícito).
    const block = r.block
      .replace(
        "export let currentModelConfig: ModelConfig = {",
        `/**
 * Configuración de modelo vigente en memoria (NUNCA sale del main).
 * Es estado del módulo: \`main.ts\` lo lee (binding vivo) y lo escribe
 * con \`setCurrentModelConfig\`.
 */
export let currentModelConfig: ModelConfig = {`
      )
      .replace(
        "  currentModelConfig = { ...valid };",
        "  setCurrentModelConfig({ ...valid });"
      );

    writeModule(
      path.join("models", "model-config.ts"),
      `/**
 * T11 (EGO-FIND-54) — Configuración de modelo (BYOK) y registro de
 * proveedores en el \`ModelRouter\`.
 *
 * Extraído de \`main.ts\` (god-file) sin cambiar comportamiento:
 *  - Resolución de keys: bootstrap env + payload persistido (cifrado).
 *  - \`applyModelConfig\`: valida con Zod y registra el proveedor activo.
 *  - \`setupModelProviders\`: registra los proveedores con key + Ollama +
 *    \`MockProvider\` (fallback determinista, siempre presente).
 *  - \`probeModelKey\`: valida la key contra la API del proveedor ANTES de
 *    persistir. La key viaja solo en el header/query: nunca en logs.
 */
import { createHash } from "node:crypto";
import {
  AiSdkAnthropicProvider,
  AiSdkGoogleProvider,
  AiSdkOpenAICompatibleProvider,
  AiSdkOpenAIProvider,
  MockProvider,
  ModelRouter,
  OLLAMA_DEFAULT_BASE_URL,
  OpenAICompatibleProvider,
  type CatalogProviderId,
} from "@ego/models";
import { ModelConfigSchema, type ModelConfig } from "../../ipc/schema.js";
import { decryptCredential } from "../credentials/vault.js";

${block}

/**
 * Escribe la configuración vigente (solo main). Sustituye la asignación
 * directa a \`currentModelConfig\` desde fuera del módulo.
 */
export function setCurrentModelConfig(config: ModelConfig): void {
  currentModelConfig = { ...config };
}
`
    );
  }

  write(src);
  console.log("T11: bloques extraídos.");
}

main();
