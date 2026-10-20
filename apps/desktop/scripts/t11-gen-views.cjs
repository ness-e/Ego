/**
 * Genera `components/domains/views.tsx` con las 5 vistas de dominio
 * extraídas de `DomainCanvasView.tsx` (T4 / VERDICT R3).
 */
const fs = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "..", "renderer", "components", "domains");
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "t11-domains.json"), "utf8")
);
const parent = fs.readFileSync(path.join(DIR, "DomainCanvasView.tsx"), "utf8");

/** Dedenta un bloque `n` espacios. */
function dedent(lines, n) {
  return lines.map((l) => {
    if (!l.trim()) return "";
    const m = l.match(/^(\s*)/);
    const strip = Math.min(n, (m ? m[1].length : 0));
    return l.slice(strip);
  });
}

const SPEC = {
  engineering: {
    kind: "engineering_status",
    name: "EngineeringStatusView",
    deps: "[]",
    state: `  const [engData, setEngData] = useState<{
    // T12: null = aún sin dato real del backend (nunca rama supuesta).
    branch: string | null;
    clean: boolean;
    staged: string[];
    unstaged: string[];
    worktrees: WorktreeStatusItem[];
  }>({
    branch: null,
    clean: true,
    staged: [],
    unstaged: [],
    worktrees: [],
  });`,
    handlers: [],
  },
  product: {
    kind: "product_backlog",
    name: "ProductBacklogView",
    deps: "[]",
    state: `  const [productData, setProductData] = useState<{
    items: ProductListItem[];
    epics: ProductEpicItem[];
  }>({ items: [], epics: [] });

  const [showProductForm, setShowProductForm] = useState(false);
  const [newProductTitle, setNewProductTitle] = useState("");
  const [newProductPriority, setNewProductPriority] = useState("high");
  const [newProductStatus, setNewProductStatus] = useState("backlog");`,
    handlers: ["handleCreateProductItem"],
  },
  knowledge: {
    kind: "knowledge_facts",
    name: "KnowledgeFactsView",
    deps: "[debouncedQuery]",
    state: `  const [knowledgeData, setKnowledgeData] = useState<KnowledgeFact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  // T08: debounce 300ms — antes refetch por tecla.
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const [graphNodes, setGraphNodes] = useState<Array<{ id: string; label: string; type: string }>>([]);
  const [graphEdges, setGraphEdges] = useState<Array<{ source: string; target: string; relation: string }>>([]);
  const [quarantineItems, setQuarantineItems] = useState<Array<{ key: string; notice: string; kind: string }>>([]);
  // T12: el canal graphRag existe en el bridge → el bloque se conserva;
  // si algún día falta, se oculta en vez de mostrar un placeholder falso.
  const graphRagAvailable = typeof bridge.knowledge?.graphRag === "function";

  const [showIngestForm, setShowIngestForm] = useState(false);
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestType, setIngestType] = useState<"markdown" | "text" | "code">("markdown");
  const [ingestContent, setIngestContent] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestMessage, setIngestMessage] = useState<string | null>(null);`,
    handlers: ["handleIngest"],
  },
  analytics: {
    kind: "analytics_telemetry",
    name: "AnalyticsTelemetryView",
    deps: "[]",
    state: `  const [analyticsData, setAnalyticsData] = useState<{
    series: Array<Record<string, unknown>>;
    modelDistribution: Array<Record<string, unknown>>;
  }>({ series: [], modelDistribution: [] });`,
    handlers: [],
  },
  crm: {
    kind: "crm_pipeline",
    name: "CrmPipelineView",
    deps: "[]",
    state: `  const [crmData, setCrmData] = useState<{
    deals: CrmDealItem[];
    contacts: Array<Record<string, unknown>>;
    summary: CrmSummary;
  }>({
    deals: [],
    contacts: [],
    summary: { totalPipelineUsd: 0, weightedPipelineUsd: 0, dealsCount: 0 },
  });

  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);`,
    handlers: ["handleUpdateDealStage"],
  },
};

/**
 * Extrae del ORIGINAL (git HEAD) el cuerpo de un handler por nombre: tras
 * la refactorización el padre ya no los contiene.
 */
function handlerBody(name) {
  const { execSync } = require("node:child_process");
  const original = execSync(
    "git show HEAD:apps/desktop/renderer/components/domains/DomainCanvasView.tsx",
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
  );
  const lines = original.split(/\r?\n/);
  const start = lines.findIndex((l) => l.includes(`const ${name} =`));
  if (start < 0) throw new Error(`no se encontró el handler ${name}`);
  let depth = 0;
  let end = start;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    if (i > start && depth === 0) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end + 1);
}

const parts = [];
for (const [tag, spec] of Object.entries(SPEC)) {
  const d = data[tag];
  const loader = dedent(d.loader, 4);
  const jsx = dedent(d.jsx, 4);
  const handlers = spec.handlers.flatMap((h) => [
    "",
    ...dedent(handlerBody(h), 2),
  ]);
  parts.push(
    `/**
 * T4 (VERDICT R3) — Vista de ${tag} (componentKind \`${spec.kind}\`).
 *
 * Componente autosuficiente: declara su propio estado, carga sus propios
 * datos del bridge y renderiza su vista. El padre
 * (\`DomainCanvasView\`) ya NO tiene ramas por \`domainId\`: resuelve el
 * componente por \`componentKind\` contra el registry dinámico.
 */
export function ${spec.name}() {
  const [loading, setLoading] = useState(true);
  const [uiError, setUiError] = useState<string | null>(null);
  const bridge = ego();

${spec.state}

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setUiError(null);

    const loadDomainData = async () => {
      try {
${loader.map((l) => "        " + l).join("\n")}
      } catch (err) {
        console.error("Error al cargar datos del dominio:", err);
        if (mounted) setUiError("Error al cargar datos del dominio desde el backend.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadDomainData();

    return () => {
      mounted = false;
    };
  }, ${spec.deps});
${handlers.join("\n")}

  return (
    <div className="space-y-4">
      {loading && (
        <div className="text-[10px] text-dim font-mono animate-pulse">
          Sincronizando estado de ${tag}...
        </div>
      )}
      {uiError && (
        <div role="alert" className="text-[11px] font-mono text-rose-300 border border-rose-500/30 bg-rose-950/30 rounded-lg px-3 py-2">
          {uiError} — sin datos inventados como sustituto.
        </div>
      )}
${jsx.map((l) => "      " + l).join("\n")}
    </div>
  );
}`
  );
}

fs.writeFileSync(
  path.join(DIR, "views.tsx"),
  `/**
 * T4 (VERDICT R3) — Vistas de dominio como componentes de registry.
 *
 * Antes, \`DomainCanvasView.tsx\` tenía 10 ramas \`domainId === "…"\`: 5 para
 * cargar datos y 5 para renderizar. Añadir un dominio obligaba a tocar el
 * componente en 10 sitios, y \`componentKind\` era metadato muerto.
 *
 * Ahora cada dominio es un componente **autosuficiente** (estado + carga +
 * vista) registrado en el registry dinámico bajo su \`componentKind\`. El
 * padre resuelve el componente por \`componentKind\`: sin ramas.
 */
import React, { useEffect, useState, Suspense } from "react";
import {
  Code,
  Kanban,
  BookOpen,
  ChartBar,
  Users,
  GitBranch,
  ShieldCheck,
  CheckCircle,
  Plus,
  MagnifyingGlass,
  ArrowRight,
  CurrencyDollar,
} from "@phosphor-icons/react";
import { ego } from "../../lib/ego.js";
import { SmartList } from "../SmartList.js";
import { Select } from "../ui-kit/Select.js";

// T08: recharts (~384KB) fuera del arranque — lazy tras la primera pintura.
const LazyTelemetryChart = React.lazy(() =>
  import("./DomainCharts.js").then((m) => ({ default: m.TelemetryChart }))
);

function ChartFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center font-mono text-[11px] text-dim">
      Cargando telemetría…
    </div>
  );
}
import {
  flatMapValid,
  isRecord,
  toCrmDeal,
  toCrmSummary,
  toEpicItem,
  toKnowledgeFact,
  toProductItem,
  toWorktreeItem,
  type WorktreeStatusItem,
  type ProductListItem,
  type ProductEpicItem,
  type KnowledgeFact,
  type CrmDealItem,
  type CrmSummary,
} from "./types.js";

${parts.join("\n\n")}

/**
 * \`componentKind\` de cada dominio canónico. Es la ÚNICA tabla que
 * relaciona un dominio con su componente: el resto se resuelve por
 * \`componentKind\` contra el registry.
 */
export const DOMAIN_COMPONENT_KINDS: Readonly<Record<string, string>> = Object.freeze({
  engineering: "${SPEC.engineering.kind}",
  product: "${SPEC.product.kind}",
  knowledge: "${SPEC.knowledge.kind}",
  analytics: "${SPEC.analytics.kind}",
  crm: "${SPEC.crm.kind}",
});
`,
  "utf8"
);
console.log("views.tsx escrito");
