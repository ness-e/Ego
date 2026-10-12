import { describe, expect, it, vi, afterEach } from "vitest";
import { AiSdkOpenAIProvider } from "../src/providers/AiSdkOpenAIProvider.js";
import type { ModelStreamChunk } from "../src/types.js";

const TOOL_DEF = {
  name: "fs_read_file",
  description: "Lee archivo",
  parameters: {
    type: "object",
    properties: { path: { type: "string" } },
    required: ["path"],
  },
};

function chatCompletionResponse() {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-test-1",
      object: "chat.completion",
      created: 1720000000,
      model: "gpt-4o",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "",
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: {
                  name: "fs_read_file",
                  arguments: '{"path":"src/main.ts"}',
                },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function sseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function chatStreamResponse() {
  const base = {
    id: "chatcmpl-test-2",
    object: "chat.completion.chunk",
    created: 1720000000,
    model: "gpt-4o",
  };
  const body =
    sseFrame({
      ...base,
      choices: [{ index: 0, delta: { role: "assistant", content: "Hola" }, finish_reason: null }],
    }) +
    sseFrame({
      ...base,
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call_1",
                type: "function",
                function: { name: "fs_read_file", arguments: '{"path":' },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    }) +
    sseFrame({
      ...base,
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [{ index: 0, function: { arguments: '"src/main.ts"}' } }],
          },
          finish_reason: null,
        },
      ],
    }) +
    sseFrame({
      ...base,
      choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }) +
    "data: [DONE]\n\n";
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AiSdkOpenAI", () => {
  it("expone providerId openai y está indisponible sin key (sin red)", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error("isAvailable no debe usar red");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const p = new AiSdkOpenAIProvider({ apiKey: "" });
    expect(p.providerId).toBe("openai");
    expect(await p.isAvailable()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("está disponible con key configurada (sin red)", async () => {
    const p = new AiSdkOpenAIProvider({ apiKey: "sk-test-1234567890" });
    expect(await p.isAvailable()).toBe(true);
  });

  it("generate envía tools y parsea tool_calls contra modelo stub", async () => {
    const seen: Array<{ url: unknown; body: string }> = [];
    const stubFetch = async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url, body: (init?.body as string) ?? "" });
      return chatCompletionResponse();
    };
    const p = new AiSdkOpenAIProvider({ apiKey: "sk-test-1234567890", fetch: stubFetch });

    const res = await p.generate("gpt-4o", {
      messages: [{ role: "user", content: "lee src/main.ts" }],
      tools: [TOOL_DEF],
      toolChoice: "auto",
    });

    expect(seen).toHaveLength(1);
    expect(String(seen[0].url)).toContain("chat/completions");
    const body = JSON.parse(seen[0].body) as {
      tools: Array<{ function: { name: string } }>;
    };
    expect(body.tools[0].function.name).toBe("fs_read_file");
    expect(res.finishReason).toBe("tool_calls");
    expect(res.toolCalls?.[0]?.name).toBe("fs_read_file");
    expect(res.toolCalls?.[0]?.id).toBe("call_1");
    expect(res.toolCalls?.[0]?.arguments).toEqual({ path: "src/main.ts" });
    expect(res.usage.promptTokens).toBe(10);
    expect(res.usage.completionTokens).toBe(5);
    expect(res.usage.totalTokens).toBe(15);
  });

  it("stream reenvía text-delta y tool-call-delta y cierra con finish", async () => {
    const stubFetch = async () => chatStreamResponse();
    const p = new AiSdkOpenAIProvider({ apiKey: "sk-test-1234567890", fetch: stubFetch });

    const chunks: ModelStreamChunk[] = [];
    const res = await p.stream(
      "gpt-4o",
      {
        messages: [{ role: "user", content: "lee src/main.ts" }],
        tools: [TOOL_DEF],
      },
      (c) => chunks.push(c),
    );

    const textDeltas = chunks.filter((c) => c.type === "text-delta");
    expect(textDeltas.map((c) => c.delta).join("")).toContain("Hola");
    const toolDeltas = chunks.filter((c) => c.type === "tool-call-delta");
    expect(toolDeltas.length).toBeGreaterThan(0);
    expect(toolDeltas[0].toolCallId).toBe("call_1");
    expect(toolDeltas[0].toolName).toBe("fs_read_file");
    expect(toolDeltas.map((c) => c.argsDelta ?? "").join("")).toContain("src/main.ts");

    const finish = chunks.filter((c) => c.type === "finish");
    expect(finish).toHaveLength(1);
    expect(finish[0].finishReason).toBe("tool_calls");
    expect(finish[0].usage?.totalTokens).toBe(15);

    expect(res.finishReason).toBe("tool_calls");
    expect(res.toolCalls?.[0]?.name).toBe("fs_read_file");
    expect(res.toolCalls?.[0]?.arguments).toEqual({ path: "src/main.ts" });
    expect(res.text).toContain("Hola");
  });
});
