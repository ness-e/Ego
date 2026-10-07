// Puente renderer→main. En Electron real usa window.ego (preload);
// fuera de Electron (dev browser) usa mocks ricos para no romper el render.

export interface SubEgoSummary {
  id: string;
  name: string;
  role: string;
  description: string;
  state: "active" | "paused" | "archived";
}

export interface RecallBadgeInfo {
  count: number;
  glyph: string;
  sources: string[];
  tokensEstimate: number;
}

export interface EgoBridge {
  memory: (op: string, args: unknown[]) => Promise<unknown>;
  llmStream: (req: { prompt: string; sessionId?: string; systemPrompt?: string }) => Promise<{
    ok: boolean;
    turnId: string;
    text: string;
    recallStatus: RecallBadgeInfo;
    usage?: unknown;
  }>;
  approve: (req: { actionId: string; confirmed: boolean; notes?: string }) => Promise<unknown>;
  snapshots: () => Promise<unknown>;
  listSubEgos: () => Promise<SubEgoSummary[]>;
  createSubEgo: (req: { name: string; role: string; instructions: string; tools?: string[] }) => Promise<SubEgoSummary>;
  onChatDelta?: (callback: (chunk: { type: string; delta?: string }) => void) => () => void;
  onRecallStatus?: (callback: (status: RecallBadgeInfo) => void) => () => void;
}

const mockSubEgos: SubEgoSummary[] = [
  {
    id: "ego.copywriter",
    name: "Ego Copywriter",
    role: "Redactor B2B",
    description: "Genera propuestas y correos de prospección alineados al tono de marca.",
    state: "active",
  },
  {
    id: "ego.code-reviewer",
    name: "Ego Code Reviewer",
    role: "Auditor Técnico",
    description: "Inspecciona cambios y revisa cumplimiento de estándares de arquitectura.",
    state: "active",
  },
];

const mock: EgoBridge = {
  memory: async (op: string, args: unknown[]) => {
    if (op === "searchMulti" || op === "recall") {
      return [
        {
          score: 0.94,
          record: {
            namespace: "kb/docs",
            key: "tarifa-base-2026",
            payload: JSON.stringify({
              titulo: "Límite de tarifas y política de precios 2026",
              contenido: "El límite de tarifa base para servicios de consultoría se fijó en $150 USD/hora con aprobación requerida para descuentos >15%.",
              estado: "aprobado",
            }),
          },
        },
      ];
    }
    return { ok: true, mock: true, op, args };
  },
  llmStream: async (req) => ({
    ok: true,
    turnId: `mock_turn_${Date.now()}`,
    text: `[Respuesta Mock Local]: Procesada instrucción "${req.prompt.slice(0, 40)}..."`,
    recallStatus: {
      count: 2,
      glyph: "🧠",
      sources: ["kb/docs", "kb/facts"],
      tokensEstimate: 140,
    },
  }),
  approve: async (args) => ({ ok: true, mock: true, args }),
  snapshots: async () => ({ ok: true, mock: true, missing: [] }),
  listSubEgos: async () => mockSubEgos,
  createSubEgo: async (req) => {
    const nuevo: SubEgoSummary = {
      id: `ego.${req.name.toLowerCase().replace(/\s+/g, "-")}`,
      name: req.name,
      role: req.role,
      description: req.instructions,
      state: "active",
    };
    mockSubEgos.push(nuevo);
    return nuevo;
  },
};

export function ego(): EgoBridge {
  if (typeof window !== "undefined" && (window as unknown as { ego?: EgoBridge }).ego) {
    const rawEgo = (window as unknown as { ego: EgoBridge }).ego;
    return {
      ...rawEgo,
      memory: (op, args) => rawEgo.memory(op as unknown as string, args),
    };
  }
  return mock;
}
