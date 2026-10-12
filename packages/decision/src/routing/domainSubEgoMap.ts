import type { EgoDomain } from '../schemas/verdict.js';

/**
 * Tabla única dominio → Sub-Ego por defecto (F3T6/M03).
 * Fuente única compartida por `DecisionRouter` y `DecisionCascade`:
 * prohibido hardcodear ternarios dominio→subEgo en otro módulo.
 */
export const DOMAIN_SUB_EGO_MAP: Record<EgoDomain, string> = {
  engineering: 'ego.dev',
  knowledge: 'ego.research',
  product: 'ego.pm',
  analytics: 'ego.analyst',
  crm: 'ego.crm',
  general: 'ego.nucleus'
};

export const DEFAULT_SUB_EGO_ID = 'ego.nucleus';

/**
 * Resuelve el Sub-Ego por defecto de un dominio con fallback seguro a `ego.nucleus`.
 */
export function resolveSubEgoId(domain: EgoDomain): string {
  return DOMAIN_SUB_EGO_MAP[domain] ?? DEFAULT_SUB_EGO_ID;
}
