import type {
  EgoModelInterface,
  ModelGenerateOptions,
  ModelGenerateResult,
  ModelProviderId,
  ModelStreamChunk,
} from "../types.js";

export interface OpenAICompatibleConfig {
  providerId: ModelProviderId;
  baseUrl: string;
  apiKey?: string;
  defaultHeaders?: Record<string, string>;
}

/**
 * Proveedor compatible con OpenAI para Cloud (OpenAI, DeepSeek) y Local (Ollama, LM Studio).
 * Utiliza fetch nativo de Node.js 22 con streaming SSE.
 */
export class OpenAICompatibleProvider implements EgoModelInterface {
  readonly providerId: ModelProviderId;
  private baseUrl: string;
  private apiKey: string;
  private defaultHeaders: Record<string, string>;

  constructor(config: OpenAICompatibleConfig) {
    this.providerId = config.providerId;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey || "";
    this.defaultHeaders = config.defaultHeaders || {};
  }

  async isAvailable(): Promise<boolean> {
    if (this.providerId === "ollama") {
      try {
        const res = await fetch(`${this.baseUrl}/models`, { method: "GET" });
        return res.ok;
      } catch {
        return false;
      }
    }
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  async generate(
    modelId: string,
    options: ModelGenerateOptions
  ): Promise<ModelGenerateResult> {
    const messages = [...options.messages];
    if (options.systemPrompt && !messages.some((m) => m.role === "system")) {
      messages.unshift({ role: "system", content: options.systemPrompt });
    }

    const payload: Record<string, unknown> = {
      model: modelId,
      messages,
      temperature: options.temperature ?? 0.7,
      stream: false,
    };

    if (options.maxTokens) {
      payload.max_tokens = options.maxTokens;
    }
    if (options.responseFormat === "json") {
      payload.response_format = { type: "json_object" };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.defaultHeaders,
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: options.abortSignal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[${this.providerId}] Error HTTP ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const choice = data.choices?.[0];
    const text = choice?.message?.content || "";
    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;
    const totalTokens = data.usage?.total_tokens || promptTokens + completionTokens;

    return {
      text,
      finishReason: choice?.finish_reason || "stop",
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: 0.0, // Calculado por ModelRouter según descriptor
      },
    };
  }

  async stream(
    modelId: string,
    options: ModelGenerateOptions,
    onChunk: (chunk: ModelStreamChunk) => void
  ): Promise<ModelGenerateResult> {
    const messages = [...options.messages];
    if (options.systemPrompt && !messages.some((m) => m.role === "system")) {
      messages.unshift({ role: "system", content: options.systemPrompt });
    }

    const payload: Record<string, unknown> = {
      model: modelId,
      messages,
      temperature: options.temperature ?? 0.7,
      stream: true,
    };

    if (options.maxTokens) {
      payload.max_tokens = options.maxTokens;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.defaultHeaders,
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: options.abortSignal,
    });

    if (!res.ok || !res.body) {
      const errText = await res.text();
      throw new Error(`[${this.providerId}] Streaming Error HTTP ${res.status}: ${errText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = "";
    let finishReason = "stop";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(dataStr) as {
              choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
            };
            const deltaContent = parsed.choices?.[0]?.delta?.content;
            if (deltaContent) {
              accumulatedText += deltaContent;
              onChunk({ type: "text-delta", delta: deltaContent });
            }
            if (parsed.choices?.[0]?.finish_reason) {
              finishReason = parsed.choices[0].finish_reason;
            }
          } catch {
            // Buffer fragmentado tolerable en SSE
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const promptTokens = Math.ceil(options.messages.reduce((a, m) => a + m.content.length, 0) / 4);
    const completionTokens = Math.ceil(accumulatedText.length / 4);
    const usage = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostUsd: 0.0,
    };

    onChunk({ type: "finish", finishReason, usage });

    return {
      text: accumulatedText,
      finishReason,
      usage,
    };
  }
}
