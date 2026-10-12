import type { McpServerConfig, McpTokenStore } from "../mcp/types.js";
import type { McpManager, McpServerRuntimeState } from "../mcp/McpManager.js";

export interface GitHubConnectorOptions {
  personalAccessToken?: string;
  toolPrefix?: string;
  timeoutMs?: number;
}

/** Coordenadas del PAT de GitHub en el Credential Manager (prod). */
export const GITHUB_CREDENTIAL_SERVICE = "github";
export const GITHUB_CREDENTIAL_ACCOUNT = "mcp-pat";

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
 *
 * El token se recibe explícito (resuelto por el llamador vía Credential
 * Manager en prod). El default `process.env` es fallback documentado solo
 * para tests/dev: `registerAndConnect` lo advierte cuando lo usa.
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
    trustLevel: "official",
  };
}

function isNonEmptyToken(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
   *
   * Orden de resolución del PAT (F1T2): token explícito → Credential
   * Manager (`tokenStore` param o `mcpManager.getTokenStore()`, prod) →
   * `process.env` (fallback documentado solo tests/dev, con warn). Sin
   * token en ninguna fuente: lanza en vez de arrancar sin auth.
   */
  public async registerAndConnect(
    mcpManager: McpManager,
    token?: string,
    tokenStore?: McpTokenStore
  ): Promise<McpServerRuntimeState> {
    if (isNonEmptyToken(token)) {
      this.token = token;
    }

    let effectiveToken = this.token;
    if (!isNonEmptyToken(effectiveToken)) {
      const store = tokenStore ?? mcpManager.getTokenStore?.();
      if (store) {
        const stored = await store.getSecret(GITHUB_CREDENTIAL_SERVICE, GITHUB_CREDENTIAL_ACCOUNT);
        if (isNonEmptyToken(stored)) {
          effectiveToken = stored;
        }
      }
    }

    if (!isNonEmptyToken(effectiveToken)) {
      const envToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (isNonEmptyToken(envToken)) {
        console.warn(
          "[GitHubMcpConnector] Usando fallback documentado GITHUB_PERSONAL_ACCESS_TOKEN de process.env (solo tests/dev). En producción el PAT debe resolverse vía Credential Manager."
        );
        effectiveToken = envToken;
      }
    }

    if (!isNonEmptyToken(effectiveToken)) {
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
