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
  Island,
} from "@phosphor-icons/react";
import { ego, type McpServerInfo } from "../../lib/ego.js";
import { McpAddServerDialog } from "../mcp/McpAddServerDialog.js";
import { WardrobeSelector } from "../character/wardrobe/WardrobeSelector.js";
import { Button } from "../ui-kit/Button.js";
import { Input } from "../ui-kit/Input.js";
import { Badge } from "../ui-kit/Badge.js";

/**
 * El puente `window.ego` tipado (`EgoBridge`) todavía no expone el canal
 * `floating`; se accede con un tipo estructural mínimo en lugar de `any`
 * (la regla del repo prohíbe `any`). Mismo patrón que `src/App.tsx`.
 */
interface FloatingChannel {
  toggleFloating?: () => void;
}

function toggleFloatingCompanion(): void {
  const floating = (window.ego as unknown as { floating?: FloatingChannel }).floating;
  floating?.toggleFloating?.();
}

/**
 * Cáscara canónica de tarjeta (misma que el Canvas y las vistas de dominio):
 * superficie `bg-panel`, borde hairline, radio del sistema y elevación L1.
 */
const CARD =
  "rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)]";

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
    <div className="flex h-full w-full flex-col overflow-y-auto bg-paper p-6 text-ink select-none">
      {/* 1. Header Principal con Sub-Pestañas y Buscador */}
      <div className="flex flex-col gap-4 border-b border-hairline pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-ink">Personalización</h1>
            <p className="mt-0.5 text-xs text-dim">
              Amplía las habilidades cognitivas de Ego con Skills procedurales, Conectores MCP y personalización del avatar.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* D10: el CTA no puede partir su etiqueta. El `Button` del kit
                envuelve los hijos en un `<span class="inline-flex min-w-0">`
                que SÍ encoge: sin `whitespace-nowrap` la etiqueta se partía
                en dos líneas dentro de un botón de 32 px con
                `overflow-hidden` ("Agregar Preset" → "Prese|t"). El icono
                va por la prop `icon` (hermano del `<span>`, no dentro), y
                `shrink-0` impide que el flex padre lo estruje. */}
            <Button
              size="md"
              variant="primary"
              icon={<Plus size={14} weight="bold" />}
              onClick={() => {
                if (activeTab === "mcp") setIsAddServerOpen(true);
                else if (activeTab === "skills") {
                  alert("Para agregar una skill propia, ubica tu carpeta en .agents/skills/ o instálala vía MCP.");
                }
              }}
              className="shrink-0 whitespace-nowrap"
            >
              Agregar {activeTab === "mcp" ? "Conector" : activeTab === "skills" ? "Skill" : "Preset"}
            </Button>
          </div>
        </div>

        {/* Barra de Controles: Segmented Pills + Buscador */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <nav aria-label="Categorías de personalización" className="flex items-center gap-1 rounded-[var(--radius-card)] bg-panel p-1 border border-hairline">
            <Button
              size="md"
              variant={activeTab === "skills" ? "secondary" : "ghost"}
              icon={<PuzzlePiece size={15} />}
              onClick={() => setActiveTab("skills")}
              aria-pressed={activeTab === "skills"}
              className="whitespace-nowrap"
            >
              Skills ({SYSTEM_SKILLS.length})
            </Button>

            <Button
              size="md"
              variant={activeTab === "mcp" ? "secondary" : "ghost"}
              icon={<PlugsConnected size={15} />}
              onClick={() => setActiveTab("mcp")}
              aria-pressed={activeTab === "mcp"}
              className="whitespace-nowrap"
            >
              Conectores MCP ({MCP_CATALOG.length})
            </Button>

            <Button
              size="md"
              variant={activeTab === "avatar" ? "secondary" : "ghost"}
              icon={<Sparkle size={15} />}
              onClick={() => setActiveTab("avatar")}
              aria-pressed={activeTab === "avatar"}
              className="whitespace-nowrap"
            >
              Avatares y Mascota
            </Button>
          </nav>

          {activeTab !== "avatar" && (
            <div className="relative flex items-center min-w-[240px]">
              <MagnifyingGlass
                size={14}
                className="absolute left-2.5 top-2.5 text-dim pointer-events-none"
                aria-hidden
              />
              <Input
                type="text"
                placeholder={`Buscar en ${activeTab === "skills" ? "skills" : "conectores"}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
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
            <div className={`${CARD} border-brand/40 p-5`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-brand/20 border border-brand/30 text-brand">
                    <Sparkle size={24} weight="fill" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-ink">Data Analysis & Visual Synthesis</span>
                      <Badge tone="warn">Recomendada por Ego Core</Badge>
                    </div>
                    <p className="mt-1 text-xs text-dim leading-relaxed max-w-xl">
                      Motor de renderizado reactivo para el Dynamic Workspace. Ejecuta código, analiza modelos de datos y proyecta artefactos interactivos directamente en el Canvas.
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {/* D3: los pills de estado son `Badge` del kit, no
                      `<span>` mauales: así comparten radio, tipografía y
                      los 9 estados con el resto de la app. */}
                  <Badge tone="ok">
                    <Check size={12} weight="bold" />
                    Activa por defecto
                  </Badge>
                </div>
              </div>
            </div>

            {/* Grid de 2 Columnas de Skills */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-dim">
                  Skills de Sistema & Cognitivas ({filteredSkills.length})
                </h3>
                <span className="font-mono text-xs text-faint">Totalmente compatibles con Cognitive Runtime</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredSkills.map((s) => {
                  const Icon = s.icon;
                  const isTesting = testedSkill === s.id;
                  return (
                    <div
                      key={s.id}
                      className={`${CARD} group flex flex-col justify-between bg-raised hover:bg-raised transition-colors duration-150 hover:border-strong`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-card)] bg-panel border border-hairline text-ink shadow-[var(--ego-elevation-l1)] group-hover:border-brand/40 group-hover:text-brand transition-colors">
                              <Icon size={18} />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-ink leading-snug">{s.name}</h4>
                              <span className="text-xs text-dim">{s.category}</span>
                            </div>
                          </div>
                          {s.badge && <Badge tone="info">{s.badge}</Badge>}
                        </div>
                        <p className="text-xs text-faint leading-relaxed">{s.description}</p>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-hairline pt-3">
                        <Button
                          size="md"
                          variant="ghost"
                          icon={
                            <Play
                              size={12}
                              weight="fill"
                              className={isTesting ? "animate-spin text-brand" : ""}
                            />
                          }
                          onClick={() => handleTestSkill(s.id)}
                          className="whitespace-nowrap"
                        >
                          {isTesting ? "Validando sintaxis..." : "Probar Skill"}
                        </Button>

                        {/* D3: el "✓ Activa" era un glifo de texto dentro de
                            un div (tipografía y radio propios). Ahora es un
                            `Badge` del kit con icono Phosphor. */}
                        <Badge tone="ok" className="shrink-0">
                          <Check size={12} weight="bold" />
                          Activa
                        </Badge>
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
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-hairline bg-raised p-4">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-ink">Protocolo de Contexto de Modelo (MCP)</h3>
                <p className="mt-0.5 text-xs text-dim">
                  Conecta Ego a fuentes de datos externas y herramientas del sistema mediante servidores MCP estandarizados.
                </p>
              </div>
              <Button
                size="md"
                variant="secondary"
                icon={<Plus size={13} weight="bold" />}
                onClick={() => setIsAddServerOpen(true)}
                className="shrink-0 whitespace-nowrap"
              >
                Configurar Servidor Propio
              </Button>
            </div>

            {/* Catálogo de Conectores Oficiales */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-dim">
                  Conectores Disponibles en el Catálogo ({filteredMcp.length})
                </h3>
                <span className="font-mono text-xs text-faint">
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
                      className={`${CARD} group flex flex-col justify-between bg-raised hover:bg-raised transition-colors duration-150 hover:border-strong`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-card)] bg-panel border border-hairline text-ink">
                              <Icon size={18} />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-ink leading-snug">{m.name}</h4>
                              <span className="text-xs text-dim">{m.category}</span>
                            </div>
                          </div>
                          {isInstalled ? (
                            <Badge tone="ok">
                              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                              Conectado
                            </Badge>
                          ) : (
                            <Badge tone="dim">Disponible</Badge>
                          )}
                        </div>
                        <p className="text-xs text-faint leading-relaxed">{m.description}</p>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3">
                        <span className="font-mono text-xs text-dim truncate max-w-[150px]">
                          {m.defaultConfig ? `${m.defaultConfig.command} ${m.defaultConfig.args?.join(" ") ?? ""}` : "Estándar stdio"}
                        </span>

                        {isInstalled ? (
                          <Button
                            size="md"
                            variant="ghost"
                            icon={<Gear size={12} />}
                            onClick={() => setIsAddServerOpen(true)}
                            className="shrink-0 whitespace-nowrap"
                          >
                            Configurar
                          </Button>
                        ) : (
                          <Button
                            size="md"
                            variant="primary"
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
                            className="shrink-0 whitespace-nowrap"
                          >
                            Conectar en 1 Clic
                          </Button>
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-[var(--radius-card)] border border-hairline bg-raised p-4">
              <div className="flex min-w-0 items-center gap-3">
                {/* D18: el emoji 🏝️ se pintaba como "caja negra" (tofu) en
                    el tema dark-only y rompía la escala tipográfica. Ahora
                    es un icono Phosphor (`Island`). */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-panel border border-hairline text-brand">
                  <Island size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-ink">Compañero Desktop — Isla Flotante</h3>
                  <p className="text-xs text-dim">
                    Mascota viva 2.5D desacoplada en la pantalla que reacciona a tus estados y tareas en segundo plano.
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* D10: el botón llevaba el emoji DENTRO de la etiqueta y el
                    `<kbd>` también dentro del `<span>` interno del kit, así
                    que el contenido medía 48 px de alto dentro de un botón
                    de 32 px con `overflow-hidden`: "Conmutar" / "Isla" y la
                    mitad inferior recortada. Ahora el icono va por la prop
                    `icon`, la etiqueta no se parte (`whitespace-nowrap`) y
                    el atajo de teclado sale del botón: un `<kbd>` dentro
                    de un `<button>` es ruido para el lector de pantalla. */}
                <Button
                  size="md"
                  variant="primary"
                  icon={<Island size={14} />}
                  onClick={toggleFloatingCompanion}
                  className="shrink-0 whitespace-nowrap"
                >
                  Conmutar Isla
                </Button>
                <kbd className="rounded-md border border-hairline bg-panel px-1.5 py-0.5 font-mono text-xs text-dim">
                  Alt+Win+P
                </kbd>
              </div>
            </div>

            {/* Estudio de Personalización de Avatar */}
            <div className={CARD}>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-ink">Estudio de Aspecto de Sub-Egos</h3>
                <p className="text-xs text-dim">
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
