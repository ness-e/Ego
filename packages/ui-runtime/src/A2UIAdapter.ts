import { CanvasComponentManifestSchema, type CanvasComponentManifest } from "./schemas/components.js";
import type { CanvasChangeSet } from "./CanvasBridge.js";

export interface A2UISurfaceUpdate {
  surfaceId: string;
  components: unknown[];
  removeIds?: string[];
}

export type A2UIOp =
  | { kind: "inject"; manifest: CanvasComponentManifest }
  | { kind: "remove"; componentId: string }
  | { kind: "fallback"; id: string; reason: string };

export interface A2UIDataModelUpdate {
  componentId: string;
  path?: string;
  value: unknown;
  changeId?: string;
}

export function translateSurfaceUpdate(msg: A2UISurfaceUpdate): A2UIOp[] {
  const ops: A2UIOp[] = [];
  if (Array.isArray(msg.removeIds)) {
    for (const id of msg.removeIds) {
      if (typeof id === "string" && id.length > 0) ops.push({ kind: "remove", componentId: id });
    }
  }
  for (const raw of msg.components ?? []) {
    const parsed = CanvasComponentManifestSchema.safeParse(raw);
    if (parsed.success) {
      ops.push({ kind: "inject", manifest: parsed.data });
    } else {
      const rec = raw as { id?: unknown };
      const id = typeof rec?.id === "string" ? rec.id : "unknown";
      ops.push({ kind: "fallback", id, reason: parsed.error.issues[0]?.message ?? "schema mismatch" });
    }
  }
  return ops;
}

export function translateDataModelUpdate(msg: A2UIDataModelUpdate): CanvasChangeSet | null {
  if (!msg.componentId) return null;
  if (msg.value === undefined) return null;
  return {
    id: msg.changeId ?? `a2ui-${Date.now()}`,
    componentId: msg.componentId,
    timestamp: Date.now(),
    op: "update",
    path: msg.path,
    newValue: msg.value,
    origin: "subego",
  };
}

export function translateBeginRendering(msg: { surfaceId: string }): string | null {
  if (!msg.surfaceId) return null;
  return msg.surfaceId;
}
