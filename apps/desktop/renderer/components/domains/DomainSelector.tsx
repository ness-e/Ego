import React from "react";
import {
  Code,
  Kanban,
  BookOpen,
  ChartBar,
  Users,
  CaretDown,
} from "@phosphor-icons/react";

export interface DomainMeta {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultSubEgoId: string;
}

interface DomainSelectorProps {
  domains: DomainMeta[];
  activeDomainId: string;
  onSelectDomain: (domainId: string) => void;
  className?: string;
}

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  engineering: <Code size={16} weight="bold" className="text-cyan-400" />,
  product: <Kanban size={16} weight="bold" className="text-amber-400" />,
  knowledge: <BookOpen size={16} weight="bold" className="text-purple-400" />,
  analytics: <ChartBar size={16} weight="bold" className="text-emerald-400" />,
  crm: <Users size={16} weight="bold" className="text-rose-400" />,
};

/**
 * T07 (UI-04): patrón WAI-APG menu-button (selección única → `menuitemradio`).
 * NOTA: no son tabs — las tabs exigen un `tabpanel` asociado visible y aquí
 * se conmuta de vista; los roles tab reales viven en ui-kit `Tabs` (Radix).
 * Teclado: flechas/Home/End navegan, Enter/Space activan (nativo del botón),
 * Escape cierra y devuelve el foco al trigger, Tab cierra, click fuera cierra.
 */
export const DomainSelector: React.FC<DomainSelectorProps> = ({
  domains,
  activeDomainId,
  onSelectDomain,
  className = "",
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const activeDomain = domains.find((d) => d.id === activeDomainId) || domains[0];
  const menuId = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const close = (returnFocus: boolean) => {
    setIsOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  // Al abrir, el foco cae en la opción activa (single-select).
  React.useEffect(() => {
    if (isOpen) {
      const idx = domains.findIndex((d) => d.id === activeDomainId);
      optionRefs.current[idx < 0 ? 0 : idx]?.focus();
    }
  }, [isOpen, domains, activeDomainId]);

  // Click fuera del contenedor cierra el menú.
  React.useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  const focusOption = (index: number) => {
    const n = domains.length;
    if (n === 0) return;
    optionRefs.current[((index % n) + n) % n]?.focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const current = optionRefs.current.findIndex((el) => el === document.activeElement);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusOption(current + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusOption(current < 0 ? domains.length - 1 : current - 1);
        break;
      case "Home":
        e.preventDefault();
        focusOption(0);
        break;
      case "End":
        e.preventDefault();
        focusOption(domains.length - 1);
        break;
      case "Escape":
        e.preventDefault();
        close(true);
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !isOpen) {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Botón selector de dominio */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? close(false) : setIsOpen(true))}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-hairline bg-raised/80 hover:bg-raised text-sm font-medium text-ink transition-colors shadow-xs"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
      >
        <span className="flex items-center justify-center">
          {DOMAIN_ICONS[activeDomain?.id] || <Code size={16} />}
        </span>
        <span className="font-semibold">{activeDomain?.name || "Dominio"}</span>
        <CaretDown size={14} className={`text-faint transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Menú desplegable */}
      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label="Dominios funcionales"
          onKeyDown={onMenuKeyDown}
          className="absolute left-0 mt-1 w-64 rounded-xl border border-hairline bg-raised backdrop-blur-md shadow-2xl z-50 py-1 focus:outline-hidden"
        >
          <div className="px-3 py-1.5 border-b border-hairline text-[10px] font-semibold text-faint uppercase tracking-wider">
            Dominios Funcionales (Fase 09)
          </div>
          {domains.map((dom, i) => {
            const isSelected = dom.id === activeDomainId;
            return (
              <button
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                key={dom.id}
                type="button"
                onClick={() => {
                  onSelectDomain(dom.id);
                  close(true);
                }}
                className={`w-full flex items-start gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? "bg-raised text-ink font-medium"
                    : "text-faint hover:bg-raised hover:text-ink"
                }`}
                role="menuitemradio"
                aria-checked={isSelected}
              >
                <span className="mt-0.5 shrink-0">
                  {DOMAIN_ICONS[dom.id] || <Code size={14} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="truncate">{dom.name}</span>
                    <span className="text-[10px] text-faint font-mono">
                      {dom.defaultSubEgoId}
                    </span>
                  </div>
                  <p className="text-[11px] text-faint truncate mt-0.5">
                    {dom.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
