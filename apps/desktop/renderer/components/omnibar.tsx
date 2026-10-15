import { useState, useEffect, useRef, useCallback } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { ego } from "../lib/ego.js";
import { Modal } from "./ui-kit/Modal.js";

/** Corte de confianza federada (decisión owner: omnibar federado con corte). */
export const OMNIBAR_CONFIDENCE_CUTOFF = 0.3;
/** Debounce de búsqueda federada (decisión owner: 250ms). */
export const OMNIBAR_DEBOUNCE_MS = 250;
/** Evento global para abrir el omnibar (las superficies con input propio lo emiten). */
export const OPEN_OMNIBAR_EVENT = "ego:open-omnibar";

export function requestOpenOmnibar() {
  window.dispatchEvent(new CustomEvent(OPEN_OMNIBAR_EVENT));
}

/** Evento global para abrir ajustes (Ctrl+, desde cualquier superficie). */
export const OPEN_SETTINGS_EVENT = "ego:open-settings";

export function requestOpenSettings() {
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
}

/** Evento global al elegir un resultado (punto de extensión para navegación). */
export const OMNIBAR_SELECT_EVENT = "ego:omnibar-select";

export function emitOmnibarSelect(hit: OmnibarHit) {
  window.dispatchEvent(new CustomEvent<OmnibarHit>(OMNIBAR_SELECT_EVENT, { detail: hit }));
}

export interface OmnibarHit {
  score: number;
  namespace: string;
  key: string;
  title: string;
  snippet: string;
}

interface RawHit {
  score?: unknown;
  record?: { namespace?: unknown; key?: unknown; payload?: unknown };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}

function asNumber(v: unknown, fb = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fb;
}

/** Guarda de frontera: `memory("searchMulti")` devuelve `unknown`. */
export function toOmnibarHits(value: unknown): OmnibarHit[] {
  if (!Array.isArray(value)) return [];
  const out: OmnibarHit[] = [];
  for (const item of value as RawHit[]) {
    if (!isRecord(item)) continue;
    const score = asNumber(item.score);
    if (score < OMNIBAR_CONFIDENCE_CUTOFF) continue;
    const rec = isRecord(item.record) ? item.record : {};
    let title = asString(rec.key, "sin-título");
    let snippet = "";
    if (typeof rec.payload === "string") {
      try {
        const p = JSON.parse(rec.payload) as Record<string, unknown>;
        if (isRecord(p)) {
          title = asString(p.titulo, asString(p.title, title));
          snippet = asString(p.contenido, asString(p.content, "")).slice(0, 140);
        }
      } catch {
        snippet = rec.payload.slice(0, 140);
      }
    }
    out.push({
      score,
      namespace: asString(rec.namespace, "desconocido"),
      key: asString(rec.key, ""),
      title,
      snippet,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * T08 (UI-05): omnibar federado. Ctrl+K lo abre, Ctrl+, abre ajustes,
 * Escape lo cierra. Búsqueda con debounce 250ms contra
 * `memory("searchMulti")` + corte de confianza 0.3.
 */
export function Omnibar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<OmnibarHit[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Atajos globales: Ctrl/⌘+K abre, Ctrl/⌘+, pide ajustes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        requestOpenSettings();
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onExternalOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_OMNIBAR_EVENT, onExternalOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_OMNIBAR_EVENT, onExternalOpen);
    };
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const raw = await ego().memory("searchMulti", [term]);
      if (mountedRef.current) setHits(toOmnibarHits(raw));
    } catch {
      if (mountedRef.current) setHits([]);
    } finally {
      if (mountedRef.current) setSearching(false);
    }
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSearching(true);
      debounceRef.current = setTimeout(() => void runSearch(value), OMNIBAR_DEBOUNCE_MS);
    },
    [runSearch]
  );

  // T12: elegir un resultado es una acción real (cierra + emite selección),
  // nunca un div muerto.
  const handleSelectHit = useCallback((hit: OmnibarHit) => {
    setOpen(false);
    emitOmnibarSelect(hit);
  }, []);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Búsqueda federada (Ctrl+K)"
      description="Memoria VantaDB vía searchMulti · corte de confianza 0.3"
    >
      <div role="search">
        <div className="flex items-center gap-2 rounded-md border border-hairline bg-raised px-2.5 py-2">
          <MagnifyingGlass size={15} className="shrink-0 text-dim" aria-hidden />
          <input
            autoFocus
            type="text"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-label="Buscar en memoria federada"
            aria-activedescendant={undefined}
            placeholder="Buscar recuerdos, docs, decisiones… (mín. 2 caracteres)"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full bg-transparent text-xs text-ink placeholder:text-dim focus:outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => handleChange("")}
              className="rounded p-1.5 min-h-[24px] min-w-[24px] inline-flex items-center justify-center text-dim hover:text-ink"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="mt-2" role="listbox" aria-label="Resultados federados">
          {searching && (
            <p className="px-1 py-3 text-center font-mono text-[11px] text-dim" aria-live="polite">
              Buscando en memoria…
            </p>
          )}
          {!searching && query.trim().length >= 2 && hits.length === 0 && (
            <p className="px-1 py-3 text-center text-[11px] text-faint">
              Sin resultados sobre el corte de confianza 0.3.
            </p>
          )}
          {hits.map((h) => (
            <button
              key={`${h.namespace}/${h.key}`}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => handleSelectHit(h)}
              title={`Abrir ${h.namespace}/${h.key}`}
              className="mt-1 w-full cursor-pointer rounded-md border border-hairline bg-panel px-2.5 py-2 text-left transition-colors hover:border-dim"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-ink">{h.title}</span>
                <span className="shrink-0 font-mono text-[10px] text-dim">
                  {Math.round(h.score * 100)}% · {h.namespace}
                </span>
              </span>
              {h.snippet && <span className="mt-0.5 block truncate text-[11px] text-faint">{h.snippet}</span>}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
