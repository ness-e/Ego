/**
 * T3 (Ola 5) — Canal IPC `ipc.settings.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import {
  ModelConfigSchema,
  type ModelConfig,
  PermissionsSettingsSchema,
} from "../../../ipc/schema.js";
import {
  decryptCredential,
  encryptCredential,
} from "../../credentials/vault.js";
import {
  applyModelConfig,
  currentModelConfig,
  isNonEmptyKey,
  probeModelKey,
  setCurrentModelConfig,
  setupModelProviders,
  type ModelKeyProbeResult,
} from "../../models/model-config.js";
import {
  cachedPermissionsSettings,
  setCachedPermissionsSettings,
} from ".././ipc-state.js";
import {
  isMaskedValue,
  PROVIDER_KEY_FIELDS,
  toMaskedModelConfigResponse,
  unwrapSettingsPayload,
  ProviderKeyField,
} from "../domain-support.js";

import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.settings.*`. */
export function registerSettingsIpc(deps: IpcDeps): void {
  const {
    adapter,
    dbPath,
    eventBus,
    getCachedPermissionsSettings,
    modelRouter,
    parsePermissionsSettings,
    syncModelCredentialPool,
    userDataDir,
  } = deps;

  ipcMain.handle("ipc.settings.getModelConfig", async () => {
    try {
      const savedConfig = await adapter.get("gov/settings", "model_config");
      const payload = unwrapSettingsPayload(savedConfig);
      if (payload) {
        // Migración plano→cifrado de campos por proveedor (el saver Task 10 ya
        // escribe el shape nuevo; esto solo tolera restos legados en plano).
        // Se conserva el resto del payload (spread): nunca se dropean campos.
        const nextPayload: Record<string, unknown> = { ...payload };
        let needsPersist = false;
        for (const field of [...PROVIDER_KEY_FIELDS, "apiKey"] as const) {
          const plainValue = nextPayload[field];
          if (typeof plainValue === "string" && plainValue.length > 0 && !isMaskedValue(plainValue)) {
            nextPayload[`${field}Encrypted`] = encryptCredential(plainValue);
            delete nextPayload[field];
            needsPersist = true;
          }
        }
        if (needsPersist) {
          await adapter.put({
            namespace: "gov/settings",
            key: "model_config",
            payload: nextPayload,
            metadata: { updatedAtMs: Date.now(), migrated: true },
          });
        }
        const stored = needsPersist ? nextPayload : payload;

        // Resolver cada key descifrada SOLO en main (nunca sale en claro).
        // `activeProvider` se acepta solo si pertenece al enum canónico.
        const ACTIVE_PROVIDERS = ["openai", "anthropic", "google", "deepseek", "ollama", "mock"] as const;
        const storedProvider = typeof stored.activeProvider === "string" ? stored.activeProvider : "";
        const resolved: ModelConfig = {
          activeProvider: (ACTIVE_PROVIDERS as readonly string[]).includes(storedProvider)
            ? (storedProvider as ModelConfig["activeProvider"])
            : currentModelConfig.activeProvider,
          baseUrl:
            typeof stored.baseUrl === "string" ? stored.baseUrl : currentModelConfig.baseUrl,
          modelName:
            typeof stored.modelName === "string" ? stored.modelName : currentModelConfig.modelName,
          openaiBaseURL:
            typeof stored.openaiBaseURL === "string" ? stored.openaiBaseURL : currentModelConfig.openaiBaseURL,
          deepseekBaseURL:
            typeof stored.deepseekBaseURL === "string" ? stored.deepseekBaseURL : currentModelConfig.deepseekBaseURL,
          ollamaBaseURL:
            typeof stored.ollamaBaseURL === "string" ? stored.ollamaBaseURL : currentModelConfig.ollamaBaseURL,
          // STAB-06: tuning persistido (validado; inválido → memoria).
          reasoningEffort:
            stored.reasoningEffort === "low" ||
            stored.reasoningEffort === "medium" ||
            stored.reasoningEffort === "high"
              ? stored.reasoningEffort
              : currentModelConfig.reasoningEffort,
          temperature:
            typeof stored.temperature === "number" &&
            stored.temperature >= 0 &&
            stored.temperature <= 2
              ? stored.temperature
              : currentModelConfig.temperature,
        };
        for (const field of [...PROVIDER_KEY_FIELDS, "apiKey"] as const) {
          const enc = stored[`${field}Encrypted`];
          if (typeof enc === "string" && enc.length > 0) {
            const decrypted = decryptCredential(enc);
            if (isNonEmptyKey(decrypted)) {
              (resolved as Record<string, unknown>)[field] = decrypted;
            }
          }
        }
        // Sin `...Encrypted` persistido, conservar el valor en memoria.
        for (const field of [...PROVIDER_KEY_FIELDS, "apiKey"] as const) {
          if (!(resolved as Record<string, unknown>)[field] && isNonEmptyKey(currentModelConfig[field])) {
            (resolved as Record<string, unknown>)[field] = currentModelConfig[field];
          }
        }
        setCurrentModelConfig({ ...currentModelConfig, ...resolved });
        return toMaskedModelConfigResponse(currentModelConfig);
      }
    } catch {
      // noop
    }
    return toMaskedModelConfigResponse(currentModelConfig);
  });

  ipcMain.handle("ipc.settings.saveModelConfig", async (_e, rawReq: unknown) => {
    // BUGFIX 2026-10-14 (save rechazado con "" ): el getter enmascarado emite
    // `""` para keys ausentes y varios senders reenvían `cfg` con spread
    // (`App.tsx:74`). `""` presente falla `min(1)` y tumba TODO el guardado
    // (incluida la key válida). `""`/blanco = ausente: se normaliza ANTES del
    // safeParse; el schema sigue rechazando tipos inválidos.
    let sanitizedReq = rawReq;
    if (sanitizedReq && typeof sanitizedReq === "object" && !Array.isArray(sanitizedReq)) {
      const copy = { ...(sanitizedReq as Record<string, unknown>) };
      for (const f of [
        "apiKey", "openaiKey", "anthropicKey", "googleKey", "deepseekKey",
        "baseUrl", "openaiBaseURL", "deepseekBaseURL", "ollamaBaseURL", "modelName",
      ] as const) {
        const v = copy[f];
        if (typeof v === "string" && v.trim().length === 0) delete copy[f];
      }
      sanitizedReq = copy;
    }
    const parseResult = ModelConfigSchema.safeParse(sanitizedReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Configuración de modelo inválida: ${parseResult.error.message}`);
    }
    const incoming = parseResult.data;

    // Fallback persistido descifrado (solo main): un campo por proveedor no
    // provisto (undefined) o enmascarado NUNCA borra el secreto guardado.
    let persisted: Record<string, unknown> = {};
    try {
      const saved = await adapter.get("gov/settings", "model_config");
      persisted = unwrapSettingsPayload(saved) ?? {};
    } catch {
      // noop: sin persistido, el fallback es la memoria
    }
    const persistedDecrypted = (field: string): string | undefined => {
      const enc = persisted[`${field}Encrypted`];
      if (typeof enc === "string" && enc.length > 0) {
        const decrypted = decryptCredential(enc);
        if (isNonEmptyKey(decrypted)) return decrypted;
      }
      const plain = persisted[field];
      if (typeof plain === "string" && isNonEmptyKey(plain) && !isMaskedValue(plain)) return plain;
      return undefined;
    };
    const keepOrIncoming = (field: ProviderKeyField | "apiKey"): string | undefined => {
      const v = incoming[field];
      if (isNonEmptyKey(v) && !isMaskedValue(v)) return v;
      // Máscara o ausente: conservar el secreto guardado (memoria o disco).
      // NUNCA se persiste ni retorna la máscara como si fuera el secreto.
      if (isNonEmptyKey(currentModelConfig[field])) return currentModelConfig[field];
      return persistedDecrypted(field);
    };

    const effectiveProviderKeys: Record<ProviderKeyField, string | undefined> = {
      openaiKey: keepOrIncoming("openaiKey"),
      anthropicKey: keepOrIncoming("anthropicKey"),
      googleKey: keepOrIncoming("googleKey"),
      deepseekKey: keepOrIncoming("deepseekKey"),
    };
    // `""` explícito en el legado = limpiar (compat con el fallback mock);
    // máscara o ausente = conservar. Una máscara con proveedor distinto NUNCA
    // se almacena (evita persistir `sk-t...7890` como si fuera el secreto).
    let effectiveApiKey: string | undefined;
    const rawLegacy = incoming.apiKey;
    if (isNonEmptyKey(rawLegacy) && !isMaskedValue(rawLegacy)) {
      effectiveApiKey = rawLegacy;
    } else if (rawLegacy === "") {
      effectiveApiKey = undefined;
    } else {
      effectiveApiKey =
        incoming.activeProvider === currentModelConfig.activeProvider && isNonEmptyKey(currentModelConfig.apiKey)
          ? currentModelConfig.apiKey
          : persistedDecrypted("apiKey");
    }

    const effectiveConfig: ModelConfig = {
      ...incoming,
      ...effectiveProviderKeys,
      apiKey: effectiveApiKey,
    };

    // T13 probe-before-save (hermes P3): validar la key efectiva del
    // proveedor activo contra su API ANTES de persistir. Key inválida
    // (401/403/404) → throw accionable, NO se persiste nada. Red ausente
    // → se advierte pero se permite guardar con flag `probe` visible.
    const providerForProbe = effectiveConfig.activeProvider;
    const keyForProbe =
      providerForProbe === "openai"
        ? (effectiveProviderKeys.openaiKey ?? effectiveApiKey)
        : providerForProbe === "anthropic"
          ? (effectiveProviderKeys.anthropicKey ?? effectiveApiKey)
          : providerForProbe === "google"
            ? (effectiveProviderKeys.googleKey ?? effectiveApiKey)
            : providerForProbe === "deepseek"
              ? (effectiveProviderKeys.deepseekKey ?? effectiveApiKey)
              : undefined;
    let probe: ModelKeyProbeResult = { verified: true };
    if (providerForProbe !== "mock") {
      probe = await probeModelKey({
        provider: providerForProbe,
        ...(keyForProbe ? { key: keyForProbe } : {}),
        ...(isNonEmptyKey(effectiveConfig.openaiBaseURL) ? { openaiBaseURL: effectiveConfig.openaiBaseURL } : {}),
        ...(isNonEmptyKey(effectiveConfig.deepseekBaseURL) ? { deepseekBaseURL: effectiveConfig.deepseekBaseURL } : {}),
        ...(isNonEmptyKey(effectiveConfig.ollamaBaseURL) ? { ollamaBaseURL: effectiveConfig.ollamaBaseURL } : {}),
      });
    }

    applyModelConfig(modelRouter, effectiveConfig);
    // Registrar también las keys no activas para multi-proveedor (reúso Task 9).
    setupModelProviders(modelRouter, {
      ...(isNonEmptyKey(effectiveProviderKeys.openaiKey) ? { openai: effectiveProviderKeys.openaiKey } : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.anthropicKey) ? { anthropic: effectiveProviderKeys.anthropicKey } : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.googleKey) ? { google: effectiveProviderKeys.googleKey } : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.deepseekKey) ? { deepseek: effectiveProviderKeys.deepseekKey } : {}),
      ...(isNonEmptyKey(effectiveConfig.openaiBaseURL) ? { openaiBaseURL: effectiveConfig.openaiBaseURL } : {}),
      ...(isNonEmptyKey(effectiveConfig.deepseekBaseURL) ? { deepseekBaseURL: effectiveConfig.deepseekBaseURL } : {}),
      ...(isNonEmptyKey(effectiveConfig.ollamaBaseURL) ? { ollamaBaseURL: effectiveConfig.ollamaBaseURL } : {}),
    });
    // T21: rehidratar el pool con las keys efectivas recién guardadas.
    await syncModelCredentialPool(modelRouter, {
      ...(isNonEmptyKey(effectiveProviderKeys.openaiKey) ? { openai: effectiveProviderKeys.openaiKey } : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.anthropicKey) ? { anthropic: effectiveProviderKeys.anthropicKey } : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.googleKey) ? { google: effectiveProviderKeys.googleKey } : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.deepseekKey) ? { deepseek: effectiveProviderKeys.deepseekKey } : {}),
    });

    // Cifrar cada key por proveedor antes de persistir. NUNCA texto plano ni máscaras.
    const payloadToStore: Record<string, unknown> = {
      activeProvider: effectiveConfig.activeProvider,
      ...(isNonEmptyKey(effectiveApiKey) ? { apiKeyEncrypted: encryptCredential(effectiveApiKey) } : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.openaiKey)
        ? { openaiKeyEncrypted: encryptCredential(effectiveProviderKeys.openaiKey) }
        : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.anthropicKey)
        ? { anthropicKeyEncrypted: encryptCredential(effectiveProviderKeys.anthropicKey) }
        : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.googleKey)
        ? { googleKeyEncrypted: encryptCredential(effectiveProviderKeys.googleKey) }
        : {}),
      ...(isNonEmptyKey(effectiveProviderKeys.deepseekKey)
        ? { deepseekKeyEncrypted: encryptCredential(effectiveProviderKeys.deepseekKey) }
        : {}),
      ...(isNonEmptyKey(effectiveConfig.baseUrl) ? { baseUrl: effectiveConfig.baseUrl } : {}),
      ...(isNonEmptyKey(effectiveConfig.openaiBaseURL) ? { openaiBaseURL: effectiveConfig.openaiBaseURL } : {}),
      ...(isNonEmptyKey(effectiveConfig.deepseekBaseURL) ? { deepseekBaseURL: effectiveConfig.deepseekBaseURL } : {}),
      ...(isNonEmptyKey(effectiveConfig.ollamaBaseURL) ? { ollamaBaseURL: effectiveConfig.ollamaBaseURL } : {}),
      ...(isNonEmptyKey(effectiveConfig.modelName) ? { modelName: effectiveConfig.modelName } : {}),
      // STAB-06: tuning en claro junto al resto no-secreto (nunca cifrado).
      ...(effectiveConfig.reasoningEffort !== undefined ? { reasoningEffort: effectiveConfig.reasoningEffort } : {}),
      ...(effectiveConfig.temperature !== undefined ? { temperature: effectiveConfig.temperature } : {}),
    };

    await adapter.put({
      namespace: "gov/settings",
      key: "model_config",
      payload: payloadToStore,
      metadata: { updatedAtMs: Date.now() },
    });

    eventBus?.emit("settings.model_updated", {
      activeProvider: effectiveConfig.activeProvider,
      timestamp: Date.now(),
    }, {
      source: "desktop.ipc.settings.saveModelConfig",
      severity: "info",
    });

    // Respuesta enmascarada hacia el Renderer (ningún secreto en claro).
    // `probe` expone el resultado de la validación previa (verified/warn).
    return {
      ok: true,
      config: toMaskedModelConfigResponse({ ...effectiveConfig, apiKey: effectiveApiKey }),
      probe,
    };
  });

  ipcMain.handle("ipc.settings.getPermissions", async () => {
    try {
      const saved = await adapter.get("gov/settings", "permissions");
      const payload = unwrapSettingsPayload(saved);
      if (payload) {
        setCachedPermissionsSettings(parsePermissionsSettings(payload));
        return { ok: true, settings: cachedPermissionsSettings };
      }
    } catch {
      // noop: sin persistido, responde el cache/defaults
    }
    return { ok: true, settings: getCachedPermissionsSettings() };
  });

  ipcMain.handle("ipc.settings.savePermissions", async (_e, rawReq: unknown) => {
    const parseResult = PermissionsSettingsSchema.safeParse(rawReq ?? {});
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    await adapter.put({
      namespace: "gov/settings",
      key: "permissions",
      payload: parseResult.data,
      metadata: { updatedAtMs: Date.now() },
    });
    setCachedPermissionsSettings(parseResult.data);
    try {
      await adapter.recordAudit(
        "gov/settings",
        "permissions",
        { action: "save", defaultMode: parseResult.data.permissions.defaultMode },
        "user"
      );
    } catch {
      // noop: auditoría best-effort, el guardado ya se aplicó
    }
    return { ok: true, settings: parseResult.data };
  });

  ipcMain.handle("ipc.settings.getStorageInfo", async () => {
    let namespaces: string[] = [];
    try {
      namespaces = await adapter.listNamespaces();
    } catch {
      // noop: best-effort, el resto de la info sigue disponible
    }
    return {
      ok: true,
      userDataDir,
      dbPath,
      operational: adapter.ready,
      platform: process.platform,
      namespaces,
    };
  });

  ipcMain.handle("ipc.settings.getGovPolicies", async () => {
    const records = await adapter.list("gov/policies", 100);
    const policies = records.map((r) => ({
      key: r.key,
      payload: r.payload,
      metadata: r.metadata,
    }));
    return { ok: true, policies };
  });
}
