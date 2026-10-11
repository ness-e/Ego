import { describe, it, expect, beforeEach } from "vitest";
import { TerminalSessionStore } from "../src/TerminalSessionStore.js";

describe("TerminalSessionStore — Reactividad y Ciclo de Vida de Consola (HELM-03)", () => {
  let store: TerminalSessionStore;

  beforeEach(() => {
    store = new TerminalSessionStore();
  });

  it("crea una sesión correctamente con estado inicial 'running'", () => {
    const session = store.createSession({
      sessionId: "term_test_1",
      workspaceId: "ws_default",
      command: "pnpm test",
      cwd: "/repo",
    });

    expect(session.sessionId).toBe("term_test_1");
    expect(session.workspaceId).toBe("ws_default");
    expect(session.status).toBe("running");
    expect(session.exitCode).toBeNull();
    expect(session.command).toBe("pnpm test");
  });

  it("acumula fragmentos de salida y notifica al listener conectado", () => {
    store.createSession({
      sessionId: "term_test_2",
      workspaceId: "ws_default",
      command: "echo hello",
    });

    const chunksReceived: string[] = [];
    const attached = store.attach("term_test_2", (chunk) => {
      chunksReceived.push(chunk);
    });

    expect(attached).toBeDefined();
    expect(attached?.replayChunks.length).toBe(0);

    store.appendOutput("term_test_2", "Línea 1\n");
    store.appendOutput("term_test_2", "Línea 2\n");

    expect(chunksReceived).toEqual(["Línea 1\n", "Línea 2\n"]);

    const snap = store.getSession("term_test_2");
    expect(snap?.bufferedBytes).toBe("Línea 1\nLínea 2\n".length);
  });

  it("permite a nuevos componentes hacer replay completo de los chunks acumulados", () => {
    store.createSession({
      sessionId: "term_test_3",
      workspaceId: "ws_default",
      command: "ls -la",
    });

    store.appendOutput("term_test_3", "archivo1.ts\n");
    store.appendOutput("term_test_3", "archivo2.ts\n");

    // Montaje tardío de un componente en Canvas
    const attached = store.attach("term_test_3", () => {});
    expect(attached).toBeDefined();
    expect(attached?.replayChunks).toEqual(["archivo1.ts\n", "archivo2.ts\n"]);
  });

  it("aplica buffer anular (ring-buffer) truncando el exceso si se supera maxBufferBytes", () => {
    store.createSession({
      sessionId: "term_test_4",
      workspaceId: "ws_default",
      command: "find /",
      maxBufferBytes: 50, // Límite artificial pequeño para la prueba
    });

    store.appendOutput("term_test_4", "0123456789\n");
    store.appendOutput("term_test_4", "abcdefghij\n");
    store.appendOutput("term_test_4", "KLMNOPQRST\n");
    store.appendOutput("term_test_4", "uvwxyz1234\n");
    store.appendOutput("term_test_4", "supercalifragilisticoespialidoso\n");

    const snap = store.getSession("term_test_4");
    expect(snap).toBeDefined();
    expect(snap?.truncated).toBe(true);

    const attached = store.attach("term_test_4", () => {});
    const fullText = attached?.replayChunks.join("") || "";
    expect(fullText).toContain("Salida anterior truncada");
  });

  it("notifica cambios de estado (running -> exited / error) y actualiza workspace", () => {
    store.createSession({
      sessionId: "term_test_5",
      workspaceId: "ws_default",
      command: "npm run build",
    });

    let lastStatus = "";
    let lastCode: number | null = null;

    store.attach(
      "term_test_5",
      () => {},
      (status, exitCode) => {
        lastStatus = status;
        lastCode = exitCode;
      }
    );

    store.endSession("term_test_5", 0);

    expect(lastStatus).toBe("exited");
    expect(lastCode).toBe(0);

    const snap = store.getSession("term_test_5");
    expect(snap?.status).toBe("exited");
    expect(snap?.exitCode).toBe(0);
    expect(snap?.endedAt).toBeGreaterThan(0);
  });

  it("emite actualizaciones a observadores de workspace sin re-renderizar sesiones ajenas", () => {
    const workspaceSnapshots: any[] = [];
    const unsub = store.subscribeWorkspace("ws_proj", (sessions) => {
      workspaceSnapshots.push(sessions);
    });

    // Se emite inmediatamente la lista inicial vacía
    expect(workspaceSnapshots.length).toBe(1);
    expect(workspaceSnapshots[0]).toEqual([]);

    // Crear sesión en ws_proj
    store.createSession({
      sessionId: "sess_a",
      workspaceId: "ws_proj",
      command: "git status",
    });

    expect(workspaceSnapshots.length).toBe(2);
    expect(workspaceSnapshots[1].length).toBe(1);
    expect(workspaceSnapshots[1][0].sessionId).toBe("sess_a");

    // Crear sesión en otro workspace (NO debe notificar a ws_proj)
    store.createSession({
      sessionId: "sess_b",
      workspaceId: "ws_other",
      command: "cargo check",
    });

    expect(workspaceSnapshots.length).toBe(2);

    // Finalizar sesión en ws_proj (debe notificar)
    store.endSession("sess_a", 0);
    expect(workspaceSnapshots.length).toBe(3);
    expect(workspaceSnapshots[2][0].status).toBe("exited");

    unsub();
  });

  it("permite enviar stdin y cerrar la sesión", () => {
    store.createSession({
      sessionId: "term_test_6",
      workspaceId: "ws_default",
      command: "interactive-sh",
    });

    let receivedStdin = "";
    let killed = false;

    store.bindProcessHandlers("term_test_6", {
      stdinHandler: (data) => {
        receivedStdin += data;
      },
      killHandler: () => {
        killed = true;
      },
    });

    const written = store.writeStdin("term_test_6", "yes\n");
    expect(written).toBe(true);
    expect(receivedStdin).toBe("yes\n");

    store.closeSession("term_test_6");
    expect(killed).toBe(true);
    expect(store.getSession("term_test_6")).toBeUndefined();
  });
});
