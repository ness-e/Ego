import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isStale, findStalePackages, sourceFiles } from "../../../scripts/ensure-fresh-dist.cjs";

describe("ensure-fresh-dist gate (HIG-02)", () => {
  let root = "";

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "hig02-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function makePkg(name: string, opts: { withDist: boolean; srcNewer: boolean }): string {
    const pkg = join(root, name);
    mkdirSync(join(pkg, "src"), { recursive: true });
    writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: `@ego/${name}`, scripts: { build: "tsc" } }));
    writeFileSync(join(pkg, "src", "index.ts"), "export const x = 1;\n");
    if (opts.withDist) {
      mkdirSync(join(pkg, "dist"), { recursive: true });
      writeFileSync(join(pkg, "dist", "index.js"), "module.exports = {};\n");
      const now = Date.now() / 1000;
      const srcTime = opts.srcNewer ? now : now - 100;
      const distTime = opts.srcNewer ? now - 100 : now;
      utimesSync(join(pkg, "src", "index.ts"), srcTime, srcTime);
      utimesSync(join(pkg, "dist", "index.js"), distTime, distTime);
    }
    return pkg;
  }

  it("dist ausente => obsoleto", () => {
    const pkg = makePkg("a", { withDist: false, srcNewer: false });
    expect(isStale(pkg).stale).toBe(true);
  });

  it("src mas nuevo que dist => obsoleto", () => {
    const pkg = makePkg("b", { withDist: true, srcNewer: true });
    const result = isStale(pkg);
    expect(result.stale).toBe(true);
    expect(result.reason).toContain("src");
  });

  it("dist al dia => fresco", () => {
    const pkg = makePkg("c", { withDist: true, srcNewer: false });
    expect(isStale(pkg).stale).toBe(false);
  });

  it("findStalePackages solo reporta los obsoletos", () => {
    makePkg("fresh", { withDist: true, srcNewer: false });
    makePkg("stale", { withDist: true, srcNewer: true });
    const stale = findStalePackages(root);
    expect(stale.map((s) => s.name)).toEqual(["@ego/stale"]);
  });

  it("layout sin src/ (estilo packages/memory): fuentes en raiz cuentan", () => {
    const pkg = join(root, "rootlayout");
    mkdirSync(pkg, { recursive: true });
    writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "@ego/rootlayout", scripts: { build: "tsc" } }));
    writeFileSync(join(pkg, "index.ts"), "export const x = 1;\n");
    mkdirSync(join(pkg, "dist"), { recursive: true });
    writeFileSync(join(pkg, "dist", "index.js"), "module.exports = {};\n");
    const now = Date.now() / 1000;
    utimesSync(join(pkg, "index.ts"), now, now);
    utimesSync(join(pkg, "dist", "index.js"), now - 100, now - 100);
    expect(sourceFiles(pkg).length).toBeGreaterThan(0);
    expect(isStale(pkg).stale).toBe(true);
  });
});
