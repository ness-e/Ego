import type { EgoMemoryAdapter, EgoPut } from "./EgoMemoryAdapter.js";
import type { SearchHit } from "vantadb/types";

/**
 * Estado determinista de recuperación de memoria previo al turno.
 * Inspirado en RecallStatus de Hermes Agent fusionado con VantaDB RRF.
 */
export interface EgoRecallStatus {
  count: number;          // Cantidad de fragmentos inyectados
  glyph: string;          // Glifo visual ("🧠" o personalizado por Sub-Ego)
  sources: string[];      // Namespaces origen de los datos
  tokensEstimate: number; // Estimación de costo en tokens del contexto inyectado
  hits: Array<{ key: string; namespace: string; score: number }>;
}

export interface TurnContext {
  sessionId: string;
  turnId: string;
  userPrompt: string;
  projectScope: string;
  targetNamespaces?: string[];
}

export interface TurnRecord {
  sessionId: string;
  turnId: string;
  timestamp: number;
  userPrompt: string;
  assistantReply: string;
  recalledKeys: string[];
  toolInvocations?: Array<{ toolId: string; inputDigest: string; success: boolean }>;
}

export interface MicroCheckpoint {
  checkpointId: string;
  taskId: string;
  timestamp: number;
  stateSnapshot: unknown;
}

/**
 * Gestor del Ciclo de Vida de Memoria Unificado de Ego (CORE-12).
 * Fusión del ciclo por turnos conversacionales con el sustrato L0-L3 de VantaDB.
 */
export class EgoMemoryLifecycle {
  private adapter: EgoMemoryAdapter;
  private activeSessionId: string | null = null;
  private activeProjectScope = "default";
  private dreamTimer: NodeJS.Timeout | null = null;
  private pendingReinforcements: Set<string> = new Set();

  constructor(adapter: EgoMemoryAdapter) {
    this.adapter = adapter;
  }

  public get currentSessionId(): string | null {
    return this.activeSessionId;
  }

  public get currentProjectScope(): string {
    return this.activeProjectScope;
  }

  /**
   * FASE 1: Session Admission & Warmup
   * Inicializa la sesión, verifica VantaDB y carga el contexto del proyecto activo.
   */
  async startSession(sessionId: string, projectScope: string = "default"): Promise<void> {
    if (!this.adapter.ready) {
      await this.adapter.init();
    }
    this.activeSessionId = sessionId;
    this.activeProjectScope = projectScope;

    // Registrar inicio de sesión en gov/audit
    await this.adapter.recordAudit("session_start", "ego.nucleus", {
      sessionId,
      projectScope,
      timestamp: Date.now(),
    });
  }

  /**
   * FASE 2: Pre-Turn Context Assembly & Recall (Prefetch + Glifo 🧠)
   * Realiza búsqueda federada multi-namespace con RRF sobre VantaDB antes de enviar el prompt al LLM.
   */
  async assemblePreTurn(
    prompt: string,
    customNamespaces?: string[]
  ): Promise<{ contextText: string; recallStatus: EgoRecallStatus }> {
    const namespaces = customNamespaces || [
      "kb/docs",
      "kb/facts",
      `projects/${this.activeProjectScope}/*`,
      "session/turns",
    ];

    const hits: SearchHit[] = await this.adapter.searchMulti(namespaces, prompt, {
      topK: 5,
      excludeSuperseded: true,
      minConfidence: 0.65,
    });

    const sourcesSet = new Set<string>();
    const formattedChunks: string[] = [];
    const hitSummary: EgoRecallStatus["hits"] = [];
    let estimatedTokens = 0;

    for (const hit of hits) {
      if (!hit.record) continue;
      const rec = hit.record;
      sourcesSet.add(rec.namespace);
      hitSummary.push({
        key: rec.key,
        namespace: rec.namespace,
        score: hit.score ?? 0,
      });

      // Acumular llaves para auto-refuerzo Hebbiano posterior
      this.pendingReinforcements.add(`${rec.namespace}:${rec.key}`);

      const chunkText = `[Fuente: ${rec.namespace}/${rec.key} (Score: ${(hit.score ?? 0).toFixed(2)})]\n${rec.payload}`;
      formattedChunks.push(chunkText);
      estimatedTokens += Math.ceil(chunkText.length / 4);
    }

    const contextText = formattedChunks.length > 0
      ? `\n--- RECUERDOS RELEVANTES DE VENTANA (VantaDB) ---\n${formattedChunks.join("\n\n")}\n-----------------------------------------------\n`
      : "";

    const recallStatus: EgoRecallStatus = {
      count: hits.length,
      glyph: "🧠",
      sources: Array.from(sourcesSet),
      tokensEstimate: estimatedTokens,
      hits: hitSummary,
    };

    return { contextText, recallStatus };
  }

  /**
   * FASE 3: Active Turn & Micro-Checkpoints
   * Genera un punto de restauración atómico antes de que una herramienta ejecute una mutación en disco.
   */
  async createMicroCheckpoint(taskId: string, snapshot: unknown): Promise<string> {
    const checkpointId = `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const putItem: EgoPut = {
      namespace: "system/checkpoints",
      key: checkpointId,
      payload: {
        checkpointId,
        taskId,
        timestamp: Date.now(),
        snapshot,
      },
      metadata: {
        type: "micro_checkpoint",
        state: "active",
      },
    };

    await this.adapter.put(putItem);
    return checkpointId;
  }

  /**
   * FASE 4: Post-Turn Synchronization (`sync_turn`)
   * Al culminar el streaming, persiste el turno de forma inmutable en VantaDB con auto-embed ONNX en Rust.
   */
  async syncTurn(
    sessionId: string,
    turnId: string,
    userPrompt: string,
    assistantReply: string,
    recalledKeys: string[] = []
  ): Promise<void> {
    const record: TurnRecord = {
      sessionId,
      turnId,
      timestamp: Date.now(),
      userPrompt,
      assistantReply,
      recalledKeys,
    };

    const putItem: EgoPut = {
      namespace: "session/turns",
      key: `${sessionId}:${turnId}`,
      payload: record,
      metadata: {
        sessionId,
        turnId,
        projectScope: this.activeProjectScope,
        timestamp: Date.now(),
      },
    };

    await this.adapter.put(putItem);

    // Reiniciar temporizador de Dream Consolidation en inactividad (5 minutos)
    this.scheduleDreamConsolidation();
  }

  /**
   * FASE 5: Pre-Compaction Checkpoint
   * Si el chat se acerca al límite de tokens, resguarda el historial completo antes de truncar o resumir.
   */
  async handlePreCompaction(sessionId: string, turns: TurnRecord[]): Promise<string> {
    const archiveKey = `archive_${sessionId}_${Date.now()}`;
    await this.adapter.put({
      namespace: "kb/history_archive",
      key: archiveKey,
      payload: {
        sessionId,
        timestamp: Date.now(),
        turnCount: turns.length,
        history: turns,
      },
      metadata: {
        type: "pre_compaction_archive",
        source: "hermes_pre_compress_pattern",
      },
    });

    return archiveKey;
  }

  /**
   * FASE 6: Idle Dream Consolidation (Consolidación en Reposo)
   * Refuerza las llaves mnemónicas utilizadas y sintetiza hechos en segundo plano.
   */
  async runDreamConsolidation(): Promise<{ reinforcedCount: number }> {
    const keysToReinforce = Array.from(this.pendingReinforcements);
    this.pendingReinforcements.clear();

    if (keysToReinforce.length === 0) {
      return { reinforcedCount: 0 };
    }

    // Refuerzo Hebbiano: Registrar incremento de ponderación en gov/audit
    await this.adapter.recordAudit("dream_consolidation_reinforce", "ego.memory_lifecycle", {
      reinforcedKeys: keysToReinforce,
      count: keysToReinforce.length,
      timestamp: Date.now(),
    });

    return { reinforcedCount: keysToReinforce.length };
  }

  private scheduleDreamConsolidation(): void {
    if (this.dreamTimer) {
      clearTimeout(this.dreamTimer);
    }
    // Ejecutar tras 5 minutos de inactividad
    this.dreamTimer = setTimeout(() => {
      void this.runDreamConsolidation();
    }, 5 * 60 * 1000);
  }
}
