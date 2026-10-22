import {
  subEgoToolsView,
  type ToolDefinition,
  type ToolRegistry,
  type ToolRegistryView,
} from "@ego/tools";

/**
 * Aislamiento de tools por Sub-Ego en el **runtime** (Ola 9).
 *
 * El registro global sigue siendo la **única fuente de verdad** (A4: vista
 * proyectada, sin clones). Esta capa aplica la vista en los **dos** puntos
 * del bucle que aún miraban el global:
 *
 * 1. **La superficie del modelo**: las tools que se le pasan al LLM.
 * 2. **La resolución de la ejecución**: `registry.get(name)` al despachar.
 *
 * ## La regla
 *
 * - tool **con** dueño (`ownerSubEgoId`) → **sólo** su dueño la ve;
 * - tool **sin** dueño → **GLOBAL**: la ven todas las vistas (y el usuario).
 *
 * ## Fail-closed
 *
 * Pedir una tool que existe pero **no es tuya** es un **error tipado**
 * (`ToolNotVisibleToSubEgoError`), distinto de "no existe". No se ejecuta
 * contra el global, y **no** se filtra el catálogo global en el mensaje de
 * error (el Sub-Ego ve sólo lo que puede usar).
 *
 * ## El camino sin Sub-Ego
 *
 * El turno del **usuario** (la app, la introspección, el servidor MCP) **no**
 * tiene `subEgoId` ⇒ ve el **global**. Es deliberado: es la vista del
 * usuario, no la de un Sub-Ego.
 */

/**
 * Error tipado: la tool existe pero **no** pertenece al Sub-Ego que la pide.
 *
 * Distinguido de "no existe" a propósito: el modelo debe entender que la
 * herramienta existe pero no le corresponde (y no pedirla otra vez), en vez de
 *ceive un "no encontrada" genérico que le haría buscar otro nombre.
 */
export class ToolNotVisibleToSubEgoError extends Error {
  /** La tool que se pidió. */
  readonly toolName: string;
  /** El Sub-Ego que la pidió. */
  readonly subEgoId: string;
  /** El Sub-Ego dueño de la tool. */
  readonly ownerSubEgoId: string;

  constructor(toolName: string, subEgoId: string, ownerSubEgoId: string) {
    super(
      `La herramienta "${toolName}" pertenece al Sub-Ego "${ownerSubEgoId}" y no ` +
        `está disponible para "${subEgoId}". No la invoques.`
    );
    this.name = "ToolNotVisibleToSubEgoError";
    this.toolName = toolName;
    this.subEgoId = subEgoId;
    this.ownerSubEgoId = ownerSubEgoId;
  }
}

/**
 * Vista del registro para un Sub-Ego.
 *
 * `null` cuando el turno **no** es de un Sub-Ego (usuario/app): en ese caso
 * se usa el registro global (la vista del usuario).
 */
export function toolViewFor(
  registry: ToolRegistry,
  subEgoId?: string
): ToolRegistryView | null {
  if (!subEgoId) return null;
  return subEgoToolsView(registry, subEgoId);
}

/** Resultado de resolver una tool contra la vista del Sub-Ego. */
export interface VisibleToolResolution {
  /** La tool resuelta (si es visible). */
  tool?: ToolDefinition;
  /** `true` si la tool no existe en el registro global. */
  notFound: boolean;
  /** Error tipado: existe pero no es de este Sub-Ego. */
  notVisible?: ToolNotVisibleToSubEgoError;
}

/**
 * Resuelve una tool **contra la vista** del Sub-Ego (fail-closed).
 *
 * - Sin Sub-Ego → el registro global (turno del usuario).
 * - Tool visible → su descriptor.
 * - Tool de otro Sub-Ego → `notVisible` (error tipado), **nunca** el global.
 * - Tool inexistente → `notFound`.
 */
export function resolveVisibleTool(
  registry: ToolRegistry,
  toolName: string,
  subEgoId?: string
): VisibleToolResolution {
  const view = toolViewFor(registry, subEgoId);
  if (!view || subEgoId === undefined) {
    const tool = registry.get(toolName);
    return { tool, notFound: tool === undefined };
  }
  const tool = view.get(toolName);
  if (tool) return { tool, notFound: false };
  // No está en la vista: ¿existe en el global y es de otro?
  const globalTool = registry.get(toolName);
  if (globalTool?.ownerSubEgoId !== undefined && globalTool.ownerSubEgoId !== subEgoId) {
    return {
      notFound: false,
      notVisible: new ToolNotVisibleToSubEgoError(toolName, subEgoId, globalTool.ownerSubEgoId),
    };
  }
  return { notFound: true };
}

/** Nombres de las tools que el Sub-Ego ve (para los mensajes de error). */
export function visibleToolNames(
  registry: ToolRegistry,
  subEgoId?: string
): string[] {
  const view = toolViewFor(registry, subEgoId);
  return (view ? view.list() : registry.list()).map((t) => t.name);
}
