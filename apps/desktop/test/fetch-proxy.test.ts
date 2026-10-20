import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { egoFetchProxied } from "../src/main.js";
import {
  FETCH_PROXY_BASE,
  fetchProxyHandlers,
  getAuthRefreshCalls,
  resetFetchProxyState,
} from "./msw/handlers.js";

const server = setupServer(...fetchProxyHandlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  resetFetchProxyState();
});

afterAll(() => {
  server.close();
});

describe("@ego/desktop — fetch-proxy (egoFetchProxied) con MSW", () => {
  it("success: resuelve 200 con body saneado", async () => {
    const res = await egoFetchProxied({
      url: `${FETCH_PROXY_BASE}/api/ok`,
      method: "GET",
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.body).toContain("true");
  });

  it("error: propaga el 500 sin reintentar", async () => {
    const res = await egoFetchProxied({
      url: `${FETCH_PROXY_BASE}/api/500`,
      method: "GET",
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
  });

  it("timeout: aborta cuando el servidor tarda más que timeoutMs", async () => {
    await expect(
      egoFetchProxied({
        url: `${FETCH_PROXY_BASE}/api/timeout`,
        method: "GET",
        timeoutMs: 100,
      })
    ).rejects.toThrow(/abort/i);
  });

  it("retry 401: reintenta una sola vez con refresh y resuelve 200", async () => {
    const prev = process.env.EGO_API_TOKEN;
    const prevAuthHosts = process.env.EGO_FETCH_AUTH_HOSTS;
    process.env.EGO_API_TOKEN = "test-token-msw";
    // T3 (EGO-FIND-27): el Bearer solo se adjunta a hosts de la allowlist
    // explícita (`EGO_FETCH_AUTH_HOSTS`). El servidor de test es `localhost`.
    process.env.EGO_FETCH_AUTH_HOSTS = "localhost";
    try {
      const res = await egoFetchProxied({
        url: `${FETCH_PROXY_BASE}/api/401`,
        method: "GET",
      });
      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      expect(getAuthRefreshCalls()).toBe(2);
      expect(res.body).toContain("Bearer test-token-msw");
    } finally {
      if (prev === undefined) delete process.env.EGO_API_TOKEN;
      else process.env.EGO_API_TOKEN = prev;
      if (prevAuthHosts === undefined) delete process.env.EGO_FETCH_AUTH_HOSTS;
      else process.env.EGO_FETCH_AUTH_HOSTS = prevAuthHosts;
    }
  });

  it("T3: sin allowlist de auth NO se adjunta el Bearer (fail-closed)", async () => {
    const prev = process.env.EGO_API_TOKEN;
    const prevAuthHosts = process.env.EGO_FETCH_AUTH_HOSTS;
    process.env.EGO_API_TOKEN = "test-token-msw";
    delete process.env.EGO_FETCH_AUTH_HOSTS;
    try {
      const res = await egoFetchProxied({
        url: `${FETCH_PROXY_BASE}/api/ok`,
        method: "GET",
      });
      expect(res.ok).toBe(true);
      expect(res.body).not.toContain("Bearer test-token-msw");
    } finally {
      if (prev === undefined) delete process.env.EGO_API_TOKEN;
      else process.env.EGO_API_TOKEN = prev;
      if (prevAuthHosts === undefined) delete process.env.EGO_FETCH_AUTH_HOSTS;
      else process.env.EGO_FETCH_AUTH_HOSTS = prevAuthHosts;
    }
  });
});
