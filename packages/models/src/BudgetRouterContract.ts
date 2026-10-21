import type { ModelRouter } from "./ModelRouter.js";

/**
 * Espejo del contrato estructural `BudgetAwareRouterLike` del circuito de
 * presupuesto de Sub-Ego (`packages/subegos/src/SubEgoBudgetBreaker.ts`).
 *
 * ## Por qué un espejo y no un import
 *
 * `packages/models` es la capa **más baja** del runtime (no depende de nadie
 * del workspace). Importar `@ego/subegos` para copiar su contrato crearía una
 * arista de dependencia que no existe y que no debe existir. El espejo
 * permite una **comprobación en tiempo de compilación** sin esa arista.
 *
 * La comprobación **autoritativa** vive donde sí se dependen los dos
 * paquetes (el desktop, `apps/desktop/src/main/subegos/budget-guard.ts`):
 * `export type BudgetRouter = BudgetAwareRouterLike;` y el cast
 * `modelRouter as unknown as BudgetRouter` que A4 puede quitar cuando este
 * contrato esté compiles.
 *
 * ## Si el contrato cambia
 *
 * Hay que cambiar **este** espejo a la vez (o la comprobación falla al
 * compilar, que es exactamente lo que se quiere: que el desajuste se vea en
 * el `typecheck`, no en producción).
 */

/**
 * Contrato que el circuito de presupuesto necesita del router.
 *
 * Los dos métodos son **opcionales**: un router que no los expone deja al
 * circuito vigilando sólo los límites que no dependen del coste.
 */
export interface BudgetRouterContract {
  /** Tope global de coste por llamada (USD). `undefined` = sin tope. */
  getMaxCostPerCallUsd?(): number | undefined;
  /**
   * Modelo más barato que cumple el tope. `null` = no hay ninguno ⇒ el
   * circuito **detiene** con error tipado (fail-closed).
   */
  resolveCheaperModel?(options: {
    maxCostPerCallUsd: number;
    capabilities?: readonly string[];
  }): string | null | Promise<string | null>;
}

/**
 * El mismo contrato, pero con los métodos **OBLIGATORIOS**.
 *
 * Hace falta porque un tipo con métodos opcionales los satisface **aunque no
 * los tenga** (`{a?: X}` acepta `{}`): con la variante opcional, la
 * comprobación de abajo no detectaría una pérdida del método. Con la
 * variante obligatoria, sí.
 */
export interface BudgetRouterContractRequired {
  getMaxCostPerCallUsd(): number | undefined;
  resolveCheaperModel(options: {
    maxCostPerCallUsd: number;
    capabilities?: readonly string[];
  }): string | null | Promise<string | null>;
}

/** Falla al compilar si la condición no es `true`. */
type AssertTrue<T extends true> = T;

/**
 * `true` si `ModelRouter` satisface estructuralmente el contrato del circuito
 * de presupuesto.
 *
 * Si el router dejara de satisfacerlo (un método renombrado, una firma
 * incompatible), este tipo **deja de compilar**: es la señal más temprana
 * posible, y no depende de que alguien se acuerde de quitar un `as`.
 */
export type ModelRouterSatisfiesBudgetContract = AssertTrue<
  ModelRouter extends BudgetRouterContractRequired ? true : false
>;
