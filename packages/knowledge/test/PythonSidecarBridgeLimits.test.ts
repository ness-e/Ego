import { describe, it, expect, beforeAll } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import { createHash } from "node:crypto";
import { PythonSidecarBridge } from "../src/ingest/PythonSidecarBridge.js";

/**
 * F2T5 Slice 5 (L08) — PythonSidecarBridge: timeout/kill + límite de chunks.
 *
 * - Un sidecar colgado debe abortarse por timeout (con kill) en vez de
 *   colgar la ingesta indefinidamente.
 * - Un sidecar que emite chunks sin fin debe abortarse al superar maxChunks
 *   en vez de agotar la RAM acumulando el array.
 */

function chunkLine(i: number): string {
  const content = `contenido ${i}`;
  const chunk = {
    id: `spam:${i}`,
    content,
    tokenCount: 2,
    headingPath: ["Spam"],
    contentHash: createHash("sha256").update(content).digest("hex"),
    sourcePath: "spam.md",
    mimeType: "text/markdown",
    index: i,
  };
  return JSON.stringify({ type: "chunk", chunk });
}

describe("F2T5 Slice 5 (L08) — PythonSidecarBridge límites", () => {
  let dir: string;
  let sleeperScript: string;
  let spammerScript: string;
  let pythonAvailable = false;

  beforeAll(async () => {
    const probe = new PythonSidecarBridge();
    pythonAvailable = await probe.isAvailable();
    if (!pythonAvailable) return;

    dir = await fs.mkdtemp(path.join(os.tmpdir(), "ego-sidecar-limits-"));
    sleeperScript = path.join(dir, "sleeper.py");
    await fs.writeFile(sleeperScript, "import time\ntime.sleep(30)\n", "utf-8");

    spammerScript = path.join(dir, "spammer.py");
    const lines: string[] = [];
    for (let i = 0; i < 200; i++) {
      lines.push(chunkLine(i));
    }
    lines.push(JSON.stringify({ type: "done", totalFiles: 1, totalChunks: 200 }));
    await fs.writeFile(spammerScript, `print(${JSON.stringify(lines.join("\n"))})\n`, "utf-8");
  });

  it("aborta por timeout con kill ante un sidecar colgado", async () => {
    if (!pythonAvailable) return;
    const bridge = new PythonSidecarBridge(sleeperScript);
    const target = await fs.mkdtemp(path.join(os.tmpdir(), "ego-sidecar-target-"));

    const started = Date.now();
    await expect(
      bridge.runBulkImport(target, undefined, { timeoutMs: 500 })
    ).rejects.toThrow(/timeout/i);
    const elapsed = Date.now() - started;

    // Abortó por el timeout, no por los 30s del sleeper.
    expect(elapsed).toBeLessThan(15000);
    await fs.rm(target, { recursive: true, force: true });
  });

  it("aborta al superar maxChunks en vez de acumular sin fin", async () => {
    if (!pythonAvailable) return;
    const bridge = new PythonSidecarBridge(spammerScript);
    const target = await fs.mkdtemp(path.join(os.tmpdir(), "ego-sidecar-target-"));

    await expect(bridge.runBulkImport(target, undefined, { maxChunks: 10 })).rejects.toThrow(
      /chunks/i
    );
    await fs.rm(target, { recursive: true, force: true });
  });

  it("respeta el límite cuando el volumen cabe en maxChunks", async () => {
    if (!pythonAvailable) return;
    const bridge = new PythonSidecarBridge(spammerScript);
    const target = await fs.mkdtemp(path.join(os.tmpdir(), "ego-sidecar-target-"));

    const result = await bridge.runBulkImport(target, undefined, { maxChunks: 500 });
    expect(result.chunks).toHaveLength(200);
    expect(result.totalChunks).toBe(200);
    await fs.rm(target, { recursive: true, force: true });
  });
});
