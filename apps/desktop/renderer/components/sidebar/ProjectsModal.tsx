import { useState } from "react";
import { Modal } from "../ui-kit/Modal.js";
import { Button } from "../ui-kit/Button.js";
import { Input } from "../ui-kit/Input.js";
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
          <label className="text-xs font-medium text-ink" htmlFor="new-project-name">
            Nombre del Proyecto
          </label>
          <Input
            id="new-project-name"
            type="text"
            placeholder="Ej. Mi Aplicación Core"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-ink" htmlFor="new-project-path">
            Carpeta Local (Root Path)
          </label>
          <div className="flex items-start gap-2">
            <Input
              id="new-project-path"
              type="text"
              placeholder="C:\ruta\al\proyecto..."
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              className="font-mono"
            />
            <Button
              variant="secondary"
              size="md"
              onClick={() => void handleSelectFolder()}
              className="shrink-0"
            >
              Examinar...
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-hairline pt-2">
          <Button
            variant="ghost"
            size="md"
            onClick={() => onOpenChange(false)}
            className="text-faint hover:text-ink"
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            loading={creating}
            className="font-semibold"
          >
            {creating ? "Creando..." : "Crear Proyecto en VantaDB"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
