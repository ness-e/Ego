import { describe, it, expect } from "vitest";
import { LayoutTemplateSchema } from "../src/schemas/components.js";
import { GenerateReportUISchema } from "../src/resolvedCatalog.js";
import { dailyReportTemplate } from "../src/templates/daily-report.js";

describe("daily-report template", () => {
  it("valida como LayoutTemplate", () => {
    expect(() => LayoutTemplateSchema.parse(dailyReportTemplate)).not.toThrow();
  });

  it("componentes del template pasan el schema resuelto", () => {
    const parsed = GenerateReportUISchema.parse({
      surfaceId: "daily-report",
      components: dailyReportTemplate.components,
    });
    expect(parsed.components.length).toBeGreaterThan(0);
  });

  it("rechaza tipos fuera del catálogo de reportes", () => {
    expect(() =>
      GenerateReportUISchema.parse({
        surfaceId: "s",
        components: [
          { id: "t1", type: "terminal", props: { id: "t1", lines: [] } },
        ],
      })
    ).toThrow();
  });
});
