/**
 * T11 (EGO-FIND-54) — Hardening Electron (SEC-01) y política del fetch-proxy.
 *
 * Extraído de `main.ts` para que el god-file baje de tamaño sin cambiar
 * comportamiento observable:
 *  - `will-navigate` / `setWindowOpenHandler`: deny-by-default.
 *  - CSP por entorno (dev permite el dev-server local; packaged es estricto).
 *  - Allowlist de ORIGEN de los invokes IPC (T10 / A4-24): un frame con
 *    origen no permitido no puede invocar ningún canal.
 *  - Fetch-proxy con SSRF fail-closed (T3 / EGO-FIND-27) y Bearer solo
 *    para hosts de la allowlist explicita.
 */
import { shell, ipcMain, type BrowserWindow } from "electron";
import { validateSSRFUrl } from "@ego/security";
import { IpcOriginMetaSchema, type EgoFetchRequest } from "../../ipc/schema.js";

export {
  issueFolderToken,
  redeemFolderToken,
  SELECT_FOLDER_TOKEN_TTL_MS,
  folderTokenCountForTests,
  pruneFolderTokens,
} from "./folder-tokens.js";

// Hardening Electron (SEC-01): navegación, ventanas y apertura externa.
//
// - `will-navigate`: niega toda navegación http(s) salvo dev-server local.
// - `setWindowOpenHandler`: niega creación de ventanas (popups/objetivos
//   `_blank` no abren Chromium nuevo; se loguean y se deniegan).
// - Apertura externa: SOLO vía `openExternalValidated()` (https validada,
//   allowlist de esquema + log; http/file/data/javascript denegados).
// ---------------------------------------------------------------------------

/** Hosts del dev-server local permitidos solo en no empaquetado. */
export const DEV_NAV_HOSTS: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
]);

/**
 * ¿Navegación in-window permitida? `file:` (bundle empaquetado) siempre;
 * http(s) solo contra hosts de dev-server cuando NO es build empaquetada.
 * Todo lo demás (incluido http(s) externo en prod) → `false` (denegar).
 */
export function isAllowedNavigationUrl(targetUrl: string, isDev: boolean): boolean {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return false;
  }
  if (parsed.protocol === "file:") return true;
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    if (!isDev) return false;
    return DEV_NAV_HOSTS.has(parsed.hostname);
  }
  return false;
}

/**
 * Allowlist de esquema para apertura externa: SOLO `https:`.
 * `http:` (sin TLS), `file:`, `data:`, `javascript:`, `blob:` y cualquier
 * esquema no http(s) se deniegan. Con credenciales embebidas (`user@host`)
 * también se deniega (riesgo de phishing). El hostname debe ser no vacío
 * y no local (la apertura externa es para web pública, no loopback).
 */
export function isAllowedExternalUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (!parsed.hostname) return false;
  if (parsed.username || parsed.password) return false;
  if (DEV_NAV_HOSTS.has(parsed.hostname)) return false;
  return true;
}

/**
 * Apertura externa validada: solo `https:` según `isAllowedExternalUrl`.
 * Retorna `true` si se delegó a `shell.openExternal`, `false` si se denegó.
 * Todo intento queda en log (permitido y denegado) para auditoría.
 */
export async function openExternalValidated(rawUrl: string): Promise<boolean> {
  if (!isAllowedExternalUrl(rawUrl)) {
    console.warn(`[Electron Security] Apertura externa denegada (allowlist https): ${rawUrl}`);
    return false;
  }
  console.log(`[Electron Security] Apertura externa permitida: ${rawUrl}`);
  await shell.openExternal(rawUrl);
  return true;
}

/**
 * CSP por entorno (R13/SEC-01):
 * - dev (no empaquetado): permite el dev-server Vite local
 *   (`http://127.0.0.1:5173` + `unsafe-inline` para HMR/scripts de Vite).
 * - packaged: estricta — `default-src 'self'`, `script-src 'self'`,
 *   `object-src 'none'`, sin rastro de `127.0.0.1`.
 */
export function buildCsp(isPackaged: boolean): string {
  const scriptSrc = isPackaged
    ? "script-src 'self'"
    : "script-src 'self' 'unsafe-inline' http://127.0.0.1:5173";
  const connectSrc = isPackaged
    ? "connect-src 'self'"
    : "connect-src 'self' http://127.0.0.1:5173 ws://127.0.0.1:5173";
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    // T13 (EGO-FIND-61): `img-src` restringido a origen+datos locales.
    // Sin esta directiva, una imagen Markdown remota (`![](https://host/x)`)
    // es un vector de EXFILTRACIÓN: el renderer pide la URL y se lleva
    // cookies/token en el `Referer` o, peor, la IP/presencia de la sesión.
    // `data:`/`blob:` siguen permitidos para iconos e imágenes inline.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    connectSrc,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // T13: sin `frame-src` externo, un iframe del chat no puede cargar
    // terceros (doble capa con `sandbox` del iframe del Workbench).
    "frame-src 'self'",
  ].join("; ");
}

/**
 * Aplica los guardarraíles de navegación a una ventana: `will-navigate` +
 * `setWindowOpenHandler` en modo denegar-por-defecto (con log de auditoría).
 * `isDev` = `true` solo en dev-server local (`!app.isPackaged`).
 */
export function applyNavigationGuards(target: BrowserWindow, isDev: boolean): void {
  target.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigationUrl(url, isDev)) {
      console.warn(`[Electron Security] Navegación bloqueada: ${url}`);
      event.preventDefault();
    }
  });
  target.webContents.setWindowOpenHandler((details) => {
    console.warn(`[Electron Security] Ventana emergente bloqueada: ${details.url}`);
    return { action: "deny" as const };
  });
}

// ---------------------------------------------------------------------------
// Hardening IPC: origen por invoke + token opaco single-use (selectFolder) +
// fetch-proxy mínimo. Sin romper firma pública: el renderer envía el mismo
// payload; la meta de origen la deriva el main desde `senderFrame` y se
// valida con Zod solo para log/auditoría (se descarta tras validar).
// ---------------------------------------------------------------------------

type InvokeEventLike = {
  senderFrame?: { url?: string } | null;
};

export type { InvokeEventLike };

/** Deriva el origen del invoke desde `senderFrame` + timestamp (solo main). */
export function getInvokeOrigin(event: InvokeEventLike | null | undefined): {
  frameUrl: string;
  timestamp: number;
} {
  const raw = event?.senderFrame?.url;
  const frameUrl =
    typeof raw === "string" && raw.length > 0 ? raw.slice(0, 2048) : "unknown";
  return { frameUrl, timestamp: Date.now() };
}

/**
 * T10 (A4-24) — Allowlist de ORIGEN del invoke.
 *
 * Antes `logInvokeOrigin` solo **logueaba** el `senderFrame.url` y lo
 * descartaba: cualquier frame podía invocar cualquier canal. Ahora el
 * origen se **valida** contra una allowlist: solo el bundle local
 * (`file:`) y el dev-server local (`http://127.0.0.1:5173` /
 * `http://localhost:5173`) pueden invocar canales IPC.
 *
 * El renderer es untrusted (AGENTS.md §4): si un frame remoto lograra
 * ejecutar JS en la app, sus invocaciones IPC deben ser rechazadas.
 */
export function isAllowedInvokeOrigin(frameUrl: string): boolean {
  if (typeof frameUrl !== "string" || frameUrl.length === 0) return false;
  if (frameUrl === "unknown") return false;
  let parsed: URL;
  try {
    parsed = new URL(frameUrl);
  } catch {
    return false;
  }
  // Bundle local empaquetado (`file://`).
  if (parsed.protocol === "file:") return true;
  // Dev-server local (solo en desarrollo).
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    return DEV_NAV_HOSTS.has(parsed.hostname);
  }
  return false;
}

/**
 * Canales IPC que exigen origen permitido. Por defecto, TODOS: el renderer
 * legítimo siempre viene del bundle local o del dev-server.
 */
export function assertInvokeOriginAllowed(
  channel: string,
  event: InvokeEventLike | null | undefined
): { ok: true } | { ok: false; reason: string } {
  const origin = getInvokeOrigin(event);
  if (isAllowedInvokeOrigin(origin.frameUrl)) return { ok: true };
  console.warn(
    `[IPC Security] Origen no permitido para '${channel}': ${origin.frameUrl}`
  );
  return {
    ok: false,
    reason: `Origen no permitido para el canal '${channel}'.`,
  };
}

/**
 * Log + pasada por Zod del origen. La firma pública no cambia: la meta no
 * viene del renderer, se deriva en main y se valida con `IpcOriginMetaSchema`
 * solo para auditoría (fallo de meta nunca rechaza el payload real).
 */
export function logInvokeOrigin(channel: string, event: InvokeEventLike | null | undefined): void {
  try {
    const origin = getInvokeOrigin(event);
    const parsed = IpcOriginMetaSchema.safeParse(origin);
    const frame = parsed.success ? parsed.data.frameUrl : origin.frameUrl;
    console.log(`[IPC] ${channel} origin=${frame} ts=${origin.timestamp}`);
  } catch {
    // noop: el log nunca tumba el handler
  }
}

let ipcOriginLoggingInstalled = false;

/**
 * Envuelve `ipcMain.handle` una vez para:
 *  1. loguear `senderFrame` URL + timestamp en CADA invoke, y
 *  2. **VALIDAR el origen** contra la allowlist (T10 / A4-24): un frame
 *     cuyo origen no esté permitido no puede invocar ningún canal IPC.
 *
 * Los handlers conservan su firma pública y su validación Zod de payload.
 */
export function installIpcOriginLogging(): void {
  if (ipcOriginLoggingInstalled) return;
  ipcOriginLoggingInstalled = true;
  const origHandle = ipcMain.handle.bind(ipcMain);
  (ipcMain as unknown as { handle: typeof ipcMain.handle }).handle = ((
    channel: string,
    listener: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown
  ) => {
    return origHandle(
      channel,
      (async (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => {
        logInvokeOrigin(channel, event as unknown as InvokeEventLike);
        // T10 (A4-24): allowlist de origen. El renderer es untrusted; un
        // frame con origen no permitido no llega al handler.
        const originVerdict = assertInvokeOriginAllowed(
          channel,
          event as unknown as InvokeEventLike
        );
        if (!originVerdict.ok) {
          return {
            ok: false,
            error: originVerdict.reason,
          };
        }
        return listener(event, ...args);
      }) as never
    );
  }) as never;
}

/**
 * T3 (EGO-FIND-27) — Política del fetch-proxy (`ipc.net.fetch`).
 *
 * Antes: `isAllowedFetchUrl` solo comprobaba protocolo + credenciales
 * embebidas + loopback → cualquier `https:` pasaba (incluidos RFC1918,
 * `169.254.169.254` y loopback IPv6) y el handler le adjuntaba
 * `Authorization: Bearer <EGO_API_TOKEN>` a ese host arbitrario.
 *
 * Ahora:
 *  1. La política SSRF canónica de `@ego/security` (`validateSSRFUrl`) es la
 *     ÚNICA fuente de verdad. No se reimplementa aquí.
 *  2. El Bearer **solo** se adjunta a hosts de una allowlist explícita
 *     (`EGO_FETCH_AUTH_HOSTS`, separada por comas). Sin allowlist → sin token.
 */
export function isAllowedFetchUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.username || parsed.password) return false;
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  // `allowLocalhost: true` habilita `localhost`/`127.0.0.1` (dev-server del
  // renderer) pero NO `::1`, `169.254.169.254` ni los rangos privados.
  const ssrf = validateSSRFUrl(rawUrl, { allowLocalhost: true });
  if (!ssrf.safe) return false;
  // `http:` solo se admite contra loopback (dev local); producción exige TLS.
  if (parsed.protocol === "http:") {
    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  }
  return true;
}

/**
 * Hosts autorizados para recibir el header `Authorization` del fetch-proxy.
 * Sin entrada explícita, NO se envía token a ningún host.
 */
export function getFetchAuthHostAllowlist(
  env: NodeJS.ProcessEnv = process.env
): ReadonlySet<string> {
  const raw = env["EGO_FETCH_AUTH_HOSTS"];
  if (typeof raw !== "string" || raw.trim().length === 0) return new Set<string>();
  const hosts = new Set<string>();
  for (const part of raw.split(",")) {
    const host = part.trim().toLowerCase();
    if (host.length > 0) hosts.add(host);
  }
  return hosts;
}

/** `true` si el host de la URL está en la allowlist de auth del fetch-proxy. */
export function isFetchAuthHostAllowed(
  rawUrl: string,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  return getFetchAuthHostAllowlist(env).has(parsed.hostname.toLowerCase());
}

/**
 * Token de autorización solo en main (safeStorage vía `decryptCredential`).
 * Lee el blob cifrado `gov/auth:api_token` (o `EGO_API_TOKEN` en dev);
 * nunca se loguea ni viaja al renderer.
 *
 * El acceso a memoria lo **inyecta** el main (`setFetchAuthTokenResolver`):
 * este módulo no depende del estado global del proceso. Sin resolutor
 * inyectado, se usa el token de entorno (dev) — nunca se lanza.
 */
let authTokenResolver: (() => Promise<string | null>) | null = null;

/** Inyecta el resolutor de token (lo llama el main en el arranque). */
export function setFetchAuthTokenResolver(
  resolver: () => Promise<string | null>
): void {
  authTokenResolver = resolver;
}

/** Resuelve el token de la API (null si no hay). */
export async function resolveFetchAuthToken(): Promise<string | null> {
  try {
    if (authTokenResolver) {
      const resolved = await authTokenResolver();
      if (typeof resolved === "string" && resolved.length > 0) return resolved;
    }
  } catch {
    // noop: fallback al env
  }
  const envToken = process.env.EGO_API_TOKEN;
  return typeof envToken === "string" && envToken.length > 0 ? envToken : null;
}

/** Refresh best-effort: re-lee el token (una sola vez tras 401). */
export async function refreshFetchAuthToken(): Promise<string | null> {
  return resolveFetchAuthToken();
}

export interface ProxiedFetchResult {
  ok: boolean;
  status: number;
  body: string;
}

/**
 * Fetch-proxy mínimo en main: inyecta `Authorization` desde safeStorage,
 * reintenta 1 vez tras 401 con refresh, y retorna solo `status`/`body`
 * saneados (el token nunca sale del main). `fetchImpl` inyectable en tests.
 */
export async function egoFetchProxied(
  input: EgoFetchRequest,
  fetchImpl: typeof fetch = fetch
): Promise<ProxiedFetchResult> {
  if (!isAllowedFetchUrl(input.url)) {
    throw new Error("[IPC Security] URL no permitida para egoFetch (solo https o loopback local).");
  }
  const timeoutMs = input.timeoutMs ?? 15_000;
  // T3 (EGO-FIND-27): el Bearer SOLO viaja a hosts de la allowlist
  // explícita (`EGO_FETCH_AUTH_HOSTS`). Antes se adjuntaba al host arbitrario
  // pedido por el renderer → exfiltración del token de la API.
  const authAllowed = isFetchAuthHostAllowed(input.url);
  const doFetch = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = { ...(input.headers ?? {}) };
    // El header `Authorization` lo pone el main, nunca el renderer.
    delete headers["Authorization"];
    delete headers["authorization"];
    if (token && authAllowed) headers.Authorization = `Bearer ${token}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetchImpl(input.url, {
        method: input.method,
        headers,
        signal: ctrl.signal,
        ...(input.body !== undefined ? { body: input.body } : {}),
      });
    } finally {
      clearTimeout(timer);
    }
  };
  let token = await resolveFetchAuthToken();
  let res = await doFetch(token);
  if (res.status === 401) {
    token = await refreshFetchAuthToken();
    res = await doFetch(token);
  }
  let text = "";
  try {
    text = await res.text();
  } catch {
    text = "";
  }
  return { ok: res.ok, status: res.status, body: text.slice(0, 1_000_000) };
}

