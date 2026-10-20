export type TerminalSessionStatus = "running" | "exited" | "error";

export interface TerminalSessionSnapshot {
  sessionId: string;
  workspaceId: string;
  title: string;
  command: string;
  cwd?: string;
  status: TerminalSessionStatus;
  exitCode: number | null;
  startedAt: number;
  endedAt?: number;
  bufferedBytes: number;
  truncated: boolean;
}

export type TerminalChunkListener = (chunk: string) => void;
export type TerminalStatusListener = (status: TerminalSessionStatus, exitCode: number | null) => void;
export type WorkspaceTerminalListener = (sessions: TerminalSessionSnapshot[]) => void;

export interface AttachSessionResult {
  snapshot: TerminalSessionSnapshot;
  replayChunks: string[];
  detach: () => void;
}

export interface CreateSessionOptions {
  sessionId: string;
  workspaceId: string;
  title?: string;
  command: string;
  cwd?: string;
  maxBufferBytes?: number;
}

interface TerminalInstanceInternal {
  sessionId: string;
  workspaceId: string;
  title: string;
  command: string;
  cwd?: string;
  status: TerminalSessionStatus;
  exitCode: number | null;
  startedAt: number;
  endedAt?: number;
  chunks: string[];
  bufferedBytes: number;
  maxBufferBytes: number;
  truncated: boolean;
  stdinHandler?: (data: string) => void;
  killHandler?: () => void;
}

/**
 * Almacén reactivo de sesiones de terminal en memoria (HELM-03).
 * Desacopla la recepción de ráfagas PTY/CLI del ciclo de renderizado de React,
 * permitiendo suscripciones granulares por sesión y por espacio de trabajo.
 */
export class TerminalSessionStore {
  public static readonly DEFAULT_MAX_CHUNK_BYTES = 2 * 1024 * 1024; // 2MB por terminal
  public static readonly TRUNCATION_NOTICE = "\r\n\x1b[33m… [Salida anterior truncada para optimizar memoria] …\x1b[0m\r\n";

  private instances: Map<string, TerminalInstanceInternal> = new Map();
  private chunkListeners: Map<string, Set<TerminalChunkListener>> = new Map();
  private statusListeners: Map<string, Set<TerminalStatusListener>> = new Map();
  private workspaceListeners: Map<string, Set<WorkspaceTerminalListener>> = new Map();

  /**
   * Registra una nueva sesión de terminal interactiva o en background.
   */
  public createSession(options: CreateSessionOptions): TerminalSessionSnapshot {
    const maxBufferBytes = options.maxBufferBytes ?? TerminalSessionStore.DEFAULT_MAX_CHUNK_BYTES;
    const instance: TerminalInstanceInternal = {
      sessionId: options.sessionId,
      workspaceId: options.workspaceId,
      title: options.title || options.command,
      command: options.command,
      cwd: options.cwd,
      status: "running",
      exitCode: null,
      startedAt: Date.now(),
      chunks: [],
      bufferedBytes: 0,
      maxBufferBytes,
      truncated: false,
    };

    this.instances.set(options.sessionId, instance);
    this.emitWorkspaceChange(options.workspaceId);
    return this.toSnapshot(instance);
  }

  /**
   * Agrega un fragmento de salida a la sesión y lo transmite inmediatamente a los observadores activos.
   */
  public appendOutput(sessionId: string, data: string): void {
    const instance = this.instances.get(sessionId);
    if (!instance) return;

    instance.chunks.push(data);
    instance.bufferedBytes += data.length;

    // Compactar si excede el tope configurado de memoria (ring-buffer)
    while (instance.bufferedBytes > instance.maxBufferBytes && instance.chunks.length > 1) {
      const dropped = instance.chunks.shift();
      if (!dropped) break;
      instance.bufferedBytes -= dropped.length;
      instance.truncated = true;
    }

    const listeners = this.chunkListeners.get(sessionId);
    if (listeners) {
      for (const listener of listeners) {
        listener(data);
      }
    }
  }

  /**
   * Marca la sesión como finalizada registrando código de salida o error.
   */
  public endSession(sessionId: string, exitCode: number = 0, error?: string): void {
    const instance = this.instances.get(sessionId);
    if (!instance) return;

    instance.status = error ? "error" : "exited";
    instance.exitCode = exitCode;
    instance.endedAt = Date.now();

    if (error) {
      const errorMsg = `\r\n\x1b[31m[ERROR: ${error}]\x1b[0m\r\n`;
      this.appendOutput(sessionId, errorMsg);
    }

    const statusListeners = this.statusListeners.get(sessionId);
    if (statusListeners) {
      for (const listener of statusListeners) {
        listener(instance.status, instance.exitCode);
      }
    }

    this.emitWorkspaceChange(instance.workspaceId);
  }

  /**
   * Conecta un componente visual (Canvas TerminalView o xterm) a una sesión.
   * Retorna los chunks previos para replay determinista y una función de detach.
   */
  public attach(
    sessionId: string,
    onChunk: TerminalChunkListener,
    onStatusChange?: TerminalStatusListener
  ): AttachSessionResult | null {
    const instance = this.instances.get(sessionId);
    if (!instance) return null;

    let chunkSet = this.chunkListeners.get(sessionId);
    if (!chunkSet) {
      chunkSet = new Set();
      this.chunkListeners.set(sessionId, chunkSet);
    }
    chunkSet.add(onChunk);

    if (onStatusChange) {
      let statusSet = this.statusListeners.get(sessionId);
      if (!statusSet) {
        statusSet = new Set();
        this.statusListeners.set(sessionId, statusSet);
      }
      statusSet.add(onStatusChange);
    }

    const replayChunks = instance.truncated
      ? [TerminalSessionStore.TRUNCATION_NOTICE, ...instance.chunks]
      : [...instance.chunks];

    return {
      snapshot: this.toSnapshot(instance),
      replayChunks,
      detach: () => {
        this.chunkListeners.get(sessionId)?.delete(onChunk);
        if (onStatusChange) {
          this.statusListeners.get(sessionId)?.delete(onStatusChange);
        }
      },
    };
  }

  /**
   * Suscribe un observador al listado de sesiones de un espacio de trabajo.
   * Se ejecuta inmediatamente con el estado actual.
   */
  public subscribeWorkspace(
    workspaceId: string,
    listener: WorkspaceTerminalListener
  ): () => void {
    let listeners = this.workspaceListeners.get(workspaceId);
    if (!listeners) {
      listeners = new Set();
      this.workspaceListeners.set(workspaceId, listeners);
    }
    listeners.add(listener);
    listener(this.getWorkspaceSessions(workspaceId));

    return () => {
      const set = this.workspaceListeners.get(workspaceId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.workspaceListeners.delete(workspaceId);
        }
      }
    };
  }

  /**
   * Obtiene la instantánea inmutable de una sesión.
   */
  public getSession(sessionId: string): TerminalSessionSnapshot | undefined {
    const instance = this.instances.get(sessionId);
    return instance ? this.toSnapshot(instance) : undefined;
  }

  /**
   * Obtiene todas las sesiones asociadas a un workspace.
   */
  public getWorkspaceSessions(workspaceId: string): TerminalSessionSnapshot[] {
    const result: TerminalSessionSnapshot[] = [];
    for (const inst of this.instances.values()) {
      if (inst.workspaceId === workspaceId) {
        result.push(this.toSnapshot(inst));
      }
    }
    return result;
  }

  /**
   * Cierra y limpia una sesión de terminal, desconectando observadores.
   */
  public closeSession(sessionId: string): void {
    const instance = this.instances.get(sessionId);
    if (!instance) return;

    if (instance.status === "running" && instance.killHandler) {
      try {
        instance.killHandler();
      } catch (err: unknown) {
        console.warn(
          `[TerminalSessionStore] killHandler falló al cerrar la sesión '${sessionId}': ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    this.instances.delete(sessionId);
    this.chunkListeners.delete(sessionId);
    this.statusListeners.delete(sessionId);
    this.emitWorkspaceChange(instance.workspaceId);
  }

  /**
   * Asocia controladores de entrada y terminación de proceso.
   */
  public bindProcessHandlers(
    sessionId: string,
    handlers: { stdinHandler?: (data: string) => void; killHandler?: () => void }
  ): void {
    const instance = this.instances.get(sessionId);
    if (!instance) return;
    instance.stdinHandler = handlers.stdinHandler;
    instance.killHandler = handlers.killHandler;
  }

  /**
   * Envía datos a la entrada estándar (stdin) de la sesión.
   */
  public writeStdin(sessionId: string, data: string): boolean {
    const instance = this.instances.get(sessionId);
    if (!instance || instance.status !== "running" || !instance.stdinHandler) {
      return false;
    }
    instance.stdinHandler(data);
    return true;
  }

  /**
   * Reinicia el estado del almacén (exclusivo para pruebas).
   */
  public __resetForTests(): void {
    this.instances.clear();
    this.chunkListeners.clear();
    this.statusListeners.clear();
    this.workspaceListeners.clear();
  }

  private emitWorkspaceChange(workspaceId: string): void {
    const listeners = this.workspaceListeners.get(workspaceId);
    if (!listeners || listeners.size === 0) return;
    const snapshots = this.getWorkspaceSessions(workspaceId);
    for (const listener of listeners) {
      listener(snapshots);
    }
  }

  private toSnapshot(instance: TerminalInstanceInternal): TerminalSessionSnapshot {
    return {
      sessionId: instance.sessionId,
      workspaceId: instance.workspaceId,
      title: instance.title,
      command: instance.command,
      cwd: instance.cwd,
      status: instance.status,
      exitCode: instance.exitCode,
      startedAt: instance.startedAt,
      endedAt: instance.endedAt,
      bufferedBytes: instance.bufferedBytes,
      truncated: instance.truncated,
    };
  }
}

// Instancia singleton por defecto para el proceso
export const defaultTerminalSessionStore = new TerminalSessionStore();
