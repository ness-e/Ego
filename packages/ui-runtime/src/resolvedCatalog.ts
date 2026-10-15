import { z } from "zod";
import { CanvasComponentManifestSchema } from "./schemas/components.js";

// Catálogo resuelto para el planner: solo tipos permitidos en reportes.
// El LLM genera contra este schema, no contra el genérico.
export const ReportAllowedTypes = ["card", "table", "chart", "board"] as const;

export const ReportComponentSchema = CanvasComponentManifestSchema.refine(
  (m) => (ReportAllowedTypes as readonly string[]).includes(m.type),
  { message: "tipo no permitido en reportes" }
);

export const GenerateReportUISchema = z.object({
  surfaceId: z.string().min(1),
  components: z.array(ReportComponentSchema).min(1).max(12),
});

export type GenerateReportUI = z.infer<typeof GenerateReportUISchema>;
