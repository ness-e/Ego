import { describe, it, expect, beforeEach } from "vitest";
import { ProductDomain } from "../src/product/ProductDomain.js";

describe("ProductDomain (DOM-02)", () => {
  let product: ProductDomain;

  beforeEach(() => {
    product = new ProductDomain();
  });

  it("debe crear y listar épicas de producto", async () => {
    const epic = await product.createEpic({
      title: "Integración de Dominios Funcionales",
      description: "Implementación de workspaces especializados por dominio en Ego",
      targetQuarter: "Q4 2026",
    });

    expect(epic.id).toBeDefined();
    expect(epic.status).toBe("planning");
    expect(epic.title).toBe("Integración de Dominios Funcionales");

    const epics = await product.listEpics();
    expect(epics.length).toBe(1);
    expect(epics[0].id).toBe(epic.id);
  });

  it("debe crear un ítem en el backlog y vincularlo a una épica", async () => {
    const epic = await product.createEpic({
      title: "Épica Canvas",
      description: "Vistas dinámicas",
    });

    const item = await product.createBacklogItem({
      title: "Diseño de selector de dominios",
      description: "Header contextual para alternancia de dominios",
      epicId: epic.id,
      priority: "p0",
      acceptanceCriteria: ["Selector visible", "Dispara cambio de vista"],
    });

    expect(item.id).toBeDefined();
    expect(item.status).toBe("backlog");
    expect(item.priority).toBe("p0");
    expect(item.epicId).toBe(epic.id);

    const items = await product.listBacklogItems({ epicId: epic.id });
    expect(items.length).toBe(1);
    expect(items[0].id).toBe(item.id);
  });

  it("debe actualizar el estado de una tarea en el flujo Kanban", async () => {
    const item = await product.createBacklogItem({
      title: "Tarea Kanban",
      description: "Movimiento de columnas",
    });

    const inProgress = await product.updateBacklogItemStatus(item.id, "in_progress");
    expect(inProgress.status).toBe("in_progress");

    const done = await product.updateBacklogItemStatus(item.id, "done");
    expect(done.status).toBe("done");

    const doneItems = await product.listBacklogItems({ status: "done" });
    expect(doneItems.length).toBe(1);
  });

  it("debe generar un PRD estructurado y exportarlo a Markdown canónico", async () => {
    const prd = await product.generatePrd({
      title: "Dynamic Domain Workspace",
      problemStatement: "Los usuarios requieren herramientas especializadas según su tarea actual.",
      solutionOverview: "Un Dynamic Workspace que transmuta vistas por dominio manteniendo el chat unificado.",
      acceptanceCriteria: [
        "Vistas reactivas según dominio activo",
        "Preservación de sesión de conversación compartida",
        "Tipado estricto Zod de contratos",
      ],
      successMetrics: ["Reducción de fricción de contexto en un 40%"],
      outOfScope: ["Soporte de temas visuales personalizados no autorizados"],
    });

    expect(prd.id).toBeDefined();
    expect(prd.version).toBe(1);
    expect(prd.acceptanceCriteria.length).toBe(3);

    const markdown = product.exportPrdToMarkdown(prd);
    expect(markdown).toContain("# PRD: Dynamic Domain Workspace");
    expect(markdown).toContain("## 1. Declaración del Problema");
    expect(markdown).toContain("- [ ] Vistas reactivas según dominio activo");
    expect(markdown).toContain("## 5. Fuera de Alcance (Out of Scope)");
  });
});
