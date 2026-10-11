export type StructuredInputFieldType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "multiselect";

export interface StructuredInputOption {
  value: string;
  label: string;
  description?: string;
}

export interface StructuredInputFieldDefinition {
  id: string;
  label: string;
  type: StructuredInputFieldType;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: StructuredInputOption[];
  min?: number;
  max?: number;
  maxLength?: number;
}

export interface StructuredInputFormSchema {
  formId: string;
  title: string;
  description?: string;
  fields: StructuredInputFieldDefinition[];
}

export interface StructuredInputCompileResult {
  formId: string;
  title: string;
  description?: string;
  fields: Array<
    StructuredInputFieldDefinition & {
      sanitizedDefaultValue?: unknown;
    }
  >;
  fieldMap: Map<string, StructuredInputFieldDefinition>;
}

export interface StructuredInputValidationResult {
  valid: boolean;
  values: Record<string, unknown>;
  errors: Record<string, string>;
}

const MAX_FIELDS = 20;
const MAX_TEXT_CHARS = 4096;

/**
 * Validador y compilador de entradas estructuradas y formularios interactivos (OCLW-12).
 * Extraído y adaptado de OpenClaw src/agents/harness/structured-input.ts.
 *
 * Complementa la directiva HITL de Ego permitiendo recopilar respuestas
 * complejas o elecciones múltiples del operador de manera tipada y segura.
 */
export class StructuredInputCompiler {
  /**
   * Compila y valida un esquema declarativo de formulario interactivo.
   */
  public static compile(schema: StructuredInputFormSchema): StructuredInputCompileResult {
    if (schema.fields.length > MAX_FIELDS) {
      throw new Error(
        `El formulario excede el límite máximo de ${MAX_FIELDS} campos permitidos (recibidos: ${schema.fields.length}).`
      );
    }

    const fieldMap = new Map<string, StructuredInputFieldDefinition>();
    const fields = schema.fields.map((f) => {
      if (fieldMap.has(f.id)) {
        throw new Error(`Campo duplicado con ID '${f.id}' en el formulario.`);
      }

      // Sanitizar texto
      const cleanLabel = f.label.slice(0, 256).trim();
      const cleanDescription = f.description ? f.description.slice(0, 1024).trim() : undefined;

      const compiledField: StructuredInputFieldDefinition & { sanitizedDefaultValue?: unknown } = {
        ...f,
        label: cleanLabel,
        description: cleanDescription,
        sanitizedDefaultValue: f.defaultValue,
      };

      fieldMap.set(f.id, compiledField);
      return compiledField;
    });

    return {
      formId: schema.formId,
      title: schema.title.slice(0, 256).trim(),
      description: schema.description ? schema.description.slice(0, 2048).trim() : undefined,
      fields,
      fieldMap,
    };
  }

  /**
   * Valida las respuestas provistas por el usuario contra el formulario compilado.
   */
  public static validate(
    compiled: StructuredInputCompileResult,
    answers: Record<string, unknown>
  ): StructuredInputValidationResult {
    const values: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    for (const field of compiled.fields) {
      const rawVal = answers[field.id] ?? field.defaultValue;

      if (field.required && (rawVal === undefined || rawVal === null || rawVal === "")) {
        errors[field.id] = `El campo '${field.label}' es obligatorio.`;
        continue;
      }

      if (rawVal === undefined || rawVal === null) {
        values[field.id] = undefined;
        continue;
      }

      switch (field.type) {
        case "text": {
          if (typeof rawVal !== "string") {
            errors[field.id] = `Se esperaba un valor de texto.`;
            break;
          }
          const maxLen = field.maxLength ?? MAX_TEXT_CHARS;
          if (rawVal.length > maxLen) {
            errors[field.id] = `El texto excede el límite de ${maxLen} caracteres.`;
            break;
          }
          values[field.id] = rawVal;
          break;
        }

        case "number": {
          const num = Number(rawVal);
          if (isNaN(num)) {
            errors[field.id] = `Se esperaba un número válido.`;
            break;
          }
          if (field.min !== undefined && num < field.min) {
            errors[field.id] = `El valor no puede ser menor a ${field.min}.`;
            break;
          }
          if (field.max !== undefined && num > field.max) {
            errors[field.id] = `El valor no puede ser mayor a ${field.max}.`;
            break;
          }
          values[field.id] = num;
          break;
        }

        case "boolean": {
          values[field.id] = Boolean(rawVal);
          break;
        }

        case "select": {
          const sVal = String(rawVal);
          if (field.options && !field.options.some((o) => o.value === sVal)) {
            errors[field.id] = `Opción seleccionada inválida.`;
            break;
          }
          values[field.id] = sVal;
          break;
        }

        case "multiselect": {
          if (!Array.isArray(rawVal)) {
            errors[field.id] = `Se esperaba una lista de opciones.`;
            break;
          }
          const validOptions = new Set(field.options?.map((o) => o.value) ?? []);
          const chosen = rawVal.map(String);
          const invalid = chosen.find((c) => !validOptions.has(c));
          if (invalid) {
            errors[field.id] = `La opción '${invalid}' no es válida.`;
            break;
          }
          values[field.id] = chosen;
          break;
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      values,
      errors,
    };
  }
}
