// Contrato y Tipos para Sub-Egos (Egos Creados por Ego)

export interface SubEgoBudget {
  maxTokensPerCall: number;
  maxDailyCostUsd: number;
  requiresApprovalAboveUsd: number;
}

export interface SubEgoNamespaces {
  read: string[];
  write: string[];
}

export interface SubEgoManifest {
  id: string; // ej: "ego.copywriter-saas" o "ego.github-watcher"
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  // Subconjunto compatible con persistencia. El tipo canónico completo vive
  // en `@ego/subegos` (`SubEgoManifest` + `SubEgoManifestSchema`); la
  // promoción legacy→canónica (defaults incluidos) es `fromMemoryManifest`.
  // HIG-03-F2: se admite "template" para que el canónico sea asignable aquí
  // (`SubEgoFactory.fromTemplate` crea con `creator: "template"`).
  creator: "user" | "ego-nucleus" | "template";
  createdAtMs: number;
  namespaces: SubEgoNamespaces;
  tools: string[];
  budget: SubEgoBudget;
  trigger: "manual" | "cron" | "event";
  state: "active" | "paused" | "archived";
}

export interface SubEgoSpawnRequest {
  name: string;
  role: string;
  instructions: string;
  suggestedTools?: string[];
  budget?: Partial<SubEgoBudget>;
}

export function createSubEgoId(name: string): string {
  const sanitized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `ego.${sanitized}`;
}

export function validateSubEgoAccess(
  manifest: SubEgoManifest,
  namespace: string,
  operation: "read" | "write"
): boolean {
  const allowedList = operation === "read" ? manifest.namespaces.read : manifest.namespaces.write;
  
  // Verificación por prefijo o match exacto
  return allowedList.some((allowed) => {
    if (allowed.endsWith("/*")) {
      const prefix = allowed.slice(0, -2);
      return namespace === prefix || namespace.startsWith(`${prefix}/`);
    }
    return namespace === allowed;
  });
}
