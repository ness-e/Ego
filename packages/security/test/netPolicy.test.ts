import { describe, expect, it } from "vitest";
import { isBlockedSSRFIPv4, isBlockedSSRFIPv6, validateSSRFUrl } from "../src/netPolicy.js";

describe("STAB-14: netPolicy SSRF frontera security (URLs prohibidas bloqueadas)", () => {
  it("bloquea localhost y loopback", () => {
    for (const u of ["http://localhost/", "http://localhost:5678/", "http://127.0.0.1/", "http://0.0.0.0/"]) {
      expect(validateSSRFUrl(u).safe, u).toBe(false);
    }
  });

  it("bloquea link-local 169.254 y metadata cloud", () => {
    for (const u of [
      "http://169.254.169.254/latest/meta-data/",
      "http://169.254.10.20/",
      "http://metadata.google.internal/",
      "http://100.100.100.200/",
    ]) {
      expect(validateSSRFUrl(u).safe, u).toBe(false);
    }
  });

  it("bloquea RFC1918 (10/8, 172.16/12, 192.168/16)", () => {
    expect(isBlockedSSRFIPv4("10.0.0.5")).toBe(true);
    expect(isBlockedSSRFIPv4("172.16.0.1")).toBe(true);
    expect(isBlockedSSRFIPv4("172.31.255.255")).toBe(true);
    expect(isBlockedSSRFIPv4("172.32.0.1")).toBe(false);
    expect(isBlockedSSRFIPv4("192.168.1.1")).toBe(true);
    expect(isBlockedSSRFIPv4("8.8.8.8")).toBe(false);
    expect(validateSSRFUrl("http://192.168.0.10/").safe).toBe(false);
  });

  it("bloquea IPv6 especiales y permite unicast global", () => {
    expect(isBlockedSSRFIPv6("::1")).toBe(true);
    expect(isBlockedSSRFIPv6("fe80::1")).toBe(true);
    expect(isBlockedSSRFIPv6("fc00::1")).toBe(true);
    expect(isBlockedSSRFIPv6("2001:db8::1")).toBe(false);
  });

  it("permite https pública, rechaza protocolo/credenciales/malformada", () => {
    expect(validateSSRFUrl("https://example.com/a?b=1").safe).toBe(true);
    expect(validateSSRFUrl("file:///etc/passwd").safe).toBe(false);
    expect(validateSSRFUrl("https://user:pass@example.com/").safe).toBe(false);
    expect(validateSSRFUrl("no-es-url").safe).toBe(false);
  });

  it("opt-in allowLocalhost solo localhost/127", () => {
    expect(validateSSRFUrl("http://localhost/", { allowLocalhost: true }).safe).toBe(true);
    expect(validateSSRFUrl("http://192.168.0.1/", { allowLocalhost: true }).safe).toBe(false);
  });
});
