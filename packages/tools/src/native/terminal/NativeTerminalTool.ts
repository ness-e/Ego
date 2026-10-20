import { spawn } from "node:child_process";
import { z } from "zod";
import { ToolDefinition, ToolExecutionContext } from "../../types.js";
import { TerminalOutputBuffer } from "./TerminalOutputBuffer.js";
import { PathValidator } from "../fs/PathValidator.js";
import { TerminalCommandPolicy, sanitizeProcessEnv } from "./TerminalCommandPolicy.js";

/**
 * Comandos letales o destructivos que son bloqueados de forma inmediata por guardrails de seguridad.
 *
 * NOTA (EGO-FIND-32): esta denylist es **capa 1 (defensa en profundidad)**, no
 * la política principal. La política que decide es la allowlist deny-by-default
 * de `TerminalCommandPolicy` (capa 2), que se aplica a continuación y que
 * cierra los bypasses que esta lista no cubre (`rm -fr`, `Remove-Item`,
 * `cmd /c`, `powershell -enc`, …).
 */
const FORBIDDEN_COMMAND_PATTERNS = [
  /rm\s+-rf\s+[\/\\]/i,
  /rmdir\s+\/s\s+\/q\s+[a-zA-Z]:[\/\\]/i,
  /format\s+[a-zA-Z]:/i,
  /:(){ :|:& };:/, // Fork bomb
  /mkfs/i,
  /dd\s+if=.*of=\/dev\/(sd|nvme|hd)/i,
];

const TerminalExecInputSchema = z.object({
  command: z.string().describe("Comando o instrucción shell a ejecutar en el entorno local"),
  cwd: z.string().optional().describe("Directorio de trabajo relativo dentro del workspace (por defecto raíz del workspace)"),
  timeoutMs: z.number().optional().default(60000).describe("Timeout en milisegundos para la ejecución"),
});

export interface NativeTerminalOptions {
  defaultWorkspacePath?: string;
  defaultTimeoutMs?: number;
}

/**
 * Crea la herramienta nativa de ejecución de comandos CLI en terminal (`terminal_exec`).
 * Implementa sandboxing de directorio, supervisión con buffer de 16KB/2MB y cancelación cooperativa.
 */
export function createTerminalExecTool(options: NativeTerminalOptions = {}): ToolDefinition {
  return {
    name: "terminal_exec",
    description: "Ejecuta un comando en la terminal local del usuario confinado al workspace con límites de seguridad.",
    category: "terminal",
    riskLevel: "destructive",
    origin: "native",
    requiresApproval: true,
    tags: ["terminal", "cli", "exec", "governed"],
    inputSchema: TerminalExecInputSchema,
    execute: async (input: z.infer<typeof TerminalExecInputSchema>, context: ToolExecutionContext) => {
      const workspace = context.workspacePath || options.defaultWorkspacePath;
      if (!workspace) {
        throw new Error("No se definió workspacePath para la ejecución de terminal");
      }

      // 1. Detección preventiva de comandos prohibidos (capa 1: denylist)
      for (const pattern of FORBIDDEN_COMMAND_PATTERNS) {
        if (pattern.test(input.command)) {
          throw new Error(
            `Comando bloqueado por guardrail de seguridad (§4 AGENTS.md): Coincide con patrón de autodestrucción '${pattern}'`
          );
        }
      }

      // 1b. Allowlist deny-by-default (capa 2, la que decide).
      // EGO-FIND-32: la ruta del agente ya no se queda en la denylist.
      // Todo comando pasa por evaluación segmentada de la allowlist canónica.
      const decision = TerminalCommandPolicy.evaluate(input.command);
      if (!decision.allowed) {
        throw new Error(
          `Comando bloqueado por la política de terminal (EGO-FIND-32): ${decision.reason ?? "no permitido"}`
        );
      }

      // 2. Validación y confinamiento de directorio de trabajo
      const executionCwd = input.cwd
        ? await PathValidator.validatePathAsync(input.cwd, workspace)
        : workspace;

      const timeoutMs = input.timeoutMs || options.defaultTimeoutMs || 60000;
      const startTime = Date.now();
      const outputBuffer = new TerminalOutputBuffer();

      // EGO-FIND-33: el subproceso NO hereda el entorno completo.
      // Solo la allowlist explícita + variables EGO_*.
      const childEnv = sanitizeProcessEnv();
      // `git` no debe abrir un paginador interactivo (bloquearía el pipe).
      childEnv.GIT_PAGER = "cat";
      childEnv.GIT_TERMINAL_PROMPT = "0";

      return new Promise((resolve, reject) => {
        const isWindows = process.platform === "win32";
        const shell = isWindows ? "powershell.exe" : "/bin/bash";
        const shellArgs = isWindows ? ["-NoProfile", "-Command", input.command] : ["-c", input.command];

        const proc = spawn(shell, shellArgs, {
          cwd: executionCwd,
          env: childEnv as NodeJS.ProcessEnv,
          windowsHide: true,
        });

        let finished = false;

        // Temporizador de timeout
        const timeoutTimer = setTimeout(() => {
          if (!finished) {
            finished = true;
            proc.kill("SIGTERM");
            reject(new Error(`Timeout de ejecución excedido (${timeoutMs}ms) para comando: '${input.command}'`));
          }
        }, timeoutMs);

        // Cancelación cooperativa con AbortSignal (HELM-04)
        if (context.abortSignal) {
          context.abortSignal.addEventListener("abort", () => {
            if (!finished) {
              finished = true;
              clearTimeout(timeoutTimer);
              proc.kill("SIGINT"); // Enviar Ctrl+C inicial
              setTimeout(() => {
                try {
                  proc.kill("SIGTERM");
                } catch (err: unknown) {
                  console.warn(
                    `[NativeTerminalTool] No se pudo enviar SIGTERM al subproceso: ${
                      err instanceof Error ? err.message : String(err)
                    }`
                  );
                }
              }, 1500);
              reject(new Error(`Ejecución cancelada por el usuario (AbortSignal) para comando: '${input.command}'`));
            }
          });
        }

        // Acumulación en buffer con coalescencia
        proc.stdout?.on("data", (chunk) => {
          outputBuffer.append(chunk);
        });

        proc.stderr?.on("data", (chunk) => {
          outputBuffer.append(chunk);
        });

        proc.on("error", (err) => {
          if (!finished) {
            finished = true;
            clearTimeout(timeoutTimer);
            reject(new Error(`Fallo al lanzar proceso de terminal: ${err.message}`));
          }
        });

        proc.on("close", (exitCode) => {
          if (!finished) {
            finished = true;
            clearTimeout(timeoutTimer);
            const durationMs = Date.now() - startTime;

            resolve({
              command: input.command,
              cwd: executionCwd,
              exitCode: exitCode ?? 0,
              durationMs,
              output: outputBuffer.getOutput(),
              totalBytes: outputBuffer.getTotalBytes(),
            });
          }
        });
      });
    },
  };
}
