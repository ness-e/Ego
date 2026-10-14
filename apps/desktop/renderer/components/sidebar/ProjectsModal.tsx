import { useState } from "react";
import { Modal } from "../ui-kit/Modal.js";
import { ego } from "../../lib/ego.js";

export interface ProjectsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (projectId: string) => void;
}

/**
 * T08 (UI-05): creación de proyecto soberano VantaDB sobre Radix
 * (antes div flotante custom en el monolito `sidebar.tsx`).
 */
export function ProjectsModal({ open, onOpenChange, onCreated }: ProjectsModalProps) {
  const [name, setName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFolder = async () => {
    try {
      const folder = await ego().projects.selectFolder();
      if (folder) {
        setRootPath(folder);
        if (!name) {
          const parts = folder.split(/[/\\]/).filter(Boolean);
          setName(parts[parts.length - 1] || "Proyecto");
        }
      }
    } catch (err) {
      console.warn("[ProjectsModal] Error seleccionando carpeta:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !rootPath.trim()) {
      setError("Por favor ingresa el nombre y la carpeta del proyecto.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await ego().projects.create({ name: name.trim(), rootPath: rootPath.trim() });
      await ego().projects.select(created.id);
      onCreated(created.id);
      onOpenChange(false);
      setName("");
      setRootPath("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear el proyecto en VantaDB.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo Proyecto (Memory Scope)"
      description="Cada proyecto aísla contexto, árbol de archivos e historial en un namespace soberano de VantaDB."
      error={error ?? undefined}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-1.5">
          <label className="font-medium text-ink" htmlFor="new-project-name">
            Nombre del Proyecto
          </label>
          <input
            id="new-project-name"
            type="text"
            placeholder="Ej. Mi Aplicación Core"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-hairline bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-dim focus:border-ink/50 focus:outline-none"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <label className="font-medium text-ink" htmlFor="new-project-path">
            Carpeta Local (Root Path)
          </label>
          <div className="flex gap-2">
            <input
              id="new-project-path"
              type="text"
              placeholder="C:\ruta\al\proyecto..."
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              className="flex-1 rounded border border-hairline bg-paper px-3 py-1.5 font-mono text-[11px] text-ink placeholder:text-dim focus:border-ink/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void handleSelectFolder()}
              className="shrink-0 rounded border border-hairline bg-raised px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-raised/80"
            >
              Examinar...
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-hairline pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded px-3 py-1 text-xs text-faint transition-colors hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-ink px-3 py-1 text-xs font-semibold text-paper hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Creando..." : "Crear Proyecto en VantaDB"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
