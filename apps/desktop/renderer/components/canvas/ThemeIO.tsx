import React, { useRef, useState } from "react";
import { DesignSystemTokensSchema } from "@ego/ui-runtime";
import { useDesignSystem } from "./DesignSystemProvider.js";
import { Button } from "../ui-kit/Button.js";
import { Swatches } from "@phosphor-icons/react";

/**
 * CFG-13 — Temas JSON portables (import/export validados con Zod).
 * Exporta el preset activo como `.theme.json` descargable; importa solo lo
 * que pasa `DesignSystemTokensSchema` (rechazo honesto con el primer issue).
 * Sin IPC: el tema vive en el provider + `localStorage` (ya existente).
 */
export const ThemeIO: React.FC = () => {
  const { tokens, setTokens, applyPreset, availablePresets } = useDesignSystem();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      const json = JSON.stringify(tokens, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${tokens.id}.theme.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setIsError(false);
      setMessage(`Tema exportado: ${tokens.name} (${tokens.id}).`);
    } catch {
      setIsError(true);
      setMessage("No se pudo exportar el tema en este entorno.");
    }
  };

  const handleImportFile = async (file: File) => {
    setMessage(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setIsError(true);
      setMessage("No se pudo leer el archivo.");
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      setIsError(true);
      setMessage("El archivo no es JSON válido.");
      return;
    }
    const parsed = DesignSystemTokensSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setIsError(true);
      setMessage(
        first
          ? `Tema rechazado: ${first.path.join(".") || "(raíz)"} — ${first.message}`
          : "Tema rechazado: inválido."
      );
      return;
    }
    setTokens(parsed.data);
    setIsError(false);
    setMessage(`Tema importado: ${parsed.data.name} (${parsed.data.id}).`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* EGO-FIND-99 (Ola 10): las paletas canónicas son **visibles e
          intercambiables**. Antes sólo se podía importar un `.theme.json`
          externo: los 4 presets del sistema (docs/design/design-system.md
          §2.2) no se veían ni se podían cambiar desde la UI. */}
      <section
        aria-label="Paletas canónicas"
        className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4"
      >
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
          <Swatches size={15} className="text-brand" aria-hidden />
          Paletas canónicas
        </h3>
        <p className="mb-3 text-xs text-faint">
          Los 4 presets del sistema (docs/design/design-system.md §2.2). El
          accent y el focus-ring siguen al preset: cambiar la paleta cambia
          ambos.
        </p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Elegir paleta">
          {Object.values(availablePresets).map((preset) => {
            const selected = preset.id === tokens.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  applyPreset(preset.id);
                  setIsError(false);
                  setMessage(`Paleta aplicada: ${preset.name} (${preset.id}).`);
                }}
                aria-pressed={selected}
                title={`${preset.name} — ${preset.id}`}
                className={`flex flex-col gap-1.5 rounded-[var(--radius-card)] border p-2 text-left transition-colors ${
                  selected
                    ? "border-brand bg-raised"
                    : "border-hairline bg-paper hover:border-strong hover:bg-raised"
                }`}
              >
                <span className="flex items-center gap-1" aria-hidden>
                  {/* design-lint: allow */}
                  <span className="h-4 w-4 rounded-full border border-hairline" style={{ background: preset.colors.background }} />
                  {/* design-lint: allow */}
                  <span className="h-4 w-4 rounded-full border border-hairline" style={{ background: preset.colors.panel }} />
                  {/* design-lint: allow */}
                  <span className="h-4 w-4 rounded-full border border-hairline" style={{ background: preset.colors.brand }} />
                </span>
                <span className="truncate text-xs font-medium text-ink">{preset.name}</span>
                <span className="truncate font-mono text-xs text-dim">{preset.id}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4">
        <h3 className="mb-3 border-b border-hairline pb-3 text-sm font-semibold text-ink">
          Temas JSON
        </h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleExport}>
              Exportar tema actual
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              Importar tema JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              aria-label="Importar archivo de tema JSON"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleImportFile(file);
              }}
            />
          </div>
          <p className="text-xs text-faint">
            Activo: <span className="font-mono text-dim">{tokens.id}</span> — la
            importación se valida con el contrato Zod y rechaza lo inválido.
          </p>
          {message !== null && (
            <p role={isError ? "alert" : "status"} className={`text-xs ${isError ? "text-error" : "text-dim"}`}>
              {message}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};
