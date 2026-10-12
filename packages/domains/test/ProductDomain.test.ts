import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter } from "@ego/memory";
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

  describe("F2T4 cold-reboot (H07)", () => {
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

    it("rehidrata backlog, épicas y PRDs tras reinicio", async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), "ego-f2t4-prod-"));
      adapter = new EgoMemoryAdapter(dir);
      await adapter.init();

      const d1 = new ProductDomain(adapter);
      const epic = await d1.createEpic({ title: "Épica reboot", description: "Desc" });
      const item = await d1.createBacklogItem({
        title: "Ítem reboot",
        description: "Desc",
        epicId: epic.id,
      });
      const prd = await d1.generatePrd({
        title: "PRD reboot",
        problemStatement: "P",
        solutionOverview: "S",
        acceptanceCriteria: ["C1"],
      });
      await adapter.flush();
      await adapter.close();

      adapter = new EgoMemoryAdapter(dir);
      await adapter.init();
      const d2 = await ProductDomain.open(adapter);

      const items = await d2.listBacklogItems();
      expect(items.length).toBe(1);
      expect(items[0].id).toBe(item.id);

      const epics = await d2.listEpics();
      expect(epics.length).toBe(1);
      expect(epics[0].id).toBe(epic.id);
      expect(epics[0].itemIds).toContain(item.id);

      const markdown = d2.exportPrdToMarkdown(prd);
      expect(markdown).toContain("PRD reboot");
    });
  });
});
