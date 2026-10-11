import { describe, it, expect } from "vitest";
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
});
