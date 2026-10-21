import { z } from "zod";
import { ToolDefinition, ToolExecutionContext } from "../types.js";
import { evaluateExpression, ExpressionError } from "./expressionEvaluator.js";

/**
 * evalExpressionTool — tool `eval_expression` (E4, Ola 3).
 *
 * POR QUÉ NO SE LLAMA `python_repl`
 * ------------------------------
 * El guardrail `AGENTS.md` §4 prohíbe Python en el producto. Este es el
 * "REPL" del maestro §7.2, implementado como **REPL de expresiones** en
 * TypeScript: un intérprete propio (parser + evaluador) que NO usa `eval`,
 * ni `new Function`, ni `node:vm`, ni `child_process`.
 *
 * El nombre de la tool es honesto: `eval_expression` (no `python_repl`).
 *
 * Superficie: literales, operadores, arrays, objetos planos, acceso a
 * propiedades de datos y una lista blanca de funciones puras (`Math`, `sum`,
 * `mean`, `median`, `stddev`, `clamp`, `range`, `JSON`, `String`, `Number`,
 * `Array`, `Object`). Ni `require`, ni `process`, ni `fs`, ni `__proto__`.
 *
 * Si alguna vez hace falta Python de verdad, la vía correcta es un servidor
 * MCP Python **externo** (fuera del producto), no una tool nativa.
 */

const EvalExpressionInputSchema = z.object({
  /** Expresión a evaluar (sin sentencias). */
  expression: z.string().min(1).describe("Expresión TypeScript a evaluar."),
  /** Variables disponibles para la expresión (datos planos, JSON-compatibles). */
  variables: z
    .record(z.unknown())
    .default({})
    .describe("Variables visibles en la expresión (objeto plano)."),
});

export type EvalExpressionInput = z.infer<typeof EvalExpressionInputSchema>;

/** Resultado de la tool. */
export interface EvalExpressionResult {
  /** `true` si la expresión se evaluó sin error. */
  readonly ok: boolean;
  /** Valor evaluado. */
  readonly value?: unknown;
  /** Representación JSON del valor (si es serializable). */
  readonly json?: string;
  /** Pasos de evaluación consumidos. */
  readonly steps?: number;
  /** Motivo del error (si lo hubo). */
  readonly error?: string;
}

/**
 * Crea la tool `eval_expression`.
 */
export function createEvalExpressionTool(): ToolDefinition {
  return {
    name: "eval_expression",
    description:
      "Evalúa una expresión TypeScript en un intérprete seguro (sin eval, sin vm, sin acceso al host) y devuelve su valor. Lista blanca de funciones puras: Math, sum, mean, median, stddev, clamp, range, JSON, String, Number, Array, Object.",
    category: "system",
    riskLevel: "safe",
    origin: "native",
    requiresApproval: false,
    tags: ["repl", "expression", "compute", "sandbox"],
    inputSchema: EvalExpressionInputSchema,
    execute: async (
      input: EvalExpressionInput,
      _context: ToolExecutionContext
    ): Promise<EvalExpressionResult> => {
      try {
        const result = evaluateExpression(input.expression, input.variables ?? {});
        let json: string | undefined;
        try {
          json = JSON.stringify(result.value, null, 2);
        } catch {
          json = undefined;
        }
        return { ok: true, value: result.value, json, steps: result.steps };
      } catch (err: unknown) {
        const message =
          err instanceof ExpressionError
            ? err.message
            : err instanceof Error
            ? err.message
            : String(err);
        return { ok: false, error: message };
      }
    },
  };
}
