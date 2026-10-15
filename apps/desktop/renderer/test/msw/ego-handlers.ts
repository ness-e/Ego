import { delay, http, HttpResponse } from "msw";

/**
 * Handlers MSW (msw ^2) para la superficie browser del renderer.
 * Base `http://localhost`: misma convención que el fetch-proxy de main
 * (`apps/desktop/test/msw/handlers.ts`), pero contra los endpoints que el
 * renderer consume vía `fetch` en lugar del bridge `window.ego`.
 *
 * Cobertura: `llmStream` (streaming NDJSON) / `memory` / `snapshots` en
 * variantes ok + error 500 + latencia + 401/404/429.
 */
export const EGO_API_BASE = "http://localhost";

export const EGO_STREAM_CHUNKS = ["Hola ", "mundo"] as const;
export const EGO_STREAM_FULL = EGO_STREAM_CHUNKS.join("");

function ndjsonStream(chunks: readonly string[], gapMs: number): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const [i, chunk] of chunks.entries()) {
        if (i > 0) await delay(gapMs);
        controller.enqueue(encoder.encode(`${JSON.stringify({ delta: chunk })}\n`));
      }
      controller.close();
    },
  });
}

export const egoHandlers = [
  // llmStream ok: streaming NDJSON ("Hola " inmediato + "mundo" tras 150ms).
  http.post(`${EGO_API_BASE}/ego/llmStream`, () => {
    return new HttpResponse(ndjsonStream(EGO_STREAM_CHUNKS, 150), {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
    });
  }),

  // llmStream error: 500 sin reintento.
  http.post(`${EGO_API_BASE}/ego/llmStreamError`, () => {
    return HttpResponse.json({ ok: false, error: "boom" }, { status: 500 });
  }),

  // llmStream latencia: responde tras 400ms (el harness muestra skeleton).
  http.post(`${EGO_API_BASE}/ego/llmStreamSlow`, async () => {
    await delay(400);
    return HttpResponse.json(
      { ok: true, turnId: "turn_slow_1", text: EGO_STREAM_FULL },
      { status: 200 },
    );
  }),

  // llmStream 401: sin credenciales.
  http.post(`${EGO_API_BASE}/ego/llmStreamProtected`, () => {
    return HttpResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }),

  // llmStream 404: endpoint inexistente.
  http.post(`${EGO_API_BASE}/ego/llmStreamMissing`, () => {
    return HttpResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }),

  // llmStream 429: rate limit con Retry-After.
  http.post(`${EGO_API_BASE}/ego/llmStreamLimited`, () => {
    return new HttpResponse(JSON.stringify({ ok: false, error: "rate limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "1" },
    });
  }),

  // memory ok: búsqueda federada con corte de confianza (mismo shape que `ego()` mock).
  http.post(`${EGO_API_BASE}/ego/memory`, () => {
    return HttpResponse.json(
      [
        {
          score: 0.94,
          record: {
            namespace: "kb/docs",
            key: "tarifa-base-2026",
            payload: JSON.stringify({ titulo: "Tarifas 2026", contenido: "límite 150 USD/hora" }),
          },
        },
      ],
      { status: 200 },
    );
  }),

  // snapshots ok: sin faltantes.
  http.get(`${EGO_API_BASE}/ego/snapshots`, () => {
    return HttpResponse.json({ ok: true, missing: [] }, { status: 200 });
  }),
];
