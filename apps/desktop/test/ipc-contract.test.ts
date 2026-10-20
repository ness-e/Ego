import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readMainSource } from "./helpers/main-source.js";
import {
  EgoIpc,
  EgoIpcInvokeChannels,
  EgoIpcPushChannels,
} from "../src/ipc.js";

const here = dirname(fileURLToPath(import.meta.url));
const mainSrc = readMainSource();
const preloadSrc = readFileSync(join(here, "..", "src", "preload.ts"), "utf-8");

function mentionedChannels(src: string, call: string): string[] {
  const re = new RegExp(call.replace(".", "\\.") + '\\("([^"]+)"', "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return [...new Set(out)];
}

describe("@ego/desktop — contrato IPC canónico (F5T11/M25)", () => {
  it("EgoIpc deriva de invoke+push sin duplicados y con prefijo ipc.", () => {
    expect([...EgoIpcInvokeChannels, ...EgoIpcPushChannels].sort()).toEqual(
      [...EgoIpc].sort()
    );
    expect(new Set(EgoIpc).size).toBe(EgoIpc.length);
    for (const ch of EgoIpc) expect(ch.startsWith("ipc.")).toBe(true);
  });

  it("todo ipcMain.handle de main.ts está catalogado en el contrato", () => {
    const handled = mentionedChannels(mainSrc, "ipcMain.handle");
    expect(handled.length).toBeGreaterThan(8);
    for (const ch of handled) {
      expect(EgoIpcInvokeChannels as readonly string[]).toContain(ch);
    }
  });

  it("todo canal del contrato invoke tiene handler real en main.ts", () => {
    const handled = mentionedChannels(mainSrc, "ipcMain.handle");
    for (const ch of EgoIpcInvokeChannels) {
      expect(handled).toContain(ch);
    }
  });

  it("todo ipcRenderer.invoke de preload.ts pertenece al contrato invoke", () => {
    const invoked = mentionedChannels(preloadSrc, "ipcRenderer.invoke");
    expect(invoked.length).toBeGreaterThan(8);
    for (const ch of invoked) {
      expect(EgoIpcInvokeChannels as readonly string[]).toContain(ch);
    }
  });

  it("todo evento push (on en preload, send en main) pertenece al contrato push", () => {
    const listened = mentionedChannels(preloadSrc, "ipcRenderer.on");
    const sent = mentionedChannels(mainSrc, "webContents.send");
    expect(listened.length).toBeGreaterThan(0);
    for (const ch of [...listened, ...sent]) {
      expect(EgoIpcPushChannels as readonly string[]).toContain(ch);
    }
  });
});
