import { useState } from "react";
import {
  Sparkle,
  ArrowClockwise,
  Folder,
  ShieldCheck,
  Warning,
  Flame,
  XCircle,
  Tag,
} from "@phosphor-icons/react";
import type { ScannedSkillInfo } from "../../lib/ego";

interface SkillsCatalogViewProps {
  skills: ScannedSkillInfo[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}

export function SkillsCatalogView({ skills, isLoading, onRefresh }: SkillsCatalogViewProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Barra de Acciones Superior */}
      <div className="flex items-center justify-between pb-2 border-b border-hairline">
        <div>
          <h2 className="text-sm font-semibold text-ink">Skills Locales & Linter AST (HERM-19)</h2>
          <p className="text-[11px] text-faint">
            Habilidades descubiertas en `.ego/skills/` y `~/.ego/skills/` auditadas estáticamente antes de su ejecución.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || isLoading}
          className="flex items-center gap-1.5 rounded bg-raised px-3 py-1.5 text-xs text-ink hover:bg-hairline transition-colors disabled:opacity-50"
        >
          <ArrowClockwise size={14} className={refreshing || isLoading ? "animate-spin" : ""} />
          <span>Re-escanear Carpetas</span>
        </button>
      </div>

      {/* Lista de Skills */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {isLoading && skills.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-dim">
            Escaneando carpetas de skills locales...
          </div>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-hairline rounded-lg p-6 text-center space-y-2">
            <Sparkle size={26} className="text-dim" />
            <span className="text-xs font-medium text-ink">No se encontraron skills locales</span>
            <p className="text-[11px] text-faint max-w-sm">
              Crea una carpeta en `.ego/skills/mi-skill/` con un archivo `SKILL.md` o `skill.json` para definir
              capacidades especializadas para tus Sub-Egos.
            </p>
          </div>
        ) : (
          skills.map((skill) => {
            const isSafe = skill.securityLevel === "safe";
            const isWarning = skill.securityLevel === "warning";
            const isDangerous = skill.securityLevel === "dangerous";

            return (
              <div
                key={skill.id}
                className="flex flex-col rounded-lg border border-hairline bg-paper/50 p-3.5 space-y-2 hover:border-ink/20 transition-colors"
              >
                {/* Cabecera de la Skill */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink">{skill.name}</span>
                      <span className="font-mono text-[10px] text-dim bg-raised px-1.5 py-0.2 rounded">
                        {skill.id}
                      </span>
                      {skill.version && (
                        <span className="font-mono text-[10px] text-dim">v{skill.version}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-faint mt-1 leading-relaxed">
                      {skill.description}
                    </p>
                  </div>

                  {/* Badge de Auditoría AST HERM-19 */}
                  <div
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                      isSafe
                        ? "bg-emerald-950/60 text-emerald-300 border border-emerald-900/40"
                        : isWarning
                        ? "bg-amber-950/60 text-amber-300 border border-amber-900/40"
                        : "bg-rose-950/60 text-rose-300 border border-rose-900/40"
                    }`}
                  >
                    {isSafe && <ShieldCheck size={13} className="text-emerald-400" />}
                    {isWarning && <Warning size={13} className="text-amber-400" />}
                    {isDangerous && <Flame size={13} className="text-rose-400" />}
                    <span>
                      {isSafe ? "AST SEGURO" : isWarning ? "CON ADVERTENCIAS" : "BLOQUEADA (PELIGRO)"}
                    </span>
                  </div>
                </div>

                {/* Ruta de origen */}
                <div className="flex items-center gap-1 text-[10px] font-mono text-dim">
                  <Folder size={11} className="shrink-0" />
                  <span className="truncate">{skill.manifestPath}</span>
                </div>

                {/* Errores o Violaciones del Linter */}
                {skill.errors.length > 0 && (
                  <div className="rounded border border-rose-500/30 bg-rose-950/20 p-2 space-y-1">
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-rose-400">
                      <XCircle size={12} />
                      <span>Violaciones detectadas por el Linter AST:</span>
                    </div>
                    {skill.errors.map((err, i) => (
                      <div key={i} className="text-[10px] text-rose-300 pl-4 font-mono">
                        • {err}
                      </div>
                    ))}
                  </div>
                )}

                {/* Advertencias */}
                {skill.warnings.length > 0 && (
                  <div className="rounded border border-amber-500/30 bg-amber-950/20 p-2 space-y-1">
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-400">
                      <Warning size={12} />
                      <span>Advertencias operacionales:</span>
                    </div>
                    {skill.warnings.map((w, i) => (
                      <div key={i} className="text-[10px] text-amber-300 pl-4">
                        • {w}
                      </div>
                    ))}
                  </div>
                )}

                {/* Herramientas, Permisos y Tags */}
                <div className="pt-2 border-t border-hairline/60 flex flex-wrap items-center gap-3 text-[10px] text-dim">
                  {skill.tools.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-ink font-medium">Tools:</span>
                      <span className="font-mono text-emerald-400">{skill.tools.join(", ")}</span>
                    </div>
                  )}

                  {skill.permissions.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-ink font-medium">Permisos:</span>
                      <span className="font-mono text-amber-400">{skill.permissions.join(", ")}</span>
                    </div>
                  )}

                  {skill.tags.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Tag size={10} />
                      <span>{skill.tags.join(", ")}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
