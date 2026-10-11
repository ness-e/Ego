import { describe, it, expect } from "vitest";
import { ResourcePolicy } from "../src/native/security/ResourcePolicy.js";

describe("COUC-13: ResourcePolicy (Safe Web URLs)", () => {
  it("acepta enlaces web legítimos con esquema http y https", () => {
    expect(ResourcePolicy.safeWebUrl("https://example.com")).not.toBeNull();
    expect(ResourcePolicy.safeWebUrl("http://example.com/a?b=1")).not.toBeNull();
    expect(ResourcePolicy.safeWebUrl("HTTPS://EXAMPLE.COM")).not.toBeNull();
    expect(ResourcePolicy.safeWebUrl("  https://example.com \n")).not.toBeNull();
    expect(ResourcePolicy.safeWebUrl("http://localhost:5678")).not.toBeNull();
  });

  it("rechaza de forma estricta esquemas no permitidos, locales y malformados", () => {
    expect(ResourcePolicy.safeWebUrl(null)).toBeNull();
    expect(ResourcePolicy.safeWebUrl("")).toBeNull();
    expect(ResourcePolicy.safeWebUrl("file:///etc/hosts")).toBeNull();
    expect(ResourcePolicy.safeWebUrl("javascript:alert(1)")).toBeNull();
    expect(ResourcePolicy.safeWebUrl("vscode://file/etc/hosts")).toBeNull();
    expect(ResourcePolicy.safeWebUrl("cursor://file/src/main.ts")).toBeNull();
    expect(ResourcePolicy.safeWebUrl("smb://server/share")).toBeNull();
    expect(ResourcePolicy.safeWebUrl("mailto:a@b.c")).toBeNull();
    expect(ResourcePolicy.safeWebUrl("https://")).toBeNull();
    expect(ResourcePolicy.safeWebUrl("https:example.com")).toBeNull();
    expect(ResourcePolicy.safeWebUrl("//example.com")).toBeNull();
  });

  it("isSafeWebUrl reporta boolean coherente", () => {
    expect(ResourcePolicy.isSafeWebUrl("https://github.com/vanta/ego")).toBe(true);
    expect(ResourcePolicy.isSafeWebUrl("file:///C:/Users/test")).toBe(false);
  });

  it("assertSafeWebUrl lanza error si la URL no es segura", () => {
    expect(() => ResourcePolicy.assertSafeWebUrl("file:///etc/passwd", "BrowserOpen")).toThrow(
      /Violación de seguridad en BrowserOpen/
    );
    expect(ResourcePolicy.assertSafeWebUrl("https://vantadb.com").hostname).toBe("vantadb.com");
  });
});
