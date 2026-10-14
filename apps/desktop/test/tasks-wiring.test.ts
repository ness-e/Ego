import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const mainSrc = readFileSync(join(here, "..", "src", "main.ts"), "utf-8");
const ipcSrc = readFileSync(join(here, "..", "src", "ipc.ts"), "utf-8");

describe("T03 — @ego/tasks cableado al main (BackgroundEngine + terminal + Tray)", () => {
  it("main.ts importa BackgroundEngine de @ego/tasks (paquete huérfano → cableado)", () => {
    expect(mainSrc).toContain("@ego/tasks");
    expect(mainSrc).toContain("BackgroundEngine");
  });

  it("main.ts registra handlers ipc.tasks.list / ipc.tasks.cancel", () => {
    expect(mainSrc).toContain('ipcMain.handle("ipc.tasks.list"');
    expect(mainSrc).toContain('ipcMain.handle("ipc.tasks.cancel"');
  });

  it("main.ts registra handlers ipc.terminal.spawn / stdin / kill", () => {
    expect(mainSrc).toContain('ipcMain.handle("ipc.terminal.spawn"');
    expect(mainSrc).toContain('ipcMain.handle("ipc.terminal.stdin"');
    expect(mainSrc).toContain('ipcMain.handle("ipc.terminal.kill"');
  });

  it("main.ts instancia el System Tray nativo (new Tray)", () => {
    expect(mainSrc).toContain("new Tray(");
  });

  it("el contrato ipc.ts cataloga los 5 canales nuevos", () => {
    for (const ch of [
      "ipc.tasks.list",
      "ipc.tasks.cancel",
      "ipc.terminal.spawn",
      "ipc.terminal.stdin",
      "ipc.terminal.kill",
    ]) {
      expect(ipcSrc).toContain(ch);
    }
  });
});
