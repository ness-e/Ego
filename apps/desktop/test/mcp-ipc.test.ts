import { describe, it, expect } from "vitest";
import {
  McpServerConfigSchema,
  AddMcpServerSchema,
  RemoveMcpServerSchema,
  ToggleMcpServerSchema,
  ListToolsFilterSchema,
  ScanSkillsSchema,
} from "../src/ipc/schema.js";

describe("@ego/desktop — MCP & Skills IPC Validation Suite (ACT-11)", () => {
  it("Valida configuraciones válidas de servidores MCP (stdio)", () => {
    const validConfig = McpServerConfigSchema.safeParse({
      id: "github-mcp",
      name: "GitHub Official Server",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_TOKEN: "secret" },
      toolPrefix: "gh",
      timeoutMs: 15000,
    });

    expect(validConfig.success).toBe(true);
    if (validConfig.success) {
      expect(validConfig.data.id).toBe("github-mcp");
      expect(validConfig.data.transport).toBe("stdio");
      expect(validConfig.data.toolPrefix).toBe("gh");
    }
  });

  it("Rechaza configuraciones MCP con ID malicioso o caracteres no permitidos", () => {
    const invalidId = McpServerConfigSchema.safeParse({
      id: "bad id with spaces/and/slashes",
      name: "Bad Server",
      command: "node",
    });

    expect(invalidId.success).toBe(false);

    const emptyCommand = McpServerConfigSchema.safeParse({
      id: "test",
      name: "Test",
      command: "",
    });

    expect(emptyCommand.success).toBe(false);
  });

  it("Valida esquema AddMcpServerSchema con defaults", () => {
    const addReq = AddMcpServerSchema.safeParse({
      config: {
        id: "postgres-mcp",
        name: "PostgreSQL Connector",
        command: "docker",
        args: ["run", "mcp/postgres"],
      },
    });

    expect(addReq.success).toBe(true);
    if (addReq.success) {
      expect(addReq.data.enabled).toBe(true);
      expect(addReq.data.config.transport).toBe("stdio");
    }
  });

  it("Valida esquema RemoveMcpServerSchema", () => {
    const validRemove = RemoveMcpServerSchema.safeParse({ id: "github-mcp" });
    expect(validRemove.success).toBe(true);

    const emptyRemove = RemoveMcpServerSchema.safeParse({ id: "" });
    expect(emptyRemove.success).toBe(false);
  });

  it("Valida esquema ToggleMcpServerSchema", () => {
    const validToggle = ToggleMcpServerSchema.safeParse({
      id: "github-mcp",
      enabled: false,
    });
    expect(validToggle.success).toBe(true);
    if (validToggle.success) {
      expect(validToggle.data.enabled).toBe(false);
    }

    const invalidToggle = ToggleMcpServerSchema.safeParse({
      id: "github-mcp",
      enabled: "not-a-boolean" as any,
    });
    expect(invalidToggle.success).toBe(false);
  });

  it("Valida esquema ListToolsFilterSchema con filtros de riesgo y búsqueda", () => {
    const validFilter = ListToolsFilterSchema.safeParse({
      query: "git",
      riskLevel: "destructive",
      serverId: "github-mcp",
    });

    expect(validFilter.success).toBe(true);

    const invalidRisk = ListToolsFilterSchema.safeParse({
      riskLevel: "extreme_danger_level_arbitrary",
    });

    expect(invalidRisk.success).toBe(false);
  });

  it("Valida esquema ScanSkillsSchema para descubrimiento local (HERM-19)", () => {
    const validScan = ScanSkillsSchema.safeParse({
      searchPaths: [".ego/skills", "C:\\Users\\Owner\\.ego\\skills"],
      projectRoot: "C:\\Project\\Ego",
    });

    expect(validScan.success).toBe(true);

    const emptyScan = ScanSkillsSchema.safeParse({});
    expect(emptyScan.success).toBe(true);
  });
});
