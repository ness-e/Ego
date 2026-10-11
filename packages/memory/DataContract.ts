export type LayerKind = "user" | "system";

export type ActorRole = "user" | "agent" | "system" | "maintenance";

export type OperationKind = "read" | "write" | "delete" | "prune";

export class DataContractError extends Error {
  constructor(
    message: string,
    public readonly namespace: string,
    public readonly layer: LayerKind,
    public readonly actor: ActorRole,
    public readonly operation: OperationKind
  ) {
    super(message);
    this.name = "DataContractError";
  }
}

/**
 * Prefijos canónicos de namespaces que pertenecen exclusivamente a la capa del usuario (CARP-01).
 * Principio 9: Local-first y soberanía de datos del usuario.
 */
const USER_NAMESPACE_PREFIXES = [
  "kb/",
  "projects/",
  "chat/",
  "notes/",
  "artifacts/",
  "user/",
  "prompts/",
  "workspace/",
];

/**
 * Prefijos canónicos de namespaces gestionados por el sistema/runtime.
 */
const SYSTEM_NAMESPACE_PREFIXES = [
  "system/",
  "gov/",
  "cache/",
  "quarantine/",
  "telemetry/",
  "tmp/",
];

/**
 * Contrato Canónico de Separación de Capas (Usuario vs Sistema).
 * Extraído y formalizado a partir del patrón DATA_CONTRACT de Career-Ops (CARP-01).
 */
export class DataContract {
  /**
   * Clasifica un namespace de VantaDB en "user" o "system".
   */
  public static classifyNamespace(namespace: string): LayerKind {
    const cleanNs = namespace.toLowerCase().trim();

    for (const prefix of USER_NAMESPACE_PREFIXES) {
      if (cleanNs.startsWith(prefix) || cleanNs === prefix.slice(0, -1)) {
        return "user";
      }
    }

    for (const prefix of SYSTEM_NAMESPACE_PREFIXES) {
      if (cleanNs.startsWith(prefix) || cleanNs === prefix.slice(0, -1)) {
        return "system";
      }
    }

    // Por defecto, cualquier namespace no reconocido se asume como "user" para evitar borrado accidental
    return "user";
  }

  /**
   * Verifica si un namespace pertenece a la capa del usuario.
   */
  public static isUserLayer(namespace: string): boolean {
    return this.classifyNamespace(namespace) === "user";
  }

  /**
   * Verifica si un namespace pertenece a la capa del sistema.
   */
  public static isSystemLayer(namespace: string): boolean {
    return this.classifyNamespace(namespace) === "system";
  }

  /**
   * Determina si un namespace puede ser podado o purgado automáticamente por recolectores de basura.
   * Regla de oro: La capa del usuario JAMÁS puede ser podada automáticamente por el sistema.
   */
  public static canPruneNamespace(namespace: string): boolean {
    return this.isSystemLayer(namespace);
  }

  /**
   * Valida las restricciones de mutación sobre un namespace según el rol del actor.
   * Lanza `DataContractError` si un proceso del sistema o agente intenta borrar o purgar la capa de usuario.
   */
  public static assertMutationAllowed(
    namespace: string,
    actor: ActorRole,
    operation: OperationKind
  ): void {
    const layer = this.classifyNamespace(namespace);

    // 1. La capa del usuario nunca puede ser podada automáticamente
    if (layer === "user" && operation === "prune") {
      throw new DataContractError(
        `Violación del DataContract (§CARP-01): El namespace '${namespace}' pertenece a la capa de usuario y no puede ser purgado automáticamente.`,
        namespace,
        layer,
        actor,
        operation
      );
    }

    // 2. Tareas de mantenimiento solo pueden operar sobre la capa del sistema
    if (actor === "maintenance" && layer === "user" && operation !== "read") {
      throw new DataContractError(
        `Violación del DataContract (§CARP-01): El actor de mantenimiento no tiene permisos para modificar la capa de usuario en '${namespace}'.`,
        namespace,
        layer,
        actor,
        operation
      );
    }

    // 3. Los agentes autónomos no pueden eliminar recursivamente datos de usuario sin supervisión humana
    if (actor === "agent" && layer === "user" && operation === "delete") {
      throw new DataContractError(
        `Violación del DataContract (§CARP-01): Un agente no puede eliminar datos de usuario en '${namespace}' sin aprobación explícita HITL.`,
        namespace,
        layer,
        actor,
        operation
      );
    }
  }
}
