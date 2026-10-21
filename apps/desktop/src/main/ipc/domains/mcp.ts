/**
 * T3 (Ola 5) — Canal IPC `ipc.mcp.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import { type McpServerConfig } from "@ego/integrations";
import {
  AddMcpServerSchema,
  RemoveMcpServerSchema,
  ToggleMcpServerSchema,
  ListToolsFilterSchema,
} from "../../../ipc/schema.js";
import {
  splitMcpServerEnv,
  mcpEnvVaultService,
  collectStorableMcpSecrets,
} from "../../mcp-env.js";
import {
  decryptCredential,
  encryptCredential,
} from "../../credentials/vault.js";
import { PersistedMcpServerRecord } from "../../../main.js";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.mcp.*`. */
export function registerMcpIpc(deps: IpcDeps): void {
  const {
    adapter,
    buildMcpPersistedRecord,
    deleteMcpEnvSecrets,
    extractPersistedMcpRecord,
    getMcpCredentialManager,
    mcpEnvKeysForCleanup,
    mcpManager,
    needsMcpEnvMigration,
    sanitizeMcpRuntimeStateForRenderer,
    storeMcpEnvSecrets,
  } = deps;

  ipcMain.handle("ipc.mcp.listServers", async () => {
    return mcpManager.listServers().map(sanitizeMcpRuntimeStateForRenderer);
  });

  ipcMain.handle("ipc.mcp.addServer", async (_e, rawReq: unknown) => {
    const parseResult = AddMcpServerSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Configuración de servidor MCP inválida: ${parseResult.error.message}`);
    }

    const { config, enabled } = parseResult.data;
    const vault = getMcpCredentialManager();
    const service = mcpEnvVaultService(config.id);
    // Secretos entrantes en claro (no máscaras) + conservación de lo guardado
    // cuando el renderer reenvía una máscara (patrón settings Task 10).
    const incomingSecrets = collectStorableMcpSecrets(config.env);
    const { publicEnv } = splitMcpServerEnv(config.env);
    const { secretNames } = splitMcpServerEnv(config.env);
    const resolvedSecrets: Record<string, string> = { ...incomingSecrets };
    const unresolvable: string[] = [];
    for (const name of secretNames) {
      if (resolvedSecrets[name] !== undefined) continue;
      let kept: string | null = null;
      try {
        kept = await vault.getSecret(service, name);
      } catch (err) {
        console.warn(`[Ego Main] Vault inaccesible para MCP '${config.id}' var '${name}':`, err);
      }
      if (kept !== null && kept.length > 0) {
        resolvedSecrets[name] = kept;
        continue;
      }
      try {
        const existing = await adapter.get("gov/mcp_servers", config.id);
        const prev = extractPersistedMcpRecord(existing?.payload);
        const blob: unknown = prev?.envRef?.encrypted[name];
        if (typeof blob === "string") {
          const decrypted = decryptCredential(blob);
          if (decrypted.length > 0) {
            resolvedSecrets[name] = decrypted;
            continue;
          }
        }
      } catch {
        // noop: sin previo descifrable la var queda ausente (warn visible abajo)
      }
      unresolvable.push(name);
    }
    if (unresolvable.length > 0) {
      console.warn(
        `[Ego Main] MCP '${config.id}' sin valor para: ${unresolvable.join(", ")} (máscara sin secreto guardado)`
      );
    }
    const fullEnv: Record<string, string> = { ...publicEnv, ...resolvedSecrets };
    const runtimeConfig: McpServerConfig = {
      ...config,
      ...(Object.keys(fullEnv).length > 0 ? { env: fullEnv } : {}),
    };
    const runtimeState = await mcpManager.registerServer(runtimeConfig, enabled);

    try {
      await storeMcpEnvSecrets(vault, config.id, resolvedSecrets);
    } catch (vaultErr) {
      console.warn(
        `[Ego Main] Vault no disponible para MCP '${config.id}' (persiste cifrado):`,
        vaultErr
      );
    }
    try {
      const persisted = buildMcpPersistedRecord(runtimeConfig, enabled, encryptCredential);
      await adapter.put({
        namespace: "gov/mcp_servers",
        key: config.id,
        payload: persisted,
        metadata: { updatedAtMs: Date.now() },
      });
    } catch (persistErr) {
      console.warn(`[Ego Main] Error al persistir servidor MCP '${config.id}' en VantaDB:`, persistErr);
    }

    return sanitizeMcpRuntimeStateForRenderer(runtimeState);
  });

  ipcMain.handle("ipc.mcp.removeServer", async (_e, rawReq: unknown) => {
    const parseResult = RemoveMcpServerSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de eliminación MCP inválida: ${parseResult.error.message}`);
    }

    const { id } = parseResult.data;
    const removed = await mcpManager.removeServer(id);

    try {
      const existing = await adapter.get("gov/mcp_servers", id);
      const prev = extractPersistedMcpRecord(existing?.payload);
      if (prev) {
        try {
          await deleteMcpEnvSecrets(getMcpCredentialManager(), id, mcpEnvKeysForCleanup(prev));
        } catch (vaultErr) {
          console.warn(`[Ego Main] Error al borrar secretos del vault para MCP '${id}':`, vaultErr);
        }
      }
      await adapter.delete("gov/mcp_servers", id);
    } catch (delErr) {
      console.warn(`[Ego Main] Error al borrar servidor MCP '${id}' en VantaDB:`, delErr);
    }

    return { success: removed, id };
  });

  ipcMain.handle("ipc.mcp.toggleServer", async (_e, rawReq: unknown) => {
    const parseResult = ToggleMcpServerSchema.safeParse(rawReq);
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Solicitud de alternar MCP inválida: ${parseResult.error.message}`);
    }

    const { id, enabled } = parseResult.data;
    const state = await mcpManager.toggleServer(id, enabled);

    try {
      const existing = await adapter.get("gov/mcp_servers", id);
      const prev = extractPersistedMcpRecord(existing?.payload);
      if (prev) {
        if (needsMcpEnvMigration(prev)) {
          const legacySecrets = collectStorableMcpSecrets(prev.config.env);
          try {
            await storeMcpEnvSecrets(getMcpCredentialManager(), id, legacySecrets);
          } catch (vaultErr) {
            console.warn(`[Ego Main] Vault no disponible al migrar MCP '${id}':`, vaultErr);
          }
          const migrated = buildMcpPersistedRecord(prev.config, enabled, encryptCredential);
          await adapter.put({
            namespace: "gov/mcp_servers",
            key: id,
            payload: migrated,
            metadata: { updatedAtMs: Date.now(), migrated: true },
          });
        } else {
          const next: PersistedMcpServerRecord = { ...prev, enabled };
          await adapter.put({
            namespace: "gov/mcp_servers",
            key: id,
            payload: next,
            metadata: { updatedAtMs: Date.now() },
          });
        }
      }
    } catch (updateErr) {
      console.warn(`[Ego Main] Error al actualizar estado de servidor MCP '${id}' en VantaDB:`, updateErr);
    }

    return sanitizeMcpRuntimeStateForRenderer(state);
  });

  ipcMain.handle("ipc.mcp.listTools", async (_e, rawReq: unknown) => {
    const parseResult = ListToolsFilterSchema.safeParse(rawReq || {});
    if (!parseResult.success) {
      throw new Error(`[IPC Security] Filtro de herramientas inválido: ${parseResult.error.message}`);
    }

    const filter = parseResult.data;
    const tools = mcpManager.listTools(filter);

    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      category: t.category,
      riskLevel: t.riskLevel,
      origin: t.origin,
      mcpServerId: t.mcpServerId,
      requiresApproval: t.requiresApproval ?? (t.riskLevel === "destructive" || t.riskLevel === "sensitive"),
    }));
  });
}
