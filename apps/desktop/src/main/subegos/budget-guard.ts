/**
 * E5 (Ola 5 · T1) — Circuito de presupuesto de Sub-Ego en el producto.
 *
 * ## Qué resuelve
 * `packages/subegos` trae el `SubEgoBudgetCircuitBreaker` (4 límites
 * medibles: tokens por llamada, gasto diario, coste por llamada y duración
 * del turno) y el `BudgetAwareRouterLike` (un contrato **estructural**:
 * `getMaxCostPerCallUsd?()` y `resolveCheaperModel?()`). El breaker estaba
 * `VERIFIED` en el paquete pero **inalcanzable** desde la app: nadie lo
 * creaba ni lo consultaba por turno (`EGO-FIND-89`).
 *
 * ## El contrato con el router, sin dependencia dura
 * `packages/models` es zona de A2. Este módulo **no lo importa**: usa el
 * contrato estructural `BudgetAwareRouterLike` de `@ego/subegos`. Los dos
 * métodos del router son **opcionales**:
 *
 * - si el router no los expone todavía → el breaker vigila los límites que
 *   no dependen del coste (tokens por llamada y duración del turno);
 * - cuando A2 exponga `getMaxCostPerCallUsd()` / `resolveCheaperModel()`
 *   → el tope efectivo pasa a ser el MÍNIMO (propio del Sub-Ego ∨ global)
 *   y la degradación a un modelo más barato pasa a estar disponible.
 *
 * Ningún cambio en este módulo depende de A2: hoy degrupa con los límites
 * propios, y mañana añade el tope global sin tocar el call-site.
 */
import {
  SubEgoBudgetCircuitBreaker,
  type BudgetAwareRouterLike,
  type SubEgoBudgetDecision,
  type SubEgoBudgetCircuitBreakerError,
  type SubEgoManifest,
} from "@ego/subegos";

import type { ModelConfig } from "../../ipc/schema.js";

/**
 * El router que el breaker puede consultar.
 *
 * Es el contrato **estructural** `BudgetAwareRouterLike` de `@ego/subegos`
 * (los dos métodos son opcionales). El `ModelRouter` real lo satisface
 * desde A2-bis (`getMaxCostPerCallUsd` / `resolveCheaperModel`), así que en
 * el producto **no hace falta ningún cast**.
 */
export type BudgetRouter = BudgetAwareRouterLike;

/** Breakers vivos, por Sub-Ego. */
const breakers = new Map<string, SubEgoBudgetCircuitBreaker>();

/** Registra (o sustituye) el breaker de un Sub-Ego. */
export function setBudgetBreaker(
  subEgoId: string,
  breaker: SubEgoBudgetCircuitBreaker
): void {
  breakers.set(subEgoId, breaker);
}

/** Devuelve el breaker de un Sub-Ego (si lo hay). */
export function getBudgetBreaker(
  subEgoId: string
): SubEgoBudgetCircuitBreaker | undefined {
  return breakers.get(subEgoId);
}

/** Vacía el registro (tests / reset de sesión). */
export function clearBudgetBreakers(): void {
  breakers.clear();
}

/**
 * Crea el breaker de un Sub-Ego a partir de su manifiesto.
 *
 * El presupuesto vive en el manifiesto (`budget`), así que el breaker se
 * deriva de él: un Sub-Ego sin presupuesto explícito recibe los valores
 * por defecto del esquema.
 */
export function createBudgetBreaker(
  manifest: SubEgoManifest,
  router?: BudgetRouter
): SubEgoBudgetCircuitBreaker {
  return new SubEgoBudgetCircuitBreaker({
    subEgoId: manifest.id,
    budget: manifest.budget,
    ...(router ? { router } : {}),
  });
}

/**
 * Devuelve el breaker del Sub-Ego, creándolo si hace falta.
 *
 * El breaker se cachea por Sub-Ego: sus contadores (turnos, tokens,
 * degradaciones) son **acumulados** y deben sobrevivir entre turnos.
 */
export function ensureBudgetBreaker(
  manifest: SubEgoManifest,
  router?: BudgetRouter
): SubEgoBudgetCircuitBreaker {
  const existing = breakers.get(manifest.id);
  if (existing) return existing;
  const created = createBudgetBreaker(manifest, router);
  breakers.set(manifest.id, created);
  return created;
}

/** Petición de evaluación del presupuesto de un turno. */
export interface TurnBudgetRequest {
  /** Sub-Ego del turno. */
  subEgoId: string;
  /** Manifiesto del Sub-Ego (si el registry no lo tiene: no hay breaker). */
  manifest?: SubEgoManifest | null;
  /** Router (contrato estructural). */
  router?: BudgetRouter;
  /** Estimación previa del turno. */
  estimate?: { tokens?: number; costUsd?: number };
  /**
   * Resuelve el **id** de un modelo a su configuración de turno.
   *
   * Puede ser asíncrono: la fuente canónica de "id → descriptor" del router
   * (`resolveModelDescriptor`) consulta la disponibilidad de los providers.
   *
   * Si el circuito decide degradar y esta función no sabe resolver el id,
   * el turno **se detiene**: seguir con el modelo caro violaría el tope
   * que el circuito quiso aplicar (fail-closed).
   */
  resolveModelConfig?: (
    modelId: string
  ) => ModelConfig | undefined | Promise<ModelConfig | undefined>;
}

/** Resultado de evaluar el presupuesto de un turno. */
export interface TurnBudgetOutcome {
  /** Decisión del circuito. */
  decision: SubEgoBudgetDecision;
  /**
   * Modelo con el que debe ejecutarse el turno.
   *
   * - `undefined` → se usa el modelo actual.
   * - Un id → el turno debe degradar a ese modelo.
   */
  modelId?: string;
  /** Configuración del modelo degradado (si se pudo resolver). */
  modelConfig?: ModelConfig;
  /** `true` si el turno debe DETENERSE. */
  stop: boolean;
  /** Error tipado del corte (el turno debe fallar con ÉL, no con un string). */
  error?: SubEgoBudgetCircuitBreakerError;
  /** Motivo legible del corte. */
  reason?: string;
}

/**
 * Evalúa el presupuesto ANTES del turno.
 *
 * Sin manifiesto (Sub-Ego desconocido) → el circuito no aplica: se deja
 * pasar el turno (fail-open de IDENTIDAD, nunca de GOBERNANZA: el Sub-Ego
 * no ha declarado ningún presupuesto).
 */
export async function evaluateTurnBudget(
  request: TurnBudgetRequest
): Promise<TurnBudgetOutcome> {
  const { manifest } = request;
  if (!manifest) {
    return {
      decision: { outcome: "allow" },
      stop: false,
      reason: "sin manifiesto: no hay presupuesto declarado",
    };
  }

  const breaker = ensureBudgetBreaker(manifest, request.router);
  const decision = await breaker.checkBeforeTurn(request.estimate ?? {});

  if (decision.outcome === "allow") {
    return { decision, stop: false };
  }

  if (decision.outcome === "stop") {
    return {
      decision,
      stop: true,
      error: decision.error,
      reason: decision.error.message,
    };
  }

  // outcome === "degrade": el circuito quiere un modelo más barato.
  const modelId = decision.model;
  const modelConfig = await request.resolveModelConfig?.(modelId);
  if (!modelConfig) {
    // No sabemos construir la configuración del modelo barato → NO seguimos
    // con el caro (violaría el tope). Se detiene con un motivo explícito.
    return {
      decision,
      stop: true,
      reason:
        `El circuito de presupuesto pidió degradar a '${modelId}', pero el turno ` +
        `no sabe resolver su configuración: se detiene para no violar el tope ` +
        `de coste ($${(decision.effectiveCostCapUsd ?? 0).toFixed(6)}).`,
    };
  }
  return { decision, stop: false, modelId, modelConfig, reason: decision.reason };
}

/**
 * Registra el consumo REAL del turno y reevalúa el circuito.
 *
 * El coste en USD lo conoce el router (A2); el desktop no lo calcula, así
 * que se registra 0 y la contabilidad de coste queda en el router/tracker.
 * Los límites de tokens y duración sí son efectivos.
 */
export async function recordTurnBudget(
  request: TurnBudgetRequest & {
    usage: { tokens: number; costUsd?: number; durationMs: number; model?: string };
  }
): Promise<SubEgoBudgetDecision | null> {
  const { manifest } = request;
  if (!manifest) return null;
  const breaker = ensureBudgetBreaker(manifest, request.router);
  return breaker.recordAfterTurn({
    tokens: request.usage.tokens,
    costUsd: request.usage.costUsd ?? 0,
    durationMs: request.usage.durationMs,
    ...(request.usage.model !== undefined ? { model: request.usage.model } : {}),
  });
}

/**
 * Estimación de tokens de un prompt con la heurística `chars/3`.
 *
 * Es la misma que usa el motor nativo (`TokenEstimator::default`), y es
 * la que permite que el límite de tokens por llamada sea **efectivo** sin
 * depender del router.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}
