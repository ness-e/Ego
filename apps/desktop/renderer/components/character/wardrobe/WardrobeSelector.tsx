import React, { useState, useMemo } from "react";
import { CharacterBadge } from "../CharacterBadge.js";
import { TraitRegistry, type DomainCharacterPreset, type CharacterTrait } from "../traits/TraitRegistry.js";
import { Sparkle, Check, ArrowClockwise, FloppyDisk } from "@phosphor-icons/react";

export interface CustomCharacterConfig {
  subEgoId: string;
  name: string;
  bodyColors: [string, string];
  eyeShape: "pill" | "wide" | "dot" | "line" | "flat" | "happy" | "cup";
  baseForm: "delta-core" | "coucou-mochi";
  outfitId?: string | null;
  traits: string[];
}

export interface WardrobeSelectorProps {
  subEgoId?: string;
  onSave?: (config: CustomCharacterConfig) => void;
  onClose?: () => void;
}

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
  }));

  const [savedSuccess, setSavedSuccess] = useState(false);

  const availableTraits = useMemo(() => {
    return TraitRegistry.listTraits();
  }, []);

  const handlePaletteSelect = (colors: [string, string]) => {
    setCurrentConfig((prev) => ({ ...prev, bodyColors: colors }));
  };

  const handleShapeSelect = (baseForm: "delta-core" | "coucou-mochi") => {
    setCurrentConfig((prev) => ({ ...prev, baseForm }));
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
    });
    setSavedSuccess(false);
  };

  const handleSave = () => {
    // Registrar el override en TraitRegistry en tiempo de ejecución
    const updatedPreset: DomainCharacterPreset = {
      ...defaultPreset,
      bodyColors: currentConfig.bodyColors,
      eyeShape: currentConfig.eyeShape,
      baseForm: currentConfig.baseForm,
      outfitId: null,
      traits: currentConfig.traits,
    };
    TraitRegistry.registerPreset(updatedPreset);

    onSave?.(currentConfig);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="flex flex-col bg-panel border border-hairline rounded-2xl p-5 shadow-lg max-w-xl w-full text-xs select-none">
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
        {/* Panel izquierdo: Preview viva del Avatar */}
        <div className="flex flex-col items-center justify-center p-4 bg-paper rounded-xl border border-hairline">
          <div className="relative mb-3 flex items-center justify-center h-28 w-28">
            <CharacterBadge
              subEgoId={subEgoId}
              baseForm={currentConfig.baseForm}
              outfitId={null}
              size={96}
              animated={true}
              title={`Vista previa de ${currentConfig.name}`}
            />
          </div>
          <span className="font-semibold text-ink text-center text-xs">
            {currentConfig.name}
          </span>
          <span className="text-[10px] text-faint mt-0.5 font-mono">
            {currentConfig.baseForm === "delta-core" ? "Delta Core (Triángulo C₃)" : "Superelipse (Squircle)"}
          </span>
        </div>

        {/* Panel derecho: Controles de Personalización */}
        <div className="md:col-span-2 space-y-4">
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
                <span>🔺 Delta Core (C₃)</span>
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
                <span>🔘 Superelipse</span>
                {currentConfig.baseForm === "coucou-mochi" && <Check size={12} weight="bold" className="text-emerald-400" />}
              </button>
            </div>
          </div>

          {/* 2. Rasgos Anatómicos y Sensores (Cero Ropa Humana) */}
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

          {/* 3. Paletas de Color */}
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

          {/* 4. Forma de Ojos */}
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
