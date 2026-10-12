// Workaround: VDB-BUG-02 (inverso del etiquetado en putMulti)
export function unwrapMetadata(
  tagged: Record<string, unknown> | undefined | null
): Record<string, unknown> {
  if (tagged === undefined || tagged === null) return {};
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(tagged)) {
    if (v === "Null") {
      clean[k] = null;
    } else if (typeof v === "object" && v !== null) {
      const rec = v as Record<string, unknown>;
      if ("String" in rec) clean[k] = rec["String"];
      else if ("Float" in rec) clean[k] = rec["Float"];
      else if ("Bool" in rec) clean[k] = rec["Bool"];
      else clean[k] = v;
    } else {
      clean[k] = v;
    }
  }
  return clean;
}
