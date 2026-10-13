import { z } from "zod";

/**
 * Convierte un esquema Zod a un objeto JSON Schema estándar sin dependencias externas.
 * Soporta objetos, strings, números, booleanos, arrays, enums, literales, fechas,
 * tuplas, uniones, opcionales y valores por defecto.
 * Es tolerante a referencias cruzadas de módulos inspeccionando `_def.typeName` además de `instanceof`.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (schema.description) {
    result.description = schema.description;
  }

  // Desempaquetar efectos / transforms si los hay.
  // L10: `z.ZodTypeAny` en vez de `any`; los accesos a `_def`/`innerType`/
  // `unwrap` usan narrowing `instanceof` + `typeName` (tolerante a
  // referencias cruzadas de módulos) con casts puntuales justificados.
  let current: z.ZodTypeAny = schema;
  while (current instanceof z.ZodEffects || current._def?.typeName === "ZodEffects") {
    current = (current as z.ZodEffects<z.ZodTypeAny>).innerType();
  }

  const typeName: string | undefined = current._def?.typeName;

  if (current instanceof z.ZodOptional || typeName === "ZodOptional") {
    return zodToJsonSchema((current as z.ZodOptional<z.ZodTypeAny>).unwrap());
  }

  if (current instanceof z.ZodNullable || typeName === "ZodNullable") {
    const inner = zodToJsonSchema((current as z.ZodNullable<z.ZodTypeAny>).unwrap());
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
    result.items = zodToJsonSchema((current as z.ZodArray<z.ZodTypeAny>).element);
    return result;
  }

  if (current instanceof z.ZodObject || typeName === "ZodObject") {
    result.type = "object";
    const shape = (current as z.ZodObject<z.ZodRawShape>).shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, propSchema] of Object.entries(shape)) {
      const field = propSchema as z.ZodTypeAny;
      properties[key] = zodToJsonSchema(field);

      const fieldTypeName = field._def?.typeName;
      const isOptional =
        field instanceof z.ZodOptional ||
        fieldTypeName === "ZodOptional" ||
        field instanceof z.ZodDefault ||
        fieldTypeName === "ZodDefault" ||
        ((field instanceof z.ZodNullable || fieldTypeName === "ZodNullable") &&
          (field as z.ZodNullable<z.ZodTypeAny>).unwrap()?._def?.typeName === "ZodOptional");

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

  // L04: ramas honestas para tipos antes degradados al fallback `{type:'object'}`.
  if (current instanceof z.ZodLiteral || typeName === "ZodLiteral") {
    const literalValue: unknown = (current as z.ZodLiteral<unknown>)._def.value;
    const literalType =
      typeof literalValue === "string"
        ? "string"
        : typeof literalValue === "number" || typeof literalValue === "bigint"
          ? "number"
          : typeof literalValue === "boolean"
            ? "boolean"
            : undefined;
    if (literalType !== undefined) {
      result.type = literalType;
    }
    result.const = literalValue;
    return result;
  }

  if (current instanceof z.ZodDate || typeName === "ZodDate") {
    result.type = "string";
    result.format = "date-time";
    return result;
  }

  if (current instanceof z.ZodTuple || typeName === "ZodTuple") {
    const items = ((current as unknown as { _def: { items: z.ZodTypeAny[] } })._def.items ?? []).map(
      (item) => zodToJsonSchema(item)
    );
    result.type = "array";
    result.prefixItems = items;
    result.minItems = items.length;
    result.maxItems = items.length;
    return result;
  }

  // Fallback genérico para tipos desconocidos o any
  return { type: "object", ...result };
}
