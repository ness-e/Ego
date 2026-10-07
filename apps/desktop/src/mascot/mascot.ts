// Contrato mascota Ego — superficie por área, criterio único compartido.
// main decide {area, mood}; renderer solo renderiza. Nunca lógica en renderer.
export const MascotAreas = ["kb", "crm", "gov", "general"] as const;
export type MascotArea = (typeof MascotAreas)[number];
export const MascotMoods = ["idle", "thinking", "approval", "celebrate", "error", "support"] as const;
export type MascotMood = (typeof MascotMoods)[number];
export interface MascotState { area: MascotArea; mood: MascotMood }
export const MascotAccents: Record<MascotArea, string> = {
  kb: "lupa",
  crm: "nodo-grafo",
  gov: "escudo-check",
  general: "nucleo-engranaje",
};
