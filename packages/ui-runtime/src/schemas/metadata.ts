import { z } from "zod";

/**
 * Metadata canónica de explicabilidad y autoría para componentes de Canvas (P11 & Mascota)
 */
export const ComponentMetadataSchema = z.object({
  generatedBy: z.string().optional(),
  timestamp: z.number().default(() => Date.now()),
  why: z
    .object({
      directCause: z.string().optional(),
      vantaSources: z.array(z.string()).default([]),
      auditTrace: z.string().optional(),
    })
    .optional(),
});

export type ComponentMetadata = z.infer<typeof ComponentMetadataSchema>;
