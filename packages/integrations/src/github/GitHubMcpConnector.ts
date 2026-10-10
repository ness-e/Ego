import type { McpServerConfig } from "../mcp/types.js";
import type { McpManager, McpServerRuntimeState } from "../mcp/McpManager.js";

export interface GitHubConnectorOptions {
  personalAccessToken?: string;
  toolPrefix?: string;
  timeoutMs?: number;
}

export const GITHUB_OFFICIAL_MCP_PACKAGE = "@modelcontextprotocol/server-github";

export const KNOWN_GITHUB_MCP_TOOLS = [
  "get_issue",
  "create_issue",
  "update_issue",
  "list_issues",
  "get_pull_request",
  "create_pull_request",
  "list_pull_requests",
  "search_repositories",
  "get_file_contents",
  "create_or_update_file",
  "push_files",
] as const;

/**
 * Crea la configuración canónica para el servidor oficial MCP de GitHub (DOM-07 / AGENTS.md §7).
 */
export function createGitHubMcpConfig(options: GitHubConnectorOptions): McpServerConfig {
  const token = options.personalAccessToken || process.env.GITHUB_PERSONAL_ACCESS_TOKEN || "";

  return {
    id: "mcp-github",
    name: "GitHub Official MCP Server",
    transport: "stdio",
    command: "npx",
    args: ["-y", GITHUB_OFFICIAL_MCP_PACKAGE],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: token,
    },
    toolPrefix: options.toolPrefix ?? "github_",
    timeoutMs: options.timeoutMs ?? 30000,
  };
}

/**
 * Conector oficial MCP de GitHub para el Dominio de Ingeniería (DOM-07).
 * Integra sincronización de issues, PRs y código respetando el Principio Innegociable §7.
 */
export class GitHubMcpConnector {
  private config?: McpServerConfig;
  private token?: string;

  constructor(options?: GitHubConnectorOptions) {
    if (options?.personalAccessToken) {
      this.token = options.personalAccessToken;
      this.config = createGitHubMcpConfig(options);
    }
  }

  /**
   * Verifica si el conector tiene un token de acceso configurado.
   */
  public isConfigured(): boolean {
    return Boolean(this.token || process.env.GITHUB_PERSONAL_ACCESS_TOKEN);
  }

  /**
   * Obtiene la lista de herramientas canónicas que expone el servidor oficial de GitHub.
   */
  public getKnownTools(): readonly string[] {
    return KNOWN_GITHUB_MCP_TOOLS;
  }

  /**
   * Registra y conecta el servidor MCP de GitHub en el McpManager central.
   */
  public async registerAndConnect(
    mcpManager: McpManager,
    token?: string
  ): Promise<McpServerRuntimeState> {
    const effectiveToken = token || this.token || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

    if (!effectiveToken) {
      throw new Error(
        "[GitHubMcpConnector] GITHUB_PERSONAL_ACCESS_TOKEN no encontrado. Configure el token en Credential Manager o variables de entorno."
      );
    }

    this.token = effectiveToken;
    this.config = createGitHubMcpConfig({ personalAccessToken: effectiveToken });

    return await mcpManager.registerServer(this.config, true);
  }

  /**
   * Obtiene la configuración activa del conector.
   */
  public getConfig(): McpServerConfig | undefined {
    return this.config;
  }
}
