import { describe, it, expect, vi } from "vitest";
import {
  GitHubMcpConnector,
  createGitHubMcpConfig,
  KNOWN_GITHUB_MCP_TOOLS,
  GITHUB_OFFICIAL_MCP_PACKAGE,
} from "../src/github/GitHubMcpConnector.js";
import type { McpManager } from "../src/mcp/McpManager.js";

describe("GitHubMcpConnector (DOM-07)", () => {
  it("debe generar una configuración canónica MCP válida para GitHub", () => {
    const config = createGitHubMcpConfig({
      personalAccessToken: "ghp_test123456789",
      toolPrefix: "gh_",
    });

    expect(config.id).toBe("mcp-github");
    expect(config.transport).toBe("stdio");
    expect(config.command).toBe("npx");
    expect(config.args).toContain(GITHUB_OFFICIAL_MCP_PACKAGE);
    expect(config.env?.GITHUB_PERSONAL_ACCESS_TOKEN).toBe("ghp_test123456789");
    expect(config.toolPrefix).toBe("gh_");
  });

  it("debe reportar correctamente el estado de configuración (isConfigured)", () => {
    const unconfigured = new GitHubMcpConnector();
    expect(unconfigured.isConfigured()).toBe(false);

    const configured = new GitHubMcpConnector({
      personalAccessToken: "ghp_mock_token",
    });
    expect(configured.isConfigured()).toBe(true);
  });

  it("debe exponer la lista de herramientas oficiales conocidas", () => {
    const connector = new GitHubMcpConnector();
    const tools = connector.getKnownTools();
    expect(tools).toContain("get_issue");
    expect(tools).toContain("create_issue");
    expect(tools).toContain("list_pull_requests");
    expect(tools).toContain("search_repositories");
    expect(tools.length).toBe(KNOWN_GITHUB_MCP_TOOLS.length);
  });

  it("debe arrojar error si se intenta registrar sin token", async () => {
    const connector = new GitHubMcpConnector();
    const fakeMcpManager = {} as McpManager;

    await expect(connector.registerAndConnect(fakeMcpManager)).rejects.toThrow(
      /GITHUB_PERSONAL_ACCESS_TOKEN no encontrado/
    );
  });

  it("debe invocar registerServer en McpManager cuando se suministra token", async () => {
    const connector = new GitHubMcpConnector();
    const registerServerMock = vi.fn().mockResolvedValue({
      id: "mcp-github",
      name: "GitHub Official MCP Server",
      enabled: true,
      status: "connected",
      toolsCount: 5,
      tools: [],
    });

    const fakeMcpManager = {
      registerServer: registerServerMock,
    } as unknown as McpManager;

    const result = await connector.registerAndConnect(fakeMcpManager, "ghp_valid_token");
    expect(registerServerMock).toHaveBeenCalledOnce();
    expect(result.id).toBe("mcp-github");
    expect(result.enabled).toBe(true);
  });

  it("debe resolver el PAT vía Credential Manager antes que process.env (F1T2)", async () => {
    const connector = new GitHubMcpConnector();
    const registerServerMock = vi.fn().mockImplementation((config: { env?: Record<string, string> }) => {
      expect(config.env?.GITHUB_PERSONAL_ACCESS_TOKEN).toBe("sk-test-store-pat");
      return Promise.resolve({ id: "mcp-github", enabled: true, status: "connected" });
    });
    const fakeMcpManager = { registerServer: registerServerMock } as unknown as McpManager;
    const store = {
      getSecret: vi.fn().mockResolvedValue("sk-test-store-pat"),
    };

    await connector.registerAndConnect(fakeMcpManager, undefined, store);

    expect(store.getSecret).toHaveBeenCalledWith("github", "mcp-pat");
    expect(registerServerMock).toHaveBeenCalledOnce();
  });

  it("debe preferir el token explícito sobre el Credential Manager (F1T2)", async () => {
    const connector = new GitHubMcpConnector();
    const registerServerMock = vi.fn().mockResolvedValue({ id: "mcp-github" });
    const fakeMcpManager = { registerServer: registerServerMock } as unknown as McpManager;
    const store = { getSecret: vi.fn().mockResolvedValue("sk-test-store-pat") };

    await connector.registerAndConnect(fakeMcpManager, "sk-test-explicit-pat", store);

    expect(store.getSecret).not.toHaveBeenCalled();
    const passedConfig = registerServerMock.mock.calls[0][0] as { env?: Record<string, string> };
    expect(passedConfig.env?.GITHUB_PERSONAL_ACCESS_TOKEN).toBe("sk-test-explicit-pat");
  });

  it("debe advertir cuando usa el fallback documentado de process.env (solo tests)", async () => {
    const previous = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "sk-test-env-fallback";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const connector = new GitHubMcpConnector();
      const registerServerMock = vi.fn().mockResolvedValue({ id: "mcp-github" });
      const fakeMcpManager = { registerServer: registerServerMock } as unknown as McpManager;

      await connector.registerAndConnect(fakeMcpManager);

      expect(warn).toHaveBeenCalled();
      const passedConfig = registerServerMock.mock.calls[0][0] as { env?: Record<string, string> };
      expect(passedConfig.env?.GITHUB_PERSONAL_ACCESS_TOKEN).toBe("sk-test-env-fallback");
    } finally {
      warn.mockRestore();
      if (previous === undefined) {
        delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      } else {
        process.env.GITHUB_PERSONAL_ACCESS_TOKEN = previous;
      }
    }
  });
});
