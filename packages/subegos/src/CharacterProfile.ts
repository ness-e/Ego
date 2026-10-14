import { z } from "zod";
import type { EgoMemoryAdapter } from "@ego/memory";
import { getQuarantineAware } from "@ego/memory";

/**
 * Siluetas geométricas y morfológicas abstractas canónicas (CHAR-03 / CHAR-04).
 * Cero representaciones antropomorfas o humanoides.
 */
export const BaseFormSchema = z.enum([
  "quantum-monolith",
  "energy-core",
  "fractal-polyhedron",
  "delta-core",
  "coucou-mochi"
]);
export type BaseForm = z.infer<typeof BaseFormSchema>;

/**
 * Validador estricto para valores de color en hexadecimal o RGB/RGBA.
 */
export const HexOrRgbaColorSchema = z
  .string()
  .min(3)
  .regex(
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*[\d.]+\s*)?\)$/,
    "Formato de color inválido. Debe ser hexadecimal (#RGB, #RGBA, #RRGGBB, #RRGGBBAA) o rgb/rgba()."
  );

/**
 * Paleta cromática no humana y bio-digital del personaje.
 */
export const ColorPaletteSchema = z.object({
  /** Color primario de la superficie/superelipsoide */
  primary: HexOrRgbaColorSchema,
  /** Color secundario para gradientes y sombreado espectral */
  secondary: HexOrRgbaColorSchema,
  /** Color de acento para ojos, pulsos e indicadores de foco */
  accent: HexOrRgbaColorSchema,
  /** Resplandor perimetral y campo energético */
  aura: HexOrRgbaColorSchema,
  /** Destello opcional para estados de excitación cognitiva */
  glow: HexOrRgbaColorSchema.optional()
});
export type ColorPalette = z.infer<typeof ColorPaletteSchema>;

/**
 * Morfología de ojos procedimentales (13 formas del motor Coucou Mochi / CHAR-03).
 */
export const EyeShapeSchema = z.enum([
  "pill",
  "wide",
  "dot",
  "line",
  "flat",
  "happy",
  "closed",
  "spiral",
  "heart",
  "star",
  "tired",
  "wink",
  "cup"
]);
export type EyeShape = z.infer<typeof EyeShapeSchema>;

/**
 * Expresión de boca reactiva procedural.
 */
export const MouthShapeSchema = z.enum([
  "flat",
  "slight-smile",
  "open-smile",
  "o-shape",
  "wavy",
  "smirk",
  "tongue-out",
  "frown"
]);
export type MouthShape = z.infer<typeof MouthShapeSchema>;

/**
 * Rasgos anatómicos no humanoides y slots abstractos permitidos.
 * Queda terminantemente prohibida vestimenta humana (trajes, corbatas, ropa, etc.).
 */
export const TraitKindSchema = z.enum([
  "halo",
  "energy-cores",
  "antennae",
  "floating-shards",
  "aura-field",
  "quantum-crown",
  "orbital-rings",
  "geometric-crest"
]);
export type TraitKind = z.infer<typeof TraitKindSchema>;

/**
 * Lista negra de conceptos obsoletos de ropa humana para rechazo preventivo.
 */
export const BANNED_HUMAN_CLOTHING = [
  "suit",
  "tie",
  "jacket",
  "shirt",
  "pants",
  "shoes",
  "dress",
  "hoodie",
  "tuxedo",
  "glasses-human",
  "hat-human"
] as const;

/**
 * Configuración de un rasgo anatómico o geométrico.
 */
export const TraitConfigSchema = z.object({
  kind: TraitKindSchema,
  intensity: z.number().min(0).max(1).default(1),
  color: HexOrRgbaColorSchema.optional(),
  enabled: z.boolean().default(true)
});
export type TraitConfig = z.infer<typeof TraitConfigSchema>;

/**
 * Contrato canónico CharacterProfile (CHAR-04 / Decisión P20).
 * Define la identidad visual, morfología y aura enlazada a un Sub-Ego.
 */
export const CharacterProfileSchema = z.object({
  id: z
    .string()
    .min(3)
    .regex(
      /^(char_[a-z0-9_-]+|ego\.[a-z0-9_.-]+\.char)$/,
      "El ID debe comenzar con 'char_' o coincidir con 'ego.<subego>.char'."
    ),
  name: z.string().min(2).max(80),
  baseForm: BaseFormSchema.default("quantum-monolith"),
  palette: ColorPaletteSchema,
  defaultEye: EyeShapeSchema.default("pill"),
  defaultMouth: MouthShapeSchema.default("flat"),
  traits: z.array(TraitConfigSchema).default([]),
  scale: z.number().positive().max(3).default(1),
  pulseRate: z.number().positive().max(5).default(1),
  createdAtMs: z.number().int().positive().default(() => Date.now()),
  updatedAtMs: z.number().int().positive().default(() => Date.now()),
  metadata: z.record(z.unknown()).optional()
});
export type CharacterProfile = z.infer<typeof CharacterProfileSchema>;

/**
 * Valida que un objeto de configuración no contenga términos de vestimenta humana obsoleta.
 */
export function validateNoHumanClothing(data: unknown): void {
  const jsonStr = JSON.stringify(data).toLowerCase();
  for (const banned of BANNED_HUMAN_CLOTHING) {
    if (jsonStr.includes(`"${banned}"`)) {
      throw new Error(
        `[CharacterProfile] Violación de dirección de arte: el rasgo '${banned}' representa vestimenta humana obsoleta prohibida en Ego (CHAR-04).`
      );
    }
  }
}

/**
 * Paletas temáticas armónicas según el rol o dominio cognitivo del Sub-Ego.
 */
const DOMAIN_PALETTES: Record<string, ColorPalette> = {
  engineering: {
    primary: "#00E5FF",
    secondary: "#0077B6",
    accent: "#00B4D8",
    aura: "rgba(0, 229, 255, 0.35)",
    glow: "#90E0EF"
  },
  code: {
    primary: "#00E5FF",
    secondary: "#0077B6",
    accent: "#00B4D8",
    aura: "rgba(0, 229, 255, 0.35)",
    glow: "#90E0EF"
  },
  knowledge: {
    primary: "#A855F7",
    secondary: "#6B21A8",
    accent: "#C084FC",
    aura: "rgba(168, 85, 247, 0.35)",
    glow: "#E9D5FF"
  },
  research: {
    primary: "#8B5CF6",
    secondary: "#4C1D95",
    accent: "#A78BFA",
    aura: "rgba(139, 92, 246, 0.35)",
    glow: "#DDD6FE"
  },
  product: {
    primary: "#F59E0B",
    secondary: "#B45309",
    accent: "#FBBF24",
    aura: "rgba(245, 158, 11, 0.35)",
    glow: "#FDE68A"
  },
  governance: {
    primary: "#3B82F6",
    secondary: "#1E40AF",
    accent: "#60A5FA",
    aura: "rgba(59, 130, 246, 0.35)",
    glow: "#BFDBFE"
  },
  nucleus: {
    primary: "#10B981",
    secondary: "#047857",
    accent: "#34D399",
    aura: "rgba(16, 185, 129, 0.35)",
    glow: "#A7F3D0"
  }
};

/**
 * Fábrica de perfiles de personajes por defecto con combinaciones cromáticas coherentes.
 *
 * @param subEgoId ID del Sub-Ego propietario (ej. "ego.code-reviewer")
 * @param domain Dominio o especialidad ("engineering", "knowledge", "product", etc.)
 * @returns CharacterProfile validado y listo para persistir
 */
export function createDefaultCharacterProfile(
  subEgoId: string,
  domain: string = "nucleus"
): CharacterProfile {
  const normalizedDomain = domain.toLowerCase().trim();
  const palette = DOMAIN_PALETTES[normalizedDomain] ?? DOMAIN_PALETTES.nucleus;
  const slug = subEgoId.replace(/^(ego\.|sub_)/, "").replace(/[^a-z0-9_-]/g, "");

  const profile: CharacterProfile = {
    id: `char_${slug || "default"}`,
    name: `${subEgoId} Avatar`,
    baseForm: "quantum-monolith",
    palette,
    defaultEye: "pill",
    defaultMouth: "flat",
    traits: [
      {
        kind: "aura-field",
        intensity: 0.8,
        color: palette.aura,
        enabled: true
      }
    ],
    scale: 1,
    pulseRate: 1,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now()
  };

  return CharacterProfileSchema.parse(profile);
}

/**
 * Persiste el CharacterProfile de un Sub-Ego en el namespace canónico de VantaDB.
 * Namespace: `egos/<id>`, Clave: `character`
 */
export async function saveCharacterProfile(
  memory: EgoMemoryAdapter,
  subEgoId: string,
  profile: CharacterProfile
): Promise<void> {
  validateNoHumanClothing(profile);
  const validated = CharacterProfileSchema.parse(profile);
  await memory.put({
    namespace: `egos/${subEgoId}`,
    key: "character",
    payload: validated,
    metadata: {
      subEgoId,
      profileId: validated.id,
      baseForm: validated.baseForm,
      updatedAtMs: Date.now()
    }
  });
}

/**
 * Recupera el CharacterProfile de un Sub-Ego desde VantaDB.
 * Quarantine-aware (FIX-01 SEC-09): `egos/*` ya no difiere su enforcement —
 * resuelve live + `quarantine/pending` con la implementación única
 * compartida (`getQuarantineAware`).
 *
 * @returns CharacterProfile validado o null si no existe
 */
export async function loadCharacterProfile(
  memory: EgoMemoryAdapter,
  subEgoId: string
): Promise<CharacterProfile | null> {
  const record = await getQuarantineAware(memory, `egos/${subEgoId}`, "character");
  if (!record) return null;

  let raw: unknown = record;
  if (typeof record === "object" && record !== null && "payload" in record) {
    raw = (record as { payload: unknown }).payload;
  }

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      // noop
    }
  }

  try {
    validateNoHumanClothing(raw);
    return CharacterProfileSchema.parse(raw);
  } catch (error) {
    console.warn(`[CharacterProfile] Perfil corrupto o incompatible para Sub-Ego '${subEgoId}':`, error);
    return null;
  }
}
