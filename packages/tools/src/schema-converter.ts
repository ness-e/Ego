import { z } from "zod";

/**
 * Convierte un esquema Zod a un objeto JSON Schema estándar sin dependencias externas.
 * Soporta objetos, strings, números, booleanos, arrays, enums, uniones, opcionales y valores por defecto.
 * Es tolerante a referencias cruzadas de módulos inspeccionando `_def.typeName` además de `instanceof`.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (schema.description) {
    result.description = schema.description;
  }

  // Desempaquetar efectos / transforms si los hay
  let current: any = schema;
  while (current instanceof z.ZodEffects || current._def?.typeName === "ZodEffects") {
    current = current.innerType();
  }

  const typeName: string | undefined = current._def?.typeName;

  if (current instanceof z.ZodOptional || typeName === "ZodOptional") {
    return zodToJsonSchema(current.unwrap());
  }

  if (current instanceof z.ZodNullable || typeName === "ZodNullable") {
    const inner = zodToJsonSchema(current.unwrap());
    return { ...inner, nullable: true };
  }

  if (current instanceof z.ZodDefault || typeName === "ZodDefault") {
    const inner = zodToJsonSchema(current._def.innerType);
    return { ...inner, default: current._def.defaultValue() };
  }

  if (current instanceof z.ZodString || typeName === "ZodString") {
    result.type = "string";
    return result;
  }

  if (current instanceof z.ZodNumber || typeName === "ZodNumber") {
    result.type = "number";
    return result;
  }

  if (current instanceof z.ZodBoolean || typeName === "ZodBoolean") {
    result.type = "boolean";
    return result;
  }

  if (current instanceof z.ZodEnum || typeName === "ZodEnum") {
    result.type = "string";
    result.enum = current._def.values;
    return result;
  }

  if (current instanceof z.ZodNativeEnum || typeName === "ZodNativeEnum") {
    result.type = "string";
    result.enum = Object.values(current._def.values);
    return result;
  }

  if (current instanceof z.ZodArray || typeName === "ZodArray") {
    result.type = "array";
    result.items = zodToJsonSchema(current.element);
    return result;
  }

  if (current instanceof z.ZodObject || typeName === "ZodObject") {
    result.type = "object";
    const shape = current.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, propSchema] of Object.entries(shape)) {
      const field = propSchema as any;
      properties[key] = zodToJsonSchema(field);

      const fieldTypeName = field._def?.typeName;
      const isOptional =
        field instanceof z.ZodOptional ||
        fieldTypeName === "ZodOptional" ||
        field instanceof z.ZodDefault ||
        fieldTypeName === "ZodDefault" ||
        ((field instanceof z.ZodNullable || fieldTypeName === "ZodNullable") &&
          field.unwrap()?._def?.typeName === "ZodOptional");

      if (!isOptional) {
        required.push(key);
      }
    }

    result.properties = properties;
    if (required.length > 0) {
      result.required = required;
    }
    return result;
  }

  if (current instanceof z.ZodUnion || typeName === "ZodUnion") {
    result.anyOf = current._def.options.map((opt: z.ZodTypeAny) => zodToJsonSchema(opt));
    return result;
  }

  if (current instanceof z.ZodRecord || typeName === "ZodRecord") {
    result.type = "object";
    result.additionalProperties = zodToJsonSchema(current._def.valueType);
    return result;
  }

  // Fallback genérico para tipos desconocidos o any
  return { type: "object", ...result };
}
