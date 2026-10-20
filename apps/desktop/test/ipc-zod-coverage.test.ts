import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readMainSource } from "./helpers/main-source.js";
import {
  ChatStreamSchema,
  DecisionListAuditsSchema,
  KnowledgeExportSchema,
  KnowledgeImportSchema,
  DailyGetSnapshotSchema,
  DailyListSnapshotsSchema,
  PermissionsSettingsSchema,
  McpServerConfigSchema,
  SessionForkSchema,
  SessionHandoffSchema,
  HookEvaluateSchema,
} from "../src/ipc/schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const mainSrc = readMainSource();

function handlerBlock(channel: string): string {
  const idx = mainSrc.indexOf(`ipcMain.handle("${channel}"`);
  expect(idx).toBeGreaterThan(-1);
  const next = mainSrc.indexOf("ipcMain.handle(", idx + 16);
  return mainSrc.slice(idx, next === -1 ? idx + 1500 : next);
}

describe("SEC-02 — cobertura total de validación Zod en handlers IPC", () => {
  it("inventario: los handlers con argumento validan con Zod; los sin argumento no reciben input", () => {
    const validated: Array<[string, string]> = [
      ["ipc.memory", "MemoryOpSchema"],
      ["ipc.subegos.create", "CreateSubEgoSchema"],
      ["ipc.subegos.toggleState", "ToggleSubEgoStateSchema"],
      ["ipc.approval.resolve", "ResolveApprovalSchema"],
      ["ipc.gov.approve", "ApproveActionSchema"],
      // ipc.llm.stream: delega en handleLlmStream (verificado abajo)
      ["ipc.mcp.addServer", "AddMcpServerSchema"],
      ["ipc.mcp.removeServer", "RemoveMcpServerSchema"],
      ["ipc.mcp.toggleServer", "ToggleMcpServerSchema"],
      ["ipc.mcp.listTools", "ListToolsFilterSchema"],
      ["ipc.skills.listLocal", "ScanSkillsSchema"],
      ["ipc.projects.create", "CreateProjectSchema"],
      ["ipc.projects.select", "SelectProjectSchema"],
      ["ipc.settings.saveModelConfig", "ModelConfigSchema"],
      ["ipc.settings.savePermissions", "PermissionsSettingsSchema"],
      ["ipc.decision.evaluate", "IntentRequestSchema"],
      ["ipc.decision.listAudits", "DecisionListAuditsSchema"],
      ["ipc.knowledge.ingest", "KnowledgeIngestSchema"],
      ["ipc.knowledge.hybridSearch", "KnowledgeHybridSearchSchema"],
      ["ipc.knowledge.graphRag", "KnowledgeGraphRagSchema"],
      ["ipc.knowledge.quarantine", "KnowledgeQuarantineActionSchema"],
      ["ipc.knowledge.asOf", "KnowledgeAsOfSchema"],
      ["ipc.knowledge.explainArtifact", "KnowledgeExplainArtifactSchema"],
      ["ipc.knowledge.export", "KnowledgeExportSchema"],
      ["ipc.knowledge.import", "KnowledgeImportSchema"],
      ["ipc.daily.getSummary", "DailyStateGetSummarySchema"],
      ["ipc.daily.refineGoals", "DailyStateRefineGoalsSchema"],
      ["ipc.daily.getDecisions", "DailyStateGetDecisionsSchema"],
      ["ipc.daily.getSnapshot", "DailyGetSnapshotSchema"],
      ["ipc.daily.listSnapshots", "DailyListSnapshotsSchema"],
      ["ipc.daily.isFirstLaunch", "DailyStateFirstLaunchSchema"],
      ["ipc.daily.journal", "DailyStateJournalSchema"],
      ["ipc.daily.resolveApprovalsBatch", "DailyStateResolveApprovalsBatchSchema"],
      ["ipc.domains.get", "DomainGetSchema"],
      ["ipc.domains.switch", "DomainSwitchSchema"],
      ["ipc.domains.engineering.status", "DomainEngineeringStatusSchema"],
      ["ipc.domains.product.backlog", "DomainProductBacklogSchema"],
      ["ipc.domains.knowledge.search", "DomainKnowledgeSearchSchema"],
      ["ipc.domains.analytics.series", "DomainAnalyticsSeriesSchema"],
      ["ipc.domains.crm.deals", "DomainCrmDealsSchema"],
      // Fork de sesión + handoff (STAB-12; doble validación: input + handoff)
      ["ipc.sessions.fork", "SessionForkSchema"],
      // Hooks CFG-09 + STAB-12 (veredictos/estado en main, fail-closed)
      ["ipc.hooks.evaluatePreToolUse", "HookEvaluateSchema"],
      ["ipc.hooks.recordPostToolUse", "HookEvaluateSchema"],
    ];
    for (const [channel, schema] of validated) {
      const block = handlerBlock(channel);
      expect(block, `${channel} debe invocar ${schema}.safeParse`).toContain(
        `${schema}.safeParse`
      );
    }
    // ipc.llm.stream delega en handleLlmStream (misma unidad de compilación):
    // el bloque delega y la función valida.
    const llmBlock = handlerBlock("ipc.llm.stream");
    expect(llmBlock).toContain("handleLlmStream");
    const fnIdx = mainSrc.indexOf("export async function handleLlmStream");
    expect(fnIdx).toBeGreaterThan(-1);
    expect(mainSrc.slice(fnIdx, fnIdx + 800)).toContain("ChatStreamSchema.safeParse");
    const noArg = [
      "ipc.subegos.list",
      "ipc.subegos.getTemplates",
      "ipc.mcp.listServers",
      "ipc.projects.list",
      "ipc.projects.getActive",
      "ipc.projects.selectFolder",
      "ipc.snapshots",
      "ipc.settings.getModelConfig",
      "ipc.settings.getPermissions",
      "ipc.decision.telemetry",
      "ipc.domains.list",
      "ipc.daily.saveSnapshot",
      "ipc.hooks.getStatus",
    ];
    for (const channel of noArg) {
      const block = handlerBlock(channel);
      expect(block, `${channel} no debe recibir payload del renderer`).not.toMatch(
        /rawReq|rawPayload|limit\?: unknown|date: unknown|projectId\?: unknown|pkg: unknown|limit: unknown/
      );
    }
  });

  it("adversarial: DecisionListAuditsSchema rechaza límites maliciosos", () => {
    expect(DecisionListAuditsSchema.safeParse(undefined).success).toBe(true);
    expect(DecisionListAuditsSchema.safeParse(10).success).toBe(true);
    expect(DecisionListAuditsSchema.safeParse(500).success).toBe(true);
    for (const evil of [-1, 0, 501, 1e15, Number.NaN, Number.POSITIVE_INFINITY, "10", null, {}, [10]]) {
      expect(DecisionListAuditsSchema.safeParse(evil).success, `límite ${String(evil)} debe rechazarse`).toBe(false);
    }
  });

  it("adversarial: DailyListSnapshotsSchema rechaza límites maliciosos", () => {
    expect(DailyListSnapshotsSchema.safeParse(undefined).success).toBe(true);
    expect(DailyListSnapshotsSchema.safeParse(30).success).toBe(true);
    for (const evil of [-5, 0, 10_000, Number.NaN, Number.POSITIVE_INFINITY, "30", null]) {
      expect(DailyListSnapshotsSchema.safeParse(evil).success, `límite ${String(evil)} debe rechazarse`).toBe(false);
    }
  });

  it("adversarial: DailyGetSnapshotSchema solo acepta fecha YYYY-MM-DD o ausente", () => {
    expect(DailyGetSnapshotSchema.safeParse(undefined).success).toBe(true);
    expect(DailyGetSnapshotSchema.safeParse("2026-10-13").success).toBe(true);
    for (const evil of ["", "ayer", "2026/10/13", "2026-13-99", "../../etc/passwd", 20261013, null, {}]) {
      expect(DailyGetSnapshotSchema.safeParse(evil).success, `fecha ${String(evil)} debe rechazarse`).toBe(false);
    }
  });

  it("adversarial: KnowledgeExportSchema solo acepta projectId no vacío o ausente", () => {
    expect(KnowledgeExportSchema.safeParse(undefined).success).toBe(true);
    expect(KnowledgeExportSchema.safeParse("default").success).toBe(true);
    for (const evil of ["", 123, null, {}, []]) {
      expect(KnowledgeExportSchema.safeParse(evil).success, `projectId ${String(evil)} debe rechazarse`).toBe(false);
    }
  });

  it("adversarial: KnowledgeImportSchema rechaza paths (lectura arbitraria) y paquetes malformados", () => {
    const valid = {
      version: "1.0.0",
      projectId: "default",
      exportedAt: 1700000000000,
      checksum: "abc123",
      totalRecords: 1,
      records: [{ namespace: "kb/docs", key: "k1", payload: "hola" }],
    };
    expect(KnowledgeImportSchema.safeParse(valid).success).toBe(true);
    const evils: unknown[] = [
      "/etc/passwd",
      "C:\\Windows\\win.ini",
      "",
      null,
      undefined,
      [],
      {},
      { ...valid, checksum: "" },
      { ...valid, records: "no-array" },
      { ...valid, records: [{ namespace: "", key: "k", payload: 1 }] },
      { ...valid, records: [{ namespace: "kb/docs", key: "", payload: 1 }] },
      { ...valid, version: "" },
      { ...valid, projectId: "" },
    ];
    for (const evil of evils) {
      expect(KnowledgeImportSchema.safeParse(evil).success, `paquete ${JSON.stringify(evil)?.slice(0, 80)} debe rechazarse`).toBe(false);
    }
  });

  it("adversarial: backlog/CRM rechazan payload array (bypass de typeof object)", () => {
    for (const channel of ["ipc.domains.product.backlog", "ipc.domains.crm.deals"]) {
      const block = handlerBlock(channel);
      expect(block, `${channel} debe rechazar arrays en payload`).toContain("Array.isArray(payload)");
    }
  });

  it("STAB-12 adversarial: McpServerConfig http exige url https sin credenciales ni auth-header", () => {
    const httpOk = {
      id: "r1",
      name: "Remoto",
      transport: "streamable-http",
      command: "npx",
      url: "https://mcp.example.com/rpc",
      headers: { "X-Api-Key": "publico" },
    };
    expect(McpServerConfigSchema.safeParse(httpOk).success).toBe(true);
    const evils: unknown[] = [
      { ...httpOk, url: undefined },
      { ...httpOk, url: "http://mcp.example.com/rpc" },
      // Nota: el bloqueo de hosts (localhost/privadas/metadata) vive en
      // `assertSafeMcpHttpUrl`+NetPolicy (manager/cliente), probado en
      // `McpHttp.test.ts` #2; el schema valida forma (https/creds/headers).
      { ...httpOk, url: "https://user:pass@mcp.example.com/rpc" },
      { ...httpOk, url: "not-a-url" },
      { ...httpOk, headers: { Authorization: "Bearer x" } },
      { ...httpOk, headers: { "Proxy-Authorization": "Basic x" } },
    ];
    for (const evil of evils) {
      expect(McpServerConfigSchema.safeParse(evil).success, "config http insegura debe rechazarse").toBe(false);
    }
    // stdio intacto (sin url) + sse intacto
    expect(McpServerConfigSchema.safeParse({ id: "s", name: "L", command: "node" }).success).toBe(true);
  });

  it("STAB-12 adversarial: SessionFork/Handoff/HookEvaluate rechazan input malformado", () => {
    const forkOk = { fromSessionId: "s1", toSessionId: "s2", summary: "handoff" };
    expect(SessionForkSchema.safeParse(forkOk).success).toBe(true);
    for (const evil of [
      { ...forkOk, fromSessionId: "" },
      { ...forkOk, summary: "" },
      { ...forkOk, toSessionId: "s1".repeat(200) },
      null,
      {},
    ]) {
      expect(SessionForkSchema.safeParse(evil).success, "fork inválido debe rechazarse").toBe(false);
    }
    expect(
      SessionHandoffSchema.safeParse({ ...forkOk, checkpointId: "chk_1", copiedTurns: 2, createdAtMs: 7 }).success
    ).toBe(true);
    expect(
      SessionHandoffSchema.safeParse({ ...forkOk, copiedTurns: 0, createdAtMs: 7 }).success,
      "handoff sin checkpoint debe rechazarse"
    ).toBe(false);
    expect(HookEvaluateSchema.safeParse({ toolName: "fs_read_file" }).success).toBe(true);
    expect(HookEvaluateSchema.safeParse({ toolName: "" }).success).toBe(false);
    expect(HookEvaluateSchema.safeParse({}).success).toBe(false);
  });

  it("T01 — ChatStreamSchema acepta prompt+projectId+subEgoId (contrato canónico)", () => {
    const r = ChatStreamSchema.safeParse({ prompt: "hola", projectId: "p1", subEgoId: "s1" });
    expect(r.success, "schema rechaza projectId/subEgoId").toBe(true);
  });

  it("T01 — LlmStreamBridgeRequest iguala al schema (projectId/subEgoId, type-level)", () => {
    const preloadSrc = readFileSync(join(here, "..", "src", "preload.ts"), "utf-8");
    const start = preloadSrc.indexOf("export interface LlmStreamBridgeRequest");
    expect(start, "LlmStreamBridgeRequest debe existir en preload.ts").toBeGreaterThan(-1);
    const end = preloadSrc.indexOf("}", start);
    const block = preloadSrc.slice(start, end);
    expect(block, "preload omite projectId que schema+ego.ts+ego-chat usan").toContain("projectId");
    expect(block, "preload omite subEgoId que schema+ego.ts+ego-chat usan").toContain("subEgoId");
  });

  it("T01 — preload memory() unificado a (op, args) como EgoBridge", () => {
    const preloadSrc = readFileSync(join(here, "..", "src", "preload.ts"), "utf-8");
    expect(preloadSrc, "EgoPreloadBridge.memory debe unificarse a (op, args)").toContain(
      "memory: (op: string, args: unknown[])"
    );
  });
});
