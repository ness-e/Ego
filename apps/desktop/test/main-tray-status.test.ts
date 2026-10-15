import { describe, it, expect } from "vitest";
import {
  TRAY_COLORS,
  getCrcTable,
  pngChunk,
  trayTooltipFor,
} from "../src/main/tray-status.js";

describe("STAB-09: tray-status", () => {
  it("tooltip por estado con los textos canónicos", () => {
    expect(trayTooltipFor("idle")).toBe("Ego — inactivo");
    expect(trayTooltipFor("thinking")).toBe("Ego — pensando…");
    expect(trayTooltipFor("hitl")).toBe("Ego — requiere aprobación (HITL)");
  });

  it("colores verde/azul/rojo por estado", () => {
    expect(TRAY_COLORS.idle).toEqual([52, 211, 153]);
    expect(TRAY_COLORS.thinking).toEqual([56, 189, 248]);
    expect(TRAY_COLORS.hitl).toEqual([251, 113, 133]);
  });

  it("tabla CRC-32 determinista y singleton", () => {
    const a = getCrcTable();
    const b = getCrcTable();
    expect(a).toBe(b);
    expect(a.length).toBe(256);
    // Valor canónico CRC-32: tabla[1] = 0x77073096.
    expect(a[1]).toBe(0x77073096);
  });

  it("pngChunk arma len+type+data+crc íntegros", () => {
    const data = Buffer.from([1, 2, 3]);
    const chunk = pngChunk("IHDR", data);
    // len(4) + type(4) + data(3) + crc(4).
    expect(chunk.length).toBe(15);
    expect(chunk.readUInt32BE(0)).toBe(3);
    expect(chunk.subarray(4, 8).toString("ascii")).toBe("IHDR");
    // CRC verificado contra la misma tabla (round-trip interno).
    const again = pngChunk("IHDR", data);
    expect(chunk.equals(again)).toBe(true);
    expect(pngChunk("IDAT", data).equals(chunk)).toBe(false);
  });
});
