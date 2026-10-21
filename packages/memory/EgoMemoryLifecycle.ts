import type { EgoMemoryAdapter, EgoPut } from "./EgoMemoryAdapter.js";
import type { SearchHit } from "vantadb/types";
import { getQuarantineAware, listQuarantineAware } from "./QuarantineAwareReads.js";
import {
  resolveCompressionSettings,
  shouldTriggerCompression,
  type CompressionEvaluation,
  type CompressionSettings,
} from "./CompressionSettings.js";
import { DreamConsolidator, type DreamConsolidationStats } from "./DreamConsolidator.js";

/**
 * Estado determinista de recuperación de memoria previo al turno.
 *
 * **Implementación propia de Ego** (patrón asimilado de Hermes Agent ·
 * `RecallStatus`, fusionado con el RRF de VantaDB): el estado propio
 * (`count`/`glyph`/`sources`/`tokensEstimate`/`hits`) es de Ego. Sin
 * atribución de código derivado.
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
  userMessage?: string;
  assistantResponse?: string;
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
 * Micro-checkpoint leído con marca explícita de procedencia (FIX-01 SEC-09).
 */
export interface MicroCheckpointRead extends MicroCheckpoint {
  quarantined: boolean;
  quarantineReason?: string;
}

/**
 * Opciones del job curator (STAB-06): consolida `session/turns` stale a
 * `kb/facts`. Solo añade hechos; NUNCA borra (el cap `maxSnapshots` es
 * fail-closed: al límite se omiten consolidaciones nuevas).
 */
export interface CuratorConsolidationOptions {
  /** Antigüedad mínima de un turno para consolidar (default 30). */
  staleAfterDays?: number;
  /** Tope de facts `curator_*` vivos; al límite no se crea nada nuevo (default 50). */
  maxSnapshots?: number;
  /** Namespace origen (default `session/turns`). */
  sessionNamespace?: string;
  /** Namespace destino (default `kb/facts`). */
  targetNamespace?: string;
  /** Reloj inyectable para tests (default `Date.now()`). */
  nowMs?: number;
  /** Tope de filas barridas por corrida (default 1000). */
  limit?: number;
}

export interface CuratorConsolidationResult {
  scanned: number;
  staleSessions: number;
  consolidated: number;
  skippedQuarantined: number;
  skippedCapped: number;
  capped: boolean;
}

export interface CuratorJobHandle {
  stop: () => void;
}

export interface CuratorJobOptions extends CuratorConsolidationOptions {
  /** Periodo del job en ms (> 0). */
  intervalMs: number;
}

/**
 * Resultado de un ciclo de consolidación ("sueño").
 *
 * `consolidation` es `null` cuando el ciclo **no** se ejecutó (el sistema
 * estaba activo). Cuando se ejecutó, sus estadísticas son la **evidencia** de
 * que ocurrió: además quedan registradas en `gov/audit` con la acción
 * `dream_consolidation`.
 */
export interface DreamConsolidationOutcome {
  /** Refuerzos hebbianos aplicados en este ciclo. */
  reinforcedCount: number;
  /** Estadísticas de la consolidación de hechos (dedup + purga de cuarentena). */
  consolidation: DreamConsolidationStats | null;
  /** El ciclo se saltó porque el sistema NO estaba idle. */
  skippedNotIdle: boolean;
}

/** Opciones del ciclo de sueño del lifecycle. */
export interface DreamConsolidationOptions {
  /**
   * Retardo del temporizador de "sueño" tras el último turno (default 5 min).
   * Es el disparador real del ciclo: el sistema está **inactivo**.
   */
  idleDelayMs?: number;
  /**
   * Motor de consolidación (inyectable para tests). Por defecto se crea uno
   * sobre el mismo adapter.
   */
  consolidator?: DreamConsolidator;
}

/** Retardo por defecto del temporizador de sueño (5 minutos). */
const DEFAULT_DREAM_IDLE_DELAY_MS = 5 * 60 * 1000;
/**
 * Margen entre el retardo del temporizador y el umbral de inactividad que
 * decide consolidar. `setTimeout` puede disparar unos milisegundos antes y
 * la consolidación no debe perderse por un borde de reloj.
 */
const DREAM_IDLE_MARGIN_MS = 60 * 1000;

/**
 * Gestor del Ciclo de Vida de Memoria Unificado de Ego (CORE-12).
 * Fusión del ciclo por turnos conversacionales con el sustrato L0-L3 de VantaDB.
 */
export class EgoMemoryLifecycle {
  private adapter: EgoMemoryAdapter;
  private activeSessionId: string | null = null;
  private activeProjectScope = "default";
  private dreamTimer: NodeJS.Timeout | null = null;
  private curatorTimer: NodeJS.Timeout | null = null;
  private pendingReinforcements: Set<string> = new Set();
  /** Motor de consolidación ("sueño"): dedup de facts + purga de cuarentena. */
  private readonly dreamConsolidator: DreamConsolidator;
  /** Retardo del temporizador de sueño tras el último turno. */
  private readonly dreamIdleDelayMs: number;
  /** Instante del último turno persistido (`null` = aún no hay actividad). */
  private lastActivityAt: number | null = null;

  constructor(adapter: EgoMemoryAdapter, options: DreamConsolidationOptions = {}) {
    this.adapter = adapter;
    this.dreamIdleDelayMs = options.idleDelayMs ?? DEFAULT_DREAM_IDLE_DELAY_MS;
    this.dreamConsolidator =
      options.consolidator ??
      new DreamConsolidator(adapter, {
        // El umbral va un margen por debajo del retardo del temporizador.
        idleThresholdMs: Math.max(0, this.dreamIdleDelayMs - DREAM_IDLE_MARGIN_MS),
      });
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

    const cleanPrompt = prompt.replace(/[¿?¡!.,;:()]/g, " ").trim();
    // Workaround: VDB-REQ-03 (tokenizador BM25 sin filtro de puntuación
    // española; ver registro): sanitizar el prompt antes de searchMulti.

    const hits: SearchHit[] = await this.adapter.searchMulti(namespaces, cleanPrompt || prompt, {
      topK: 5,
      excludeSuperseded: true,
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
   * Lectura quarantine-aware de un micro-checkpoint (FIX-01 SEC-09).
   * `system/checkpoints` ya no difiere su enforcement: lo escrito tras el
   * retiro vive en `quarantine/pending` y esta es la vía canónica de
   * resolución (live primero, cuarentena después, con marca explícita).
   * Retorna `null` si no existe o el payload es ilegible.
   */
  async loadMicroCheckpoint(checkpointId: string): Promise<MicroCheckpointRead | null> {
    let hit: { payload?: unknown; quarantined?: boolean; quarantineReason?: string } | null;
    try {
      hit = await getQuarantineAware(this.adapter, "system/checkpoints", checkpointId);
    } catch {
      return null;
    }
    if (!hit) return null;
    const quarantined = hit.quarantined === true;
    const quarantineReason = quarantined ? hit.quarantineReason : undefined;
    const payload = hit.payload;
    if (!payload || typeof payload !== "object") return null;
    const p = payload as Record<string, unknown>;
    if (
      typeof p["checkpointId"] !== "string" ||
      typeof p["taskId"] !== "string" ||
      typeof p["timestamp"] !== "number"
    ) {
      return null;
    }
    return {
      checkpointId: p["checkpointId"] as string,
      taskId: p["taskId"] as string,
      timestamp: p["timestamp"] as number,
      stateSnapshot: p["snapshot"],
      quarantined,
      ...(quarantineReason ? { quarantineReason } : {}),
    };
  }

  /**
   * FASE 4: Post-Turn Synchronization (`sync_turn`)
   * Al culminar el streaming, persiste el turno de forma inmutable en VantaDB
   * (fast path BM25 puro, VDB-INC-01: sin auto-embed ONNX en napi-rs).
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
      userMessage: userPrompt,
      assistantResponse: assistantReply,
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

    // Actividad reciente: el sistema NO está idle ⇒ la consolidación de
    // hechos espera a que el temporizador de sueño se dispare.
    this.lastActivityAt = Date.now();

    // Reiniciar temporizador de Dream Consolidation en inactividad (5 minutos)
    this.scheduleDreamConsolidation();
  }

  /**
   * Helper estructurado para persistencia de turnos de conversación indexados
   */
  async syncTurnToDisk(data: {
    sessionId: string;
    turnIndex: number;
    userMessage: string;
    assistantResponse: string;
    recalledKeys?: string[];
  }): Promise<void> {
    await this.syncTurn(
      data.sessionId,
      `turn:${data.turnIndex}`,
      data.userMessage,
      data.assistantResponse,
      data.recalledKeys || []
    );
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
   * STAB-05: pre-compactación condicional (trigger del turno).
   * Evalúa `shouldTriggerCompression` y, solo si dispara, archiva vía
   * `handlePreCompaction` (siempre ANTES de truncar/resumir — el caller
   * compacta después con `isCompressionRebuild: true`). Nunca lanza por
   * settings parciales: resuelve contra defaults Gate P.
   */
  async maybePreCompact(
    sessionId: string,
    turns: TurnRecord[],
    estimatedTokens: number,
    windowTokens: number,
    settings?: Partial<CompressionSettings>
  ): Promise<CompressionEvaluation & { triggered: boolean; archiveKey: string | null }> {
    const resolved = resolveCompressionSettings(settings);
    const evaluation = shouldTriggerCompression(estimatedTokens, windowTokens, resolved);
    if (!evaluation.shouldCompact) {
      return { ...evaluation, triggered: false, archiveKey: null };
    }
    const archiveKey = await this.handlePreCompaction(sessionId, turns);
    return { ...evaluation, triggered: true, archiveKey };
  }

  /**
   * FASE 6: Idle Dream Consolidation (Consolidación en Reposo)
   *
   * 1. **Refuerzo hebiano**: las llaves recuperadas se marcan para refuerzo.
   * 2. **Consolidación de hechos** (`DreamConsolidator.runCycle`): dedup por
   *    firma normalizada en `kb/facts` (la versión vigente es la de mayor
   *    timestamp; el resto queda `superseded` con su procedencia) y purga de
   *    la cuarentena expirada. Es una pasada **determinista y LLM-free**.
   *
   * ## El disparador es la INACTIVIDAD
   *
   * `syncTurn` programa este ciclo para dentro de `dreamIdleDelayMs` (5 min
   * por defecto) y reinicia el temporizador en cada turno ⇒ el ciclo corre
   * cuando el sistema lleva un rato sin actividad. Si se invoca a mano
   * mientras hay actividad reciente, el ciclo **se salta** (`skippedNotIdle`).
   *
   * ## Evidencia
   *
   * Cada ejecución deja un registro inmutable en `gov/audit` con la acción
   * `dream_consolidation` y las estadísticas del ciclo: se puede **demostrar**
   * que la consolidación ocurrió, no sólo que el código está instanciado.
   */
  async runDreamConsolidation(now = Date.now()): Promise<DreamConsolidationOutcome> {
    const keysToReinforce = Array.from(this.pendingReinforcements);
    this.pendingReinforcements.clear();

    if (keysToReinforce.length > 0) {
      // Refuerzo Hebbiano: Registrar incremento de ponderación en gov/audit
      await this.adapter.recordAudit("dream_consolidation_reinforce", "ego.memory_lifecycle", {
        reinforcedKeys: keysToReinforce,
        count: keysToReinforce.length,
        timestamp: Date.now(),
      });
    }

    // Consolidación de hechos: sólo con el sistema inactivo.
    const idle =
      this.lastActivityAt === null ||
      this.dreamConsolidator.isSystemIdle(this.lastActivityAt, now);
    if (!idle) {
      return {
        reinforcedCount: keysToReinforce.length,
        consolidation: null,
        skippedNotIdle: true,
      };
    }

    const consolidation = await this.dreamConsolidator.runCycle(now);

    // Evidencia: el registro inmutable de la consolidación.
    await this.adapter.recordAudit("dream_consolidation", "ego.memory_lifecycle", {
      ...consolidation,
      timestamp: now,
    });

    return {
      reinforcedCount: keysToReinforce.length,
      consolidation,
      skippedNotIdle: false,
    };
  }

  /**
   * Job curator (STAB-06): consolida turnos stale (`session/turns`) en hechos
   * resumidos (`kb/facts/curator_<sessionId>`), un fact por sesión (upsert
   * idempotente por `turnCount`). Respeta `quarantine/pending` (las filas
   * cuarentenadas se omiten, nunca se promueven). Aditivo: jamás borra —
   * al alcanzar `maxSnapshots` se omiten consolidaciones nuevas (`capped`).
   */
  async runCuratorConsolidation(
    options: CuratorConsolidationOptions = {}
  ): Promise<CuratorConsolidationResult> {
    const {
      staleAfterDays = 30,
      maxSnapshots = 50,
      sessionNamespace = "session/turns",
      targetNamespace = "kb/facts",
      nowMs = Date.now(),
      limit = 1000,
    } = options;
    const cutoff = nowMs - Math.max(0, staleAfterDays) * 86_400_000;
    const result: CuratorConsolidationResult = {
      scanned: 0,
      staleSessions: 0,
      consolidated: 0,
      skippedQuarantined: 0,
      skippedCapped: 0,
      capped: false,
    };

    const rows = await listQuarantineAware(this.adapter, sessionNamespace, limit);
    result.scanned = rows.length;

    const bySession = new Map<string, { turnIds: string[]; oldestTs: number; newestTs: number }>();
    for (const row of rows) {
      if (row.quarantined) {
        result.skippedQuarantined++;
        continue;
      }
      const payload = row.payload;
      if (!payload || typeof payload !== "object") continue;
      const p = payload as Record<string, unknown>;
      const sessionId = typeof p["sessionId"] === "string" ? (p["sessionId"] as string) : undefined;
      const timestamp = typeof p["timestamp"] === "number" ? (p["timestamp"] as number) : undefined;
      const rawTurn = typeof p["turnId"] === "string" ? (p["turnId"] as string) : row.key;
      if (!sessionId || timestamp === undefined) continue;
      if (timestamp >= cutoff) continue;
      const group = bySession.get(sessionId) ?? { turnIds: [], oldestTs: timestamp, newestTs: timestamp };
      group.turnIds.push(rawTurn);
      if (timestamp < group.oldestTs) group.oldestTs = timestamp;
      if (timestamp > group.newestTs) group.newestTs = timestamp;
      bySession.set(sessionId, group);
    }
    result.staleSessions = bySession.size;
    if (bySession.size === 0) {
      await this.adapter.recordAudit("curator_consolidation", "ego.memory_lifecycle", {
        ...result,
        timestamp: nowMs,
      });
      return result;
    }

    const existing = await listQuarantineAware(this.adapter, targetNamespace, Math.max(limit, 100));
    const liveCuratorKeys = new Set(
      existing.filter((r) => !r.quarantined && r.key.startsWith("curator_")).map((r) => r.key)
    );
    result.capped = liveCuratorKeys.size >= Math.max(0, maxSnapshots);

    for (const [sessionId, group] of bySession) {
      const key = `curator_${sessionId}`;
      const turnCount = group.turnIds.length;
      const current = await getQuarantineAware(this.adapter, targetNamespace, key);
      if (current && !current.quarantined) {
        const cp = current.payload;
        if (cp && typeof cp === "object" && (cp as Record<string, unknown>)["turnCount"] === turnCount) {
          continue; // Idempotente: ya consolidado con el mismo contenido
        }
      }
      if (result.capped) {
        result.skippedCapped++;
        continue;
      }
      const putItem: EgoPut = {
        namespace: targetNamespace,
        key,
        payload: {
          sessionId,
          turnCount,
          turnIds: group.turnIds,
          oldestTs: group.oldestTs,
          newestTs: group.newestTs,
          consolidatedAtMs: nowMs,
          staleAfterDays,
        },
        metadata: {
          type: "curator_consolidation",
          source: "ego.memory_lifecycle",
          sessionId,
          turnCount,
        },
      };
      await this.adapter.put(putItem);
      liveCuratorKeys.add(key);
      result.consolidated++;
      if (liveCuratorKeys.size >= Math.max(0, maxSnapshots)) {
        result.capped = true;
      }
    }

    await this.adapter.recordAudit("curator_consolidation", "ego.memory_lifecycle", {
      ...result,
      timestamp: nowMs,
    });
    return result;
  }

  /**
   * Arranca el job periódico del curator. Reemplaza un job previo si existe.
   * El timer no retiene el proceso (`unref` cuando está disponible).
   */
  startCuratorJob(options: CuratorJobOptions): CuratorJobHandle {
    const { intervalMs, ...rest } = options;
    if (typeof intervalMs !== "number" || intervalMs <= 0) {
      throw new Error("[EgoMemoryLifecycle] intervalMs debe ser un número positivo mayor a 0.");
    }
    this.stopCuratorJob();
    const timer = setInterval(() => {
      void this.runCuratorConsolidation(rest).catch((err: unknown) => {
        console.warn("[EgoMemoryLifecycle] curator job falló:", err);
      });
    }, intervalMs);
    const t = timer as unknown as { unref?: () => void };
    if (typeof t.unref === "function") {
      t.unref();
    }
    this.curatorTimer = timer;
    return {
      stop: () => this.stopCuratorJob(),
    };
  }

  /**
   * Detiene el job periódico del curator (idempotente).
   */
  stopCuratorJob(): void {
    if (this.curatorTimer) {
      clearInterval(this.curatorTimer);
      this.curatorTimer = null;
    }
  }

  private scheduleDreamConsolidation(): void {
    if (this.dreamTimer) {
      clearTimeout(this.dreamTimer);
    }
    // Ejecutar tras el retardo de inactividad (5 minutos por defecto)
    this.dreamTimer = setTimeout(() => {
      void this.runDreamConsolidation().catch((err: unknown) => {
        console.warn("[EgoMemoryLifecycle] dream consolidation falló:", err);
      });
    }, this.dreamIdleDelayMs);
    // El temporizador no debe retener el proceso (Electron debe poder salir).
    const t = this.dreamTimer as unknown as { unref?: () => void };
    if (typeof t.unref === "function") {
      t.unref();
    }
  }
}
