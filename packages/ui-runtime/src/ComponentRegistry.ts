import { z } from "zod";

/**
 * CanvasComponentRegistry — registro DINÁMICO de componentes del Canvas.
 *
 * EGO-FIND-47 / EGO-FIND-48 (Ola 1 / A3 / T8).
 *
 * PROBLEMA
 * --------
 * `apps/desktop/renderer/components/canvas/registry.ts` era un `Record`
 * estático y cerrado de 11 tipos:
 *
 * ```ts
 * export const ComponentRegistry: Record<CanvasComponentType, ComponentRendererFn> = { … };
 * ```
 *
 * No había forma de registrar un componente nuevo en runtime (hot-swap), y
 * `CanvasComponentType` era una unión cerrada: cualquier tipo nuevo quedaba
 * fuera del tipo y del schema del manifiesto.
 *
 * SOLUCIÓN (en `@ego/ui-runtime`, la capa compartida)
 * -----------------------------------------------
 * Este registry es la **fuente canónica** del mapeo `tipo → renderer +
 * esquema de props`. Es dinámico (`register`/`unregister` en runtime) y
 * permite tipos extiendo más allá de los 11 built-in.
 *
 * Handoff A3 → A4: el renderer debe consumir ESTE registry en vez del
 * `Record` local (ver handoff).
 */

/** Opciones de registro de un componente. */
export interface CanvasComponentOptions {
  /** Esquema Zod de las props (validación en la frontera del registry). */
  propsSchema?: z.ZodType<unknown>;
  /** Descripción legible del componente. */
  description?: string;
  /** Marca el componente como built-in (no se puede sobrescribir sin permiso). */
  builtin?: boolean;
  /**
   * Normalizador de props ejecutado ANTES de renderizar.
   *
   * Permite que un paquete sin framework (como `@ego/ui-runtime`) registre un
   * tipo de componente con su **preparación** (validación + saneado +
   * normalización) mientras el host aporta el renderer visual. Es lo que
   * permite cablear `MermaidRenderer` (OCLW-11) sin que el paquete dependa
   * de React.
   */
  prepare?: (props: unknown) => unknown;
}

/** Entrada interna del registry. */
interface CanvasComponentEntry<TComponent> {
  readonly renderer: TComponent;
  readonly propsSchema?: z.ZodType<unknown>;
  readonly description?: string;
  readonly builtin: boolean;
  readonly prepare?: (props: unknown) => unknown;
}

/**
 * Registro dinámico de componentes del Canvas.
 *
 * Genérico en el tipo de renderer para no imponer React (el paquete es
 * agnóstico: lo usa el renderer de Electron, pero también el main process).
 */
export class CanvasComponentRegistry<TComponent = unknown> {
  private readonly components = new Map<string, CanvasComponentEntry<TComponent>>();

  /**
   * Registra (o sobrescribe) un componente.
   * @throws si el tipo ya existe y es built-in y `allowOverride` es `false`.
   */
  public register(
    type: string,
    renderer: TComponent,
    options: CanvasComponentOptions & { allowOverride?: boolean } = {}
  ): void {
    const normalized = type.trim();
    if (normalized.length === 0) {
      throw new Error("[CanvasComponentRegistry] El tipo de componente no puede estar vacío.");
    }
    if (renderer === undefined || renderer === null) {
      throw new Error(
        `[CanvasComponentRegistry] El renderer de '${normalized}' no puede ser null/undefined.`
      );
    }

    const existing = this.components.get(normalized);
    if (existing?.builtin && options.allowOverride !== true) {
      throw new Error(
        `[CanvasComponentRegistry] El componente built-in '${normalized}' no se puede sobrescribir sin 'allowOverride: true'.`
      );
    }

    this.components.set(normalized, {
      renderer,
      propsSchema: options.propsSchema,
      description: options.description,
      builtin: options.builtin === true,
      prepare: options.prepare,
    });
  }

  /**
   * Registra varios componentes a la vez.
   */
  public registerMany(
    entries: ReadonlyArray<{ type: string; renderer: TComponent; options?: CanvasComponentOptions }>
  ): void {
    for (const entry of entries) {
      this.register(entry.type, entry.renderer, { ...entry.options, allowOverride: true });
    }
  }

  /**
   * Elimina un componente. Los built-in no se pueden eliminar.
   */
  public unregister(type: string): boolean {
    const existing = this.components.get(type);
    if (!existing) return false;
    if (existing.builtin) {
      throw new Error(
        `[CanvasComponentRegistry] El componente built-in '${type}' no se puede eliminar.`
      );
    }
    return this.components.delete(type);
  }

  /**
   * Resuelve el renderer de un tipo. `undefined` si no está registrado.
   */
  public resolve(type: string): TComponent | undefined {
    return this.components.get(type)?.renderer;
  }

  /** `true` si el tipo está registrado. */
  public has(type: string): boolean {
    return this.components.has(type);
  }

  /** Lista de tipos registrados. */
  public list(): string[] {
    return Array.from(this.components.keys());
  }

  /** Descripción de un componente (si la tiene). */
  public describe(type: string): string | undefined {
    return this.components.get(type)?.description;
  }

  /** Esquema de props de un tipo (si lo tiene). */
  public getPropsSchema(type: string): z.ZodType<unknown> | undefined {
    return this.components.get(type)?.propsSchema;
  }

  /**
   * Prepara las props de un tipo con su normalizador registrado.
   * Sin normalizador: devuelve las props tal cual.
   */
  public prepare(type: string, props: unknown): unknown {
    const prepare = this.components.get(type)?.prepare;
    if (!prepare) return props;
    return prepare(props);
  }

  /**
   * `true` si el tipo tiene un normalizador de props registrado.
   */
  public hasPrepare(type: string): boolean {
    return typeof this.components.get(type)?.prepare === "function";
  }

  /**
   * Valida las props de un tipo contra su esquema registrado.
   * Sin esquema: acepta (validación trivial).
   */
  public validateProps(
    type: string,
    props: unknown
  ): { success: true; data: unknown } | { success: false; error: z.ZodError } {
    const schema = this.getPropsSchema(type);
    if (!schema) {
      return { success: true, data: props };
    }
    const parsed = schema.safeParse(props);
    if (parsed.success) {
      return { success: true, data: parsed.data };
    }
    return { success: false, error: parsed.error };
  }

  /** Vacía el registry (tests). */
  public clear(): void {
    this.components.clear();
  }

  /** Tamaño del registry. */
  public get size(): number {
    return this.components.size;
  }
}

/**
 * Singleton del registry de componentes (compatibilidad con el uso global del
 * canvas). El renderer de Electron lo consume para resolver `type → renderer`.
 */
let singleton: CanvasComponentRegistry<unknown> | undefined;

/** Devuelve (creando si hace falta) el registry global de componentes. */
export function getCanvasComponentRegistry<TComponent = unknown>(): CanvasComponentRegistry<TComponent> {
  if (!singleton) {
    singleton = new CanvasComponentRegistry<unknown>();
  }
  return singleton as CanvasComponentRegistry<TComponent>;
}

/** Sustituye el registry global (tests / compositions alternativa). */
export function setCanvasComponentRegistry<TComponent = unknown>(
  registry: CanvasComponentRegistry<TComponent>
): void {
  singleton = registry as unknown as CanvasComponentRegistry<unknown>;
}

/** Reinicia el registry global a uno vacío. */
export function resetCanvasComponentRegistry(): void {
  singleton = undefined;
}
