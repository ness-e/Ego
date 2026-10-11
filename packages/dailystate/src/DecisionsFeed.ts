import * as crypto from "node:crypto";
import type { EgoMemoryAdapter } from "@ego/memory";
import type { EventBus } from "@ego/events";
import { RecentDecision, RecentDecisionSchema } from "./types.js";

export interface DecisionQueryOptions {
  limit?: number;
  since?: number;
  subEgoId?: string;
}

export class DecisionsFeed {
  private memory: EgoMemoryAdapter;
  private eventBus?: EventBus;
  public static readonly NAMESPACE = "gov/audit";

  constructor(memory: EgoMemoryAdapter, options?: { eventBus?: EventBus }) {
    this.memory = memory;
    this.eventBus = options?.eventBus;
  }

  /**
   * Obtiene el feed cronológico de decisiones acordadas (DS-03 / COUC-09)
   */
  async getDecisions(options?: DecisionQueryOptions): Promise<RecentDecision[]> {
    const limit = options?.limit ?? 20;
    const since = options?.since ?? 0;
    const subEgoFilter = options?.subEgoId;

    const records = await this.memory.list(DecisionsFeed.NAMESPACE, limit * 2);
    const decisions: RecentDecision[] = [];

    for (const rec of records) {
      const payload = (rec.payload || {}) as Record<string, unknown>;
      const metadata = (rec.metadata || {}) as Record<string, unknown>;

      const id = String(payload.id || rec.key);
      const title = String(
        payload.title || payload.action || payload.summary || `Decisión ${id}`
      );
      const timestamp =
        typeof payload.timestamp === "number"
          ? payload.timestamp
          : typeof metadata.ts === "number"
          ? metadata.ts
          : Date.now();
      let subEgoId = "ego.nucleus";
      if (typeof payload.subEgoId === "string" && payload.subEgoId.trim()) {
        subEgoId = payload.subEgoId;
      } else if (payload.subEgoId && typeof payload.subEgoId === "object") {
        const s = payload.subEgoId as Record<string, unknown>;
        if (typeof s.id === "string") subEgoId = s.id;
        else if (typeof s.String === "string") subEgoId = s.String;
      } else if (typeof payload.actor === "string" && payload.actor.trim()) {
        subEgoId = payload.actor;
      } else if (typeof metadata.agent_id === "string" && metadata.agent_id.trim()) {
        subEgoId = metadata.agent_id;
      } else if (metadata.agent_id && typeof metadata.agent_id === "object") {
        const a = metadata.agent_id as Record<string, unknown>;
        if (typeof a.String === "string") subEgoId = a.String;
        else if (typeof a.id === "string") subEgoId = a.id;
      }
      const impact = payload.impact as string | undefined;

      if (timestamp >= since) {
        if (!subEgoFilter || subEgoId === subEgoFilter) {
          decisions.push({
            id,
            title,
            timestamp,
            subEgoId,
            impact,
          });
        }
      }
    }

    // Ordenar de más reciente a más antiguo
    decisions.sort((a, b) => b.timestamp - a.timestamp);
    return decisions.slice(0, limit);
  }

  /**
   * Registra una decisión acordada de forma inmutable en gov/audit
   */
  async recordDecision(entry: {
    title: string;
    subEgoId: string;
    impact?: string;
    metadata?: Record<string, unknown>;
  }): Promise<RecentDecision> {
    const now = Date.now();
    const id = `dec-${now}-${crypto.randomBytes(3).toString("hex")}`;

    const decision: RecentDecision = {
      id,
      title: entry.title,
      timestamp: now,
      subEgoId: entry.subEgoId,
      impact: entry.impact,
    };

    const validated = RecentDecisionSchema.parse(decision);

    await this.memory.put({
      namespace: DecisionsFeed.NAMESPACE,
      key: id,
      payload: validated,
      metadata: {
        agent_id: entry.subEgoId,
        ts: now,
        ...entry.metadata,
      },
    });

    if (this.eventBus) {
      this.eventBus.emit("daily.state.synthesized", validated, {
        source: "DecisionsFeed",
      });
    }

    return validated;
  }

  /**
   * Exporta las decisiones del feed en formato Markdown legible para Journal o auditoría
   */
  async exportDecisionsMarkdown(options?: DecisionQueryOptions): Promise<string> {
    const decisions = await this.getDecisions(options);
    if (decisions.length === 0) {
      return "_No se registraron decisiones en el período seleccionado._";
    }

    const lines: string[] = [
      "| Hora | Sub-Ego | Decisión | Impacto |",
      "|---|---|---|---|",
    ];

    for (const d of decisions) {
      const timeStr = new Date(d.timestamp).toLocaleTimeString();
      const impactStr = d.impact || "Operativo";
      lines.push(`| ${timeStr} | \`${d.subEgoId}\` | ${d.title} | ${impactStr} |`);
    }

    return lines.join("\n");
  }
}
