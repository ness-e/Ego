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
  "aura-field",
  "quantum-crown",
  "orbital-rings",
  "geometric-crest",
]);

/**
 * Los rasgos que el MOTOR no puede expresar.
 *
 * A6 (Ola 11) declara en `packages/avatar/src/runtime/profile.js` →
 * `UNMAPPED_TRAITS = ['floating-shards']`: las partículas del motor son del
 * ESTADO (la boca al hablar), no un knob del genoma.
 *
 * El renderer **no lo ofrece** (aquí tampoco está: ofrecerlo sería
 * prometer un rasgo que no se ve) → está declarado aquí, no ignorado en
 * silencio. Si algún día el motor lo expresa, se quita de esta lista (y del
 * enum de arriba) en el mismo cambio.
 */
export const UNMAPPED_TRAITS_IN_RENDERER = Object.freeze(["floating-shards"]);

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

/**
 * El inverso de `UI_TRAIT_TO_KIND`: el motor nombra los rasgos por su
 * `kind` ("halo") y el renderer por su id de UI ("aura_harmonic_halo").
 * La intensidad se guarda con el id de la UI (el vocabulario del config) →
 * esta tabla la traduce al `kind` canónico y de vuelta.
 */
const KIND_TO_UI_TRAIT: Record<string, string> = Object.fromEntries(
  Object.entries(UI_TRAIT_TO_KIND).map(([ui, kind]) => [kind, ui])
);

/**
 * Una entrada de rasgo en la **forma canónica** que el motor entiende.
 *
 * El motor (`packages/avatar/src/runtime/profile.js`, zona de A6) conoce el
 * vocabulario canónico (`TraitKind`): `antennae`, `geometric-crest`,
 * `energy-cores`, `aura-field`, `halo`, `orbital-rings`, `quantum-crown`.
 * El renderer guarda el perfil con el vocabulario **de la UI**
 * (`sensor_antenna_scanner`, `visor_analytical`, …) → si se mandan tal cual,
 * el motor los declara `unmapped` y **no aplica nada**.
 */
export interface CanonicalTraitEntry {
  /** El `TraitKind` canónico (el que el motor traduce a sus palancas). */
  kind: string;
  /**
   * La intensidad del rasgo (0..1).
   *
   * ⚠️ El motor sólo tiene **una** palanca de magnitud: el **aura**
   * (`AURA_RANGE`). Los otros rasgos **se aplican** pero su magnitud no se
   * puede expresar → el motor los declara en `unmappedIntensity`. Aquí la
   * intensidad se transporta **tal cual** (la verdad del perfil): no se
   * inventa ni se ajusta ninguna magnitud ✗.
   */
  intensity: number;
  enabled: boolean;
}

export interface CanonicalTraits {
  /** Las entradas canónicas, listas para el atributo `traits` del motor. */
  entries: CanonicalTraitEntry[];
  /**
   * Los ids de la UI que **no** tienen kind canónico: se **declaran**, no se
   * inventan (el motor los ignoraría en silencio).
   */
  unmapped: string[];
}

/**
 * Traduce el vocabulario de la UI al **canónico** que el motor entiende.
 *
 * Es el PUENTE entre las dos vocabularios:
 *  · el de la UI (`TraitRegistry`: `sensor_antenna_scanner`, …) → el config;
 *  · el canónico (`TraitKind`: `antennae`, …) → el motor.
 *
 * La intensidad viaja por rasgo (indexada por el **id de la UI**, que es el
 * vocabulario del config) y sale con el `kind` canónico.
 */
export function toCanonicalTraits(
  config: Pick<CustomCharacterConfig, "traits" | "traitIntensities">
): CanonicalTraits {
  const entries: CanonicalTraitEntry[] = [];
  const unmapped: string[] = [];
  for (const uiId of config.traits ?? []) {
    const kind = UI_TRAIT_TO_KIND[uiId];
    if (!kind) {
      // Sin kind canónico: se DECLARA (no se inventa un kind).
      unmapped.push(uiId);
      continue;
    }
    const raw = config.traitIntensities?.[uiId];
    const intensity =
      typeof raw === "number" && Number.isFinite(raw)
        ? Math.min(1, Math.max(0, raw))
        : 1;
    entries.push({ kind, intensity, enabled: true });
  }
  return { entries, unmapped };
}

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
      if (!kind) return [];
      // A6 (Ola 11): la INTENSIDAD del rasgo se conserva en el round-trip.
      // Antes era un `1` fijo → una perfil guardado con `intensity: 0.4`
      // volvía como `1` al recargar y guardar (la intensidad se perdía).
      // Ahora sale del propio perfil (`traitIntensities`) y, si no está, del
      // `enabled` del payload.
      const intensity = config.traitIntensities?.[traitId];
      return [
        {
          kind,
          intensity: typeof intensity === "number" ? intensity : 1,
          enabled: true,
        },
      ];
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
  const hasUiConfig =
    typeof meta?.uiConfig === "object" && meta?.uiConfig !== null;
  const candidate = hasUiConfig ? meta?.uiConfig : raw;
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

  // A6 (Ola 11): si el perfil trae su `uiConfig` (todos los guardados por
  // esta version del bridge), se devuelve **tal cual**: el round-trip es
  // exacto —no se pierde ningun ajuste de la UI (eyeShape, mouth, preset,
  // accesorio, roundness, outfitId) ni la intensidad de los rasgos, y no se
  // inventa ninguno nuevo.
  if (hasUiConfig) {
    return { ...(c as unknown as CustomCharacterConfig), subEgoId };
  }

  // Perfil legacy (sin `uiConfig`): se reconstruye desde el payload
  // canonico. Aqui si se aplica el mapa inverso (kind del motor → id de la
  // UI) para la intensidad, y se rellenan los campos que el payload no
  // tiene (el motor no los conoce: son ajustes de la UI).
  return {
    subEgoId,
    name: c.name,
    bodyColors: [String(c.bodyColors[0]), String(c.bodyColors[1])] as [string, string],
    eyeShape: c.eyeShape as CustomCharacterConfig["eyeShape"],
    baseForm: c.baseForm as CustomCharacterConfig["baseForm"],
    outfitId: typeof c.outfitId === "string" ? c.outfitId : null,
    traits: c.traits.map(String),
    traitIntensities: readTraitIntensities(raw),
    studioPreset:
      typeof c.studioPreset === "string"
        ? (c.studioPreset as CustomCharacterConfig["studioPreset"])
        : undefined,
    accessory: typeof c.accessory === "string" ? c.accessory : undefined,
    roundness: typeof c.roundness === "number" ? c.roundness : undefined,
  };
}

/**
 * Lee las intensidades de los rasgos del perfil persistido.
 *
 * El payload guarda `traits: [{kind, intensity, enabled}]` → de ahi sale la
 * intensidad por rasgo (si el rasgo esta activo).
 */
function readTraitIntensities(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof raw !== "object" || raw === null) return out;
  const traits = (raw as { traits?: unknown }).traits;
  if (!Array.isArray(traits)) return out;
  for (const t of traits) {
    if (typeof t !== "object" || t === null) continue;
    const kind = (t as { kind?: unknown }).kind;
    const intensity = (t as { intensity?: unknown }).intensity;
    const enabled = (t as { enabled?: unknown }).enabled;
    if (typeof kind !== "string") continue;
    if (enabled === false) continue;
    // La clave es el id de la UI (el vocabulario del config del renderer).
    const uiId = KIND_TO_UI_TRAIT[kind] ?? kind;
    out[uiId] = typeof intensity === "number" ? intensity : 1;
  }
  return out;
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
    // A6 (Ola 11): el `uiConfig` se guarda en los metadatos para que el
    // round-trip sea COMPLETO: el payload es el que entiende el MOTOR
    // (baseForm, rasgos, paleta) y no tiene cabida para los ajustes de la
    // UI (eyeShape, mouth, studioPreset, accessory, roundness, outfitId) →
    // sin esto, al recargar el perfil se perdian.
    metadata: {
      subEgoId: config.subEgoId,
      profileId: payload.id,
      updatedAtMs: Date.now(),
      uiConfig: { ...config },
    },
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
