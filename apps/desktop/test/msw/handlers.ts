import { delay, http, HttpResponse } from "msw";

/**
 * Handlers MSW (msw ^2) para el fetch-proxy de main (`egoFetchProxied`).
 * Base `http://localhost`: `isAllowedFetchUrl` solo permite `https:` o
 * loopback local en `http:`.
 */
export const FETCH_PROXY_BASE = "http://localhost";

let authRefreshCalls = 0;

/** Contador de llamadas a `/api/401` (esperado: 2 tras el retry). */
export function getAuthRefreshCalls(): number {
  return authRefreshCalls;
}

/** Resetea el estado con contador (llamar en `afterEach` junto a `resetHandlers`). */
export function resetFetchProxyState(): void {
  authRefreshCalls = 0;
}

export const fetchProxyHandlers = [
  http.get(`${FETCH_PROXY_BASE}/api/ok`, () => {
    return HttpResponse.json({ ok: true }, { status: 200 });
  }),

  http.get(`${FETCH_PROXY_BASE}/api/500`, () => {
    return HttpResponse.json({ error: "boom" }, { status: 500 });
  }),

  http.get(`${FETCH_PROXY_BASE}/api/timeout`, async () => {
    await delay(500);
    return HttpResponse.json({ ok: true }, { status: 200 });
  }),

  http.get(`${FETCH_PROXY_BASE}/api/401`, ({ request }) => {
    authRefreshCalls += 1;
    if (authRefreshCalls === 1) {
      return new HttpResponse("unauthorized", { status: 401 });
    }
    return HttpResponse.json(
      { ok: true, auth: request.headers.get("authorization") ?? null },
      { status: 200 }
    );
  }),
];
