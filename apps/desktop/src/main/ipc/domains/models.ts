/**
 * T3 (Ola 5) — Canal IPC `ipc.models.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import {
  ModelCatalog,
  CATALOG_CACHE_TTL_MS,
  type CatalogProviderId,
} from "@ego/models";
import { ModelsListSchema } from "../../../ipc/schema.js";
import {
  currentModelConfig,
  getConfiguredProviders,
  mergeModelKeys,
  resolveCatalogCredentials,
  resolveEnvModelKeys,
  resolveMemoryModelKeys,
} from "../../models/model-config.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.models.*`. */
export function registerModelsIpc(deps: IpcDeps): void {
  const {
    adapter,
  } = deps;

  const modelCatalog = new ModelCatalog({
    cache: {
      load: async (key) => {
        try {
          const record = await adapter.get("gov/catalog", key);
          const payload = record?.payload as { models?: unknown; savedAtMs?: unknown } | undefined;
          if (!payload || !Array.isArray(payload.models) || typeof payload.savedAtMs !== "number") return null;
          const models = payload.models.filter((m): m is string => typeof m === "string");
          return { models, savedAtMs: payload.savedAtMs };
        } catch {
          return null;
        }
      },
      save: async (key, value) => {
        try {
          await adapter.put({
            namespace: "gov/catalog",
            key,
            payload: { models: value.models, savedAtMs: value.savedAtMs },
            metadata: { updatedAtMs: Date.now() },
            ttl_ms: CATALOG_CACHE_TTL_MS,
          });
        } catch {
          // Best-effort: el live igual se retorna al renderer.
        }
      },
    },
  });

  ipcMain.handle("ipc.models.listProviders", async () => {
    const keys = mergeModelKeys(resolveEnvModelKeys(), resolveMemoryModelKeys(currentModelConfig));
    return { ok: true, providers: getConfiguredProviders(keys) };
  });

  ipcMain.handle("ipc.models.listModels", async (_e, rawReq: unknown) => {
    const parsed = ModelsListSchema.safeParse(rawReq);
    if (!parsed.success) {
      throw new Error(`[IPC Security] Solicitud de catálogo inválida: ${parsed.error.message}`);
    }
    const provider: CatalogProviderId = parsed.data.provider;
    const keys = mergeModelKeys(resolveEnvModelKeys(), resolveMemoryModelKeys(currentModelConfig));
    const creds = resolveCatalogCredentials(provider, keys);
    return {
      ok: true,
      provider,
      ...(await modelCatalog.listModels({
        provider,
        refresh: parsed.data.refresh,
        credentialFingerprint: creds.credentialFingerprint,
        ...(creds.apiKey !== undefined ? { apiKey: creds.apiKey } : {}),
        ...(creds.baseURL !== undefined ? { baseURL: creds.baseURL } : {}),
      })),
    };
  });
}
