// SubEgoSelector.tsx — Selector de Sub-Ego Activo con Mini-Avatar y Badge de Dominio (CHAR-08 / SUB-08)
// Proporciona conmutación explícita de especialista y control visual de orador.
//
// ## Migración al design system (FASE 1)
// El desplegable era 100 % ad-hoc: un `<button>` con `border-hairline` (borde
// invisible, ≈1.1:1) que se cerraba con un `mousedown` global fuera del
// contenedor. No había `FocusScope`, ni roles `menu`/`menuitem`, ni
// navegación por teclado: era exactamente la deuda que
// `docs/design/design-system.md` §8.2 tenía inventariada ("Dropdown /
// outside-click — propia con motivo provisional → candidata a migración").
//
// Ahora usa el primitive `Menu` del kit (Radix DropdownMenu): teclado
// (flechas, Inicio/Fin, Escape, type-ahead), roles ARIA, retorno del foco al
// trigger y panel portaleado (nunca recortado por un ancestro con
// `overflow: hidden`).
//
// ## Huecos de API del primitive (documentados, no inventados)
// - `MenuItem.label` es texto plano: no admite la sub-línea de rol. El rol se
//   muestra en el slot `shortcut` (texto informativo a la derecha, que es lo
//   que ese slot documenta).
// - El primitive no expone estado "seleccionado" (Radix usaría `RadioItem`):
//   el especialista activo se marca con un check Phosphor en el slot `icon`.

import React, { useState, useEffect } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";
import { CharacterBadge } from "./character/CharacterBadge.js";
import { TraitRegistry } from "./character/traits/TraitRegistry.js";
import { ego, type SubEgoDetailInfo } from "../lib/ego.js";
import { Button } from "./ui-kit/Button.js";
import { Menu, type MenuItem } from "./ui-kit/Menu.js";

export interface SubEgoSelectorProps {
  activeSubEgoId: string;
  onSelectSubEgo: (subEgoId: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Recorta el rol para que no desborde el panel del menú (slot `shortcut`). */
function clampRole(role: string, max = 22): string {
  return role.length > max ? `${role.slice(0, max - 1)}…` : role;
}

export const SubEgoSelector: React.FC<SubEgoSelectorProps> = ({
  activeSubEgoId,
  onSelectSubEgo,
  disabled = false,
  className = "",
}) => {
  const [subEgos, setSubEgos] = useState<SubEgoDetailInfo[]>([]);

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

  const activePreset = TraitRegistry.getPreset(activeSubEgoId);
  const activeSubEgoObj = subEgos.find((s) => s.id === activeSubEgoId);
  const displayName = activeSubEgoObj?.name || (activeSubEgoId === "ego.nucleus" ? "Ego Core" : activePreset.name);
  const displayRole = activeSubEgoObj?.role || activePreset.domain;

  // Avatar + check de "activo" en el slot `icon` del primitive.
  const iconFor = (id: string) => (
    <span className="flex items-center gap-1">
      <CharacterBadge subEgoId={id} size={18} state="idle" />
      {id === activeSubEgoId && <Check size={12} weight="bold" />}
    </span>
  );

  const items: MenuItem[] = [
    {
      label: "Ego Core",
      icon: iconFor("ego.nucleus"),
      shortcut: "Coordinador general",
      onSelect: () => onSelectSubEgo("ego.nucleus"),
    },
    ...subEgos
      .filter((s) => s.id !== "ego.nucleus")
      .map((sub) => ({
        label: sub.name,
        icon: iconFor(sub.id),
        shortcut: clampRole(sub.role),
        onSelect: () => onSelectSubEgo(sub.id),
      })),
  ];

  return (
    <div className={`inline-block ${className}`}>
      <Menu
        ariaLabel="Especialistas disponibles"
        align="start"
        side="bottom"
        contentClassName="w-64"
        items={items}
        trigger={
          // `group` + `data-state` (Radix) permiten rotar el caret al abrir
          // sin gestionar estado de apertura propio.
          <Button
            variant="secondary"
            size="md"
            disabled={disabled}
            title={`Especialista activo: ${displayName} (${displayRole})`}
            className="group max-w-[180px] rounded-full"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <CharacterBadge subEgoId={activeSubEgoId} size={18} state="idle" />
              <span className="min-w-0 truncate font-medium">{displayName}</span>
              <CaretDown
                size={11}
                aria-hidden
                className="shrink-0 text-faint transition-transform group-data-[state=open]:rotate-180"
              />
            </span>
          </Button>
        }
      />
    </div>
  );
};
