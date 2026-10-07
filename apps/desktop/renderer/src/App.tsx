import { useState } from "react";
import { Sparkle, TerminalWindow, CheckCircle, Warning } from "@phosphor-icons/react";
import { EgoChat } from "../components/ego-chat";
import { Union } from "../components/union";

export function App() {
  const [activeWidgetState, setActiveWidgetState] = useState<"idle" | "working" | "approval">("idle");
  const [approvalPending, setApprovalPending] = useState(false);

  return (
    <div className="flex h-screen w-screen flex-col bg-paper text-ink overflow-hidden font-sans select-none">
      {/* 1. System Chrome Header con Ego Activity Widget Integrado */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-hairline bg-panel px-4 app-region-drag">
        {/* Identidad de la App */}
        <div className="flex items-center gap-2 app-region-no-drag">
          <div className="h-4 w-4 rounded-full bg-ink flex items-center justify-center">
            <span className="font-mono text-[9px] font-bold text-paper">E</span>
          </div>
          <span className="text-xs font-semibold tracking-tight">Ego</span>
          <span className="text-[11px] text-faint">· Cognitive OS</span>
        </div>

        {/* Ego Activity Widget (Superficie Canónica de Telemetría y HITL) */}
        <div className="flex items-center gap-2 app-region-no-drag">
          {activeWidgetState === "idle" && !approvalPending && (
            <div className="flex items-center gap-1.5 rounded-full border border-hairline bg-raised px-2.5 py-0.5 text-[11px] text-faint">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>VantaDB Core OK</span>
            </div>
          )}

          {activeWidgetState === "working" && (
            <div className="flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/20 px-3 py-0.5 text-[11px] text-cyan-300">
              <Sparkle className="animate-spin text-cyan-400" size={13} />
              <span>Sub-Ego Dev ejecutando tarea...</span>
            </div>
          )}

          {approvalPending && (
            <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/30 px-3 py-0.5 text-[11px] text-amber-200 shadow-sm animate-pulse">
              <Warning size={14} className="text-amber-400" />
              <span>Aprobación HITL requerida</span>
              <button
                onClick={() => setApprovalPending(false)}
                className="rounded bg-amber-500 px-1.5 py-0.2 text-[10px] font-semibold text-black hover:bg-amber-400"
              >
                Revisar
              </button>
            </div>
          )}
        </div>

        {/* Indicadores Auxiliares */}
        <div className="flex items-center gap-3 text-xs text-faint app-region-no-drag">
          <span className="font-mono text-[10px] text-dim">Local-First · NativeVantaDB</span>
        </div>
      </header>

      {/* 2. Workspace Dinámico (Chat + Canvas) */}
      <main className="flex flex-1 min-h-0 min-w-0 divide-x divide-hairline">
        {/* Panel Izquierdo: Conversation River (Chat) */}
        <section className="flex flex-1 flex-col min-w-[380px] max-w-[550px] bg-paper">
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-hairline px-3 text-xs text-faint">
            <span className="font-medium text-ink">Conversation River</span>
            <span className="text-[10px] text-dim">@assistant-ui/react</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <EgoChat />
          </div>
        </section>

        {/* Panel Derecho: Dynamic Canvas (Superficie de Trabajo Interactiva) */}
        <section className="flex flex-1 flex-col min-w-0 bg-panel">
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-hairline px-4 text-xs text-faint">
            <div className="flex items-center gap-2">
              <TerminalWindow size={14} />
              <span className="font-medium text-ink">Dynamic Workspace</span>
            </div>
            <span className="text-[10px] text-dim">Canvas React 19</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <Union />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
