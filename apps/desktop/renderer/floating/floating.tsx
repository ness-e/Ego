import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { FloatingAvatar } from "./floating-avatar.js";
import type { EgoFloatingBridge, FloatingStateSnapshot } from "../../src/preload";

declare global {
  interface Window {
    egoFloating?: EgoFloatingBridge;
  }
}

const INITIAL_STATE: FloatingStateSnapshot = {
  visible: true,
  muted: false,
  attentionState: "hidden",
};

/** Etiqueta corta del estado para la píldora (Task6 la reemplaza por vistas). */
function labelFor(state: FloatingStateSnapshot["attentionState"]): string {
  switch (state) {
    case "hitl_approval":
      return "Aprobación";
    case "alert":
      return "Alerta";
    case "expanded":
      return "Trabajando";
    case "compact":
      return "Pensando";
    case "hidden":
    default:
      return "Ego";
  }
}

export function FloatingApp() {
  const [snapshot, setSnapshot] = useState<FloatingStateSnapshot>(INITIAL_STATE);

  useEffect(() => {
    const bridge = window.egoFloating;
    if (!bridge) return;
    return bridge.onState((next) => {
      setSnapshot(next);
    });
  }, []);

  const toggleMute = useCallback(async () => {
    const next = !snapshot.muted;
    await window.egoFloating?.setMuted(next);
    setSnapshot((prev) => ({ ...prev, muted: next }));
  }, [snapshot.muted]);

  // FIND-11-02: Escape colapsa la VISTA local (expanded/alert/hitl_approval ->
  // compact; compact -> hidden; hidden = no-op). Solo vista: no resuelve ni
  // rechaza HITL (sin llamadas a approve/deny; el pending sigue en main).
  // Coherente con AttentionStateMachine expanded->compact->hidden. Patrón
  // ActivityTray (ActivityTray.tsx:102-110), adaptado: sin trigger externo,
  // el foco cae al mute (único control persistente). Solo Escape: Tab/Enter
  // intactos (Enter idempotente en views.tsx:317).
  const muteRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (snapshot.attentionState === "hidden") return;
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      const next = snapshot.attentionState === "compact" ? "hidden" : "compact";
      setSnapshot((prev) =>
        prev.attentionState === "hidden" ? prev : { ...prev, attentionState: next },
      );
      muteRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [snapshot.attentionState]);

  return (
    <main data-attention={snapshot.attentionState} data-muted={snapshot.muted}>
      <FloatingAvatar
        attentionState={snapshot.attentionState}
        subEgoId={snapshot.activeSubEgoId ?? null}
        size={120}
      />
      <div id="status-pill">{labelFor(snapshot.attentionState)}</div>
      {/* Task6 (views.tsx) monta aquí ticker + approval/question + countdown
          y conecta egoFloating.approve/deny con el id real del HITL. */}
      <button ref={muteRef} type="button" onClick={toggleMute} aria-pressed={snapshot.muted}>
        {snapshot.muted ? "Silenciado" : "Sonido"}
      </button>
      <div id="countdown-bar" aria-hidden="true" />
    </main>
  );
}

/** Entrada del flotante: monta una sola vez (Task6 añade ViewHost aquí). */
export function mountFloating(el: HTMLElement): () => void {
  const root = createRoot(el);
  root.render(<FloatingApp />);
  return () => {
    root.unmount();
  };
}

const host = typeof document !== "undefined" ? document.getElementById("floating-root") : null;
if (host) {
  mountFloating(host);
}
