import React, { useRef, useState } from "react";
import { DesignSystemTokensSchema } from "@ego/ui-runtime";
import { useDesignSystem } from "./DesignSystemProvider.js";
import { Button } from "../ui-kit/Button.js";

/**
 * CFG-13 — Temas JSON portables (import/export validados con Zod).
 * Exporta el preset activo como `.theme.json` descargable; importa solo lo
 * que pasa `DesignSystemTokensSchema` (rechazo honesto con el primer issue).
 * Sin IPC: el tema vive en el provider + `localStorage` (ya existente).
 */
export const ThemeIO: React.FC = () => {
  const { tokens, setTokens } = useDesignSystem();
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
    <div className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)]">
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
    </div>
  );
};
