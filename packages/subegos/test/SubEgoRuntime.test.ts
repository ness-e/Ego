import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SubEgoRuntime,
  SubEgoFactory,
  SubEgoNotFoundError,
  SubEgoBusyError,
  type SubEgoManifest,
  type SubEgoLifecycleState
} from "../src/index.js";

describe("SubEgoRuntime — Ciclo de vida y Lazy Activation (SUB-03)", () => {
  let manifestA: SubEgoManifest;
  let manifestB: SubEgoManifest;
  let manifestC: SubEgoManifest;

  beforeEach(() => {
    manifestA = SubEgoFactory.fromTemplate("researcher", { name: "Especialista Alpha" });
    manifestB = SubEgoFactory.fromTemplate("code_reviewer", { name: "Especialista Beta" });
    manifestC = SubEgoFactory.fromTemplate("copywriter", { name: "Especialista Gamma" });
  });

  describe("1. Activación Perezosa (Lazy Activation)", () => {
    it("no debe instanciar el Sub-Ego en RAM hasta la primera invocación explícita", () => {
      const runtime = new SubEgoRuntime({ idleTtlMs: 5000 });
      runtime.registerManifest(manifestA);

      expect(runtime.hasManifest(manifestA.id)).toBe(true);
      expect(runtime.isLoaded(manifestA.id)).toBe(false);
      expect(runtime.getActiveCount()).toBe(0);

      const instance = runtime.getOrActivate(manifestA.id);

      expect(runtime.isLoaded(manifestA.id)).toBe(true);
      expect(runtime.getActiveCount()).toBe(1);
      expect(instance.manifest.id).toBe(manifestA.id);
      expect(instance.state).toBe("idle");
      expect(instance.totalTurnsExecuted).toBe(0);
      expect(instance.totalTokensUsed).toBe(0);

      runtime.unloadAll();
    });

    it("debe lanzar SubEgoNotFoundError si el identificador no fue registrado previamente", () => {
      const runtime = new SubEgoRuntime();
      expect(() => runtime.getOrActivate("ego.fantasma")).toThrow(SubEgoNotFoundError);
    });
  });

  describe("2. Máquina de Estados FSM y Ejecución de Turnos", () => {
    it("debe transicionar por los estados del ciclo de vida durante executeTurn", async () => {
      const transitions: Array<{ from: SubEgoLifecycleState; to: SubEgoLifecycleState }> = [];

      const runtime = new SubEgoRuntime({
        idleTtlMs: 5000,
        onStateTransition: (_inst, from, to) => {
          transitions.push({ from, to });
        }
      });

      runtime.registerManifest(manifestA);

      const result = await runtime.executeTurn(manifestA.id, async (instance) => {
        expect(instance.state).toBe("executing");
        return {
          output: "Análisis completado",
          tokensUsed: 150,
          costUsd: 0.005
        };
      });

      expect(result.subEgoId).toBe(manifestA.id);
      expect(result.output).toBe("Análisis completado");
      expect(result.tokensUsed).toBe(150);
      expect(result.costUsd).toBe(0.005);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      const instance = runtime.getInstance(manifestA.id);
      expect(instance).toBeDefined();
      expect(instance!.state).toBe("idle");
      expect(instance!.totalTurnsExecuted).toBe(1);
      expect(instance!.totalTokensUsed).toBe(150);
      expect(instance!.totalCostUsd).toBe(0.005);

      // Transiciones observadas: activating -> idle (activación), idle -> executing -> idle (turno)
      expect(transitions).toEqual([
        { from: "activating", to: "idle" },
        { from: "idle", to: "executing" },
        { from: "executing", to: "idle" }
      ]);

      runtime.unloadAll();
    });

    it("debe arrojar SubEgoBusyError si se intenta descargar o suspender un Sub-Ego en ejecución", async () => {
      const runtime = new SubEgoRuntime();
      runtime.registerManifest(manifestA);

      let executePromise: Promise<unknown>;

      executePromise = runtime.executeTurn(manifestA.id, async () => {
        // Durante la ejecución intentamos descargar
        expect(() => runtime.unload(manifestA.id)).toThrow(SubEgoBusyError);
        expect(() => runtime.suspend(manifestA.id)).toThrow(SubEgoBusyError);
        return { output: "OK" };
      });

      await executePromise;
      runtime.unloadAll();
    });
  });

  describe("3. Descarga Automática por Inactividad (Idle TTL)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("debe descargar automáticamente una instancia ociosa tras vencer el TTL", () => {
      const runtime = new SubEgoRuntime({ idleTtlMs: 1000 });
      runtime.registerManifest(manifestA);

      runtime.getOrActivate(manifestA.id);
      expect(runtime.isLoaded(manifestA.id)).toBe(true);

      // Avanzar el tiempo 500ms (aún no vence)
      vi.advanceTimersByTime(500);
      expect(runtime.isLoaded(manifestA.id)).toBe(true);

      // Avanzar el tiempo otros 600ms (supera los 1000ms)
      vi.advanceTimersByTime(600);
      expect(runtime.isLoaded(manifestA.id)).toBe(false);

      runtime.unloadAll();
    });

    it("debe reactivar el temporizador TTL tras cada turno de ejecución", async () => {
      const runtime = new SubEgoRuntime({ idleTtlMs: 1000 });
      runtime.registerManifest(manifestA);

      runtime.getOrActivate(manifestA.id);

      // Avanzamos 800ms
      vi.advanceTimersByTime(800);
      expect(runtime.isLoaded(manifestA.id)).toBe(true);

      // Ejecutamos un turno: esto resetea el TTL
      const turnPromise = runtime.executeTurn(manifestA.id, async () => ({ output: "Done" }));
      await turnPromise;

      // Avanzamos 800ms desde el final del turno (no ha vencido el nuevo TTL de 1000ms)
      vi.advanceTimersByTime(800);
      expect(runtime.isLoaded(manifestA.id)).toBe(true);

      // Avanzamos 300ms más (total 1100ms > 1000ms)
      vi.advanceTimersByTime(300);
      expect(runtime.isLoaded(manifestA.id)).toBe(false);

      runtime.unloadAll();
    });
  });

  describe("4. Gestión de Concurrencia y Desalojo en RAM", () => {
    it("debe expulsar la instancia ociosa más antigua cuando se alcanza el límite máximo", () => {
      const runtime = new SubEgoRuntime({
        maxConcurrentActive: 2,
        idleTtlMs: 60_000
      });

      runtime.registerManifests([manifestA, manifestB, manifestC]);

      // Activar A (timestamp T0)
      runtime.getOrActivate(manifestA.id);
      expect(runtime.getActiveCount()).toBe(1);

      // Activar B (timestamp T1 > T0)
      runtime.getOrActivate(manifestB.id);
      expect(runtime.getActiveCount()).toBe(2);
      expect(runtime.isLoaded(manifestA.id)).toBe(true);
      expect(runtime.isLoaded(manifestB.id)).toBe(true);

      // Activar C: debe superar maxConcurrentActive y expulsar A (el más antiguo)
      runtime.getOrActivate(manifestC.id);
      expect(runtime.getActiveCount()).toBe(2);
      expect(runtime.isLoaded(manifestA.id)).toBe(false); // Expulsado
      expect(runtime.isLoaded(manifestB.id)).toBe(true);
      expect(runtime.isLoaded(manifestC.id)).toBe(true);

      runtime.unloadAll();
    });
  });

  describe("5. Control Manual y Limpieza Completa", () => {
    it("debe suspender y descargar manualmente según se requiera", () => {
      const runtime = new SubEgoRuntime();
      runtime.registerManifest(manifestA);

      const inst = runtime.getOrActivate(manifestA.id);
      expect(inst.state).toBe("idle");

      const suspended = runtime.suspend(manifestA.id);
      expect(suspended).toBe(true);
      expect(inst.state).toBe("suspended");
      expect(runtime.isLoaded(manifestA.id)).toBe(true);

      const unloaded = runtime.unload(manifestA.id);
      expect(unloaded).toBe(true);
      expect(runtime.isLoaded(manifestA.id)).toBe(false);
    });

    it("unloadAll debe limpiar todas las instancias y timers de manera idempotente", () => {
      const runtime = new SubEgoRuntime();
      runtime.registerManifests([manifestA, manifestB]);

      runtime.getOrActivate(manifestA.id);
      runtime.getOrActivate(manifestB.id);
      expect(runtime.getActiveCount()).toBe(2);

      runtime.unloadAll();
      expect(runtime.getActiveCount()).toBe(0);
      expect(runtime.getAllInstances()).toEqual([]);
    });
  });
});
