// floating-upload.test.ts — Task 9 (D4): UploadCanvas completo + drop + URL segura.
//
// RED: estos módulos no existen todavía → FAIL (`progressAt is not a function`
// / `Cannot find module`). GREEN los crea (Steps 2-3).
//
// Contratos (coucou sequence.ts/canvas.ts + SafeWebURL.swift):
// - progressAt monótona en [progStart, progEnd], 0 antes, 1 al final.
// - simulateTo determinista: mismo reloj fake → mismos frames.
// - drop→ingest invocado exactamente 1 vez por archivo, background (no bloquea).
// - isSafeWebUrl: acepta http/https con host; rechaza file:/smb:/custom.
// - overlay: 2 botones invisibles clicables (ask/cancel).

import { describe, it, expect, vi } from "vitest";
import { USC, eOut, eIn, eBack, progressAt, UploadSequence, UploadSeq } from "../floating/upload-seq.js";
import { UploadCanvas, isSafeWebUrl, DropQueue } from "../floating/upload-canvas.js";

describe("Task9: upload-seq (port coucou/windows/src/upload/sequence.ts)", () => {
  it("USC canónico: W 640, LOCK_IN 60/OUT 90, DT 1/240", () => {
    expect(USC.W).toBe(640);
    expect(USC.ISL_H).toBe(176);
    expect(USC.LOCK_IN).toBe(60);
    expect(USC.LOCK_OUT).toBe(90);
    expect(USC.DT).toBeCloseTo(1 / 240, 12);
  });

  it("easings: eOut(0)=0, eOut(1)=1, eIn(1)=1, eBack(1)=1", () => {
    expect(eOut(0)).toBeCloseTo(0, 12);
    expect(eOut(1)).toBeCloseTo(1, 12);
    expect(eIn(1)).toBeCloseTo(1, 12);
    expect(eBack(1)).toBeCloseTo(1, 12);
  });

  it("progressAt monótona en ventana, 0 antes, 1 al final (curva 60/32/8)", () => {
    const s = USC.T_PROG_START;
    const e = s + 2.4;
    expect(progressAt(s - 1, s, e)).toBe(0);
    let prev = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const v = progressAt(s + ((e - s) * i) / 100, s, e);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(progressAt(e, s, e)).toBeCloseTo(1, 6);
    // Punto medio de la curva: 60% a u=0.4.
    expect(progressAt(s + (e - s) * 0.4, s, e)).toBeCloseTo(0.6, 2);
  });

  it("UploadSeq expone el ciclo de vida completo", () => {
    for (const m of ["enterZone", "updateCursor", "exitZone", "performDrop", "deactivate", "frame", "dropped", "sinceDrop"] as const) {
      expect(typeof (UploadSeq as unknown as Record<string, unknown>)[m === "dropped" || m === "sinceDrop" ? m : m]).toBe(
        m === "dropped" ? "boolean" : "function",
      );
    }
    expect(UploadSeq.dropped).toBe(false);
    expect(UploadSeq.sinceDrop()).toBeNull();
  });

  it("simulateTo determinista: mismo reloj fake → mismos frames", () => {
    let now = 1000;
    const mk = (): UploadSequence => new UploadSequence(() => now);
    const run = (): Array<{ x: number; y: number; progress: number }> => {
      const seq = mk();
      seq.enterZone(300, 100);
      const out: Array<{ x: number; y: number; progress: number }> = [];
      for (let i = 0; i < 120; i++) {
        now += 1 / 60;
        const f = seq.frame();
        out.push({ x: f.x, y: f.y, progress: f.progress });
      }
      now = 1000;
      return out;
    };
    const a = run();
    const b = run();
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]?.x).toBeCloseTo(b[i]?.x ?? NaN, 12);
      expect(a[i]?.y).toBeCloseTo(b[i]?.y ?? NaN, 12);
      expect(a[i]?.progress).toBeCloseTo(b[i]?.progress ?? NaN, 12);
    }
  });

  it("exitZone no rompe la sesión; deactivate la cierra", () => {
    let now = 2000;
    const seq = new UploadSequence(() => now);
    seq.enterZone(300, 100);
    expect(seq.frame().zoneOver).toBe(true);
    seq.exitZone();
    now += 0.1;
    expect(seq.frame().zoneOver).toBe(true);
    seq.deactivate();
    expect(seq.dropped).toBe(false);
  });
});

describe("Task9: safe URL (port SafeWebURL.swift + extractions §33)", () => {
  it("acepta http/https con host", () => {
    expect(isSafeWebUrl("https://example.com/x")).toBe(true);
    expect(isSafeWebUrl("http://example.com/")).toBe(true);
    expect(isSafeWebUrl("  HTTPS://Example.COM/a  ")).toBe(true);
  });

  it("rechaza file:/smb:/custom/sin host/vacía (output de modelo)", () => {
    expect(isSafeWebUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeWebUrl("smb://server/share")).toBe(false);
    expect(isSafeWebUrl("ego-app://deep/link")).toBe(false);
    expect(isSafeWebUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeWebUrl("data:text/plain,hola")).toBe(false);
    expect(isSafeWebUrl("https://")).toBe(false);
    expect(isSafeWebUrl("")).toBe(false);
    expect(isSafeWebUrl(null)).toBe(false);
    expect(isSafeWebUrl(undefined)).toBe(false);
  });
});

describe("Task9: UploadCanvas + DropQueue (port canvas.ts, sin Mochi)", () => {
  it("overlay: 2 botones invisibles clicables (ask/cancel)", () => {
    const ask = vi.fn();
    const cancel = vi.fn();
    const view = new UploadCanvas({ ask, cancel });
    const btns = view.el.querySelectorAll("button.upload-hit");
    expect(btns.length).toBe(2);
    (btns[0] as HTMLButtonElement).click();
    (btns[1] as HTMLButtonElement).click();
    expect(ask).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("draw sin contexto 2d (happy-dom) no lanza; overlay sigue a chooseAlpha", () => {
    const view = new UploadCanvas({ ask: () => {}, cancel: () => {} });
    const seq = new UploadSequence(() => 3000);
    seq.enterZone(300, 100);
    const f = seq.frame();
    expect(() => view.draw(f, 0.5)).not.toThrow();
  });

  it("drop→ingest: 1 llamada por archivo, background, fuera de zona se ignora", async () => {
    const ingest = vi.fn().mockResolvedValue({ ok: true });
    const ticks: string[] = [];
    const q = new DropQueue({
      ingest: (req) => ingest(req),
      onStep: (label) => ticks.push(label),
    });
    // Fuera de zona: se ignora sin error ni ingest.
    await q.dropOutside(["/tmp/a.pdf"]);
    expect(ingest).not.toHaveBeenCalled();
    // En zona: 1 ingest por archivo, secuencial, sin bloquear (promesa).
    const p = q.dropInZone(["/tmp/a.pdf", "/tmp/b.png"]);
    expect(ingest).not.toHaveBeenCalled();
    await p;
    expect(ingest).toHaveBeenCalledTimes(2);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[ticks.length - 1]).toMatch(/✓/);
  });
});
