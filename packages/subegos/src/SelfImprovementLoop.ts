// SelfImprovementLoop.ts — Superación Personal y Closed Learning Loop (SUB-12)
// Basado en Principios Innegociables §1, §4 y compuerta KHOJ-05 (extracción de hechos y auto-reflexión).
// Permite a los Sub-Egos aprender de errores corregidos y reforzar estrategias exitosas inter-sesión.

import { z } from "zod";
import type { EgoMemoryAdapter } from "@ego/memory";
import { getQuarantineAware, listQuarantineAware, searchQuarantineAware } from "@ego/memory";
import { createHash } from "node:crypto";

/**
 * Esquema canónico de lección aprendida por un Sub-Ego.
 */
export const LessonLearnedSchema = z.object({
  id: z.string().min(8),
  subEgoId: z.string().min(1),
  trigger: z.enum([
    "tool_error_recovered",   // Herramienta falló inicialmente pero se corrigió el parámetro
    "verification_failure",   // Tests o linter fallaron y se ajustó el código
    "user_critique",          // El usuario corrigió explícitamente el enfoque
    "milestone_completed",    // Tarea compleja completada con patrón reutilizable
  ]),
  context: z.string().min(3),
  insight: z.string().min(5),
  actionableRule: z.string().min(5),
  confidence: z.number().min(0).max(1).default(0.7),
  reinforcementCount: z.number().int().min(1).default(1),
  createdAtMs: z.number().int().positive().default(() => Date.now()),
  updatedAtMs: z.number().int().positive().default(() => Date.now()),
  tags: z.array(z.string()).default([]),
});

export type LessonLearned = z.infer<typeof LessonLearnedSchema>;

export interface LearningCandidate {
  subEgoId: string;
  trigger: LessonLearned["trigger"];
  context: string;
  errorMessage?: string;
  resolution?: string;
  insight: string;
  actionableRule: string;
  tags?: string[];
}

/**
 * Closed Learning Loop para la superación continua de Sub-Egos.
 */
export class SelfImprovementLoop {
  private adapter: EgoMemoryAdapter;

  constructor(adapter: EgoMemoryAdapter) {
    this.adapter = adapter;
  }

  /**
   * Determina si un evento es elegible para auto-reflexión o debe descartarse.
   * Descarta errores de red transitorios, interrupciones externas o tareas vacías.
   */
  public isEligibleForReflection(candidate: Partial<LearningCandidate>): boolean {
    if (!candidate.subEgoId || !candidate.context || !candidate.actionableRule) {
      return false;
    }

    const err = (candidate.errorMessage || "").toLowerCase();
    // Excluir fallos de red/infraestructura donde la criatura no tuvo la culpa
    const infraErrors = [
      "econnrefused",
      "etimedout",
      "enotfound",
      "socket hang up",
      "rate limit",
      "429",
      "503",
      "network error",
      "abort",
    ];

    for (const infra of infraErrors) {
      if (err.includes(infra)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Genera un hash determinista para la deduplicación de lecciones semánticamente idénticas.
   */
  public generateLessonHash(subEgoId: string, rule: string): string {
    const normalized = `${subEgoId}:${rule.trim().toLowerCase().replace(/\s+/g, " ")}`;
    return "les_" + createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  }

  /**
   * Procesa y registra una lección aprendida con deduplicación y refuerzo de confianza.
   */
  public async recordLesson(candidate: LearningCandidate): Promise<{ lesson: LessonLearned; reinforced: boolean }> {
    if (!this.isEligibleForReflection(candidate)) {
      throw new Error(`Candidato no elegible para auto-reflexión (infraestructura externa o datos insuficientes)`);
    }

    const lessonId = this.generateLessonHash(candidate.subEgoId, candidate.actionableRule);
    const namespace = `egos/${candidate.subEgoId}/lessons`;
    const key = `lesson:${lessonId}`;

    // 1. Verificar si ya existe una lección idéntica para reforzarla.
    // Quarantine-aware (FIX-01 SEC-09): `egos/*/lessons` sin diferimiento.
    let existingLesson: LessonLearned | null = null;
    try {
      const stored = await getQuarantineAware(this.adapter, namespace, key);
      if (stored) {
        const candidatePayload = stored.payload;
        const parsed = LessonLearnedSchema.safeParse(candidatePayload);
        if (parsed.success) {
          existingLesson = parsed.data;
        }
      }
    } catch {
      // Clave nueva no existente
    }

    if (existingLesson) {
      // Reforzar lección existente incrementando confianza y contador
      const updated: LessonLearned = {
        ...existingLesson,
        confidence: Math.min(1.0, existingLesson.confidence + 0.1),
        reinforcementCount: existingLesson.reinforcementCount + 1,
        updatedAtMs: Date.now(),
        context: candidate.context, // Actualizar al contexto más reciente
      };

      await this.adapter.put({
        namespace,
        key,
        payload: updated,
        metadata: {
          subEgoId: candidate.subEgoId,
          rule: updated.actionableRule,
          confidence: updated.confidence,
          tags: updated.tags.join(","),
        },
      });

      return { lesson: updated, reinforced: true };
    }

    // 2. Registrar nueva lección
    const newLesson: LessonLearned = {
      id: lessonId,
      subEgoId: candidate.subEgoId,
      trigger: candidate.trigger,
      context: candidate.context,
      insight: candidate.insight,
      actionableRule: candidate.actionableRule,
      confidence: 0.7,
      reinforcementCount: 1,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      tags: candidate.tags || [],
    };

    const validated = LessonLearnedSchema.parse(newLesson);

    await this.adapter.put({
      namespace,
      key,
      payload: validated,
      metadata: {
        subEgoId: candidate.subEgoId,
        rule: validated.actionableRule,
        confidence: validated.confidence,
        tags: validated.tags.join(","),
      },
    });

    return { lesson: validated, reinforced: false };
  }

  /**
   * Recupera las lecciones aprendidas relevantes de un Sub-Ego.
   */
  public async recallLessons(subEgoId: string, query?: string, limit = 5): Promise<LessonLearned[]> {
    const namespace = `egos/${subEgoId}/lessons`;
    try {
      if (query && query.trim().length > 0) {
        // Quarantine-aware: live + `quarantine/pending` filtrada y marcada.
        const results = await searchQuarantineAware(this.adapter, [namespace], query, { topK: limit });

        const lessons: LessonLearned[] = [];
        for (const r of results) {
          if (r.record) {
            let recordPayload = r.record.payload;
            try {
              if (typeof recordPayload === "string") {
                recordPayload = JSON.parse(recordPayload);
              }
            } catch {
              // mantén valor crudo
            }
            const parsed = LessonLearnedSchema.safeParse(recordPayload);
            if (parsed.success) {
              lessons.push(parsed.data);
            }
          }
        }
        return lessons;
      }

      // Recuperación directa quarantine-aware (live + cuarentena marcada).
      const items = await listQuarantineAware(this.adapter, namespace, limit);
      const lessons: LessonLearned[] = [];
      for (const item of items) {
        const parsed = LessonLearnedSchema.safeParse(item.payload);
        if (parsed.success) {
          lessons.push(parsed.data);
        }
      }

      // Ordenar por mayor confianza y refuerzo
      return lessons.sort((a, b) => b.confidence - a.confidence || b.reinforcementCount - a.reinforcementCount);
    } catch {
      return [];
    }
  }

  /**
   * Genera el bloque de directivas de aprendizaje para inyectar en el System Prompt del especialista.
   */
  public formatLessonsPrompt(lessons: LessonLearned[]): string {
    if (!lessons || lessons.length === 0) return "";

    const lines = [
      "## 🧠 Lecciones y Sabiduría Operativa Previa (Closed Learning Loop):",
      "Has resuelto situaciones similares en sesiones anteriores. Aplica estrictamente estas reglas aprendidas:",
    ];

    for (const l of lessons) {
      lines.push(
        `- **[Confianza: ${Math.round(l.confidence * 100)}%]** ${l.actionableRule} (Contexto: ${l.insight})`,
      );
    }

    return lines.join("\n");
  }
}
