/**
 * Ola 9 (A3) — EGO-FIND-81: el broker local del token del servidor MCP.
 *
 * ## Por qué un broker y no "el CLI lee el keychain"
 *
 * La decisión del owner es **"Keychain + CLI local"**. Hay dos formas de
 * cumplirla y sólo una es viable aquí:
 *
 * - **(A) Persistir el vault cifrado en disco y que el CLI lo lea.**
 *   Medido en esta máquina (2026-10-21): el blob de `safeStorage` de Electron
 *   41 **NO se puede descifrar desde otro proceso** —ni siquiera con el mismo
 *   `userData`— (`DECRYPT_FAILED: Error while decrypting the ciphertext
 *   provided to safeStorage.decryptString`). Con un keychain nativo
 *   (`keytar`/`@napi-rs/keyring`) funcionaría, pero es una dependencia nativa
 *   nueva: `AGENTS.md` prohíbe las que rompen el empaquetado de Electron y
 *   esta ola no puede instalar dependencias.
 * - **(B) El proceso main (que es el único con acceso al keychain) entrega el
 *   token por un canal local, y el CLI es su único cliente soportado.**
 *   ✅ Es la que se implementa: funciona con **cualquier** backend de
 *   keychain (en memoria, `safeStorage` o nativo) porque el secreto **no
 *   sale nunca del proceso**.
 *
 * ## La frontera de seguridad del canal
 *
 * El token **no** viaja por el loopback HTTP del servidor MCP (ahí sería la
 * credencial que autentica, no la que se entrega). Viaja por un **pipe local
 * del usuario**:
 *
 * - Windows: named pipe `\\.\pipe\ego-mcp-token-<hash>`. El DACL por defecto
 *   de un named pipe creado por un proceso lo hereda del token del proceso
 *   ⇒ lo abre el **usuario owner** (y SYSTEM/administradores).
 * - macOS/Linux: unix socket en el tmpdir con modo **0600** ⇒ sólo el usuario
 *   owner.
 *
 * En ambos casos, la frontera es **el usuario del SO**, que es exactamente el
 * nivel de confianza del propio keychain. Un proceso de otro usuario no llega
 * al pipe; un proceso del mismo usuario sí — y también podría leer el
 * keychain.
 *
 * ## El protocolo es deliberadamente mínimo
 *
 * Una sola operación (`GET_TOKEN`) que devuelve el token vigente **y** la URL
 * del endpoint MCP (el puerto es efímero: sin la URL, el token no basta).
 * Cualquier otro comando se rechaza. El token **no se registra** en ningún
 * log ni se escribe en disco.
 */
import * as net from "node:net";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createHash } from "node:crypto";

/** Comando único que entiende el broker. */
export const MCP_TOKEN_BROKER_COMMAND = "GET_TOKEN";

/** Prefijo de la tubería (named pipe en Windows, unix socket en POSIX). */
export const MCP_TOKEN_BROKER_PREFIX = "ego-mcp-token";

/** Error del broker (canal no disponible, token ausente, etc.). */
export class McpTokenBrokerError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "McpTokenBrokerError";
  }
}

/**
 * Clave estable por usuario. No filtra el nombre del usuario: es un hash.
 */
function userScopeKey(): string {
  const raw =
    process.platform === "win32"
      ? `${process.env.USERNAME ?? "user"}:${process.env.USERPROFILE ?? ""}`
      : `${typeof process.getuid === "function" ? process.getuid() : "user"}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

/**
 * Ruta del pipe del broker.
 *
 * Determinista: el CLI la calcula sin necesidad de hablar con la app (y la
 * app la calcula sin configuración).
 */
export function resolveMcpTokenBrokerPath(): string {
  const scope = userScopeKey();
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\${MCP_TOKEN_BROKER_PREFIX}-${scope}`;
  }
  return path.join(os.tmpdir(), `${MCP_TOKEN_BROKER_PREFIX}-${scope}.sock`);
}

/**
 * Normaliza la ruta del pipe al formato que el SO soporta.
 *
 * Windows **no** tiene unix sockets: `net.listen(path)` con una ruta de
 * fichero falla (el `connect` devuelve ENOENT). En Windows la ruta debe ser un
 * **named pipe** (`\\.\pipe\<nombre>`). En POSIX se usa el socket tal cual.
 *
 * La normalización conserva la unicidad: si la ruta recibida no es un named
 * pipe, se deriva el nombre de un hash de la ruta completa (dos rutas
 * distintas ⇒ dos pipes distintos ⇒ los tests no colisionan).
 */
export function normalizeMcpTokenBrokerPath(candidate: string): string {
  if (process.platform !== "win32") return candidate;
  if (candidate.startsWith("\\\\.\\pipe\\")) return candidate;
  const name = path.basename(candidate).replace(/[^A-Za-z0-9_.-]/g, "-");
  const hash = createHash("sha256").update(candidate).digest("hex").slice(0, 8);
  return `\\\\.\\pipe\\${MCP_TOKEN_BROKER_PREFIX}-${name}-${hash}`;
}

/** Opciones del broker. */
export interface McpTokenBrokerOptions {
  /** Ruta del pipe (por defecto, la determinista del usuario). */
  path?: string;
  /** Lee el token vigente del keychain. `null` ⇒ no hay token. */
  readToken: () => Promise<string | null> | string | null;
  /** URL del endpoint MCP (el puerto es efímero: hace falta conocerla). */
  describeEndpoint: () => string;
}

/** Handle del broker. */
export interface McpTokenBrokerHandle {
  /** Ruta del pipe donde escucha. */
  readonly path: string;
  /** Cierra el broker (idempotente). */
  close(): Promise<void>;
}

/** Respuesta del broker. */
export interface McpTokenBrokerResponse {
  /** Token bearer vigente. */
  readonly token: string;
  /** URL del endpoint MCP. */
  readonly url: string;
}

function isAliveSocket(candidate: string): boolean {
  if (process.platform === "win32") return false; // los named pipes no dejan fichero
  if (!fs.existsSync(candidate)) return false;
  // Un socket vivo responde; uno muerto deja el fichero pero rechaza.
  try {
    const probe = net.connect(candidate);
    probe.destroy();
    return true;
  } catch {
    return false;
  }
}

/**
 * Arranca el broker local del token.
 *
 * Falla si ya hay un broker vivo en esa ruta (dos instancias de Ego ⇒ dos
 * tokens: no tiene sentido mezclarlos).
 */
export async function startMcpTokenBroker(
  options: McpTokenBrokerOptions
): Promise<McpTokenBrokerHandle> {
  const pipePath = normalizeMcpTokenBrokerPath(
    options.path ?? resolveMcpTokenBrokerPath()
  );

  if (isAliveSocket(pipePath)) {
    throw new McpTokenBrokerError(
      `Ya hay un broker del token MCP escuchando en '${pipePath}'. Cierra la otra instancia de Ego.`
    );
  }
  // Socket UNIX huérfano de una corrida que murió: se puede quitar.
  if (process.platform !== "win32" && fs.existsSync(pipePath)) {
    try {
      fs.unlinkSync(pipePath);
    } catch {
      // best effort: si no se puede quitar, `listen` fallará con un error claro.
    }
  }

  const server = net.createServer((socket) => {
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("error", () => {
      // Un cliente que se va a mitad no debe tumbar el broker.
    });
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      if (!buffer.includes("\n")) return;
      const command = (buffer.split("\n")[0] ?? "").trim();
      buffer = "";

      void (async () => {
        if (command !== MCP_TOKEN_BROKER_COMMAND) {
          socket.end(`${JSON.stringify({ error: "comando desconocido" })}\n`);
          return;
        }
        const token = await options.readToken();
        if (!token) {
          socket.end(
            `${JSON.stringify({ error: "el servidor MCP no tiene token vigente" })}\n`
          );
          return;
        }
        // El token viaja por el pipe del usuario, nunca por un log.
        socket.end(
          `${JSON.stringify({ token, url: options.describeEndpoint() } satisfies McpTokenBrokerResponse)}\n`
        );
      })();
    });
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error): void => reject(err);
    server.once("error", onError);
    server.listen(pipePath, () => {
      server.removeListener("error", onError);
      resolve();
    });
  });

  // El socket UNIX nace con el umask del proceso: se fija 0600 ⇒ sólo el
  // usuario owner (el mismo nivel de confianza que el keychain).
  if (process.platform !== "win32") {
    try {
      fs.chmodSync(pipePath, 0o600);
    } catch {
      // best effort
    }
  }

  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    if (process.platform !== "win32") {
      try {
        fs.unlinkSync(pipePath);
      } catch {
        // best effort
      }
    }
  };

  return { path: pipePath, close };
}

/** Opciones de la petición al broker. */
export interface McpTokenRequestOptions {
  /** Ruta del pipe (por defecto, la determinista del usuario). */
  path?: string;
  /** Tiempo máximo de espera (por defecto 5 000 ms). */
  timeoutMs?: number;
}

/**
 * Pide el token vigente al broker local.
 *
 * Es el **único** cliente soportado del broker: el comando CLI.
 */
export async function requestMcpTokenFromBroker(
  options: McpTokenRequestOptions = {}
): Promise<McpTokenBrokerResponse> {
  const pipePath = normalizeMcpTokenBrokerPath(
    options.path ?? resolveMcpTokenBrokerPath()
  );
  const timeoutMs = options.timeoutMs ?? 5_000;

  return new Promise<McpTokenBrokerResponse>((resolve, reject) => {
    let settled = false;
    let buffer = "";

    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      finish(() =>
        reject(
          new McpTokenBrokerError(
            `El broker del token MCP no respondió en ${timeoutMs} ms. ¿Está Ego en ejecución?`
          )
        )
      );
      socket.destroy();
    }, timeoutMs);
    if (typeof timer.unref === "function") timer.unref();

    const socket = net.connect(pipePath);
    socket.setEncoding("utf8");
    socket.on("error", (err: Error) => {
      finish(() =>
        reject(
          new McpTokenBrokerError(
            `No se pudo contactar con el broker del token MCP en '${pipePath}'. ` +
              `¿Está Ego en ejecución? (${err.message})`,
            err
          )
        )
      );
    });
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      if (!buffer.includes("\n")) return;
      const line = (buffer.split("\n")[0] ?? "").trim();
      finish(() => {
        try {
          const parsed = JSON.parse(line) as
            | (McpTokenBrokerResponse & { error?: string })
            | { error?: string };
          if (parsed.error || !("token" in parsed) || !parsed.token) {
            reject(
              new McpTokenBrokerError(
                parsed.error ?? "el broker no devolvió un token"
              )
            );
            return;
          }
          resolve({ token: parsed.token, url: parsed.url });
        } catch (err) {
          reject(
            new McpTokenBrokerError("respuesta inválida del broker del token MCP", err)
          );
        }
      });
      socket.end();
    });
    socket.on("connect", () => {
      socket.write(`${MCP_TOKEN_BROKER_COMMAND}\n`);
    });
  });
}
