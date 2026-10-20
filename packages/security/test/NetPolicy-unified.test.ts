import { describe, it, expect } from "vitest";
import { NetPolicy } from "../src/ssrfPolicy.js";
import { evaluateToolCall } from "../src/ToolPermissions.js";
import { isBlockedSSRFIPv4, isBlockedSSRFIPv6, validateSSRFUrl } from "../src/netPolicy.js";

const baseRequest = {
  tool: { name: "web_fetch", category: "network" as const, riskLevel: "sensitive" as const },
  arguments: { url: "https://example.com" },
  context: { sessionId: "s1", projectId: "p1", subEgoId: "ego.nucleus", callId: "c1" },
};

describe("NetPolicy unificada (T2 / R4)", () => {
  it("(1) el módulo canónico existe en @ego/security y bloquea DNS rebinding", async () => {
    const verdict = await NetPolicy.validateUrlWithDns("http://attacker.example", {
      resolver: async () => ["127.0.0.1"],
    });
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toMatch(/rebinding|privada|especial/i);
  });

  it("(2) un host público NO se bloquea", async () => {
    const verdict = await NetPolicy.validateUrlWithDns("https://example.com", {
      resolver: async () => ["93.184.216.34"],
    });
    expect(verdict.safe).toBe(true);
  });

  it("(3) ToolPermissions delega en la política canónica: bloquea credenciales embebidas", () => {
    const verdict = evaluateToolCall(
      {
        ...baseRequest,
        arguments: { url: "http://user:pass@evil.example/" },
      },
      { allowedMcpServers: ["github", "filesystem"], workspace: "C:/work" }
    );
    expect(verdict.decision).toBe("deny");
  });

  it("(4) ToolPermissions sigue denegando los vectores privados", () => {
    for (const url of [
      "http://127.0.0.1/x",
      "http://10.0.0.5/x",
      "http://192.168.1.1/x",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/x",
      "http://localhost:3000/x",
    ]) {
      const verdict = evaluateToolCall(
        { ...baseRequest, arguments: { url } },
        { allowedMcpServers: ["github", "filesystem"], workspace: "C:/work" }
      );
      expect(verdict.decision).toBe("deny");
    }
  });

  it("(5) los wrappers de netPolicy.ts coinciden con la política canónica", () => {
    expect(isBlockedSSRFIPv4("10.1.2.3")).toBe(NetPolicy.isBlockedIpv4("10.1.2.3"));
    expect(isBlockedSSRFIPv6("::1")).toBe(NetPolicy.isBlockedIpv6("::1"));
    const legacy = validateSSRFUrl("http://127.0.0.1/x");
    const canonical = NetPolicy.validateUrl("http://127.0.0.1/x");
    expect(legacy.safe).toBe(canonical.safe);
  });

  it("(6) el módulo canónico expone la superficie completa (para que @ego/tools delegue)", () => {
    expect(typeof NetPolicy.isBlockedIpv4).toBe("function");
    expect(typeof NetPolicy.isBlockedIpv6).toBe("function");
    expect(typeof NetPolicy.isBlockedIp).toBe("function");
    expect(typeof NetPolicy.validateUrl).toBe("function");
    expect(typeof NetPolicy.validateUrlWithDns).toBe("function");
    expect(typeof NetPolicy.assertSafeUrl).toBe("function");
    expect(typeof NetPolicy.redactUrl).toBe("function");
  });
});
