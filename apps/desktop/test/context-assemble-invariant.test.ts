/**
 * T4.2 (Ola 4) — La **puerta de invariantes** del ADR-0020: el
 * `contextAssemble()` NATIVO preserva el system prompt y no parte ningún par
 * `tool_call` / `tool_result`.
 *
 * ## Por qué esto es la precondición de E2 (Fase 06)
 * E2 (path cognitivo nativo) va a usar el motor nativo para ensamblar el
 * contexto. Si el motor **parte un par** `tool_call`/`tool_result` (deja el
 * `tool_call` sin su `tool_result` o al revés), el proveedor rechaza la
 * petición: es un error de protocolo, no de calidad de respuesta. Y si
 * **pierde el system prompt**, el modelo deja de ser "Ego".
 *
 * ## Qué verifica (empíricamente, con el binding REAL)
 * 1. El binding instalado expone `contextAssemble`.
 * 2. Dado un histórico `system` + `user` + `tool_call` + `tool_result` +
 *    `assistant`, la salida **conserva el mensaje de sistema** (íntegro).
 * 3. La salida **no parte ningún par**: cada `tool_call` del histórico que
 *    sobrevive tiene su `tool_result`, y ningún `tool_result` queda sin su
 *    `tool_call`.
 *
 * El histórico se monta sobre un store real (tmp) y el scratch se crea con
 * el helper compartido (T-X1) para no dejar 320 MB huérfanos.
 */
import { describe, it, expect, afterAll } from "vitest";
import { createScratchDir, removeScratchDir } from "./helpers/test-scratch.js";
import { EgoMemoryAdapter } from "@ego/memory";

type ChatMessage = {
  role: string;
  content: string;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

/** El handle nativo con `contextAssemble` (el tipo del adapter lo oculta a propósito). */
type NativeWithAssemble = {
  contextAssemble?: (options: {
    messages: ChatMessage[];
    token_budget: number;
  }) => Promise<unknown>;
};

let scratch: string | null = null;
let adapter: EgoMemoryAdapter | null = null;

async function openDb(): Promise<NativeWithAssemble> {
  if (adapter) return adapter.getDb() as unknown as NativeWithAssemble;
  scratch = createScratchDir("context-assemble");
  // Se abre por la **vía real del producto** (`EgoMemoryAdapter`): así se
  // verifica el binding que la app usa de verdad (y no una resolución
  // distinta que pueda apuntar a otra instalación de VantaDB).
  adapter = new EgoMemoryAdapter(scratch);
  await adapter.init();
  return adapter.getDb() as unknown as NativeWithAssemble;
}

/** El histórico de referencia: system + user + tool_call + tool_result + assistant. */
function history(): ChatMessage[] {
  return [
    { role: "system", content: "Eres Ego, un Sistema Operativo Cognitivo." },
    { role: "user", content: "lee el fichero" },
    {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "fs_read", arguments: "{}" },
        },
      ],
    },
    { role: "tool", tool_call_id: "call_1", content: "contenido del fichero" },
    { role: "assistant", content: "listo" },
  ];
}

/** Extrae los mensajes de la salida del motor (cualquier forma que devuelva). */
function messagesOf(out: unknown): ChatMessage[] {
  if (Array.isArray(out)) return out as ChatMessage[];
  if (out && typeof out === "object") {
    const o = out as Record<string, unknown>;
    for (const key of ["messages", "assembled", "context", "result"]) {
      if (Array.isArray(o[key])) return o[key] as ChatMessage[];
    }
  }
  return [];
}

afterAll(async () => {
  if (adapter) {
    try {
      await adapter.close();
    } catch {
      /* best-effort */
    }
  }
  if (scratch) removeScratchDir(scratch);
});

describe("T4.2 — invariantes del `contextAssemble()` nativo (ADR-0020)", () => {
  it("el binding instalado NO expone `contextAssemble` → E2 sigue bloqueada", async () => {
    // HALLAZGO (Ola 4, T4.2): el ADR-0020 dice que
    // "`vantadb-node@0.8.0` expone `contextAssemble(options)`", pero el
    // binding **instalado** (vantadb 0.9.0, el que resuelve
    // `packages/memory`) NO declara ese método en su superficie pública
    // (`dist/native.d.ts`, generada por napi-rs): los únicos `compact*` son
    // `compactLayout()` (vector store) y `compactWal()` (WAL).
    //
    // Consecuencia: **la invariante NO se puede verificar** y E2 (path
    // cognitivo nativo, Fase 06) **no puede arrancar** con el binding actual.
    // Este test es el GUARD: el día que el método aparezca, fallará y
    // obligará a (a) activar la verificación de las invariantes de este
    // fichero y (b) corregir el ADR-0020 (zona de A1).
    const handle = await openDb();
    expect(
      typeof handle.contextAssemble,
      "el binding YA expone contextAssemble: activa las invariantes de este fichero y corrige el ADR-0020 (A1)"
    ).toBe("undefined");
  });

  it("preserva el system prompt (íntegro) y no parte ningún par tool_call/tool_result", async () => {
    const handle = await openDb();
    if (typeof handle.contextAssemble !== "function") {
      // Sin el método no hay invariante que verificar: se documenta el
      // bloqueo en vez de dejar un test verde que no prueba nada.
      expect(
        typeof handle.contextAssemble,
        "el binding no expone contextAssemble: la invariante no es verificable todavía (ver ADR-0020)"
      ).toBe("undefined");
      return;
    }
    const input = history();
    const out = await handle.contextAssemble({
      messages: input,
      token_budget: 100000,
    });
    const messages = messagesOf(out);
    expect(
      messages.length,
      `la salida del motor no trae mensajes: ${JSON.stringify(out).slice(0, 400)}`
    ).toBeGreaterThan(0);

    // 1) El system prompt sobrevive ÍNTEGRO.
    const system = messages.find((m) => m.role === "system");
    expect(system, "el motor ha perdido el mensaje de sistema").toBeTruthy();
    expect(system!.content).toBe(
      "Eres Ego, un Sistema Operativo Cognitivo."
    );

    // 2) Ningún par queda partido.
    const callIds = new Set<string>();
    for (const m of messages) {
      for (const c of m.tool_calls ?? []) callIds.add(c.id);
    }
    const resultIds = new Set<string>();
    for (const m of messages) {
      if (m.role === "tool" && m.tool_call_id) resultIds.add(m.tool_call_id);
    }
    for (const id of callIds) {
      expect(
        resultIds.has(id),
        `la tool_call "${id}" quedó sin su tool_result (par partido)`
      ).toBe(true);
    }
    for (const id of resultIds) {
      expect(
        callIds.has(id),
        `el tool_result "${id}" quedó sin su tool_call (par partido)`
      ).toBe(true);
    }
  });

  it("con un presupuesto pequeño, el motor NO sacrifica el system prompt", async () => {
    // El `protected_prefix` es lo que garantiza esto; con el presupuesto
    // justo, el motor recorta por el final, no por la cabeza.
    const handle = await openDb();
    if (typeof handle.contextAssemble !== "function") {
      expect(typeof handle.contextAssemble).toBe("undefined");
      return;
    }
    const out = await handle.contextAssemble({
      messages: history(),
      token_budget: 20,
    });
    const messages = messagesOf(out);
    const system = messages.find((m) => m.role === "system");
    expect(system, "con presupuesto mínimo se perdió el system prompt").toBeTruthy();
  });
});
