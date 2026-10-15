// SubEgoSelector.tsx — Selector de Sub-Ego Activo con Mini-Avatar y Badge de Dominio (CHAR-08 / SUB-08)
// Proporciona conmutación explícita de especialista y control visual de orador.

import React, { useState, useEffect, useRef } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";
import { CharacterBadge } from "./character/CharacterBadge.js";
import { TraitRegistry } from "./character/traits/TraitRegistry.js";
import { ego, type SubEgoDetailInfo } from "../lib/ego.js";

export interface SubEgoSelectorProps {
  activeSubEgoId: string;
  onSelectSubEgo: (subEgoId: string) => void;
  disabled?: boolean;
  className?: string;
}

export const SubEgoSelector: React.FC<SubEgoSelectorProps> = ({
  activeSubEgoId,
  onSelectSubEgo,
  disabled = false,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [subEgos, setSubEgos] = useState<SubEgoDetailInfo[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Cargar lista viva de Sub-Egos de VantaDB
  useEffect(() => {
    let mounted = true;
    const fetchList = async () => {
      try {
        const list = await ego().subegos.list();
        if (mounted && list) {
          setSubEgos(list);
        }
      } catch (err) {
        console.warn("[SubEgoSelector] No se pudo cargar lista de Sub-Egos:", err);
      }
    };

    fetchList();
    const unsub = ego().onSubEgosChanged?.(() => {
      fetchList();
    });

    return () => {
      mounted = false;
      unsub?.();
    };
  }, []);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const activePreset = TraitRegistry.getPreset(activeSubEgoId);
  const activeSubEgoObj = subEgos.find((s) => s.id === activeSubEgoId);
  const displayName = activeSubEgoObj?.name || (activeSubEgoId === "ego.nucleus" ? "Ego Core" : activePreset.name);
  const displayRole = activeSubEgoObj?.role || activePreset.domain;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-full border border-hairline bg-raised/70 px-2.5 py-1 text-xs text-ink hover:bg-raised transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
        title={`Especialista activo: ${displayName} (${displayRole})`}
      >
        <CharacterBadge subEgoId={activeSubEgoId} size={18} state="idle" />
        <span className="font-medium text-xs truncate max-w-[120px]">{displayName}</span>
        <CaretDown size={11} className={`text-faint transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-60 rounded-xl border border-hairline bg-panel p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-dim uppercase border-b border-hairline mb-1">
            Especialistas Disponibles
          </div>

          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {/* 1. Opción Núcleo Coordinador */}
            <button
              type="button"
              onClick={() => {
                onSelectSubEgo("ego.nucleus");
                setIsOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                activeSubEgoId === "ego.nucleus"
                  ? "bg-raised font-semibold text-ink"
                  : "text-faint hover:bg-raised/60 hover:text-ink"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <CharacterBadge subEgoId="ego.nucleus" size={20} state="idle" />
                <div className="truncate">
                  <div className="text-xs text-ink">Ego Core</div>
                  <div className="text-[10px] text-dim">Coordinador general</div>
                </div>
              </div>
              {activeSubEgoId === "ego.nucleus" && <Check size={13} className="text-ink shrink-0" />}
            </button>

            {/* 2. Sub-Egos Registrados en VantaDB */}
            {subEgos
              .filter((s) => s.id !== "ego.nucleus")
              .map((sub) => {
                const isSelected = activeSubEgoId === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      onSelectSubEgo(sub.id);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                      isSelected
                        ? "bg-raised font-semibold text-ink"
                        : "text-faint hover:bg-raised/60 hover:text-ink"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CharacterBadge subEgoId={sub.id} size={20} state="idle" />
                      <div className="truncate">
                        <div className="text-xs text-ink truncate">{sub.name}</div>
                        <div className="text-[10px] text-dim truncate">{sub.role}</div>
                      </div>
                    </div>
                    {isSelected && <Check size={13} className="text-ink shrink-0" />}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};
