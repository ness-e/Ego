/**
 * Helper común `parseActorId` (F4T9/M24).
 *
 * Resuelve el actor/sub-ego responsable desde `payload` + `metadata`
 * tolerando las formas legacy observadas en `gov/audit`:
 * - string directo (`subEgoId`, `actor`, `metadata.agent_id`)
 * - objeto `{ id }`
 * - objeto etiquetado VDB `{ String }` (registros previos a `unwrapMetadata`)
 *
 * Precedencia canónica: `payload.subEgoId` > `payload.actor` >
 * `metadata.agent_id` > `fallback` (`ego.nucleus`).
 */
export function parseActorId(
  payload: Record<string, unknown>,
  metadata: Record<string, unknown>,
  fallback = "ego.nucleus"
): string {
  const fromPayload = parseActorField(payload.subEgoId);
  if (fromPayload) return fromPayload;

  if (typeof payload.actor === "string" && payload.actor.trim()) {
    return payload.actor;
  }

  const fromMetadata = parseActorField(metadata.agent_id, true);
  if (fromMetadata) return fromMetadata;

  return fallback;
}

/**
 * Normaliza un campo de actor en sus formas conocidas.
 * Retorna `null` si no contiene un identificador utilizable.
 *
 * `taggedFirst` preserva la precedencia histórica de `metadata.agent_id`
 * (`{ String }` antes que `{ id }`), distinta de la de `payload.subEgoId`.
 */
function parseActorField(value: unknown, taggedFirst = false): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const tagged = typeof obj.String === "string" && obj.String.trim() ? obj.String : null;
    const byId = typeof obj.id === "string" && obj.id.trim() ? obj.id : null;
    if (taggedFirst) return tagged ?? byId;
    return byId ?? tagged;
  }
  return null;
}
