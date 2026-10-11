import { describe, it, expect } from "vitest";
import {
  resolveTranscriptWindow,
  paginateTranscriptMessages,
  type TranscriptMessageRecord,
} from "../TranscriptReadWindow.js";

describe("TranscriptReadWindow Suite (OCLW-06)", () => {
  it("debe calcular ventana más reciente por defecto", () => {
    const window = resolveTranscriptWindow({
      totalMessages: 100,
      maxMessages: 20,
    });

    expect(window.startIndex).toBe(80);
    expect(window.endIndex).toBe(100);
    expect(window.count).toBe(20);
    expect(window.hasMoreOlder).toBe(true);
    expect(window.hasMoreNewer).toBe(false);
  });

  it("debe paginar hacia atrás ('older') desde una posición de anclaje", () => {
    const window = resolveTranscriptWindow({
      totalMessages: 100,
      anchorSeq: 50,
      direction: "older",
      maxMessages: 15,
    });

    expect(window.endIndex).toBe(51);
    expect(window.startIndex).toBe(36);
    expect(window.count).toBe(15);
    expect(window.hasMoreOlder).toBe(true);
    expect(window.hasMoreNewer).toBe(true);
  });

  it("debe respetar límite de bytes al serializar mensajes en memoria", () => {
    const mockMessages: TranscriptMessageRecord[] = Array.from({ length: 50 }, (_, i) => ({
      id: `msg-${i}`,
      seq: i,
      role: "user",
      content: `Mensaje de prueba número ${i} con texto suficientemente largo para bytes`,
      timestamp: Date.now() + i,
    }));

    const result = paginateTranscriptMessages(mockMessages, {
      maxMessages: 30,
      maxBytes: 300,
    });

    expect(result.page.length).toBeLessThan(10);
    expect(result.totalBytes).toBeLessThanOrEqual(300);
  });
});
