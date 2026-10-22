import React, { useState, useMemo, useEffect, useRef } from "react";
import { TraitRegistry, type DomainCharacterPreset, type CharacterTrait } from "../traits/TraitRegistry.js";
import { Sparkle, Check, ArrowClockwise, FloppyDisk, Eye, Lightbulb, Lightning, MagnifyingGlass, Warning, XCircle, Triangle, Hexagon, Diamond, type Icon } from "@phosphor-icons/react";
import {
  loadCharacterConfig,
  saveCharacterConfig,
  liveCharacterGateway,
} from "./characterProfileBridge.js";

// Registro automático del custom element <ego-avatar> (motor vendorizado).
import "../../../floating/vendor/avatar/runtime/avatar-element.js";
import { Button } from "../../ui-kit/Button.js";

export type BaseFormType =
  | "delta-core"
  | "quantum-monolith"
  | "energy-core"
  | "fractal-polyhedron";

export type StudioPresetType =
  | "cx-faithful"
  | "ego-nucleus"
  | "ego-cyber"
  | "ego-sentinel"
  | "ego-architect";

export interface CustomCharacterConfig {
  subEgoId: string;
  name: string;
  bodyColors: [string, string];
  eyeShape: "pill" | "wide" | "dot" | "line" | "flat" | "happy" | "cup";
  baseForm: BaseFormType;
  outfitId?: string | null;
  traits: string[];
  /**
   * A6 (Ola 11): la INTENSIDAD de cada rasgo. Antes el round-trip la
   * perdia (el bridge ponia un 1 fijo) → un perfil guardado con
   * `intensity: 0.4` volvia como 1.
   */
  traitIntensities?: Record<string, number>;
  studioPreset?: StudioPresetType;
  accessory?: string;
  roundness?: number;
}

export interface WardrobeSelectorProps {
  subEgoId?: string;
  onSave?: (config: CustomCharacterConfig) => void;
  onClose?: () => void;
}

export const STUDIO_PRESETS_OPTIONS: Array<{ id: StudioPresetType; label: string }> = [
  { id: "cx-faithful", label: "Fiel CX Grafito" },
  { id: "ego-nucleus", label: "Ego Nucleus" },
  { id: "ego-cyber", label: "Ego Cyber" },
  { id: "ego-sentinel", label: "Ego Sentinel" },
  { id: "ego-architect", label: "Ego Architect" },
];

export const ACCESSORY_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "none", label: "Ninguno" },
  { id: "cx-full-kit", label: "Kit Completo CX" },
  { id: "cx-antenna", label: "Antena CX" },
  { id: "headphones", label: "Auriculares" },
  { id: "cyber-goggles", label: "Gafas Cyber" },
  { id: "crown", label: "Corona" },
  { id: "halo", label: "Halo" },
  { id: "sprout", label: "Brote" },
];

const COLOR_PALETTES: Array<{ name: string; colors: [string, string] }> = [
  { name: "Cyan Neón", colors: ["#06b6d4", "#083344"] },
  { name: "Ámbar Núcleo", colors: ["#f59e0b", "#451a03"] },
  { name: "Esmeralda Dev", colors: ["#10b981", "#022c22"] },
  { name: "Púrpura Quantum", colors: ["#a855f7", "#3b0764"] },
  { name: "Obsidiana Noir", colors: ["#52525b", "#18181b"] },
  { name: "Carmesí Alerta", colors: ["#f43f5e", "#4c0519"] },
];

const EYE_SHAPES: Array<{ id: CustomCharacterConfig["eyeShape"]; label: string }> = [
  { id: "pill", label: "Píldora" },
  { id: "wide", label: "Amplio" },
  { id: "dot", label: "Punto" },
  { id: "line", label: "Línea" },
  { id: "flat", label: "Plano" },
  { id: "happy", label: "Feliz" },
  { id: "cup", label: "Curvo" },
];

/**
 * D18: los estados de prueba se identificaban con EMOJI (👁️ 💭 ⚡ 🔍 ⚠️ ✨ ❌).
 * Los emoji son glifos del SO: no heredan el color del token, se rompen con
 * la fuente de la plataforma y no tienen nombre accesible. Ahora cada estado
 * lleva su icono Phosphor, que sí hereda `currentColor` y es decorativo
 * (`aria-hidden`) con la etiqueta de texto como nombre real.
 */
const TEST_STATES: Array<{ id: string; label: string; icon: Icon }> = [
  { id: "idle", label: "Idle", icon: Eye },
  { id: "thinking", label: "Pensando", icon: Lightbulb },
  { id: "working", label: "Trabajando", icon: Lightning },
  { id: "searching", label: "Buscando", icon: MagnifyingGlass },
  { id: "approval", label: "Aprobación", icon: Warning },
  { id: "happy", label: "Feliz", icon: Sparkle },
  { id: "error", label: "Error", icon: XCircle },
];

/**
 * D18: la geometría del núcleo se identificaba con EMOJI (🔺 🤖 🔷 ⚡). Cada
 * silueta tiene ahora su icono Phosphor (`Triangle`, `Robot`, `Hexagon`,
 * `Diamond`), que además describe la FORMA que el usuario está eligiendo.
 */
const BASE_FORM_OPTIONS: Array<{ id: BaseFormType; label: string; icon: Icon }> = [
  { id: "delta-core", label: "Delta Core (Triangular)", icon: Triangle },
  { id: "fractal-polyhedron", label: "Fractal Polyhedron (Hexagonal)", icon: Hexagon },
  { id: "quantum-monolith", label: "Quantum Monolith", icon: Diamond },
];

/**
 * Puente tipado con el web component `<ego-avatar>`.
 *
 * El motor expone una API imperativa (`play`, `applyStudioPreset`,
 * `setState`, `_studio`) que React no conoce: en vez de `any` (prohibido por
 * las reglas del repo) se declara el mínimo estructural que el selector usa
 * de verdad. Los métodos son opcionales porque el registro del custom element
 * puede no estar listo (SSR / test sin DOM de canvas).
 */
interface EgoAvatarElement extends HTMLElement {
  play?: (emote: string) => Promise<unknown>;
  applyStudioPreset?: (preset: string) => void;
  setState?: (state: string, options?: { immediate?: boolean }) => void;
  _studio?: () => { setParam?: (name: string, value: unknown) => void } | null;
}

export const WardrobeSelector: React.FC<WardrobeSelectorProps> = ({
  subEgoId = "ego.nucleus",
  onSave,
  onClose,
}) => {
  TraitRegistry.initialize();
  const defaultPreset = TraitRegistry.getPreset(subEgoId);

  const [currentConfig, setCurrentConfig] = useState<CustomCharacterConfig>(() => ({
    subEgoId,
    name: defaultPreset.name,
    bodyColors: [...defaultPreset.bodyColors] as [string, string],
    eyeShape: defaultPreset.eyeShape,
    baseForm: defaultPreset.baseForm ?? "delta-core",
    outfitId: null,
    traits: [...defaultPreset.traits],
    studioPreset: "cx-faithful",
    accessory: "none",
    roundness: 50,
  }));

  const [previewState, setPreviewState] = useState<string>("idle");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const studioAvatarRef = useRef<HTMLElement | null>(null);

  // CHAR-10: restore al montar — la personalización sobrevive reinicios vía
  // VantaDB (`egos/<subEgoId>` + `character`, gateway único). Ausente o
  // corrupto = se conserva el preset (nunca wipe). Fire-and-forget honesto.
  useEffect(() => {
    let cancelled = false;
    void loadCharacterConfig(subEgoId, liveCharacterGateway())
      .then((persisted) => {
        if (cancelled || !persisted) return;
        setCurrentConfig(persisted);
        const base = TraitRegistry.getPreset(subEgoId);
        TraitRegistry.registerPreset({
          ...base,
          bodyColors: persisted.bodyColors,
          eyeShape: persisted.eyeShape,
          baseForm: persisted.baseForm,
          outfitId: null,
          traits: persisted.traits,
        });
      })
      .catch((err) => {
        console.warn("[WardrobeSelector] No se pudo restaurar la personalización:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [subEgoId]);

  // Sincronizar preset del studio en el web component si cambia
  useEffect(() => {
    const el = studioAvatarRef.current as EgoAvatarElement | null;
    if (!el) return;
    if (typeof el.applyStudioPreset === "function") {
      try {
        el.applyStudioPreset(currentConfig.studioPreset || "cx-faithful");
      } catch {}
    } else if (typeof el.setAttribute === "function") {
      try {
        el.setAttribute("preset", currentConfig.studioPreset || "cx-faithful");
      } catch {}
    }
  }, [currentConfig.studioPreset]);

  // Sincronizar accesorio
  useEffect(() => {
    const el = studioAvatarRef.current as EgoAvatarElement | null;
    if (!el) return;
    const host = el._studio?.();
    if (host && typeof host.setParam === "function") {
      host.setParam("accessory", currentConfig.accessory || "none");
    }
  }, [currentConfig.accessory]);

  // Sincronizar redondez de cabeza (squircleN)
  useEffect(() => {
    const el = studioAvatarRef.current as EgoAvatarElement | null;
    if (!el) return;
    const host = el._studio?.();
    if (host && typeof host.setParam === "function") {
      const n = 2.0 + ((currentConfig.roundness ?? 50) / 100) * 3.0;
      host.setParam("squircleN", n);
    }
  }, [currentConfig.roundness]);

  const availableTraits = useMemo(() => {
    return TraitRegistry.listTraits();
  }, []);

  const handlePaletteSelect = (colors: [string, string]) => {
    setCurrentConfig((prev) => ({ ...prev, bodyColors: colors }));
  };

  const handleShapeSelect = (baseForm: BaseFormType) => {
    setCurrentConfig((prev) => ({ ...prev, baseForm }));
  };

  const handleStudioPresetSelect = (studioPreset: StudioPresetType) => {
    setCurrentConfig((prev) => ({ ...prev, studioPreset }));
  };

  const handleAccessorySelect = (accessory: string) => {
    setCurrentConfig((prev) => ({ ...prev, accessory }));
  };

  const handleRoundnessChange = (roundness: number) => {
    setCurrentConfig((prev) => ({ ...prev, roundness }));
  };

  const handleTraitToggle = (traitId: string) => {
    setCurrentConfig((prev) => {
      const exists = prev.traits.includes(traitId);
      const newTraits = exists
        ? prev.traits.filter((t) => t !== traitId)
        : [...prev.traits, traitId];
      return { ...prev, traits: newTraits };
    });
  };

  const handleEyeShapeSelect = (eyeShape: CustomCharacterConfig["eyeShape"]) => {
    setCurrentConfig((prev) => ({ ...prev, eyeShape }));
  };

  const handleReset = () => {
    setCurrentConfig({
      subEgoId,
      name: defaultPreset.name,
      bodyColors: [...defaultPreset.bodyColors] as [string, string],
      eyeShape: defaultPreset.eyeShape,
      baseForm: defaultPreset.baseForm ?? "delta-core",
      outfitId: null,
      traits: [...defaultPreset.traits],
      studioPreset: "cx-faithful",
      accessory: "none",
      roundness: 50,
    });
    setPreviewState("idle");
    setSavedSuccess(false);
  };

  const handleSave = () => {
    // Registrar el override en TraitRegistry en tiempo de ejecución
    const updatedPreset: DomainCharacterPreset = {
      ...defaultPreset,
      bodyColors: currentConfig.bodyColors,
      eyeShape: currentConfig.eyeShape,
      baseForm: currentConfig.baseForm === "delta-core" ? "delta-core" : "quantum-monolith",
      outfitId: null,
      traits: currentConfig.traits,
    };
    TraitRegistry.registerPreset(updatedPreset);

    // CHAR-10: persistir a VantaDB vía gateway único (nunca directo).
    // Fire-and-forget honesto, mismo patrón que `useCanvasBridge.persistNow`.
    void saveCharacterConfig(currentConfig, liveCharacterGateway()).catch((err) => {
      console.warn("[WardrobeSelector] No se pudo persistir la personalización:", err);
    });

    onSave?.(currentConfig);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    // D3: el radio de la tarjeta de Identidad era `rounded-2xl` (16 px),
    // un valor fuera de la escala del sistema. Ahora usa el radio canónico
    // `rounded-[var(--radius-card)]` (8 px), igual que el resto de la app.
    // `@container`: el reparto preview | controles lo decide el ancho REAL
    // de la tarjeta, no el del viewport. Con `md:grid-cols-3` (breakpoint de
    // viewport) el panel de la vista de avatares —que vive en la columna
    // estrecha del workspace— repartía 477 px en 3 columnas de 132 px, y
    // el marco del avatar (176 px) SE SOBRESALÍA sobre los controles.
    <div className="@container flex w-full max-w-2xl flex-col select-none rounded-[var(--radius-card)] border border-hairline bg-panel p-5 text-xs shadow-[var(--ego-elevation-l2)]">
      {/* Cabecera */}
      <div className="mb-4 flex items-center justify-between border-b border-hairline pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkle size={16} className="shrink-0 text-warning" />
          <h3 className="text-sm font-semibold text-ink">
            Personalización de Identidad & Rasgos Morfológicos
          </h3>
        </div>
        <span className="shrink-0 font-mono text-xs text-faint">{subEgoId}</span>
      </div>

      {/* Dos columnas (preview | controles) sólo cuando la tarjeta da de sí.
          El mínimo de 220 px de la primera columna es lo que garantiza que
          el marco del avatar (176 px + 32 px de padding) NO se invada la
          columna de controles. Por debajo, se apilan. */}
      <div className="grid grid-cols-1 gap-5 @[560px]:grid-cols-[minmax(220px,1fr)_2fr]">
        {/* Panel izquierdo: Preview viva del Avatar en grande (size=140) con Robot Studio 2.5D */}
        <div className="flex flex-col items-center justify-between rounded-[var(--radius-card)] border border-hairline bg-paper p-4">
          <div className="flex w-full flex-col items-center justify-center">
            <div
              // El escenario del avatar usa la superficie más profunda del
              // sistema (`bg-paper`): el hex anterior (#0d0f17) era un valor
              // congelado que no acompañaba al cambio de paleta.
              // D3: el marco de 176×176 tenía `rounded-3xl` (24 px), fuera de
              // escala: ahora radio canónico de 8 px.
              className="mb-2 flex h-44 w-44 cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-paper p-2 shadow-[var(--ego-elevation-l3)]"
              onClick={() => {
                const el = studioAvatarRef.current as EgoAvatarElement | null;
                if (el && typeof el.play === "function") {
                  void el.play("happy").catch(() => {});
                }
              }}
              title="Haz clic para interactuar con el avatar"
            >
              {React.createElement("ego-avatar", {
                ref: studioAvatarRef,
                seed: subEgoId,
                state: previewState === "happy" ? "finished" : previewState,
                size: "140",
                mode: currentConfig.baseForm === "delta-core" ? "svg" : "studio",
                preset: currentConfig.studioPreset || "cx-faithful",
                "pointer-follow": "true",
                sound: "false",
                motion: "auto",
                style: { width: "140px", height: "140px", display: "block" },
              })}
            </div>
            <span className="flex items-center gap-1 font-mono text-xs font-semibold text-brand">
              <Sparkle size={12} weight="bold" /> Robot Studio 2.5D
            </span>
            <span className="mt-1 text-center text-xs font-semibold text-ink">
              {currentConfig.name}
            </span>
            <span className="mt-0.5 text-center font-mono text-xs text-faint">
              {currentConfig.baseForm === "delta-core"
                ? "Delta Core (Triángulo C₃)"
                : "Robot Studio CX (Squircle / Superelipse)"}
            </span>
          </div>

          {/* Selector de prueba de estados en vivo */}
          <div className="mt-4 w-full border-t border-hairline pt-3">
            <span className="mb-1.5 block text-center text-xs font-semibold text-dim">
              Probar Animación de Estado
            </span>
            <div className="flex flex-wrap justify-center gap-1">
              {TEST_STATES.map((st) => {
                const StateIcon = st.icon;
                const isSelected = previewState === st.id;
                return (
                  <Button
                    key={st.id}
                    type="button"
                    size="sm"
                    variant={isSelected ? "primary" : "secondary"}
                    icon={<StateIcon size={12} />}
                    onClick={() => {
                      setPreviewState(st.id);
                      const el = studioAvatarRef.current as EgoAvatarElement | null;
                      if (st.id === "happy" && el && typeof el.play === "function") {
                        void el.play("happy").catch(() => {});
                      }
                    }}
                    aria-pressed={isSelected}
                    title={`Estado ${st.label}`}
                    className={`rounded-md ${isSelected ? "" : "border-hairline text-dim hover:text-ink"}`}
                  >
                    {st.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel derecho: Controles de Personalización */}
        <div className="max-h-[460px] space-y-4 overflow-y-auto pr-1">
          {/* 1. Geometría de Silueta */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-dim">
              Geometría Base del Núcleo
            </label>
            <div className="grid grid-cols-1 gap-1.5 @[380px]:grid-cols-2">
              {BASE_FORM_OPTIONS.map((opt) => {
                const FormIcon = opt.icon;
                const isSelected = currentConfig.baseForm === opt.id;
                return (
                  <Button
                    key={opt.id}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleShapeSelect(opt.id)}
                    aria-pressed={isSelected}
                    // `min-h-7` + `whitespace-normal`: las etiquetas largas
                    // ("Robot Studio CX (Squircle / Superelipse)") se parten
                    // por PALABRA en dos líneas; el `h-7` fijo del kit las
                    // recortaba a media palabra.
                    //
                    // Ola 5 · T4: `h-auto` a secas dejaba el botón en 18 px
                    // (por debajo del objetivo táctil mínimo de 24 px del
                    // design system): lo detectó la auditoría visual al abrir
                    // por fin esta superficie (el canvas de avatares nunca se
                    // auditaba). `min-h-7` mantiene el crecimiento por
                    // contenido con el suelo de 28 px.
                    className={`h-auto min-h-7 w-full rounded-md whitespace-normal text-left ${
                      isSelected ? "border-ink font-semibold" : "border-hairline text-dim hover:text-ink"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5 text-left">
                      <FormIcon size={13} className="shrink-0" />
                      <span className="min-w-0">{opt.label}</span>
                    </span>
                    {isSelected && <Check size={12} weight="bold" className="shrink-0 text-success" />}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* 2. Preset Robot Studio */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-dim">
              Preset Robot Studio (Ego Native)
            </label>
            <div className="grid grid-cols-1 gap-1.5 @[380px]:grid-cols-2">
              {STUDIO_PRESETS_OPTIONS.map((p) => {
                const isSelected = (currentConfig.studioPreset ?? "cx-faithful") === p.id;
                return (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleStudioPresetSelect(p.id)}
                    aria-pressed={isSelected}
                    className={`rounded-md ${isSelected ? "border-ink font-semibold" : "border-hairline text-dim hover:text-ink"}`}
                  >
                    <span className="min-w-0 truncate">{p.label}</span>
                    {isSelected && <Check size={12} weight="bold" className="shrink-0 text-brand" />}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* 3. Accesorio de Cabecera */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-dim">
              Accesorio de Cabecera
            </label>
            <div className="grid grid-cols-2 gap-1 @[380px]:grid-cols-4">
              {ACCESSORY_OPTIONS.map((acc) => {
                const isSelected = (currentConfig.accessory ?? "none") === acc.id;
                return (
                  <Button
                    key={acc.id}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleAccessorySelect(acc.id)}
                    aria-pressed={isSelected}
                    title={acc.label}
                    truncate
                    className={`rounded-md ${isSelected ? "border-ink font-semibold" : "border-hairline text-dim hover:text-ink"}`}
                  >
                    {acc.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* 4. Redondez de Cabeza (Roundness) */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold text-dim">
                Redondez de Cabeza (Roundness)
              </label>
              <span className="font-mono text-xs font-medium text-ink">
                {currentConfig.roundness ?? 50}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={currentConfig.roundness ?? 50}
              onChange={(e) => handleRoundnessChange(Number(e.target.value))}
              aria-label="Redondez de cabeza"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-[var(--radius-card)] bg-raised accent-brand"
            />
          </div>

          {/* 5. Rasgos Anatómicos y Sensores */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-dim">
              Rasgos Anatómicos & Sensores ({currentConfig.traits.length} activos)
            </label>
            <div className="grid max-h-28 grid-cols-1 gap-1.5 overflow-y-auto pr-1 @[380px]:grid-cols-2">
              {availableTraits.map((trait: CharacterTrait) => {
                const isSelected = currentConfig.traits.includes(trait.id);
                return (
                  <Button
                    key={trait.id}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleTraitToggle(trait.id)}
                    aria-pressed={isSelected}
                    className={`rounded-md ${isSelected ? "border-ink font-semibold" : "border-hairline text-dim hover:text-ink"}`}
                  >
                    <span className="min-w-0 truncate">{trait.name}</span>
                    {isSelected && <Check size={12} weight="bold" className="shrink-0 text-brand" />}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* 6. Paletas de Color */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-dim">
              Gradiente Energético Corporal
            </label>
            <div className="grid grid-cols-2 gap-1.5 @[380px]:grid-cols-3">
              {COLOR_PALETTES.map((pal) => {
                const isSelected =
                  currentConfig.bodyColors[0] === pal.colors[0] &&
                  currentConfig.bodyColors[1] === pal.colors[1];
                return (
                  <Button
                    key={pal.name}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePaletteSelect(pal.colors)}
                    aria-pressed={isSelected}
                    className={`rounded-md ${isSelected ? "border-ink font-semibold" : "border-hairline text-dim hover:text-ink"}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full border border-hairline"
                        // El degradado reproduce la paleta REAL del avatar (dato
                        // del personaje, ver EGO-DL-003): no es un color de UI, así
                        // que no tiene token — el valor llega en runtime.
                        // design-lint: allow
                        style={{
                          background: `linear-gradient(to bottom, ${pal.colors[0]}, ${pal.colors[1]})`,
                        }}
                      />
                      <span className="min-w-0 truncate">{pal.name}</span>
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* 7. Forma de Ojos */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-dim">
              Expresión Ocular
            </label>
            <div className="flex flex-wrap gap-1">
              {EYE_SHAPES.map((shape) => {
                const isSelected = currentConfig.eyeShape === shape.id;
                return (
                  <Button
                    key={shape.id}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleEyeShapeSelect(shape.id)}
                    aria-pressed={isSelected}
                    className={`rounded-md ${isSelected ? "border-ink font-semibold" : "border-hairline text-dim hover:text-ink"}`}
                  >
                    {shape.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Acciones */}
      <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
        <Button
          type="button"
          size="md"
          variant="secondary"
          icon={<ArrowClockwise size={13} />}
          onClick={handleReset}
          className="whitespace-nowrap"
        >
          Restaurar Predeterminado
        </Button>

        <div className="flex items-center gap-2">
          {onClose && (
            <Button
              type="button"
              size="md"
              variant="secondary"
              onClick={onClose}
              className="whitespace-nowrap"
            >
              Cancelar
            </Button>
          )}
          <Button
            type="button"
            size="md"
            variant="primary"
            icon={<FloppyDisk size={14} weight="bold" />}
            onClick={handleSave}
            className="whitespace-nowrap"
          >
            {savedSuccess ? "¡Guardado!" : "Guardar Personalización"}
          </Button>
        </div>
      </div>
    </div>
  );
};
