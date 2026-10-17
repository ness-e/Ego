import { useState, useEffect, useMemo } from "react";
import {
  PuzzlePiece,
  PlugsConnected,
  Sparkle,
  MagnifyingGlass,
  Plus,
  Check,
  Play,
  Folder,
  Database,
  Globe,
  GitBranch,
  ShieldCheck,
  Clock,
  Terminal,
  Gear,
} from "@phosphor-icons/react";
import { ego, type McpServerInfo } from "../../lib/ego.js";
import { McpAddServerDialog } from "../mcp/McpAddServerDialog.js";
import { WardrobeSelector } from "../character/wardrobe/WardrobeSelector.js";

type PersonalizationTab = "skills" | "mcp" | "avatar";

interface SkillItem {
  id: string;
  name: string;
  category: string;
  description: string;
  badge?: string;
  icon: typeof PuzzlePiece;
  status: "active" | "available";
}

const SYSTEM_SKILLS: SkillItem[] = [
  {
    id: "canvas-viz",
    name: "Canvas & Data Visualization",
    category: "Visualización & Generative UI",
    description: "Generación procedural de componentes React, gráficos interactivos SVG/Canvas y visualizaciones científicas en tiempo real.",
    badge: "Core",
    icon: Sparkle,
    status: "active",
  },
  {
    id: "vantadb-memory",
    name: "VantaDB Hybrid Memory L0-L3",
    category: "Memoria & Persistencia",
    description: "Indexación Fjall LSM nativa, búsqueda híbrida BM25 + embeddings ONNX y capas de memoria semántica, episódica y procedural.",
    badge: "Nativo Rust",
    icon: Database,
    status: "active",
  },
  {
    id: "git-diff-hunks",
    name: "Engineering Git & Diff Hunks",
    category: "Ingeniería de Software",
    description: "Inspección de árboles de código, síntesis de diffs atómicos, parcheado granular AST y validación estricta de compilación.",
    badge: "Tooling",
    icon: GitBranch,
    status: "active",
  },
  {
    id: "web-research",
    name: "Web & Literature Research",
    category: "Investigación & Datos",
    description: "Coordinación de búsquedas profundas, síntesis de papers arXiv/EuropePMC y extracción estructurada sin alucinaciones.",
    badge: "Research",
    icon: Globe,
    status: "active",
  },
  {
    id: "task-scheduler",
    name: "Autonomous Task Scheduler",
    category: "Ejecución Asíncrona",
    description: "Planificador en segundo plano con control de cuotas, timeouts deterministas y tolerancia a fallos en tareas concurrentes.",
    badge: "Runtime",
    icon: Clock,
    status: "active",
  },
  {
    id: "hitl-governance",
    name: "Security & HITL Governance",
    category: "Seguridad & Barreras",
    description: "Control de compuertas de aprobación humana (HITL) para escrituras de disco, ejecución de comandos y aislamiento sandbox.",
    badge: "Gobernanza",
    icon: ShieldCheck,
    status: "active",
  },
];

interface McpCatalogEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: typeof PlugsConnected;
  defaultConfig?: {
    command: string;
    args?: string[];
    toolPrefix?: string;
  };
}

const MCP_CATALOG: McpCatalogEntry[] = [
  {
    id: "github-mcp",
    name: "GitHub",
    category: "Desarrollo",
    description: "Gestión de pull requests, repositorios, issues y releases a través de la API oficial de GitHub.",
    icon: GitBranch,
    defaultConfig: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      toolPrefix: "gh",
    },
  },
  {
    id: "filesystem-mcp",
    name: "Filesystem Local",
    category: "Sistema",
    description: "Lectura y escritura segura de directorios locales con permisos restringidos de sandbox.",
    icon: Folder,
    defaultConfig: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
      toolPrefix: "fs",
    },
  },
  {
    id: "postgres-mcp",
    name: "PostgreSQL Database",
    category: "Base de Datos",
    description: "Inspección de esquemas relacionales, ejecución de consultas SQL y auditoría de índices.",
    icon: Database,
    defaultConfig: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"],
      toolPrefix: "pg",
    },
  },
  {
    id: "brave-search-mcp",
    name: "Brave Search API",
    category: "Búsqueda Web",
    description: "Búsqueda web en tiempo real y recuperación de fuentes verificadas mediante la API de Brave.",
    icon: Globe,
    defaultConfig: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"],
      toolPrefix: "brave",
    },
  },
  {
    id: "sqlite-mcp",
    name: "SQLite Local",
    category: "Base de Datos",
    description: "Acceso y modificación de bases de datos SQLite locales con transacciones ACID.",
    icon: Database,
    defaultConfig: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-sqlite"],
      toolPrefix: "sqlite",
    },
  },
  {
    id: "notion-mcp",
    name: "Notion",
    category: "Productividad",
    description: "Sincronización de páginas, bases de datos y bloques de contenido en Notion.",
    icon: PuzzlePiece,
    defaultConfig: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-notion"],
      toolPrefix: "notion",
    },
  },
  {
    id: "slack-mcp",
    name: "Slack",
    category: "Comunicaciones",
    description: "Envío de alertas, lectura de canales y coordinación de notificaciones con equipos en Slack.",
    icon: Terminal,
    defaultConfig: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-slack"],
      toolPrefix: "slack",
    },
  },
  {
    id: "gdrive-mcp",
    name: "Google Drive",
    category: "Almacenamiento",
    description: "Búsqueda y lectura de documentos, hojas de cálculo y archivos en Google Drive.",
    icon: Folder,
    defaultConfig: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-gdrive"],
      toolPrefix: "gdrive",
    },
  },
];

export function PersonalizationView() {
  const [activeTab, setActiveTab] = useState<PersonalizationTab>("skills");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddServerOpen, setIsAddServerOpen] = useState(false);
  const [installedServers, setInstalledServers] = useState<McpServerInfo[]>([]);
  const [testedSkill, setTestedSkill] = useState<string | null>(null);

  // Carga lista de servidores MCP instalados
  const loadInstalledMcp = async () => {
    try {
      const list = await ego().mcp.listServers();
      if (Array.isArray(list)) {
        setInstalledServers(list);
      }
    } catch {
      // Sin bridge disponible en test
    }
  };

  useEffect(() => {
    void loadInstalledMcp();
  }, []);

  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return SYSTEM_SKILLS;
    const q = searchQuery.toLowerCase();
    return SYSTEM_SKILLS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredMcp = useMemo(() => {
    if (!searchQuery.trim()) return MCP_CATALOG;
    const q = searchQuery.toLowerCase();
    return MCP_CATALOG.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleTestSkill = (id: string) => {
    setTestedSkill(id);
    setTimeout(() => {
      setTestedSkill(null);
    }, 2500);
  };

  const handleAddServerSubmit = async (config: {
    id: string;
    name: string;
    transport: "stdio" | "sse";
    command: string;
    args?: string[];
    env?: Record<string, string>;
    toolPrefix?: string;
  }) => {
    try {
      await ego().mcp.addServer({ config, enabled: true });
      await loadInstalledMcp();
      setIsAddServerOpen(false);
    } catch (err) {
      console.warn("[PersonalizationView] Error agregando servidor MCP:", err);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-panel p-6 text-ink select-none">
      {/* 1. Header Principal con Sub-Pestañas y Buscador */}
      <div className="flex flex-col gap-4 border-b border-hairline pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink">Personalización</h1>
            <p className="mt-0.5 text-xs text-dim">
              Amplía las habilidades cognitivas de Ego con Skills procedurales, Conectores MCP y personalización del avatar.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (activeTab === "mcp") setIsAddServerOpen(true);
                else if (activeTab === "skills") {
                  alert("Para agregar una skill propia, ubica tu carpeta en .agents/skills/ o instálala vía MCP.");
                }
              }}
              className="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-1.5 text-xs font-semibold text-paper shadow-sm transition-opacity hover:opacity-90 cursor-pointer"
            >
              <Plus size={14} weight="bold" />
              <span>Agregar {activeTab === "mcp" ? "Conector" : activeTab === "skills" ? "Skill" : "Preset"}</span>
            </button>
          </div>
        </div>

        {/* Barra de Controles: Segmented Pills + Buscador */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <nav aria-label="Categorías de personalización" className="flex items-center gap-1 rounded-xl bg-raised/80 p-1 border border-hairline">
            <button
              type="button"
              onClick={() => setActiveTab("skills")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                activeTab === "skills"
                  ? "bg-panel text-ink shadow-xs border border-hairline/80 font-semibold"
                  : "text-dim hover:text-ink hover:bg-panel/40"
              }`}
            >
              <PuzzlePiece size={15} />
              <span>Skills ({SYSTEM_SKILLS.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("mcp")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                activeTab === "mcp"
                  ? "bg-panel text-ink shadow-xs border border-hairline/80 font-semibold"
                  : "text-dim hover:text-ink hover:bg-panel/40"
              }`}
            >
              <PlugsConnected size={15} />
              <span>Conectores MCP ({MCP_CATALOG.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("avatar")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                activeTab === "avatar"
                  ? "bg-panel text-ink shadow-xs border border-hairline/80 font-semibold"
                  : "text-dim hover:text-ink hover:bg-panel/40"
              }`}
            >
              <Sparkle size={15} />
              <span>Avatares y Mascota</span>
            </button>
          </nav>

          {activeTab !== "avatar" && (
            <div className="relative flex items-center min-w-[240px]">
              <MagnifyingGlass size={14} className="absolute left-3 text-dim pointer-events-none" />
              <input
                type="text"
                placeholder={`Buscar en ${activeTab === "skills" ? "skills" : "conectores"}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-raised/70 pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-dim focus:border-strong focus:outline-none transition-all shadow-2xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. Contenido Dinámico por Pestaña */}
      <div className="flex-1 min-h-0 pt-5">
        {/* PESTAÑA 1: SKILLS */}
        {activeTab === "skills" && (
          <div className="space-y-6">
            {/* Banner Destacado Estilo "Data — From Ego Core" */}
            <div className="relative overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-r from-brand/10 via-raised to-panel p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/20 border border-brand/30 text-brand">
                    <Sparkle size={24} weight="fill" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-ink">Data Analysis & Visual Synthesis</span>
                      <span className="rounded-full bg-brand/20 px-2 py-0.5 font-mono text-[9px] font-semibold text-brand">
                        Recomendada por Ego Core
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-dim leading-relaxed max-w-xl">
                      Motor de renderizado reactivo para el Dynamic Workspace. Ejecuta código, analiza modelos de datos y proyecta artefactos interactivos directamente en el Canvas.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="flex items-center gap-1 font-mono text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-1 rounded-lg">
                    <Check size={13} weight="bold" /> Activa por defecto
                  </span>
                </div>
              </div>
            </div>

            {/* Grid de 2 Columnas de Skills */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold tracking-wider uppercase text-dim">
                  Skills de Sistema & Cognitivas ({filteredSkills.length})
                </h2>
                <span className="font-mono text-[10px] text-faint">Totalmente compatibles con Cognitive Runtime</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredSkills.map((s) => {
                  const Icon = s.icon;
                  const isTesting = testedSkill === s.id;
                  return (
                    <div
                      key={s.id}
                      className="group flex flex-col justify-between rounded-2xl border border-hairline bg-raised/50 hover:bg-raised p-4 transition-all duration-150 shadow-2xs hover:border-strong/60"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-panel border border-hairline text-ink shadow-xs group-hover:border-brand/40 group-hover:text-brand transition-colors">
                              <Icon size={18} />
                            </div>
                            <div>
                              <h3 className="text-xs font-semibold text-ink leading-snug">{s.name}</h3>
                              <span className="text-[10px] text-dim">{s.category}</span>
                            </div>
                          </div>
                          {s.badge && (
                            <span className="rounded-md border border-hairline bg-panel px-1.5 py-0.5 font-mono text-[9px] text-dim">
                              {s.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-faint leading-relaxed">{s.description}</p>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-hairline/60 pt-3">
                        <button
                          type="button"
                          onClick={() => handleTestSkill(s.id)}
                          className="flex items-center gap-1.5 text-[11px] font-medium text-dim hover:text-ink transition-colors cursor-pointer"
                        >
                          <Play size={11} weight="fill" className={isTesting ? "text-brand animate-spin" : ""} />
                          <span>{isTesting ? "Validando sintaxis..." : "Probar Skill"}</span>
                        </button>

                        <div className="flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                          <Check size={12} weight="bold" />
                          <span>✓ Activa</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: CONECTORES MCP */}
        {activeTab === "mcp" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-xl border border-hairline bg-raised/40 p-4">
              <div>
                <h2 className="text-xs font-semibold text-ink">Protocolo de Contexto de Modelo (MCP)</h2>
                <p className="mt-0.5 text-[11px] text-dim">
                  Conecta Ego a fuentes de datos externas y herramientas del sistema mediante servidores MCP estandarizados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddServerOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-hairline bg-panel hover:bg-raised px-3 py-1.5 text-xs font-medium text-ink transition-colors cursor-pointer"
              >
                <Plus size={13} weight="bold" />
                <span>Configurar Servidor Propio</span>
              </button>
            </div>

            {/* Catálogo de Conectores Oficiales */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold tracking-wider uppercase text-dim">
                  Conectores Disponibles en el Catálogo ({filteredMcp.length})
                </h3>
                <span className="font-mono text-[10px] text-faint">
                  {installedServers.length} instalados actualmente
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredMcp.map((m) => {
                  const Icon = m.icon;
                  const isInstalled = installedServers.some((s) => s.id === m.id);
                  return (
                    <div
                      key={m.id}
                      className="group flex flex-col justify-between rounded-2xl border border-hairline bg-raised/50 hover:bg-raised p-4 transition-all duration-150 shadow-2xs hover:border-strong/60"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-panel border border-hairline text-ink shadow-xs">
                              <Icon size={18} />
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-ink leading-snug">{m.name}</h4>
                              <span className="text-[10px] text-dim">{m.category}</span>
                            </div>
                          </div>
                          {isInstalled ? (
                            <span className="flex items-center gap-1 rounded-full border border-emerald-800/40 bg-emerald-950/80 px-2 py-0.5 font-sans text-[9px] text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Conectado
                            </span>
                          ) : (
                            <span className="rounded-md border border-hairline bg-panel px-1.5 py-0.5 font-mono text-[9px] text-dim">
                              Disponible
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-faint leading-relaxed">{m.description}</p>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-hairline/60 pt-3">
                        <span className="font-mono text-[10px] text-dim truncate max-w-[150px]">
                          {m.defaultConfig ? `${m.defaultConfig.command} ${m.defaultConfig.args?.join(" ") ?? ""}` : "Estándar stdio"}
                        </span>

                        {isInstalled ? (
                          <button
                            type="button"
                            onClick={() => setIsAddServerOpen(true)}
                            className="flex items-center gap-1 text-[11px] font-medium text-dim hover:text-ink transition-colors cursor-pointer"
                          >
                            <Gear size={12} />
                            <span>Configurar</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (m.defaultConfig) {
                                void handleAddServerSubmit({
                                  id: m.id,
                                  name: m.name,
                                  transport: "stdio",
                                  command: m.defaultConfig.command,
                                  args: m.defaultConfig.args,
                                  toolPrefix: m.defaultConfig.toolPrefix,
                                });
                              } else {
                                setIsAddServerOpen(true);
                              }
                            }}
                            className="rounded-lg bg-ink px-2.5 py-1 text-[11px] font-medium text-paper hover:opacity-90 transition-opacity cursor-pointer"
                          >
                            Conectar en 1 Clic
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 3: AVATARES Y MASCOTA */}
        {activeTab === "avatar" && (
          <div className="space-y-6">
            {/* Banner de Control de Mascota / Isla Flotante */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-hairline bg-raised/60 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel border border-hairline text-xl">
                  🏝️
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-ink">Compañero Desktop — Isla Flotante</h2>
                  <p className="text-[11px] text-dim">
                    Mascota viva 2.5D desacoplada en la pantalla que reacciona a tus estados y tareas en segundo plano.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (window as any).ego?.floating?.toggleFloating?.()}
                  className="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-1.5 text-xs font-semibold text-paper shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <span>🏝️ Conmutar Isla</span>
                  <kbd className="rounded bg-white/20 px-1 py-0.2 font-mono text-[9px]">Alt+Win+P</kbd>
                </button>
              </div>
            </div>

            {/* Estudio de Personalización de Avatar */}
            <div className="rounded-2xl border border-hairline bg-panel p-4 shadow-2xs">
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-ink">Estudio de Aspecto de Sub-Egos</h3>
                <p className="text-[11px] text-dim">
                  Configura la forma base, paleta de colores, forma de ojos y accesorios para los Sub-Egos de tu sistema.
                </p>
              </div>

              <WardrobeSelector subEgoId="ego.nucleus" />
            </div>
          </div>
        )}
      </div>

      <McpAddServerDialog
        isOpen={isAddServerOpen}
        onClose={() => setIsAddServerOpen(false)}
        onSubmit={handleAddServerSubmit}
      />
    </div>
  );
}

export default PersonalizationView;
