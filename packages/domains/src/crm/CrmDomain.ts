import type { EgoMemoryAdapter } from "@ego/memory";
import { getQuarantineAware, listQuarantineAware } from "@ego/memory";
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

export interface CrmHydrateReport {
  contacts: number;
  deals: number;
  interactions: number;
  skipped: number;
  /** Registros resueltos vía `quarantine/pending` (marca explícita FIX-01 SEC-09). */
  quarantined: number;
}

interface CrmAwareRecord {
  key: string;
  payload: unknown;
  quarantined: boolean;
}

/**
 * Dominio de CRM y Pipeline de Ventas (DOM-05 / ADR-050).
 * Administra contactos, embudo comercial e historial cronológico de interacciones.
 *
 * Persistencia (H07 — F2T4): cada escritura se espeja en VantaDB vía adapter
 * (`crm/contacts`, `crm/deals`, `crm/interactions`). Al arrancar, llamar a
 * `hydrate()` (o usar `CrmDomain.open(memory)`) para rehidratar los mapas en
 * memoria tras un reinicio. `getContact` reintenta por clave contra el adapter
 * si el snapshot no contiene el ID; los corruptos se omiten con aviso.
 *
 * Quarantine-aware (FIX-01 SEC-09): `crm/*` ya no difiere su enforcement —
 * las escrituras limpias van a `quarantine/pending` y las lecturas fusionan
 * live + cuarentena con marca explícita (`isQuarantined()` + contador
 * `quarantined` en el reporte). La regla de secretos SEC-04 sigue universal.
 */
export class CrmDomain {
  private memory?: EgoMemoryAdapter;
  private contacts = new Map<string, CrmContact>();
  private deals = new Map<string, CrmDeal>();
  private interactions: CrmInteraction[] = [];
  private quarantinedIds = new Set<string>();

  constructor(memory?: EgoMemoryAdapter) {
    this.memory = memory;
  }

  /**
   * Fábrica de arranque: construye el dominio y rehidrata desde VantaDB.
   */
  public static async open(memory: EgoMemoryAdapter): Promise<CrmDomain> {
    const domain = new CrmDomain(memory);
    await domain.hydrate();
    return domain;
  }

  /**
   * Rehidrata contactos, deals e interacciones desde VantaDB (H07),
   * fusionando live + `quarantine/pending` con marca explícita (FIX-01).
   */
  public async hydrate(): Promise<CrmHydrateReport> {
    const report: CrmHydrateReport = { contacts: 0, deals: 0, interactions: 0, skipped: 0, quarantined: 0 };
    if (!this.memory) return report;

    const namespaces = ["crm/contacts", "crm/deals", "crm/interactions"] as const;
    const pages: CrmAwareRecord[][] = [];
    for (const ns of namespaces) {
      try {
        pages.push(await this.listAware(ns));
      } catch (err) {
        console.warn(`[CrmDomain] hydrate: fallo list(${ns}):`, err);
        pages.push([]);
      }
    }

    const mark = (id: string, quarantined: boolean): void => {
      if (quarantined) {
        this.quarantinedIds.add(id);
        report.quarantined++;
      }
    };

    for (const rec of pages[0] ?? []) {
      const parsed = CrmContactSchema.safeParse(CrmDomain.parsePayload(rec.payload));
      if (!parsed.success) {
        report.skipped++;
        continue;
      }
      this.contacts.set(parsed.data.id, parsed.data);
      mark(parsed.data.id, rec.quarantined);
      report.contacts++;
    }
    for (const rec of pages[1] ?? []) {
      const parsed = CrmDealSchema.safeParse(CrmDomain.parsePayload(rec.payload));
      if (!parsed.success) {
        report.skipped++;
        continue;
      }
      this.deals.set(parsed.data.id, parsed.data);
      mark(parsed.data.id, rec.quarantined);
      report.deals++;
    }
    const seen = new Set(this.interactions.map((i) => i.id));
    for (const rec of pages[2] ?? []) {
      const parsed = CrmInteractionSchema.safeParse(CrmDomain.parsePayload(rec.payload));
      if (!parsed.success) {
        report.skipped++;
        continue;
      }
      if (!seen.has(parsed.data.id)) {
        seen.add(parsed.data.id);
        this.interactions.push(parsed.data);
        mark(parsed.data.id, rec.quarantined);
        report.interactions++;
      }
    }
    return report;
  }

  /**
   * ¿El registro vive en `quarantine/pending` (marca explícita FIX-01)?
   * Cubre lo rehidratado desde cuarentena y lo escrito con routing a
   * cuarentena en esta sesión.
   */
  public isQuarantined(id: string): boolean {
    return this.quarantinedIds.has(id);
  }

  /** IDs con marca de cuarentena en esta instancia. */
  public listQuarantinedIds(): string[] {
    return [...this.quarantinedIds];
  }

  /**
   * Listado quarantine-aware (implementación única compartida en
   * `@ego/memory`). El gateway es estructural: los mocks heredados sin
   * `listWithQuarantine` funcionan igual (live + barrido de cuarentena).
   */
  private async listAware(namespace: string): Promise<CrmAwareRecord[]> {
    if (!this.memory) return [];
    const rows = await listQuarantineAware(this.memory, namespace, 1000, (err) => {
      console.warn(`[CrmDomain] listAware: barrido de cuarentena falló (${namespace}):`, err);
    });
    return rows.map((r) => ({ key: r.key, payload: r.payload, quarantined: r.quarantined }));
  }

  /**
   * Lectura por clave quarantine-aware (implementación única compartida).
   */
  private async getAware(namespace: string, key: string): Promise<{ payload: unknown } | null> {
    if (!this.memory) return null;
    const hit = await getQuarantineAware(this.memory, namespace, key);
    if (!hit) return null;
    if (hit.quarantined) this.quarantinedIds.add(key);
    return { payload: hit.payload };
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
      const report = await this.memory.put({
        namespace: "crm/contacts",
        key: id,
        payload: JSON.stringify(validated),
      });
      if (report?.routedTo === "quarantine") this.quarantinedIds.add(id);
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
   * Obtiene un contacto por su ID: snapshot primero, VantaDB después (H07),
   * resolviendo vía cuarentena con marca explícita (FIX-01).
   */
  public async getContact(id: string): Promise<CrmContact | undefined> {
    const cached = this.contacts.get(id);
    if (cached) return cached;
    if (!this.memory) return undefined;

    try {
      const rec = await this.getAware("crm/contacts", id);
      if (!rec) return undefined;
      const parsed = CrmContactSchema.safeParse(CrmDomain.parsePayload(rec.payload));
      if (!parsed.success) return undefined;
      this.contacts.set(id, parsed.data);
      return parsed.data;
    } catch {
      return undefined;
    }
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
      const report = await this.memory.put({
        namespace: "crm/deals",
        key: id,
        payload: JSON.stringify(validated),
      });
      if (report?.routedTo === "quarantine") this.quarantinedIds.add(id);
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
      const report = await this.memory.put({
        namespace: "crm/deals",
        key: id,
        payload: JSON.stringify(deal),
      });
      if (report?.routedTo === "quarantine") this.quarantinedIds.add(id);
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
      const report = await this.memory.put({
        namespace: "crm/interactions",
        key: id,
        payload: JSON.stringify(validated),
      });
      if (report?.routedTo === "quarantine") this.quarantinedIds.add(id);
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
