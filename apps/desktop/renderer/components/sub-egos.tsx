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
import { ego, SubEgoDetailInfo, DomainTemplateInfo } from "../lib/ego";
import { CharacterBadge } from "./character/CharacterBadge.js";
import { WardrobeSelector } from "./character/wardrobe/WardrobeSelector.js";
import { Modal } from "./ui-kit/Modal.js";
import { Tabs } from "./ui-kit/Tabs.js";

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
    <div className="flex flex-col gap-6 select-none">
      {/* Cabecera del Panel */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-hairline pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu size={22} className="text-amber-400" />
            <h1 className="text-lg font-bold tracking-tight text-ink">Roster & Fábrica de Sub-Egos</h1>
          </div>
          <p className="text-xs text-faint leading-relaxed mt-1">
            Especialistas cognitivos con memoria soberana en VantaDB (<span className="font-mono text-dim">egos/&lt;id&gt;/*</span>), gobernanza HITL y límites contables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Selector de Filtro de Estado */}
          <div className="flex items-center rounded border border-hairline bg-paper p-0.5 text-xs">
            <button
              onClick={() => setFilterState("all")}
              className={`rounded px-2 py-1 transition-colors ${
                filterState === "all" ? "bg-raised text-ink font-semibold" : "text-faint hover:text-ink"
              }`}
            >
              Todos ({subEgos.length})
            </button>
            <button
              onClick={() => setFilterState("active")}
              className={`rounded px-2 py-1 transition-colors ${
                filterState === "active" ? "bg-raised text-emerald-400 font-semibold" : "text-faint hover:text-ink"
              }`}
            >
              Activos ({subEgos.filter((s) => s.state === "active").length})
            </button>
            <button
              onClick={() => setFilterState("paused")}
              className={`rounded px-2 py-1 transition-colors ${
                filterState === "paused" ? "bg-raised text-amber-400 font-semibold" : "text-faint hover:text-ink"
              }`}
            >
              Pausados ({subEgos.filter((s) => s.state === "paused").length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setWardrobeSubEgoId("ego.nucleus")}
            className="flex items-center gap-1.5 rounded border border-hairline bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:bg-raised transition-colors shadow-xs"
          >
            <Sparkle size={14} className="text-amber-400" />
            <span>Personalizar Avatar de Ego</span>
          </button>

          <button
            onClick={() => {
              setModalError(null);
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 rounded bg-ink px-3 py-1.5 text-xs font-semibold text-paper shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus size={14} weight="bold" />
            <span>Crear Sub-Ego</span>
          </button>
        </div>
      </div>

      {/* Banner de Feedback Global */}
      {feedback && (
        <div className="flex items-center justify-between rounded border border-emerald-800/40 bg-emerald-950/40 p-2.5 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle size={15} />
            <span>{feedback}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            aria-label="Descartar aviso"
            className="text-emerald-400 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Cuadrícula Bento de Sub-Egos */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-xs text-dim">
          <span>Cargando catálogo desde VantaDB (gov/sub_egos)...</span>
        </div>
      ) : filteredSubEgos.length === 0 ? (
        <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-dashed border-hairline p-6 text-center text-xs text-dim">
          <Robot size={24} className="mb-2 text-faint" />
          <p className="font-medium text-ink">No hay Sub-Egos en esta categoría.</p>
          <p className="text-faint mt-1">Crea un especialista nuevo desde plantillas oficiales o de forma personalizada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSubEgos.map((se) => {
            const isNucleus = se.id === "ego.nucleus";
            const isActive = se.state === "active";

            return (
              <div
                key={se.id}
                className="flex flex-col justify-between rounded-xl border border-hairline bg-panel p-4.5 transition-colors hover:border-ink/40 hover:shadow-md shadow-xs group"
              >
                <div>
                  <div className="mb-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-[#0d0f17] border border-white/10 shadow-inner flex items-center justify-center shrink-0">
                        <CharacterBadge subEgoId={se.id} size={56} state="idle" animated={true} />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold text-ink text-xs leading-tight">{se.name}</h3>
                          <span className="font-mono text-[9px] uppercase tracking-wider text-dim bg-raised px-1 py-0.2 rounded border border-hairline">
                            {isNucleus ? "NÚCLEO" : "ESPECIALISTA"}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-dim">{se.id}</span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold border ${
                        isActive
                          ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40"
                          : "bg-amber-950/60 text-amber-400 border-amber-800/40"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-amber-400"}`} />
                      {isActive ? "Activo" : "Pausado"}
                    </span>
                  </div>

                  <p className="mb-1 font-mono text-[11px] text-dim font-medium">Rol: {se.role}</p>
                  <p className="text-xs text-faint line-clamp-2 leading-relaxed">{se.description}</p>

                  {/* Herramientas y Presupuesto */}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                    {se.tools && se.tools.slice(0, 3).map((t) => (
                      <span key={t} className="rounded bg-raised px-1.5 py-0.5 font-mono text-dim border border-hairline">
                        {t}
                      </span>
                    ))}
                    {se.tools && se.tools.length > 3 && (
                      <span className="rounded bg-raised px-1.5 py-0.5 font-mono text-faint">
                        +{se.tools.length - 3}
                      </span>
                    )}
                  </div>

                  {se.budget && (
                    <div className="mt-2.5 flex items-center gap-1 text-[10px] font-mono text-dim">
                      <CurrencyDollar size={12} className="text-amber-400" />
                      <span>Límite diario: ${se.budget.maxDailyCostUsd ?? 2.0} USD</span>
                      <span className="text-hairline">|</span>
                      <span>{se.budget.maxTokensPerCall ?? 4000} tok/turno</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3 text-[10px]">
                  <span className="font-mono text-dim truncate max-w-[120px]">
                    egos/{se.id.replace(/^ego\./, "")}/*
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setWardrobeSubEgoId(se.id)}
                      title="Personalizar Avatar de este Sub-Ego"
                      className="flex items-center gap-1 rounded bg-raised px-2 py-1 text-dim hover:bg-raised/80 hover:text-ink transition-colors border border-hairline"
                    >
                      <Sparkle size={12} className="text-amber-400" />
                      <span>Personalizar Avatar</span>
                    </button>

                    {!isNucleus && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(se)}
                          title="Editar Sub-Ego"
                          className="flex items-center gap-1 rounded bg-raised px-2 py-1 text-dim hover:bg-raised/80 hover:text-ink transition-colors border border-hairline"
                        >
                          <PencilSimple size={12} />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSubEgo(se)}
                          title="Eliminar Sub-Ego"
                          className="flex items-center gap-1 rounded bg-raised px-2 py-1 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors border border-hairline"
                        >
                          <Trash size={12} />
                          <span>Eliminar</span>
                        </button>

                        <button
                          onClick={() => handleToggleState(se)}
                          title={isActive ? "Pausar Sub-Ego" : "Activar Sub-Ego"}
                          className="flex items-center gap-1 rounded bg-raised px-2 py-1 text-dim hover:bg-raised/80 hover:text-ink transition-colors border border-hairline"
                        >
                          {isActive ? <Pause size={12} /> : <Play size={12} className="text-emerald-400" />}
                          <span>{isActive ? "Pausar" : "Activar"}</span>
                        </button>
                      </>
                    )}

                    {isNucleus && (
                      <span
                        title="Identidad protegida e inmutable del sistema"
                        className="flex items-center gap-1 text-dim font-mono text-[9px]"
                      >
                        <ShieldCheck size={12} className="text-emerald-400" />
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
                  <p className="text-faint leading-relaxed">
                    Instancia un Sub-Ego verificado con prompt de sistema, herramientas nativas y capacidades preconfiguradas por dominio.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {templates.map((tpl) => {
                      const isSelected = selectedTemplateId === tpl.id;
                      return (
                        <button
                          key={tpl.id || tpl.templateId}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedTemplateId(tpl.id || tpl.templateId || "")}
                          className={`flex flex-col text-left rounded-lg border p-3 transition-colors ${
                            isSelected
                              ? "border-ink bg-raised text-ink shadow-xs"
                              : "border-hairline bg-paper text-faint hover:border-hairline/80 hover:text-ink"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <CharacterBadge subEgoId={tpl.id || tpl.templateId} size={20} state="idle" />
                            <span className="font-semibold text-xs text-ink">{tpl.name}</span>
                            <span className="ml-auto font-mono text-[9px] rounded bg-raised px-1 py-0.2 uppercase text-dim">
                              {tpl.domain}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-dim">{tpl.role}</span>
                          <p className="mt-1.5 text-[11px] text-faint line-clamp-2">{tpl.description}</p>
                        </button>
                      );
                    })}
                  </div>

                  {selectedTemplate && (
                    <div className="rounded border border-hairline bg-paper p-3 space-y-2 mt-2">
                      <div className="flex items-center justify-between font-medium text-ink">
                        <span>Detalles de Plantilla: {selectedTemplate.name}</span>
                        <span className="font-mono text-[10px] text-dim">
                          Autonomía: {selectedTemplate.autonomy}
                        </span>
                      </div>
                      <p className="text-[11px] text-faint leading-relaxed font-mono">
                        {selectedTemplate.instructions}
                      </p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {selectedTemplate.recommendedTools.map((t) => (
                          <span key={t} className="rounded bg-raised px-1.5 py-0.5 font-mono text-[9px] text-dim">
                            {t}
                          </span>
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
                    <input
                      id="custom-subeego-name"
                      required
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Ej. Ego Revisor de Arquitectura"
                      className="w-full rounded border border-hairline bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-dim focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="custom-subeego-role" className="font-medium text-ink">Rol Operativo</label>
                    <input
                      id="custom-subeego-role"
                      required
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      placeholder="Ej. Auditor de Calidad y Principios Innegociables"
                      className="w-full rounded border border-hairline bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-dim focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="custom-subeego-instructions" className="font-medium text-ink">Instrucciones del Sistema (System Prompt)</label>
                    <textarea
                      id="custom-subeego-instructions"
                      required
                      rows={5}
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      placeholder="Define directrices de razonamiento, tono analítico y restricciones duras..."
                      className="w-full rounded border border-hairline bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-dim focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label htmlFor="custom-subeego-cost" className="font-medium text-ink">Límite Diario de Costo ($ USD)</label>
                      <input
                        id="custom-subeego-cost"
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="50"
                        value={maxDailyCostUsd}
                        onChange={(e) => setMaxDailyCostUsd(e.target.value)}
                        className="w-full rounded border border-hairline bg-paper px-3 py-1.5 text-xs text-ink font-mono focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-medium text-ink">Aislamiento de Memoria</label>
                      <div className="rounded border border-hairline bg-raised p-2 font-mono text-[10px] text-dim">
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
                    <div className="flex rounded border border-hairline bg-paper p-0.5 text-[10px] font-mono">
                      <button
                        type="button"
                        onClick={() => setDeclarationFormat("json")}
                        className={`rounded px-2 py-0.5 ${
                          declarationFormat === "json" ? "bg-raised text-ink font-bold" : "text-faint"
                        }`}
                      >
                        JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeclarationFormat("yaml")}
                        className={`rounded px-2 py-0.5 ${
                          declarationFormat === "yaml" ? "bg-raised text-ink font-bold" : "text-faint"
                        }`}
                      >
                        YAML
                      </button>
                    </div>
                  </div>

                  <textarea
                    id="decl-subeego-raw"
                    rows={12}
                    value={declarationRaw}
                    onChange={(e) => setDeclarationRaw(e.target.value)}
                    className="w-full rounded border border-hairline bg-paper p-3 text-xs text-ink font-mono leading-relaxed focus:outline-none"
                  />
                    </form>
                  ),
                },
              ]}
            />

            {/* Footer Modal */}
            <div className="flex items-center justify-end gap-2 border-t border-hairline pt-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded px-3 py-1 text-xs text-faint hover:text-ink transition-colors"
              >
                Cancelar
              </button>

              {creationTab === "template" && (
                <button
                  type="button"
                  disabled={isSubmitting || !selectedTemplate}
                  onClick={() => selectedTemplate && handleCreateFromTemplate(selectedTemplate.id || selectedTemplate.templateId || "")}
                  className="rounded bg-ink px-4 py-1.5 text-xs font-semibold text-paper hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isSubmitting ? "Instanciando..." : `Instanciar ${selectedTemplate?.name || "Plantilla"}`}
                </button>
              )}

              {creationTab === "custom" && (
                <button
                  type="submit"
                  form="customSubEgoForm"
                  disabled={isSubmitting}
                  className="rounded bg-ink px-4 py-1.5 text-xs font-semibold text-paper hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isSubmitting ? "Creando..." : "Crear Sub-Ego en VantaDB"}
                </button>
              )}

              {creationTab === "declaration" && (
                <button
                  type="submit"
                  form="declSubEgoForm"
                  disabled={isSubmitting}
                  className="rounded bg-ink px-4 py-1.5 text-xs font-semibold text-paper hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isSubmitting ? "Importando..." : "Validar e Importar"}
                </button>
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
              <label htmlFor="edit-name" className="block text-[11px] font-semibold text-dim mb-1">
                Nombre del Sub-Ego
              </label>
              <input
                id="edit-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="w-full rounded border border-hairline bg-paper px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-ink"
              />
            </div>

            <div>
              <label htmlFor="edit-role" className="block text-[11px] font-semibold text-dim mb-1">
                Rol o Especialidad
              </label>
              <input
                id="edit-role"
                type="text"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                required
                className="w-full rounded border border-hairline bg-paper px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-ink"
              />
            </div>

            <div>
              <label htmlFor="edit-desc" className="block text-[11px] font-semibold text-dim mb-1">
                Descripción
              </label>
              <input
                id="edit-desc"
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded border border-hairline bg-paper px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-ink"
              />
            </div>

            <div>
              <label htmlFor="edit-inst" className="block text-[11px] font-semibold text-dim mb-1">
                Instrucciones Operativas / Prompt del Sistema
              </label>
              <textarea
                id="edit-inst"
                rows={4}
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                className="w-full rounded border border-hairline bg-paper px-3 py-1.5 text-xs text-ink font-mono focus:outline-none focus:border-ink"
              />
            </div>

            <div>
              <label htmlFor="edit-cost" className="block text-[11px] font-semibold text-dim mb-1">
                Presupuesto Diario Máximo (USD)
              </label>
              <input
                id="edit-cost"
                type="number"
                step="0.5"
                min="0.5"
                max="50"
                value={editMaxDailyCost}
                onChange={(e) => setEditMaxDailyCost(e.target.value)}
                className="w-32 rounded border border-hairline bg-paper px-3 py-1.5 text-xs text-ink font-mono focus:outline-none focus:border-ink"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-hairline pt-3 mt-4">
              <button
                type="button"
                onClick={() => setEditingSubEgo(null)}
                className="rounded px-3 py-1 text-xs text-faint hover:text-ink transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded bg-ink px-4 py-1.5 text-xs font-semibold text-paper hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isSubmitting ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
