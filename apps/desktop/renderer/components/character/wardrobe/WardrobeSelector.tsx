import React, { useState, useMemo, useEffect, useRef } from "react";
import { TraitRegistry, type DomainCharacterPreset, type CharacterTrait } from "../traits/TraitRegistry.js";
import { Sparkle, Check, ArrowClockwise, FloppyDisk } from "@phosphor-icons/react";
import {
  loadCharacterConfig,
  saveCharacterConfig,
  liveCharacterGateway,
} from "./characterProfileBridge.js";

// Registro del custom element <ego-avatar>
import "../../../floating/vendor/avatar/runtime/avatar-element.js";

export type BaseFormType =
  | "delta-core"
  | "quantum-monolith"
  | "energy-core"
  | "fractal-polyhedron"
  | "coucou-mochi";

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

const TEST_STATES: Array<{ id: string; label: string; emoji: string }> = [
  { id: "idle", label: "Idle", emoji: "👁️" },
  { id: "thinking", label: "Pensando", emoji: "💭" },
  { id: "working", label: "Trabajando", emoji: "⚡" },
  { id: "searching", label: "Buscando", emoji: "🔍" },
  { id: "approval", label: "Aprobación", emoji: "⚠️" },
  { id: "happy", label: "Feliz", emoji: "✨" },
  { id: "error", label: "Error", emoji: "❌" },
];

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
    const el = studioAvatarRef.current as any;
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
    const el = studioAvatarRef.current as any;
    if (!el) return;
    const host = el._studio?.();
    if (host && typeof host.setParam === "function") {
      host.setParam("accessory", currentConfig.accessory || "none");
    }
  }, [currentConfig.accessory]);

  // Sincronizar redondez de cabeza (squircleN)
  useEffect(() => {
    const el = studioAvatarRef.current as any;
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
      baseForm: currentConfig.baseForm === "delta-core" ? "delta-core" : "coucou-mochi",
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
    <div className="flex flex-col bg-panel border border-hairline rounded-2xl p-5 shadow-lg max-w-2xl w-full text-xs select-none">
      {/* Cabecera */}
      <div className="flex items-center justify-between pb-3 border-b border-hairline mb-4">
        <div className="flex items-center gap-2">
          <Sparkle size={16} className="text-amber-400" />
          <h3 className="font-semibold text-sm text-ink">
            Personalización de Identidad & Rasgos Morfológicos
          </h3>
        </div>
        <span className="font-mono text-[11px] text-faint">{subEgoId}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Panel izquierdo: Preview viva del Avatar en grande (size=140) con Robot Studio 2.5D */}
        <div className="flex flex-col items-center justify-between p-4 bg-paper rounded-xl border border-hairline">
          <div className="flex flex-col items-center justify-center w-full">
            <div
              className="w-44 h-44 rounded-3xl bg-[#0d0f17] border border-white/10 shadow-2xl flex items-center justify-center overflow-hidden cursor-pointer p-2 mb-2"
              onClick={() => {
                const el = studioAvatarRef.current as any;
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
            <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-1 font-semibold">
              <Sparkle size={12} weight="bold" /> Robot Studio 2.5D
            </span>
            <span className="font-semibold text-ink text-center text-xs mt-1">
              {currentConfig.name}
            </span>
            <span className="text-[10px] text-faint mt-0.5 font-mono text-center">
              {currentConfig.baseForm === "delta-core"
                ? "Delta Core (Triángulo C₃)"
                : "Robot Studio CX (Squircle / Superelipse)"}
            </span>
          </div>

          {/* Selector de prueba de estados en vivo */}
          <div className="mt-4 w-full pt-3 border-t border-hairline">
            <span className="block text-[10px] font-semibold text-dim mb-1.5 text-center">
              Probar Animación de Estado
            </span>
            <div className="flex flex-wrap justify-center gap-1">
              {TEST_STATES.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setPreviewState(st.id);
                    const el = studioAvatarRef.current as any;
                    if (st.id === "happy" && el && typeof el.play === "function") {
                      void el.play("happy").catch(() => {});
                    }
                  }}
                  className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors flex items-center gap-1 ${
                    previewState === st.id
                      ? "bg-ink text-paper border-ink font-semibold"
                      : "border-hairline text-dim hover:text-ink hover:bg-raised"
                  }`}
                  title={`Estado ${st.label}`}
                >
                  <span>{st.emoji}</span>
                  <span>{st.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Panel derecho: Controles de Personalización */}
        <div className="md:col-span-2 space-y-4 max-h-[460px] overflow-y-auto pr-1">
          {/* 1. Geometría de Silueta */}
          <div>
            <label className="block text-[11px] font-semibold text-dim mb-1.5">
              Geometría Base del Núcleo
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleShapeSelect("delta-core")}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] border transition-colors ${
                  currentConfig.baseForm === "delta-core"
                    ? "bg-raised border-ink text-ink font-semibold"
                    : "border-hairline text-dim hover:text-ink hover:bg-raised/40"
                }`}
              >
                <span>🔺 Delta Core (Triangular)</span>
                {currentConfig.baseForm === "delta-core" && <Check size={12} weight="bold" className="text-emerald-400" />}
              </button>
              <button
                type="button"
                onClick={() => handleShapeSelect("coucou-mochi")}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] border transition-colors ${
                  currentConfig.baseForm === "coucou-mochi"
                    ? "bg-raised border-ink text-ink font-semibold"
                    : "border-hairline text-dim hover:text-ink hover:bg-raised/40"
                }`}
              >
                <span>🤖 Robot Studio CX (Squircle / Superelipse)</span>
                {currentConfig.baseForm === "coucou-mochi" && <Check size={12} weight="bold" className="text-emerald-400" />}
              </button>
              <button
                type="button"
                onClick={() => handleShapeSelect("fractal-polyhedron")}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] border transition-colors ${
                  currentConfig.baseForm === "fractal-polyhedron"
                    ? "bg-raised border-ink text-ink font-semibold"
                    : "border-hairline text-dim hover:text-ink hover:bg-raised/40"
                }`}
              >
                <span>🔷 Fractal Polyhedron (Hexagonal)</span>
                {currentConfig.baseForm === "fractal-polyhedron" && <Check size={12} weight="bold" className="text-emerald-400" />}
              </button>
              <button
                type="button"
                onClick={() => handleShapeSelect("quantum-monolith")}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] border transition-colors ${
                  currentConfig.baseForm === "quantum-monolith"
                    ? "bg-raised border-ink text-ink font-semibold"
                    : "border-hairline text-dim hover:text-ink hover:bg-raised/40"
                }`}
              >
                <span>⚡ Quantum Monolith</span>
                {currentConfig.baseForm === "quantum-monolith" && <Check size={12} weight="bold" className="text-emerald-400" />}
              </button>
            </div>
          </div>

          {/* 2. Preset Robot Studio */}
          <div>
            <label className="block text-[11px] font-semibold text-dim mb-1.5">
              Preset Robot Studio (Ego Native)
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {STUDIO_PRESETS_OPTIONS.map((p) => {
                const isSelected = (currentConfig.studioPreset ?? "cx-faithful") === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleStudioPresetSelect(p.id)}
                    className={`flex items-center justify-between px-2 py-1.5 rounded text-[10px] border transition-colors ${
                      isSelected
                        ? "bg-raised border-ink text-ink font-semibold"
                        : "border-hairline text-dim hover:text-ink hover:bg-raised/40"
                    }`}
                  >
                    <span>{p.label}</span>
                    {isSelected && <Check size={12} weight="bold" className="text-cyan-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Accesorio de Cabecera */}
          <div>
            <label className="block text-[11px] font-semibold text-dim mb-1.5">
              Accesorio de Cabecera
            </label>
            <div className="grid grid-cols-4 gap-1">
              {ACCESSORY_OPTIONS.map((acc) => {
                const isSelected = (currentConfig.accessory ?? "none") === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleAccessorySelect(acc.id)}
                    className={`px-1.5 py-1 rounded text-[10px] border transition-colors truncate ${
                      isSelected
                        ? "bg-raised border-ink text-ink font-semibold"
                        : "border-hairline text-dim hover:text-ink"
                    }`}
                    title={acc.label}
                  >
                    {acc.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Redondez de Cabeza (Roundness) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-dim">
                Redondez de Cabeza (Roundness)
              </label>
              <span className="font-mono text-[10px] text-ink font-medium">
                {currentConfig.roundness ?? 50}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={currentConfig.roundness ?? 50}
              onChange={(e) => handleRoundnessChange(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-raised rounded-lg appearance-none"
            />
          </div>

          {/* 5. Rasgos Anatómicos y Sensores */}
          <div>
            <label className="block text-[11px] font-semibold text-dim mb-1.5">
              Rasgos Anatómicos & Sensores ({currentConfig.traits.length} activos)
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-1">
              {availableTraits.map((trait: CharacterTrait) => {
                const isSelected = currentConfig.traits.includes(trait.id);
                return (
                  <button
                    key={trait.id}
                    type="button"
                    onClick={() => handleTraitToggle(trait.id)}
                    className={`flex items-center justify-between px-2 py-1.5 rounded text-[10px] border transition-colors ${
                      isSelected
                        ? "bg-raised border-ink text-ink font-semibold"
                        : "border-hairline text-dim hover:text-ink hover:bg-raised/40"
                    }`}
                  >
                    <span className="truncate">{trait.name}</span>
                    {isSelected && <Check size={12} weight="bold" className="text-cyan-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. Paletas de Color */}
          <div>
            <label className="block text-[11px] font-semibold text-dim mb-1.5">
              Gradiente Energético Corporal
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {COLOR_PALETTES.map((pal) => {
                const isSelected =
                  currentConfig.bodyColors[0] === pal.colors[0] &&
                  currentConfig.bodyColors[1] === pal.colors[1];
                return (
                  <button
                    key={pal.name}
                    type="button"
                    onClick={() => handlePaletteSelect(pal.colors)}
                    className={`flex items-center gap-2 p-1.5 rounded border text-[10px] transition-colors ${
                      isSelected
                        ? "border-ink bg-raised text-ink font-medium"
                        : "border-hairline text-dim hover:text-ink hover:bg-raised/30"
                    }`}
                  >
                    <div
                      className="h-3.5 w-3.5 rounded-full shrink-0 border border-hairline"
                      style={{
                        background: `linear-gradient(to bottom, ${pal.colors[0]}, ${pal.colors[1]})`,
                      }}
                    />
                    <span className="truncate">{pal.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 7. Forma de Ojos */}
          <div>
            <label className="block text-[11px] font-semibold text-dim mb-1.5">
              Expresión Ocular
            </label>
            <div className="flex flex-wrap gap-1">
              {EYE_SHAPES.map((shape) => {
                const isSelected = currentConfig.eyeShape === shape.id;
                return (
                  <button
                    key={shape.id}
                    type="button"
                    onClick={() => handleEyeShapeSelect(shape.id)}
                    className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                      isSelected
                        ? "bg-raised border-ink text-ink font-semibold"
                        : "border-hairline text-dim hover:text-ink"
                    }`}
                  >
                    {shape.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Acciones */}
      <div className="flex items-center justify-between pt-4 border-t border-hairline mt-4">
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-raised text-dim hover:text-ink border border-hairline transition-colors"
        >
          <ArrowClockwise size={13} />
          <span>Restaurar Predeterminado</span>
        </button>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-hairline text-dim hover:text-ink transition-colors"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-ink text-paper font-semibold hover:opacity-90 transition-opacity"
          >
            <FloppyDisk size={14} weight="bold" />
            <span>{savedSuccess ? "¡Guardado!" : "Guardar Personalización"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
