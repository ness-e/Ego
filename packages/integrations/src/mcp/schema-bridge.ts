import { z } from "zod";

/**
 * Puente conversor de JSON Schema (estándar MCP) a esquemas Zod (estándar Ego ToolRegistry).
 */
export function jsonSchemaToZod(
  schema: Record<string, unknown> | undefined
): z.ZodType<Record<string, unknown>> {
  if (!schema || typeof schema !== "object") {
    return z.record(z.unknown());
  }

  const properties = (schema.properties as Record<string, Record<string, unknown>>) || {};
  const requiredList = Array.isArray(schema.required) ? (schema.required as string[]) : [];

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(properties)) {
    const isRequired = requiredList.includes(key);
    let fieldSchema: z.ZodTypeAny;

    const propType = prop.type;

    if (propType === "string") {
      if (Array.isArray(prop.enum) && prop.enum.length > 0) {
        const values = prop.enum.filter((v): v is string => typeof v === "string");
        fieldSchema = values.length >= 2
          ? z.enum(values as [string, ...string[]])
          : z.string();
      } else {
        fieldSchema = z.string();
      }
    } else if (propType === "number" || propType === "integer") {
      fieldSchema = z.number();
    } else if (propType === "boolean") {
      fieldSchema = z.boolean();
    } else if (propType === "array") {
      fieldSchema = z.array(z.unknown());
    } else if (propType === "object") {
      fieldSchema = z.record(z.unknown());
    } else {
      fieldSchema = z.unknown();
    }

    if (prop.description && typeof prop.description === "string") {
      fieldSchema = fieldSchema.describe(prop.description);
    }

    if (!isRequired) {
      fieldSchema = fieldSchema.optional();
    }

    shape[key] = fieldSchema;
  }

  // Permitir propiedades passthrough para máxima compatibilidad con servidores MCP de terceros
  return z.object(shape).passthrough();
}
