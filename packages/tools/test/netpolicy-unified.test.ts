import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { NetPolicy as CanonicalNetPolicy } from "@ego/security";
import { NetPolicy } from "../src/native/security/NetPolicy.js";

/**
 * T2 (Ola 1b) — NetPolicy UNIFICADA (Diff C de A2 / OCLW-09 / A5-S5).
 *
 * Antes de la Ola 1b había **tres** políticas de red divergentes:
 *   1. `packages/tools/src/native/security/NetPolicy.ts` (A3) — con DNS.
 *   2. `packages/security/src/netPolicy.ts` — superficie standalone sin DNS.
 *   3. `packages/security/src/ToolPermissions.ts` — "réplica léxica" (sin DNS).
 *
 * A2 cerró la 2 y la 3 y creó la canónica (`packages/security/src/ssrfPolicy.ts`).
 * Esta tarea cierra la 1: `packages/tools` pasa a **reexportar** la canónica.
 *
 * La prueba que importa NO es "el behaviour funciona" (ya funcionaba): es
 * "hay UNA SOLA implementación en el repo". Dos clases con la misma semántica
 * son dos fronteras de seguridad, y la que se usa puede no ver lo que la otra
 * bloquea.
 */
describe("T2 — NetPolicy unificada: una sola implementación (OCLW-09)", () => {
  it("la política de @ego/tools ES la canónica de @ego/security (misma clase)", () => {
    expect(NetPolicy).toBe(CanonicalNetPolicy);
  });

  it("el repo contiene UNA sola definición de `class NetPolicy` en `packages/*/src`", () => {
    const repoRoot = path.resolve(__dirname, "..", "..", "..");
    const packagesDir = path.join(repoRoot, "packages");

    const offenders: string[] = [];
    for (const pkg of fs.readdirSync(packagesDir)) {
      const srcDir = path.join(packagesDir, pkg, "src");
      if (!fs.existsSync(srcDir)) continue;
      for (const file of walkFiles(srcDir)) {
        if (!file.endsWith(".ts")) continue;
        const content = fs.readFileSync(file, "utf8");
        if (/export\s+class\s+NetPolicy\b/.test(content)) {
          offenders.push(path.relative(repoRoot, file));
        }
      }
    }

    // La única definición debe estar en @ego/security (la canónica).
    expect(offenders).toEqual([path.join("packages", "security", "src", "ssrfPolicy.ts")]);
  });

  it("no queda ninguna 'réplica léxica' de la política de red en el código", () => {
    const repoRoot = path.resolve(__dirname, "..", "..", "..");
    const packagesDir = path.join(repoRoot, "packages");

    const hits: string[] = [];
    for (const pkg of fs.readdirSync(packagesDir)) {
      const srcDir = path.join(packagesDir, pkg, "src");
      if (!fs.existsSync(srcDir)) continue;
      for (const file of walkFiles(srcDir)) {
        if (!file.endsWith(".ts")) continue;
        const content = fs.readFileSync(file, "utf8");
        if (/réplica léxica/.test(content) && !/UNIFICACI|canónica|historia/i.test(content)) {
          hits.push(path.relative(repoRoot, file));
        }
      }
    }

    expect(hits).toEqual([]);
  });

  describe("comportamiento fail-closed con DNS (heredado de la canónica)", () => {
    it("rechaza un host que resuelve a loopback (DNS rebinding)", async () => {
      const verdict = await NetPolicy.validateUrlWithDns("https://attacker.example/api", {
        resolver: async () => ["127.0.0.1"],
      });

      expect(verdict.safe).toBe(false);
      expect(verdict.reason).toMatch(/DNS rebinding|privada/i);
    });

    it("rechaza un host que resuelve a una IP privada RFC1918", async () => {
      const verdict = await NetPolicy.validateUrlWithDns("https://internal.example/", {
        resolver: async () => ["10.1.2.3"],
      });

      expect(verdict.safe).toBe(false);
    });

    it("rechaza si ALGUNA de las direcciones resueltas es privada (fail-closed)", async () => {
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
    });

    it("bloquea las credenciales embebidas en la URL (veto de la canónica)", () => {
      const verdict = NetPolicy.validateUrl("https://admin:supersecret@mi-servicio.com/v1");
      expect(verdict.safe).toBe(false);
    });
  });
});

/** Recorre un directorio y devuelve sus ficheros (recursivo). */
function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      out.push(...walkFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}
