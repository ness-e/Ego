import { describe, it, expect, afterEach, beforeEach } from "vitest";
import {
  isAllowedFetchUrl,
  isFetchAuthHostAllowed,
  egoFetchProxied,
} from "../src/main.js";

/**
 * T3 (EGO-FIND-27) — SSRF + fuga del token Bearer en `ipc.net.fetch`.
 *
 * Antes: `isAllowedFetchUrl` solo comprobaba protocolo + credenciales
 * embebidas + loopback → cualquier `https:` (incluidos RFC1918, metadata de
 * cloud y loopback IPv6) pasaba, y el handler le adjuntaba
 * `Authorization: Bearer <EGO_API_TOKEN>` a ese host arbitrario.
 *
 * Ahora: la política SSRF canónica de `@ego/security` (`validateSSRFUrl`) es
 * la única fuente de verdad, y el Bearer solo se adjunta a hosts de una
 * allowlist explícita.
 */
describe("T3: ipc.net.fetch — SSRF fail-closed + Bearer solo a allowlist", () => {
  const prevFetchAuthHosts = process.env["EGO_FETCH_AUTH_HOSTS"];

  beforeEach(() => {
    process.env["EGO_FETCH_AUTH_HOSTS"] = "api.openai.com";
  });

  afterEach(() => {
    if (prevFetchAuthHosts === undefined) delete process.env["EGO_FETCH_AUTH_HOSTS"];
    else process.env["EGO_FETCH_AUTH_HOSTS"] = prevFetchAuthHosts;
  });

  it("rechaza metadata de cloud (169.254.169.254)", () => {
    expect(isAllowedFetchUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isAllowedFetchUrl("https://169.254.169.254/latest/meta-data/")).toBe(false);
  });

  it("rechaza rangos privados RFC1918", () => {
    expect(isAllowedFetchUrl("http://10.0.0.1/")).toBe(false);
    expect(isAllowedFetchUrl("http://192.168.1.1/")).toBe(false);
    expect(isAllowedFetchUrl("http://172.16.0.5/")).toBe(false);
    expect(isAllowedFetchUrl("https://10.0.0.1/")).toBe(false);
  });

  it("rechaza loopback IPv6 y metadatos de Alibaba/GCP", () => {
    expect(isAllowedFetchUrl("http://[::1]/")).toBe(false);
    expect(isAllowedFetchUrl("http://100.100.100.200/")).toBe(false);
    expect(isAllowedFetchUrl("http://metadata.google.internal/")).toBe(false);
  });

  it("rechaza credenciales embebidas y esquemas no http(s)", () => {
    expect(isAllowedFetchUrl("https://user:pass@example.com/")).toBe(false);
    expect(isAllowedFetchUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedFetchUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedFetchUrl("data:text/html,<h1>x</h1>")).toBe(false);
  });

  it("acepta https público", () => {
    expect(isAllowedFetchUrl("https://api.openai.com/v1/models")).toBe(true);
  });

  it("isFetchAuthHostAllowed: solo los hosts de la allowlist llevan Bearer", () => {
    expect(isFetchAuthHostAllowed("https://api.openai.com/v1/models")).toBe(true);
    expect(isFetchAuthHostAllowed("https://evil.example.com/steal")).toBe(false);
    expect(isFetchAuthHostAllowed("https://api.openai.com.evil.com/")).toBe(false);
  });

  it("el proxy NO adjunta Authorization a un host fuera de la allowlist", async () => {
    const prevToken = process.env["EGO_API_TOKEN"];
    process.env["EGO_API_TOKEN"] = "super-secret";
    try {
      let seenAuth: string | null = null;
      const fakeFetch = (async (_url: string, init?: RequestInit) => {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        seenAuth = headers["Authorization"] ?? null;
        return new Response("ok", { status: 200 });
      }) as unknown as typeof fetch;

      await egoFetchProxied(
        { url: "https://evil.example.com/steal", method: "GET" },
        fakeFetch
      );
      expect(seenAuth).toBeNull();
    } finally {
      if (prevToken === undefined) delete process.env["EGO_API_TOKEN"];
      else process.env["EGO_API_TOKEN"] = prevToken;
    }
  });

  it("el proxy adjunta Authorization a un host de la allowlist", async () => {
    const prevToken = process.env["EGO_API_TOKEN"];
    process.env["EGO_API_TOKEN"] = "super-secret";
    try {
      let seenAuth: string | null = null;
      const fakeFetch = (async (_url: string, init?: RequestInit) => {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        seenAuth = headers["Authorization"] ?? null;
        return new Response("ok", { status: 200 });
      }) as unknown as typeof fetch;

      await egoFetchProxied(
        { url: "https://api.openai.com/v1/models", method: "GET" },
        fakeFetch
      );
      expect(seenAuth).toBe("Bearer super-secret");
    } finally {
      if (prevToken === undefined) delete process.env["EGO_API_TOKEN"];
      else process.env["EGO_API_TOKEN"] = prevToken;
    }
  });
});
