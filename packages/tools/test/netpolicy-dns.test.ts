import { describe, it, expect } from "vitest";
import { NetPolicy } from "../src/native/security/NetPolicy.js";

/**
 * T13 (A5-09) — NetPolicy unificada con resolución DNS.
 *
 * La política viva era una "réplica léxica" en `packages/security/src/ToolPermissions.ts`
 * (zona de A2) que comparaba SOLO la cadena del host, sin resolver DNS: un
 * host público que resuelve a `127.0.0.1` (DNS rebinding) la atravesaba.
 *
 * `NetPolicy` (zona de A3) es ahora la fuente canónica y añade resolución DNS.
 */
describe("T13 — NetPolicy con resolución DNS (A5-09)", () => {
  it("bloquea un host que resuelve a loopback (DNS rebinding)", async () => {
    const verdict = await NetPolicy.validateUrlWithDns("https://attacker.example/api", {
      resolver: async () => ["127.0.0.1"],
    });

    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toMatch(/DNS rebinding|privada/i);
  });

  it("bloquea un host que resuelve a una IP privada RFC1918", async () => {
    const verdict = await NetPolicy.validateUrlWithDns("https://internal.example/", {
      resolver: async () => ["10.1.2.3"],
    });

    expect(verdict.safe).toBe(false);
  });

  it("bloquea un host que resuelve a un endpoint de metadatos cloud", async () => {
    const verdict = await NetPolicy.validateUrlWithDns("https://meta.example/", {
      resolver: async () => ["169.254.169.254"],
    });

    expect(verdict.safe).toBe(false);
  });

  it("bloquea si ALGUNA de las direcciones resueltas es privada (fail-closed)", async () => {
    const verdict = await NetPolicy.validateUrlWithDns("https://mixed.example/", {
      resolver: async () => ["93.184.216.34", "127.0.0.1"],
    });

    expect(verdict.safe).toBe(false);
  });

  it("permite un host que resuelve solo a direcciones públicas", async () => {
    const verdict = await NetPolicy.validateUrlWithDns("https://api.github.com/repos", {
      resolver: async () => ["140.82.121.4"],
    });

    expect(verdict.safe).toBe(true);
    expect(verdict.resolvedAddresses).toEqual(["140.82.121.4"]);
  });

  it("la comprobación léxica sigue bloqueando localhost sin tocar DNS", async () => {
    const verdict = await NetPolicy.validateUrl("http://localhost:8080/admin");
    expect(verdict.safe).toBe(false);
  });

  it("`assertSafeUrl` lanza con el motivo (fail-closed)", async () => {
    await expect(
      NetPolicy.assertSafeUrl("https://attacker.example/", {
        resolver: async () => ["127.0.0.1"],
      })
    ).rejects.toThrow(/SSRF policy/);
  });

  it("un fallo de resolución DNS bloquea (fail-closed en la política de red)", async () => {
    const verdict = await NetPolicy.validateUrlWithDns("https://unresolvable.example/", {
      resolver: async () => {
        throw new Error("NXDOMAIN");
      },
    });

    expect(verdict.safe).toBe(false);
  });
});
