/**
 * E6 (Ola 2) — Accessors del runtime del proceso main.
 *
 * Extraído del god-file `main.ts`: estos getters son la capa de lectura del
 * estado mutable que vive en `app-context.ts` (bindings vivos). Viven junto
 * al estado, no en el compositor, para que `main.ts` quede como
 * **compositor** (arranque + apagado) y no como un almacén de singletons.
 *
 * `main.ts` los re-exporta: la API pública de `main.js` no cambia.
 */
import {
  crashRecoveryEngine,
  opGate,
  lifecycle,
  modelRouter,  approvalEngine,
  executionManager,
  toolRegistry,
  toolLoop,
  subEgoRegistry,
  decisionRouter,
  decisionAuditor,
  decisionTelemetry,
  loopBreaker,
  eventBus,
  knowledgeIndexer,
  hybridSearch,
  graphRagEngine,
  quarantineManager,
  factLifecycle,
  bitemporalQueries,
  projectMemoryGraph,
  backgroundEngine,
  workerTaskPool,
  proactivityEngine,
  taskCheckpointManager,
} from "./app-context.js";
// `activeProjectId` vive en el estado compartido con los handlers IPC.
import { activeProjectId } from "../ipc/ipc-state.js";
import type { KnowledgeIndexer, HybridSearch, GraphRagEngine, QuarantineManager, FactLifecycle, BitemporalQueries, ProjectMemoryGraph } from "@ego/knowledge";
import type { SubEgoRegistry } from "@ego/subegos";
import type { EventBus } from "@ego/events";
import type { ModelRouter } from "@ego/models";
import type { ToolRegistry } from "@ego/tools";
import type { ToolExecutionLoop } from "@ego/runtime";
import type { ApprovalEngine, ExecutionManager } from "@ego/execution";
import type { EgoMemoryLifecycle } from "@ego/memory";
import type { DecisionRouter, DecisionAuditor, DecisionTelemetry, LoopBreaker } from "@ego/decision";
import type { OpGate, CrashRecoveryEngine } from "@ego/recovery";
import type { BackgroundEngine, WorkerTaskPool, ProactivityEngine, TaskCheckpointManager } from "@ego/tasks";

export function getKnowledgeIndexer(): KnowledgeIndexer {
  return knowledgeIndexer;
}

export function getHybridSearch(): HybridSearch {
  return hybridSearch;
}

export function getGraphRagEngine(): GraphRagEngine {
  return graphRagEngine;
}

export function getQuarantineManager(): QuarantineManager {
  return quarantineManager;
}

export function getFactLifecycle(): FactLifecycle {
  return factLifecycle;
}

export function getBitemporalQueries(): BitemporalQueries {
  return bitemporalQueries;
}

export function getProjectMemoryGraph(): ProjectMemoryGraph {
  return projectMemoryGraph;
}

export function getSubEgoRegistry(): SubEgoRegistry {
  return subEgoRegistry;
}

export function getEventBus(): EventBus {
  return eventBus;
}

export function getModelRouter(): ModelRouter {
  return modelRouter;
}

export function getToolRegistry(): ToolRegistry {
  return toolRegistry;
}

export function getToolLoop(): ToolExecutionLoop {
  return toolLoop;
}

export function getApprovalEngine(): ApprovalEngine {
  return approvalEngine;
}

export function getExecutionManager(): ExecutionManager {
  return executionManager;
}

export function getLifecycle(): EgoMemoryLifecycle {
  return lifecycle;
}

export function getActiveProjectId(): string {
  return activeProjectId;
}

export function getDecisionRouter(): DecisionRouter {
  return decisionRouter;
}

export function getDecisionAuditor(): DecisionAuditor {
  return decisionAuditor;
}

export function getDecisionTelemetry(): DecisionTelemetry {
  return decisionTelemetry;
}

export function getLoopBreaker(): LoopBreaker {
  return loopBreaker;
}

export function getOpGate(): OpGate {
  return opGate;
}

export function getCrashRecoveryEngine(): CrashRecoveryEngine {
  return crashRecoveryEngine;
}

export function getBackgroundEngine(): BackgroundEngine {
  return backgroundEngine;
}

export function getWorkerTaskPool(): WorkerTaskPool {
  return workerTaskPool;
}

export function getProactivityEngine(): ProactivityEngine {
  return proactivityEngine;
}

export function getTaskCheckpointManager(): TaskCheckpointManager {
  return taskCheckpointManager;
}
