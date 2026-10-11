import { EventBus } from "@ego/events";

export interface SyntheticTourOptions {
  speedMultiplier?: number;
  autoResolveApprovals?: boolean;
}

export type SyntheticScenario = "basic_refactor" | "hitl_approval_flow" | "subego_delegation";

/**
 * SyntheticRuntime - Runtime sintético y motor de modo demo (Patrón Coucou COUC-14 / DemoEngine).
 *
 * Inyecta secuencias deterministas de eventos canónicos (turnos, llamadas a herramientas, diffs,
 * aprobaciones HITL) con aislamiento estricto por tokens RunEpoch (`epochToken`).
 * Permite QA reproducible, tests E2E y demos visuales sin alterar la base de datos VantaDB real.
 */
export class SyntheticRuntime {
  private readonly eventBus: EventBus;
  private isRunning: boolean = false;
  private epochCounter: number = 0;
  private activeEpochToken: string = "";
  private activeTimers = new Set<NodeJS.Timeout>();
  private activeResolvers = new Set<() => void>();

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus ?? new EventBus();
  }

  public isSimulating(): boolean {
    return this.isRunning;
  }

  public currentEpoch(): string {
    return this.activeEpochToken;
  }

  /**
   * Inicia un tour simulado completo de demostración.
   */
  public async startTour(options: SyntheticTourOptions = {}): Promise<void> {
    this.stop(); // Cancela cualquier ejecución previa y descarta closures stale

    this.isRunning = true;
    this.epochCounter++;
    this.activeEpochToken = `epoch_${this.epochCounter}_${Date.now()}`;
    const epoch = this.activeEpochToken;
    const speed = Math.max(0.1, options.speedMultiplier ?? 1.0);

    const stepDelay = (ms: number) =>
      new Promise<void>((resolve) => {
        if (!this.isValidEpoch(epoch)) return resolve();
        let timer: NodeJS.Timeout;
        const cleanup = () => {
          this.activeTimers.delete(timer);
          this.activeResolvers.delete(onAbort);
        };
        const onAbort = () => {
          cleanup();
          clearTimeout(timer);
          resolve();
        };
        timer = setTimeout(() => {
          cleanup();
          resolve();
        }, ms / speed);
        this.activeTimers.add(timer);
        this.activeResolvers.add(onAbort);
      });

    // 1. Iniciar tarea simulada
    const runId = `demo_run_${this.epochCounter}`;
    this.eventBus.emit("task.started", { taskId: runId, startedAt: Date.now() }, {
      source: "synthetic-runtime",
      metadata: { epochToken: epoch, isSynthetic: true },
    });

    await stepDelay(50);
    if (!this.isValidEpoch(epoch)) return;

    // 2. Ejecutar herramienta de lectura
    this.eventBus.emit("tool.started", {
      callId: "call_read_1",
      toolName: "fs_read_file",
      input: { path: "src/auth.ts" },
    }, { source: "synthetic-runtime", sessionId: runId, metadata: { epochToken: epoch } });

    await stepDelay(40);
    if (!this.isValidEpoch(epoch)) return;

    this.eventBus.emit("tool.executed", {
      callId: "call_read_1",
      toolName: "fs_read_file",
      durationMs: 35,
      result: "// Contenido existente de auth.ts",
    }, { source: "synthetic-runtime", sessionId: runId, metadata: { epochToken: epoch } });

    await stepDelay(50);
    if (!this.isValidEpoch(epoch)) return;

    // 3. Simular solicitud interactiva HITL
    const approvalId = `demo_appr_${this.epochCounter}`;
    this.eventBus.emit("approval.required", {
      approvalId,
      action: "fs_write_file",
      riskLevel: "destructive",
      details: { path: "src/auth.ts", bytes: 1420 },
    }, { source: "synthetic-runtime", sessionId: runId, metadata: { epochToken: epoch } });

    if (options.autoResolveApprovals ?? true) {
      await stepDelay(80);
      if (!this.isValidEpoch(epoch)) return;

      this.eventBus.emit("approval.resolved", {
        approvalId,
        approved: true,
        resolvedBy: "demo-simulator",
        reason: "Aprobación simulada de prueba",
      }, { source: "synthetic-runtime", sessionId: runId, metadata: { epochToken: epoch } });
    }

    await stepDelay(50);
    if (!this.isValidEpoch(epoch)) return;

    // 4. Completar tarea
    this.eventBus.emit("task.completed", {
      taskId: runId,
      durationMs: 250,
      result: "Tour simulado completado con éxito.",
    }, { source: "synthetic-runtime", sessionId: runId, metadata: { epochToken: epoch } });

    this.isRunning = false;
  }

  /**
   * Ejecuta un escenario sintético puntual.
   */
  public emitScenario(scenario: SyntheticScenario, runId: string = "demo_scenario"): void {
    const epoch = `epoch_scen_${Date.now()}`;
    const meta = { epochToken: epoch, isSynthetic: true };
    switch (scenario) {
      case "basic_refactor":
        this.eventBus.emit("task.started", { taskId: runId, startedAt: Date.now() }, { source: "synthetic", metadata: meta });
        this.eventBus.emit("tool.started", { callId: "c1", toolName: "git_diff", input: {} }, { source: "synthetic", sessionId: runId, metadata: meta });
        this.eventBus.emit("tool.executed", { callId: "c1", toolName: "git_diff", durationMs: 15, result: "+ 12 lines" }, { source: "synthetic", sessionId: runId, metadata: meta });
        this.eventBus.emit("task.completed", { taskId: runId, durationMs: 60, result: "Diff verificado" }, { source: "synthetic", sessionId: runId, metadata: meta });
        break;

      case "hitl_approval_flow":
        this.eventBus.emit("approval.required", {
          approvalId: `appr_${runId}`,
          action: "terminal_exec",
          riskLevel: "destructive",
          details: { command: "rm -rf dist" },
        }, { source: "synthetic", sessionId: runId, metadata: meta });
        break;

      case "subego_delegation":
        this.eventBus.emit("subego.invoked", { subEgoId: "subego-reviewer", role: "Code Reviewer", input: "Revisar PR" }, { source: "synthetic", metadata: meta });
        this.eventBus.emit("subego.completed", { subEgoId: "subego-reviewer", outcome: "Aprobado sin observaciones" }, { source: "synthetic", metadata: meta });
        break;
    }
  }

  /**
   * Detiene de forma inmediata cualquier simulación y cancela timers pendientes.
   */
  public stop(): void {
    this.isRunning = false;
    this.activeEpochToken = "";
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
    for (const resolve of this.activeResolvers) {
      resolve();
    }
    this.activeResolvers.clear();
  }

  private isValidEpoch(epoch: string): boolean {
    return this.isRunning && this.activeEpochToken === epoch;
  }
}
