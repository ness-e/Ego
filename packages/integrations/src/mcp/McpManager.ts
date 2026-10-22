import { ToolRegistry, type ToolDefinition, type ToolRiskLevel } from "@ego/tools";
import type { EventBus } from "@ego/events";
import { McpClient } from "./McpClient.js";
import { assertSafeMcpHttpUrlAsync } from "./types.js";
import type { SecretResolver } from "./SecretProxy.js";
import type { McpServerConfig, McpToolDefinition, McpClientStatus, McpTokenStore, McpToolImportDecision } from "./types.js";

export interface McpServerRuntimeState {
  id: string;
  name: string;
  config: McpServerConfig;
  status: McpClientStatus;
  enabled: boolean;
  toolsCount: number;
  /** Result explícito (F1T2): `ok:false` + `lastError` en vez de estado tragado. */
  ok: boolean;
  lastError?: string;
  tools: McpToolDefinition[];
}

export interface McpManagerOptions {
  /**
   * Fuente de secretos para PATs/tokens (orden prod: Credential Manager).
   * Los conectores la resuelven vía `getTokenStore()`; `process.env` queda
   * solo como fallback documentado en tests.
   */
  tokenStore?: McpTokenStore;
  /**
   * Resolver de secretos (Decisión D2 / VERDICT R2).
   *
   * Se propaga al `McpClient` para que los marcadores `{{SECRET:<clave>}}`
   * se resuelvan **en el punto de uso** (la petición saliente al servidor) y
   * NO en el `env` del subproceso. Sin resolver, el marcador viaja intacto
   * (fail-closed: el servidor recibe un marcador, nunca el token).
   *
   * Antes de este option, `McpManager` construía el cliente sin opciones
   * (`new McpClient(config)`) → el resolver nunca llegaba, y la decisión D2
   * quedaba inerte en producción.
   */
  secretResolver?: SecretResolver;
  /**
   * Bus de eventos para **auditar** las decisiones de importación de tools
   * MCP (EGO-FIND-49, Ola 1b T1).
   *
   * Sin bus, la protección sigue activa (fail-closed: una tool nativa nunca
   * se sobrescribe), pero la traza no se emite. Con bus, cada override y
   * cada intento de tomar el control de una tool nativa emite un
   * `system.alert` con `code` `MCP_TOOL_OVERRIDE` o
   * `MCP_NATIVE_TOOL_PROTECTED`.
   */
  eventBus?: EventBus;
}

/**
 * Ámbito de propiedad de las tools que importa un servidor MCP (Ola 9).
 *
 * ## Por qué un tipo y no un parámetro suelto
 *
 * La vista filtrada del registro (A4, `packages/tools/src/subEgoView.ts`)
 * aplica la regla *"sin dueño ⇒ global"*: una tool sin `ownerSubEgoId` la ven
 * **todos** los Sub-Egos. Esa regla es segura **si** quien registra una tool
 * privada declara su dueño; es un agujero si no.
 *
 * Por eso el ámbito se declara **explícitamente** en la API y no se deduce:
 *
 * - `{ scope: "app" }` ⇒ la conexión la abre **la app** ⇒ las tools son
 *   **GLOBALES** (las configuró el usuario en los ajustes: son
 *   infraestructura compartida). **No es un olvido**: es la decisión.
 * - `{ scope: "sub-ego", ownerSubEgoId }` ⇒ la conexión la abre **un
 *   Sub-Ego** ⇒ sus tools son **privadas** de ese Sub-Ego.
 *
 * ## El caso real (a 2026-10-21)
 *
 * **No existe ningún camino en el que un Sub-Ego abra una conexión MCP**:
 * - `apps/desktop/src/main/ipc/domains/mcp.ts:49` → el handler IPC
 *   `ipc.mcp.addServer`, que dispara el **usuario** al configurar un servidor
 *   MCP externo (el esquema `AddMcpServerSchema` no tiene campo de Sub-Ego);
 * - `apps/desktop/src/main/window/create-window.ts:701` → la app **restaura**
 *   sus servidores MCP persistidos al arrancar;
 * - `packages/integrations/src/mcp/**` tiene **0** referencias a `subEgoId`.
 *
 * ⇒ el ámbito por defecto es `app` (global) y el camino privado queda
 * **disponible y probado** para cuando exista (o para un Sub-Ego que
 * registre su propio servidor).
 */
export type McpToolOwnership =
  | { readonly scope: "app" }
  | { readonly scope: "sub-ego"; readonly ownerSubEgoId: string };

/** Ámbito por defecto: la conexión la abre la app ⇒ tools globales. */
export const APP_SCOPE_TOOL_OWNERSHIP: McpToolOwnership = Object.freeze({
  scope: "app",
});

interface ManagedServerEntry {
  config: McpServerConfig;
  client: McpClient;
  enabled: boolean;
  lastError?: string;
  importedToolNames: Set<string>;
  /**
   * Ámbito de las tools importadas de este servidor (Ola 9). Se guarda en la
   * entrada para que una **reconexión** conserve el dueño.
   */
  ownership: McpToolOwnership;
}

export class McpManager {
  private readonly registry?: ToolRegistry;
  private readonly servers = new Map<string, ManagedServerEntry>();
  private readonly tokenStore?: McpTokenStore;
  private readonly secretResolver?: SecretResolver;
  private readonly eventBus?: EventBus;

  constructor(registry?: ToolRegistry, options: McpManagerOptions = {}) {
    this.registry = registry;
    this.tokenStore = options.tokenStore;
    this.secretResolver = options.secretResolver;
    this.eventBus = options.eventBus;
  }

  /**
   * Fuente de secretos del gestor (Credential Manager en prod).
   */
  public getTokenStore(): McpTokenStore | undefined {
    return this.tokenStore;
  }

  /**
   * Registra o actualiza la configuración de un servidor MCP.
   * Aplica SafeConfigMutation (COUC-10): desconexión atómica de la versión previa si existía.
   *
   * @param ownership Ámbito de las tools importadas (Ola 9). Por defecto
   * `{ scope: "app" }` ⇒ **GLOBAL**: la conexión la abre la app (el usuario
   * configura el servidor MCP en los ajustes, o la app lo restaura al
   * arrancar) ⇒ sus tools son infraestructura compartida y las ven todos
   * los Sub-Egos. No es un olvido: es la decisión documentada en
   * `McpToolOwnership`.
   */
  public async registerServer(
    config: McpServerConfig,
    enabled: boolean = true,
    ownership: McpToolOwnership = APP_SCOPE_TOOL_OWNERSHIP
  ): Promise<McpServerRuntimeState> {
    // STAB-12: validación SSRF fail-closed ANTES de crear estado (la URL de
    // un http remoto es input del renderer; `assertSafeMcpHttpUrl` lanza).
    if (config.transport === "streamable-http") {
      // T13: validación SSRF fail-closed ANTES de crear estado, con resolución
      // DNS (anti DNS-rebinding).
      await assertSafeMcpHttpUrlAsync(config);
    }
    const existing = this.servers.get(config.id);
    if (existing) {
      await this.disconnectServer(config.id);
    }

    const client = new McpClient(config, { secretResolver: this.secretResolver });
    const entry: ManagedServerEntry = {
      config,
      client,
      enabled,
      importedToolNames: new Set<string>(),
      ownership,
    };

    this.servers.set(config.id, entry);

    if (enabled) {
      return await this.connectServer(config.id);
    }

    return this.toRuntimeState(entry, true);
  }

  /**
   * Conecta un servidor MCP e importa dinámicamente sus herramientas al ToolRegistry.
   *
   * @param ownership Ámbito de las tools importadas. Si se omite, se usa el
   * ámbito con el que se **registró** el servidor (así una reconexión
   * conserva el dueño). `app` ⇒ tools GLOBALES.
   */
  public async connectServer(
    id: string,
    ownership?: McpToolOwnership
  ): Promise<McpServerRuntimeState> {
    const entry = this.servers.get(id);
    if (!entry) {
      throw new Error(`[McpManager] Servidor MCP con ID '${id}' no encontrado.`);
    }

    entry.enabled = true;
    entry.lastError = undefined;
    const scope = ownership ?? entry.ownership;
    // El ámbito efectivo se recuerda en la entrada: una reconexión posterior
    // (toggle) no puede perder el dueño.
    entry.ownership = scope;

    try {
      await entry.client.connect();

      // Si existe ToolRegistry central, mapeamos las herramientas
      if (this.registry) {
        // Limpiamos registros previos si existían
        this.cleanImportedTools(entry);

        const prefix = entry.config.toolPrefix || entry.config.id;

        // EGO-FIND-49 (Ola 1b T1): el override NO es implícito.
        // - `overrideExisting` sale del `allowOverride` EXPLÍCITO del servidor.
        // - El veto de tools NATIVAS lo aplica el `McpClient` siempre
        //   (una tool nativa de Ego no es redefinible desde un servidor MCP).
        // - Cada decisión se AUDITA en el EventBus.
        const result = entry.client.importIntoRegistryDetailed(this.registry, {
          prefix,
          overrideExisting: entry.config.allowOverride === true,
          // Ola 9: el dueño viaja con la tool importada. `scope: "app"` ⇒ sin
          // dueño ⇒ GLOBAL (la conexión la abre la app).
          ...(scope.scope === "sub-ego"
            ? { ownerSubEgoId: scope.ownerSubEgoId }
            : {}),
        });

        for (const decision of result.decisions) {
          if (decision.action === "registered") {
            entry.importedToolNames.add(decision.toolName);
            continue;
          }
          if (decision.action === "overridden") {
            // La tool preexistente sigue siendo "de este servidor": al
            // desconectar hay que retirarla.
            entry.importedToolNames.add(decision.toolName);
          }
          this.auditImportDecision(decision);
        }
      }

      return this.toRuntimeState(entry, true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      entry.lastError = errorMessage;
      this.cleanImportedTools(entry);
      return this.toRuntimeState(entry, false);
    }
  }

  /**
   * Desconecta un servidor MCP y retira sus herramientas del ToolRegistry.
   */
  public async disconnectServer(id: string): Promise<McpServerRuntimeState> {
    const entry = this.servers.get(id);
    if (!entry) {
      throw new Error(`[McpManager] Servidor MCP con ID '${id}' no encontrado.`);
    }

    entry.enabled = false;
    this.cleanImportedTools(entry);

    try {
      await entry.client.disconnect();
    } catch (err) {
      console.warn(`[McpManager] Error al desconectar servidor '${id}':`, err);
    }

    return this.toRuntimeState(entry, true);
  }

  /**
   * Alterna el estado de activación en caliente (toggle on/off) de un servidor MCP.
   */
  public async toggleServer(id: string, enabled: boolean): Promise<McpServerRuntimeState> {
    if (enabled) {
      return await this.connectServer(id);
    } else {
      return await this.disconnectServer(id);
    }
  }

  /**
   * Elimina un servidor MCP del gestor liberando todos sus recursos.
   */
  public async removeServer(id: string): Promise<boolean> {
    const entry = this.servers.get(id);
    if (!entry) return false;

    await this.disconnectServer(id);
    return this.servers.delete(id);
  }

  /**
   * Obtiene el listado de servidores gestionados y su estado en tiempo real.
   */
  public listServers(): McpServerRuntimeState[] {
    return Array.from(this.servers.values()).map((entry) => this.toRuntimeState(entry, this.isHealthy(entry)));
  }

  /**
   * Obtiene el estado de un servidor específico.
   */
  public getServer(id: string): McpServerRuntimeState | undefined {
    const entry = this.servers.get(id);
    return entry ? this.toRuntimeState(entry, this.isHealthy(entry)) : undefined;
  }

  /**
   * Obtiene la instancia interna del cliente MCP para operaciones de bajo nivel o tests.
   */
  public getClient(id: string): McpClient | undefined {
    return this.servers.get(id)?.client;
  }

  /**
   * Explora y filtra herramientas actualmente disponibles en el catálogo de Ego.
   */
  public listTools(filter?: {
    query?: string;
    riskLevel?: ToolRiskLevel;
    serverId?: string;
  }): ToolDefinition[] {
    if (!this.registry) return [];

    let tools = this.registry.list();

    if (filter?.serverId) {
      tools = tools.filter((t) => t.mcpServerId === filter.serverId);
    }

    if (filter?.riskLevel) {
      tools = tools.filter((t) => t.riskLevel === filter.riskLevel);
    }

    if (filter?.query) {
      const q = filter.query.toLowerCase();
      tools = tools.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.mcpServerId && t.mcpServerId.toLowerCase().includes(q))
      );
    }

    return tools;
  }

  /**
   * Desconecta todos los servidores al cerrar o reiniciar la aplicación.
   */
  public async dispose(): Promise<void> {
    const promises = Array.from(this.servers.keys()).map((id) => this.disconnectServer(id));
    await Promise.allSettled(promises);
    this.servers.clear();
  }

  /**
   * Audita una decisión de importación de tools MCP en el EventBus
   * (EGO-FIND-49, Ola 1b T1).
   *
   * El `console.warn` del cliente no es una auditoría: se pierde al reiniciar
   * y no es consultable. Aquí la decisión queda como evento `system.alert`
   * (`MCP_TOOL_OVERRIDE` / `MCP_NATIVE_TOOL_PROTECTED`), con el detalle
   * estructurado del takeover.
   */
  private auditImportDecision(decision: McpToolImportDecision): void {
    if (!this.eventBus) return;

    const code =
      decision.action === "overridden"
        ? "MCP_TOOL_OVERRIDE"
        : decision.action === "skipped_native_protected"
        ? "MCP_NATIVE_TOOL_PROTECTED"
        : "MCP_TOOL_IMPORT_BLOCKED";

    const severity =
      decision.action === "overridden" ? "warn" : decision.action === "skipped_native_protected" ? "error" : "info";

    try {
      this.eventBus.emit(
        "system.alert",
        {
          code,
          message: decision.reason,
          details: {
            toolName: decision.toolName,
            serverToolName: decision.serverToolName,
            /** Servidor que impone la tool. */
            overridingServerId: decision.serverId,
            /** Servidor que poseía la tool antes (si la había). */
            overriddenServerId: decision.existingServerId,
            serverId: decision.serverId,
            action: decision.action,
            existingOrigin: decision.existingOrigin,
          },
        },
        { source: "McpManager", severity }
      );
    } catch (err: unknown) {
      console.warn(
        `[McpManager] No se pudo auditar la importación de '${decision.toolName}': ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // --- MÉTODOS AUXILIARES ---

  private cleanImportedTools(entry: ManagedServerEntry): void {
    if (!this.registry) return;
    for (const toolName of entry.importedToolNames) {
      this.registry.unregister(toolName);
    }
    entry.importedToolNames.clear();
  }

  private isHealthy(entry: ManagedServerEntry): boolean {
    return entry.lastError === undefined && entry.client.getStatus() !== "error";
  }

  private toRuntimeState(entry: ManagedServerEntry, ok: boolean): McpServerRuntimeState {
    const cached = entry.client.getCachedTools();
    return {
      id: entry.config.id,
      name: entry.config.name,
      config: entry.config,
      status: entry.client.getStatus(),
      enabled: entry.enabled,
      toolsCount: cached.length,
      ok,
      lastError: entry.lastError,
      tools: cached,
    };
  }
}
