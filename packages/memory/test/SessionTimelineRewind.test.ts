import { describe, it, expect, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter } from "../EgoMemoryAdapter.js";
import { SessionTimelineRewind } from "../SessionTimelineRewind.js";

describe("HERM-14: SessionTimelineRewind (Inmutabilidad y Branching sobre VantaDB)", () => {
  it("agrega turnos secuencialmente en la rama principal", () => {
    const timeline = new SessionTimelineRewind("sess-1");
    const t1 = timeline.appendTurn("user", "Hola Ego");
    const t2 = timeline.appendTurn("assistant", "Hola, ¿en qué te ayudo?");

    expect(t1.sequence).toBe(1);
    expect(t2.sequence).toBe(2);
    expect(timeline.getActiveTimeline()).toHaveLength(2);
  });

  it("rebobina dentro de la misma rama marcando turnos posteriores como superseded sin borrarlos", () => {
    const timeline = new SessionTimelineRewind("sess-2");
    const t1 = timeline.appendTurn("user", "Pregunta 1");
    timeline.appendTurn("assistant", "Respuesta 1");
    timeline.appendTurn("user", "Pregunta 2");

    expect(timeline.getActiveTimeline()).toHaveLength(3);

    // Rebobinar hasta t1
    const { activeTurns } = timeline.rewindToTurn(t1.turnId, { forkBranch: false });
    expect(activeTurns).toHaveLength(1);
    expect(activeTurns[0].content).toBe("Pregunta 1");

    // Verificar que los turnos superseded siguen existiendo en el estado completo (sin pérdida de datos)
    expect(timeline.getState().turns).toHaveLength(3);
    expect(timeline.getState().turns[1].superseded).toBe(true);
    expect(timeline.getState().turns[2].superseded).toBe(true);
  });

  it("permite bifurcar (forkBranch) creando una rama hija sin alterar la rama original", () => {
    const timeline = new SessionTimelineRewind("sess-3");
    const t1 = timeline.appendTurn("user", "Inicio");
    timeline.appendTurn("assistant", "Respuesta rama principal");

    // Bifurcar desde t1
    const { newBranchId } = timeline.rewindToTurn(t1.turnId, {
      forkBranch: true,
      branchName: "Exploración Alternativa",
    });

    expect(newBranchId).toBeDefined();
    // Añadir turno a la nueva rama
    timeline.appendTurn("assistant", "Respuesta rama alternativa");

    const altTimeline = timeline.getActiveTimeline();
    expect(altTimeline).toHaveLength(2);
    expect(altTimeline[0].content).toBe("Inicio");
    expect(altTimeline[1].content).toBe("Respuesta rama alternativa");

    // Conmutar de vuelta a la rama principal y verificar que sus mensajes siguen intactos
    timeline.switchBranch("main");
    const mainTimeline = timeline.getActiveTimeline();
    expect(mainTimeline).toHaveLength(2);
    expect(mainTimeline[1].content).toBe("Respuesta rama principal");
  });

  describe("F2T4 persistencia vía adapter (H08)", () => {
    let dir: string;
    let adapter: EgoMemoryAdapter | undefined;

    afterEach(async () => {
      if (adapter?.ready) await adapter.close();
      adapter = undefined;
      if (dir) {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch {
          // Ignorar bloqueos de Windows
        }
      }
    });

    it("save/load round-trip preserva turnos y ramas tras reinicio", async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), "ego-f2t4-tl-"));
      adapter = new EgoMemoryAdapter(dir);
      await adapter.init();

      const t1 = new SessionTimelineRewind("sess-reboot", adapter);
      t1.appendTurn("user", "Hola");
      t1.appendTurn("assistant", "Hola, ¿en qué te ayudo?");
      const pivot = t1.appendTurn("user", "Pivote");
      t1.rewindToTurn(pivot.turnId, { forkBranch: true, branchName: "Alt" });
      t1.appendTurn("assistant", "Rama alternativa");
      await t1.save();
      await adapter.flush();
      await adapter.close();

      adapter = new EgoMemoryAdapter(dir);
      await adapter.init();
      const t2 = await SessionTimelineRewind.open("sess-reboot", adapter);

      const active = t2.getActiveTimeline();
      expect(active).toHaveLength(4);
      expect(active[0].content).toBe("Hola");
      expect(active[2].content).toBe("Pivote");
      expect(active[3].content).toBe("Rama alternativa");
      expect(t2.getState().turns).toHaveLength(4);
    });

    it("load retorna false si no hay nada persistido (arranque limpio)", async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), "ego-f2t4-tlclean-"));
      adapter = new EgoMemoryAdapter(dir);
      await adapter.init();

      const t = new SessionTimelineRewind("sess-nueva", adapter);
      expect(await t.load()).toBe(false);
      expect(t.getActiveTimeline()).toHaveLength(0);
    });

    it("save/load sin adapter lanzan (efímera explícita, no silenciosa)", async () => {
      const t = new SessionTimelineRewind("sess-mem");
      t.appendTurn("user", "solo memoria");
      await expect(t.save()).rejects.toThrow();
      await expect(t.load()).rejects.toThrow();
      expect(t.getActiveTimeline()).toHaveLength(1);
    });
  });
});
