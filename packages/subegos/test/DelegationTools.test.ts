import { describe, it, expect, beforeEach } from "vitest";
import { SubEgoRuntime } from "../src/SubEgoRuntime.js";
import { createSubEgoManifest } from "../src/SubEgoManifest.js";
import {
  DelegationRouter,
  DelegationValidationError,
  DelegationBlockedToolError,
  DelegationCycleError,
  type StructuredChildOutput,
} from "../src/DelegationRouter.js";
import {
  createDelegationTools,
  registerDelegationTools,
  DELEGATION_TOOL_NAMES,
  type DelegationToolOptions,
} from "../src/DelegationTools.js";
import { ToolRegistry } from "@ego/tools";
import type { ToolDefinition, ToolExecutionContext } from "@ego/tools";

function baseContext(extra?: Record<string, unknown>): ToolExecutionContext {
  return {
    callId: "call_test_1",
    sessionId: "sess_test_1",
    projectId: "proj-test",
    subEgoId: "ego.nucleus",
    ...(extra ? { extra } : {}),
  };
}

function structured(summary = "Hecho"): StructuredChildOutput {
  return { summary, findings: ["f1"], files: ["a.ts"], issues: [] };
}

describe("DelegationTools — delegate_task fin-a-fin como tools (STAB-04)", () => {
  let runtime: SubEgoRuntime;
  let router: DelegationRouter;

  beforeEach(() => {
    runtime = new SubEgoRuntime({ idleTtlMs: 5000 });
    const nucleus = createSubEgoManifest({
      name: "Ego Nucleus",
      role: "Orquestador General",
      instructions: "Orquestar tareas y coordinar especialistas del sistema.",
      permissions: ["delegate:*"],
    });
    nucleus.id = "ego.nucleus";
    const mkWorker = (id: string) => {
      const m = createSubEgoManifest({
        name: id,
        role: "Worker",
        instructions: "Ejecutar subtareas específicas con salida estructurada.",
        permissions: [],
      });
      m.id = id;
      return m;
    };
    runtime.registerManifest(nucleus);
    runtime.registerManifest(mkWorker("ego.worker-a"));
    runtime.registerManifest(mkWorker("ego.worker-b"));
    router = new DelegationRouter({
      runtime,
      executor: async () => structured(),
    });
  });

  it("registra las 6 tools con nombres canónicos snake_case", () => {
    const registered: ToolDefinition[] = [];
    registerDelegationTools({ register: (t: ToolDefinition) => void registered.push(t) }, router);
    expect(registered.map((t) => t.name).sort()).toEqual([...DELEGATION_TOOL_NAMES].sort());
    expect(DELEGATION_TOOL_NAMES).toEqual([
      "delegate_task",
      "delegate_many",
      "delegation_steer",
      "delegation_stop",
      "delegation_list_active",
      "delegation_drain_steer",
    ]);
  });

  it("createDelegationTools devuelve definiciones válidas (inputSchema safeParse)", () => {
    const tools = createDelegationTools(router);
    for (const t of tools) {
      expect(t.name).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(t.description.trim().length).toBeGreaterThan(0);
      expect(typeof t.execute).toBe("function");
    }
    const delegate = tools.find((t) => t.name === "delegate_task")!;
    expect(delegate.inputSchema.safeParse({}).success).toBe(false);
    expect(
      delegate.inputSchema.safeParse({ goal: "", context: "ctx", targetEgoId: "ego.worker-a" }).success,
    ).toBe(false);
    expect(
      delegate.inputSchema.safeParse({ goal: "g", context: "c", targetEgoId: "ego.worker-a" }).success,
    ).toBe(true);
  });

  it("delegate_task ejecuta fin-a-fin y retorna salida estructurada normalizada", async () => {
    const [delegate] = createDelegationTools(router).filter((t) => t.name === "delegate_task");
    const res = (await delegate.execute(
      { goal: "Auditar auth", context: "Repo en /tmp/x, rama feat/auth", targetEgoId: "ego.worker-a" },
      baseContext(),
    )) as { output: StructuredChildOutput; callerEgoId: string; targetEgoId: string; status: string };
    expect(res.status).toBe("completed");
    expect(res.callerEgoId).toBe("ego.nucleus");
    expect(res.targetEgoId).toBe("ego.worker-a");
    expect(res.output.summary).toBe("Hecho");
    expect(res.output.findings).toEqual(["f1"]);
  });

  it("delegate_task rechaza goal/context en blanco (validate)", async () => {
    const [delegate] = createDelegationTools(router).filter((t) => t.name === "delegate_task");
    await expect(
      delegate.execute({ goal: "   ", context: "ctx", targetEgoId: "ego.worker-a" }, baseContext()),
    ).rejects.toThrow(DelegationValidationError);
    await expect(
      delegate.execute({ goal: "g", context: "  ", targetEgoId: "ego.worker-a" }, baseContext()),
    ).rejects.toThrow(DelegationValidationError);
  });

  it("delegate_task falla cerrado sin projectId (sin default silencioso)", async () => {
    const [delegate] = createDelegationTools(router).filter((t) => t.name === "delegate_task");
    const ctx = baseContext();
    delete (ctx as { projectId?: string }).projectId;
    await expect(
      delegate.execute({ goal: "g", context: "c", targetEgoId: "ego.worker-a" }, ctx),
    ).rejects.toThrow(DelegationValidationError);
  });

  it("delegate_task resuelve callerEgoId desde ctx.subEgoId", async () => {
    const [delegate] = createDelegationTools(router).filter((t) => t.name === "delegate_task");
    const res = (await delegate.execute(
      { goal: "g", context: "c", targetEgoId: "ego.worker-a" },
      baseContext(),
    )) as { callerEgoId: string };
    expect(res.callerEgoId).toBe("ego.nucleus");
  });

  it("delegate_task bloquea a un hijo leaf (BLOCKED_CHILD_TOOLS, pre-router)", async () => {
    const [delegate] = createDelegationTools(router).filter((t) => t.name === "delegate_task");
    await expect(
      delegate.execute(
        { goal: "g", context: "c", targetEgoId: "ego.worker-a" },
        baseContext({ childRole: "leaf" }),
      ),
    ).rejects.toThrow(DelegationBlockedToolError);
    expect(runtime.isLoaded("ego.worker-a")).toBe(false);
  });

  it("delegate_task rechaza rol orchestrator con maxSpawnDepth 0", async () => {
    const [delegate] = createDelegationTools(router).filter((t) => t.name === "delegate_task");
    await expect(
      delegate.execute(
        { goal: "g", context: "c", targetEgoId: "ego.worker-a", role: "orchestrator" },
        baseContext(),
      ),
    ).rejects.toThrow(DelegationValidationError);
  });

  it("delegate_task propaga parentContext y respeta DelegationCycleError", async () => {
    const [delegate] = createDelegationTools(router).filter((t) => t.name === "delegate_task");
    await expect(
      delegate.execute(
        { goal: "g", context: "c", targetEgoId: "ego.nucleus" },
        baseContext({
          delegationParentContext: { depth: 1, callChain: ["ego.nucleus", "ego.worker-a"] },
        }),
      ),
    ).rejects.toThrow(DelegationCycleError);
  });

  it("delegate_task rechaza salida no estructurada del executor (normalize)", async () => {
    const badRouter = new DelegationRouter({ runtime, executor: async () => "texto plano" });
    const [delegate] = createDelegationTools(badRouter).filter((t) => t.name === "delegate_task");
    await expect(
      delegate.execute({ goal: "g", context: "c", targetEgoId: "ego.worker-a" }, baseContext()),
    ).rejects.toThrow(DelegationValidationError);
  });

  it("delegate_many ejecuta N hijos con orden preservado y salidas normalizadas", async () => {
    const tools = createDelegationTools(router);
    const many = tools.find((t) => t.name === "delegate_many")!;
    const res = (await many.execute(
      {
        items: [
          { goal: "t1", context: "c1", targetEgoId: "ego.worker-a" },
          { goal: "t2", context: "c2", targetEgoId: "ego.worker-b" },
        ],
        maxConcurrency: 2,
      },
      baseContext(),
    )) as Array<{ targetEgoId: string; output: StructuredChildOutput }>;
    expect(res).toHaveLength(2);
    expect(res[0].targetEgoId).toBe("ego.worker-a");
    expect(res[1].targetEgoId).toBe("ego.worker-b");
    for (const r of res) expect(r.output.summary).toBe("Hecho");
  });

  it("delegate_many acota concurrencia y valida todo antes de ejecutar", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const slowRouter = new DelegationRouter({
      runtime,
      executor: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 20));
        inFlight -= 1;
        return structured();
      },
    });
    const many = createDelegationTools(slowRouter).find((t) => t.name === "delegate_many")!;
    const res = (await many.execute(
      {
        items: [
          { goal: "t1", context: "c1", targetEgoId: "ego.worker-a" },
          { goal: "t2", context: "c2", targetEgoId: "ego.worker-b" },
          { goal: "t3", context: "c3", targetEgoId: "ego.worker-a" },
        ],
        maxConcurrency: 1,
      },
      baseContext(),
    )) as unknown[];
    expect(res).toHaveLength(3);
    expect(maxInFlight).toBeLessThanOrEqual(1);
    await expect(
      many.execute({ items: [{ goal: "", context: "c", targetEgoId: "ego.worker-a" }] }, baseContext()),
    ).rejects.toThrow(DelegationValidationError);
  });

  it("delegation_steer + delegation_drain_steer encolan y consumen out-of-band", async () => {
    const tools = createDelegationTools(router);
    const steer = tools.find((t) => t.name === "delegation_steer")!;
    const drain = tools.find((t) => t.name === "delegation_drain_steer")!;
    expect(await steer.execute({ delegationId: "del_x", instruction: "Prioriza tests" }, baseContext())).toBe(
      true,
    );
    expect(await drain.execute({ delegationId: "del_x" }, baseContext())).toEqual(["Prioriza tests"]);
    expect(await drain.execute({ delegationId: "del_x" }, baseContext())).toEqual([]);
  });

  it("delegation_stop + delegation_list_active controlan el árbol vivo", async () => {
    const tools = createDelegationTools(router);
    const stop = tools.find((t) => t.name === "delegation_stop")!;
    const list = tools.find((t) => t.name === "delegation_list_active")!;
    expect(await stop.execute({ delegationId: "del_y" }, baseContext())).toBe(false);
    const all = (await list.execute({}, baseContext())) as Array<{ delegationId: string }>;
    expect(all.some((r) => r.delegationId === "del_y")).toBe(true);
  });

  it("respeta DelegationToolOptions: maxConcurrency inválido cae al default", async () => {
    const opts: DelegationToolOptions = { maxConcurrency: 0 };
    const tools = createDelegationTools(router, opts);
    const many = tools.find((t) => t.name === "delegate_many")!;
    const res = (await many.execute(
      { items: [{ goal: "t1", context: "c1", targetEgoId: "ego.worker-a" }] },
      baseContext(),
    )) as unknown[];
    expect(res).toHaveLength(1);
  });

  it("dispatch fin-a-fin vía ToolRegistry (mismo camino que ToolExecutionLoop.run)", async () => {
    const registry = new ToolRegistry();
    registerDelegationTools(registry, router);
    expect(registry.has("delegate_task")).toBe(true);
    const raw = { goal: "Auditar auth", context: "Repo en /tmp/x", targetEgoId: "ego.worker-a" };
    const validation = registry.validateInput("delegate_task", raw);
    expect(validation.success).toBe(true);
    const tool = registry.get("delegate_task")!;
    const res = (await tool.execute(
      validation.success ? validation.data : raw,
      baseContext(),
    )) as { status: string; output: StructuredChildOutput };
    expect(res.status).toBe("completed");
    expect(res.output.summary).toBe("Hecho");
    const bad = registry.validateInput("delegate_task", { goal: "", context: "c" });
    expect(bad.success).toBe(false);
  });
});
