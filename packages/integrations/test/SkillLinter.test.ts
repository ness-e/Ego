import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SkillLinter } from "../src/skills/SkillLinter.js";
import { SkillScanner } from "../src/skills/SkillScanner.js";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("SkillLinter (Auditoría AST y de Seguridad - HERM-19)", () => {
  const linter = new SkillLinter();

  it("debe validar exitosamente un manifiesto YAML frontmatter correcto", () => {
    const yamlSkill = `---
name: code-reviewer
description: Skill especializada en revisión de código estático y linters
version: 1.0.0
author: ego-core
tools:
  - git_diff
  - linter_check
permissions:
  - filesystem:read
tags:
  - engineering
  - quality
---

# Code Reviewer
Esta skill asiste al Sub-Ego Dev en la inspección estricta de código.
`;

    const res = linter.lintManifest(yamlSkill);
    expect(res.valid).toBe(true);
    expect(res.securityLevel).toBe("safe");
    expect(res.errors).toHaveLength(0);
    expect(res.metadata.name).toBe("code-reviewer");
    expect(res.metadata.description).toContain("revisión de código");
    expect(res.metadata.declaredTools).toEqual(["git_diff", "linter_check"]);
    expect(res.metadata.requiredPermissions).toEqual(["filesystem:read"]);
    expect(res.metadata.tags).toEqual(["engineering", "quality"]);
  });

  it("debe validar un manifiesto en formato JSON", () => {
    const jsonSkill = JSON.stringify({
      name: "data-analyzer",
      description: "Analítica de datos y series temporales",
      version: "0.2.0",
      tools: ["plot_chart", "sql_query"],
      permissions: ["db:read"],
      tags: ["analytics"],
    });

    const res = linter.lintManifest(jsonSkill);
    expect(res.valid).toBe(true);
    expect(res.securityLevel).toBe("safe");
    expect(res.metadata.name).toBe("data-analyzer");
    expect(res.metadata.declaredTools).toContain("sql_query");
  });

  it("debe rechazar manifiestos vacíos o sin nombre", () => {
    const resEmpty = linter.lintManifest("");
    expect(resEmpty.valid).toBe(false);
    expect(resEmpty.securityLevel).toBe("dangerous");

    const noName = `---
description: Solo descripción
---
`;
    const resNoName = linter.lintManifest(noName);
    expect(resNoName.valid).toBe(false);
    expect(resNoName.errors.some((e) => e.includes("name"))).toBe(true);
  });

  it("debe marcar como 'dangerous' código con eval() o new Function()", () => {
    const maliciousSkill = `---
name: malicious-helper
description: Intento de bypass
---

\`\`\`javascript
function executeArbitrary(code) {
  return eval(code);
}
\`\`\`
`;

    const res = linter.lintManifest(maliciousSkill);
    expect(res.valid).toBe(false);
    expect(res.securityLevel).toBe("dangerous");
    expect(res.errors.some((e) => e.includes("eval()"))).toBe(true);
  });

  it("debe detectar Prototype Pollution y process.exit", () => {
    const badCode = `
      Object.prototype.isAdmin = true;
      process.exit(1);
    `;

    const audit = linter.auditCode(badCode);
    expect(audit.safe).toBe(false);
    expect(audit.securityLevel).toBe("dangerous");
    expect(audit.violations.some((v) => v.includes("Prototype Pollution"))).toBe(true);
    expect(audit.violations.some((v) => v.includes("process.exit"))).toBe(true);
  });

  it("debe emitir advertencias en caso de llamadas de red no declaradas", () => {
    const codeWithNet = `
      const res = await fetch("https://external-api.com");
    `;

    const audit = linter.auditCode(codeWithNet);
    expect(audit.safe).toBe(true); // Seguro en cuanto a que no inyecta código fatal, pero con advertencia
    expect(audit.securityLevel).toBe("warning");
    expect(audit.warnings.some((w) => w.includes("fetch"))).toBe(true);
  });
});

describe("SkillScanner (Descubrimiento y Validación en Disco)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ego-skills-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("debe escanear un directorio local y retornar las skills analizadas", () => {
    // 1. Skill válida
    const validSkillDir = join(tempDir, "git-helper");
    mkdirSync(validSkillDir, { recursive: true });
    writeFileSync(
      join(validSkillDir, "SKILL.md"),
      `---
name: git-helper
description: Herramientas para git
tools:
  - git_status
---
# Git Helper
`
    );

    // 2. Skill con advertencias
    const warnSkillDir = join(tempDir, "net-scraper");
    mkdirSync(warnSkillDir, { recursive: true });
    writeFileSync(
      join(warnSkillDir, "skill.json"),
      JSON.stringify({
        name: "net-scraper",
        description: "Scraper web",
        permissions: ["network"],
      })
    );

    const scanner = new SkillScanner();
    const results = scanner.scan({ searchPaths: [tempDir] });

    expect(results).toHaveLength(2);
    const gitHelper = results.find((s) => s.id === "git-helper");
    expect(gitHelper).toBeDefined();
    expect(gitHelper?.valid).toBe(true);
    expect(gitHelper?.securityLevel).toBe("safe");
    expect(gitHelper?.tools).toEqual(["git_status"]);

    const netScraper = results.find((s) => s.id === "net-scraper");
    expect(netScraper).toBeDefined();
    expect(netScraper?.valid).toBe(true);
  });
});
