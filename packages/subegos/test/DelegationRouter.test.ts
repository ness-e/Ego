import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { EgoMemoryAdapter } from "@ego/memory";
import {
  createSubEgoManifest,
  SubEgoRuntime,
  SubEgoRegistry,
  SharedMemory,
  DelegationRouter,
  DelegationNotFoundError,
  DelegationPermissionError,
  DelegationMaxDepthError,
  DelegationCycleError,
  DelegationTimeoutError
} from "../src/index.js";
import type { SubEgoManifest } from "../src/types.js";

describe("DelegationRouter — Comunicación y Delegación Inter-Sub-Ego (SUB-06)", () => {
  let tmpDir: string;
  let adapter: EgoMemoryAdapter;
  let runtime: SubEgoRuntime;
  let registry: SubEgoRegistry;
  let sharedMemory: SharedMemory;

  let nucleusManifest: SubEgoManifest;
  let reviewerManifest: SubEgoManifest;
  let restrictedManifest: SubEgoManifest;
  let workerManifest: SubEgoManifest;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `ego-delegation-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(tmpDir, { recursive: true });

    adapter = new EgoMemoryAdapter(tmpDir);
    await adapter.init();

    runtime = new SubEgoRuntime({ idleTtlMs: 5000 });
    registry = new SubEgoRegistry(adapter);
    sharedMemory = new SharedMemory(adapter);

    // 1. Manifiesto Núcleo con permisos universales de delegación
    nucleusManifest = createSubEgoManifest({
      name: "Ego Nucleus",
      role: "Orquestador General",
      instructions: "Orquestar tareas y coordinar especialistas.",
      permissions: ["delegate:*", "memory:shared:write"]
    });
    nucleusManifest.id = "ego.nucleus";

    // 2. Especialista Revisor con permiso para delegar en worker
    reviewerManifest = createSubEgoManifest({
      name: "Code Reviewer",
      role: "Auditor Técnico",
      instructions: "Revisar código fuente.",
      permissions: ["delegate:ego.worker", "filesystem:read"]
    });
    reviewerManifest.id = "ego.code-reviewer";

    // 3. Sub-Ego sin permisos de delegación
    restrictedManifest = createSubEgoManifest({
      name: "Restricted Ego",
      role: "Agente Aislado",
      instructions: "Operar de forma totalmente aislada.",
      permissions: ["filesystem:read"]
    });
    restrictedManifest.id = "ego.restricted";

    // 4. Worker de soporte
    workerManifest = createSubEgoManifest({
      name: "Worker Ego",
      role: "Ejecutor de Tareas",
      instructions: "Ejecutar subtareas específicas.",
      permissions: ["delegate:ego.worker2"]
    });
    workerManifest.id = "ego.worker";

    // Registrar en runtime
    runtime.registerManifest(nucleusManifest);
    runtime.registerManifest(reviewerManifest);
    runtime.registerManifest(restrictedManifest);
    runtime.registerManifest(workerManifest);
  });

  afterEach(async () => {
    await adapter.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("1. Delegación Básica y Ciclo de Vida (Step 1)", () => {
    it("debe delegar con éxito de un orquestador a un especialista y retornar resultado", async () => {
      const router = new DelegationRouter({ runtime });

      const result = await router.delegate({
        projectId: "proj-alpha",
        callerEgoId: "ego.nucleus",
        targetEgoId: "ego.code-reviewer",
        task: "Auditar módulo de autenticación",
        input: { prNumber: 42, branch: "feat/auth" }
      });

      expect(result.status).toBe("completed");
      expect(result.callerEgoId).toBe("ego.nucleus");
      expect(result.targetEgoId).toBe("ego.code-reviewer");
      expect(result.depth).toBe(1);
      expect(result.callChain).toEqual(["ego.nucleus", "ego.code-reviewer"]);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.output).toBeDefined();

      // Verificar que la instancia reside en RAM y actualizó su actividad
      expect(runtime.isLoaded("ego.code-reviewer")).toBe(true);
      const instance = runtime.getInstance("ego.code-reviewer");
      expect(instance?.totalTurnsExecuted).toBe(1);
    });

    it("debe permitir que 'system' o 'user' deleguen sin requerir manifiesto de emisor", async () => {
      const router = new DelegationRouter({ runtime });

      const fromSystem = await router.delegate({
        projectId: "proj-alpha",
        callerEgoId: "system",
        targetEgoId: "ego.code-reviewer",
        task: "Verificación de inicio de sistema",
        input: {}
      });
      expect(fromSystem.status).toBe("completed");
      expect(fromSystem.callerEgoId).toBe("system");

      const fromUser = await router.delegate({
        projectId: "proj-alpha",
        callerEgoId: "user",
        targetEgoId: "ego.code-reviewer",
        task: "Instrucción directa del usuario",
        input: {}
      });
      expect(fromUser.status).toBe("completed");
      expect(fromUser.callerEgoId).toBe("user");
    });

    it("debe rechazar la delegación si el Sub-Ego destino no existe", async () => {
      const router = new DelegationRouter({ runtime });

      await expect(
        router.delegate({
          projectId: "proj-alpha",
          callerEgoId: "ego.nucleus",
          targetEgoId: "ego.inexistente",
          task: "Tarea fantasma",
          input: {}
        })
      ).rejects.toThrow(DelegationNotFoundError);
    });
  });

  describe("2. Validación Estricta de Permisos de Delegación (Step 2)", () => {
    it("debe bloquear la delegación si el emisor no posee permisos de delegación", async () => {
      const router = new DelegationRouter({ runtime });

      await expect(
        router.delegate({
          projectId: "proj-alpha",
          callerEgoId: "ego.restricted",
          targetEgoId: "ego.code-reviewer",
          task: "Intento de escalamiento no autorizado",
          input: {}
        })
      ).rejects.toThrow(DelegationPermissionError);
    });

    it("debe permitir delegar si el emisor tiene permiso específico hacia el target", async () => {
      const router = new DelegationRouter({ runtime });

      // ego.code-reviewer tiene 'delegate:ego.worker'
      const result = await router.delegate({
        projectId: "proj-alpha",
        callerEgoId: "ego.code-reviewer",
        targetEgoId: "ego.worker",
        task: "Ejecutar linter",
        input: { files: ["index.ts"] }
      });

      expect(result.status).toBe("completed");
      expect(result.callerEgoId).toBe("ego.code-reviewer");
      expect(result.targetEgoId).toBe("ego.worker");
    });

    it("debe rechazar la delegación si el emisor tiene permiso para otro agente pero no para el target", async () => {
      const router = new DelegationRouter({ runtime });

      // ego.code-reviewer solo tiene permiso para 'ego.worker', no para 'ego.nucleus'
      await expect(
        router.delegate({
          projectId: "proj-alpha",
          callerEgoId: "ego.code-reviewer",
          targetEgoId: "ego.nucleus",
          task: "Llamada inversa no autorizada",
          input: {}
        })
      ).rejects.toThrow(DelegationPermissionError);
    });
  });

  describe("3. Prevención de Ciclos y Control de Profundidad (Step 3)", () => {
    it("debe detectar y bloquear inmediatamente la auto-delegación (A -> A)", async () => {
      const router = new DelegationRouter({ runtime });

      await expect(
        router.delegate({
          projectId: "proj-alpha",
          callerEgoId: "ego.nucleus",
          targetEgoId: "ego.nucleus",
          task: "Bucle directo sobre sí mismo",
          input: {}
        })
      ).rejects.toThrow(DelegationCycleError);
    });

    it("debe detectar y bloquear ciclos recursivos en cadena (A -> B -> A)", async () => {
      const router = new DelegationRouter({
        runtime,
        executor: async (instance, req, ctx) => {
          if (instance.manifest.id === "ego.code-reviewer") {
            // Revisor intenta volver a llamar a ego.nucleus
            return router.delegate(
              {
                projectId: req.projectId,
                callerEgoId: instance.manifest.id,
                targetEgoId: "ego.nucleus",
                task: "Ciclo forzado",
                input: {}
              },
              ctx
            );
          }
          return { done: true };
        }
      });

      await expect(
        router.delegate({
          projectId: "proj-alpha",
          callerEgoId: "ego.nucleus",
          targetEgoId: "ego.code-reviewer",
          task: "Iniciar cadena que ciclará",
          input: {}
        })
      ).rejects.toThrow(DelegationCycleError);
    });

    it("debe respetar el límite de profundidad máxima configurable (maxDepth)", async () => {
      // Configuramos maxDepth = 2
      const router = new DelegationRouter({
        runtime,
        maxDepth: 2,
        executor: async (instance, req, ctx) => {
          if (instance.manifest.id === "ego.code-reviewer") {
            // Nivel 2: Revisor delega en Worker
            return router.delegate(
              {
                projectId: req.projectId,
                callerEgoId: instance.manifest.id,
                targetEgoId: "ego.worker",
                task: "Sub-tarea nivel 2",
                input: {}
              },
              ctx
            );
          }
          if (instance.manifest.id === "ego.worker") {
            // Nivel 3: Worker intenta delegar en otro (superará maxDepth = 2)
            return router.delegate(
              {
                projectId: req.projectId,
                callerEgoId: instance.manifest.id,
                targetEgoId: "ego.restricted",
                task: "Sub-tarea nivel 3 (debe fallar)",
                input: {}
              },
              ctx
            );
          }
          return { done: true };
        }
      });

      await expect(
        router.delegate({
          projectId: "proj-alpha",
          callerEgoId: "ego.nucleus",
          targetEgoId: "ego.code-reviewer",
          task: "Cadena profunda",
          input: {}
        })
      ).rejects.toThrow(DelegationMaxDepthError);
    });
  });

  describe("4. Integración con SharedMemory (SUB-05)", () => {
    it("debe publicar automáticamente el input y output en SharedMemory cuando está configurado", async () => {
      const router = new DelegationRouter({
        runtime,
        sharedMemory,
        executor: async (_instance, req) => {
          return { analysisResult: "OK", score: 98, echoTask: req.task };
        }
      });

      const result = await router.delegate({
        projectId: "proj-beta",
        callerEgoId: "ego.nucleus",
        targetEgoId: "ego.code-reviewer",
        task: "Análisis de seguridad",
        input: { payloadPoj: [1, 2, 3, 4] }
      });

      expect(result.status).toBe("completed");
      expect(result.sharedContextKey).toBeDefined();

      // Verificar que el input quedó almacenado en SharedMemory
      const storedInput = await sharedMemory.read<Record<string, unknown>>("proj-beta", result.sharedContextKey!);
      expect(storedInput).toBeDefined();
      expect(storedInput?.value).toEqual({ payloadPoj: [1, 2, 3, 4] });
      expect(storedInput?.publishedBy).toBe("ego.nucleus");

      // Verificar que el output quedó almacenado en SharedMemory
      const outputKey = `delegations/${result.delegationId}/output`;
      const storedOutput = await sharedMemory.read<Record<string, unknown>>("proj-beta", outputKey);
      expect(storedOutput).toBeDefined();
      expect(storedOutput?.value).toEqual({ analysisResult: "OK", score: 98, echoTask: "Análisis de seguridad" });
      expect(storedOutput?.publishedBy).toBe("ego.code-reviewer");
    });
  });

  describe("5. Timeouts y Hooks de Observabilidad", () => {
    it("debe interrumpir con DelegationTimeoutError si la tarea excede el tiempo límite", async () => {
      const router = new DelegationRouter({
        runtime,
        defaultTimeoutMs: 100,
        executor: async () => {
          // Operación lenta que excede los 100ms
          await new Promise((resolve) => setTimeout(resolve, 300));
          return "tarde";
        }
      });

      await expect(
        router.delegate({
          projectId: "proj-gamma",
          callerEgoId: "ego.nucleus",
          targetEgoId: "ego.code-reviewer",
          task: "Tarea lenta",
          input: {},
          timeoutMs: 50
        })
      ).rejects.toThrow(DelegationTimeoutError);
    });

    it("debe disparar onDelegationStart y onDelegationComplete en el ciclo de vida", async () => {
      const starts: Array<{ depth: number; chain: string[] }> = [];
      const completions: Array<{ status: string; id: string }> = [];

      const router = new DelegationRouter({
        runtime,
        onDelegationStart: (_req, depth, callChain) => {
          starts.push({ depth, chain: callChain });
        },
        onDelegationComplete: (res) => {
          completions.push({ status: res.status, id: res.delegationId });
        }
      });

      const res = await router.delegate({
        projectId: "proj-alpha",
        callerEgoId: "ego.nucleus",
        targetEgoId: "ego.code-reviewer",
        task: "Auditoría",
        input: "test"
      });

      expect(starts).toHaveLength(1);
      expect(starts[0].depth).toBe(1);
      expect(starts[0].chain).toEqual(["ego.nucleus"]);

      expect(completions).toHaveLength(1);
      expect(completions[0].status).toBe("completed");
      expect(completions[0].id).toBe(res.delegationId);
    });
  });

  describe("6. Integración con SubEgoRegistry y Persistencia VantaDB", () => {
    it("debe resolver manifiestos desde SubEgoRegistry si no están precargados en runtime", async () => {
      // Creamos un Sub-Ego persistido solo en VantaDB
      const persistedEgo = createSubEgoManifest({
        name: "Remote Specialist",
        role: "Experto en Datos",
        instructions: "Modelar estructuras de datos.",
        permissions: []
      });
      persistedEgo.id = "ego.remote-specialist";
      await registry.register(persistedEgo);

      // Verificamos que NO está en el runtime en memoria
      expect(runtime.hasManifest("ego.remote-specialist")).toBe(false);

      const router = new DelegationRouter({
        runtime,
        registry
      });

      const result = await router.delegate({
        projectId: "proj-delta",
        callerEgoId: "ego.nucleus",
        targetEgoId: "ego.remote-specialist",
        task: "Diseño de esquema",
        input: { table: "users" }
      });

      expect(result.status).toBe("completed");
      expect(result.targetEgoId).toBe("ego.remote-specialist");
      // Ahora el runtime debe haberlo registrado e instanciado
      expect(runtime.hasManifest("ego.remote-specialist")).toBe(true);
      expect(runtime.isLoaded("ego.remote-specialist")).toBe(true);
    });
  });
});
