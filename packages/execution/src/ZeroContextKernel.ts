/**
 * ZeroContextKernel.ts — Kernel de Ejecución Zero-Context RPC en worker aislado.
 * Extraído y adaptado de Hermes Agent (HERM-18 / RFC-02) para Ego SOC.
 *
 * Permite encadenar programáticamente herramientas locales en un único turno cognitivo
 * ejecutando scripts aislados, ahorrando múltiples turnos y tokens de contexto.
 *
 * Aislamiento (FIX VULN-SEC-08-01): el script NUNCA se ejecuta en el main process.
 * Corre en un `worker_threads` dedicado dentro de un contexto `node:vm` endurecido:
 * - sandbox de prototipo nulo, SIN intrínsecos del host inyectados (el realm del
 *   `vm` provee los suyos, gobernados por el flag `codeGeneration`);
 * - `codeGeneration: { strings: false, wasm: false }` — ningún constructor
 *   alcanzable desde el script puede compilar strings (`this.constructor`,
 *   `({}).constructor`, `__proto__`, `Function`, `callTool.constructor`);
 * - `callTool`/`console` se definen con código del propio realm y el puente
 *   hacia el host (`__egoBridge`) se elimina tras el bootstrap;
 * - el puente solo transporta texto JSON (los resultados se re-parsean con el
 *   JSON del realm del sandbox: lo que toca el script son objetos del sandbox);
 * - watchdog en el padre + `terminate()` garantizado en `finally`
 *   (patrón timeout/kill de PythonSidecarBridge L08).
 *
 * LÍMITE HONESTO: el puente transporta solo datos JSON-serializables
 * (`undefined`/funciones/circulares no cruzan: `undefined` llega como `null`,
 * lo no serializable falla el call con error). `node:vm` + workers son
 * contención, no frontera formal contra exploits de motor.
 */

import { Worker } from "node:worker_threads";

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

/** Gracia extra sobre `timeoutMs` para spawn del worker + round-trips IPC. */
const WORKER_SPAWN_GRACE_MS = 2000;

/** Mensajes worker → padre. */
interface KernelWorkerCallMessage {
  type: "call";
  id: number;
  toolName: string;
  argsText: string;
}

interface KernelWorkerDoneMessage {
  type: "done";
  ok: boolean;
  value?: unknown;
  error?: string;
}

/** Mensaje padre → worker (respuesta a un `call`). */
interface KernelParentResultMessage {
  type: "result";
  id: number;
  ok: boolean;
  value?: string;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asWorkerCallMessage(value: unknown): KernelWorkerCallMessage | null {
  if (!isRecord(value)) return null;
  if (value.type !== "call") return null;
  if (typeof value.id !== "number") return null;
  if (typeof value.toolName !== "string") return null;
  if (typeof value.argsText !== "string") return null;
  return { type: "call", id: value.id, toolName: value.toolName, argsText: value.argsText };
}

function asWorkerDoneMessage(value: unknown): KernelWorkerDoneMessage | null {
  if (!isRecord(value)) return null;
  if (value.type !== "done") return null;
  if (typeof value.ok !== "boolean") return null;
  const done: KernelWorkerDoneMessage = { type: "done", ok: value.ok };
  if (typeof value.error === "string") done.error = value.error;
  if ("value" in value) done.value = value.value;
  return done;
}

/**
 * Bootstrap del worker. JavaScript plano (sin backticks ni `${}` para poder
 * embeberlo en un template literal): crea el contexto `vm` endurecido, define
 * `callTool`/`console` con código del propio realm, elimina el puente y corre
 * el script. Todo lo que cruza el puente viaja como texto JSON.
 */
const KERNEL_WORKER_SOURCE = `
'use strict';
const { parentPort } = require('node:worker_threads');
const vm = require('node:vm');
const pending = new Map();
let seq = 0;
function finishOk(value) {
  try {
    parentPort.postMessage({ type: 'done', ok: true, value: value });
  } catch (err) {
    parentPort.postMessage({ type: 'done', ok: false, error: 'returnValue no serializable: ' + (err && err.message ? err.message : String(err)) });
  }
}
function finishErr(err) {
  let message = 'error desconocido';
  try { message = err && err.message ? err.message : String(err); } catch (e) { message = 'error no serializable'; }
  try { parentPort.postMessage({ type: 'done', ok: false, error: message }); } catch (e) { /* padre ya cerrado */ }
}
parentPort.on('message', function (msg) {
  if (!msg || typeof msg !== 'object') { return; }
  if (msg.type === 'result') {
    const slot = pending.get(msg.id);
    if (slot) {
      pending.delete(msg.id);
      if (msg.ok) { slot.resolve(msg.value); } else { slot.reject(new Error(msg.error || 'callTool remoto fallo')); }
    }
    return;
  }
  if (msg.type !== 'run') { return; }
  (async function () {
    const sandbox = Object.assign(Object.create(null), {
      __egoBridge: function (toolName, argsText) {
        const id = (seq += 1);
        return new Promise(function (resolve, reject) {
          pending.set(id, { resolve: resolve, reject: reject });
          parentPort.postMessage({ type: 'call', id: id, toolName: toolName, argsText: argsText });
        });
      }
    });
    const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
    vm.runInContext(
      'globalThis.callTool = (function (bridge) { ' +
      'return async function callTool(toolName, args) { ' +
      'const text = await bridge(toolName, JSON.stringify(args === undefined ? {} : args)); ' +
      'return JSON.parse(text); }; })(globalThis.__egoBridge); ' +
      'globalThis.console = { log: function () {}, warn: function () {}, error: function () {} }; ' +
      'delete globalThis.__egoBridge;',
      context
    );
    const wrapped = '(async () => {\\n' + msg.script + '\\n})()';
    const script = new vm.Script(wrapped, { filename: 'zero-context-sandbox.js' });
    const value = await script.runInContext(context, { timeout: msg.timeoutMs });
    finishOk(value);
  })().catch(finishErr);
});
`;

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
   * Ejecuta un script programático encadenando herramientas en un worker
   * aislado. El main process solo despacha tools y nunca evalúa el script.
   */
  async executeScript(scriptSource: string): Promise<KernelExecutionReport> {
    const startTime = Date.now();
    const calls: Array<{
      toolName: string;
      args: Record<string, unknown>;
      timestamp: number;
    }> = [];

    let toolCallCount = 0;
    const timeoutMs = this.options.timeoutMs;
    const maxToolCalls = this.options.maxToolCalls;
    const allowedTools = this.options.allowedTools;
    const dispatcher = this.dispatcher;

    const fail = (error: string): KernelExecutionReport => ({
      success: false,
      returnValue: null,
      toolCallsExecuted: calls,
      durationMs: Date.now() - startTime,
      error,
    });

    let worker: Worker;
    try {
      worker = new Worker(KERNEL_WORKER_SOURCE, { eval: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(`No se pudo aislar la ejecución del kernel: ${message}`);
    }

    try {
      const returnValue = await new Promise<unknown>((resolve, reject) => {
        let settled = false;
        const settleResolve = (value: unknown): void => {
          if (settled) return;
          settled = true;
          clearTimeout(watchdog);
          resolve(value);
        };
        const settleReject = (err: Error): void => {
          if (settled) return;
          settled = true;
          clearTimeout(watchdog);
          reject(err);
        };

        const watchdog = setTimeout(() => {
          settleReject(
            new Error(
              `Timeout de ejecución del kernel (${timeoutMs}ms; worker terminado)`
            )
          );
        }, timeoutMs + WORKER_SPAWN_GRACE_MS);

        worker.on("message", (msg: unknown) => {
          const done = asWorkerDoneMessage(msg);
          if (done !== null) {
            if (done.ok === true) {
              settleResolve(done.value);
            } else {
              settleReject(
                new Error(
                  typeof done.error === "string" ? done.error : "el script falló sin mensaje"
                )
              );
            }
            return;
          }
          const call = asWorkerCallMessage(msg);
          if (call !== null) {
            void (async () => {
              const id = call.id;
              const toolName = call.toolName;
              const reply = (response: KernelParentResultMessage): void => {
                try {
                  worker.postMessage(response);
                } catch {
                  // Worker ya terminado; el watchdog liquida la ejecución.
                }
              };
              const failCall = (error: string): void => {
                reply({ type: "result", id, ok: false, error });
              };
              let args: Record<string, unknown> = {};
              try {
                const parsed: unknown = JSON.parse(call.argsText);
                if (!isRecord(parsed)) {
                  failCall("argumentos del puente no son un objeto");
                  return;
                }
                args = parsed;
              } catch {
                failCall("argumentos del puente no parseables");
                return;
              }
              if (allowedTools.length > 0 && !allowedTools.includes(toolName)) {
                failCall(`Herramienta no autorizada en ZeroContextKernel: ${toolName}`);
                return;
              }
              if (toolCallCount >= maxToolCalls) {
                failCall(
                  `Límite de cuota de llamadas excedido en ZeroContextKernel (máximo: ${maxToolCalls})`
                );
                return;
              }
              toolCallCount += 1;
              calls.push({ toolName, args, timestamp: Date.now() });
              try {
                const value = await dispatcher(toolName, args);
                const text = JSON.stringify(value);
                reply({
                  type: "result",
                  id,
                  ok: true,
                  value: text === undefined ? "null" : text,
                });
              } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                failCall(message);
              }
            })();
          }
        });

        worker.on("error", (err: Error) => {
          settleReject(new Error(`Fallo del worker del kernel: ${err.message}`));
        });

        worker.on("exit", (code: number) => {
          settleReject(new Error(`El worker del kernel terminó con código ${code}`));
        });

        try {
          worker.postMessage({ type: "run", script: scriptSource, timeoutMs });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          settleReject(new Error(`No se pudo enviar el script al worker: ${message}`));
        }
      });

      return {
        success: true,
        returnValue,
        toolCallsExecuted: calls,
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(message);
    } finally {
      // El watchdog vive dentro de la promesa y se limpia al liquidar;
      // aquí se garantiza que el worker no sobreviva al reporte.
      try {
        await worker.terminate();
      } catch {
        // Worker ya terminado; nada que rematar.
      }
    }
  }
}
