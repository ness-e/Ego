/**
 * E5 (Ola 5 · T1) — La identidad declarativa de un Sub-Ego LLEGA al producto.
 *
 * ## Qué afirma (comportamiento, no texto de código)
 * 1. Un manifiesto que declara su artefacto de identidad (`SOUL.md`) →
 *    el alma efectiva sale del **fichero** (no del manifiesto).
 * 2. Sin artefacto declarado → el loader en código sigue siendo la fuente
 *    de verdad (fallback intacto).
 * 3. Artefacto declarado **no obligatorio** e ilegible → fallback al
 *    manifiesto + aviso (fail-open de IDENTIDAD).
 * 4. Artefacto declarado **obligatorio** e ilegible → **error tipado**
 *    (fail-closed: el turno NO puede continuar con otra identidad).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createScratchDir, removeScratchDir } from "./helpers/test-scratch.js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  resolveSubEgoIdentity,
  isRequiredIdentityMissing,
} from "../src/main/subegos/identity.js";
import type { SubEgoManifest } from "@ego/subegos";

function manifest(overrides: Partial<SubEgoManifest> = {}): SubEgoManifest {
  return {
    id: "ego.tester",
    name: "Tester",
    role: "Probador",
    description: "Sub-Ego de pruebas",
    systemPrompt: "Eres un probador.",
    responsibilities: [],
    capabilities: [],
    tools: [],
    permissions: [],
    namespaces: { read: [], write: [] },
    behavior: {
      tone: "rigorous-analytical",
      reasoningStyle: "first-principles",
      autonomy: "supervised",
      learning: "none",
    } as SubEgoManifest["behavior"],
    autonomy: { level: "supervised", requiresApproval: true } as SubEgoManifest["autonomy"],
    budget: {
      maxTokensPerCall: 4000,
      maxDailyCostUsd: 2,
      requiresApprovalAboveUsd: 0.5,
    },
    trigger: { kind: "manual" } as SubEgoManifest["trigger"],
    ...overrides,
  } as SubEgoManifest;
}

let dir: string;

beforeEach(() => {
  dir = createScratchDir("identity");
});

afterEach(() => {
  // El scratch es compartido (T-X1) y se borra al terminar: este test no
  // debe dejar nada en `%TEMP%`.
  removeScratchDir(dir);
});

describe("E5 — la identidad declarativa llega al producto", () => {
  it("un Sub-Ego con SOUL.md carga su alma DESDE EL FICHERO", async () => {
    writeFileSync(
      join(dir, "SOUL.md"),
      [
        "---",
        "name: Tester",
        "description: Identidad declarada",
        "---",
        "",
        "Eres el tester declarado: tu voz viene del fichero, no del manifiesto.",
        "",
      ].join("\n"),
      "utf8"
    );

    const resolution = await resolveSubEgoIdentity(
      manifest({
        identity: { file: "SOUL.md", format: "auto", required: false },
      } as Partial<SubEgoManifest>),
      { workspacePath: dir }
    );

    expect(resolution.source, "el alma debe venir del fichero").toBe("file");
    expect(resolution.file).toContain("SOUL.md");
    // El texto del FICHERO está en el alma efectiva: el manifiesto dice otra
    // cosa ("Eres un probador.").
    const rendered = JSON.stringify(resolution.soul);
    expect(rendered).toContain("tester declarado");
  });

  it("sin artefacto declarado, el loader en código sigue siendo la fuente (fallback)", async () => {
    const resolution = await resolveSubEgoIdentity(manifest(), {
      workspacePath: dir,
    });
    expect(resolution.source).toBe("manifest");
    expect(resolution.warnings).toEqual([]);
  });

  it("artefacto NO obligatorio e ilegible → fallback al manifiesto + aviso", async () => {
    const resolution = await resolveSubEgoIdentity(
      manifest({
        identity: { file: "NO-EXISTE.md", format: "auto", required: false },
      } as Partial<SubEgoManifest>),
      { workspacePath: dir }
    );
    expect(resolution.source, "debe caer al manifiesto").toBe("manifest");
    expect(resolution.warnings.length, "debe avisar del fallo").toBeGreaterThan(0);
    expect(resolution.warnings[0]).toContain("NO-EXISTE.md");
  });

  it("artefacto OBLIGATORIO e ilegible → error tipado (fail-closed)", async () => {
    let caught: unknown = null;
    try {
      await resolveSubEgoIdentity(
        manifest({
          identity: { file: "NO-EXISTE.md", format: "auto", required: true },
        } as Partial<SubEgoManifest>),
        { workspacePath: dir }
      );
    } catch (err) {
      caught = err;
    }
    expect(caught, "la identidad obligatoria ausente debe fallar").toBeTruthy();
    expect(isRequiredIdentityMissing(caught)).toBe(true);
    expect(String((caught as Error).message)).toContain("NO-EXISTE.md");
  });

  it("un error que NO es de identidad no se confunde con el fail-closed", () => {
    expect(isRequiredIdentityMissing(new Error("otro cosa"))).toBe(false);
    expect(isRequiredIdentityMissing("texto")).toBe(false);
    expect(isRequiredIdentityMissing(null)).toBe(false);
  });
});
