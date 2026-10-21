import { describe, it, expect } from "vitest";
import * as path from "node:path";
import {
  SubEgoSoul,
  parseSoulDocument,
  serializeSoulDocument,
  loadSubEgoIdentity,
  resolveIdentityPath,
  SubEgoIdentityNotFoundError,
  SubEgoIdentityUnsafePathError,
  type SubEgoIdentityFileReader,
} from "../src/index.js";
import { createSubEgoManifest } from "../src/SubEgoManifest.js";
import type { SubEgoManifest } from "../src/types.js";

/**
 * E5 (Ola 4b / A3 / T1) — Identidad declarativa de Sub-Egos.
 *
 * El "alma" de un Sub-Ego vive hoy en CÓDIGO (`SubEgoSoul.ts`). E5 pide
 * externalizarla a un ARTEFACTO declarativo (`SOUL.md` / `AGENT.md`) que el
 * manifiesto declara y el runtime carga, **manteniendo la API pública**:
 * si no hay artefacto, el loader en código sigue siendo el fallback.
 */

const SOUL_MD = `---
id: ego.auditor-tecnico
name: Auditor Técnico
tone: analytical
reasoningStyle: first-principles
values:
  - La evidencia precede a la opinión
  - Un hallazgo sin reproducible no es un hallazgo
inviolableRules:
  - Nunca declarar "listo" sin tests en verde
customDirectives:
  - Reportar por severidad decreciente
temperament:
  skepticismLevel: high
  proactivityLevel: propose-first
  detailDepth: summary-first
---

Eres un auditor técnico de un equipo de ingeniería.

Tu trabajo es encontrar defectos, no validar el trabajo de otros.
`;

const AGENT_MD = `---
name: Redactor B2B
tone: formal
soul:
  reasoningStyle: persuasive-narrative
  values:
    - Claridad antes que adorno
---

Redacta correos B2B. Una idea por párrafo.
`;

function manifestWith(overrides: Partial<SubEgoManifest> = {}): SubEgoManifest {
  const base = createSubEgoManifest({
    name: "Auditor Técnico",
    role: "Auditor",
    instructions: "Audita el código del proyecto y reporta hallazgos por severidad.",
  });
  return { ...base, ...overrides } as SubEgoManifest;
}

function readerOf(files: Record<string, string>): SubEgoIdentityFileReader {
  const normalize = (p: string): string => p.replace(/\\/g, "/");
  return {
    readFile: async (p: string): Promise<string> => {
      const target = normalize(p);
      const found = Object.entries(files).find(([k]) => target.endsWith(normalize(k)));
      if (!found) {
        const err = new Error(`ENOENT: no such file or directory, open '${p}'`) as NodeJS.ErrnoException;
        err.code = "ENOENT";
        throw err;
      }
      return found[1] as string;
    },
  };
}

describe("E5 — parseo del artefacto declarativo de identidad", () => {
  it("separa frontmatter YAML y cuerpo Markdown", () => {
    const doc = parseSoulDocument(SOUL_MD);

    expect(doc.frontmatter.id).toBe("ego.auditor-tecnico");
    expect(doc.frontmatter.tone).toBe("analytical");
    expect(doc.body).toContain("Eres un auditor técnico");
    expect(doc.body).not.toContain("---");
    expect(doc.warnings).toEqual([]);
  });

  it("un documento SIN frontmatter no rompe: avisa y usa el cuerpo entero", () => {
    const doc = parseSoulDocument("Sólo cuerpo, sin frontmatter.");

    expect(doc.frontmatter).toEqual({});
    expect(doc.body).toContain("Sólo cuerpo");
    expect(doc.warnings.length).toBeGreaterThan(0);
  });

  it("el frontmatter mal formado es un error tipado, no un `catch {}`", () => {
    expect(() => parseSoulDocument("---\nid: [no, es, un, array\nname: x\n---\n")).toThrow(
      /frontmatter|yaml/i
    );
  });

  it("serializa a un documento canónico (round-trip estable)", () => {
    const doc = parseSoulDocument(SOUL_MD);
    const serialized = serializeSoulDocument(doc.frontmatter, doc.body);
    const reparsed = parseSoulDocument(serialized);

    expect(reparsed.frontmatter.id).toBe(doc.frontmatter.id);
    expect(reparsed.body.trim()).toBe(doc.body.trim());
  });
});

describe("E5 — SubEgoSoul.fromMarkdown / toMarkdown", () => {
  it("construye un alma desde el artefacto declarativo", () => {
    const soul = SubEgoSoul.fromMarkdown(SOUL_MD);

    expect(soul.id).toBe("ego.auditor-tecnico");
    expect(soul.name).toBe("Auditor Técnico");
    expect(soul.tone).toBe("analytical");
    expect(soul.reasoningStyle).toBe("first-principles");
    expect(soul.values).toContain("La evidencia precede a la opinión");
    expect(soul.inviolableRules).toContain("Nunca declarar \"listo\" sin tests en verde");
    expect(soul.temperament?.skepticismLevel).toBe("high");
  });

  it("el cuerpo Markdown se conserva como narrativa de identidad", () => {
    const soul = SubEgoSoul.fromMarkdown(SOUL_MD);

    expect(soul.identityBody).toContain("Eres un auditor técnico");
    expect(soul.toSoulBlock()).toContain("IDENTITY NARRATIVE");
    expect(soul.toSoulBlock()).toContain("Eres un auditor técnico");
  });

  it("el round-trip soul → markdown → soul preserva la identidad", () => {
    const soul = SubEgoSoul.fromMarkdown(SOUL_MD);
    const again = SubEgoSoul.fromMarkdown(soul.toMarkdown());

    expect(again.id).toBe(soul.id);
    expect(again.name).toBe(soul.name);
    expect(again.tone).toBe(soul.tone);
    expect(again.values).toEqual(soul.values);
    expect(again.inviolableRules).toEqual(soul.inviolableRules);
    expect(again.identityBody).toBe(soul.identityBody);
  });

  it("`AGENT.md` admite el bloque `soul:` anidado", () => {
    const soul = SubEgoSoul.fromMarkdown(AGENT_MD, {
      id: "ego.redactor",
      reasoningStyle: "analytical-deductive",
    });

    expect(soul.name).toBe("Redactor B2B");
    expect(soul.tone).toBe("formal");
    expect(soul.reasoningStyle).toBe("persuasive-narrative");
    expect(soul.values).toContain("Claridad antes que adorno");
  });
});

describe("E5 — carga de la identidad declarada por el manifiesto", () => {
  it("carga el artefacto declarado y reporta la fuente `file`", async () => {
    const manifest = manifestWith({
      identity: { file: "egos/auditor/SOUL.md", format: "auto", required: true },
    });

    const res = await loadSubEgoIdentity(manifest, {
      reader: readerOf({ "egos/auditor/SOUL.md": SOUL_MD }),
      workspacePath: "/workspace",
    });

    expect(res.source).toBe("file");
    expect(res.soul.id).toBe("ego.auditor-tecnico");
    expect(res.soul.identityBody).toContain("Eres un auditor técnico");
  });

  it("FALLBACK: sin `identity` en el manifiesto, la API actual sigue funcionando (código)", async () => {
    const manifest = manifestWith();

    const res = await loadSubEgoIdentity(manifest, { reader: readerOf({}) });

    expect(res.source).toBe("manifest");
    expect(res.soul.id).toBe(manifest.id);
    expect(res.soul.name).toBe(manifest.name);
    expect(res.warnings).toEqual([]);
  });

  it("FALLBACK: artefacto ausente y `required: false` → vuelve al manifiesto con aviso", async () => {
    const manifest = manifestWith({
      identity: { file: "egos/auditor/SOUL.md", format: "auto", required: false },
    });

    const res = await loadSubEgoIdentity(manifest, {
      reader: readerOf({}),
      workspacePath: "/workspace",
    });

    expect(res.source).toBe("manifest");
    expect(res.soul.id).toBe(manifest.id);
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.warnings.join(" ")).toMatch(/no se pudo leer|ausente|no encontrado/i);
  });

  it("`required: true` + artefacto ausente → error tipado (fail-closed)", async () => {
    const manifest = manifestWith({
      identity: { file: "egos/auditor/SOUL.md", format: "auto", required: true },
    });

    await expect(
      loadSubEgoIdentity(manifest, { reader: readerOf({}), workspacePath: "/workspace" })
    ).rejects.toThrow(SubEgoIdentityNotFoundError);
  });

  it("una ruta fuera del workspace se rechaza (path traversal)", async () => {
    const manifest = manifestWith({
      identity: { file: "../../../etc/passwd", format: "auto", required: true },
    });

    await expect(
      loadSubEgoIdentity(manifest, { reader: readerOf({}), workspacePath: "/workspace" })
    ).rejects.toThrow(SubEgoIdentityUnsafePathError);
  });

  it("`resolveIdentityPath` ancla la ruta relativa al workspace", () => {
    const resolved = resolveIdentityPath(
      { file: "egos/auditor/SOUL.md", format: "auto", required: true },
      { workspacePath: "/workspace" }
    );

    expect(resolved).toBe(path.resolve("/workspace", "egos/auditor/SOUL.md"));
  });
});

describe("E5 — el manifiesto declara la identidad", () => {
  it("`createSubEgoManifest` propaga la declaración de identidad", () => {
    const manifest = createSubEgoManifest({
      name: "Auditor Técnico",
      role: "Auditor",
      instructions: "Audita el código del proyecto y reporta hallazgos por severidad.",
      identity: { file: "egos/auditor/SOUL.md", format: "soul-md", required: true },
    });

    expect(manifest.identity?.file).toBe("egos/auditor/SOUL.md");
    expect(manifest.identity?.format).toBe("soul-md");
    expect(manifest.identity?.required).toBe(true);
  });

  it("sin declaración de identidad, el manifiesto no la inventa", () => {
    const manifest = createSubEgoManifest({
      name: "Auditor Técnico",
      role: "Auditor",
      instructions: "Audita el código del proyecto y reporta hallazgos por severidad.",
    });

    expect(manifest.identity).toBeUndefined();
  });
});
