/**
 * T3 (Ola 5) — Utilidades compartidas por los módulos de dominio IPC.
 *
 * Los helpers que usan MÁS DE UN dominio (p. ej. el enmascarado de las
 * keys de proveedor, que consumen `settings` y `snapshots`) viven aquí:
 * duplicarlos sería crear dos verdades; meterlos en un dominio los
 * ataría a ese dominio.
 */
import { maskApiKey } from "../credentials/vault.js";
import type { ModelConfig } from "../../ipc/schema.js";

export const isMaskedValue = (v: unknown): v is string =>
  typeof v === "string" && (v.includes("...") || v.includes("••••"));

export const PROVIDER_KEY_FIELDS = ["openaiKey", "anthropicKey", "googleKey", "deepseekKey"] as const;

export const toMaskedModelConfigResponse = (cfg: ModelConfig) => ({
  activeProvider: cfg.activeProvider,
  apiKey: maskApiKey(cfg.apiKey || ""),
  openaiKey: maskApiKey(cfg.openaiKey || ""),
  anthropicKey: maskApiKey(cfg.anthropicKey || ""),
  googleKey: maskApiKey(cfg.googleKey || ""),
  deepseekKey: maskApiKey(cfg.deepseekKey || ""),
  baseUrl: cfg.baseUrl,
  openaiBaseURL: cfg.openaiBaseURL,
  deepseekBaseURL: cfg.deepseekBaseURL,
  ollamaBaseURL: cfg.ollamaBaseURL,
  modelName: cfg.modelName,
  // STAB-06: tuning en claro (no son secretos; el renderer los muestra).
  reasoningEffort: cfg.reasoningEffort,
  temperature: cfg.temperature,
});

export const unwrapSettingsPayload = (saved: unknown): Record<string, unknown> | null => {
  let payload: unknown = saved;
  if (typeof saved === "object" && saved !== null && "payload" in saved) {
    payload = (saved as { payload: unknown }).payload;
  }
  if (payload && typeof payload === "object") return payload as Record<string, unknown>;
  return null;
};

export type ProviderKeyField = (typeof PROVIDER_KEY_FIELDS)[number];
