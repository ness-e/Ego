"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Robot,
  Pause,
  Play,
  ShieldCheck,
  CurrencyDollar,
  X,
  CheckCircle,
  Cpu,
  Sparkle,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import { ego } from "../lib/ego.js";
import type { SubEgoDetailInfo, DomainTemplateInfo } from "../lib/ego.js";
import { CharacterBadge } from "./character/CharacterBadge.js";
import { WardrobeSelector } from "./character/wardrobe/WardrobeSelector.js";
import { Modal } from "./ui-kit/Modal.js";
import { Tabs } from "./ui-kit/Tabs.js";
import { Button } from "./ui-kit/Button.js";
import { Input } from "./ui-kit/Input.js";
import { Textarea } from "./ui-kit/Textarea.js";
import { Badge } from "./ui-kit/Badge.js";

/** T06: los catch sin anotación ya son `unknown` en strict; centraliza el mensaje. */
function toMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function SubEgosView() {
  const [subEgos, setSubEgos] = useState<SubEgoDetailInfo[]>([]);
  const [templates, setTemplates] = useState<DomainTemplateInfo[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [creationTab, setCreationTab] = useState<"template" | "custom" | "declaration">("template");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("developer");

  // Formulario personalizado
  const [customName, setCustomName] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [maxDailyCostUsd, setMaxDailyCostUsd] = useState("2.0");

  // Declaración JSON/YAML
  const [declarationFormat, setDeclarationFormat] = useState<"json" | "yaml">("json");
  const [declarationRaw, setDeclarationRaw] = useState(
    JSON.stringify(
      {
        name: "Sub-Ego Analista",
        role: "Análisis Cuantitativo",
        description: "Audita métricas de uso y telemetría de turnos.",
        instructions: "Calcula estadísticas y reporta discrepancias en datasets.",
        tools: ["memory_recall"],
        autonomy: "supervised",
        budget: {
          maxTokensPerCall: 4000,
          maxDailyCostUsd: 1.5,
          requiresApprovalAboveUsd: 0.5,
        },
      },
      null,
      2
    )
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<"all" | "active" | "paused">("all");

  // Modal de Personalización de Avatar (WardrobeSelector)
  const [wardrobeSubEgoId, setWardrobeSubEgoId] = useState<string | null>(null);

  // Modal de Edición de Sub-Ego
  const [editingSubEgo, setEditingSubEgo] = useState<SubEgoDetailInfo | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editMaxDailyCost, setEditMaxDailyCost] = useState("2.0");

  const handleOpenEdit = (se: SubEgoDetailInfo) => {
    setEditingSubEgo(se);
    setEditName(se.name);
    setEditRole(se.role);
    setEditDescription(se.description);
    setEditInstructions(se.instructions || se.systemPrompt || "");
    setEditMaxDailyCost(String(se.budget?.maxDailyCostUsd ?? 2.0));
    setModalError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubEgo) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      const updatedPayload: SubEgoDetailInfo = {
        ...editingSubEgo,
        name: editName.trim() || editingSubEgo.name,
        role: editRole.trim() || editingSubEgo.role,
        description: editDescription.trim() || editingSubEgo.description,
        instructions: editInstructions.trim() || editingSubEgo.instructions,
        budget: {
          ...editingSubEgo.budget,
          maxDailyCostUsd: parseFloat(editMaxDailyCost) || 2.0,
        },
      };

      // A3 / EGO-FIND-53: la escritura pasa por el main, que valida el
      // manifiesto con `SubEgoRegistry` (Zod). Antes el renderer escribía
      // directo en memoria y se saltaba esa validación.
      await ego().subegos.update({
        subEgoId: editingSubEgo.id,
        manifest: updatedPayload as unknown as Record<string, unknown>,
      });

      setEditingSubEgo(null);
      setFeedback(`Sub-Ego '${updatedPayload.name}' actualizado con éxito.`);
      await loadSubEgos();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setModalError(toMessage(err, "Error al actualizar Sub-Ego."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubEgo = async (subEgo: SubEgoDetailInfo) => {
    if (subEgo.id === "ego.nucleus") return;
    const confirmed = typeof window !== "undefined" && typeof window.confirm === "function"
      ? window.confirm(`¿Estás seguro de que deseas eliminar el Sub-Ego '${subEgo.name}' (${subEgo.id})?`)
      : true;
    if (!confirmed) return;

    try {
      // A3 / EGO-FIND-53: sin `.catch(() => {})` — el error debe verse.
      await ego().subegos.remove({ subEgoId: subEgo.id });
      setSubEgos((prev) => prev.filter((s) => s.id !== subEgo.id));
      setFeedback(`Sub-Ego '${subEgo.name}' eliminado.`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setModalError(toMessage(err, "Error al eliminar Sub-Ego."));
    }
  };

  const loadSubEgos = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await ego().subegos.list();
      setSubEgos(list);
    } catch (err: unknown) {
      console.warn("[SubEgosView] Error al cargar Sub-Egos:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const list = await ego().subegos.getTemplates();
      setTemplates(list);
      if (list.length > 0 && !selectedTemplateId) {
        const first = list[0];
        if (first) setSelectedTemplateId(first.templateId || first.id || "developer");
      }
    } catch (err: unknown) {
      console.warn("[SubEgosView] Error al cargar plantillas:", err);
    }
  }, [selectedTemplateId]);

  useEffect(() => {
    loadSubEgos();
    loadTemplates();

    const unsub = ego().onSubEgosChanged?.(() => {
      loadSubEgos();
    });

    return () => {
      unsub?.();
    };
  }, [loadSubEgos, loadTemplates]);

  const handleToggleState = async (se: SubEgoDetailInfo) => {
    if (se.id === "ego.nucleus") {
      setFeedback("El núcleo de Ego ('ego.nucleus') es inmutable y no se puede pausar.");
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    const nextState = se.state === "active" ? "paused" : "active";
    try {
      await ego().subegos.toggleState({ subEgoId: se.id, state: nextState });
      setSubEgos((prev) =>
        prev.map((item) => (item.id === se.id ? { ...item, state: nextState } : item))
      );
      setFeedback(`Sub-Ego '${se.name}' cambiado a estado ${nextState === "active" ? "Activo" : "Pausado"}.`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setFeedback(`Error: ${toMessage(err, "No se pudo cambiar el estado")}`);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleCreateFromTemplate = async (templateId: string) => {
    setIsSubmitting(true);
    setModalError(null);
    try {
      const created = await ego().subegos.create({
        mode: "template",
        templateId,
      });
      setSubEgos((prev) => [...prev, created]);
      setShowModal(false);
      setFeedback(`Sub-Ego '${created.name}' instanciado exitosamente desde plantilla.`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setModalError(toMessage(err, "Error al instanciar desde plantilla."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customRole.trim() || !customInstructions.trim()) {
      setModalError("Por favor completa el nombre, rol e instrucciones.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      const cost = parseFloat(maxDailyCostUsd) || 2.0;
      const created = await ego().subegos.create({
        mode: "custom",
        name: customName.trim(),
        role: customRole.trim(),
        instructions: customInstructions.trim(),
        tools: ["memory_recall", "fs_read_file"],
        budget: {
          maxTokensPerCall: 4000,
          maxDailyCostUsd: cost,
        },
      });
      setSubEgos((prev) => [...prev, created]);
      setShowModal(false);
      setCustomName("");
      setCustomRole("");
      setCustomInstructions("");
      setFeedback(`Sub-Ego '${created.name}' creado con éxito.`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setModalError(toMessage(err, "Error al crear Sub-Ego."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateDeclaration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declarationRaw.trim()) {
      setModalError("La declaración no puede estar vacía.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    try {
      const created = await ego().subegos.create({
        mode: "declaration",
        format: declarationFormat,
        rawText: declarationRaw,
      });
      setSubEgos((prev) => [...prev, created]);
      setShowModal(false);
      setFeedback(`Sub-Ego '${created.name}' importado desde declaración ${declarationFormat.toUpperCase()}.`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setModalError(toMessage(err, "Error de sintaxis o validación de manifiesto."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSubEgos = subEgos.filter((se) => {
    if (filterState === "all") return true;
    return se.state === filterState;
  });

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  return (
    // D9: la retícula se dimensiona por el ANCHO DEL CONTENEDOR (container
    // query), no por el del viewport. La vista vive en el panel de
    // Workspace, que es redimensionable: con `lg:grid-cols-3` (breakpoint de
    // viewport) un panel de 560 px repartía 3 columnas de 175 px y la 3ª
    // tarjeta se salía de su celda. `@lg:grid-cols-2` (512 px) da 2 columnas
    // de 271 px y `@4xl:grid-cols-3` (896 px) sólo entra cuando hay sitio
    // de verdad para 3.
    <div className="@container flex select-none flex-col gap-6">
      {/* Cabecera del Panel */}
      <div className="flex flex-col gap-3 border-b border-hairline pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Cpu size={22} className="text-brand" />
            <h1 className="text-base font-bold tracking-tight text-ink">Roster &amp; Fábrica de Sub-Egos</h1>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-faint">
            Especialistas cognitivos con memoria soberana en VantaDB (<span className="font-mono text-dim">egos/&lt;id&gt;/*</span>), gobernanza HITL y límites contables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Filtro de Estado */}
          <div className="flex items-center gap-0.5 rounded-[var(--radius-card)] border border-hairline bg-paper p-0.5 text-xs">
            <Button
              variant="ghost"
              size="md"
              aria-pressed={filterState === "all"}
              onClick={() => setFilterState("all")}
              className={filterState === "all" ? "bg-raised font-semibold text-ink" : "text-faint"}
            >
              Todos ({subEgos.length})
            </Button>
            <Button
              variant="ghost"
              size="md"
              aria-pressed={filterState === "active"}
              onClick={() => setFilterState("active")}
              className={filterState === "active" ? "bg-raised font-semibold text-success" : "text-faint"}
            >
              Activos ({subEgos.filter((s) => s.state === "active").length})
            </Button>
            <Button
              variant="ghost"
              size="md"
              aria-pressed={filterState === "paused"}
              onClick={() => setFilterState("paused")}
              className={filterState === "paused" ? "bg-raised font-semibold text-warning" : "text-faint"}
            >
              Pausados ({subEgos.filter((s) => s.state === "paused").length})
            </Button>
          </div>

          <Button
            variant="secondary"
            size="md"
            onClick={() => setWardrobeSubEgoId("ego.nucleus")}
            icon={<Sparkle size={14} className="text-brand" />}
          >
            <span>Personalizar Avatar de Ego</span>
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setModalError(null);
              setShowModal(true);
            }}
            icon={<Plus size={14} weight="bold" />}
          >
            <span>Crear Sub-Ego</span>
          </Button>
        </div>
      </div>

      {/* Banner de Feedback Global */}
      {feedback && (
        <div className="flex items-center justify-between gap-2 rounded-[var(--radius-card)] border border-success/30 bg-success/10 p-2 text-xs text-success">
          <div className="flex items-center gap-2">
            <CheckCircle size={15} className="shrink-0" />
            <span>{feedback}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Descartar aviso"
            onClick={() => setFeedback(null)}
            className="text-success hover:text-ink"
          >
            <X size={14} />
          </Button>
        </div>
      )}

      {/* Cuadrícula Bento de Sub-Egos */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-xs text-dim">
          <span>Cargando catálogo desde VantaDB (gov/sub_egos)...</span>
        </div>
      ) : filteredSubEgos.length === 0 ? (
        <div className="flex h-36 flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-hairline p-6 text-center text-xs text-dim">
          <Robot size={24} className="mb-2 text-faint" />
          <p className="font-medium text-ink">No hay Sub-Egos en esta categoría.</p>
          <p className="mt-1 text-faint">Crea un especialista nuevo desde plantillas oficiales o de forma personalizada.</p>
        </div>
      ) : (
        /* D9: retícula RESPONSIVE por CONTAINER QUERY (ver el `@container`
           de la raíz): 1 columna por defecto, 2 a partir de 512 px de ancho
           de panel y 3 a partir de 896 px. El interior de cada celda lleva
           `min-w-0` + `truncate` para que NADA se desborde, por estrecho
           que sea el panel. */
        <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2 @4xl:grid-cols-3">
          {filteredSubEgos.map((se) => {
            const isNucleus = se.id === "ego.nucleus";
            const isActive = se.state === "active";

            return (
              <div
                key={se.id}
                className="group flex min-w-0 flex-col justify-between rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)] transition-colors hover:border-strong hover:shadow-[var(--ego-elevation-l2)]"
              >
                <div className="min-w-0">
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    {/* `min-w-0` en el grupo izquierdo: sin él, el avatar +
                        nombre + badge no pueden encogerse y empujan hacia
                        fuera el badge de estado (D9). */}
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius-card)] border border-hairline bg-raised shadow-[var(--ego-elevation-l1)]">
                        <CharacterBadge subEgoId={se.id} size={56} state="idle" animated={true} />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        {/* `flex-wrap`: si el nombre largo no deja sitio al
                            badge, el badge BAJA a la línea siguiente en vez de
                            aplastarse contra 0 px. Con `truncate` en ambos,
                            ningún texto se sale de la tarjeta (D9). */}
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <h3 className="min-w-0 truncate text-xs font-semibold leading-tight text-ink">{se.name}</h3>
                          <Badge
                            tone="dim"
                            className="min-w-0 shrink uppercase"
                            overflow={isNucleus ? "NÚCLEO" : "ESPECIALISTA"}
                          >
                            {isNucleus ? "NÚCLEO" : "ESPECIALISTA"}
                          </Badge>
                        </div>
                        <span className="min-w-0 truncate font-mono text-xs text-dim">{se.id}</span>
                      </div>
                    </div>
                    {/* Indicador de estado: punto + texto, NO un segundo
                        `Badge`. La cabecera ya lleva el `Badge` de rol y, con
                        dos chips, la columna de texto se quedaba en 82 px:
                        el nombre y el id salían truncados. Además el `Badge`
                        del kit pinta con paleta cruda (`emerald-950`/
                        `amber-950`) mientras que aquí se usan los tokens
                        semánticos (`success`/`warning`). Es el mismo
                        indicador de punto que usa el roster del sidebar. */}
                    <span
                      title={isActive ? "Sub-Ego activo" : "Sub-Ego pausado"}
                      className={`flex shrink-0 items-center gap-1.5 text-xs font-medium ${
                        isActive ? "text-success" : "text-warning"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {isActive ? "Activo" : "Pausado"}
                    </span>
                  </div>

                  <p className="mb-1 font-mono text-xs font-medium text-dim">Rol: {se.role}</p>
                  <p className="line-clamp-2 text-xs leading-relaxed text-faint">{se.description}</p>

                  {/* Herramientas y Presupuesto */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {se.tools && se.tools.slice(0, 3).map((t) => (
                      <Badge key={t} tone="dim">
                        {t}
                      </Badge>
                    ))}
                    {se.tools && se.tools.length > 3 && (
                      <Badge tone="dim">+{se.tools.length - 3}</Badge>
                    )}
                  </div>

                  {se.budget && (
                    <div className="mt-2.5 flex items-center gap-1 font-mono text-xs text-dim">
                      <CurrencyDollar size={12} className="text-brand" />
                      <span>Límite diario: ${se.budget.maxDailyCostUsd ?? 2.0} USD</span>
                      <span>|</span>
                      <span>{se.budget.maxTokensPerCall ?? 4000} tok/turno</span>
                    </div>
                  )}
                </div>

                {/* Pie de tarjeta: 4 acciones repetidas en cada tarjeta. Van a
                    `size="md"` (32 px) porque la política de target size
                    (WCAG 2.2) prohíbe cualquier control por debajo de 32 px
                    (`test/Targets44.test.tsx`). `flex-wrap` deja que el grupo
                    de acciones repose en 2 filas cuando la retícula de 3
                    columnas aprieta, en vez de desbordar la tarjeta. */}
                <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3 text-xs">
                  <span className="max-w-[120px] truncate font-mono text-dim">
                    egos/{se.id.replace(/^ego\./, "")}/*
                  </span>
                  <div className="flex min-w-0 flex-wrap items-center gap-1">
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => setWardrobeSubEgoId(se.id)}
                      title="Personalizar Avatar de este Sub-Ego"
                      icon={<Sparkle size={12} className="text-brand" />}
                    >
                      <span>Personalizar Avatar</span>
                    </Button>

                    {!isNucleus && (
                      <>
                        <Button
                          variant="ghost"
                          size="md"
                          onClick={() => handleOpenEdit(se)}
                          title="Editar Sub-Ego"
                          icon={<PencilSimple size={12} />}
                        >
                          <span>Editar</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="md"
                          onClick={() => handleDeleteSubEgo(se)}
                          title="Eliminar Sub-Ego"
                          className="text-error hover:bg-error/10 hover:text-error"
                          icon={<Trash size={12} />}
                        >
                          <span>Eliminar</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="md"
                          onClick={() => handleToggleState(se)}
                          title={isActive ? "Pausar Sub-Ego" : "Activar Sub-Ego"}
                          icon={
                            isActive ? (
                              <Pause size={12} />
                            ) : (
                              <Play size={12} className="text-success" />
                            )
                          }
                        >
                          <span>{isActive ? "Pausar" : "Activar"}</span>
                        </Button>
                      </>
                    )}

                    {isNucleus && (
                      <span
                        title="Identidad protegida e inmutable del sistema"
                        className="flex items-center gap-1 font-mono text-xs text-dim"
                      >
                        <ShieldCheck size={12} className="text-success" />
                        Inmutable
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Multi-Modalidad de Creación (SUB-02 / INT-04). T07: Radix Modal
          (trap+Escape+aria-modal) + Tabs con roles tab nativos; el error usa
          el slot `role="alert"` del Modal. */}
      {showModal && (
        <Modal
          open={showModal}
          onOpenChange={setShowModal}
          title="Fábrica de Sub-Egos (3 Modalidades Canónicas)"
          description="Instancia especialistas verificados por dominio, formulario o manifiesto declarativo."
          wide
          error={modalError ?? undefined}
        >
          <Tabs
            value={creationTab}
            onValueChange={(v) => setCreationTab(v as typeof creationTab)}
            ariaLabel="Modalidades de creación de Sub-Egos"
            tabs={[
              {
                value: "template",
                label: "Plantillas de Dominio",
                content: (
                  <div className="space-y-3">
                    <p className="leading-relaxed text-faint">
                      Instancia un Sub-Ego verificado con prompt de sistema, herramientas nativas y capacidades preconfiguradas por dominio.
                    </p>

                    {/* La tarjeta de plantilla se queda como `<button aria-pressed>`:
                        el kit no tiene primitive de "botón-tarjeta" y el `Button`
                        del kit no admite contenido en bloque (envuelve los hijos
                        en un span), así que mantiene `<button>` con tokens. */}
                    <div className="grid grid-cols-2 gap-3">
                      {templates.map((tpl) => {
                        const isSelected = selectedTemplateId === tpl.id;
                        return (
                          <button
                            key={tpl.id || tpl.templateId}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setSelectedTemplateId(tpl.id || tpl.templateId || "")}
                            className={`flex cursor-pointer flex-col rounded-[var(--radius-card)] border p-3 text-left transition-colors ${
                              isSelected
                                ? "border-brand bg-raised text-ink shadow-[var(--ego-elevation-l1)]"
                                : "border-hairline bg-paper text-faint hover:border-strong hover:text-ink"
                            }`}
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <CharacterBadge subEgoId={tpl.id || tpl.templateId} size={20} state="idle" />
                              <span className="text-xs font-semibold text-ink">{tpl.name}</span>
                              <Badge tone="dim" className="ml-auto uppercase">
                                {tpl.domain}
                              </Badge>
                            </div>
                            <span className="font-mono text-xs text-dim">{tpl.role}</span>
                            <p className="mt-1.5 line-clamp-2 text-xs text-faint">{tpl.description}</p>
                          </button>
                        );
                      })}
                    </div>

                    {selectedTemplate && (
                      <div className="mt-2 space-y-2 rounded-[var(--radius-card)] border border-hairline bg-paper p-3">
                        <div className="flex items-center justify-between font-medium text-ink">
                          <span>Detalles de Plantilla: {selectedTemplate.name}</span>
                          <span className="font-mono text-xs text-dim">
                            Autonomía: {selectedTemplate.autonomy}
                          </span>
                        </div>
                        <p className="font-mono text-xs leading-relaxed text-faint">
                          {selectedTemplate.instructions}
                        </p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {selectedTemplate.recommendedTools.map((t) => (
                            <Badge key={t} tone="dim">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    </div>
                  ),
                },
              {
                value: "custom",
                label: "Formulario Personalizado",
                content: (
                    <form id="customSubEgoForm" onSubmit={handleCreateCustom} className="space-y-3">
                  <div className="space-y-1">
                    <label htmlFor="custom-subeego-name" className="font-medium text-ink">Nombre del Especialista</label>
                    <Input
                      id="custom-subeego-name"
                      required
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Ej. Ego Revisor de Arquitectura"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="custom-subeego-role" className="font-medium text-ink">Rol Operativo</label>
                    <Input
                      id="custom-subeego-role"
                      required
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      placeholder="Ej. Auditor de Calidad y Principios Innegociables"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="custom-subeego-instructions" className="font-medium text-ink">Instrucciones del Sistema (System Prompt)</label>
                    <Textarea
                      id="custom-subeego-instructions"
                      required
                      rows={5}
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      placeholder="Define directrices de razonamiento, tono analítico y restricciones duras..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label htmlFor="custom-subeego-cost" className="font-medium text-ink">Límite Diario de Costo ($ USD)</label>
                      <Input
                        id="custom-subeego-cost"
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="50"
                        value={maxDailyCostUsd}
                        onChange={(e) => setMaxDailyCostUsd(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-medium text-ink">Aislamiento de Memoria</label>
                      <div className="rounded-[var(--radius-card)] border border-hairline bg-raised p-2 font-mono text-xs text-dim">
                        egos/{customName ? customName.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "&lt;id&gt;"}/*
                      </div>
                    </div>
                  </div>
                </form>
                  ),
                },
              {
                value: "declaration",
                label: "Declaración JSON / YAML",
                content: (
                    <form id="declSubEgoForm" onSubmit={handleCreateDeclaration} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="decl-subeego-raw" className="text-faint">Pega o edita el manifiesto declarativo:</label>
                    <div className="flex gap-0.5 rounded-[var(--radius-card)] border border-hairline bg-paper p-0.5">
                      <Button
                        variant="ghost"
                        size="md"
                        aria-pressed={declarationFormat === "json"}
                        onClick={() => setDeclarationFormat("json")}
                        className={
                          declarationFormat === "json" ? "bg-raised font-bold text-ink" : "text-faint"
                        }
                      >
                        JSON
                      </Button>
                      <Button
                        variant="ghost"
                        size="md"
                        aria-pressed={declarationFormat === "yaml"}
                        onClick={() => setDeclarationFormat("yaml")}
                        className={
                          declarationFormat === "yaml" ? "bg-raised font-bold text-ink" : "text-faint"
                        }
                      >
                        YAML
                      </Button>
                    </div>
                  </div>

                  <Textarea
                    id="decl-subeego-raw"
                    rows={12}
                    value={declarationRaw}
                    onChange={(e) => setDeclarationRaw(e.target.value)}
                    className="font-mono leading-relaxed"
                  />
                    </form>
                  ),
                },
            ]}
          />

            {/* Footer Modal */}
            <div className="flex items-center justify-end gap-2 border-t border-hairline pt-3">
              <Button variant="ghost" size="md" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>

              {creationTab === "template" && (
                <Button
                  variant="primary"
                  size="md"
                  disabled={!selectedTemplate}
                  loading={isSubmitting}
                  onClick={() => selectedTemplate && handleCreateFromTemplate(selectedTemplate.id || selectedTemplate.templateId || "")}
                >
                  {isSubmitting ? "Instanciando..." : `Instanciar ${selectedTemplate?.name || "Plantilla"}`}
                </Button>
              )}

              {creationTab === "custom" && (
                <Button
                  type="submit"
                  form="customSubEgoForm"
                  variant="primary"
                  size="md"
                  loading={isSubmitting}
                >
                  {isSubmitting ? "Creando..." : "Crear Sub-Ego en VantaDB"}
                </Button>
              )}

              {creationTab === "declaration" && (
                <Button
                  type="submit"
                  form="declSubEgoForm"
                  variant="primary"
                  size="md"
                  loading={isSubmitting}
                >
                  {isSubmitting ? "Importando..." : "Validar e Importar"}
                </Button>
              )}
            </div>
          </Modal>
      )}

      {/* Modal de Personalización de Avatar con WardrobeSelector */}
      {wardrobeSubEgoId && (
        <Modal
          open={!!wardrobeSubEgoId}
          onOpenChange={(open) => {
            if (!open) setWardrobeSubEgoId(null);
          }}
          title={`Personalizar Avatar: ${wardrobeSubEgoId}`}
          description="Ajusta la morfología, geometría, sensores y estética del avatar en VantaDB."
          wide
        >
          <div className="flex justify-center py-2">
            <WardrobeSelector
              subEgoId={wardrobeSubEgoId}
              onSave={(_config) => {
                setFeedback(`Avatar de '${wardrobeSubEgoId}' actualizado con éxito.`);
                setWardrobeSubEgoId(null);
                setTimeout(() => setFeedback(null), 3000);
              }}
              onClose={() => setWardrobeSubEgoId(null)}
            />
          </div>
        </Modal>
      )}

      {/* Modal de Edición de Sub-Ego */}
      {editingSubEgo && (
        <Modal
          open={!!editingSubEgo}
          onOpenChange={(open) => {
            if (!open) setEditingSubEgo(null);
          }}
          title={`Editar Sub-Ego: ${editingSubEgo.name}`}
          description={`Modifica los metadatos y directivas operativas de ${editingSubEgo.id}.`}
          error={modalError ?? undefined}
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div>
              <label htmlFor="edit-name" className="mb-1 block font-semibold text-dim">
                Nombre del Sub-Ego
              </label>
              <Input
                id="edit-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="edit-role" className="mb-1 block font-semibold text-dim">
                Rol o Especialidad
              </label>
              <Input
                id="edit-role"
                type="text"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="edit-desc" className="mb-1 block font-semibold text-dim">
                Descripción
              </label>
              <Input
                id="edit-desc"
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="edit-inst" className="mb-1 block font-semibold text-dim">
                Instrucciones Operativas / Prompt del Sistema
              </label>
              <Textarea
                id="edit-inst"
                rows={4}
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                className="font-mono"
              />
            </div>

            <div>
              <label htmlFor="edit-cost" className="mb-1 block font-semibold text-dim">
                Presupuesto Diario Máximo (USD)
              </label>
              <Input
                id="edit-cost"
                type="number"
                step="0.5"
                min="0.5"
                max="50"
                value={editMaxDailyCost}
                onChange={(e) => setEditMaxDailyCost(e.target.value)}
                className="w-32 font-mono"
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-hairline pt-3">
              <Button variant="ghost" size="md" onClick={() => setEditingSubEgo(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" size="md" loading={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
