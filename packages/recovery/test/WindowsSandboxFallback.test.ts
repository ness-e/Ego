import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  evaluateSandboxFallback,
  isWindowsSandboxBreakpointExit,
  alreadyHasNoSandbox,
  readSandboxMarker,
  writeSandboxMarker,
  markSandboxBootSuccessful,
  WINDOWS_SANDBOX_BREAKPOINT_EXIT,
} from "../src/WindowsSandboxFallback.js";

describe("HERM-07: WindowsSandboxFallback (Crash-loop & Sandbox Recovery)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ego-sandbox-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignorar
    }
  });

  it("reconoce STATUS_BREAKPOINT (0x80000003) como salida de crash de sandbox", () => {
    expect(isWindowsSandboxBreakpointExit(WINDOWS_SANDBOX_BREAKPOINT_EXIT)).toBe(true);
    expect(isWindowsSandboxBreakpointExit(0x80000003)).toBe(true);
    expect(isWindowsSandboxBreakpointExit(0)).toBe(false);
    expect(isWindowsSandboxBreakpointExit(1)).toBe(false);
  });

  it("detecta presencia previa de flag --no-sandbox o variable de entorno", () => {
    expect(alreadyHasNoSandbox(["electron", "--no-sandbox"])).toBe(true);
    expect(alreadyHasNoSandbox(["electron"])).toBe(false);
    expect(alreadyHasNoSandbox([], { ELECTRON_DISABLE_SANDBOX: "1" })).toBe(true);
  });

  it("evalúa fallback: primer arranque fallido registra strike, segundo arranque activa fallback", () => {
    // 1. Primer arranque fallido
    const r1 = evaluateSandboxFallback(null, "1.0.0");
    expect(r1.shouldDisableSandbox).toBe(false);
    expect(r1.nextMarker.bootAborts).toBe(1);

    // 2. Segundo arranque fallido consecutivo
    const r2 = evaluateSandboxFallback(r1.nextMarker, "1.0.0");
    expect(r2.shouldDisableSandbox).toBe(true);
    expect(r2.nextMarker.state).toBe("fallback");
    expect(r2.nextMarker.reason).toBe("boot-loop");
  });

  it("permite re-evaluación limpia (reprobe) tras una actualización de versión", () => {
    const existingFallback = {
      state: "fallback" as const,
      reason: "boot-loop" as const,
      bootAborts: 2,
      version: "1.0.0",
    };

    const evaluated = evaluateSandboxFallback(existingFallback, "1.1.0");
    expect(evaluated.shouldDisableSandbox).toBe(false);
    expect(evaluated.nextMarker.reprobe).toBe(true);
    expect(evaluated.nextMarker.version).toBe("1.1.0");
  });

  it("persiste y lee marcadores a disco correctamente", async () => {
    await writeSandboxMarker(tmpDir, { state: "booting", bootAborts: 1, version: "0.1.0" });
    const read = await readSandboxMarker(tmpDir);
    expect(read).toEqual({ state: "booting", bootAborts: 1, version: "0.1.0" });

    await markSandboxBootSuccessful(tmpDir, "0.1.0");
    const okMarker = await readSandboxMarker(tmpDir);
    expect(okMarker?.state).toBe("ok");
    expect(okMarker?.bootAborts).toBe(0);
  });
});
