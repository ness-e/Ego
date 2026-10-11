import { describe, it, expect } from "vitest";
import {
  ToolCallRepairEngine,
  extractAndRepairJson,
  normalizeToolArguments,
  coerceBoolean,
  coerceNumber,
  coerceArray,
} from "../src/index.js";

describe("Tool Call Repair Suite (OCLW-03 & OCLW-04)", () => {
  it("debe extraer y reparar un JSON truncado sin comillas ni llaves de cierre", () => {
    const truncated = '{"path": "src/index.ts", "count": 42, "status": "pend';
    const fragment = extractAndRepairJson(truncated);
    expect(fragment).not.toBeNull();
    expect(fragment!.repaired).toBe(true);

    const parsed = JSON.parse(fragment!.json);
    expect(parsed.path).toBe("src/index.ts");
    expect(parsed.count).toBe(42);
    expect(parsed.status).toBe("pend");
  });

  it("debe extraer tool call en formato XML-ish <function=...>", () => {
    const text = 'Voy a leer el archivo:\n<function=read_file><parameter=path>docs/README.md</parameter></function>\nListo.';
    const calls = ToolCallRepairEngine.extractFromText(text);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("read_file");
    expect(calls[0].arguments.path).toBe("docs/README.md");

    const cleaned = ToolCallRepairEngine.stripToolCalls(text);
    expect(cleaned).toBe("Voy a leer el archivo:\n\nListo.");
  });

  it("debe extraer tool call en formato bracket [tool: write_file {...}]", () => {
    const text = 'Aplicando cambio:\n[tool: write_file {"path": "test.txt", "content": "hola mundo"}]';
    const calls = ToolCallRepairEngine.extractFromText(text);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("write_file");
    expect(calls[0].arguments.path).toBe("test.txt");
    expect(calls[0].arguments.content).toBe("hola mundo");
  });

  it("debe normalizar coerción de tipos (números en strings, booleanos y arrays)", () => {
    const rawArgs = {
      timeout: "5000",
      retries: 3,
      enabled: "true",
      disabled: "false",
      flags: "strict",
      doubleQuoted: '""limpio""',
    };

    const normalized = normalizeToolArguments(rawArgs);
    expect(normalized.timeout).toBe(5000);
    expect(normalized.retries).toBe(3);
    expect(normalized.enabled).toBe(true);
    expect(normalized.disabled).toBe(false);
    expect(normalized.flags).toBe("strict");
    expect(normalized.doubleQuoted).toBe("limpio");
  });

  it("debe reparar una llamada con JSON truncado mediante ToolCallRepairEngine.repair", () => {
    const repaired = ToolCallRepairEngine.repair({
      name: "run_query",
      arguments: '{"query": "SELECT * FROM users", "limit": "50"',
    });

    expect(repaired).not.toBeNull();
    expect(repaired!.name).toBe("run_query");
    expect(repaired!.arguments.query).toBe("SELECT * FROM users");
    expect(repaired!.arguments.limit).toBe(50);
    expect(repaired!.repaired).toBe(true);
  });
});
