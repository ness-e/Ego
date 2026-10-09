"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Robot,
  Pause,
  Play,
  ShieldCheck,
  Sparkle,
  Terminal,
  CurrencyDollar,
  FileCode,
  X,
  CheckCircle,
  Cpu,
} from "@phosphor-icons/react";
import { ego, SubEgoDetailInfo, DomainTemplateInfo } from "../lib/ego";

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

  const loadSubEgos = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await ego().subegos.list();
      setSubEgos(list);
    } catch (err: any) {
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
        setSelectedTemplateId((list[0].templateId || list[0].id) || "developer");
      }
    } catch (err: any) {
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
    } catch (err: any) {
      setFeedback(`Error: ${err?.message || "No se pudo cambiar el estado"}`);
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
    } catch (err: any) {
      setModalError(err?.message || "Error al instanciar desde plantilla.");
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
    } catch (err: any) {
      setModalError(err?.message || "Error al crear Sub-Ego.");
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
    } catch (err: any) {
      setModalError(err?.message || "Error de sintaxis o validación de manifiesto.");
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
          <button onClick={() => setFeedback(null)} className="text-emerald-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Cuadrícula de Sub-Egos */}
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
                className="flex flex-col justify-between rounded-lg border border-hairline bg-panel p-4 transition-colors hover:border-ink/30 shadow-xs"
              >
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-raised border border-hairline text-ink font-bold text-xs">
                        {se.name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <h3 className="font-semibold text-ink text-xs leading-tight">{se.name}</h3>
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
                  <span className="font-mono text-dim truncate max-w-[150px]">
                    egos/{se.id.replace(/^ego\./, "")}/*
                  </span>
                  <div className="flex items-center gap-1">
                    {!isNucleus && (
                      <button
                        onClick={() => handleToggleState(se)}
                        title={isActive ? "Pausar Sub-Ego" : "Activar Sub-Ego"}
                        className="flex items-center gap-1 rounded bg-raised px-2 py-1 text-dim hover:bg-raised/80 hover:text-ink transition-colors border border-hairline"
                      >
                        {isActive ? <Pause size={12} /> : <Play size={12} className="text-emerald-400" />}
                        <span>{isActive ? "Pausar" : "Activar"}</span>
                      </button>
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

      {/* Modal Multi-Modalidad de Creación (SUB-02 / INT-04) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
          <div className="flex h-[560px] w-[680px] flex-col rounded-lg border border-hairline bg-panel text-ink shadow-2xl overflow-hidden">
            {/* Header Modal */}
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-hairline px-4 bg-paper">
              <div className="flex items-center gap-2">
                <Robot size={18} className="text-amber-400" />
                <span className="text-xs font-semibold">Fábrica de Sub-Egos (3 Modalidades Canónicas)</span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-faint hover:text-ink transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Selector de Pestañas de Modalidad */}
            <div className="flex border-b border-hairline bg-paper/60 px-4 text-xs">
              <button
                onClick={() => setCreationTab("template")}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 font-medium transition-colors ${
                  creationTab === "template"
                    ? "border-ink text-ink font-semibold"
                    : "border-transparent text-faint hover:text-ink"
                }`}
              >
                <Sparkle size={14} />
                <span>Plantillas de Dominio</span>
              </button>

              <button
                onClick={() => setCreationTab("custom")}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 font-medium transition-colors ${
                  creationTab === "custom"
                    ? "border-ink text-ink font-semibold"
                    : "border-transparent text-faint hover:text-ink"
                }`}
              >
                <Terminal size={14} />
                <span>Formulario Personalizado</span>
              </button>

              <button
                onClick={() => setCreationTab("declaration")}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 font-medium transition-colors ${
                  creationTab === "declaration"
                    ? "border-ink text-ink font-semibold"
                    : "border-transparent text-faint hover:text-ink"
                }`}
              >
                <FileCode size={14} />
                <span>Declaración JSON / YAML</span>
              </button>
            </div>

            {/* Contenido según Modalidad */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 text-xs space-y-4">
              {modalError && (
                <div className="rounded border border-red-800/40 bg-red-950/40 p-2.5 text-[11px] text-red-300">
                  {modalError}
                </div>
              )}

              {/* Modalidad 1: Plantillas de Dominio */}
              {creationTab === "template" && (
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
                          onClick={() => setSelectedTemplateId(tpl.id || tpl.templateId || "")}
                          className={`flex flex-col text-left rounded-lg border p-3 transition-colors ${
                            isSelected
                              ? "border-ink bg-raised text-ink shadow-xs"
                              : "border-hairline bg-paper text-faint hover:border-hairline/80 hover:text-ink"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs text-ink">{tpl.name}</span>
                            <span className="font-mono text-[9px] rounded bg-raised px-1 py-0.2 uppercase text-dim">
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
              )}

              {/* Modalidad 2: Formulario Personalizado */}
              {creationTab === "custom" && (
                <form id="customSubEgoForm" onSubmit={handleCreateCustom} className="space-y-3">
                  <div className="space-y-1">
                    <label className="font-medium text-ink">Nombre del Especialista</label>
                    <input
                      required
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Ej. Ego Revisor de Arquitectura"
                      className="w-full rounded border border-hairline bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-dim focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-ink">Rol Operativo</label>
                    <input
                      required
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      placeholder="Ej. Auditor de Calidad y Principios Innegociables"
                      className="w-full rounded border border-hairline bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-dim focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-ink">Instrucciones del Sistema (System Prompt)</label>
                    <textarea
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
                      <label className="font-medium text-ink">Límite Diario de Costo ($ USD)</label>
                      <input
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
              )}

              {/* Modalidad 3: Declaración JSON/YAML */}
              {creationTab === "declaration" && (
                <form id="declSubEgoForm" onSubmit={handleCreateDeclaration} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-faint">Pega o edita el manifiesto declarativo:</span>
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
                    rows={12}
                    value={declarationRaw}
                    onChange={(e) => setDeclarationRaw(e.target.value)}
                    className="w-full rounded border border-hairline bg-paper p-3 text-xs text-ink font-mono leading-relaxed focus:outline-none"
                  />
                </form>
              )}
            </div>

            {/* Footer Modal */}
            <div className="flex h-12 shrink-0 items-center justify-end gap-2 border-t border-hairline px-4 bg-paper">
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
          </div>
        </div>
      )}
    </div>
  );
}
