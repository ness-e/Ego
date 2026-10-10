import { describe, it, expect } from "vitest";
import {
  TablePropsSchema,
  CardPropsSchema,
  FormPropsSchema,
  ChartPropsSchema,
  BoardPropsSchema,
  EditorPropsSchema,
  DiffPropsSchema,
  TerminalPropsSchema,
  CanvasComponentManifestSchema,
  CanvasWorkspaceStateSchema,
  DesignSystemTokensSchema,
  LayoutTemplateSchema,
} from "../src/index.js";

describe("CANV-01: Esquemas declarativos Zod de UI Runtime", () => {
  describe("1. TablePropsSchema", () => {
    it("debe validar una tabla completa con columnas, filas y acciones", () => {
      const validTable = {
        id: "tbl-01",
        title: "Proyectos Activos",
        columns: [
          { key: "id", label: "ID", type: "text" },
          { key: "name", label: "Nombre", type: "text", sortable: true },
          { key: "status", label: "Estado", type: "badge" },
        ],
        rows: [
          { id: "1", name: "Ego Desktop", status: "active" },
          { id: "2", name: "VantaDB Core", status: "completed" },
        ],
        pagination: { pageSize: 10, currentPage: 1, totalCount: 2 },
        actions: [{ actionId: "export_csv", label: "Exportar", variant: "primary" }],
      };

      const parsed = TablePropsSchema.parse(validTable);
      expect(parsed.id).toBe("tbl-01");
      expect(parsed.columns).toHaveLength(3);
      expect(parsed.rows).toHaveLength(2);
      expect(parsed.actions[0].actionId).toBe("export_csv");
    });

    it("debe rechazar una tabla sin columnas o con id vacío", () => {
      expect(() =>
        TablePropsSchema.parse({
          id: "",
          columns: [],
          rows: [],
        })
      ).toThrow();
    });
  });

  describe("2. CardPropsSchema", () => {
    it("debe validar una tarjeta con markdown, campos y acciones de despacho", () => {
      const validCard = {
        id: "card-architecture",
        title: "Arquitectura VantaDB",
        subtitle: "LSM Engine Integrado",
        description: "Evaluación de rendimiento del motor embebido",
        status: "verified",
        badge: "P0",
        content: {
          markdown: "### Memoria Híbrida\nIntegración completa vía napi-rs.",
          fields: {
            latenciaMs: 12,
            soportaLsm: true,
          },
        },
        actions: [
          {
            actionId: "view_details",
            label: "Ver detalles",
            variant: "default",
            payload: { topic: "memory" },
          },
        ],
      };

      const parsed = CardPropsSchema.parse(validCard);
      expect(parsed.title).toBe("Arquitectura VantaDB");
      expect(parsed.content?.fields?.latenciaMs).toBe(12);
    });
  });

  describe("3. FormPropsSchema", () => {
    it("debe validar formulario estructurado con distintos tipos de campos", () => {
      const validForm = {
        id: "form-config",
        title: "Configuración de Sub-Ego",
        fields: [
          { name: "name", label: "Nombre", type: "text", required: true },
          { name: "maxTokens", label: "Límite de Tokens", type: "number", defaultValue: 4096 },
          {
            name: "domain",
            label: "Dominio",
            type: "select",
            options: [
              { label: "Ingeniería", value: "engineering" },
              { label: "Producto", value: "product" },
            ],
          },
          { name: "enableHitl", label: "Requerir HITL", type: "switch", defaultValue: true },
          { name: "systemPrompt", label: "Prompt del Sistema", type: "textarea" },
        ],
        submitLabel: "Guardar Cambios",
        actionId: "save_subego_settings",
      };

      const parsed = FormPropsSchema.parse(validForm);
      expect(parsed.fields).toHaveLength(5);
      expect(parsed.submitLabel).toBe("Guardar Cambios");
    });

    it("debe rechazar campos con tipo desconocido", () => {
      expect(() =>
        FormPropsSchema.parse({
          id: "form-bad",
          title: "Inválido",
          fields: [{ name: "x", label: "X", type: "invalid_type" }],
        })
      ).toThrow();
    });
  });

  describe("4. ChartPropsSchema", () => {
    it("debe validar serie de datos para gráficos", () => {
      const validChart = {
        id: "chart-tokens",
        title: "Consumo de Tokens por Sub-Ego",
        chartType: "bar",
        data: [
          { ego: "nucleus", tokens: 1200 },
          { ego: "code_reviewer", tokens: 3500 },
        ],
        xKey: "ego",
        yKeys: ["tokens"],
        legend: true,
      };

      const parsed = ChartPropsSchema.parse(validChart);
      expect(parsed.chartType).toBe("bar");
      expect(parsed.yKeys).toContain("tokens");
    });
  });

  describe("5. BoardPropsSchema", () => {
    it("debe validar tablero Kanban con columnas y tarjetas", () => {
      const validBoard = {
        id: "board-sprint",
        title: "Sprint Alpha",
        columns: [
          {
            id: "col-todo",
            title: "Por hacer",
            cards: [{ id: "c-1", title: "CANV-02", tag: "UI" }],
          },
          {
            id: "col-done",
            title: "Completado",
            cards: [{ id: "c-2", title: "CANV-01", tag: "Schemas" }],
          },
        ],
      };

      const parsed = BoardPropsSchema.parse(validBoard);
      expect(parsed.columns).toHaveLength(2);
      expect(parsed.columns[1].cards[0].title).toBe("CANV-01");
    });
  });

  describe("6. EditorPropsSchema & DiffPropsSchema", () => {
    it("debe validar editor de código en modo sólo lectura", () => {
      const validEditor = {
        id: "ed-01",
        language: "typescript",
        code: "const x = 10;",
        readOnly: true,
      };

      const parsed = EditorPropsSchema.parse(validEditor);
      expect(parsed.language).toBe("typescript");
      expect(parsed.readOnly).toBe(true);
    });

    it("debe validar DiffProps con split view y contadores", () => {
      const validDiff = {
        id: "diff-01",
        filePath: "src/main.ts",
        originalContent: "console.log('old');",
        modifiedContent: "console.log('new');",
        viewMode: "split",
        additionsCount: 1,
        deletionsCount: 1,
      };

      const parsed = DiffPropsSchema.parse(validDiff);
      expect(parsed.filePath).toBe("src/main.ts");
      expect(parsed.viewMode).toBe("split");
    });
  });

  describe("7. TerminalPropsSchema", () => {
    it("debe validar salida de terminal con líneas mixtas y código de salida", () => {
      const validTerminal = {
        id: "term-01",
        cwd: "c:/project",
        lines: [
          "Starting test...",
          { text: "Vitest v2.1.2", type: "info", timestamp: 123456 },
          { text: "Pass: 10/10", type: "stdout" },
        ],
        isRunning: false,
        exitCode: 0,
      };

      const parsed = TerminalPropsSchema.parse(validTerminal);
      expect(parsed.exitCode).toBe(0);
      expect(parsed.lines).toHaveLength(3);
    });
  });

  describe("8. CanvasComponentManifestSchema (Unión Discriminada)", () => {
    it("debe validar manifiestos polimórficos de componentes con metadata", () => {
      const manifest = {
        id: "manifest-table",
        type: "table",
        props: {
          id: "t-1",
          columns: [{ key: "k", label: "Label" }],
          rows: [{ k: "val" }],
        },
        metadata: {
          generatedBy: "ego.nucleus",
          why: {
            directCause: "Petición del usuario de resumir backlog",
            vantaSources: ["projects/default/backlog"],
          },
        },
      };

      const parsed = CanvasComponentManifestSchema.parse(manifest);
      expect(parsed.type).toBe("table");
      expect(parsed.metadata?.generatedBy).toBe("ego.nucleus");
      expect(parsed.metadata?.why?.vantaSources).toContain("projects/default/backlog");
    });

    it("debe rechazar componentes con tipo desconocido", () => {
      expect(() =>
        CanvasComponentManifestSchema.parse({
          id: "manifest-bad",
          type: "unknown_widget",
          props: {},
        })
      ).toThrow();
    });
  });

  describe("9. CanvasWorkspaceStateSchema", () => {
    it("debe validar el estado persistible completo del Canvas para un proyecto", () => {
      const workspace = {
        id: "ws-01",
        projectId: "proj-alpha",
        activeView: "architecture",
        components: [
          {
            id: "comp-1",
            type: "card",
            props: { id: "c-1", title: "Resumen" },
          },
        ],
        selectedComponentId: "comp-1",
      };

      const parsed = CanvasWorkspaceStateSchema.parse(workspace);
      expect(parsed.projectId).toBe("proj-alpha");
      expect(parsed.components).toHaveLength(1);
      expect(parsed.updatedAt).toBeTypeOf("number");
    });
  });

  describe("10. DesignSystemTokensSchema (EGDS)", () => {
    it("debe validar un tema personalizado completo con colores semánticos y geometría", () => {
      const customTheme = {
        id: "theme-midnight-cyan",
        name: "Medianoche Cyan",
        colors: {
          brand: "#06b6d4",
          background: "#030712",
          panel: "#111827",
          raised: "#1f2937",
          text: "#f9fafb",
          muted: "#9ca3af",
          border: "#374151",
          success: "#10b981",
          warning: "#f59e0b",
          error: "#ef4444",
        },
        geometry: {
          radius: "lg",
          density: "compact",
        },
        typography: {
          fontFamily: "mono",
          baseSizePx: 12,
        },
      };

      const parsed = DesignSystemTokensSchema.parse(customTheme);
      expect(parsed.name).toBe("Medianoche Cyan");
      expect(parsed.colors.brand).toBe("#06b6d4");
      expect(parsed.geometry.radius).toBe("lg");
      expect(parsed.geometry.density).toBe("compact");
    });

    it("debe aplicar valores por defecto ante tokens mínimos", () => {
      const minimalTheme = {
        id: "theme-minimal",
        name: "Tema Mínimo",
        colors: {},
        geometry: {},
        typography: {},
      };

      const parsed = DesignSystemTokensSchema.parse(minimalTheme);
      expect(parsed.colors.brand).toBe("#38bdf8");
      expect(parsed.geometry.radius).toBe("md");
      expect(parsed.typography.fontFamily).toBe("sans");
    });
  });

  describe("11. LayoutTemplateSchema", () => {
    it("debe validar una plantilla de composición generada por un Sub-Ego", () => {
      const template = {
        id: "template-code-audit",
        name: "Auditoría de Código y Diffs",
        description: "Plantilla especializada para revisión de cambios con terminal y diff viewer",
        category: "engineering",
        layoutType: "split",
        creator: "ego.developer",
        components: [
          {
            id: "comp-diff-1",
            type: "diff",
            props: {
              id: "d-1",
              filePath: "src/engine.ts",
              originalContent: "a",
              modifiedContent: "b",
            },
          },
        ],
      };

      const parsed = LayoutTemplateSchema.parse(template);
      expect(parsed.name).toBe("Auditoría de Código y Diffs");
      expect(parsed.category).toBe("engineering");
      expect(parsed.creator).toBe("ego.developer");
      expect(parsed.components).toHaveLength(1);
    });
  });
});

