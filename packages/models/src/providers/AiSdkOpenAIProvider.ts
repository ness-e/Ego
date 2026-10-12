import type { createOpenAI as CreateOpenAIFn } from "@ai-sdk/openai";
import type * as Ai from "ai";
import type { JSONSchema7, ModelMessage } from "ai";
import type {
  EgoModelInterface,
  ModelGenerateOptions,
  ModelGenerateResult,
  ModelProviderId,
  ModelStreamChunk,
} from "../types.js";
import { loadEsm } from "./esm-loader.js";

export interface AiSdkOpenAIProviderOptions {
  apiKey?: string;
  baseURL?: string;
  fetch?: typeof fetch;
}

/**
 * Proveedor OpenAI (y endpoints compatibles vía baseURL) sobre Vercel AI SDK.
 * Tool calling real en `generate` y `stream`. Sin red en `isAvailable`:
 * la disponibilidad se decide por presencia de key/config (el router resuelve).
 */
export class AiSdkOpenAIProvider implements EgoModelInterface {
  readonly providerId: ModelProviderId = "openai";
  private readonly apiKey: string;
  private readonly baseURL?: string;
  private readonly fetchFn?: typeof fetch;
  private clientPromise?: Promise<ReturnType<typeof CreateOpenAIFn>>;

  constructor(opts: AiSdkOpenAIProviderOptions = {}) {
    this.apiKey = opts.apiKey ?? "";
    this.baseURL = opts.baseURL;
    this.fetchFn = opts.fetch;
  }

  private getClient(): Promise<ReturnType<typeof CreateOpenAIFn>> {
    this.clientPromise ??= (async () => {
      const { createOpenAI } = await loadEsm<{ createOpenAI: typeof CreateOpenAIFn }>(
        "@ai-sdk/openai",
      );
      return createOpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
        fetch: this.fetchFn,
      });
    })();
    return this.clientPromise;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  async generate(modelId: string, options: ModelGenerateOptions): Promise<ModelGenerateResult> {
    const ai = await loadEsm<typeof Ai>("ai");
    const client = await this.getClient();
    const result = await ai.generateText({
      // .chat() = Chat Completions (/chat/completions), no Responses API:
      // compatible con endpoints OpenAI-compatibles (DeepSeek, Ollama, LMStudio).
      model: client.chat(modelId),
      messages: this.toMessages(options),
      tools: this.toTools(ai, options),
      toolChoice: this.toToolChoice(options),
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens,
      abortSignal: options.abortSignal,
    });

    const toolCalls = result.toolCalls.map((c) => ({
      id: c.toolCallId,
      name: c.toolName,
      arguments: toRecord(c.input),
    }));
    const promptTokens = result.usage.inputTokens ?? 0;
    const completionTokens = result.usage.outputTokens ?? 0;
    const finishReason = mapFinishReason(result.finishReason, toolCalls.length);
    return {
      text: result.text,
      finishReason,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCostUsd: 0.0,
      },
    };
  }

  async stream(
    modelId: string,
    options: ModelGenerateOptions,
    onChunk: (chunk: ModelStreamChunk) => void,
  ): Promise<ModelGenerateResult> {
    const ai = await loadEsm<typeof Ai>("ai");
    const client = await this.getClient();
    const result = ai.streamText({
      // .chat() = Chat Completions SSE, compatible con endpoints OpenAI-compatibles.
      model: client.chat(modelId),
      messages: this.toMessages(options),
      tools: this.toTools(ai, options),
      toolChoice: this.toToolChoice(options),
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens,
      abortSignal: options.abortSignal,
    });

    let text = "";
    const pending = new Map<string, { name: string; args: string }>();
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        text += part.text;
        onChunk({ type: "text-delta", delta: part.text });
      } else if (part.type === "tool-input-start") {
        pending.set(part.id, { name: part.toolName, args: "" });
      } else if (part.type === "tool-input-delta") {
        const entry = pending.get(part.id) ?? { name: "", args: "" };
        entry.args += part.delta;
        pending.set(part.id, entry);
        onChunk({
          type: "tool-call-delta",
          toolCallId: part.id,
          toolName: entry.name,
          argsDelta: part.delta,
        });
      }
    }

    const [toolCallsRaw, usage, finishReason, fullText] = await Promise.all([
      result.toolCalls,
      result.usage,
      result.finishReason,
      result.text,
    ]);
    const toolCalls = toolCallsRaw.map((c) => ({
      id: c.toolCallId,
      name: c.toolName,
      arguments: toRecord(c.input),
    }));
    const promptTokens = usage.inputTokens ?? 0;
    const completionTokens = usage.outputTokens ?? 0;
    const finalReason = mapFinishReason(finishReason, toolCalls.length);
    const finalUsage = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostUsd: 0.0,
    };
    onChunk({ type: "finish", finishReason: finalReason, usage: finalUsage });
    return {
      text: fullText || text,
      finishReason: finalReason,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
      usage: finalUsage,
    };
  }

  private toTools(ai: typeof Ai, options: ModelGenerateOptions) {
    if (!options.tools?.length) return undefined;
    return Object.fromEntries(
      options.tools.map((t) => [
        t.name,
        ai.tool({
          description: t.description,
          inputSchema: ai.jsonSchema(t.parameters as unknown as JSONSchema7),
        }),
      ]),
    );
  }

  private toToolChoice(options: ModelGenerateOptions) {
    if (!options.tools?.length) return undefined;
    const choice = options.toolChoice;
    if (!choice || choice === "auto") return undefined;
    if (choice === "none") return "none" as const;
    if (choice === "required") return "required" as const;
    return { type: "tool" as const, toolName: choice.name };
  }

  private toMessages(options: ModelGenerateOptions): ModelMessage[] {
    const msgs: ModelMessage[] = [];
    if (options.systemPrompt && !options.messages.some((m) => m.role === "system")) {
      msgs.push({ role: "system", content: options.systemPrompt });
    }
    for (const m of options.messages) {
      if (m.role === "system") {
        msgs.push({ role: "system", content: m.content });
      } else if (m.role === "user") {
        msgs.push({ role: "user", content: m.content });
      } else if (m.role === "assistant") {
        if (m.toolCalls?.length) {
          msgs.push({
            role: "assistant",
            content: [
              ...(m.content ? [{ type: "text" as const, text: m.content }] : []),
              ...m.toolCalls.map((c) => ({
                type: "tool-call" as const,
                toolCallId: c.id,
                toolName: c.name,
                input: c.arguments,
              })),
            ],
          });
        } else {
          msgs.push({ role: "assistant", content: m.content });
        }
      } else {
        msgs.push({
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: m.toolCallId ?? "",
              toolName: m.name ?? "",
              output: { type: "text", value: m.content },
            },
          ],
        });
      }
    }
    return msgs;
  }
}

function mapFinishReason(reason: string, toolCallCount: number): string {
  if (reason === "tool-calls" || toolCallCount > 0) return "tool_calls";
  return reason;
}

function toRecord(input: unknown): Record<string, unknown> {
  if (input === null || input === undefined || input === "") return {};
  if (typeof input === "object") return input as Record<string, unknown>;
  if (typeof input === "string") {
    try {
      const parsed: unknown = JSON.parse(input);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
      return { _raw: input };
    } catch {
      return { _raw: input };
    }
  }
  return { _raw: input };
}
