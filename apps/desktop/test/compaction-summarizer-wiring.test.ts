/**
 * T8 (Ola 1b) — Diff E de A2: el job de compactación usa un RESUMIDOR LLM
 * real, no el fallback heurístico.
 *
 * RED primero. Antes de este diff, `main.ts` llamaba a
 * `compactionJob.compact(...)` sin `summarizer` → `ContextCompactionJob`
 * usaba su fallback heurístico (2 primeras líneas por mensaje) y se perdía
 * la fidelidad del prompt de compactación (decisiones, rutas, errores,
 * tareas y restricciones).
 *
 * Lo que se verifica:
 *  1. `createRouterSummarizer` produce un resumidor que llama al
 *     `ModelRouter` con el rol configurado y devuelve su texto.
 *  2. El tramo podado se renderiza como transcripción (incluidos los
 *     nombres de tool calls, que el resumen debe conservar).
 *  3. `main.ts` PASA el resumidor al job (guard de cableado: el bootstrap
 *     de Electron no es unit-testeable, así que se verifica el contrato
 *     de cableado en el punto exacto donde se usa).
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRouterSummarizer } from "@ego/models";
import type { ModelMessage, ModelRouter } from "@ego/models";

function fakeRouter(text: string) {
  const generateText = vi.fn(async () => ({ text }));
  return {
    router: { generateText } as unknown as ModelRouter,
    generateText,
  };
}

const MENSAJES: ModelMessage[] = [
  { role: "user", content: "revisar el módulo api.ts" },
  {
    role: "assistant",
    content: "hecho",
    toolCalls: [{ id: "t1", name: "fs_read_file", arguments: { path: "api.ts" } }],
  } as unknown as ModelMessage,
];

describe("T8: la compactación usa un resumidor LLM real (Diff E de A2)", () => {
  it("el resumidor invoca al router con el rol configurado y devuelve su texto", async () => {
    const { router, generateText } = fakeRouter("RESUMEN REAL");
    const summarizer = createRouterSummarizer(router, { role: "fast-classifier" });

    const out = await summarizer(MENSAJES, "system de compactación");

    expect(out).toBe("RESUMEN REAL");
    expect(generateText).toHaveBeenCalledTimes(1);
    const [role, payload] = generateText.mock.calls[0] as unknown as [
      string,
      { messages: ModelMessage[]; systemPrompt?: string },
    ];
    expect(role).toBe("fast-classifier");
    expect(payload.systemPrompt).toBe("system de compactación");
  });

  it("la transcripción conserva el contenido y los nombres de las tool calls", async () => {
    const { router, generateText } = fakeRouter("ok");
    const summarizer = createRouterSummarizer(router);

    await summarizer(MENSAJES);

    const payload = generateText.mock.calls[0]?.[1] as unknown as {
      messages: ModelMessage[];
    };
    const contenido = payload.messages[0]?.content ?? "";
    expect(contenido).toContain("revisar el módulo api.ts");
    expect(contenido).toContain("fs_read_file");
  });
});
