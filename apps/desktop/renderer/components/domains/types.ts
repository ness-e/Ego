/**
 * T4 (VERDICT R3) — Tipos y guardas compartidos por las vistas de dominio.
 *
 * Se extraen a su propio módulo para que `views.tsx` (las vistas) y
 * `DomainCanvasView.tsx` (el resolutor) compartan la MISMA fuente de verdad
 * sin importarse mutuamente (import circular).
 */
import type {
  EngineeringWorktree,
  ProductBacklogItem,
  ProductEpic,
} from "../../lib/ego.js";

/**
 * T06: tipos de dominio (antes 8× `any`). Proyecciones mínimas de lo que
 * renderiza la vista + guardas de frontera para respuestas IPC (`unknown`).
 */
export interface WorktreeStatusItem {
  branch: string;
  isMain: boolean;
}

export interface ProductListItem {
  id: string;
  title: string;
  status: string;
  priority: string;
}

export interface ProductEpicItem {
  id: string;
  title: string;
}

export interface KnowledgeFact {
  claim: string;
  source: string;
  confidence: number;
}

export interface CrmDealItem {
  id: string;
  title: string;
  stage: string;
  probabilityPct: number;
  valueUsd: number;
}

export interface CrmSummary {
  totalPipelineUsd: number;
  weightedPipelineUsd: number;
  dealsCount: number;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function flatMapValid<T>(
  arr: unknown[] | undefined,
  fn: (v: unknown) => T | null
): T[] {
  if (!arr) return [];
  const out: T[] = [];
  for (const v of arr) {
    const m = fn(v);
    if (m) out.push(m);
  }
  return out;
}

export function toWorktreeItem(v: EngineeringWorktree): WorktreeStatusItem {
  return { branch: v.branch, isMain: v.isMain };
}

export function toProductItem(v: ProductBacklogItem): ProductListItem {
  return { id: v.id, title: v.title, status: v.status, priority: v.priority };
}

export function toEpicItem(v: ProductEpic): ProductEpicItem {
  return { id: v.id, title: v.title };
}

export function toKnowledgeFact(v: unknown): KnowledgeFact | null {
  if (!isRecord(v) || typeof v.claim !== "string") return null;
  return {
    claim: v.claim,
    source: asString(v.source, "desconocida"),
    confidence: asNumber(v.confidence),
  };
}

export function toCrmDeal(v: unknown): CrmDealItem | null {
  if (!isRecord(v) || typeof v.id !== "string") return null;
  return {
    id: v.id,
    title: asString(v.title, v.id),
    stage: asString(v.stage, "qualified"),
    probabilityPct: asNumber(v.probabilityPct),
    valueUsd: asNumber(v.valueUsd),
  };
}

export function toCrmSummary(v: unknown): CrmSummary {
  // T12: sin cifras inventadas — lo ausente es cero, no un pipeline supuesto.
  const r = isRecord(v) ? v : {};
  return {
    totalPipelineUsd: asNumber(r.totalPipelineUsd, 0),
    weightedPipelineUsd: asNumber(r.weightedPipelineUsd, 0),
    dealsCount: asNumber(r.dealsCount, 0),
  };
}
