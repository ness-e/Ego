import type { EgoMemoryAdapter } from "@ego/memory";
import {
  BacklogItem,
  BacklogItemSchema,
  BacklogItemStatus,
  Epic,
  EpicSchema,
  ProductPrd,
  ProductPrdSchema,
} from "./types.js";

export interface CreateBacklogItemInput {
  title: string;
  description: string;
  epicId?: string;
  priority?: "p0" | "p1" | "p2" | "p3";
  acceptanceCriteria?: string[];
  assignedSubEgoId?: string;
}

export interface CreateEpicInput {
  title: string;
  description: string;
  targetQuarter?: string;
}

export interface GeneratePrdInput {
  title: string;
  problemStatement: string;
  solutionOverview: string;
  userPersonas?: string[];
  acceptanceCriteria: string[];
  successMetrics?: string[];
  outOfScope?: string[];
}

export interface ProductHydrateReport {
  backlogItems: number;
  epics: number;
  prds: number;
  skipped: number;
}

/**
 * Dominio de Producto (DOM-02 / ADR-050).
 * Gestiona backlog, épicas y PRDs estructurados persistidos en VantaDB.
 *
 * Persistencia (H07 — F2T4): cada escritura se espeja en VantaDB
 * (`product/backlog`, `product/epics`, `product/prds`). Al arrancar, llamar a
 * `hydrate()` (o usar `ProductDomain.open(memory)`) para rehidratar los mapas
 * en memoria tras un reinicio. Los corruptos se omiten con aviso.
 */
export class ProductDomain {
  private memory?: EgoMemoryAdapter;
  private inMemoryBacklog = new Map<string, BacklogItem>();
  private inMemoryEpics = new Map<string, Epic>();
  private inMemoryPrds = new Map<string, ProductPrd>();

  constructor(memory?: EgoMemoryAdapter) {
    this.memory = memory;
  }

  /**
   * Fábrica de arranque: construye el dominio y rehidrata desde VantaDB.
   */
  public static async open(memory: EgoMemoryAdapter): Promise<ProductDomain> {
    const domain = new ProductDomain(memory);
    await domain.hydrate();
    return domain;
  }

  /**
   * Rehidrata backlog, épicas y PRDs desde VantaDB (H07).
   */
  public async hydrate(): Promise<ProductHydrateReport> {
    const report: ProductHydrateReport = { backlogItems: 0, epics: 0, prds: 0, skipped: 0 };
    if (!this.memory) return report;

    const namespaces = ["product/backlog", "product/epics", "product/prds"] as const;
    const pages: Array<Array<{ key: string; payload: unknown }>> = [];
    for (const ns of namespaces) {
      try {
        pages.push(await this.memory.list(ns, 1000));
      } catch (err) {
        console.warn(`[ProductDomain] hydrate: fallo list(${ns}):`, err);
        pages.push([]);
      }
    }

    for (const rec of pages[0]) {
      const parsed = BacklogItemSchema.safeParse(ProductDomain.parsePayload(rec.payload));
      if (!parsed.success) {
        report.skipped++;
        continue;
      }
      this.inMemoryBacklog.set(parsed.data.id, parsed.data);
      report.backlogItems++;
    }
    for (const rec of pages[1]) {
      const parsed = EpicSchema.safeParse(ProductDomain.parsePayload(rec.payload));
      if (!parsed.success) {
        report.skipped++;
        continue;
      }
      this.inMemoryEpics.set(parsed.data.id, parsed.data);
      report.epics++;
    }
    for (const rec of pages[2]) {
      const parsed = ProductPrdSchema.safeParse(ProductDomain.parsePayload(rec.payload));
      if (!parsed.success) {
        report.skipped++;
        continue;
      }
      this.inMemoryPrds.set(parsed.data.id, parsed.data);
      report.prds++;
    }
    return report;
  }

  private static parsePayload(payload: unknown): unknown {
    if (typeof payload !== "string") return payload;
    try {
      return JSON.parse(payload) as unknown;
    } catch {
      return payload;
    }
  }

  /**
   * Crea un nuevo ítem en el backlog del producto.
   */
  public async createBacklogItem(input: CreateBacklogItemInput): Promise<BacklogItem> {
    const now = new Date().toISOString();
    const id = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const rawItem: BacklogItem = {
      id,
      title: input.title,
      description: input.description,
      epicId: input.epicId,
      status: "backlog",
      priority: input.priority || "p1",
      acceptanceCriteria: input.acceptanceCriteria || [],
      assignedSubEgoId: input.assignedSubEgoId,
      createdAt: now,
      updatedAt: now,
    };

    const validated = BacklogItemSchema.parse(rawItem);
    this.inMemoryBacklog.set(id, validated);

    if (input.epicId) {
      const epic = this.inMemoryEpics.get(input.epicId);
      if (epic && !epic.itemIds.includes(id)) {
        epic.itemIds.push(id);
        epic.updatedAt = now;
        // H07: el vínculo épica→ítem también debe espejarse en VantaDB;
        // sin este put, la rehidratación pierde itemIds (espejo divergente).
        if (this.memory) {
          await this.memory.put({
            namespace: "product/epics",
            key: epic.id,
            payload: JSON.stringify(epic),
          });
        }
      }
    }

    if (this.memory) {
      await this.memory.put({
        namespace: "product/backlog",
        key: id,
        payload: JSON.stringify(validated),
      });
    }

    return validated;
  }

  /**
   * Actualiza el estado de una tarea del backlog (Kanban flow).
   */
  public async updateBacklogItemStatus(
    id: string,
    status: BacklogItemStatus
  ): Promise<BacklogItem> {
    const item = this.inMemoryBacklog.get(id);
    if (!item) {
      throw new Error(`[ProductDomain] Ítem del backlog '${id}' no encontrado.`);
    }

    item.status = status;
    item.updatedAt = new Date().toISOString();

    if (this.memory) {
      await this.memory.put({
        namespace: "product/backlog",
        key: id,
        payload: JSON.stringify(item),
      });
    }

    return item;
  }

  /**
   * Lista ítems del backlog con filtros opcionales.
   */
  public async listBacklogItems(filter?: {
    epicId?: string;
    status?: BacklogItemStatus;
  }): Promise<BacklogItem[]> {
    let items = Array.from(this.inMemoryBacklog.values());

    if (filter?.epicId) {
      items = items.filter((i) => i.epicId === filter.epicId);
    }
    if (filter?.status) {
      items = items.filter((i) => i.status === filter.status);
    }

    return items;
  }

  /**
   * Crea una nueva épica de producto.
   */
  public async createEpic(input: CreateEpicInput): Promise<Epic> {
    const now = new Date().toISOString();
    const id = `epic_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const rawEpic: Epic = {
      id,
      title: input.title,
      description: input.description,
      status: "planning",
      targetQuarter: input.targetQuarter,
      itemIds: [],
      createdAt: now,
      updatedAt: now,
    };

    const validated = EpicSchema.parse(rawEpic);
    this.inMemoryEpics.set(id, validated);

    if (this.memory) {
      await this.memory.put({
        namespace: "product/epics",
        key: id,
        payload: JSON.stringify(validated),
      });
    }

    return validated;
  }

  /**
   * Lista todas las épicas registradas.
   */
  public async listEpics(): Promise<Epic[]> {
    return Array.from(this.inMemoryEpics.values());
  }

  /**
   * Genera y valida una especificación de producto estructurada (PRD).
   */
  public async generatePrd(input: GeneratePrdInput): Promise<ProductPrd> {
    const now = new Date().toISOString();
    const id = `prd_${Date.now()}`;

    const rawPrd: ProductPrd = {
      id,
      title: input.title,
      problemStatement: input.problemStatement,
      solutionOverview: input.solutionOverview,
      userPersonas: input.userPersonas || [],
      acceptanceCriteria: input.acceptanceCriteria,
      successMetrics: input.successMetrics || [],
      outOfScope: input.outOfScope || [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const validated = ProductPrdSchema.parse(rawPrd);
    this.inMemoryPrds.set(id, validated);

    if (this.memory) {
      await this.memory.put({
        namespace: "product/prds",
        key: id,
        payload: JSON.stringify(validated),
      });
    }

    return validated;
  }

  /**
   * Exporta un PRD formal en formato Markdown canónico.
   */
  public exportPrdToMarkdown(prd: ProductPrd): string {
    const criteriaList = prd.acceptanceCriteria.map((c) => `- [ ] ${c}`).join("\n");
    const metricsList = prd.successMetrics.length
      ? prd.successMetrics.map((m) => `- ${m}`).join("\n")
      : "_No especificadas_";
    const outOfScopeList = prd.outOfScope.length
      ? prd.outOfScope.map((o) => `- ${o}`).join("\n")
      : "_Ninguno declarado_";

    return `# PRD: ${prd.title}

> **ID:** \`${prd.id}\` | **Versión:** v${prd.version} | **Fecha:** ${prd.createdAt}

## 1. Declaración del Problema
${prd.problemStatement}

## 2. Visión de la Solución
${prd.solutionOverview}

## 3. Criterios de Aceptación (Definition of Done)
${criteriaList}

## 4. Métricas de Éxito
${metricsList}

## 5. Fuera de Alcance (Out of Scope)
${outOfScopeList}
`;
  }
}
