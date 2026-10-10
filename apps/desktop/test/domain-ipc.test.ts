import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DomainRegistry,
  EngineeringDomain,
  ProductDomain,
  KnowledgeDomain,
  AnalyticsDomain,
  CrmDomain,
} from "@ego/domains";
import {
  DomainGetSchema,
  DomainSwitchSchema,
  DomainEngineeringStatusSchema,
  DomainProductBacklogSchema,
  DomainKnowledgeSearchSchema,
  DomainAnalyticsSeriesSchema,
  DomainCrmDealsSchema,
} from "../src/ipc/schema.js";
import { type EgoMemoryAdapter } from "@ego/memory";

describe("Functional Domains Desktop IPC Integration (DOM-01..DOM-09 / ADR-050)", () => {
  let domainRegistry: DomainRegistry;
  let engineeringDomain: EngineeringDomain;
  let productDomain: ProductDomain;
  let knowledgeDomain: KnowledgeDomain;
  let analyticsDomain: AnalyticsDomain;
  let crmDomain: CrmDomain;
  let mockAdapter: EgoMemoryAdapter;

  beforeEach(() => {
    mockAdapter = {
      ready: true,
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
    } as unknown as EgoMemoryAdapter;

    domainRegistry = new DomainRegistry();
    engineeringDomain = new EngineeringDomain();
    productDomain = new ProductDomain(mockAdapter);
    knowledgeDomain = new KnowledgeDomain({ memory: mockAdapter });
    analyticsDomain = new AnalyticsDomain(mockAdapter);
    crmDomain = new CrmDomain(mockAdapter);
  });

  it("DOM-09 / DOM-08: Lista y consulta dominios canónicos integrados mediante IPC", () => {
    const domains = domainRegistry.listDomains();
    expect(domains.length).toBe(5);

    const rawReq = { domainId: "engineering" };
    const parseResult = DomainGetSchema.safeParse(rawReq);
    expect(parseResult.success).toBe(true);

    const domain = domainRegistry.getDomain(parseResult.data!.domainId);
    expect(domain?.id).toBe("engineering");
    expect(domain?.defaultSubEgoId).toBe("ego.dev");
  });

  it("DOM-08: Transmuta vista al cambiar de dominio (DomainSwitchSchema)", () => {
    const rawReq = { domainId: "product", viewId: "kanban" };
    const parseResult = DomainSwitchSchema.safeParse(rawReq);
    expect(parseResult.success).toBe(true);

    const domain = domainRegistry.getDomain(parseResult.data!.domainId);
    expect(domain).toBeDefined();

    const view = domain?.views.find((v) => v.id === parseResult.data!.viewId);
    expect(view?.id).toBe("kanban");
  });

  it("DOM-01: Procesa estado de ingeniería y detecta worktrees de Git", async () => {
    const rawReq = { workspaceRoot: process.cwd() };
    const parseResult = DomainEngineeringStatusSchema.safeParse(rawReq);
    expect(parseResult.success).toBe(true);

    const status = await engineeringDomain.getGitStatus(parseResult.data!.workspaceRoot!);
    expect(status.branch).toBeDefined();
    expect(typeof status.clean).toBe("boolean");
  });

  it("DOM-02: Gestiona ítems del backlog y épicas de producto", async () => {
    const createReq = {
      action: "create",
      payload: {
        title: "Tarea IPC",
        description: "Validación de contrato",
        priority: "p0",
      },
    };
    const parseCreate = DomainProductBacklogSchema.safeParse(createReq);
    expect(parseCreate.success).toBe(true);

    const item = await productDomain.createBacklogItem(parseCreate.data!.payload as any);
    expect(item.id).toBeDefined();
    expect(item.status).toBe("backlog");

    const updateReq = {
      action: "updateStatus",
      payload: { id: item.id, status: "in_progress" },
    };
    const parseUpdate = DomainProductBacklogSchema.safeParse(updateReq);
    expect(parseUpdate.success).toBe(true);

    const updated = await productDomain.updateBacklogItemStatus(item.id, "in_progress");
    expect(updated.status).toBe("in_progress");
  });

  it("DOM-03: Realiza búsqueda de facts en base de conocimiento", async () => {
    await knowledgeDomain.addFact({
      claim: "Ego adopta arquitectura de micro-núcleo y módulos",
      source: "arch.md",
      confidence: 0.9,
    });

    const searchReq = { query: "micro-núcleo", limit: 5 };
    const parseSearch = DomainKnowledgeSearchSchema.safeParse(searchReq);
    expect(parseSearch.success).toBe(true);

    const results = await knowledgeDomain.searchKnowledge(parseSearch.data!.query);
    expect(results.length).toBe(1);
    expect(results[0].claim).toContain("micro-núcleo");
  });

  it("DOM-04: Genera series temporales y distribución analítica", async () => {
    const req = { days: 7 };
    const parseResult = DomainAnalyticsSeriesSchema.safeParse(req);
    expect(parseResult.success).toBe(true);

    const series = await analyticsDomain.getTokensUsageSeries(parseResult.data!.days);
    expect(series.length).toBe(7);

    const dist = await analyticsDomain.getModelDistribution();
    expect(dist.length).toBeGreaterThan(0);
  });

  it("DOM-05: Administra deals y genera resumen del pipeline de ventas", async () => {
    const contact = await crmDomain.createContact({
      name: "Socio Estratégico",
      email: "socio@vanta.io",
    });

    const createDealReq = {
      action: "create",
      payload: {
        title: "Acuerdo de Distribución",
        valueUsd: 75000,
        contactId: contact.id,
        stage: "proposal",
        probabilityPct: 50,
      },
    };
    const parseDeal = DomainCrmDealsSchema.safeParse(createDealReq);
    expect(parseDeal.success).toBe(true);

    const deal = await crmDomain.createDeal(parseDeal.data!.payload as any);
    expect(deal.id).toBeDefined();

    const summary = await crmDomain.getPipelineSummary();
    expect(summary.totalPipelineUsd).toBe(75000);
    expect(summary.weightedPipelineUsd).toBe(37500);
  });
});
