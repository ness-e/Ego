# AI SDK Model Adapters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Proveedores reales OpenAI, Anthropic, Google, DeepSeek, Ollama/LMStudio vía Vercel AI SDK como adaptador detrás de `EgoModelInterface`, con tool calling real en `generate` y `stream`, keys solo en main via safeStorage/Credential Manager, y Mock como fallback.

**Architecture:** `EgoModelInterface` y `ModelRouter` no cambian de contrato (solo se extiende `ModelStreamChunk` con `tool-call-delta`). Nuevos `AiSdk*Provider` traducen Ego↔AI SDK en el borde. `OpenAICompatibleProvider` se corrige (C01) y queda como adaptador directo legacy para endpoints custom. Registro real solo en `apps/desktop/src/main.ts` (main process), nunca renderer.

**Tech Stack:** pnpm, TypeScript strict, `ai` + `@ai-sdk/openai` + `@ai-sdk/anthropic` + `@ai-sdk/google` pineados, `zod`, `vitest`, Electron `safeStorage`, `@ego/security` (cuando SEC-03 cierre; mientras tanto helpers de `main.ts`).

**Decisiones documentadas aplicadas:** `docs/engineering/integraciones.md:103-113` (Keychain, IPC tipado), `docs/agent-ops/tasks/INT-02.md:21-28` + `plans/2026-10-09-plan-20-tareas-mvp.md:978-979` (env en main como bootstrap, fallback mock), `Backlog.md:450-451` (SEC-03/04 pendientes), `vision-general.md:34,69` + `glosario.md:52-53` (multi-proveedor + AI SDK adaptador), `plan-20-tareas-mvp.md:917-918` (eventos IPC discretos, tools turno a turno).

---

### Task 1: Reproducir C01 con test de contrato (TDD rojo)
- **Ruta:** ego-worker
- **Estado:** ✅ COMPLETED
- **Contrato:** `pnpm --filter @ego/models test -- ProviderToolCalling` → 1 failed (rojo TDD)

**Files:**
- Create: `packages/models/test/ProviderToolCalling.contract.test.ts`
- Modify: none
- Test: `packages/models/test/ProviderToolCalling.contract.test.ts`

**Step 1: Write the failing test**

```ts
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ego/models test -- ProviderToolCalling`
Expected: FAIL (`body.tools` undefined, `toolCalls` undefined)

**Step 3: No implementation (queda para Task 2)**

**Step 4: Commit**

```bash
git add packages/models/test/ProviderToolCalling.contract.test.ts
git commit -m "test: add failing C01 tool-calling contract"
```

---

### Task 2: Fix mínimo C01 en `OpenAICompatibleProvider` (adaptador directo legacy)
- **Ruta:** ego-worker
- **Estado:** ✅ COMPLETED
- **Contrato:** `pnpm --filter @ego/models test -- ProviderToolCalling` PASS + `pnpm --filter @ego/models typecheck` exit 0 + suite 13/13

**Files:**
- Modify: `packages/models/src/providers/OpenAICompatibleProvider.ts:54-108` (generate), `:121-208` (stream)
- Test: `packages/models/test/ProviderToolCalling.contract.test.ts`

**Step 1: Test ya existe (Task 1 rojo)**

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ego/models test -- ProviderToolCalling`
Expected: FAIL

**Step 3: Write minimal implementation**

En `generate`, tras `maxTokens/responseFormat`, añadir:

```ts
if (options.tools?.length) {
  payload.tools = options.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  payload.tool_choice = options.toolChoice === "none" ? "none" : options.toolChoice === "required" ? "required" : options.toolChoice && typeof options.toolChoice === "object" ? { type: "function", function: { name: options.toolChoice.name } } : "auto";
}
```

Y ampliar el tipo de respuesta a `tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>`; tras `choice`:

```ts
const rawCalls = (choice?.message as { tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> })?.tool_calls ?? [];
const toolCalls = rawCalls.map((c) => { let args: Record<string, unknown> = {}; try { args = JSON.parse(c.function.arguments || "{}"); } catch { args = { _raw: c.function.arguments }; } return { id: c.id, name: c.function.name, arguments: args }; });
if (choice?.finish_reason === "tool_calls" || toolCalls.length) return { text, finishReason: "tool_calls", toolCalls, usage: { promptTokens, completionTokens, totalTokens, estimatedCostUsd: 0.0 } };
```

En `stream`: mismo `payload.tools/tool_choice`; en el parse SSE tipar `delta?: { content?: string; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> }`, acumular por índice `acc: Array<{ id: string; name: string; args: string }>` y al final construir `toolCalls` igual que en generate (con `finishReason "tool_calls"` si hubo).

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ego/models test -- ProviderToolCalling`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/models/src/providers/OpenAICompatibleProvider.ts packages/models/test/ProviderToolCalling.contract.test.ts
git commit -m "fix: wire tools/tool_calls in OpenAICompatibleProvider (C01)"
```

---

### Task 3: Pinear deps AI SDK en `@ego/models`
- **Ruta:** ego-lead
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/models typecheck` exit 0 con deps AI SDK instaladas

**Files:**
- Modify: `packages/models/package.json:19-26`
- Test: `pnpm --filter @ego/models typecheck`

**Step 1: Resolver versiones (no adivinar)**

Run: `pnpm view ai version && pnpm view @ai-sdk/openai version && pnpm view @ai-sdk/anthropic version && pnpm view @ai-sdk/google version`
Expected: cuatro versiones impresas (referencia era línea `ai@5` / providers `@2` en 2025-2026; pinear lo que devuelva el registry hoy).

**Step 2: Añadir pineadas exactas (ejemplo, ajustar a lo impreso)**

```json
"dependencies": {
  "ai": "5.0.x",
  "@ai-sdk/openai": "2.0.x",
  "@ai-sdk/anthropic": "2.0.x",
  "@ai-sdk/google": "2.0.x",
  "zod": "^3.23.8"
}
```

**Step 3: Instalar y verificar**

Run: `pnpm install --frozen-lockfile=false && pnpm --filter @ego/models typecheck`
Expected: exit 0, lock actualizado. (Luego CI vuelve a `--frozen-lockfile`; ver Task 12.)

**Step 4: Commit**

```bash
git add packages/models/package.json pnpm-lock.yaml
git commit -m "chore: pin ai sdk adapters in @ego/models"
```

---

### Task 4: Extender tipos (chunk `tool-call-delta` + descriptores Google/DeepSeek)
- **Ruta:** ego-arch
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/models typecheck` exit 0 (chunk tool-call-delta aditivo)

**Files:**
- Modify: `packages/models/src/types.ts:60-69,12`
- Test: `pnpm --filter @ego/models typecheck`

**Step 1: Write minimal type change**

```ts
export type ModelProviderId = "anthropic" | "openai" | "deepseek" | "google" | "ollama" | "mock";
export interface ModelStreamChunk {
  type: "text-delta" | "reasoning-delta" | "tool-call-delta" | "error" | "finish";
  delta?: string;
  finishReason?: string;
  toolCallId?: string;
  toolName?: string;
  argsDelta?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}
```

En `ModelRouter.registerDefaultModels` añadir descriptores `gemini-2.x` (provider `google`, caps text+vision+tool_calling+streaming, costo según registry) y `deepseek-chat` (provider `deepseek`, OpenAI-compatible). No tocar `EgoModelInterface`.

**Step 2: Run**

Run: `pnpm --filter @ego/models typecheck`
Expected: PASS (los consumidores viejos siguen compilando; el nuevo `type` es aditivo).

**Step 3: Commit**

```bash
git add packages/models/src/types.ts packages/models/src/ModelRouter.ts
git commit -m "feat: extend stream chunk with tool-call-delta and google/deepseek descriptors"
```

---

### Task 5: `AiSdkOpenAIProvider` (OpenAI + baseURL custom)
- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/models test -- AiSdkProviders` PASS + typecheck exit 0

**Files:**
- Create: `packages/models/src/providers/AiSdkOpenAIProvider.ts`
- Modify: `packages/models/src/index.ts:1-4`
- Test: `packages/models/test/AiSdkProviders.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { AiSdkOpenAIProvider } from "../src/providers/AiSdkOpenAIProvider.js";
describe("AiSdkOpenAI", () => {
  it("expone providerId openai y está indisponible sin key", async () => {
    const p = new AiSdkOpenAIProvider({ apiKey: "" });
    expect(p.providerId).toBe("openai");
    expect(await p.isAvailable()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ego/models test -- AiSdkProviders`
Expected: FAIL (`not defined`)

**Step 3: Write minimal implementation**

```ts
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText, jsonSchema, type CoreMessage } from "ai";
import type { EgoModelInterface, ModelGenerateOptions, ModelGenerateResult, ModelProviderId, ModelStreamChunk } from "../types.js";

export class AiSdkOpenAIProvider implements EgoModelInterface {
  readonly providerId: ModelProviderId = "openai";
  private client: ReturnType<typeof createOpenAI>;
  constructor(opts: { apiKey?: string; baseURL?: string } = {}) {
    this.client = createOpenAI({ apiKey: opts.apiKey ?? "", baseURL: opts.baseURL });
  }
  async isAvailable() { return true; } // la disponibilidad real la decide el router por key/descriptor; aquí evita llamadas de red
  private toTools(options: ModelGenerateOptions) {
    if (!options.tools?.length) return undefined;
    return Object.fromEntries(options.tools.map((t) => [t.name, { description: t.description, inputSchema: jsonSchema(t.parameters as Parameters<typeof jsonSchema>[0]) }]));
  }
  private toMessages(options: ModelGenerateOptions): CoreMessage[] {
    const msgs: CoreMessage[] = [];
    if (options.systemPrompt) msgs.push({ role: "system", content: options.systemPrompt });
    for (const m of options.messages) msgs.push(m.role === "tool" ? { role: "tool", content: [{ type: "tool-result", toolCallId: m.toolCallId!, toolName: m.name!, output: { type: "text", value: m.content } }] } as CoreMessage : { role: m.role, content: m.content } as CoreMessage);
    return msgs;
  }
  private toToolChoice(options: ModelGenerateOptions) {
    if (!options.tools?.length || !options.toolChoice || options.toolChoice === "auto") return undefined;
    if (options.toolChoice === "none") return { type: "none" as const };
    if (options.toolChoice === "required") return { type: "required" as const };
    return { type: "tool" as const, toolName: options.toolChoice.name };
  }
  async generate(modelId: string, options: ModelGenerateOptions): Promise<ModelGenerateResult> {
    const r = await generateText({ model: this.client(modelId), messages: this.toMessages(options), tools: this.toTools(options), toolChoice: this.toToolChoice(options), temperature: options.temperature ?? 0.7, maxOutputTokens: options.maxTokens });
    return { text: r.text, finishReason: r.finishReason === "tool-calls" ? "tool_calls" : "stop", toolCalls: r.toolCalls.map((c) => ({ id: c.toolCallId, name: c.toolName, arguments: (c.input ?? {}) as Record<string, unknown> })), usage: { promptTokens: r.usage.inputTokens ?? 0, completionTokens: r.usage.outputTokens ?? 0, totalTokens: r.totalUsage.inputTokens + r.totalUsage.outputTokens, estimatedCostUsd: 0.0 } };
  }
  async stream(modelId: string, options: ModelGenerateOptions, onChunk: (c: ModelStreamChunk) => void): Promise<ModelGenerateResult> {
    const r = streamText({ model: this.client(modelId), messages: this.toMessages(options), tools: this.toTools(options), toolChoice: this.toToolChoice(options), temperature: options.temperature ?? 0.7, maxOutputTokens: options.maxTokens });
    let text = ""; const calls = new Map<string, { name: string; args: string }>();
    for await (const part of r.fullStream) {
      if (part.type === "text-delta") { text += part.text; onChunk({ type: "text-delta", delta: part.text }); }
      else if (part.type === "tool-input-delta") { const e = calls.get(part.id) ?? { name: part.toolName, args: "" }; e.args += part.delta; calls.set(part.id, e); onChunk({ type: "tool-call-delta", toolCallId: part.id, toolName: part.toolName, argsDelta: part.delta }); }
    }
    const toolCalls = [...calls.entries()].map(([id, e]) => { let a: Record<string, unknown> = {}; try { a = JSON.parse(e.args || "{}"); } catch { a = { _raw: e.args }; } return { id, name: e.name, arguments: a }; });
    const usage = await r.usage;
    const result: ModelGenerateResult = { text: text || await r.text, finishReason: toolCalls.length ? "tool_calls" : "stop", toolCalls: toolCalls.length ? toolCalls : undefined, usage: { promptTokens: usage.inputTokens ?? 0, completionTokens: usage.outputTokens ?? 0, totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0), estimatedCostUsd: 0.0 } };
    onChunk({ type: "finish", finishReason: result.finishReason, usage: { promptTokens: result.usage.promptTokens, completionTokens: result.usage.completionTokens, totalTokens: result.usage.totalTokens } });
    return result;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ego/models test -- AiSdkProviders && pnpm --filter @ego/models typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/models/src/providers/AiSdkOpenAIProvider.ts packages/models/src/index.ts packages/models/test/AiSdkProviders.test.ts
git commit -m "feat: add AiSdkOpenAIProvider with tool calling"
```

---

### Task 6: `AiSdkAnthropicProvider` (Claude, formato nativo vía SDK)
- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
- **Contrato:** test providerId anthropic PASS + typecheck exit 0

**Files:**
- Create: `packages/models/src/providers/AiSdkAnthropicProvider.ts`
- Modify: `packages/models/src/index.ts`, `packages/models/test/AiSdkProviders.test.ts`

Igual estructura que Task 5 con `createAnthropic({ apiKey, baseURL })`. El SDK absorbe la diferencia `tool_use` vs `tool_calls`; el borde Ego es idéntico (mismos `toTools/toMessages/toToolChoice`, mismo parseo). Añadir test `providerId === "anthropic"` + indisponible sin key. Commit `feat: add AiSdkAnthropicProvider`.

### Task 7: `AiSdkGoogleProvider` (Gemini)
- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
- **Contrato:** test providerId google PASS + typecheck exit 0

**Files:**
- Create: `packages/models/src/providers/AiSdkGoogleProvider.ts`
- Modify: `packages/models/src/index.ts`, `packages/models/test/AiSdkProviders.test.ts`

Igual con `createGoogleGenerativeAI({ apiKey, baseURL })`, `providerId "google"`. Commit `feat: add AiSdkGoogleProvider`.

### Task 8: Compatibles (DeepSeek/Ollama/LMStudio) vía SDK + factory
- **Ruta:** ego-worker
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/models test -- createProductionRouter` PASS (sin keys → mock)

**Files:**
- Create: `packages/models/src/providers/AiSdkOpenAICompatibleProvider.ts` (wrapper `providerId` param: `deepseek | ollama`, `baseURL` + `apiKey`, delegado interno a `AiSdkOpenAIProvider`)
- Create: `packages/models/src/createProductionRouter.ts` (`createProductionRouter(keys: { openai?, anthropic?, google?, deepseek?, ollamaBaseURL? })`: registra SDK por key presente + `MockProvider` fallback; no lee `process.env` dentro del paquete)
- Modify: `packages/models/src/index.ts`
- Test: `packages/models/test/createProductionRouter.test.ts` (sin keys → solo mock+ollama-no-disponible; con keys fake → registra 4; `resolveModel` nunca lanza)

Commits: `feat: add openai-compatible SDK wrapper` + `feat: add createProductionRouter factory`.

---

### Task 9: Recablear `main.ts` (keys en main, nunca renderer)
- **Ruta:** ego-desktop
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/desktop typecheck` + `test -- ipc-tool-loop` PASS sin keys reales

**Files:**
- Modify: `apps/desktop/src/main.ts:308-382` (`setupModelProviders`, `applyModelConfig`, `currentModelConfig`), `:596-612` (init + restore `gov/settings` cifrado), `:1251` (IPC settings)
- Test: `apps/desktop/test/ipc-tool-loop.test.ts`

**Step 1: Implementación**

- `setupModelProviders(router)`: mantiene bootstrap documentado `process.env.OPENAI_API_KEY/DEEPSEEK_API_KEY/OLLAMA_BASE_URL` (stop-condition INT-02) + lee `gov/settings` descifrado con `safeStorage` (`decryptCredential`) para `anthropic/google/deepseek/openai/ollamaBaseURL`; registra `AiSdk*Provider` por key presente, `OpenAICompatibleProvider` legacy solo para custom `baseUrl`, y siempre `MockProvider` fallback. Ninguna key sale del main.
- `applyModelConfig`: misma fuente (config validada por zod ya existente `ChatStreamSchema`-style; masked `maskKey` en retornos).
- Init: `modelRouter = createProductionRouter(resolvedKeys)` o `new ModelRouter()` + registros; restore persistido con migración plano→cifrado ya existente.

**Step 2: Run**

Run: `pnpm --filter @ego/desktop typecheck && pnpm --filter @ego/desktop test -- ipc-tool-loop`
Expected: PASS (sin keys reales: resuelve mock/ollama-no-disponible).

**Step 3: Commit**

```bash
git add apps/desktop/src/main.ts apps/desktop/test/ipc-tool-loop.test.ts
git commit -m "feat: wire AI SDK providers with safeStorage BYOK in main"
```

---

### Task 10: Settings/IPC/preload para nuevas keys (zod + masked)
- **Ruta:** ego-desktop
- **Estado:** ⬜ PENDING
- **Contrato:** settings rechaza payload sin schema y nunca retorna key completa

**Files:**
- Modify: `apps/desktop/src/main.ts:1251` (canales settings), `apps/desktop/src/preload.ts:8`, `apps/desktop/src/ipc.ts:2`, `apps/desktop/renderer/lib/ego.ts`, `apps/desktop/renderer/components/*settings*`
- Test: `apps/desktop/test/ipc-tool-loop.test.ts` (rechaza payload sin schema, nunca retorna key completa)

Añadir campos `anthropicKey/googleKey` opcionales al schema existente, guardar vía `encryptCredential`, retornar solo `maskKey`. Actualizar contrato `EgoIpc` (cierra M25) y `EgoBridge` (cierra M26 para estos canales). Commit `feat: add anthropic/google BYOK settings via IPC`.

---

### Task 11: `ToolExecutionLoop` + streaming turno a turno (sin tocar Runtime)
- **Ruta:** ego-engine
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm --filter @ego/runtime test -- ToolExecutionLoop-ai-sdk` PASS sin SIMULATE_TOOL

**Files:**
- Modify: none en Runtime (ya pasa `tools` y repara texto). Solo verificar.
- Modify: `apps/desktop/src/main.ts:388` (`handleLlmStream`): reenvía `tool-call-delta/text-delta/finish` como eventos IPC discretos tipados por canales separados (no corromper texto), por `plan-20:917-918`.
- Test: `packages/runtime/test/ToolExecutionLoop-ai-sdk.test.ts` (router con stub `EgoModelInterface` que retorna `toolCalls` reales sin `SIMULATE_TOOL`; verifica multi-turno ejecuta `fs_read_file` y sintetiza final)

Run: `pnpm --filter @ego/runtime test -- ToolExecutionLoop-ai-sdk && pnpm --filter @ego/desktop test`
Expected: PASS. Commit `test: prove real toolCalls path without SIMULATE_TOOL`.

---

### Task 12: Puerta de calidad + deuda
- **Ruta:** ego-lead
- **Estado:** ⬜ PENDING
- **Contrato:** `pnpm typecheck && pnpm -r test && pnpm build` exit 0

**Files:**
- Modify: `docs/roadmap/Backlog.md` (nota en `INT-02`: superseded por AI SDK, mantiene bootstrap env; link a `SEC-03` para Credential Manager con `keytar`)
- Test: full gate

Run: `pnpm typecheck && pnpm -r test && pnpm build`
Expected: exit 0 en los tres. Sin keys reales todo cae a mock (INT-02 DoD). Probar con keys solo local, nunca en CI.

Commit final: `docs: record AI SDK adapters superseding INT-02 direct wiring`.

---

## Riesgos (de docs, ya mitigados en el plan)

- Exposición al renderer → mitigado Task 9/10 (main-only + masked).
- Sin keys en primer inicio → fallback mock + aviso UI (INT-02 DoD, Task 9).
- Incompatibilidad versión AI SDK → pineo exacto Task 3 + `pnpm-lock` diff revisado.
- Streaming vs loop multi-turno → Task 11 (turno a turno + canales discretos).

=== RECITATION 1 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Test contrato C01 creado y verificado en rojo (body.tools undefined). Commit e4f37b9.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===

=== RECITATION 2 ===
Campaign ID: 
Objetivo activo: 
Estado: completed
Última acción: Estado actualizado a COMPLETED
Resultado: Fix C01 verificado: contract PASS, typecheck exit 0, suite 13/13. Commit 54a6a8c.
Próxima acción: 
Contrato: 
Próxima tarea si completa: 
=== END RECITATION ===
