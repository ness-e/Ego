import { describe, it, expect } from "vitest";
import {
  StructuredInputCompiler,
  type StructuredInputFormSchema,
} from "../src/StructuredInput.js";

describe("StructuredInput Suite (OCLW-12)", () => {
  const schema: StructuredInputFormSchema = {
    formId: "deploy-form",
    title: "Parámetros de Despliegue",
    description: "Configuración para el entorno de destino",
    fields: [
      {
        id: "env",
        label: "Entorno",
        type: "select",
        required: true,
        options: [
          { value: "staging", label: "Staging" },
          { value: "production", label: "Producción" },
        ],
        defaultValue: "staging",
      },
      {
        id: "replicas",
        label: "Número de réplicas",
        type: "number",
        required: true,
        min: 1,
        max: 10,
        defaultValue: 2,
      },
      {
        id: "enableCache",
        label: "Habilitar Caché Redis",
        type: "boolean",
        defaultValue: true,
      },
    ],
  };

  it("debe compilar un esquema declarativo de formulario", () => {
    const compiled = StructuredInputCompiler.compile(schema);
    expect(compiled.formId).toBe("deploy-form");
    expect(compiled.fields).toHaveLength(3);
    expect(compiled.fieldMap.has("env")).toBe(true);
    expect(compiled.fieldMap.has("replicas")).toBe(true);
  });

  it("debe validar respuestas correctas del usuario", () => {
    const compiled = StructuredInputCompiler.compile(schema);
    const answers = {
      env: "production",
      replicas: 4,
      enableCache: false,
    };

    const result = StructuredInputCompiler.validate(compiled, answers);
    expect(result.valid).toBe(true);
    expect(result.values.env).toBe("production");
    expect(result.values.replicas).toBe(4);
    expect(result.values.enableCache).toBe(false);
    expect(result.errors).toEqual({});
  });

  it("debe rechazar valores inválidos o fuera de rango", () => {
    const compiled = StructuredInputCompiler.compile(schema);
    const answers = {
      env: "desconocido",
      replicas: 99, // excede max: 10
    };

    const result = StructuredInputCompiler.validate(compiled, answers);
    expect(result.valid).toBe(false);
    expect(result.errors.env).toBeDefined();
    expect(result.errors.replicas).toContain("no puede ser mayor");
  });
});
