import { ToolRegistry, type ToolDefinition, type ToolRiskLevel } from "@ego/tools";
import { McpClient } from "./McpClient.js";
import type { McpServerConfig, McpToolDefinition, McpClientStatus } from "./types.js";

export interface McpServerRuntimeState {
  id: string;
  name: string;
  config: McpServerConfig;
  status: McpClientStatus;
  enabled: boolean;
  toolsCount: number;
  lastError?: string;
  tools: McpToolDefinition[];
}

interface ManagedServerEntry {
  config: McpServerConfig;
  client: McpClient;
  enabled: boolean;
  lastError?: string;
  importedToolNames: Set<string>;
}

export class McpManager {
  private readonly registry?: ToolRegistry;
  private readonly servers = new Map<string, ManagedServerEntry>();

  constructor(registry?: ToolRegistry) {
    this.registry = registry;
  }

  /**
   * Registra o actualiza la configuración de un servidor MCP.
   * Aplica SafeConfigMutation (COUC-10): desconexión atómica de la versión previa si existía.
   */
  public async registerServer(
    config: McpServerConfig,
    enabled: boolean = true
  ): Promise<McpServerRuntimeState> {
    const existing = this.servers.get(config.id);
    if (existing) {
      await this.disconnectServer(config.id);
    }

    const client = new McpClient(config);
    const entry: ManagedServerEntry = {
      config,
      client,
      enabled,
      importedToolNames: new Set<string>(),
    };

    this.servers.set(config.id, entry);

    if (enabled) {
      return await this.connectServer(config.id);
    }

    return this.toRuntimeState(entry);
  }

  /**
   * Conecta un servidor MCP e importa dinámicamente sus herramientas al ToolRegistry.
   */
  public async connectServer(id: string): Promise<McpServerRuntimeState> {
    const entry = this.servers.get(id);
    if (!entry) {
      throw new Error(`[McpManager] Servidor MCP con ID '${id}' no encontrado.`);
    }

    entry.enabled = true;
    entry.lastError = undefined;

    try {
      await entry.client.connect();

      // Si existe ToolRegistry central, mapeamos las herramientas
      if (this.registry) {
        // Limpiamos registros previos si existían
        this.cleanImportedTools(entry);

        const prefix = entry.config.toolPrefix || entry.config.id;
        const tools = entry.client.getCachedTools();

        for (const mcpTool of tools) {
          const toolName = prefix ? `${prefix}_${mcpTool.name}` : mcpTool.name;
          entry.importedToolNames.add(toolName);
        }

        entry.client.importIntoRegistry(this.registry, {
          prefix,
          overrideExisting: true,
        });
      }

      return this.toRuntimeState(entry);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      entry.lastError = errorMessage;
      this.cleanImportedTools(entry);
      return this.toRuntimeState(entry);
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

    return this.toRuntimeState(entry);
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
    return Array.from(this.servers.values()).map((entry) => this.toRuntimeState(entry));
  }

  /**
   * Obtiene el estado de un servidor específico.
   */
  public getServer(id: string): McpServerRuntimeState | undefined {
    const entry = this.servers.get(id);
    return entry ? this.toRuntimeState(entry) : undefined;
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

  // --- MÉTODOS AUXILIARES ---

  private cleanImportedTools(entry: ManagedServerEntry): void {
    if (!this.registry) return;
    for (const toolName of entry.importedToolNames) {
      this.registry.unregister(toolName);
    }
    entry.importedToolNames.clear();
  }

  private toRuntimeState(entry: ManagedServerEntry): McpServerRuntimeState {
    const cached = entry.client.getCachedTools();
    return {
      id: entry.config.id,
      name: entry.config.name,
      config: entry.config,
      status: entry.client.getStatus(),
      enabled: entry.enabled,
      toolsCount: cached.length,
      lastError: entry.lastError,
      tools: cached,
    };
  }
}
