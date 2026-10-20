import { describe, it, expect } from "vitest";
import {
  isAllowedInvokeOrigin,
  assertInvokeOriginAllowed,
  getInvokeOrigin,
} from "../src/main.js";

/**
 * T10 (A4-24) — El origen del invoke se VALIDA, no solo se loguea.
 *
 * Antes `logInvokeOrigin` registraba el `senderFrame.url` y lo descartaba:
 * cualquier frame podía invocar cualquier canal IPC. El renderer es
 * untrusted (AGENTS.md §4), así que el origen debe estar en una allowlist.
 */
describe("T10: allowlist de origen de los invokes IPC", () => {
  it("acepta el bundle local empaquetado (file:)", () => {
    expect(isAllowedInvokeOrigin("file:///C:/app/out/renderer/index.html")).toBe(true);
  });

  it("acepta el dev-server local", () => {
    expect(isAllowedInvokeOrigin("http://127.0.0.1:5173/")).toBe(true);
    expect(isAllowedInvokeOrigin("http://localhost:5173/")).toBe(true);
  });

  it("rechaza orígenes remotos", () => {
    for (const url of [
      "https://evil.example.com/",
      "http://10.0.0.1/",
      "http://192.168.1.10/",
      "https://localhost.evil.com/",
    ]) {
      expect(isAllowedInvokeOrigin(url), url).toBe(false);
    }
  });

  it("rechaza esquemas y valores degenerados", () => {
    for (const url of ["", "unknown", "not a url", "data:text/html,x", "javascript:1"]) {
      expect(isAllowedInvokeOrigin(url), url).toBe(false);
    }
  });

  it("assertInvokeOriginAllowed devuelve un veredicto con motivo legible", () => {
    const ok = assertInvokeOriginAllowed("ipc.memory", {
      senderFrame: { url: "file:///app/index.html" },
    });
    expect(ok.ok).toBe(true);

    const denied = assertInvokeOriginAllowed("ipc.memory", {
      senderFrame: { url: "https://evil.example.com/" },
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.reason).toContain("ipc.memory");
  });

  it("getInvokeOrigin deriva la URL del senderFrame (nunca del renderer)", () => {
    const origin = getInvokeOrigin({ senderFrame: { url: "file:///x.html" } });
    expect(origin.frameUrl).toBe("file:///x.html");
    expect(origin.timestamp).toBeGreaterThan(0);
    // Sin senderFrame → "unknown" (que NO está en la allowlist → fail-closed).
    expect(getInvokeOrigin(null).frameUrl).toBe("unknown");
  });
});
