import type { EgoMemoryAdapter } from "@ego/memory";
import {
  CrmContact,
  CrmContactSchema,
  CrmDeal,
  CrmDealSchema,
  CrmInteraction,
  CrmInteractionSchema,
  DealStage,
  InteractionKind,
  PipelineSummary,
} from "./types.js";

export interface CreateContactInput {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  notes?: string;
  tags?: string[];
}

export interface CreateDealInput {
  title: string;
  valueUsd: number;
  contactId: string;
  stage?: DealStage;
  probabilityPct?: number;
  expectedCloseDate?: string;
}

export interface CreateInteractionInput {
  contactId: string;
  dealId?: string;
  kind: InteractionKind;
  summary: string;
  timestamp?: string;
}

/**
 * Dominio de CRM y Pipeline de Ventas (DOM-05 / ADR-050).
 * Administra contactos, embudo comercial e historial cronológico de interacciones.
 */
export class CrmDomain {
  private memory?: EgoMemoryAdapter;
  private contacts = new Map<string, CrmContact>();
  private deals = new Map<string, CrmDeal>();
  private interactions: CrmInteraction[] = [];

  constructor(memory?: EgoMemoryAdapter) {
    this.memory = memory;
  }

  /**
   * Crea y valida un nuevo contacto comercial.
   */
  public async createContact(input: CreateContactInput): Promise<CrmContact> {
    const now = new Date().toISOString();
    const id = `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const raw: CrmContact = {
      id,
      name: input.name,
      email: input.email,
      company: input.company,
      phone: input.phone,
      notes: input.notes,
      tags: input.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    const validated = CrmContactSchema.parse(raw);
    this.contacts.set(id, validated);

    if (this.memory) {
      await this.memory.put({
        namespace: "crm/contacts",
        key: id,
        payload: JSON.stringify(validated),
      });
    }

    return validated;
  }

  /**
   * Obtiene la lista de contactos registrados.
   */
  public async listContacts(): Promise<CrmContact[]> {
    return Array.from(this.contacts.values());
  }

  /**
   * Obtiene un contacto por su ID.
   */
  public async getContact(id: string): Promise<CrmContact | undefined> {
    return this.contacts.get(id);
  }

  /**
   * Crea una nueva oportunidad (deal) en el pipeline.
   */
  public async createDeal(input: CreateDealInput): Promise<CrmDeal> {
    const now = new Date().toISOString();
    const id = `deal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Probabilidad por defecto según etapa si no se especifica
    let defaultProb = input.probabilityPct;
    if (defaultProb === undefined) {
      switch (input.stage) {
        case "lead":
          defaultProb = 10;
          break;
        case "qualified":
          defaultProb = 30;
          break;
        case "proposal":
          defaultProb = 60;
          break;
        case "won":
          defaultProb = 100;
          break;
        case "lost":
          defaultProb = 0;
          break;
        default:
          defaultProb = 20;
      }
    }

    const raw: CrmDeal = {
      id,
      title: input.title,
      valueUsd: input.valueUsd,
      stage: input.stage || "lead",
      contactId: input.contactId,
      probabilityPct: defaultProb,
      expectedCloseDate: input.expectedCloseDate,
      createdAt: now,
      updatedAt: now,
    };

    const validated = CrmDealSchema.parse(raw);
    this.deals.set(id, validated);

    if (this.memory) {
      await this.memory.put({
        namespace: "crm/deals",
        key: id,
        payload: JSON.stringify(validated),
      });
    }

    return validated;
  }

  /**
   * Actualiza la etapa de un deal en el embudo comercial.
   */
  public async updateDealStage(id: string, newStage: DealStage): Promise<CrmDeal> {
    const deal = this.deals.get(id);
    if (!deal) {
      throw new Error(`[CrmDomain] Deal con ID '${id}' no encontrado.`);
    }

    deal.stage = newStage;
    deal.updatedAt = new Date().toISOString();

    if (newStage === "won") deal.probabilityPct = 100;
    if (newStage === "lost") deal.probabilityPct = 0;

    if (this.memory) {
      await this.memory.put({
        namespace: "crm/deals",
        key: id,
        payload: JSON.stringify(deal),
      });
    }

    return deal;
  }

  /**
   * Lista deals con filtro opcional por etapa de embudo.
   */
  public async listDeals(filter?: { stage?: DealStage }): Promise<CrmDeal[]> {
    let list = Array.from(this.deals.values());
    if (filter?.stage) {
      list = list.filter((d) => d.stage === filter.stage);
    }
    return list;
  }

  /**
   * Registra un evento o interacción en el historial cronológico (`crm/interactions`).
   */
  public async recordInteraction(input: CreateInteractionInput): Promise<CrmInteraction> {
    const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = input.timestamp || new Date().toISOString();

    const raw: CrmInteraction = {
      id,
      contactId: input.contactId,
      dealId: input.dealId,
      kind: input.kind,
      summary: input.summary,
      timestamp,
    };

    const validated = CrmInteractionSchema.parse(raw);
    this.interactions.push(validated);

    if (this.memory) {
      await this.memory.put({
        namespace: "crm/interactions",
        key: id,
        payload: JSON.stringify(validated),
      });
    }

    return validated;
  }

  /**
   * Obtiene la cronología de interacciones asociada a un contacto.
   */
  public async getTimelineForContact(contactId: string): Promise<CrmInteraction[]> {
    return this.interactions
      .filter((i) => i.contactId === contactId)
      .sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
  }

  /**
   * Genera métricas agregadas del pipeline comercial.
   */
  public async getPipelineSummary(): Promise<PipelineSummary> {
    const allDeals = Array.from(this.deals.values());

    const stagesCount: Record<DealStage, number> = {
      lead: 0,
      qualified: 0,
      proposal: 0,
      won: 0,
      lost: 0,
    };

    const stagesValueUsd: Record<DealStage, number> = {
      lead: 0,
      qualified: 0,
      proposal: 0,
      won: 0,
      lost: 0,
    };

    let totalPipelineUsd = 0;
    let weightedPipelineUsd = 0;

    for (const d of allDeals) {
      stagesCount[d.stage] = (stagesCount[d.stage] || 0) + 1;
      stagesValueUsd[d.stage] = (stagesValueUsd[d.stage] || 0) + d.valueUsd;

      if (d.stage !== "lost") {
        totalPipelineUsd += d.valueUsd;
        weightedPipelineUsd += (d.valueUsd * d.probabilityPct) / 100;
      }
    }

    return {
      totalPipelineUsd,
      weightedPipelineUsd: Math.round(weightedPipelineUsd),
      stagesCount,
      stagesValueUsd,
      dealsCount: allDeals.length,
    };
  }
}
