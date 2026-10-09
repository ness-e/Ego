import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import type { ToolRegistry, ToolDefinition, ToolRiskLevel } from "@ego/tools";
import { jsonSchemaToZod } from "./schema-bridge.js";
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
  McpToolDefinition
} from "./types.js";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * McpClient — Cliente universal MCP de nivel de producción sobre transporte stdio (ACT-09).
 *
 * Implementa:
 * - Handshake JSON-RPC 2.0 y ciclo de vida de herramientas MCP (2024-11-05).
 * - Compuerta HERM-18: Despacho directo de herramientas del sistema sin turnos de modelo.
 * - Compuerta COUC-10: SafeConfigMutation y recarga atómica con rollback transaccional.
 * - Mapeo dinámico y registro seguro en ToolRegistry de Ego.
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

  constructor(config: McpServerConfig) {
    super();
    this.config = { ...config };
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
   * Conecta con el servidor MCP arrancando el subproceso stdio y ejecutando el handshake.
   */
  public async connect(): Promise<void> {
    if (this.status === "connected" && this.process) {
      return;
    }

    this.setStatus("connecting");

    try {
      this.spawnProcess();

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
   * Desconecta limpiamente el cliente y finaliza el proceso hijo.
   */
  public async disconnect(): Promise<void> {
    this.cleanupProcess();
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
   */
  public importIntoRegistry(
    registry: ToolRegistry,
    options: McpImportOptions = {}
  ): number {
    const prefix = options.prefix ?? this.config.toolPrefix;
    let registeredCount = 0;

    for (const mcpTool of this.cachedTools) {
      const toolName = prefix ? `${prefix}_${mcpTool.name}` : mcpTool.name;

      if (!options.overrideExisting && registry.has(toolName)) {
        continue;
      }

      const riskLevel = this.inferRiskLevel(mcpTool.name, options.defaultRiskLevel);
      const zodSchema = jsonSchemaToZod(mcpTool.inputSchema);

      const toolDef: ToolDefinition = {
        name: toolName,
        description: mcpTool.description || `Herramienta MCP: ${mcpTool.name}`,
        category: "mcp",
        riskLevel,
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

      registry.register(toolDef);
      registeredCount++;
    }

    return registeredCount;
  }

  // --- MÉTODOS PRIVADOS DE INFRAESTRUCTURA Y PROTOCOLO ---

  private spawnProcess(): void {
    const { command, args = [], cwd, env } = this.config;

    this.process = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
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

    const response = msg as JsonRpcResponse;

    if ("id" in response && response.id !== undefined && response.id !== null) {
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

  private async sendRequest<TResult>(
    method: string,
    params: unknown,
    signal?: AbortSignal
  ): Promise<TResult> {
    if (!this.process || !this.process.stdin) {
      throw new Error(`El proceso MCP "${this.config.id}" no está activo.`);
    }

    if (signal?.aborted) {
      throw new Error("Llamada MCP cancelada por AbortSignal.");
    }

    const id = ++this.requestId;
    const requestPayload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params
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
