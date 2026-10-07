"use client";
import { useState, useEffect } from "react";
import { Plus, Robot, Pause, ShieldCheck } from "@phosphor-icons/react";
import { ego, SubEgoSummary } from "../lib/ego";

export function SubEgosView() {
  const [subEgos, setSubEgos] = useState<SubEgoSummary[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [instructions, setInstructions] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void ego().listSubEgos().then(setSubEgos);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !role) return;
    setIsSubmitting(true);
    try {
      const created = await ego().createSubEgo({ name, role, instructions });
      setSubEgos((prev) => [...prev, created]);
      setShowModal(false);
      setName("");
      setRole("");
      setInstructions("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-hairline pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Fábrica de Sub-Egos</h1>
          <p className="text-sm text-faint">
            Instancias operativas especializadas creadas por Ego para ejecutar tareas con memoria acotada.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper transition-opacity hover:opacity-90"
        >
          <Plus size={16} weight="bold" />
          <span>Nuevo Sub-Ego</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {subEgos.map((se) => (
          <div
            key={se.id}
            className="flex flex-col justify-between rounded-lg border border-hairline bg-panel p-4 transition-colors hover:border-ink/30"
          >
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Robot size={20} className="text-accent" />
                  <h3 className="font-semibold text-ink">{se.name}</h3>
                </div>
                <span className="inline-flex items-center rounded-full bg-raised px-2 py-0.5 font-mono text-[11px] text-faint">
                  {se.state}
                </span>
              </div>
              <p className="mb-1 font-mono text-xs text-dim">Rol: {se.role}</p>
              <p className="text-sm text-faint line-clamp-2">{se.description}</p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-hairline/50 pt-3">
              <span className="font-mono text-[11px] text-dim">
                Namespace: egos/{se.id.replace("ego.", "")}/*
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  title="Pausar / Activar"
                  className="rounded p-1 text-dim hover:bg-raised hover:text-ink"
                >
                  <Pause size={15} />
                </button>
                <button
                  title="Auditar permisos"
                  className="rounded p-1 text-dim hover:bg-raised hover:text-ink"
                >
                  <ShieldCheck size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-hairline bg-panel p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-ink">Crear Nuevo Sub-Ego</h2>
            <p className="mb-4 text-xs text-faint">
              Define el alcance y el prompt del sistema. Ego aislará su memoria en VantaDB automáticamente.
            </p>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-dim">Nombre</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej: Ego Revisor Legal"
                  className="w-full rounded-md border border-hairline bg-raised px-3 py-1.5 text-sm text-ink placeholder:text-dim focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-dim">Rol Operativo</label>
                <input
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="ej: Auditor de Términos y Contratos"
                  className="w-full rounded-md border border-hairline bg-raised px-3 py-1.5 text-sm text-ink placeholder:text-dim focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-dim">Instrucciones del Sistema</label>
                <textarea
                  required
                  rows={4}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Instrucciones específicas, tono y límites de decisión..."
                  className="w-full rounded-md border border-hairline bg-raised px-3 py-1.5 text-sm text-ink placeholder:text-dim focus:outline-none"
                />
              </div>

              <div className="mt-2 flex justify-end gap-2 border-t border-hairline pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-faint hover:bg-raised"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? "Creando…" : "Instanciar Sub-Ego"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
