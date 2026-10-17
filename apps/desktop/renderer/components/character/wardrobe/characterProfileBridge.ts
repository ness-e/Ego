// characterProfileBridge.ts — CHAR-10: persistencia UI→VantaDB vía gateway.
// El renderer NO importa `@ego/subegos` (arrastraría `@ego/memory` runtime,
// ver `packages/subegos/package.json:20` y R-FE-1): valida con un espejo Zod
// local de la forma canónica (`packages/subegos/src/CharacterProfile.ts:129-149`)
// y persiste por el gateway único `ego().memory` (namespace `egos/<id>`,
// clave `character` — mismo contrato que `save/loadCharacterProfile` main-side).

import { z } from "zod";
import { ego } from "../../../lib/ego.js";
import type { CustomCharacterConfig } from "./WardrobeSelector.js";

// Espejo local del contrato canónico (ref: CharacterProfile.ts). Si el
// canónico cambia, este test (`CharacterPersistence.test.ts`, forma del
// payload) lo señala: la divergencia es deuda explícita, no deriva silenciosa.
export const BridgeBaseFormSchema = z.enum([
  "quantum-monolith",
  "energy-core",
  "fractal-polyhedron",
  "delta-core",
  "coucou-mochi",
]);

const BridgeColorSchema = z
  .string()
  .min(3)
  .regex(
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*[\d.]+\s*)?\)$/,
    "color inválido"
  );

export const BridgeTraitKindSchema = z.enum([
  "halo",
  "energy-cores",
  "antennae",
  "floating-shards",
  "aura-field",
  "quantum-crown",
  "orbital-rings",
  "geometric-crest",
]);

export const BridgeEyeShapeSchema = z.enum([
  "pill", "wide", "dot", "line", "flat", "happy", "closed",
  "spiral", "heart", "star", "tired", "wink", "cup",
]);

export const CharacterProfilePayloadSchema = z.object({
  id: z.string().regex(/^(char_[a-z0-9_-]+|ego\.[a-z0-9_.-]+\.char)$/),
  name: z.string().min(2).max(80),
  baseForm: BridgeBaseFormSchema,
  palette: z.object({
    primary: BridgeColorSchema,
    secondary: BridgeColorSchema,
    accent: BridgeColorSchema,
    aura: BridgeColorSchema,
    glow: BridgeColorSchema.optional(),
  }),
  defaultEye: BridgeEyeShapeSchema,
  defaultMouth: z.string(),
  traits: z.array(
    z.object({
      kind: BridgeTraitKindSchema,
      intensity: z.number().min(0).max(1),
      enabled: z.boolean(),
    })
  ),
  scale: z.number().positive().max(3),
  pulseRate: z.number().positive().max(5),
  createdAtMs: z.number().int().positive(),
  updatedAtMs: z.number().int().positive(),
  metadata: z.record(z.unknown()).optional(),
});

export type CharacterProfilePayload = z.infer<typeof CharacterProfilePayloadSchema>;

export const CHARACTER_KEY = "character";
export const characterNamespace = (subEgoId: string): string => `egos/${subEgoId}`;

// Vocabulario UI (TraitRegistry) → vocabulario canónico (TraitKind). Los IDs
// UI que no mapean se conservan íntegros en `metadata.uiConfig` (round-trip
// fiel); la lista canónica es best-effort para consumidores main-side.
const UI_TRAIT_TO_KIND: Record<string, z.infer<typeof BridgeTraitKindSchema>> = {
  sensor_antenna_scanner: "antennae",
  sensor_bipolar_nodes: "energy-cores",
  visor_analytical: "aura-field",
  crest_logic_prism: "geometric-crest",
  crest_milestone_crown: "quantum-crown",
  aura_harmonic_halo: "halo",
};

function hexToRgbaCss(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const v = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(v)) return hex;
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`;
}

export function toCharacterPayload(config: CustomCharacterConfig): CharacterProfilePayload {
  const slug =
    config.subEgoId
      .replace(/^(ego\.|sub_)/, "")
      .replace(/[^a-z0-9_-]/gi, "")
      .toLowerCase() || "default";
  const [primary, secondary] = config.bodyColors;
  const payload = {
    id: `char_${slug}`,
    name: config.name,
    baseForm: config.baseForm,
    palette: {
      primary,
      secondary,
      accent: primary,
      aura: hexToRgbaCss(primary, 0.35),
    },
    defaultEye: config.eyeShape,
    defaultMouth: "flat",
    traits: config.traits.flatMap((traitId) => {
      const kind = UI_TRAIT_TO_KIND[traitId];
      return kind ? [{ kind, intensity: 1, enabled: true }] : [];
    }),
    scale: 1,
    pulseRate: 1,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    metadata: { subEgoId: config.subEgoId, uiConfig: { ...config } },
  };
  return CharacterProfilePayloadSchema.parse(payload);
}

export interface CharacterMemoryGateway {
  put: (item: { namespace: string; key: string; payload: unknown; metadata?: Record<string, unknown> }) => Promise<unknown>;
  get: (namespace: string, key: string) => Promise<unknown>;
}

export function liveCharacterGateway(): CharacterMemoryGateway {
  return {
    put: (item) => ego().memory("put", [item]),
    get: (namespace, key) => ego().memory("get", [namespace, key]),
  };
}

function unwrapRecord(record: unknown): unknown {
  let raw: unknown = record;
  if (typeof raw === "object" && raw !== null && "payload" in raw) {
    raw = (raw as { payload: unknown }).payload;
  }
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

function asCustomConfig(raw: unknown, subEgoId: string): CustomCharacterConfig | null {
  if (typeof raw !== "object" || raw === null) return null;
  const meta = (raw as { metadata?: { uiConfig?: unknown } }).metadata;
  const candidate = meta?.uiConfig ?? raw;
  if (typeof candidate !== "object" || candidate === null) return null;
  const c = candidate as Record<string, unknown>;
  if (
    typeof c.name !== "string" ||
    !Array.isArray(c.bodyColors) ||
    typeof c.eyeShape !== "string" ||
    typeof c.baseForm !== "string" ||
    !Array.isArray(c.traits)
  ) {
    return null;
  }
  return {
    subEgoId,
    name: c.name,
    bodyColors: [String(c.bodyColors[0]), String(c.bodyColors[1])] as [string, string],
    eyeShape: c.eyeShape as CustomCharacterConfig["eyeShape"],
    baseForm: c.baseForm as CustomCharacterConfig["baseForm"],
    outfitId: null,
    traits: c.traits.map(String),
    studioPreset: typeof c.studioPreset === "string" ? (c.studioPreset as CustomCharacterConfig["studioPreset"]) : undefined,
    accessory: typeof c.accessory === "string" ? c.accessory : undefined,
    roundness: typeof c.roundness === "number" ? c.roundness : undefined,
  };
}

export async function saveCharacterConfig(
  config: CustomCharacterConfig,
  gateway: CharacterMemoryGateway = liveCharacterGateway()
): Promise<void> {
  const payload = toCharacterPayload(config);
  await gateway.put({
    namespace: characterNamespace(config.subEgoId),
    key: CHARACTER_KEY,
    payload,
    metadata: { subEgoId: config.subEgoId, profileId: payload.id, updatedAtMs: Date.now() },
  });
}

export async function loadCharacterConfig(
  subEgoId: string,
  gateway: CharacterMemoryGateway = liveCharacterGateway()
): Promise<CustomCharacterConfig | null> {
  let record: unknown;
  try {
    record = await gateway.get(characterNamespace(subEgoId), CHARACTER_KEY);
  } catch {
    return null;
  }
  return asCustomConfig(unwrapRecord(record), subEgoId);
}
