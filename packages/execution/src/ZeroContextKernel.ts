/**
 * ZeroContextKernel.ts — Kernel de Ejecución Zero-Context RPC in-process.
 * Extraído y adaptado de Hermes Agent (HERM-18 / RFC-02) para Ego SOC.
 *
 * Permite encadenar programáticamente herramientas locales en un único turno cognitivo
 * ejecutando scripts aislados con `node:vm`, ahorrando múltiples turnos y tokens de contexto.
 */

import * as vm from "node:vm";

export interface ToolDispatcher {
  (toolName: string, args: Record<string, unknown>): Promise<unknown>;
}

export interface KernelOptions {
  timeoutMs?: number;
  maxToolCalls?: number;
  allowedTools?: string[];
}

export interface KernelExecutionReport {
  success: boolean;
  returnValue: unknown;
  toolCallsExecuted: Array<{
    toolName: string;
    args: Record<string, unknown>;
    timestamp: number;
  }>;
  durationMs: number;
  error?: string;
}

export class ZeroContextKernel {
  private dispatcher: ToolDispatcher;
  private options: Required<KernelOptions>;

  constructor(dispatcher: ToolDispatcher, options: KernelOptions = {}) {
    this.dispatcher = dispatcher;
    this.options = {
      timeoutMs: options.timeoutMs ?? 10000,
      maxToolCalls: options.maxToolCalls ?? 15,
      allowedTools: options.allowedTools ?? [],
    };
  }

  /**
   * Ejecuta un script programático encadenando herramientas dentro de un sandbox `node:vm`.
   */
  async executeScript(scriptSource: string): Promise<KernelExecutionReport> {
    const startTime = Date.now();
    const calls: Array<{
      toolName: string;
      args: Record<string, unknown>;
      timestamp: number;
    }> = [];

    let toolCallCount = 0;

    const safeCallTool = async (
      toolName: string,
      args: Record<string, unknown> = {}
    ): Promise<unknown> => {
      if (this.options.allowedTools.length > 0 && !this.options.allowedTools.includes(toolName)) {
        throw new Error(`Herramienta no autorizada en ZeroContextKernel: ${toolName}`);
      }

      if (toolCallCount >= this.options.maxToolCalls) {
        throw new Error(
          `Límite de cuota de llamadas excedido en ZeroContextKernel (máximo: ${this.options.maxToolCalls})`
        );
      }

      toolCallCount += 1;
      calls.push({
        toolName,
        args,
        timestamp: Date.now(),
      });

      return await this.dispatcher(toolName, args);
    };

    const sandbox = {
      callTool: safeCallTool,
      console: {
        log: () => {},
        warn: () => {},
        error: () => {},
      },
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Promise,
      setTimeout,
      clearTimeout,
    };

    const context = vm.createContext(sandbox);

    try {
      // Envolver el script en una función async auto-ejecutada
      const wrappedScript = `(async () => {\n${scriptSource}\n})()`;
      const script = new vm.Script(wrappedScript, {
        filename: "zero-context-sandbox.js",
      });

      const promise = script.runInContext(context, {
        timeout: this.options.timeoutMs,
      }) as Promise<unknown>;

      // Await con timeout de seguridad
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error(`Timeout de ejecución del kernel (${this.options.timeoutMs}ms)`)),
          this.options.timeoutMs
        );
      });

      const returnValue = await Promise.race([promise, timeoutPromise]);

      return {
        success: true,
        returnValue,
        toolCallsExecuted: calls,
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        returnValue: null,
        toolCallsExecuted: calls,
        durationMs: Date.now() - startTime,
        error: message,
      };
    }
  }
}
