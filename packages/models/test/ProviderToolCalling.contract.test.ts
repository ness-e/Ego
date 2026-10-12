import { describe, it, expect, vi } from "vitest";
import { OpenAICompatibleProvider } from "../src/providers/OpenAICompatibleProvider.js";

describe("C01 contract: tools must reach /chat/completions", () => {
  it("envía tools y parsea tool_calls", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "", tool_calls: [
        { id: "call_1", type: "function", function: { name: "fs_read_file", arguments: "{\"path\":\"src/main.ts\"}" } }
      ] }, finish_reason: "tool_calls" }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const p = new OpenAICompatibleProvider({ providerId: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "sk-test-1234567890" });
    const res = await p.generate("gpt-4o", {
      messages: [{ role: "user", content: "lee src/main.ts" }],
      tools: [{ name: "fs_read_file", description: "Lee archivo", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }],
      toolChoice: "auto",
    });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.tools[0].function.name).toBe("fs_read_file");
    expect(res.toolCalls?.[0]?.name).toBe("fs_read_file");
    expect(res.finishReason).toBe("tool_calls");
    vi.unstubAllGlobals();
  });
});
