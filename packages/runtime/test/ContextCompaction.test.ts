import { describe, it, expect } from "vitest";
import type { ModelMessage } from "@ego/models";
import {
  ContextCompactionJob,
  DEFAULT_CONTEXT_COMPACTION_SETTINGS,
  evaluateCompactionNeed,
  resolveContextCompactionSettings,
} from "../src/ContextCompaction.js";

function makeMessages(n: number): ModelMessage[] {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `mensaje ${i} — contenido de relleno para estimar la poda`,
  }));
}

describe("ContextCompaction (CFG-05)", () => {
  it("defaults CFG-05 exactos: threshold 0.50 / target 0.20 / auto_compact 200000 / autoMemory", () => {
    expect(DEFAULT_CONTEXT_COMPACTION_SETTINGS.compressionThreshold).toBe(0.5);
    expect(DEFAULT_CONTEXT_COMPACTION_SETTINGS.compressionTargetRatio).toBe(0.2);
    expect(DEFAULT_CONTEXT_COMPACTION_SETTINGS.autoCompactTokens).toBe(200000);
    expect(DEFAULT_CONTEXT_COMPACTION_SETTINGS.autoMemory).toBe(true);
  });

  it("resolve rechaza valores sin sentido", () => {
    expect(() => resolveContextCompactionSettings({ compressionThreshold: 0 })).toThrow();
    expect(() => resolveContextCompactionSettings({ compressionThreshold: 1.5 })).toThrow();
    expect(() => resolveContextCompactionSettings({ compressionTargetRatio: 0.9 })).toThrow();
    expect(() => resolveContextCompactionSettings({ autoCompactTokens: 0 })).toThrow();
  });

  it("evaluate: bajo umbral no compacta; ratio >= 0.50 sí; tokens >= 200000 sí", () => {
    const settings = resolveContextCompactionSettings();
    expect(evaluateCompactionNeed({ messages: [], usageRatio: 0.49 }, settings).shouldCompact).toBe(false);
    const byRatio = evaluateCompactionNeed({ messages: [], usageRatio: 0.5 }, settings);
    expect(byRatio).toEqual({ shouldCompact: true, reason: "ratio_threshold" });
    const byTokens = evaluateCompactionNeed({ messages: [], usageRatio: 0.1, estimatedTokens: 200000 }, settings);
    expect(byTokens).toEqual({ shouldCompact: true, reason: "token_limit" });
  });

  it("compact() sin isCompressionRebuild lanza (nunca mid-turn salvo compresión)", () => {
    const job = new ContextCompactionJob();
    expect(() =>
      job.compact(
        { messages: makeMessages(10), usageRatio: 0.9 },
        { isCompressionRebuild: false }
      )
    ).toThrow(/isCompressionRebuild/);
  });

  it("compact() verificada: con flag comprime hacia target 0.20 + snapshot volátil", async () => {
    const job = new ContextCompactionJob();
    const messages = makeMessages(20);
    const result = await job.compact(
      { messages, usageRatio: 0.9 },
      { isCompressionRebuild: true }
    );
    // 20 mensajes → keep floor(20*0.2)=4 + 1 resumen = 5 (ratio 0.25, techo por mínimo 1 head).
    expect(result.messages.length).toBeLessThanOrEqual(6);
    expect(result.keptRatio).toBeLessThanOrEqual(0.3);
    expect(result.summary).toContain("summarized");
    expect(result.volatileSnapshot).toContain("compression rebuild");
    // Head preservado + tail preservado + resumen intermedio marcado.
    expect(result.messages[0].content).toContain("mensaje 0");
    expect(result.messages[result.messages.length - 1].content).toContain("mensaje 19");
    expect(result.messages.some((m) => m.content.includes("[COMPRESSED CONTEXT"))).toBe(true);
  });

  it("compactSync() opera de forma síncrona sin devolver Promise", () => {
    const job = new ContextCompactionJob();
    const messages = makeMessages(20);
    const result = job.compactSync(
      { messages, usageRatio: 0.9 },
      { isCompressionRebuild: true }
    );
    expect(result.messages.length).toBeLessThanOrEqual(6);
    expect(result.summary).toContain("summarized");
  });

  it("compact() con historial vacío no lanza y reporta keptRatio 1", async () => {
    const job = new ContextCompactionJob();
    const result = await job.compact({ messages: [], usageRatio: 0.9 }, { isCompressionRebuild: true });
    expect(result.messages).toEqual([]);
    expect(result.keptRatio).toBe(1);
  });

  describe("Summarizer inyectable, fallback heurístico e invariantes", () => {
    it("(a) compact() con summarizer fake inyectado reemplaza el bloque comprimido y NO usa el recorte antiguo", async () => {
      const job = new ContextCompactionJob();
      const messages = makeMessages(20);
      let capturedPrompt = "";
      let capturedDroppedCount = 0;

      const fakeSummarizer = async (dropped: ModelMessage[], systemPrompt?: string) => {
        capturedPrompt = systemPrompt ?? "";
        capturedDroppedCount = dropped.length;
        return "=== RESUMEN FAKE DE ALTA FIDELIDAD: DECISIONES Y ARCHIVOS PRESERVADOS ===";
      };

      const result = await job.compact(
        { messages, usageRatio: 0.9 },
        { isCompressionRebuild: true, summarizer: fakeSummarizer }
      );

      expect(capturedDroppedCount).toBeGreaterThan(0);
      expect(result.summary).toBe("=== RESUMEN FAKE DE ALTA FIDELIDAD: DECISIONES Y ARCHIVOS PRESERVADOS ===");
      expect(result.messages.some((m) => m.content.includes("=== RESUMEN FAKE DE ALTA FIDELIDAD"))).toBe(true);
      // NO debe tener el texto del slice antiguo
      expect(result.summary).not.toContain("Context compacted:");
      expect(result.summary).not.toContain("— contenido de relleno");
    });

    it("(a-prompt) el prompt de sistema del summarizer exige conservar decisiones, rutas, errores, tareas y restricciones", async () => {
      const job = new ContextCompactionJob();
      const messages = makeMessages(15);
      let capturedPrompt = "";

      await job.compact(
        { messages, usageRatio: 0.9 },
        {
          isCompressionRebuild: true,
          summarizer: async (_msgs, prompt) => {
            capturedPrompt = prompt ?? "";
            return "Resumen OK";
          },
        }
      );

      expect(capturedPrompt.toLowerCase()).toContain("decisiones");
      expect(capturedPrompt.toLowerCase()).toContain("rutas");
      expect(capturedPrompt.toLowerCase()).toContain("errores");
      expect(capturedPrompt.toLowerCase()).toContain("tareas");
      expect(capturedPrompt.toLowerCase()).toContain("restricciones");
    });

    it("(b) summarizer que lanza excepción cae al fallback heurístico sin lanzar", async () => {
      const job = new ContextCompactionJob();
      const messages = makeMessages(20);

      const failingSummarizer = async () => {
        throw new Error("Simulated LLM API failure (503 Service Unavailable)");
      };

      let result: any;
      expect(() => {
        // No debe lanzar síncrona ni asíncronamente
      }).not.toThrow();

      result = await job.compact(
        { messages, usageRatio: 0.9 },
        { isCompressionRebuild: true, summarizer: failingSummarizer }
      );

      expect(result).toBeDefined();
      expect(result.summary).toContain("Context compacted:");
      expect(result.summary).toContain("Tools usadas:");
      expect(result.summary).toContain("Rutas detectadas:");
      expect(result.messages.length).toBeLessThanOrEqual(6);
    });

    it("(b) summarizer que devuelve vacío o agota timeout cae al fallback heurístico", async () => {
      const job = new ContextCompactionJob();
      const messages = makeMessages(20);

      // Caso 1: string vacío
      const emptyResult = await job.compact(
        { messages, usageRatio: 0.9 },
        { isCompressionRebuild: true, summarizer: async () => "   " }
      );
      expect(emptyResult.summary).toContain("Context compacted:");

      // Caso 2: timeout
      const slowSummarizer = async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return "Resumen demasiado tardío";
      };
      const timeoutResult = await job.compact(
        { messages, usageRatio: 0.9 },
        {
          isCompressionRebuild: true,
          summarizer: slowSummarizer,
          summarizerTimeoutMs: 30,
        }
      );
      expect(timeoutResult.summary).toContain("Context compacted:");
      expect(timeoutResult.summary).not.toContain("Resumen demasiado tardío");
    });

    it("(fallback) heurístico mejorado reporta tools usadas, rutas detectadas y preserva líneas significativas de cada mensaje", async () => {
      const job = new ContextCompactionJob();
      const messages: ModelMessage[] = [
        { role: "user", content: "Inicio de conversación" },
        { role: "assistant", content: "Voy a leer packages/runtime/src/ContextCompaction.ts", toolCalls: [{ id: "t1", name: "read_file", arguments: {} }] },
        { role: "tool", name: "read_file", toolCallId: "t1", content: "Contenido de C:\\Users\\Eros\\repo\\archivo.ts leído con éxito" },
        { role: "assistant", content: "Operación completada sin errores en docs/architecture/vision-general.md" },
        { role: "user", content: "¿Podemos continuar con el siguiente paso?" },
        { role: "assistant", content: "Encontré un fallo previo: Error: EACCES en /var/log/ego.log" },
        { role: "user", content: "Fin de la conversación previa" },
        { role: "assistant", content: "Último turno reciente 1" },
        { role: "user", content: "Último turno reciente 2" },
      ];

      const result = await job.compact(
        { messages, usageRatio: 0.9 },
        { isCompressionRebuild: true }
      );

      // Debe reportar tools usadas
      expect(result.summary).toContain("Tools usadas:");
      expect(result.summary).toContain("read_file");

      // Debe reportar rutas detectadas
      expect(result.summary).toContain("Rutas detectadas:");
      expect(result.summary).toContain("packages/runtime/src/ContextCompaction.ts");

      // Debe conservar rol y líneas significativas
      expect(result.summary).toContain("[assistant]");
      expect(result.summary).toContain("[tool]");
      expect(result.summary).toContain("[user]");
    });

    it("(c-system) invariante: nunca comprime el system prompt inicial", async () => {
      const job = new ContextCompactionJob();
      const initialSystemPrompt = "SYSTEM PROMPT INMUTABLE EGO: Sistema Operativo Cognitivo";
      const messages: ModelMessage[] = [
        { role: "system", content: initialSystemPrompt },
        ...makeMessages(20),
      ];

      const result = await job.compact(
        { messages, usageRatio: 0.9 },
        { isCompressionRebuild: true }
      );

      // El system prompt inicial debe ser EXACTAMENTE el primer mensaje
      expect(result.messages[0].role).toBe("system");
      expect(result.messages[0].content).toBe(initialSystemPrompt);
      // El resumen comprimido es un segundo mensaje de sistema posterior
      const summaryMsg = result.messages.find((m) => m.content.includes("[COMPRESSED CONTEXT"));
      expect(summaryMsg).toBeDefined();
      expect(result.messages.indexOf(summaryMsg!)).toBeGreaterThan(0);
    });

    it("(c-protected) invariante: respeta los últimos N mensajes protegidos (protectedTailCount)", async () => {
      const job = new ContextCompactionJob();
      const messages = makeMessages(25);
      const lastFour = messages.slice(-4);

      const result = await job.compact(
        { messages, usageRatio: 0.9 },
        { isCompressionRebuild: true, protectedTailCount: 4 }
      );

      // Los últimos 4 mensajes del resultado deben coincidir exactamente con los 4 últimos originales
      const resultTail = result.messages.slice(-4);
      expect(resultTail.map((m) => m.content)).toEqual(lastFour.map((m) => m.content));
    });

    it("(c-tools) invariante: nunca parte un par assistant tool_call / tool result", async () => {
      const job = new ContextCompactionJob();
      const messages: ModelMessage[] = [
        { role: "system", content: "System Base" },
        { role: "user", content: "Pregunta 1" },
        {
          role: "assistant",
          content: "Llamando herramienta de memoria",
          toolCalls: [{ id: "call_mem_1", name: "vanta_memory", arguments: { q: "test" } }],
        },
        {
          role: "tool",
          name: "vanta_memory",
          toolCallId: "call_mem_1",
          content: "Resultado de memoria 1",
        },
        { role: "assistant", content: "Respuesta 1" },
        { role: "user", content: "Pregunta 2" },
        { role: "assistant", content: "Respuesta 2" },
        { role: "user", content: "Pregunta 3" },
        {
          role: "assistant",
          content: "Llamando herramienta de archivos",
          toolCalls: [{ id: "call_file_2", name: "file_write", arguments: { path: "a.txt" } }],
        },
        {
          role: "tool",
          name: "file_write",
          toolCallId: "call_file_2",
          content: "Archivo escrito con éxito",
        },
        { role: "assistant", content: "Confirmación final" },
        { role: "user", content: "Turno reciente final" },
      ];

      const result = await job.compact(
        { messages, usageRatio: 0.9 },
        { isCompressionRebuild: true }
      );

      // Verificación de integridad: ningún mensaje 'tool' puede quedar huérfano (sin su assistant con toolCalls previo)
      for (let i = 0; i < result.messages.length; i++) {
        const msg = result.messages[i];
        if (msg.role === "tool") {
          // El mensaje inmediatamente anterior o uno previo contiguo del mismo bloque debe ser assistant con toolCalls
          let foundMatchingAssistant = false;
          for (let j = i - 1; j >= 0; j--) {
            const prev = result.messages[j];
            if (prev.role === "assistant" && prev.toolCalls?.some((tc) => tc.id === msg.toolCallId)) {
              foundMatchingAssistant = true;
              break;
            }
            if (prev.role !== "tool") {
              break;
            }
          }
          expect(foundMatchingAssistant).toBe(true);
        }
        if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
          // Si hay assistant con toolCalls en el resultado, sus herramientas deben estar en el resultado
          for (const tc of msg.toolCalls) {
            const hasToolResult = result.messages.some(
              (m) => m.role === "tool" && m.toolCallId === tc.id
            );
            expect(hasToolResult).toBe(true);
          }
        }
      }
    });
  });
});

