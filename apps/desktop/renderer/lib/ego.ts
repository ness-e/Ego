// Puente renderer→main. En Electron real usa window.ego (preload);
// fuera de Electron (dev browser) usa mocks ricos para no romper el render.

export interface SubEgoSummary {
  id: string;
  name: string;
  role: string;
  description: string;
  state: "active" | "paused" | "archived";
}

export interface EgoBridge {
  memory: (op: string, args: unknown[]) => Promise<unknown>;
  llmStream: (args: unknown) => Promise<unknown>;
  approve: (args: unknown) => Promise<unknown>;
  snapshots: () => Promise<unknown>;
  listSubEgos: () => Promise<SubEgoSummary[]>;
  createSubEgo: (req: { name: string; role: string; instructions: string }) => Promise<SubEgoSummary>;
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
  llmStream: async () => ({ ok: true, mock: true }),
  approve: async (args: unknown) => ({ ok: true, mock: true, args }),
  snapshots: async () => ({ ok: true, mock: true, missing: [] }),
  listSubEgos: async () => mockSubEgos,
  createSubEgo: async (req) => {
    const created: SubEgoSummary = {
      id: `ego.${req.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: req.name,
      role: req.role,
      description: req.instructions,
      state: "active",
    };
    mockSubEgos.push(created);
    return created;
  },
};

export function ego(): EgoBridge {
  if (typeof window !== "undefined" && (window as unknown as { ego?: EgoBridge }).ego) {
    return (window as unknown as { ego: EgoBridge }).ego;
  }
  return mock;
}
