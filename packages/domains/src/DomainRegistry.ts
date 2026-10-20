import {
  DomainDefinition,
  DomainDefinitionSchema,
  DomainView,
  CanonicalDomainId,
} from "./types.js";
import { assertToolsExist, type ToolCatalogLike } from "@ego/subegos";

/**
 * Opciones del registro de dominios (EGO-FIND-45, T5).
 */
export interface DomainRegistryOptions {
  /**
   * Catálogo contra el que se valida que las tools declaradas por un dominio
   * EXISTAN. Si se omite, la validación se salta (compatibilidad); el test de
   * contrato de `@ego/domains` la ejerce siempre.
   */
  toolCatalog?: ToolCatalogLike;
}

/**
 * Dominios canónicos integrados de fábrica en Ego (P0-Beta / ADR-050).
 */
export const BUILTIN_DOMAINS: Record<CanonicalDomainId, DomainDefinition> = {
  engineering: {
    id: "engineering",
    name: "Engineering",
    description: "Desarrollo de software, árbol de código, Git worktrees e inspección de dependencias.",
    icon: "code",
    namespaces: ["engineering/*", "kb/code", "tasks/dev", "gov/audit"],
    defaultSubEgoId: "ego.dev",
    subEgoTemplates: ["ego.dev", "code_reviewer"],
    views: [
      {
        id: "code_tree",
        name: "Explorador de Código",
        componentKind: "table",
        description: "Visualizador estructurado del árbol del workspace y dependencias",
        default: true,
      },
      {
        id: "diff_viewer",
        name: "Visor de Diffs",
        componentKind: "diff",
        description: "Inspección de cambios de Git sin mutar el working directory",
      },
      {
        id: "worktrees",
        name: "Worktrees Aislados",
        componentKind: "table",
        description: "Entornos de trabajo temporales para refactorización sin fricción (HERM-17)",
      },
    ],
    tools: [
      "fs_read_file",
      "fs_write_file",
      "terminal_exec",
      "git_status",
      "git_diff",
    ],
    isBuiltin: true,
  },

  product: {
    id: "product",
    name: "Product",
    description: "Gestión de backlog, épicas, roadmap y especificaciones técnicas PRD.",
    icon: "kanban",
    namespaces: ["product/backlog", "product/epics", "product/prds"],
    defaultSubEgoId: "ego.product",
    subEgoTemplates: ["ego.product"],
    views: [
      {
        id: "kanban",
        name: "Tablero Kanban",
        componentKind: "board",
        description: "Gestión visual de tareas y estado del backlog de producto",
        default: true,
      },
      {
        id: "epics_roadmap",
        name: "Roadmap de Épicas",
        componentKind: "table",
        description: "Línea de tiempo de hitos y dependencias entre épicas",
      },
      {
        id: "prd_editor",
        name: "Editor de PRDs",
        componentKind: "editor",
        description: "Especificaciones estructuradas con criterios de aceptación",
      },
    ],
    tools: [],
    isBuiltin: true,
  },

  knowledge: {
    id: "knowledge",
    name: "Knowledge",
    description: "Investigación profunda, navegación de GraphRAG y síntesis documental.",
    icon: "book-open",
    namespaces: ["kb/*", "research/*"],
    defaultSubEgoId: "ego.researcher",
    subEgoTemplates: ["ego.researcher", "researcher"],
    views: [
      {
        id: "graph_view",
        name: "Grafo GraphRAG",
        componentKind: "table",
        description: "Exploración interactiva de entidades y aristas de conocimiento",
        default: true,
      },
      {
        id: "doc_explorer",
        name: "Explorador Documental",
        componentKind: "table",
        description: "Búsqueda híbrida y lectura de documentos importados",
      },
      {
        id: "facts_table",
        name: "Matriz de Facts",
        componentKind: "table",
        description: "Hechos estructurados con niveles de confianza epistémica",
      },
    ],
    tools: [],
    isBuiltin: true,
  },

  analytics: {
    id: "analytics",
    name: "Analytics",
    description: "Visualización de telemetría, métricas de tokens y agregaciones sobre VantaDB.",
    icon: "bar-chart",
    namespaces: ["metrics/*", "analytics/*", "gov/audit"],
    defaultSubEgoId: "ego.analyst",
    subEgoTemplates: ["ego.analyst"],
    views: [
      {
        id: "metrics_overview",
        name: "Consola de Métricas",
        componentKind: "chart",
        description: "Resumen de rendimiento, telemetría y estado operativo",
        default: true,
      },
      {
        id: "tokens_costs",
        name: "Tokens & USD",
        componentKind: "chart",
        description: "Distribución de consumo de tokens y presupuesto de inferencia",
      },
      {
        id: "db_aggregations",
        name: "Agregaciones de Memoria",
        componentKind: "table",
        description: "Estadísticas por namespace y volumen de persistencia",
      },
    ],
    tools: [],
    isBuiltin: true,
  },

  crm: {
    id: "crm",
    name: "CRM & Sales",
    description: "Gestión de contactos, etapas del embudo comercial y timeline de interacciones.",
    icon: "users",
    namespaces: ["crm/contacts", "crm/deals", "crm/interactions"],
    defaultSubEgoId: "ego.crm",
    subEgoTemplates: ["ego.crm"],
    views: [
      {
        id: "deals_pipeline",
        name: "Pipeline de Deals",
        componentKind: "board",
        description: "Etapas del embudo de ventas y valor monetario estimado",
        default: true,
      },
      {
        id: "contacts_list",
        name: "Directorio de Contactos",
        componentKind: "table",
        description: "Fichas de contactos, empresas e historial de relación",
      },
      {
        id: "timeline",
        name: "Timeline de Interacciones",
        componentKind: "table",
        description: "Registro cronológico de reuniones, notas y comunicaciones",
      },
    ],
    tools: [],
    isBuiltin: true,
  },
};

/**
 * Registro dinámico y tipado de Dominios Funcionales (DOM-09 / COUC-10).
 * Garantiza mutación segura de configuraciones sin alterar el núcleo del SOC.
 */
export class DomainRegistry {
  private domains = new Map<string, DomainDefinition>();
  private readonly toolCatalog?: ToolCatalogLike;

  constructor(customDomains?: DomainDefinition[], options: DomainRegistryOptions = {}) {
    this.toolCatalog = options.toolCatalog;

    // Inicializar con dominios canónicos de Ego
    for (const [id, domain] of Object.entries(BUILTIN_DOMAINS)) {
      this.domains.set(id, { ...domain });
    }

    if (customDomains) {
      for (const custom of customDomains) {
        this.registerDomain(custom);
      }
    }
  }

  /**
   * Registra un nuevo dominio o actualiza uno no-builtin.
   * Valida estrictamente el esquema con Zod (COUC-10) y, si hay catálogo de
   * tools, que las tools declaradas EXISTAN (EGO-FIND-45).
   */
  public registerDomain(domain: unknown): DomainDefinition {
    const validated = DomainDefinitionSchema.parse(domain);

    if (this.toolCatalog) {
      assertToolsExist(validated.tools, this.toolCatalog, `dominio '${validated.id}'`);
    }

    const existing = this.domains.get(validated.id);
    if (existing && existing.isBuiltin && !validated.isBuiltin) {
      throw new Error(
        `[DomainRegistry] No está permitido sobreescribir el dominio integrado canónico '${validated.id}' con una extensión no-builtin.`
      );
    }

    this.domains.set(validated.id, validated);
    return validated;
  }

  /**
   * Elimina un dominio registrado. Los dominios built-in están protegidos contra eliminación.
   */
  public unregisterDomain(id: string): boolean {
    const domain = this.domains.get(id);
    if (!domain) {
      return false;
    }

    if (domain.isBuiltin) {
      throw new Error(
        `[DomainRegistry] No es posible desregistrar el dominio integrado '${id}' (Protección inmutable de Core).`
      );
    }

    return this.domains.delete(id);
  }

  /**
   * Obtiene la definición de un dominio por su identificador.
   */
  public getDomain(id: string): DomainDefinition | undefined {
    return this.domains.get(id);
  }

  /**
   * Verifica si un dominio existe en el registro.
   */
  public hasDomain(id: string): boolean {
    return this.domains.has(id);
  }

  /**
   * Lista todos los dominios registrados.
   */
  public listDomains(): DomainDefinition[] {
    return Array.from(this.domains.values());
  }

  /**
   * Obtiene la lista de namespaces asociados a un dominio.
   */
  public getNamespacesForDomain(id: string): string[] {
    const domain = this.domains.get(id);
    return domain ? [...domain.namespaces] : [];
  }

  /**
   * Obtiene la vista por defecto de un dominio.
   */
  public getDefaultView(id: string): DomainView | undefined {
    const domain = this.domains.get(id);
    if (!domain || domain.views.length === 0) {
      return undefined;
    }
    return domain.views.find((v) => v.default) || domain.views[0];
  }

  /**
   * Obtiene todas las vistas disponibles para un dominio.
   */
  public getViewsForDomain(id: string): DomainView[] {
    const domain = this.domains.get(id);
    return domain ? [...domain.views] : [];
  }
}
