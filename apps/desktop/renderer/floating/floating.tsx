import { useCallback, useEffect, useState } from "react";
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
      <button type="button" onClick={toggleMute} aria-pressed={snapshot.muted}>
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
