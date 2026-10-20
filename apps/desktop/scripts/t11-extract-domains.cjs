/**
 * T4 (VERDICT R3) — extrae las 5 vistas de dominio de `DomainCanvasView.tsx`
 * a `views.tsx`, como componentes autosuficientes, y deja el componente
 * padre resolviendo por `componentKind` contra el registry dinámico.
 *
 * El JSX de cada vista se mueve VERBATIM: cada vista pasa a declarar su
 * propio estado y su propio cargador, de modo que los identificadores que
 * el JSX ya usaba siguen existiendo con el MISMO nombre.
 */
const fs = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "..", "renderer", "components", "domains");
const SRC = path.join(DIR, "DomainCanvasView.tsx");
const L = fs.readFileSync(SRC, "utf8").split(/\r?\n/);

const TAGS = ["engineering", "product", "knowledge", "analytics", "crm"];

/**
 * Cuerpo del cargador por dominio.
 *
 * La cadena `if/else if` comparte llaves: se parte el texto por los
 * marcadores `} else if (domainId === "X") {` en vez de por conteo de llaves.
 */
function loaderBodies() {
  const start = L.findIndex(
    (l) => l.trim() === 'if (domainId === "engineering") {'
  );
  if (start < 0) throw new Error("no se encontró el inicio de la cadena de carga");
  // Fin de la cadena: la `}` que cierra el último `else if` (antes del `catch`).
  let end = -1;
  for (let i = start + 1; i < L.length; i++) {
    if (L[i].trim() === "} catch (err) {") {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("no se encontró el fin de la cadena de carga");
  // La última línea de la cadena es la `}` que cierra el `else if` final.
  const chain = L.slice(start, end);
  // Elimina la `}` final de la cadena (la del `} catch`).
  const lastBrace = chain.length - 1;
  if (chain[lastBrace].trim() !== "}") {
    throw new Error(`se esperaba '}' al final de la cadena, hay: ${chain[lastBrace]}`);
  }
  chain.pop();

  const marks = [];
  chain.forEach((l, i) => {
    const m = l.match(/^\s*\}?\s*else if \(domainId === "(\w+)"\) \{$/);
    if (m) marks.push({ tag: m[1], line: i });
  });
  const out = {};
  // La primera rama es `if (domainId === "engineering") {` (no es `else if`).
  const firstTag = chain[0].match(/domainId === "(\w+)"/)?.[1];
  if (!firstTag) throw new Error("no se pudo deducir la primera rama");
  out[firstTag] = chain.slice(1, marks[0].line);
  for (let k = 0; k < marks.length; k++) {
    const from = marks[k].line + 1;
    const to = k + 1 < marks.length ? marks[k + 1].line : chain.length;
    out[marks[k].tag] = chain.slice(from, to);
  }
  return out;
}

/** Cuerpo del JSX: sin `{domainId === "x" && (` ni el `)}` final. */
function jsxBody(tag) {
  const s = L.findIndex((l) => l.includes(`domainId === "${tag}" && (`));
  let depth = 0;
  let e = -1;
  for (let i = s; i < L.length; i++) {
    for (const ch of L[i]) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    if (i > s && depth === 0) {
      e = i;
      break;
    }
  }
  return { start: s, end: e, body: L.slice(s + 1, e) };
}

const SPEC = {
  engineering: {
    componentKind: "engineering_status",
    title: "Vista de Ingeniería (DOM-01)",
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
    handlers: "",
  },
  product: {
    componentKind: "product_backlog",
    title: "Vista de Producto (DOM-02)",
    state: `  const [productData, setProductData] = useState<{
    items: ProductListItem[];
    epics: ProductEpicItem[];
  }>({ items: [], epics: [] });

  const [showProductForm, setShowProductForm] = useState(false);
  const [newProductTitle, setNewProductTitle] = useState("");
  const [newProductPriority, setNewProductPriority] = useState("high");
  const [newProductStatus, setNewProductStatus] = useState("backlog");`,
    handlers: "handleCreateProductItem",
  },
  knowledge: {
    componentKind: "knowledge_facts",
    title: "Vista de Conocimiento (DOM-03)",
    state: `  const [knowledgeData, setKnowledgeData] = useState<KnowledgeFact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  // T08: debounce 300ms — antes refetch por tecla (deps \`[domainId, searchQuery]\`).
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const [graphNodes, setGraphNodes] = useState<Array<{ id: string; label: string; type: string }>>([]);
  const [graphEdges, setGraphEdges] = useState<Array<{ source: string; target: string; relation: string }>>([]);
  const [quarantineItems, setQuarantineItems] = useState<Array<{ key: string; notice: string; kind: string }>>([]);

  const [showIngestForm, setShowIngestForm] = useState(false);
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestType, setIngestType] = useState<"markdown" | "text" | "code">("markdown");
  const [ingestContent, setIngestContent] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestMessage, setIngestMessage] = useState<string | null>(null);`,
    handlers: "handleIngest",
  },
  analytics: {
    componentKind: "analytics_telemetry",
    title: "Vista de Analítica (DOM-04)",
    state: `  const [analyticsData, setAnalyticsData] = useState<{
    series: Array<Record<string, unknown>>;
    modelDistribution: Array<Record<string, unknown>>;
  }>({ series: [], modelDistribution: [] });`,
    handlers: "",
  },
  crm: {
    componentKind: "crm_pipeline",
    title: "Vista de CRM (DOM-05)",
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
    handlers: "handleUpdateDealStage",
  },
};

const LOADERS = loaderBodies();

fs.writeFileSync(
  path.join(__dirname, "t11-domains.json"),
  JSON.stringify(
    Object.fromEntries(
      TAGS.map((t) => [
        t,
        {
          kind: SPEC[t].componentKind,
          loader: LOADERS[t],
          jsx: jsxBody(t).body,
        },
      ])
    ),
    null,
    2
  ),
  "utf8"
);
console.log("t11-domains.json escrito");
for (const t of TAGS) {
  console.log(
    `${t}: loader ${LOADERS[t].length} líneas, jsx ${jsxBody(t).body.length} líneas`
  );
}
