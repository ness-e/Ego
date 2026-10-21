/**
 * Ola 9 · Vista filtrada del registro de tools por Sub-Ego.
 *
 * ## Decisión del owner (2026-10-21)
 * *"Vista filtrada por Sub-Ego."* — el registro **global** sigue siendo la
 * **única fuente de verdad** (no se clona) y cada Sub-Ego consulta una
 * **proyección** de él.
 *
 * ## Por qué una proyección y no un clon
 * Un clon (`cloneRegistryForProfile`) es una **copia**: congela el catálogo
 * en el momento del clonado → las tools que llegan **tardío** (las de un
 * servidor MCP que se conecta en caliente) **no aparecerían** en el clon, y
 * el Sub-Ego perdería tools que sí puede usar (una regresión silenciosa).
 *
 * La vista, en cambio, **calcula el filtro en cada consulta** sobre el
 * registro vivo: el *arrival tardío* se ve **sin reconstruir nada** (que es
 * el caso normal, no la excepción) y el coste es O(n) por consulta sobre un
 * catálogo de ~20 tools.
 *
 * ## La regla (fail-closed, explícita)
 * Una tool es visible en la vista de `subEgoId` si y sólo si:
 *
 * - **tiene dueño** (`ownerSubEgoId`) y el dueño es `subEgoId` → **privada** ✓
 * - **no tiene dueño** → **GLOBAL**: la ven todas las vistas.
 *
 * ### ⚠️ Hallazgo de seguridad (lo que la regla deja abierto)
 * *"Sin dueño ⇒ global"* es una regla **abierta por defecto**: si alguien
 * registra una tool sin declarar dueño, **todo Sub-Ego la ve**. Hoy eso es
 * inocuo (las ~20 tools del producto son infraestructura compartida: fs,
 * git, terminal, MCP), pero es un **agujero de aislamiento** para las tools
 * que *nacen* de un Sub-Ego concreto.
 *
 * La mitigación es la que hace este módulo: el dueño se declara **en el
 * momento del registro** (`registry.register(tool, { ownerSubEgoId })` o
 * `tool.ownerSubEgoId`), y las tools que deben ser privadas lo declaran.
 * Quien registre una tool **privada** sin declarar dueño abre el agujero →
 * por eso la regla está escrita, testada y documentada aquí (y por eso el
 * `ownerSubEgoId` es un campo de primera clase del contrato, no un
 * parámetro suelto).
 *
 * ## Lo que NO cambia
 * El registro **global** sigue siendo consultable tal cual (para la UI, la
 * introspección, el servidor MCP y el usuario): la vista se **añade**, no
 * sustituye.
 */
import type {
  ToolDefinition,
  ToolFilter,
  ToolJsonSchema,
} from "./types.js";
import type { ToolRegistry } from "./ToolRegistry.js";

/**
 * Superficie de tools que un Sub-Ego ve.
 *
 * Es una **proyección**: no copia nada, cada consulta recalcula el filtro
 * sobre el registro vivo (→ el *arrival tardío* se ve sin reconstruir).
 */
export interface ToolRegistryView {
  /** El Sub-Ego dueño de esta vista. */
  readonly subEgoId: string;
  /** Las tools visibles (filtro por dueño). */
  list(filter?: ToolFilter): ToolDefinition[];
  /** La tool por nombre, si esta vista la expone. */
  get(name: string): ToolDefinition | undefined;
  /** ¿Esta vista expone esa tool? */
  has(name: string): boolean;
  /** Cuántas tools expone la vista. */
  count(): number;
  /** Los JSON Schema de las tools visibles (con el schema completo). */
  exportJsonSchemas(filter?: ToolFilter): ToolJsonSchema[];
}

/**
 * ¿Esta tool es visible en la vista de `subEgoId`?
 *
 * **La regla** (fail-closed para las tools con dueño):
 * - con dueño → sólo su dueño;
 * - sin dueño → global (ver el aviso de seguridad de la cabecera).
 */
export function isVisibleToSubEgo(
  tool: ToolDefinition,
  subEgoId: string
): boolean {
  const owner = tool.ownerSubEgoId;
  if (owner === undefined) return true; // global
  return owner === subEgoId;
}

/**
 * Vista filtrada del registro para un Sub-Ego.
 *
 * No clona: cada consulta recalcula el filtro sobre el registro vivo.
 */
export function subEgoToolsView(
  registry: ToolRegistry,
  subEgoId: string
): ToolRegistryView {
  const visible = (tool: ToolDefinition): boolean =>
    isVisibleToSubEgo(tool, subEgoId);

  return {
    subEgoId,
    list: (filter?: ToolFilter) => registry.list(filter).filter(visible),
    get: (name: string) => {
      const tool = registry.get(name);
      return tool && visible(tool) ? tool : undefined;
    },
    has: (name: string) => {
      const tool = registry.get(name);
      return tool !== undefined && visible(tool);
    },
    count: () => registry.list().filter(visible).length,
    exportJsonSchemas: (filter?: ToolFilter) =>
      registry.exportJsonSchemas(filter).filter((schema) => {
        const tool = registry.get(schema.name);
        return tool !== undefined && visible(tool);
      }),
  };
}

/**
 * La **superficie efectiva** de un Sub-Ego: lo que declara ∧ lo que ve.
 *
 * ## Por qué el budget tiene que mirarla
 * El presupuesto por Sub-Ego (tokens/coste) se calcula sobre el turno que
 * el Sub-Ego **realmente** ejecuta. Si el budget mirara el registro
 * **global**, mediría una superficie que el Sub-Ego no usa (y, al revés,
 * dejaría sin medir las tools que sí usa).
 *
 * - `tools` → lo declarado **y** visible (su presupuesto real).
 * - `missing` → lo declarado que la vista **no** expone (otra superficie,
 *   o una tool que aún no existe): no son usables, y se listan para que
 *   la declaración no se tome por buena.
 */
export interface SubEgoToolSurface {
  /** El Sub-Ego. */
  readonly subEgoId: string;
  /** Las tools que puede usar (declaradas ∧ visibles). */
  readonly tools: readonly string[];
  /** Las declaradas que NO puede usar. */
  readonly missing: readonly string[];
  /** El presupuesto: cuántas tools le tocan. */
  readonly budget: number;
}

/** Resuelve la superficie efectiva de un Sub-Ego sobre su vista. */
export function resolveSubEgoToolSurface(options: {
  subEgoId: string;
  /** Las tools que el Sub-Ego declara (su manifiesto). */
  declaredTools: readonly string[];
  /** La vista del Sub-Ego. */
  view: ToolRegistryView;
}): SubEgoToolSurface {
  const available = new Set(options.view.list().map((t) => t.name));
  const tools: string[] = [];
  const missing: string[] = [];
  for (const declared of options.declaredTools) {
    if (available.has(declared)) tools.push(declared);
    else missing.push(declared);
  }
  return {
    subEgoId: options.subEgoId,
    tools,
    missing,
    budget: tools.length,
  };
}
