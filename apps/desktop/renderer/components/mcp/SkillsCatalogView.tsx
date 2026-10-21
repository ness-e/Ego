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
import type { ScannedSkillInfo } from "../../lib/ego.js";
import { Button } from "../ui-kit/Button.js";
import { Badge } from "../ui-kit/Badge.js";

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
          <h3 className="text-sm font-semibold text-ink">Skills Locales & Linter AST (HERM-19)</h3>
          <p className="text-xs text-faint">
            Habilidades descubiertas en `.ego/skills/` y `~/.ego/skills/` auditadas estáticamente antes de su ejecución.
          </p>
        </div>
        <Button
          size="md"
          variant="secondary"
          icon={
            <ArrowClockwise size={14} className={refreshing || isLoading ? "animate-spin" : ""} />
          }
          onClick={handleRefresh}
          disabled={refreshing || isLoading}
          className="shrink-0 whitespace-nowrap"
        >
          Re-escanear Carpetas
        </Button>
      </div>

      {/* Lista de Skills */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {isLoading && skills.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-dim">
            Escaneando carpetas de skills locales...
          </div>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-hairline rounded-[var(--radius-card)] p-6 text-center space-y-2">
            <Sparkle size={26} className="text-dim" />
            <span className="text-xs font-medium text-ink">No se encontraron skills locales</span>
            <p className="text-xs text-faint max-w-sm">
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
                className="flex flex-col rounded-[var(--radius-card)] border border-hairline bg-raised p-3.5 space-y-2 hover:border-strong transition-colors"
              >
                {/* Cabecera de la Skill */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink">{skill.name}</span>
                      <span className="font-mono text-xs text-dim bg-panel px-1.5 py-0.5 rounded-md">
                        {skill.id}
                      </span>
                      {skill.version && (
                        <span className="font-mono text-xs text-dim">v{skill.version}</span>
                      )}
                    </div>
                    <p className="text-xs text-faint mt-1 leading-relaxed">
                      {skill.description}
                    </p>
                  </div>

                  {/* Badge de Auditoría AST HERM-19 (kit) */}
                  <Badge
                    tone={isSafe ? "ok" : isWarning ? "warn" : "risk"}
                    className="shrink-0"
                  >
                    {isSafe && <ShieldCheck size={11} />}
                    {isWarning && <Warning size={11} />}
                    {isDangerous && <Flame size={11} />}
                    <span>
                      {isSafe ? "AST SEGURO" : isWarning ? "CON ADVERTENCIAS" : "BLOQUEADA (PELIGRO)"}
                    </span>
                  </Badge>
                </div>

                {/* Ruta de origen */}
                <div className="flex items-center gap-1 text-xs font-mono text-dim">
                  <Folder size={11} className="shrink-0" />
                  <span className="truncate">{skill.manifestPath}</span>
                </div>

                {/* Errores o Violaciones del Linter */}
                {skill.errors.length > 0 && (
                  <div className="rounded-[var(--radius-card)] border border-error/30 bg-error/10 p-2 space-y-1">
                    <div className="flex items-center gap-1 text-xs font-semibold text-error">
                      <XCircle size={12} />
                      <span>Violaciones detectadas por el Linter AST:</span>
                    </div>
                    {skill.errors.map((err, i) => (
                      <div key={i} className="text-xs text-error pl-4 font-mono">
                        • {err}
                      </div>
                    ))}
                  </div>
                )}

                {/* Advertencias */}
                {skill.warnings.length > 0 && (
                  <div className="rounded-[var(--radius-card)] border border-warning/30 bg-warning/10 p-2 space-y-1">
                    <div className="flex items-center gap-1 text-xs font-semibold text-warning">
                      <Warning size={12} />
                      <span>Advertencias operacionales:</span>
                    </div>
                    {skill.warnings.map((w, i) => (
                      <div key={i} className="text-xs text-warning pl-4">
                        • {w}
                      </div>
                    ))}
                  </div>
                )}

                {/* Herramientas, Permisos y Tags */}
                <div className="pt-2 border-t border-hairline flex flex-wrap items-center gap-3 text-xs text-dim">
                  {skill.tools.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-ink font-medium">Tools:</span>
                      <span className="font-mono text-success">{skill.tools.join(", ")}</span>
                    </div>
                  )}

                  {skill.permissions.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-ink font-medium">Permisos:</span>
                      <span className="font-mono text-warning">{skill.permissions.join(", ")}</span>
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
