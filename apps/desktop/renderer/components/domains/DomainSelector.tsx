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

export const DomainSelector: React.FC<DomainSelectorProps> = ({
  domains,
  activeDomainId,
  onSelectDomain,
  className = "",
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const activeDomain = domains.find((d) => d.id === activeDomainId) || domains[0];

  return (
    <div className={`relative inline-block text-left ${className}`}>
      {/* Botón selector de dominio */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-700/60 bg-neutral-900/80 hover:bg-neutral-800/80 text-sm font-medium text-neutral-200 transition-colors shadow-xs"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="flex items-center justify-center">
          {DOMAIN_ICONS[activeDomain?.id] || <Code size={16} />}
        </span>
        <span className="font-semibold">{activeDomain?.name || "Dominio"}</span>
        <CaretDown size={14} className={`text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Menú desplegable */}
      {isOpen && (
        <div
          className="absolute left-0 mt-1 w-64 rounded-xl border border-neutral-700/80 bg-neutral-900/95 backdrop-blur-md shadow-2xl z-50 py-1 focus:outline-hidden"
          role="menu"
        >
          <div className="px-3 py-1.5 border-b border-neutral-800 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
            Dominios Funcionales (Fase 09)
          </div>
          {domains.map((dom) => {
            const isSelected = dom.id === activeDomainId;
            return (
              <button
                key={dom.id}
                onClick={() => {
                  onSelectDomain(dom.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-start gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? "bg-neutral-800/90 text-white font-medium"
                    : "text-neutral-300 hover:bg-neutral-800/50 hover:text-white"
                }`}
                role="menuitem"
              >
                <span className="mt-0.5 shrink-0">
                  {DOMAIN_ICONS[dom.id] || <Code size={14} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="truncate">{dom.name}</span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {dom.defaultSubEgoId}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
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
