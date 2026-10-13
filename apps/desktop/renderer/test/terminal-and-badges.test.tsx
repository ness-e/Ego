import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TerminalSessionStore } from "@ego/ui-runtime";
import { useTerminalSession, useWorkspaceTerminalSessions } from "../hooks/useTerminalSession.js";
import { FileMentionBadge } from "../components/FileMentionBadge.js";

// Componente auxiliar para probar el hook useTerminalSession
function TestTerminalComponent({
  sessionId,
  store,
}: {
  sessionId?: string;
  store: TerminalSessionStore;
}) {
  const { output, status, exitCode, isRunning, isTruncated, writeStdin, close } = useTerminalSession(
    sessionId,
    { store }
  );

  return (
    <div data-testid="terminal-container">
      <div data-testid="status">{status}</div>
      <div data-testid="exitCode">{exitCode ?? "none"}</div>
      <div data-testid="isRunning">{isRunning ? "true" : "false"}</div>
      <div data-testid="isTruncated">{isTruncated ? "true" : "false"}</div>
      <pre data-testid="output">{output}</pre>
      <button data-testid="send-btn" onClick={() => writeStdin("test-input\n")}>
        Send
      </button>
      <button data-testid="close-btn" onClick={close}>
        Close
      </button>
    </div>
  );
}

// Componente auxiliar para probar useWorkspaceTerminalSessions
function TestWorkspaceSessionsComponent({
  workspaceId,
  store,
}: {
  workspaceId: string;
  store: TerminalSessionStore;
}) {
  const sessions = useWorkspaceTerminalSessions(workspaceId, { store });
  return (
    <div data-testid="ws-container">
      <div data-testid="session-count">{sessions.length}</div>
      <ul>
        {sessions.map((s) => (
          <li key={s.sessionId} data-testid={`session-${s.sessionId}`}>
            {s.title} ({s.status})
          </li>
        ))}
      </ul>
    </div>
  );
}

describe("Helmor Review Suite — TerminalSessionStore (HELM-03) & FileMentionBadge (HELM-05)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let testStore: TerminalSessionStore;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    testStore = new TerminalSessionStore();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  describe("1. Hook useTerminalSession (HELM-03)", () => {
    it("conecta de forma reactiva con la sesión y transmite chunks sin bloquear", async () => {
      testStore.createSession({
        sessionId: "term-1",
        workspaceId: "ws-1",
        command: "npm run build",
      });

      await act(async () => {
        root.render(<TestTerminalComponent sessionId="term-1" store={testStore} />);
      });

      expect(container.querySelector('[data-testid="status"]')?.textContent).toBe("running");
      expect(container.querySelector('[data-testid="isRunning"]')?.textContent).toBe("true");

      // Transmitir chunks desde el backend/PTY
      await act(async () => {
        testStore.appendOutput("term-1", "Building bundle...\n");
      });

      expect(container.querySelector('[data-testid="output"]')?.textContent).toContain("Building bundle...");

      // Finalizar sesión
      await act(async () => {
        testStore.endSession("term-1", 0);
      });

      expect(container.querySelector('[data-testid="status"]')?.textContent).toBe("exited");
      expect(container.querySelector('[data-testid="exitCode"]')?.textContent).toBe("0");
      expect(container.querySelector('[data-testid="isRunning"]')?.textContent).toBe("false");
    });

    it("observa sesiones concurrentes en el workspace mediante useWorkspaceTerminalSessions", async () => {
      await act(async () => {
        root.render(<TestWorkspaceSessionsComponent workspaceId="ws-1" store={testStore} />);
      });

      expect(container.querySelector('[data-testid="session-count"]')?.textContent).toBe("0");

      await act(async () => {
        testStore.createSession({
          sessionId: "proc-a",
          workspaceId: "ws-1",
          command: "pnpm dev",
        });
        testStore.createSession({
          sessionId: "proc-b",
          workspaceId: "ws-1",
          command: "pnpm test",
        });
      });

      expect(container.querySelector('[data-testid="session-count"]')?.textContent).toBe("2");
      expect(container.textContent).toContain("pnpm dev (running)");
      expect(container.textContent).toContain("pnpm test (running)");
    });
  });

  describe("2. Componente FileMentionBadge (HELM-05)", () => {
    it("renderiza insignias de código, imagen y documentos con sus respectivos metadatos", async () => {
      await act(async () => {
        root.render(
          <div>
            <FileMentionBadge path="src/main.ts" className="test-code" />
            <FileMentionBadge path="assets/logo.png" className="test-img" />
            <FileMentionBadge path="docs/README.md" className="test-doc" />
          </div>
        );
      });

      expect(container.textContent).toContain("main.ts");
      expect(container.textContent).toContain("logo.png");
      expect(container.textContent).toContain("README.md");
    });

    it("soporta botón de remoción y evento onOpen", async () => {
      const handleRemove = vi.fn();
      const handleOpen = vi.fn();

      await act(async () => {
        root.render(
          <FileMentionBadge
            path="config.json"
            removable={true}
            onRemove={handleRemove}
            onOpen={handleOpen}
          />
        );
      });

      const openBtn = container.querySelector('button[aria-label="Abrir config.json"]') as HTMLButtonElement;
      expect(openBtn).toBeTruthy();
      await act(async () => {
        openBtn.click();
      });
      expect(handleOpen).toHaveBeenCalledWith("config.json");

      const removeBtn = container.querySelector('button[aria-label="Quitar config.json"]') as HTMLButtonElement;
      expect(removeBtn).toBeTruthy();
      await act(async () => {
        removeBtn.click();
      });
      expect(handleRemove).toHaveBeenCalledTimes(1);
    });
  });
});
