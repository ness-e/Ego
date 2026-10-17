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
import {
  createCanvasRenderTool,
  NativeCanvasOptions,
} from "./canvas/NativeCanvasTool.js";

export * from "./fs/PathValidator.js";
export * from "./fs/FileLockManager.js";
export * from "./fs/NativeFsTool.js";

export * from "./git/GitParser.js";
export * from "./git/NativeGitTool.js";
export * from "./git/SessionDiffRevisions.js";
export * from "./git/ChangeSetService.js";
export * from "./security/NetPolicy.js";
export * from "./security/ResourcePolicy.js";

export * from "./canvas/NativeCanvasTool.js";

export * from "./terminal/TerminalOutputBuffer.js";
export * from "./terminal/NativeTerminalTool.js";
export * from "./terminal/TerminalSessionStore.js";

export interface NativeToolsOptions {
  workspacePath?: string;
  terminalTimeoutMs?: number;
  enableFs?: boolean;
  enableGit?: boolean;
  enableTerminal?: boolean;
  enableCanvas?: boolean;
  fsOptions?: NativeFsOptions;
  gitOptions?: NativeGitOptions;
  terminalOptions?: NativeTerminalOptions;
  canvasOptions?: NativeCanvasOptions;
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
  const enableCanvas = options.enableCanvas ?? false;

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

  if (enableCanvas) {
    registry.register(createCanvasRenderTool(options.canvasOptions));
  }
}
