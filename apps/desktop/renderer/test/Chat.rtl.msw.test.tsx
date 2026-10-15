import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { EGO_API_BASE, EGO_STREAM_FULL, egoHandlers } from "./msw/ego-handlers.js";

const server = setupServer(...egoHandlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  cleanup();
});

afterAll(() => {
  server.close();
});

type ChatKind = "chat" | "memory" | "snapshots";

interface StreamLine {
  delta?: string;
}

/** Harness mínimo: composer (textbox + botón) contra MSW, sin `window.ego`. */
function ChatHarness({ endpoint, kind }: { endpoint: string; kind: ChatKind }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [snapshotOk, setSnapshotOk] = useState(false);

  async function readStream(res: Response): Promise<void> {
    const reader = res.body?.getReader();
    if (!reader) throw new Error("sin body streameable");
    const decoder = new TextDecoder();
    let acc = "";
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = JSON.parse(line) as StreamLine;
        acc += parsed.delta ?? "";
        setText(acc);
      }
    }
  }

  async function send(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${EGO_API_BASE}${endpoint}`, {
        method: kind === "snapshots" ? "GET" : "POST",
        headers: { "Content-Type": "application/json" },
        body: kind === "snapshots" ? undefined : JSON.stringify({ prompt: "hola" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: "desconocido" }))) as {
          error?: string;
        };
        setError(`Error ${res.status}: ${body.error ?? "desconocido"}`);
        return;
      }
      if (kind === "memory") {
        const hits = (await res.json()) as Array<{
          record?: { payload?: string };
        }>;
        setOptions(
          hits.map((h) => {
            try {
              const payload = JSON.parse(h.record?.payload ?? "{}") as { titulo?: string };
              return payload.titulo ?? "(sin título)";
            } catch {
              return "(ilegible)";
            }
          }),
        );
      } else if (kind === "snapshots") {
        setSnapshotOk(true);
      } else if ((res.headers.get("content-type") ?? "").includes("ndjson")) {
        await readStream(res);
      } else {
        const data = (await res.json()) as { text?: string };
        setText(data.text ?? "");
      }
    } catch (err) {
      setError(`Error de red: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setPending(false);
    }
  }

  const [draft, setDraft] = useState("");
  return (
    <div>
      <label>
        Mensaje
        <input aria-label="Mensaje" value={draft} onChange={(e) => setDraft(e.target.value)} />
      </label>
      <button type="button" onClick={() => void send()}>
        Enviar
      </button>
      {pending && <p role="status">Enviando…</p>}
      {error && <p role="alert">{error}</p>}
      {kind === "chat" && !error && (
        <div role="log" aria-label="Respuesta">
          <p>{text}</p>
        </div>
      )}
      {kind === "memory" && options.length > 0 && (
        <div role="listbox" aria-label="Resultados">
          {options.map((o) => (
            <div key={o} role="option" aria-selected="false">
              {o}
            </div>
          ))}
        </div>
      )}
      {kind === "snapshots" && snapshotOk && <p role="status">Snapshots al día</p>}
    </div>
  );
}

describe("Chat RTL + MSW — llmStream/memory/snapshots por comportamiento", () => {
  it("streaming ok: pinta chunks incrementales hasta el texto final", async () => {
    const user = userEvent.setup();
    render(<ChatHarness endpoint="/ego/llmStream" kind="chat" />);

    await user.type(screen.getByRole("textbox", { name: "Mensaje" }), "hola");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await screen.findByText(/Hola/);
    expect(await screen.findByText(EGO_STREAM_FULL)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("streaming error: 500 muestra alerta sin reintentar", async () => {
    const user = userEvent.setup();
    render(<ChatHarness endpoint="/ego/llmStreamError" kind="chat" />);

    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/500.*boom/);
  });

  it("latencia: skeleton visible durante la espera y texto final después", async () => {
    const user = userEvent.setup();
    render(<ChatHarness endpoint="/ego/llmStreamSlow" kind="chat" />);

    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(screen.getByRole("status")).toHaveTextContent(/Enviando/);
    expect(await screen.findByText(EGO_STREAM_FULL)).toBeTruthy();
  });

  it("401: alerta de no autorizado", async () => {
    const user = userEvent.setup();
    render(<ChatHarness endpoint="/ego/llmStreamProtected" kind="chat" />);

    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/401.*unauthorized/);
  });

  it("404: alerta de no encontrado", async () => {
    const user = userEvent.setup();
    render(<ChatHarness endpoint="/ego/llmStreamMissing" kind="chat" />);

    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/404/);
  });

  it("429: alerta de rate limit", async () => {
    const user = userEvent.setup();
    render(<ChatHarness endpoint="/ego/llmStreamLimited" kind="chat" />);

    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/429/);
  });

  it("memory ok: resultados federados como opciones", async () => {
    const user = userEvent.setup();
    render(<ChatHarness endpoint="/ego/memory" kind="memory" />);

    await user.click(screen.getByRole("button", { name: "Enviar" }));

    const listbox = await screen.findByRole("listbox", { name: "Resultados" });
    expect(listbox).toBeTruthy();
    expect(await screen.findByRole("option", { name: "Tarifas 2026" })).toBeTruthy();
  });

  it("snapshots ok: confirma sin faltantes", async () => {
    const user = userEvent.setup();
    render(<ChatHarness endpoint="/ego/snapshots" kind="snapshots" />);

    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Snapshots al día")).toBeTruthy();
  });
});
