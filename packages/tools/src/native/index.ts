import { ToolRegistry } from "../ToolRegistry.js";
import {
  createFsReadFileTool,
  createFsWriteFileTool,
  NativeFsOptions,
} from "./fs/NativeFsTool.js";
import {
  createGitStatusTool,
  createGitDiffTool,
  NativeGitOptions,
} from "./git/NativeGitTool.js";
import {
  createTerminalExecTool,
  NativeTerminalOptions,
} from "./terminal/NativeTerminalTool.js";

export * from "./fs/PathValidator.js";
export * from "./fs/FileLockManager.js";
export * from "./fs/NativeFsTool.js";

export * from "./git/GitParser.js";
export * from "./git/NativeGitTool.js";

export * from "./terminal/TerminalOutputBuffer.js";
export * from "./terminal/NativeTerminalTool.js";

export interface NativeToolsOptions {
  workspacePath?: string;
  terminalTimeoutMs?: number;
  enableFs?: boolean;
  enableGit?: boolean;
  enableTerminal?: boolean;
  fsOptions?: NativeFsOptions;
  gitOptions?: NativeGitOptions;
  terminalOptions?: NativeTerminalOptions;
}

/**
 * Registra de forma automatizada todos los conectores Nivel A Nativos en el ToolRegistry de Ego.
 * Proporciona acceso supervisado a Filesystem, Git local y Terminal CLI bajo sandboxing de workspace.
 */
export function registerNativeTools(
  registry: ToolRegistry,
  options: NativeToolsOptions = {}
): void {
  const enableFs = options.enableFs ?? true;
  const enableGit = options.enableGit ?? true;
  const enableTerminal = options.enableTerminal ?? true;

  if (enableFs) {
    registry.register(
      createFsReadFileTool({
        defaultWorkspacePath: options.workspacePath,
        ...options.fsOptions,
      })
    );
    registry.register(
      createFsWriteFileTool({
        defaultWorkspacePath: options.workspacePath,
        ...options.fsOptions,
      })
    );
  }

  if (enableGit) {
    registry.register(
      createGitStatusTool({
        defaultWorkspacePath: options.workspacePath,
        ...options.gitOptions,
      })
    );
    registry.register(
      createGitDiffTool({
        defaultWorkspacePath: options.workspacePath,
        ...options.gitOptions,
      })
    );
  }

  if (enableTerminal) {
    registry.register(
      createTerminalExecTool({
        defaultWorkspacePath: options.workspacePath,
        defaultTimeoutMs: options.terminalTimeoutMs,
        ...options.terminalOptions,
      })
    );
  }
}
