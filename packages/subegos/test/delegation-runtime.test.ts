import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EgoMemoryAdapter, EgoPut } from "@ego/memory";
import { ToolRegistry } from "@ego/tools";
import { createDelegationRuntime } from "../src/DelegationRuntime.js";
import { createSubEgoManifest } from "../src/SubEgoManifest.js";
import type { SubEgoManifest } from "../src/types.js";

/**
 * EGO-FIND-22 (Ola 1 / A3 / T1) — Delegación de Sub-Egos: código muerto.
 *
 * `registerDelegationTools` solo se invocaba en tests y `new DelegationRouter`
 * no aparecía en `apps/desktop/src`. Este test fija el contrato del punto de
 * entrada único `createDelegationRuntime(deps)`: debe construir router +
 * registro + memoria compartida, registrar las tools de delegación en el
 * `ToolRegistry` y permitir el ciclo completo delegar→ejecutar→devolver
 * DENTRO del paquete (sin depender de `apps/desktop`).
 */

function makeStorage(): { storage: EgoMemoryAdapter; records: Map<string, unknown> } {
  const records = new Map<string, unknown>();
  const storage = {
    ready: true,
    init: vi.fn(async () => {}),
    put: vi.fn(async (item: EgoPut) => {
      records.set(`${item.namespace}:${item.key}`, item.payload);
    }),
    putMulti: vi.fn(async (items: EgoPut[]) => {
      for (const item of items) {
        records.set(`${item.namespace}:${item.key}`, item.payload);
      }
    }),
    get: vi.fn(async (namespace: string, key: string) => {
      return records.get(`${namespace}:${key}`) ?? null;
    }),
    delete: vi.fn(async (namespace: string, key: string) => {
      return records.delete(`${namespace}:${key}`);
    }),
    listSubEgos: vi.fn(async () => {
      const results: SubEgoManifest[] = [];
      for (const [k, v] of records.entries()) {
        if (k.startsWith("gov/sub_egos:")) results.push(v as SubEgoManifest);
      }
      return results;
    }),
    list: vi.fn(async (namespace: string) => {
      const results: Array<{ key: string; payload: unknown }> = [];
      for (const [k, v] of records.entries()) {
        if (k.startsWith(`${namespace}:`)) {
          results.push({ key: k.slice(namespace.length + 1), payload: v });
        }
      }
      return results;
    }),
    recordAudit: vi.fn(async () => {}),
  } as unknown as EgoMemoryAdapter;

  return { storage, records };
}

const TARGET_MANIFEST: SubEgoManifest = createSubEgoManifest({
  name: "Auditor",
  role: "Revisa código",
  instructions: "Analiza el código y reporta hallazgos.",
  capabilities: ["code_review"],
  tools: ["git_status"],
  creator: "user",
});

/** El núcleo del sistema: puede delegar en cualquier Sub-Ego. */
const NUCLEUS_MANIFEST: SubEgoManifest = {
  ...createSubEgoManifest({
    name: "Nucleus",
    role: "Orquestador",
    instructions: "Orquesta el sistema.",
    creator: "ego-nucleus",
  }),
  id: "ego.nucleus",
  permissions: ["*"],
};

describe("T1 — createDelegationRuntime: punto de entrada único (EGO-FIND-22)", () => {
  let storage: EgoMemoryAdapter;
  let records: Map<string, unknown>;
  let registry: ToolRegistry;

  beforeEach(() => {
    ({ storage, records } = makeStorage());
    registry = new ToolRegistry();
  });

  it("construye runtime + registro + memoria compartida + router", () => {
    const delegation = createDelegationRuntime({ storage, toolRegistry: registry });

    expect(delegation.runtime).toBeDefined();
    expect(delegation.registry).toBeDefined();
    expect(delegation.sharedMemory).toBeDefined();
    expect(delegation.router).toBeDefined();
  });

  it("registra las 6 tools de delegación en el ToolRegistry", () => {
    createDelegationRuntime({ storage, toolRegistry: registry });

    for (const name of [
      "delegate_task",
      "delegate_many",
      "delegation_steer",
      "delegation_stop",
      "delegation_list_active",
      "delegation_drain_steer",
    ]) {
      expect(registry.has(name)).toBe(true);
    }
  });

  it("no registra las tools si el registro se omite (uso granular)", () => {
    const delegation = createDelegationRuntime({ storage });
    expect(delegation.tools.length).toBe(6);
    expect(registry.count()).toBe(0);
  });

  it("ciclo completo: delegar → ejecutar → devolver salida estructurada", async () => {
    const delegation = createDelegationRuntime({
      storage,
      toolRegistry: registry,
      executor: async (instance, request) => ({
        summary: `Auditado por ${instance.manifest.id}`,
        findings: [`tarea: ${String((request as { task?: unknown }).task ?? "")}`],
        files: ["src/index.ts"],
        issues: [],
      }),
    });

    await delegation.registry.register(TARGET_MANIFEST);
    await delegation.registry.register(NUCLEUS_MANIFEST);
    delegation.runtime.registerManifest(TARGET_MANIFEST);
    delegation.runtime.registerManifest(NUCLEUS_MANIFEST);

    const tool = registry.get("delegate_task");
    expect(tool).toBeDefined();

    const result = (await tool!.execute(
      {
        goal: "Revisar el módulo de tools",
        context: "El módulo vive en packages/tools",
        targetEgoId: TARGET_MANIFEST.id,
        projectId: "proj-1",
        callerEgoId: "ego.nucleus",
      },
      { callId: "c1", sessionId: "s1", subEgoId: "ego.nucleus" }
    )) as { output: { summary: string; findings: string[] }; status: string };

    expect(result.status).toBe("completed");
    expect(result.output.summary).toContain(TARGET_MANIFEST.id);
    expect(result.output.findings.length).toBe(1);
  });

  it("la salida de la delegación queda publicada en la memoria compartida", async () => {
    const delegation = createDelegationRuntime({
      storage,
      toolRegistry: registry,
      executor: async () => ({ summary: "ok", findings: [], files: [], issues: [] }),
    });

    await delegation.registry.register(TARGET_MANIFEST);
    await delegation.registry.register(NUCLEUS_MANIFEST);
    delegation.runtime.registerManifest(TARGET_MANIFEST);
    delegation.runtime.registerManifest(NUCLEUS_MANIFEST);

    const tool = registry.get("delegate_task")!;
    const result = (await tool.execute(
      {
        goal: "g",
        context: "c",
        targetEgoId: TARGET_MANIFEST.id,
        projectId: "proj-2",
        callerEgoId: "ego.nucleus",
      },
      { callId: "c2", sessionId: "s1" }
    )) as { delegationId: string; output: unknown };

    const published = records.get(
      `projects/proj-2/shared:delegations/${result.delegationId}/output`
    );
    expect(published).toBeDefined();
  });

  it("rechaza una delegación a un Sub-Ego inexistente (fail-closed)", async () => {
    const delegation = createDelegationRuntime({
      storage,
      toolRegistry: registry,
      executor: async () => ({ summary: "ok", findings: [], files: [], issues: [] }),
    });

    const tool = registry.get("delegate_task")!;
    await expect(
      tool.execute(
        {
          goal: "g",
          context: "c",
          targetEgoId: "no.existe",
          projectId: "p",
          callerEgoId: "ego.nucleus",
        },
        { callId: "c3", sessionId: "s1" }
      )
    ).rejects.toThrow(/no encontrado/i);
  });

  it("el ejecutor por defecto (sin `executor`) devuelve una salida estructurada válida", async () => {
    const delegation = createDelegationRuntime({ storage, toolRegistry: registry });

    await delegation.registry.register(TARGET_MANIFEST);
    await delegation.registry.register(NUCLEUS_MANIFEST);
    delegation.runtime.registerManifest(TARGET_MANIFEST);
    delegation.runtime.registerManifest(NUCLEUS_MANIFEST);

    const tool = registry.get("delegate_task")!;
    const result = (await tool.execute(
      {
        goal: "g",
        context: "c",
        targetEgoId: TARGET_MANIFEST.id,
        projectId: "p",
        callerEgoId: "ego.nucleus",
      },
      { callId: "c4", sessionId: "s1" }
    )) as { status: string; output: unknown };

    expect(result.status).toBe("completed");
    expect(result.output).toBeDefined();
  });

  it("E13/T2: el ejecutor por defecto cumple el contrato `StructuredChildOutput`", async () => {
    // El contrato exige `{ summary, findings, files, issues }`. Si el
    // ejecutor por defecto devolviese otra forma, `delegate_task` fallaría
    // en la normalización de la salida (el bug que abrió esta ola).
    const delegation = createDelegationRuntime({ storage, toolRegistry: registry });

    await delegation.registry.register(TARGET_MANIFEST);
    await delegation.registry.register(NUCLEUS_MANIFEST);
    delegation.runtime.registerManifest(TARGET_MANIFEST);
    delegation.runtime.registerManifest(NUCLEUS_MANIFEST);

    const tool = registry.get("delegate_task")!;
    const result = (await tool.execute(
      {
        goal: "Audita el módulo de auth",
        context: "Contexto autocontenido para la auditoría.",
        targetEgoId: TARGET_MANIFEST.id,
        projectId: "p",
        callerEgoId: "ego.nucleus",
      },
      { callId: "c5", sessionId: "s1" }
    )) as { status: string; output: unknown };

    expect(result.status).toBe("completed");

    const output = result.output as {
      summary?: unknown;
      findings?: unknown;
      files?: unknown;
      issues?: unknown;
    };
    expect(typeof output.summary).toBe("string");
    expect((output.summary as string).length).toBeGreaterThan(0);
    expect(Array.isArray(output.findings)).toBe(true);
    expect(Array.isArray(output.files)).toBe(true);
    expect(Array.isArray(output.issues)).toBe(true);
  });

  it("`dispose` libera el runtime y es idempotente", async () => {
    const delegation = createDelegationRuntime({ storage, toolRegistry: registry });
    await delegation.dispose();
    await expect(delegation.dispose()).resolves.toBeUndefined();
  });
});
