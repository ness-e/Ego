import { describe, it, expect } from "vitest";
import { ContextProvider } from "../src/ContextProvider.js";

describe("COUC-16: ContextProvider (Ambient System Context)", () => {
  it("retorna contexto fallback seguro cuando no hay estrategia inyectada", async () => {
    const provider = new ContextProvider();
    const ctx = await provider.captureContext();

    expect(ctx.timestamp).toBeGreaterThan(0);
    expect(["win32", "darwin", "linux", "unknown"]).toContain(ctx.platform);
    expect(ctx.source).toBe("fallback");
  });

  it("utiliza la estrategia mock inyectada", async () => {
    const mockStrategy = ContextProvider.createMockStrategy({
      activeApp: "Visual Studio Code",
      windowTitle: "Ego — ContextProvider.ts",
      activeUrl: "https://github.com/vanta/ego",
      selectedText: "COUC-16",
    });

    const provider = new ContextProvider(mockStrategy);
    const ctx = await provider.captureContext();

    expect(ctx.activeApp).toBe("Visual Studio Code");
    expect(ctx.windowTitle).toBe("Ego — ContextProvider.ts");
    expect(ctx.activeUrl).toBe("https://github.com/vanta/ego");
    expect(ctx.selectedText).toBe("COUC-16");
    expect(ctx.source).toBe("mock");
  });

  it("degrada pacíficamente a fallback si la estrategia lanza un error", async () => {
    const failingStrategy = {
      capture: async () => {
        throw new Error("Accesibility API permission denied");
      },
    };

    const provider = new ContextProvider(failingStrategy);
    const ctx = await provider.captureContext();

    expect(ctx.source).toBe("fallback");
    expect(ctx.timestamp).toBeGreaterThan(0);
  });
});
