import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { EgoMemoryAdapter } from "@ego/memory";
import {
  SelfImprovementLoop,
  LessonLearnedSchema,
  type LearningCandidate,
} from "../src/SelfImprovementLoop.js";

describe("SelfImprovementLoop — Closed Learning Loop y Auto-Reflexión (SUB-12)", () => {
  const testDir = path.join(os.tmpdir(), `ego-self-improvement-test-${Date.now()}`);
  let adapter: EgoMemoryAdapter;
  let loop: SelfImprovementLoop;

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    adapter = new EgoMemoryAdapter(testDir);
    await adapter.init();
    loop = new SelfImprovementLoop(adapter);
  });

  afterEach(async () => {
    if (adapter && adapter.ready) {
      await adapter.close();
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignorar bloqueos temporales en Windows
    }
  });

  it("1. Valida el esquema canónico LessonLearnedSchema", () => {
    const rawLesson = {
      id: "les_12345678",
      subEgoId: "code_reviewer",
      trigger: "verification_failure",
      context: "Verificación de imports relativos en ESM",
      insight: "Los imports relativos en TypeScript para Node 22 deben incluir extensión .js",
      actionableRule: "Siempre especificar extensión .js en imports relativos de módulos TypeScript.",
      confidence: 0.8,
      reinforcementCount: 1,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      tags: ["typescript", "esm", "imports"],
    };

    const parsed = LessonLearnedSchema.safeParse(rawLesson);
    expect(parsed.success).toBe(true);
  });

  it("2. Filtra eventos no elegibles (errores de red transitorios o infraestructura)", () => {
    // Error de red no elegible
    const networkFail: Partial<LearningCandidate> = {
      subEgoId: "researcher",
      context: "Búsqueda web",
      errorMessage: "ECONNREFUSED 127.0.0.1:8080",
      actionableRule: "Reintentar conexión",
    };
    expect(loop.isEligibleForReflection(networkFail)).toBe(false);

    // Rate limit externo no elegible
    const rateLimitFail: Partial<LearningCandidate> = {
      subEgoId: "researcher",
      context: "Inferencia LLM",
      errorMessage: "HTTP 429 Too Many Requests (Rate limit exceeded)",
      actionableRule: "Esperar cuota",
    };
    expect(loop.isEligibleForReflection(rateLimitFail)).toBe(false);

    // Error recuperable legítimo de código sí es elegible
    const validCandidate: Partial<LearningCandidate> = {
      subEgoId: "code_reviewer",
      context: "Linter AST",
      errorMessage: "SyntaxError: Unexpected token",
      actionableRule: "Usar sintaxis tipada válida para TypeScript 5.6",
    };
    expect(loop.isEligibleForReflection(validCandidate)).toBe(true);
  });

  it("3. Registra nueva lección con persistencia en VantaDB", async () => {
    const candidate: LearningCandidate = {
      subEgoId: "code_reviewer",
      trigger: "tool_error_recovered",
      context: "Refactorización de llamadas de filesystem",
      insight: "fs.readFile en modo binario retorna Buffer y causó fallo de JSON.parse",
      actionableRule: "Especificar codificación 'utf-8' al invocar fs.readFile para lectura de JSON.",
      tags: ["fs", "json", "encoding"],
    };

    const { lesson, reinforced } = await loop.recordLesson(candidate);
    expect(reinforced).toBe(false);
    expect(lesson.id).toMatch(/^les_/);
    expect(lesson.confidence).toBe(0.7);
    expect(lesson.reinforcementCount).toBe(1);

    // Recuperamos directamente de VantaDB
    const recalled = await loop.recallLessons("code_reviewer");
    expect(recalled.length).toBe(1);
    expect(recalled[0].actionableRule).toBe(candidate.actionableRule);
  });

  it("4. Deduplica lecciones idénticas y refuerza la confianza en usos repetidos", async () => {
    const candidate: LearningCandidate = {
      subEgoId: "planner",
      trigger: "milestone_completed",
      context: "Descomposición de tareas en roadmap",
      insight: "Dividir tareas de más de 2 días en pasos atómicos evita bloqueos",
      actionableRule: "Descomponer tareas en bloques de máximo 1.5 a 2 días de appetite.",
      tags: ["planning", "shape-up"],
    };

    // Primera vez
    const res1 = await loop.recordLesson(candidate);
    expect(res1.reinforced).toBe(false);
    expect(res1.lesson.confidence).toBe(0.7);
    expect(res1.lesson.reinforcementCount).toBe(1);

    // Segunda vez con la misma regla para el mismo especialista
    const res2 = await loop.recordLesson(candidate);
    expect(res2.reinforced).toBe(true);
    expect(res2.lesson.confidence).toBeCloseTo(0.8, 2);
    expect(res2.lesson.reinforcementCount).toBe(2);

    // La lista en memoria solo debe contener 1 lección consolidada
    const list = await loop.recallLessons("planner");
    expect(list.length).toBe(1);
    expect(list[0].reinforcementCount).toBe(2);
  });

  it("5. Formatea directrices de lecciones aprendidas para el System Prompt", async () => {
    const candidate: LearningCandidate = {
      subEgoId: "researcher",
      trigger: "verification_failure",
      context: "Citas bibliográficas",
      insight: "Las citas inventadas degradan la credibilidad del reporte",
      actionableRule: "Verificar siempre URLs y referencias primarias antes de citarlas.",
      tags: ["fact-checking"],
    };

    const { lesson } = await loop.recordLesson(candidate);
    const promptBlock = loop.formatLessonsPrompt([lesson]);

    expect(promptBlock).toContain("🧠 Lecciones y Sabiduría Operativa Previa");
    expect(promptBlock).toContain("Verificar siempre URLs y referencias primarias");
    expect(promptBlock).toContain("[Confianza: 70%]");
  });

  it("6. recallLessons opera sobre list() con metadata desenvuelta (C03-list)", async () => {
    const candidate: LearningCandidate = {
      subEgoId: "researcher",
      trigger: "verification_failure",
      context: "Metadatos de list()",
      insight: "list() retorna metadata desenvuelta tras C03-list",
      actionableRule: "Leer la metadata de list() como primitivas.",
      tags: ["metadata"],
    };

    const { lesson: recorded } = await loop.recordLesson(candidate);

    // Evidencia de shape quarantine-aware (FIX-01 SEC-09): `egos/*` ya no
    // difiere su enforcement — el live queda vacío y la copia en
    // `quarantine/pending` porta metadata desenvuelta (primitivas, no
    // tagged {String}/{Float}).
    expect(await adapter.get("egos/researcher/lessons", `lesson:${recorded.id}`)).toBeNull();
    const raw = await adapter.listWithQuarantine("egos/researcher/lessons", 10);
    expect(raw.length).toBe(1);
    expect(raw[0].quarantined).toBe(true);
    const meta = raw[0].metadata ?? {};
    expect(typeof meta["confidence"]).toBe("number");
    expect(typeof meta["subEgoId"]).toBe("string");

    // El lector PAYLOAD-ONLY opera sobre el mismo list() sin depender de metadata.
    const recalled = await loop.recallLessons("researcher");
    expect(recalled.length).toBe(1);
    expect(recalled[0].actionableRule).toBe(candidate.actionableRule);
  });

  it("7. Guarda backup del estado previo antes de reforzar una lección (R15 rollback)", async () => {
    const candidate: LearningCandidate = {
      subEgoId: "r15tester",
      trigger: "tool_error_recovered",
      context: "Contexto original v1",
      insight: "Insight estable",
      actionableRule: "Regla R15 con backup previo obligatorio.",
      tags: ["r15"],
    };

    const res1 = await loop.recordLesson(candidate);
    expect(res1.reinforced).toBe(false);

    // El refuerzo sobrescribe la lección: el estado previo debe quedar en backup.
    const res2 = await loop.recordLesson({ ...candidate, context: "Contexto actualizado v2" });
    expect(res2.reinforced).toBe(true);

    const rows = await adapter.listWithQuarantine("egos/r15tester/lessons", 10);
    const backup = rows.find((r) => r.key === `lesson:${res1.lesson.id}:backup`);
    expect(backup).toBeDefined();
    const payload = backup?.payload as Record<string, unknown>;
    expect(payload["reinforcementCount"]).toBe(1);
    expect(payload["context"]).toBe("Contexto original v1");
    expect(typeof payload["backedUpAtMs"]).toBe("number");
  });
});
