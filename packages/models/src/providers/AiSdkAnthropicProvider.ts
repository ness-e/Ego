import { createAnthropic } from "@ai-sdk/anthropic";
import {
  generateText,
  jsonSchema,
  streamText,
  tool,
  type JSONSchema7,
  type ModelMessage,
} from "ai";
import type {
  EgoModelInterface,
  ModelGenerateOptions,
  ModelGenerateResult,
  ModelProviderId,
  ModelStreamChunk,
} from "../types.js";

export interface AiSdkAnthropicProviderOptions {
  apiKey?: string;
  baseURL?: string;
  fetch?: typeof fetch;
}

/**
 * Proveedor Anthropic (Claude, formato nativo Messages API vía SDK).
 * Tool calling real en `generate` y `stream`. Sin red en `isAvailable`:
 * la disponibilidad se decide por presencia de key/config (el router resuelve).
 *
 * Entrada verificada contra el source instalado (@ai-sdk/anthropic 4.0.78,
 * `dist/index.d.ts`): el provider es callable — `client(modelId)` es la
 * entrada canónica a Messages API; `.chat()`/`.messages()` son alias
 * idénticos. Se usa `client(modelId)` (nativo, sin Responses API).
 */
export class AiSdkAnthropicProvider implements EgoModelInterface {
  readonly providerId: ModelProviderId = "anthropic";
  private readonly apiKey: string;
  private readonly client: ReturnType<typeof createAnthropic>;

  constructor(opts: AiSdkAnthropicProviderOptions = {}) {
    this.apiKey = opts.apiKey ?? "";
    this.client = createAnthropic({
      apiKey: this.apiKey,
      baseURL: opts.baseURL,
      fetch: opts.fetch,
    });
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  async generate(modelId: string, options: ModelGenerateOptions): Promise<ModelGenerateResult> {
    const result = await generateText({
      // Entrada nativa Messages API (/messages): el SDK absorbe la
      // diferencia `tool_use` (Anthropic) vs `tool_calls` (OpenAI).
      model: this.client(modelId),
      messages: this.toMessages(options),
      tools: this.toTools(options),
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
    const result = streamText({
      // Entrada nativa Messages API SSE; mismo borde que el resto de providers.
      model: this.client(modelId),
      messages: this.toMessages(options),
      tools: this.toTools(options),
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

  private toTools(options: ModelGenerateOptions) {
    if (!options.tools?.length) return undefined;
    return Object.fromEntries(
      options.tools.map((t) => [
        t.name,
        tool({
          description: t.description,
          inputSchema: jsonSchema(t.parameters as unknown as JSONSchema7),
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
