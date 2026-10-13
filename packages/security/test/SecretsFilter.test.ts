import { describe, it, expect } from "vitest";
import {
  scanText,
  redactText,
  containsSecret,
  assertNoSecrets,
  sanitizeForLog,
  scanEgoPut,
} from "../src/SecretsFilter.js";

// Fixtures sintéticas. NUNCA secretos reales: solo canarios `sk-test-*`
// y tokens inventados para esta suite.
const CANARY_A = "sk-test-canary-alpha-001";
const CANARY_B = "sk-test-canary-beta-002";

describe("SecretsFilter — barrera Zero Secrets in Storage (SEC-04)", () => {
  it("detecta canario sk-test-* en texto plano y lo redacta sin eco", () => {
    const result = scanText(`mi clave es ${CANARY_A} no la guardes`);
    expect(result.hasSecrets).toBe(true);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.redactedText).not.toContain(CANARY_A);
    expect(result.redactedText).toMatch(/\[REDACTED:/);
    // Los findings nombran la regla y el campo, NUNCA el valor en claro.
    expect(JSON.stringify(result.findings)).not.toContain(CANARY_A);
  });

  it("detecta prefijos conocidos: anthropic, github, aws, bearer, jwt, pem, asignación", () => {
    const samples = [
      "sk-ant-test-synthetic-abc123XYZ456",
      "ghp_testsynthetic0123456789abcdef01",
      "AKIAIOSFODNN7EXAMPLE",
      "Bearer testbearersynthetic0123456789abcdef",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c",
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAtest\n-----END RSA PRIVATE KEY-----",
      'api_key = "testvaluesynthetic0987654321"',
    ];
    for (const sample of samples) {
      const result = scanText(sample);
      expect(result.hasSecrets, `no detectado: ${sample.slice(0, 24)}…`).toBe(true);
      expect(result.redactedText).not.toContain(sample);
    }
  });

  it("no genera falsos positivos en prosa inocente", () => {
    const clean = [
      "token expired, please retry your request",
      "the secret to success is practice",
      "api_key is required in the config docs (no value here)",
      "bearer of good news arrived yesterday",
    ];
    for (const text of clean) {
      expect(scanText(text).hasSecrets, `falso positivo: ${text}`).toBe(false);
    }
    expect(containsSecret("hola mundo")).toBe(false);
    expect(containsSecret(CANARY_A)).toBe(true);
  });

  it("redacta TODAS las ocurrencias (global) y es idempotente", () => {
    const text = `${CANARY_A} y otra vez ${CANARY_A} más ${CANARY_B}`;
    const once = redactText(text);
    expect(once).not.toContain(CANARY_A);
    expect(once).not.toContain(CANARY_B);
    expect(redactText(once)).toBe(once);
  });

  it("escanea payload + metadata anidados con rutas de campo (incl. etiquetado VDB)", () => {
    const result = scanEgoPut({
      namespace: "chat/test",
      key: "k1",
      payload: { text: "nada aquí", nested: { deep: [`token ${CANARY_B}`] } },
      metadata: { note: { String: `clave ${CANARY_A}` }, plain: "ok" },
    });
    expect(result.hasSecrets).toBe(true);
    const fields = result.findings.map((f) => f.field).join(" ");
    expect(fields).toMatch(/payload\.nested\.deep\[0\]/);
    expect(fields).toMatch(/metadata\.note\.String/);
    expect(JSON.stringify(result.redactedPayload)).not.toContain(CANARY_B);
    expect(JSON.stringify(result.redactedMetadata)).not.toContain(CANARY_A);
  });

  it("assertNoSecrets falla cerrado sin eco del secreto", () => {
    expect(() => assertNoSecrets("texto limpio", "ctx-test")).not.toThrow();
    let message = "";
    try {
      assertNoSecrets(`fuga ${CANARY_A}`, "ctx-test-put");
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/ctx-test-put/);
    expect(message).not.toContain(CANARY_A);
  });

  it("sanitizeForLog despoja secretos de líneas de log", () => {
    const line = sanitizeForLog(`[put] ns=chat/test key=k1 key=${CANARY_A} ok`);
    expect(line).not.toContain(CANARY_A);
    expect(line).toMatch(/chat\/test/);
  });

  it("adversarial 1/3: fragmento de canario partido entre campos se detecta", () => {
    const result = scanEgoPut({
      namespace: "chat/test",
      key: "k-split",
      payload: { a: "prefijo sk-test-", b: "fragmento-resto-999" },
    });
    expect(result.hasSecrets).toBe(true);
  });

  it("adversarial 2/3: canario envuelto en base64 se detecta y se redacta el blob", () => {
    const wrapped = Buffer.from(`token=${CANARY_B}`, "utf-8").toString("base64");
    const result = scanText(`blob externo ${wrapped} fin`);
    expect(result.hasSecrets).toBe(true);
    expect(result.redactedText).not.toContain(wrapped);
    expect(JSON.stringify(result.findings)).not.toContain(CANARY_B);
  });

  it("adversarial 3/3: mayúsculas y variantes de asignación no evaden", () => {
    expect(scanText(`API_KEY="${CANARY_A}"`).hasSecrets).toBe(true);
    expect(scanText("Sk-TeSt-EvAsIoN-777").hasSecrets).toBe(true);
    expect(scanText("Authorization: Bearer testbearersynthetic0123456789abcdef").hasSecrets).toBe(true);
  });

  it("marca truncado ante entrada gigante sin colgarse", () => {
    const big = `ok ${"x".repeat(1_200_000)}`;
    const result = scanText(big, { maxInputChars: 1000 });
    expect(result.truncated).toBe(true);
    expect(result.hasSecrets).toBe(false);
  });
});
