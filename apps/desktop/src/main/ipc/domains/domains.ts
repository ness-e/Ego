/**
 * T3 (Ola 5) — Canal IPC `ipc.domains.*`.
 *
 * Un módulo por DOMINIO DE CANAL (el criterio que vigila el gate
 * `apps/desktop/test/ipc-modules-gate.test.ts`): el nombre del canal ya
 * codifica el dominio, así que la división no es arbitraria.
 */
import { ipcMain } from "electron";
import {
  DomainGetSchema,
  DomainSwitchSchema,
  DomainEngineeringStatusSchema,
  DomainProductBacklogSchema,
  DomainKnowledgeSearchSchema,
  DomainAnalyticsSeriesSchema,
  DomainCrmDealsSchema,
} from "../../../ipc/schema.js";
import {
  assertPathInScope,
  defaultWorkspaceRoot,
} from "../../path-scope.js";
import {
  DomainRegistry,
  EngineeringDomain,
  ProductDomain,
  KnowledgeDomain,
  AnalyticsDomain,
  CrmDomain,
  BacklogItemStatusSchema,
  DealStageSchema,
  type CreateBacklogItemInput,
  type CreateDealInput,
} from "@ego/domains";


import type { IpcDeps } from "../register-ipc.js";

/** Registra los canales `ipc.domains.*`. */
export function registerDomainsIpc(deps: IpcDeps): void {
  const {
    adapter,
    currentScopeDirs,
    graphRagEngine,
    hybridSearch,
  } = deps;

  const domainRegistry = new DomainRegistry();
  const engineeringDomain = new EngineeringDomain();
  const productDomain = new ProductDomain(adapter);
  const knowledgeDomain = new KnowledgeDomain({
    memory: adapter,
    graphRag: graphRagEngine,
    hybridSearch,
  });
  const analyticsDomain = new AnalyticsDomain(adapter);
  const crmDomain = new CrmDomain(adapter);

  ipcMain.handle("ipc.domains.list", async () => {
    return { ok: true, domains: domainRegistry.listDomains() };
  });

  ipcMain.handle("ipc.domains.get", async (_e, rawReq: unknown) => {
    const parseResult = DomainGetSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const domain = domainRegistry.getDomain(parseResult.data.domainId);
    if (!domain) {
      return { ok: false, error: `Dominio '${parseResult.data.domainId}' no encontrado.` };
    }
    return { ok: true, domain };
  });

  ipcMain.handle("ipc.domains.switch", async (_e, rawReq: unknown) => {
    const parseResult = DomainSwitchSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { domainId, viewId } = parseResult.data;
    const domain = domainRegistry.getDomain(domainId);
    if (!domain) {
      return { ok: false, error: `Dominio '${domainId}' no encontrado.` };
    }
    const activeView = viewId
      ? domain.views.find((v) => v.id === viewId) || domainRegistry.getDefaultView(domainId)
      : domainRegistry.getDefaultView(domainId);

    return {
      ok: true,
      domainId,
      activeViewId: activeView?.id || "default",
      defaultSubEgoId: domain.defaultSubEgoId,
    };
  });

  ipcMain.handle("ipc.domains.engineering.status", async (_e, rawReq: unknown) => {
    const parseResult = DomainEngineeringStatusSchema.safeParse(rawReq || {});
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    // T2 (EGO-FIND-26): `workspaceRoot` venía del renderer (untrusted) y se
    // escaneaba con `scanWorkspace` + `git status` + `listWorktrees` sobre
    // esa ruta → enumeración de cualquier directorio del SO. Fail-closed:
    // si el renderer pide una raíz, tiene que estar en el alcance.
    const requestedRoot = parseResult.data.workspaceRoot;
    let targetRoot = defaultWorkspaceRoot();
    if (requestedRoot) {
      const scopeVerdict = assertPathInScope(requestedRoot, currentScopeDirs(), "workspaceRoot");
      if (!scopeVerdict.ok) {
        return { ok: false, error: scopeVerdict.reason };
      }
      targetRoot = scopeVerdict.path;
    }
    const inspection = await engineeringDomain.scanWorkspace(targetRoot);
    const gitStatus = await engineeringDomain.getGitStatus(targetRoot);
    const worktrees = await engineeringDomain.getWorktreeManager().listWorktrees(targetRoot);

    return {
      ok: true,
      workspaceRoot: targetRoot,
      inspection,
      gitStatus,
      worktrees,
    };
  });

  ipcMain.handle("ipc.domains.product.backlog", async (_e, rawReq: unknown) => {
    const parseResult = DomainProductBacklogSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { action, payload } = parseResult.data;

    if (action === "create" && payload && typeof payload === "object" && !Array.isArray(payload)) {
      const item = await productDomain.createBacklogItem(payload as CreateBacklogItemInput);
      return { ok: true, item };
    } else if (action === "updateStatus" && payload && typeof payload === "object" && !Array.isArray(payload)) {
      const p = payload as { id: string; status: unknown };
      const parsedStatus = BacklogItemStatusSchema.safeParse(p.status);
      if (!parsedStatus.success) {
        throw new Error(`[IPC Security] Estado de backlog inválido: ${parsedStatus.error.message}`);
      }
      const item = await productDomain.updateBacklogItemStatus(p.id, parsedStatus.data);
      return { ok: true, item };
    } else {
      const items = await productDomain.listBacklogItems();
      const epics = await productDomain.listEpics();
      return { ok: true, items, epics };
    }
  });

  ipcMain.handle("ipc.domains.knowledge.search", async (_e, rawReq: unknown) => {
    const parseResult = DomainKnowledgeSearchSchema.safeParse(rawReq);
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const results = await knowledgeDomain.searchKnowledge(parseResult.data.query, {
      limit: parseResult.data.limit,
    });
    return { ok: true, results };
  });

  ipcMain.handle("ipc.domains.analytics.series", async (_e, rawReq: unknown) => {
    const parseResult = DomainAnalyticsSeriesSchema.safeParse(rawReq || {});
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const days = parseResult.data.days || 7;
    const series = await analyticsDomain.getTokensUsageSeries(days);
    const modelDistribution = await analyticsDomain.getModelDistribution();
    const namespaceStats = await analyticsDomain.getNamespaceStats();

    return {
      ok: true,
      series,
      modelDistribution,
      namespaceStats,
    };
  });

  ipcMain.handle("ipc.domains.crm.deals", async (_e, rawReq: unknown) => {
    const parseResult = DomainCrmDealsSchema.safeParse(rawReq || { action: "list" });
    if (!parseResult.success) {
      return { ok: false, error: parseResult.error.message };
    }
    const { action, payload } = parseResult.data;

    if (action === "create" && payload && typeof payload === "object" && !Array.isArray(payload)) {
      const deal = await crmDomain.createDeal(payload as CreateDealInput);
      return { ok: true, deal };
    } else if (action === "updateStage" && payload && typeof payload === "object" && !Array.isArray(payload)) {
      const p = payload as { id: string; stage: unknown };
      const parsedStage = DealStageSchema.safeParse(p.stage);
      if (!parsedStage.success) {
        throw new Error(`[IPC Security] Etapa de deal inválida: ${parsedStage.error.message}`);
      }
      const deal = await crmDomain.updateDealStage(p.id, parsedStage.data);
      return { ok: true, deal };
    } else if (action === "summary") {
      const summary = await crmDomain.getPipelineSummary();
      return { ok: true, summary };
    } else {
      const deals = await crmDomain.listDeals();
      const contacts = await crmDomain.listContacts();
      const summary = await crmDomain.getPipelineSummary();
      return { ok: true, deals, contacts, summary };
    }
  });
}
