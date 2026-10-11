import * as crypto from "node:crypto";
import { EgoMemoryAdapter } from "./EgoMemoryAdapter.js";

export interface ContentInspectionResult {
  isSafe: boolean;
  threatScore: number; // 0.0 (seguro) a 1.0 (crítico)
  detectedThreats: string[];
  requiresQuarantine: boolean;
  contentHash: string;
}

export interface SanitizedRouteResult {
  routedTo: "live" | "quarantine";
  destinationNamespace: string;
  destinationKey: string;
  inspection: ContentInspectionResult;
}

/**
 * Patrones conocidos de inyección de prompt, evasión de guardrails y control tags.
 */
const INJECTION_PATTERNS: Array<{ name: string; pattern: RegExp; severity: number }> = [
  {
    name: "ignore_previous_instructions",
    pattern: /ignore\s+(all\s+)?(previous|prior|existing)\s+(instructions|prompts|rules|guidelines)/i,
    severity: 0.9,
  },
  {
    name: "disregard_prior_rules",
    pattern: /disregard\s+(all\s+)?(prior|previous|existing)\s+(rules|constraints|instructions)/i,
    severity: 0.9,
  },
  {
    name: "persona_jailbreak_dan",
    pattern: /you\s+are\s+now\s+(an?\s+unrestricted|in\s+developer\s+mode|dan|jailbroken)/i,
    severity: 0.85,
  },
  {
    name: "system_tag_injection",
    pattern: /<\/?\s*(system|instruction|prompt|developer_mode|ego_internal)\s*>/i,
    severity: 0.8,
  },
  {
    name: "fake_role_header",
    pattern: /(^|\n)\s*(system|human|assistant|user|tool_call):\s*/i,
    severity: 0.7,
  },
  {
    name: "ansi_terminal_injection",
    pattern: /\x1b\[[0-9;]*[a-zA-Z]/,
    severity: 0.5,
  },
  {
    name: "unicode_bidi_override",
    pattern: /[\u202A-\u202E\u2066-\u2069]/,
    severity: 0.6,
  },
];

/**
 * Filtro de Cuarentena y Saneamiento de Contenido No Confiable (CARP-04).
 * Extraído del patrón `validate-untrusted-content-coverage` de Career-Ops.
 * Aísla entradas externas potencialmente maliciosas antes de su persistencia en memoria o ejecución.
 */
export class UntrustedContentSanitizer {
  /**
   * Analiza minuciosamente un texto externo en busca de vectores de inyección o jailbreak.
   */
  public static inspectContent(rawText: string, _origin: string = "untrusted_source"): ContentInspectionResult {
    const detectedThreats: string[] = [];
    let maxSeverity = 0;

    for (const item of INJECTION_PATTERNS) {
      if (item.pattern.test(rawText)) {
        detectedThreats.push(item.name);
        if (item.severity > maxSeverity) {
          maxSeverity = item.severity;
        }
      }
    }

    const contentHash = crypto.createHash("sha256").update(rawText).digest("hex").slice(0, 16);
    const threatScore = Math.min(1.0, maxSeverity);
    // Amenazas con severidad >= 0.7 requieren cuarentena obligatoria
    const requiresQuarantine = threatScore >= 0.7;

    return {
      isSafe: detectedThreats.length === 0,
      threatScore,
      detectedThreats,
      requiresQuarantine,
      contentHash,
    };
  }

  /**
   * Envuelve contenido no confiable en una cápsula XML neutralizadora `<untrusted_content>`.
   * Escapa etiquetas internas para evitar que el modelo interprete el texto como instrucciones de control.
   */
  public static wrapUntrustedContent(
    rawText: string,
    origin: string,
    inspection?: ContentInspectionResult
  ): string {
    const insp = inspection ?? this.inspectContent(rawText, origin);
    const timestamp = Date.now();

    // Neutralizar tags XML sospechosos dentro del cuerpo para evitar ruptura del contenedor
    const neutralized = rawText
      .replace(/<\/?system>/gi, "[system_tag_neutralized]")
      .replace(/<\/?prompt>/gi, "[prompt_tag_neutralized]")
      .replace(/<\/?tool_call>/gi, "[tool_call_tag_neutralized]");

    return [
      `<untrusted_content origin="${origin}" hash="${insp.contentHash}" score="${insp.threatScore.toFixed(2)}" timestamp="${timestamp}">`,
      neutralized,
      `</untrusted_content>`,
    ].join("\n");
  }

  /**
   * Sanea y enruta el contenido: Si detecta riesgo, lo envía al namespace `quarantine/pending` de VantaDB;
   * de lo contrario, lo persiste en el namespace solicitado con envoltorio defensivo.
   */
  public static async sanitizeAndRoute(
    adapter: EgoMemoryAdapter,
    input: {
      targetNamespace: string;
      key: string;
      rawText: string;
      origin: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<SanitizedRouteResult> {
    const inspection = this.inspectContent(input.rawText, input.origin);

    if (inspection.requiresQuarantine) {
      const destinationKey = `${input.targetNamespace}:${input.key}`;
      await adapter.quarantine(
        {
          namespace: input.targetNamespace,
          key: input.key,
          payload: {
            origin: input.origin,
            originalNamespace: input.targetNamespace,
            originalKey: input.key,
            rawText: input.rawText,
            threatScore: inspection.threatScore,
            detectedThreats: inspection.detectedThreats,
          },
          metadata: {
            threat_score: inspection.threatScore,
            detected_threats: inspection.detectedThreats.join(","),
          },
        },
        `Detectada posible inyección de prompt (${inspection.detectedThreats.join(", ")})`
      );

      return {
        routedTo: "quarantine",
        destinationNamespace: "quarantine/pending",
        destinationKey,
        inspection,
      };
    }

    const wrappedText = this.wrapUntrustedContent(input.rawText, input.origin, inspection);
    await adapter.put({
      namespace: input.targetNamespace,
      key: input.key,
      payload: {
        content: wrappedText,
        isSanitized: true,
        origin: input.origin,
        threatScore: inspection.threatScore,
      },
      metadata: {
        ...(input.metadata || {}),
        sanitized_at: Date.now(),
        origin: input.origin,
        is_untrusted_wrapped: true,
      },
    });

    return {
      routedTo: "live",
      destinationNamespace: input.targetNamespace,
      destinationKey: input.key,
      inspection,
    };
  }
}
