/**
 * T2 (VERDICT R1) — Transporte HTTP streamable para el `EgoMcpServer` de Ego.
 *
 * ## Por qué HTTP en el main y no un proceso hijo stdio
 * Las tools y la memoria de Ego viven en el **proceso main** (VantaDB vía
 * `EgoMemoryAdapter`, `ToolRegistry`, `ApprovalEngine`). Un servidor MCP en
 * un proceso hijo stdio obligaría a proxiar TODO (tools + memoria) por el
 * pipe y duplicaría el runtime: el catálogo expuesto sería una copia
 * desincronizada, no el catálogo real. Un servidor **in-proceso** expone la
 * verdad.
 *
 * ## Seguridad (obligatoria)
 * 1. **Solo loopback**: se enlaza a `127.0.0.1`. Cualquier otra interfaz
 *    (`0.0.0.0`, `::`, una IP de la LAN) se rechaza al arrancar.
 * 2. **Bearer token obligatorio**: sin `Authorization: Bearer <token>` → 401
 *    **antes** de tocar el registry (fail-closed). La comparación es de
 *    tiempo constante.
 * 3. **El gate HITL se mantiene**: `tools/call` de una tool que exige
 *    aprobación pasa por el `approvalGate`; sin gate, el `EgoMcpServer`
 *    rechaza la ejecución (fail-closed).
 * 4. El token **nunca** se incluye en la respuesta ni en la URL.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { EgoMcpServer } from "@ego/integrations";

/** Interfaces de loopback admitidas (enlace local). */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

/** Ruta por defecto del endpoint MCP. */
export const DEFAULT_MCP_PATH = "/mcp";

export interface EgoMcpHttpServerOptions {
  /** Servidor MCP de Ego (ya construido con su registry y su gate HITL). */
  server: EgoMcpServer;
  /** Token bearer obligatorio. */
  token: string;
  /** Interfaz de enlace. Solo loopback (por defecto `127.0.0.1`). */
  host?: string;
  /** Puerto. 0 (por defecto) = efímero, sin colisiones. */
  port?: number;
  /** Ruta HTTP del endpoint (por defecto `/mcp`). */
  path?: string;
}

export interface EgoMcpHttpServerHandle {
  /** URL base del endpoint (sin token). */
  readonly url: string;
  readonly host: string;
  readonly port: number;
  readonly path: string;
  /** Cierra el servidor y libera el puerto. */
  close(): Promise<void>;
}

/** Compara dos cadenas en tiempo constante (evita filtrar el token por timing). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    // Se compara igualmente para no filtrar la longitud por el tiempo de salida.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/** Extrae el token bearer de la cabecera `Authorization`. */
export function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m?.[1]?.trim() || null;
}

/** Lee el cuerpo completo de la petición (con tope de tamaño). */
async function readBody(req: IncomingMessage, limitBytes = 4 * 1024 * 1024): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > limitBytes) throw new Error("cuerpo demasiado grande");
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Arranca el servidor MCP de Ego sobre HTTP streamable en loopback.
 *
 * Lanza si el host no es loopback o si el token está vacío.
 */
export async function startEgoMcpHttpServer(
  options: EgoMcpHttpServerOptions
): Promise<EgoMcpHttpServerHandle> {
  const host = options.host ?? "127.0.0.1";
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(
      `[McpHttpServer] Interfaz no permitida '${host}': el servidor MCP de Ego solo escucha en loopback (127.0.0.1).`
    );
  }
  if (typeof options.token !== "string" || options.token.length < 16) {
    throw new Error("[McpHttpServer] Token bearer obligatorio (mínimo 16 caracteres).");
  }
  const path = options.path ?? DEFAULT_MCP_PATH;

  const server: Server = createServer((req, res) => {
    void handle(req, res).catch((err: unknown) => {
      // Nunca dejamos la conexión colgando.
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
      }
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32603,
            message: err instanceof Error ? err.message : "error interno",
          },
        })
      );
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== path) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }

    // 1) Token bearer: se valida ANTES de tocar el registry.
    const bearer = extractBearer(req.headers.authorization);
    if (!bearer || !safeEqual(bearer, options.token)) {
      res.writeHead(401, {
        "content-type": "application/json",
        "www-authenticate": 'Bearer realm="ego-mcp"',
      });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }

    // 2) Método HTTP.
    if (req.method === "DELETE") {
      // Cierre de sesión (el servidor es stateless: no-op explícito).
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "GET") {
      // El transporte SSE (stream de notifications) no se implementa: el
      // servidor responde a invocaciones por POST.
      res.writeHead(405, { "content-type": "application/json", allow: "POST, DELETE" });
      res.end(JSON.stringify({ error: "method_not_allowed" }));
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405, { "content-type": "application/json", allow: "POST, DELETE" });
      res.end(JSON.stringify({ error: "method_not_allowed" }));
      return;
    }

    // 3) Despacho JSON-RPC.
    let payload: unknown;
    try {
      const raw = await readBody(req);
      payload = JSON.parse(raw);
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "JSON inválido" },
        })
      );
      return;
    }

    const headers: Record<string, string> = { "content-type": "application/json" };
    if (Array.isArray(payload)) {
      const out = [];
      for (const item of payload) {
        out.push(await options.server.handleRequest(item as never));
      }
      res.writeHead(200, headers);
      res.end(JSON.stringify(out));
      return;
    }

    const response = await options.server.handleRequest(payload as never);
    if (
      response &&
      (payload as { method?: string } | null)?.method === "initialize"
    ) {
      // Sesión MCP: id opaco por arranque (el servidor es stateless, pero el
      // cliente MCP espera la cabecera en `initialize`).
      headers["mcp-session-id"] = `ego-${Date.now().toString(36)}`;
    }
    res.writeHead(200, headers);
    res.end(JSON.stringify(response));
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, host, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;

  return {
    url: `http://${host}:${port}${path}`,
    host,
    port,
    path,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
