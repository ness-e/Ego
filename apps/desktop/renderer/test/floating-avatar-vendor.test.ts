import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// FIND-12-01: el import del avatar DEBE resolver dentro del root servido
// (renderer/). Si el specifier vuelve a salir del root (repos-referencia,
// ../..), el browser responde 404 y <ego-avatar> queda inerte 0x0.
const here = dirname(fileURLToPath(import.meta.url));
const floatingDir = join(here, "..", "floating");

function specifiersOf(source: string): string[] {
  const out: string[] = [];
  // Solo imports DINÁMICOS con literal (el mecanismo de carga del avatar).
  // Los comentarios se eliminan antes: la procedencia en comentarios es legítima.
  const re = /import\(\s*["']([^"']+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) out.push(m[1] as string);
  return out.filter((s) => s.includes("avatar") || s.includes("repos-referencia"));
}

describe("FIND-12-01: avatar vendorizado dentro del root", () => {
  it("specifiers sin salida del root (0 repos-referencia, 0 ..)", () => {
    for (const file of ["floating-avatar.tsx", "floating-sound.ts"]) {
      const raw = readFileSync(join(floatingDir, file), "utf8");
      // Las menciones en comentarios (procedencia Task2/Task8) son legítimas:
      // se audita el CÓDIGO (specifiers e imports), no los comentarios.
      const src = raw
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|\s)\/\/.*$/gm, "");
      expect(src, `${file} referencia repos-referencia en código`).not.toContain(
        "repos-referencia",
      );
      const specs = specifiersOf(src);
      expect(specs.length, `${file} sin import dinámico de avatar`).toBeGreaterThan(0);
      for (const s of specs) {
        // A6 (Ola 1b): la fuente canónica del motor es el PAQUETE
        // `@ego/avatar`, que Vite resuelve estáticamente (lo empaqueta en el
        // chunk). Sigue cumpliendo la intención del guard: el specifier
        // nunca puede apuntar fuera del root servido (404 → avatar inerte).
        const resoluble =
          s.startsWith("./vendor/") || s.startsWith("@ego/avatar/");
        expect(resoluble, `${file}: ${s} sale del root y no lo resuelve el bundler`).toBe(
          true
        );
        expect(s, `${file}: ${s} contiene ..`).not.toContain("..");
      }
    }
  });

  it("el motor canónico es el paquete @ego/avatar (A6, Ola 1b)", async () => {
    // EGO-FIND-63 (Ola 10): era un aserto de TEXTO de fuente ("el
    // fichero contiene el specifier"). Ahora es COMPORTAMIENTO: el módulo
    // del paquete se importa de verdad y tiene que exportar el elemento.
    // (El specifier exacto lo vigila el lint-test de contratos de fuente:
    // `node apps/desktop/scripts/lint/source-contracts.lint.mjs`.)
    const mod = (await import(
      "@ego/avatar/runtime/avatar-element.js"
    )) as { EgoAvatar?: unknown };
    expect(typeof mod.EgoAvatar, "el paquete @ego/avatar no exporta el elemento").toBe(
      "function"
    );
  });

  it("entries vendorizados existen (elemento + sonido + shim studio)", () => {
    expect(existsSync(join(floatingDir, "vendor", "avatar", "runtime", "avatar-element.js"))).toBe(
      true,
    );
    expect(existsSync(join(floatingDir, "vendor", "avatar", "runtime", "sound.js"))).toBe(true);
    // Shim FIND-12-01: el transform de Vite exige que TODO import literal
    // resuelva (dev y build); sin él, 500 en dev y fallo de build.
    expect(existsSync(join(floatingDir, "vendor", "avatar", "studio", "index.js"))).toBe(true);
  });
});
