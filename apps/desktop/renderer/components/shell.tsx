"use client";
import { useState } from "react";
import {
  House,
  ChatCircleText,
  BookOpen,
  Kanban,
  Lifebuoy,
  Notebook,
  Code,
  ShieldCheck,
  Robot,
  Circle,
} from "@phosphor-icons/react";
import { Union } from "./union";
import { EgoChat } from "./ego-chat";
import { KB } from "./kb";
import { CRM } from "./crm";
import { Support } from "./support";
import { Journal, Dev, Gov } from "./rest";
import { SubEgosView } from "./sub-egos";

const areas = [
  { id: "union", n: "00", label: "Estado Unión", icon: House, count: "3" },
  { id: "chat", n: "01", label: "Chat", icon: ChatCircleText, count: null },
  { id: "kb", n: "02", label: "Conocimiento", icon: BookOpen, count: null },
  { id: "crm", n: "03", label: "CRM", icon: Kanban, count: "2" },
  { id: "subegos", n: "04", label: "Sub-Egos", icon: Robot, count: "2" },
  { id: "soporte", n: "05", label: "Soporte", icon: Lifebuoy, count: "1" },
  { id: "diario", n: "06", label: "Diario", icon: Notebook, count: null },
  { id: "dev", n: "07", label: "Dev", icon: Code, count: null },
  { id: "gob", n: "08", label: "Gobernanza", icon: ShieldCheck, count: null },
] as const;

type Area = (typeof areas)[number]["id"];

const activeDots = [
  { id: "vdb", name: "VantaDB Core", status: "online", info: "WAL OK · 12k hechos" },
  { id: "subegos-rt", name: "Sub-Egos Runtime", status: "online", info: "2 instancias activas" },
  { id: "quarantine", name: "Cuarentena", status: "idle", info: "0 pendientes de firma" },
];

export function Shell() {
  const [area, setArea] = useState<Area>("union");
  const [query, setQuery] = useState("");

  return (
    <div className="grid h-screen grid-cols-[232px_1fr_300px] bg-paper font-sans text-ink">
      <aside className="flex flex-col border-r border-hairline bg-panel px-3 py-4">
        <div className="mb-4 px-2">
          <p className="text-lg font-bold tracking-tight">Ego</p>
          <p className="font-mono text-[11px] text-faint">tu yo operativo</p>
        </div>
        <nav className="flex flex-col gap-px" aria-label="Áreas">
          {areas.map((a) => (
            <button
              key={a.id}
              onClick={() => setArea(a.id)}
              aria-current={area === a.id ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                area === a.id ? "bg-ink font-medium text-paper" : "text-faint hover:bg-raised hover:text-ink"
              }`}
            >
              <span className="font-mono text-[11px] opacity-70">{a.n}</span>
              <a.icon size={17} weight="regular" />
              <span className="flex-1">{a.label}</span>
              {a.count && <span className="font-mono text-[11px] opacity-70">{a.count}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-2 font-mono text-[11px] text-dim">
          <p>VantaDB 0.8.0 · Local-first</p>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-hairline px-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en memoria… (@cliente #decisión ~ADR)"
            aria-label="Buscar en memoria"
            className="w-full max-w-xl rounded-md border border-hairline bg-panel px-3 py-1.5 text-sm placeholder:text-dim focus:border-ink/50 focus:outline-none"
          />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4">
          {area === "union" && <Union />}
          {area === "chat" && (
            <div className="flex h-full min-h-[60vh] flex-col">
              <EgoChat />
            </div>
          )}
          {area === "kb" && <KB />}
          {area === "crm" && <CRM />}
          {area === "subegos" && <SubEgosView />}
          {area === "soporte" && <Support />}
          {area === "diario" && <Journal />}
          {area === "dev" && <Dev />}
          {area === "gob" && <Gov />}
        </main>

        {/* Bandeja de Tareas Vivas (OpenAI Dots Pattern) */}
        <footer className="flex h-10 shrink-0 items-center gap-4 border-t border-hairline bg-panel px-4 font-mono text-[11px]">
          <span className="text-dim">DOTS ACTIVOS:</span>
          <div className="flex items-center gap-3">
            {activeDots.map((dot) => (
              <div
                key={dot.id}
                className="flex items-center gap-1.5 rounded-full border border-hairline bg-raised px-2.5 py-0.5"
              >
                <Circle
                  size={8}
                  weight="fill"
                  className={dot.status === "online" ? "text-emerald-500" : "text-amber-500"}
                />
                <span className="font-medium text-ink">{dot.name}</span>
                <span className="text-dim">({dot.info})</span>
              </div>
            ))}
          </div>
        </footer>
      </div>

      <aside className="overflow-y-auto border-l border-hairline bg-panel p-4" aria-label="Contexto">
        <div className="mb-3 flex items-baseline gap-2">
          <span className="font-mono text-[11px] text-dim">R0</span>
          <h2 className="font-mono text-[11px] font-medium tracking-[0.18em] text-faint uppercase">Contexto y Causalidad</h2>
          <span className="h-px flex-1 bg-hairline" aria-hidden />
        </div>
        <div className="rounded-lg border border-hairline bg-raised p-3 text-sm">
          <p className="mb-1 font-medium text-ink">¿Por qué ves esto?</p>
          <p className="text-faint">
            {query
              ? `Búsqueda “${query}” ejecutada en VantaDB: evaluando similitud HNSW y términos BM25 en kb/docs + crm/deals.`
              : "Selecciona un elemento o consulta al chat para ver namespaces, entidades y aristas de justificación."}
          </p>
        </div>
      </aside>
    </div>
  );
}
