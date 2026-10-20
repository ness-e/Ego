import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import type { ToolRegistry, ToolDefinition, ToolRiskLevel } from "@ego/tools";
import { jsonSchemaToZod } from "./schema-bridge.js";
import { verifyServerSignature } from "./signature.js";
import { buildMcpChildEnv, resolveSecretMarkers, type SecretResolver } from "./SecretProxy.js";
import type {
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
  McpCallToolResult,
  McpClientStatus,
  McpImportOptions,
  McpInitializeResult,
  McpListToolsResult,
  McpServerConfig,
  McpToolDefinition,
  McpToolImportDecision,
  McpToolImportResult,
} from "./types.js";
import { assertSafeMcpHttpUrl, assertSafeMcpHttpUrlAsync } from "./types.js";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * Allowlist de binarios spawnables por servidores MCP (H31). El spawn es
 * el sumidero RCE: solo runtimes/lanzadores conocidos. Sin override por
 * config (fail-closed); ampliarla exige cambio de código + revisión.
 */
export const MCP_COMMAND_ALLOWLIST: readonly string[] = [
  "node",
  "npx",
  "python",
  "python3",
  "uv",
  "uvx",
  "bun",
  "deno",
];

function normalizeCommandName(command: string): string {
  const base = command.split(/[/\\]/).pop() ?? command;
  return base.toLowerCase().replace(/\.(exe|cmd|bat)$/, "");
}

function isCommandAllowlisted(command: string): boolean {
  return (MCP_COMMAND_ALLOWLIST as readonly string[]).includes(normalizeCommandName(command));
}

/**
 * Valida la config antes de `spawn` (H31): prohíbe `shell:true` y exige
 * comando en allowlist. Punto único de estrangulamiento: cubre configs
 * construidas en código y persistidas sin tipar (`gov/mcp_servers`).
 */
function assertSafeSpawnConfig(config: McpServerConfig): void {
  const raw = config as unknown as Record<string, unknown>;
  if (raw["shell"] === true || config.shell === true) {
    throw new Error(
      `[McpClient:H31] shell:true prohibido en el servidor MCP "${config.id}": el spawn debe ser directo sin intérprete de comandos.`
    );
  }
  if (typeof config.command !== "string" || !isCommandAllowlisted(config.command)) {
    throw new Error(
      `[McpClient:H31] comando "${config.command}" no permitido por allowlist en el servidor MCP "${config.id}".`
    );
  }
}

/**
 * Opciones de construcción del cliente MCP.
 */
export interface McpClientOptions {
  /**
   * Resolver de secretos (Decisión D2). En producción lo implementa
   * `CredentialManager` de `@ego/security` (keychain del SO). Sin resolver,
   * los marcadores `{{SECRET:<clave>}}` viajan sin resolver (fail-closed:
   * el servidor recibe un marcador, nunca el token).
   */
  secretResolver?: SecretResolver;
  /**
   * Variables de entorno extra permitidas en el subproceso (además de la
   * allowlist estándar de `sanitizeProcessEnv`).
   */
  extraAllowedEnv?: ReadonlySet<string>;
}

/**
 * McpClient — Cliente universal MCP de nivel de producción sobre transporte stdio (ACT-09).
 *
 * Implementa:
 * - Handshake JSON-RPC 2.0 y ciclo de vida de herramientas MCP (2024-11-05).
 * - Compuerta HERM-18: Despacho directo de herramientas del sistema sin turnos de modelo.
 * - Compuerta COUC-10: SafeConfigMutation y recarga atómica con rollback transaccional.
 * - Mapeo dinámico y registro seguro en ToolRegistry de Ego.
 * - Decisión D2 (EGO-FIND-33): proxy de secretos — el subproceso recibe
 *   marcadores `{{SECRET:<clave>}}` y el cliente resuelve el valor real.
 */
export class McpClient extends EventEmitter {
  private config: McpServerConfig;
  private process: ChildProcess | null = null;
  private status: McpClientStatus = "disconnected";
  private requestId = 0;
  private readonly pendingRequests = new Map<string | number, PendingRequest>();
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private serverInfo?: { name: string; version?: string };
  private cachedTools: McpToolDefinition[] = [];
  /** Sesión streamable-http (`Mcp-Session-Id` del servidor, si la emite). */
  private httpSessionId?: string;
  private readonly secretResolver?: SecretResolver;
  private readonly extraAllowedEnv?: ReadonlySet<string>;

  constructor(config: McpServerConfig, options: McpClientOptions = {}) {
    super();
    this.config = { ...config };
    this.secretResolver = options.secretResolver;
    this.extraAllowedEnv = options.extraAllowedEnv;
  }

  public getStatus(): McpClientStatus {
    return this.status;
  }

  public getServerInfo(): { name: string; version?: string } | undefined {
    return this.serverInfo;
  }

  public getConfig(): Readonly<McpServerConfig> {
    return this.config;
  }

  /**
   * Servidor firmado (R10 — verificación real): `trustLevel`
   * official/verified MÁS firma Ed25519 válida sobre el payload canónico
   * (`signature.ts:verifyServerSignature`). Ausente, malformada o inválida
   * = no firmado (fail-closed): sus herramientas importadas exigen
   * aprobación HITL explícita.
   *
   * Las tools importadas pasan por Zod + permisos igualmente.
   */
  public isSignedServer(): boolean {
    return verifyServerSignature(this.config);
  }

  /**
   * Conecta con el servidor MCP.
   * - `stdio`: arranca el subproceso y ejecuta el handshake (ACT-09).
   * - `streamable-http` (STAB-12): valida la URL (SSRF fail-closed) y ejecuta
   *   el handshake vía POST JSON-RPC stateless (Spec D1: sin SSE).
   */
  public async connect(): Promise<void> {
    if (this.status === "connected" && (this.process || this.isHttpTransport())) {
      return;
    }

    this.setStatus("connecting");

    try {
      if (this.isHttpTransport()) {
        // Fail-closed antes de cualquier red (D2): https-only + sin
        // loopback/RFC1918/link-local/metadata + sin credenciales en URL.
        // T13: la comprobación incluye RESOLUCIÓN DNS (anti DNS-rebinding).
        await assertSafeMcpHttpUrlAsync(this.config);
      } else {
        this.spawnProcess();
      }

      // Handshake inicial initialize
      const initResult = await this.sendRequest<McpInitializeResult>("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {
          roots: { listChanged: true }
        },
        clientInfo: {
          name: "ego",
          version: "0.1.0"
        }
      });

      this.serverInfo = initResult.serverInfo;

      // Enviar notificación de confirmación
      this.sendNotification("notifications/initialized", {});

      this.setStatus("connected");
      try {
        await this.listTools();
      } catch {
        // Silencioso si el servidor no expone tools o tools/list falla
      }
    } catch (err) {
      this.setStatus("error");
      this.cleanupProcess();
      throw new Error(
        `Fallo al conectar con servidor MCP "${this.config.name}" (${this.config.id}): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  /**
   * Desconecta limpiamente el cliente (stdio: mata el proceso; http: olvida
   * la sesión stateless) y finaliza el proceso hijo si lo hay.
   */
  public async disconnect(): Promise<void> {
    this.cleanupProcess();
    this.httpSessionId = undefined;
    this.setStatus("disconnected");
  }

  /**
   * Mutación y recarga segura de configuración (COUC-10 - SafeConfigMutation).
   * Aplica rollback transaccional si la nueva configuración o proceso falla en arrancar.
   */
  public async reload(newConfig?: McpServerConfig): Promise<void> {
    const backupConfig = { ...this.config };
    const targetConfig = newConfig ? { ...newConfig } : backupConfig;

    try {
      // 1. Desconectar instancia actual
      await this.disconnect();

      // 2. Aplicar nueva configuración
      this.config = targetConfig;

      // 3. Probar nueva conexión
      await this.connect();
    } catch (err) {
      // Rollback a la configuración previa en caso de fallo
      this.config = backupConfig;
      try {
        await this.connect();
      } catch {
        // En caso de que el rollback falle, dejamos el estado en error
        this.setStatus("error");
      }
      throw new Error(
        `SafeConfigMutation rollback aplicado: fallo al recargar servidor MCP: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  /**
   * Lista las herramientas disponibles en el servidor MCP (tools/list).
   */
  public async listTools(): Promise<McpToolDefinition[]> {
    if (this.status !== "connected") {
      throw new Error(`El cliente MCP "${this.config.id}" no está conectado.`);
    }

    const res = await this.sendRequest<McpListToolsResult>("tools/list", {});
    this.cachedTools = res.tools || [];
    return this.cachedTools;
  }

  /**
   * Obtiene la copia en caché de las herramientas descubiertas sin realizar llamadas I/O.
   */
  public getCachedTools(): McpToolDefinition[] {
    return [...this.cachedTools];
  }

  /**
   * Ejecuta una herramienta directamente sobre el servidor MCP (HERM-18 / tools/call).
   */
  public async callTool(
    name: string,
    args: Record<string, unknown> = {},
    signal?: AbortSignal
  ): Promise<McpCallToolResult> {
    if (this.status !== "connected") {
      throw new Error(`El cliente MCP "${this.config.id}" no está conectado.`);
    }

    return this.sendRequest<McpCallToolResult>(
      "tools/call",
      {
        name,
        arguments: args
      },
      signal
    );
  }

  /**
   * Importa las herramientas descubiertas en el ToolRegistry de Ego.
   *
   * H31: los servidores no firmados importan con `requiresApproval: true`
   * (HITL obligatorio aunque la herramienta sea "safe"). `overrideExisting`
   * se audita con warn explícito por herramienta sobrescrita, nunca en
   * silencio.
   *
   * EGO-FIND-49 (Ola 1b T1) — **toma de control de tools**:
   * - Una tool con `origin === "native"` **NUNCA** puede ser sobrescrita por
   *   un servidor MCP, ni siquiera con `overrideExisting: true`. Un servidor
   *   de terceros que se approprie de `fs_read_file` o `terminal_exec` haría
   *   que el agente ejecutase código del servidor creyendo que es la tool de
   *   Ego.
   * - El override de una tool **de servidor** exige `overrideExisting: true`
   *   (que el `McpManager` traduce al `allowOverride` explícito por servidor).
   *
   * Devuelve el número de tools registradas (firma estable). Para la traza
   * auditable usa `importIntoRegistryDetailed`.
   */
  public importIntoRegistry(
    registry: ToolRegistry,
    options: McpImportOptions = {}
  ): number {
    return this.importIntoRegistryDetailed(registry, options).registered;
  }

  /**
   * Igual que `importIntoRegistry`, pero devuelve la **traza auditable** de
   * cada tool del servidor: registrada, omitida (tool nativa protegida u
   * override no permitido) o sobrescrita.
   */
  public importIntoRegistryDetailed(
    registry: ToolRegistry,
    options: McpImportOptions = {}
  ): McpToolImportResult {
    const prefix = options.prefix ?? this.config.toolPrefix;
    const allowOverride = options.overrideExisting === true;
    const unsigned = !this.isSignedServer();
    let registeredCount = 0;
    const decisions: McpToolImportDecision[] = [];

    for (const mcpTool of this.cachedTools) {
      const toolName = prefix ? `${prefix}_${mcpTool.name}` : mcpTool.name;

      const existing = registry.get(toolName);
      if (existing) {
        // VETO ABSOLUTO: una tool nativa de Ego no es redefinible desde un
        // servidor MCP (takeover de tool).
        if (existing.origin === "native") {
          decisions.push({
            toolName,
            serverToolName: mcpTool.name,
            action: "skipped_native_protected",
            reason:
              `La tool nativa '${toolName}' está protegida: un servidor MCP no puede sustituir su implementación.`,
            existingOrigin: existing.origin,
            existingServerId: existing.mcpServerId,
            serverId: this.config.id,
          });
          continue;
        }

        if (!allowOverride) {
          decisions.push({
            toolName,
            serverToolName: mcpTool.name,
            action: "skipped_override_not_allowed",
            reason:
              `La tool '${toolName}' ya está registrada por '${existing.mcpServerId ?? "otro servidor"}' ` +
              `y este servidor no tiene 'allowOverride'.`,
            existingOrigin: existing.origin,
            existingServerId: existing.mcpServerId,
            serverId: this.config.id,
          });
          continue;
        }

        // Override EXPLÍCITO de una tool de servidor → queda auditado.
        decisions.push({
          toolName,
          serverToolName: mcpTool.name,
          action: "overridden",
          reason:
            `El servidor '${this.config.id}' sobrescribe la tool '${toolName}' ` +
            `registrada por '${existing.mcpServerId ?? "otro servidor"}' (allowOverride explícito).`,
          existingOrigin: existing.origin,
          serverId: this.config.id,
        });
        console.warn(
          `[McpClient] overrideExisting:true — sobrescribiendo herramienta "${toolName}" del servidor MCP "${this.config.id}".`
        );
      }

      const riskLevel = this.inferRiskLevel(mcpTool.name, options.defaultRiskLevel);
      const zodSchema = jsonSchemaToZod(mcpTool.inputSchema);

      const toolDef: ToolDefinition = {
        name: toolName,
        description: mcpTool.description || `Herramienta MCP: ${mcpTool.name}`,
        category: "mcp",
        riskLevel,
        requiresApproval: unsigned ? true : undefined,
        origin: "mcp",
        mcpServerId: this.config.id,
        inputSchema: zodSchema,
        execute: async (input: unknown, context) => {
          const res = await this.callTool(
            mcpTool.name,
            input as Record<string, unknown>,
            context?.abortSignal
          );

          if (res.isError) {
            const errorText =
              res.content
                .filter((c) => c.type === "text" && c.text)
                .map((c) => c.text)
                .join("\n") || `Error reportado por herramienta MCP "${mcpTool.name}".`;
            throw new Error(errorText);
          }

          // Unificar partes de texto o devolver contenido bruto
          const textChunks = res.content
            .filter((c) => c.type === "text" && c.text)
            .map((c) => c.text)
            .join("\n");

          return textChunks || res.content;
        }
      };

      registry.register(toolDef, { allowOverride: true });
      registeredCount++;

      if (!existing) {
        decisions.push({
          toolName,
          serverToolName: mcpTool.name,
          action: "registered",
          reason: `Tool '${toolName}' registrada desde el servidor MCP '${this.config.id}'.`,
          serverId: this.config.id,
        });
      }
    }

    return { registered: registeredCount, decisions };
  }

  // --- MÉTODOS PRIVADOS DE INFRAESTRUCTURA Y PROTOCOLO ---

  private spawnProcess(): void {
    assertSafeSpawnConfig(this.config);
    const { command, args = [], cwd } = this.config;

    // EGO-FIND-33 / D2: env allowlist + marcadores de secreto (el subproceso
    // nunca ve el token real salvo excepción registrada `secretDelivery:"env"`).
    const childEnv = buildMcpChildEnv(this.config, {
      baseEnv: process.env,
      extraAllowedEnv: this.extraAllowedEnv,
    });

    this.process = spawn(command, args, {
      cwd,
      env: childEnv,
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.stdoutBuffer = "";
    this.stderrBuffer = "";

    this.process.stdout?.on("data", (chunk: Buffer) => {
      this.handleStdoutData(chunk);
    });

    this.process.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      this.stderrBuffer = (this.stderrBuffer + text).slice(-8192); // Mantener últimos 8KB
      this.emit("stderr", text);
    });

    this.process.on("error", (err: Error) => {
      this.setStatus("error");
      if (this.listenerCount("error") > 0) {
        this.emit("error", err);
      }
      this.rejectAllPending(new Error(`Error en subproceso MCP: ${err.message}`));
    });

    this.process.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      if (this.status !== "disconnected") {
        this.setStatus("error");
      }
      this.emit("exit", { code, signal, stderr: this.stderrBuffer });
      this.rejectAllPending(
        new Error(`El subproceso MCP terminó inesperadamente (código: ${code}, señal: ${signal}).`)
      );
    });
  }

  private handleStdoutData(chunk: Buffer): void {
    this.stdoutBuffer += chunk.toString("utf8");

    let newlineIndex: number;
    while ((newlineIndex = this.stdoutBuffer.indexOf("\n")) !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);

      if (!line) continue;

      try {
        const msg = JSON.parse(line);
        this.handleJsonRpcMessage(msg);
      } catch (err) {
        // Ignorar líneas no JSON o diagnósticos de consola
        this.emit("parseError", { line, error: err });
      }
    }
  }

  private handleJsonRpcMessage(msg: unknown): void {
    if (!msg || typeof msg !== "object") return;
    const record = msg as Record<string, unknown>;

    // Petición servidor → cliente (tiene `id` Y `method`). Antes se descartaba
    // en silencio; ahora se enruta, se resuelven sus marcadores de secreto y
    // se responde (D2). Es el canal por el que un servidor MCP pide un valor
    // al cliente sin que el token salga de main.
    const hasId = "id" in record && record["id"] !== undefined && record["id"] !== null;
    const hasMethod = typeof record["method"] === "string";
    if (hasId && hasMethod) {
      void this.handleServerRequest(msg as JsonRpcRequest);
      return;
    }

    const response = msg as JsonRpcResponse;

    if (hasId) {
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(response.id);

        if (response.error) {
          pending.reject(
            new Error(`[MCP Error ${response.error.code}] ${response.error.message}`)
          );
        } else {
          pending.resolve(response.result);
        }
      }
    } else if ("method" in (msg as JsonRpcNotification)) {
      const notif = msg as JsonRpcNotification;
      this.emit("notification", notif);
    }
  }

  /**
   * Gestiona una petición JSON-RPC del servidor al cliente.
   *
   * - Resuelve los marcadores `{{SECRET:<clave>}}` de los params (D2): el
   *   servidor puede pedir un valor usando el marcador que recibió en su env
   *   sin que la credencial viaje dentro de su proceso.
   * - Delega en listeners `serverRequest` registrados por la app.
   * - Si no hay listener, responde con error JSON-RPC (fail-closed: el
   *   servidor no se queda colgado esperando).
   */
  private async handleServerRequest(request: JsonRpcRequest): Promise<void> {
    const method = request.method;
    const resolvedParams = this.secretResolver
      ? await resolveSecretMarkers(request.params, this.secretResolver)
      : request.params;

    if (this.listenerCount("serverRequest") > 0) {
      try {
        const result = await this.emitAsync("serverRequest", {
          method,
          params: resolvedParams,
        });
        this.respondToServerRequest(request.id, result ?? {});
        return;
      } catch (err: unknown) {
        console.warn(
          `[McpClient] Listener de 'serverRequest' falló para '${method}': ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    this.respondToServerRequest(request.id, undefined, {
      code: -32601,
      message: `Método '${method}' no soportado por el cliente MCP de Ego.`,
    });
  }

  /**
   * Emite un evento y devuelve la primera respuesta (soporta listeners async).
   * `EventEmitter.emit` es síncrono; esta envoltura es awaitable.
   */
  private async emitAsync(event: string, payload: unknown): Promise<unknown> {
    const listeners = this.listeners(event);
    for (const listener of listeners) {
      const outcome = (listener as (arg: unknown) => unknown)(payload);
      if (outcome instanceof Promise) {
        return await outcome;
      }
      return outcome;
    }
    return undefined;
  }

  /**
   * Escribe una respuesta JSON-RPC al servidor.
   */
  private respondToServerRequest(
    id: string | number,
    result?: unknown,
    error?: { code: number; message: string }
  ): void {
    if (!this.process || !this.process.stdin) return;
    const payload: JsonRpcResponse = error
      ? { jsonrpc: "2.0", id, error }
      : { jsonrpc: "2.0", id, result: result ?? {} };
    try {
      this.process.stdin.write(JSON.stringify(payload) + "\n");
    } catch (err: unknown) {
      console.warn(
        `[McpClient] No se pudo enviar la respuesta a la petición del servidor (id=${id}): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  private isHttpTransport(): boolean {
    return this.config.transport === "streamable-http";
  }

  /**
   * POST JSON-RPC stateless (streamable-http, Spec D1).
   * Seguridad: re-valida la URL en cada llamada (la config pudo mutar vía
   * `reload`), `redirect: "error"` (anti-SSRF por redirect a metadata),
   * timeout del `config.timeoutMs`, cuerpo capado a 1MB, sin eco de
   * cabeceras ni cuerpo en errores (cero eco).
   */
  private async httpPost<TResult>(
    method: string,
    params: unknown,
    signal?: AbortSignal
  ): Promise<TResult> {
    const endpoint = assertSafeMcpHttpUrl(this.config);
    if (signal?.aborted) {
      throw new Error("Llamada MCP cancelada por AbortSignal.");
    }
    const timeoutMs = this.config.timeoutMs ?? 30000;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      ctrl.abort(new Error(`Timeout de ${timeoutMs}ms excedido en MCP http "${this.config.id}".`));
    }, timeoutMs);
    const onCallerAbort = (): void => {
      ctrl.abort(signal?.reason ?? new Error("Llamada MCP cancelada por AbortSignal."));
    };
    signal?.addEventListener("abort", onCallerAbort, { once: true });
    try {
      const id = ++this.requestId;
      const payload: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
      const headers: Record<string, string> = {
        "content-type": "application/json",
        accept: "application/json",
        ...this.config.headers,
      };
      if (this.httpSessionId) {
        headers["mcp-session-id"] = this.httpSessionId;
      }
      let res: Response;
      try {
        res = await fetch(endpoint.toString(), {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          redirect: "error",
          signal: ctrl.signal,
        });
      } catch (err) {
        if (ctrl.signal.aborted) {
          const reason = ctrl.signal.reason;
          throw reason instanceof Error ? reason : new Error(String(reason));
        }
        throw new Error(
          `Fallo de red hacia MCP http "${this.config.id}": ${err instanceof Error ? err.message : "error desconocido"}`
        );
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream")) {
        throw new Error(
          `MCP http "${this.config.id}": respuesta SSE no soportada (STAB-12 solo POST JSON; deuda D1).`
        );
      }
      if (!res.ok) {
        throw new Error(`MCP http "${this.config.id}": HTTP ${res.status} en "${method}".`);
      }
      const sessionId = res.headers.get("mcp-session-id");
      if (sessionId && sessionId.length > 0 && sessionId.length <= 256) {
        this.httpSessionId = sessionId;
      }
      const text = await res.text();
      if (text.length > 1_000_000) {
        throw new Error(`MCP http "${this.config.id}": respuesta excede 1MB (anti-DoS).`);
      }
      let msg: JsonRpcResponse;
      try {
        msg = JSON.parse(text) as JsonRpcResponse;
      } catch {
        throw new Error(`MCP http "${this.config.id}": respuesta no-JSON en "${method}".`);
      }
      if (msg.error) {
        throw new Error(`[MCP Error ${msg.error.code}] ${msg.error.message}`);
      }
      return msg.result as TResult;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  private async sendRequest<TResult>(
    method: string,
    params: unknown,
    signal?: AbortSignal
  ): Promise<TResult> {
    if (this.isHttpTransport()) {
      return this.httpPost<TResult>(method, params, signal);
    }
    if (!this.process || !this.process.stdin) {
      throw new Error(`El proceso MCP "${this.config.id}" no está activo.`);
    }

    if (signal?.aborted) {
      throw new Error("Llamada MCP cancelada por AbortSignal.");
    }

    const id = ++this.requestId;
    // D2: los marcadores `{{SECRET:<clave>}}` se resuelven ANTES de salir
    // hacia el servidor. Sin resolver, el marcador viaja intacto (fail-closed:
    // el servidor recibe un marcador, nunca una credencial inventada).
    const resolvedParams = this.secretResolver
      ? await resolveSecretMarkers(params, this.secretResolver)
      : params;
    const requestPayload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params: resolvedParams
    };

    const timeoutMs = this.config.timeoutMs ?? 30000;

    return new Promise<TResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new Error(
            `Timeout de ${timeoutMs}ms excedido esperando respuesta a "${method}" de MCP "${this.config.id}".`
          )
        );
      }, timeoutMs);

      const abortHandler = () => {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(new Error(`Llamada a "${method}" de MCP cancelada por AbortSignal.`));
      };

      if (signal) {
        signal.addEventListener("abort", abortHandler, { once: true });
      }

      this.pendingRequests.set(id, {
        resolve: (val) => {
          if (signal) signal.removeEventListener("abort", abortHandler);
          resolve(val as TResult);
        },
        reject: (err) => {
          if (signal) signal.removeEventListener("abort", abortHandler);
          reject(err);
        },
        timer
      });

      const serialized = JSON.stringify(requestPayload) + "\n";
      this.process!.stdin!.write(serialized);
    });
  }

  private sendNotification(method: string, params: unknown): void {
    if (!this.process || !this.process.stdin) return;

    const notif: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      params
    };

    this.process.stdin.write(JSON.stringify(notif) + "\n");
  }

  private cleanupProcess(): void {
    this.rejectAllPending(new Error("Conexión MCP cerrada."));

    if (this.process) {
      try {
        this.process.kill();
      } catch {
        // Ignorar si ya terminó
      }
      this.process = null;
    }
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  private setStatus(newStatus: McpClientStatus): void {
    this.status = newStatus;
    this.emit("statusChange", newStatus);
  }

  private inferRiskLevel(name: string, defaultLevel?: ToolRiskLevel): ToolRiskLevel {
    if (defaultLevel) return defaultLevel;

    const lower = name.toLowerCase();
    if (
      lower.includes("get") ||
      lower.includes("read") ||
      lower.includes("list") ||
      lower.includes("search") ||
      lower.includes("fetch") ||
      lower.includes("inspect")
    ) {
      return "safe";
    }

    if (
      lower.includes("delete") ||
      lower.includes("remove") ||
      lower.includes("drop") ||
      lower.includes("kill") ||
      lower.includes("destroy") ||
      lower.includes("exec")
    ) {
      return "destructive";
    }

    return "sensitive";
  }
}
