import type { ToolRegistry } from "@ego/tools";
import type { JsonRpcRequest, JsonRpcResponse } from "./types.js";

/**
 * EgoMcpServer — servidor MCP de Ego (EGO-FIND-46, AGENTS.md §7).
 *
 * Ego es "MCP Client + MCP Server". Este módulo implementa la mitad **servidor**:
 * expone el catálogo de tools de Ego, sus recursos (payloads y namespaces de
 * memoria) y los prompts derivados de los manifiestos de Sub-Ego a cualquier
 * cliente MCP externo.
 *
 * DISEÑO
 * -------
 * - **Sin dependencias nuevas**: los proveedores de recursos/prompts son
 *   interfaces estructurales (mismo patrón que `McpTokenStore`); el paquete
 *   no importa `@ego/ui-runtime` ni `@ego/subegos`, evitando ciclos.
 * - **Fail-closed en la ejecución**: `tools/call` sobre una tool que exige
 *   aprobación se RECHAZA si no hay `approvalGate` configurado. El servidor MCP
 *   es un *ingress* externo: sin el motor de aprobación HITL de main, no puede
 *   ejecutar tools sensibles.
 * - **Transporte**: `handleRequest` es puro (testeable sin procesos); `startStdio`
 *   es el adaptador de proceso (JSON-RPC delimitado por `\n` sobre stdio).
 */

/** Descriptor de un recurso expuesto por el servidor. */
export interface McpResourceDescriptor {
  readonly uri: string;
  readonly name: string;
  readonly description?: string;
  readonly mimeType?: string;
}

/**
 * Proveedor de recursos tipo payload (implementado por `PayloadRegistry` de
 * `@ego/ui-runtime`).
 */
export interface McpPayloadResourceProvider {
  list(): McpResourceDescriptor[];
  read(uri: string): { text?: string; blob?: string; mimeType?: string } | undefined;
}

/**
 * Proveedor de recursos tipo namespace de memoria (implementado por
 * `EgoMemoryAdapter` de `@ego/memory`).
 */
export interface McpMemoryResourceProvider {
  listNamespaces(): Promise<string[]>;
  readNamespace(
    namespace: string,
    limit?: number
  ): Promise<Array<{ key: string; payload: unknown }>>;
}

/** Descriptor de un prompt derivado de un Sub-Ego. */
export interface McpSubEgoPrompt {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly instructions?: string;
  readonly systemPrompt?: string;
}

/** Proveedor de prompts (implementado por `SubEgoRegistry` de `@ego/subegos`). */
export interface McpSubEgoPromptProvider {
  list(): Promise<McpSubEgoPrompt[]>;
}

/**
 * Gate de aprobación para `tools/call`. `true` = ejecutar; `false` = rechazar.
 * En producción lo implementa `ApprovalEngine` + `ApprovalAuditSink` de main.
 */
export type McpApprovalGate = (toolName: string, input: unknown) => Promise<boolean>;

/** Dependencias del servidor MCP de Ego. */
export interface EgoMcpServerOptions {
  /** Catálogo de tools que se expone como `tools/list`. */
  toolRegistry: ToolRegistry;
  /** Recursos tipo payload (opcional). */
  payloadRegistry?: McpPayloadResourceProvider;
  /** Recursos tipo namespace de memoria (opcional). */
  memoryAdapter?: McpMemoryResourceProvider;
  /** Prompts derivados de los Sub-Egos (opcional). */
  subEgoRegistry?: McpSubEgoPromptProvider;
  /** Gate de aprobación HITL. Sin él, las tools sensibles se rechazan. */
  approvalGate?: McpApprovalGate;
  /** Nombre del servidor (por defecto `ego`). */
  serverName?: string;
  /** Versión del servidor (por defecto `0.1.0`). */
  version?: string;
  /** Contexto de ejecución inyectado en las tools llamadas. */
  executionContext?: {
    sessionId?: string;
    projectId?: string;
    workspacePath?: string;
  };
}

/** Códigos de error JSON-RPC usados por el servidor. */
const JSONRPC_METHOD_NOT_FOUND = -32601;
const JSONRPC_INVALID_PARAMS = -32602;
const JSONRPC_INTERNAL_ERROR = -32603;
const JSONRPC_INVALID_REQUEST = -32600;

export class EgoMcpServer {
  private readonly options: EgoMcpServerOptions;

  constructor(options: EgoMcpServerOptions) {
    this.options = options;
  }

  /**
   * Punto de entrada único: despacha una petición JSON-RPC.
   * Nunca lanza: los fallos se devuelven como `JsonRpcResponse.error`.
   */
  public async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const id = request.id;
    try {
      switch (request.method) {
        case "initialize":
          return this.ok(id, this.handleInitialize());
        case "notifications/initialized":
          return this.ok(id, {});
        case "tools/list":
          return this.ok(id, this.handleToolsList());
        case "tools/call":
          return await this.handleToolsCall(id, request);
        case "resources/list":
          return this.ok(id, await this.handleResourcesList());
        case "resources/read":
          return this.ok(id, await this.handleResourcesRead(request));
        case "prompts/list":
          return this.ok(id, await this.handlePromptsList());
        case "prompts/get":
          return this.ok(id, await this.handlePromptsGet(request));
        case "ping":
          return this.ok(id, {});
        default:
          return this.fail(id, JSONRPC_METHOD_NOT_FOUND, `Método '${request.method}' no soportado.`);
      }
    } catch (err: unknown) {
      return this.fail(
        id,
        JSONRPC_INTERNAL_ERROR,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // ---------------------------------------------------------------- handlers

  private handleInitialize(): Record<string, unknown> {
    return {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true, subscribe: false },
        prompts: { listChanged: true },
        logging: {},
      },
      serverInfo: {
        name: this.options.serverName ?? "ego",
        version: this.options.version ?? "0.1.0",
      },
    };
  }

  private handleToolsList(): { tools: Array<Record<string, unknown>> } {
    const schemas = this.options.toolRegistry.exportJsonSchemas();
    return {
      tools: schemas.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters,
      })),
    };
  }

  private async handleToolsCall(
    id: string | number,
    request: JsonRpcRequest
  ): Promise<JsonRpcResponse> {
    const params = (request.params ?? {}) as { name?: unknown; arguments?: unknown };
    const toolName = typeof params.name === "string" ? params.name : "";
    if (toolName.length === 0) {
      return this.fail(id, JSONRPC_INVALID_PARAMS, "`tools/call` exige el campo 'name'.");
    }

    const tool = this.options.toolRegistry.get(toolName);
    if (!tool) {
      return this.fail(id, JSONRPC_INVALID_PARAMS, `Herramienta '${toolName}' no registrada.`);
    }

    const args = params.arguments ?? {};

    // Validación de entrada contra el esquema Zod de la tool (el servidor MCP
    // es un ingress externo: nunca ejecuta con argumentos sin validar).
    const validation = this.options.toolRegistry.validateInput(toolName, args);
    if (!validation.success) {
      return this.fail(
        id,
        JSONRPC_INVALID_PARAMS,
        `Argumentos inválidos para '${toolName}': ${validation.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`
      );
    }
    const validatedArgs = validation.data as Record<string, unknown>;

    // Fail-closed: el servidor MCP es un ingress externo. Sin gate HITL
    // configurado, ninguna tool que exija aprobación puede ejecutarse.
    if (this.options.toolRegistry.resolveApprovalRequirement(tool)) {
      if (!this.options.approvalGate) {
        return this.fail(
          id,
          JSONRPC_INVALID_REQUEST,
          `La herramienta '${toolName}' requiere aprobación humana (HITL) y el servidor MCP no tiene gate de aprobación configurado.`
        );
      }
      const approved = await this.options.approvalGate(toolName, validatedArgs);
      if (!approved) {
        return this.fail(
          id,
          JSONRPC_INVALID_REQUEST,
          `La ejecución de '${toolName}' fue rechazada por el gate de aprobación.`
        );
      }
    }

    try {
      const output = await tool.execute(validatedArgs, {
        callId: `mcp_${toolName}_${Date.now()}`,
        sessionId: this.options.executionContext?.sessionId ?? "mcp-server",
        projectId: this.options.executionContext?.projectId,
        workspacePath: this.options.executionContext?.workspacePath,
      });

      return this.ok(id, {
        content: [{ type: "text", text: EgoMcpServer.stringifyOutput(output) }],
        isError: false,
      });
    } catch (err: unknown) {
      // El error de la tool NO es un error de protocolo: se devuelve como
      // resultado con `isError: true` (convención MCP).
      return this.ok(id, {
        content: [
          {
            type: "text",
            text: err instanceof Error ? err.message : String(err),
          },
        ],
        isError: true,
      });
    }
  }

  private async handleResourcesList(): Promise<{ resources: McpResourceDescriptor[] }> {
    const resources: McpResourceDescriptor[] = [];

    const payloadProvider = this.options.payloadRegistry;
    if (payloadProvider) {
      for (const resource of payloadProvider.list()) {
        resources.push(resource);
      }
    }

    const memoryProvider = this.options.memoryAdapter;
    if (memoryProvider) {
      const namespaces = await memoryProvider.listNamespaces();
      for (const namespace of namespaces) {
        resources.push({
          uri: `memory://${namespace}`,
          name: namespace,
          description: `Namespace de memoria de Ego: ${namespace}`,
          mimeType: "application/json",
        });
      }
    }

    return { resources };
  }

  private async handleResourcesRead(request: JsonRpcRequest): Promise<{
    contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }>;
  }> {
    const params = (request.params ?? {}) as { uri?: unknown };
    const uri = typeof params.uri === "string" ? params.uri : "";
    if (uri.length === 0) {
      return { contents: [] };
    }

    if (uri.startsWith("payload://")) {
      const payloadProvider = this.options.payloadRegistry;
      const resource = payloadProvider?.read(uri);
      if (!resource) {
        return { contents: [] };
      }
      return {
        contents: [
          {
            uri,
            mimeType: resource.mimeType ?? "text/plain",
            ...(resource.text !== undefined ? { text: resource.text } : {}),
            ...(resource.blob !== undefined ? { blob: resource.blob } : {}),
          },
        ],
      };
    }

    if (uri.startsWith("memory://")) {
      const namespace = uri.slice("memory://".length);
      const memoryProvider = this.options.memoryAdapter;
      if (!memoryProvider) {
        return { contents: [] };
      }
      const records = await memoryProvider.readNamespace(namespace);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(records, null, 2),
          },
        ],
      };
    }

    return { contents: [] };
  }

  private async handlePromptsList(): Promise<{
    prompts: Array<{ name: string; description?: string; arguments: unknown[] }>;
  }> {
    const provider = this.options.subEgoRegistry;
    if (!provider) {
      return { prompts: [] };
    }
    const manifests = await provider.list();
    return {
      prompts: manifests.map((manifest) => ({
        name: manifest.id,
        description: manifest.description ?? manifest.name,
        arguments: [],
      })),
    };
  }

  private async handlePromptsGet(request: JsonRpcRequest): Promise<{
    description: string;
    messages: Array<{ role: string; content: { type: string; text: string } }>;
  }> {
    const params = (request.params ?? {}) as { name?: unknown };
    const name = typeof params.name === "string" ? params.name : "";

    const provider = this.options.subEgoRegistry;
    const manifest = provider
      ? (await provider.list()).find((p) => p.id === name)
      : undefined;

    if (!manifest) {
      return {
        description: `Prompt '${name}' no encontrado.`,
        messages: [],
      };
    }

    const body = manifest.instructions ?? manifest.systemPrompt ?? "";
    return {
      description: manifest.description ?? manifest.name,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: body.length > 0 ? body : `Actúa como ${manifest.name}.`,
          },
        },
      ],
    };
  }

  // ------------------------------------------------------------- transporte

  /**
   * Arranca el servidor sobre stdio (JSON-RPC delimitado por `\n`).
   *
   * Pensado para que main lo lance como proceso hijo (`node dist/...` o el
   * propio binario de Electron con un flag `--mcp-server`).
   */
  public startStdio(
    input: NodeJS.ReadableStream = process.stdin,
    output: NodeJS.WritableStream = process.stdout
  ): void {
    let buffer = "";
    input.setEncoding?.("utf8");
    input.on("data", (chunk: string | Buffer) => {
      buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line.length === 0) continue;
        void this.processLine(line, output);
      }
    });
  }

  private async processLine(line: string, output: NodeJS.WritableStream): Promise<void> {
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line) as JsonRpcRequest;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.write(output, this.fail(0, JSONRPC_INVALID_REQUEST, `JSON inválido: ${message}`));
      return;
    }
    const response = await this.handleRequest(request);
    // Las notificaciones no admiten respuesta.
    if (response.id === undefined) return;
    this.write(output, response);
  }

  private write(output: NodeJS.WritableStream, payload: JsonRpcResponse): void {
    try {
      output.write(JSON.stringify(payload) + "\n");
    } catch (err: unknown) {
      console.warn(
        `[EgoMcpServer] No se pudo escribir la respuesta: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // ----------------------------------------------------------------- helpers

  private ok(id: string | number, result: unknown): JsonRpcResponse {
    return { jsonrpc: "2.0", id, result };
  }

  private fail(
    id: string | number,
    code: number,
    message: string
  ): JsonRpcResponse {
    return { jsonrpc: "2.0", id, error: { code, message } };
  }

  private static stringifyOutput(output: unknown): string {
    if (typeof output === "string") return output;
    try {
      return JSON.stringify(output, null, 2) ?? String(output);
    } catch (err: unknown) {
      return `[EgoMcpServer] Salida no serializable: ${
        err instanceof Error ? err.message : String(err)
      }`;
    }
  }
}
