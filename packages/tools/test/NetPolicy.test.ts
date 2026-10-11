import { describe, it, expect } from "vitest";
import { NetPolicy } from "../src/native/security/NetPolicy.js";

describe("NetPolicy Anti-SSRF Suite (OCLW-09)", () => {
  it("debe bloquear URLs a localhost y 127.0.0.1 por defecto", () => {
    const res1 = NetPolicy.validateUrl("http://localhost:8080/admin");
    expect(res1.safe).toBe(false);
    expect(res1.reason).toContain("Acceso denegado");

    const res2 = NetPolicy.validateUrl("http://127.0.0.1:3000/api");
    expect(res2.safe).toBe(false);
  });

  it("debe bloquear direcciones IPv4 privadas RFC 1918", () => {
    expect(NetPolicy.validateUrl("http://10.0.0.1/status").safe).toBe(false);
    expect(NetPolicy.validateUrl("http://172.16.5.10/metrics").safe).toBe(false);
    expect(NetPolicy.validateUrl("http://192.168.1.1/router").safe).toBe(false);
  });

  it("debe bloquear endpoints de metadatos cloud (AWS / GCP / Azure)", () => {
    const res = NetPolicy.validateUrl("http://169.254.169.254/latest/meta-data/");
    expect(res.safe).toBe(false);
    expect(res.reason).toContain("metadatos cloud");
  });

  it("debe permitir URLs públicas legítimas sobre HTTP/HTTPS", () => {
    const res = NetPolicy.validateUrl("https://api.github.com/repos/ego");
    expect(res.safe).toBe(true);
  });

  it("debe redactar credenciales de usuario en URLs", () => {
    const redacted = NetPolicy.redactUrl("https://admin:supersecret@mi-servicio.com/v1");
    expect(redacted).toBe("https://***:***@mi-servicio.com/v1");
  });
});
