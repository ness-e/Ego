/**
 * Ola 9 (A3) — EGO-FIND-81: el comando CLI local del token del servidor MCP.
 *
 * ```
 * ego mcp token                 # imprime el token por stdout
 * ego mcp token --out <fichero> # lo escribe en un fichero 0600 (recomendado)
 * ego mcp token --json          # { "token": "...", "url": "..." }
 * ```
 *
 * ## Por qué stdout **y** fichero 0600
 *
 * Un token impreso por stdout puede acabar en:
 *
 * - el **scrollback** del terminal (y en las grabadoras de terminal);
 * - el **log del proceso padre**, si captura la salida del hijo;
 * - una **tubería mal construida** hacia otro destino por accidente.
 *
 * El comando **no** evita stdout (es lo que pide el contrato: "un comando
 * local que imprima el token por stdout para que un proceso emparejado lo
 * consuma"), pero ofrece `--out <fichero>`: el token se escribe en un fichero
 * con **modo 0600** (sólo el usuario owner) y **no** se imprime nada. Es el
 * canal de **menor exposición** y el recomendado para automatización:
 * sin scrollback, sin historial, sin log del padre, y borrable en el acto.
 *
 * El riesgo residual del modo stdout es real y **documentado**: quien lo use
 * en un terminal compartido acepta que el token queda en el scrollback. Por
 * eso el modo por defecto de un proceso emparejado debería ser `--out`.
 *
 * ## Sin renderer
 *
 * El comando corre en el **proceso main**, sin ventana y sin renderer: el
 * renderer es *untrusted* (`AGENTS.md`) y el token nunca lo atraviesa.
 */
import * as fs from "node:fs";
import { requestMcpTokenFromBroker, type McpTokenBrokerResponse } from "../main/mcp/mcp-token-broker.js";

/** Subcomando CLI que identifica esta invocación. */
export const MCP_TOKEN_CLI_COMMAND = "mcp token";

/** Error de uso del CLI. */
export class McpTokenCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpTokenCliError";
  }
}

/** Argumentos parseados del CLI. */
export interface McpTokenCliArgs {
  /** Subcomando: sólo `token` por ahora. */
  command: "token";
  /** Fichero de destino (`--out`). */
  out?: string;
  /** Salida JSON (`--json`). */
  json?: boolean;
}

/**
 * ¿Este argv pide el token del MCP?
 *
 * Se busca la secuencia `mcp` `token` en cualquier posición (el binario de
 * Electron y el script ocupan `argv[0]`/`argv[1]`).
 */
export function isMcpTokenCliRequest(argv: readonly string[]): boolean {
  const args = [...argv];
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === "mcp" && args[i + 1] === "token") return true;
  }
  return false;
}

/**
 * Parsea los argumentos del CLI.
 *
 * @throws {McpTokenCliError} si el subcomando no es `token` o `--out` no
 * tiene valor.
 */
export function parseMcpTokenCliArgs(argv: readonly string[]): McpTokenCliArgs {
  const args = [...argv];
  let index = args.findIndex((a, i) => a === "mcp" && args[i + 1] === "token");
  if (index < 0) {
    throw new McpTokenCliError(
      `uso: \`${MCP_TOKEN_CLI_COMMAND}\` [--out <fichero>] [--json]`
    );
  }
  index += 2;

  const parsed: { command: "token"; out?: string; json?: boolean } = { command: "token" };
  for (; index < args.length; index++) {
    const arg = args[index] as string;
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (arg === "--out") {
      const value = args[index + 1];
      if (!value) {
        throw new McpTokenCliError("`--out` necesita la ruta del fichero de destino.");
      }
      parsed.out = value;
      index++;
      continue;
    }
    if (arg.startsWith("--out=")) {
      parsed.out = arg.slice("--out=".length);
      continue;
    }
    throw new McpTokenCliError(`argumento desconocido: '${arg}'`);
  }
  return parsed;
}

/** Dependencias inyectables (el test no toca stdout real ni el disco real). */
export interface McpTokenCliDeps {
  /** Ruta del pipe del broker (por defecto, la determinista del usuario). */
  brokerPath?: string;
  /** Escribe una línea por stdout. */
  stdout?: (line: string) => void;
  /** Escribe una línea por stderr. */
  stderr?: (line: string) => void;
  /** Escribe el fichero de salida (modo 0600). */
  writeFile?: (filePath: string, content: string, mode: number) => void;
  /** Pide el token al broker (inyectable para tests). */
  request?: (options: { path?: string }) => Promise<McpTokenBrokerResponse>;
}

function defaultWriteFile(filePath: string, content: string, mode: number): void {
  fs.writeFileSync(filePath, content, { encoding: "utf8", mode });
  // `writeFileSync` sólo aplica `mode` al CREAR el fichero: si ya existe,
  // hay que corregir los permisos explícitamente.
  try {
    fs.chmodSync(filePath, mode);
  } catch {
    // best effort (en Windows el modo no aplica igual).
  }
}

/**
 * Ejecuta el comando CLI.
 *
 * Devuelve el **código de salida** (0 = ok) en vez de llamar a
 * `process.exit`: así el test puede invocarlo sin matar el proceso.
 */
export async function runMcpTokenCli(
  argv: readonly string[],
  deps: McpTokenCliDeps = {}
): Promise<number> {
  const stdout = deps.stdout ?? ((line: string) => process.stdout.write(`${line}\n`));
  const stderr = deps.stderr ?? ((line: string) => process.stderr.write(`${line}\n`));
  const writeFile = deps.writeFile ?? defaultWriteFile;
  const request =
    deps.request ??
    ((options: { path?: string }) => requestMcpTokenFromBroker(options));

  let args: McpTokenCliArgs;
  try {
    args = parseMcpTokenCliArgs(argv);
  } catch (err) {
    stderr(err instanceof Error ? err.message : String(err));
    return 2;
  }

  let result: McpTokenBrokerResponse;
  try {
    result = await request({ path: deps.brokerPath });
  } catch (err) {
    stderr(err instanceof Error ? err.message : String(err));
    return 1;
  }

  if (args.out) {
    // Canal de MENOR exposición: fichero 0600 y nada por stdout.
    writeFile(args.out, `${result.token}\n`, 0o600);
    stderr(
      `Token del servidor MCP escrito en '${args.out}' (modo 0600). ` +
        `Bórralo en cuanto el cliente lo haya leído.`
    );
    return 0;
  }

  if (args.json) {
    stdout(JSON.stringify({ token: result.token, url: result.url }));
    return 0;
  }

  stdout(result.token);
  return 0;
}
