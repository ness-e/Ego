/**
 * PromptInjectionDetector — detección determinista de vectores de inyección
 * de prompt (Ola 9 · EGO-FIND-83 / hueco de capacidad).
 *
 * ## Qué es y qué NO es
 *
 * - **Detecta, no juzga.** Devuelve un veredicto (`clean` / `suspicious`),
 *   las señales detectadas y su severidad. **La política la decide el
 *   runtime** (`TrustBoundary`): degradar el taint, marcar la fuente, pedir
 *   confirmación o detener el turno. Este módulo no ejecuta castigos.
 * - **Determinista y barato**: sin LLM, sin red, sin I/O. Se ejecuta sobre
 *   cada pieza de contenido no confiable, así que su coste entra en el
 *   presupuesto de latencia del turno.
 * - **Sin falsos positivos desbocados**: un detector que marca todo como
 *   sospechoso es un detector inútil (entrena al usuario a ignorar la
 *   señal). Las reglas están afinadas contra el corpus real del repo; la
 *   tasa medida se publica en el handoff de la ola.
 *
 * ## Normalización (por qué antes de comparar)
 *
 * El texto llega con markdown, HTML, caracteres de ancho completo, **cero
 * ancho**, homoglifos cirílicos/griegos y mayúsculas. Sin normalizar, los
 * vectores triviales lo esquivan. El detector trabaja sobre una **forma
 * canónica**: NFKC → sin ceros anchos/bidi → homoglifos plegados a latin →
 * minúsculas → espacios colapsados. Sobre ella se evalúan además dos formas
 * derived: **sin markdown** (para `**ignore previous instructions**`) y
 * **compacta** (para `i g n o r e   p r e v i o u s`).
 *
 * ## Allowlist
 *
 * El contenido de **confianza** (el system prompt propio, las skills
 * registradas, el contenido firmado) no se marca: el llamante lo declara con
 * `allow`. Y el detector **no se aplica al canal privilegiado**: eso lo
 * decide el `TrustBoundary`, no este módulo.
 *
 * ## Límites honestos
 *
 * - Es un detector de **patrones**, no un clasificador semántico: un vector
 *   redactado sin las familias de abajo pasa desapercibido.
 * - La severidad es una **escala declarada** (0..1), no una probabilidad
 *   calibrada.
 * - `evidence` es un **recorte acotado** (por defecto 120 caracteres): el
 *   log de seguridad no debe convertirse en una copia del contenido.
 */

/** Veredicto del detector. */
export type InjectionVerdict = "clean" | "suspicious";

/** Familias de vectores detectadas. */
export type InjectionSignalKind =
  /** Suplantación de rol / cambio de instrucciones ("ignore previous instructions"). */
  | "instruction_override"
  /** Exfiltración del system prompt ("repeat your system prompt"). */
  | "prompt_exfiltration"
  /** Suplantación de rol explícita ("system:", "you are now …", `<|im_start|>`). */
  | "role_impersonation"
  /** Instrucciones embebidas en markdown/HTML ("```ignore previous instructions```"). */
  | "embedded_instructions"
  /** Referencias a herramientas/secretos que buscan que el modelo los revele. */
  | "secret_lure";

/** Una señal detectada. */
export interface InjectionSignal {
  /** Familia del vector. */
  kind: InjectionSignalKind;
  /** Severidad declarada en [0,1]. */
  severity: number;
  /** Recorte **acotado** del texto que disparó la regla (nunca el texto entero). */
  evidence: string;
}

/** Resultado de una detección. */
export interface InjectionDetection {
  /** Veredicto agregado. */
  verdict: InjectionVerdict;
  /** Señales detectadas (deduplicadas por familia + severidad). */
  signals: InjectionSignal[];
  /** Forma canónica sobre la que se evaluaron las reglas (acotada). */
  normalized: string;
  /** `true` si la entrada se truncó por el tope de caracteres. */
  truncated: boolean;
}

/** Opciones del detector. */
export interface PromptInjectionDetectorOptions {
  /** Tope de caracteres escaneados (guard de DoS). Por defecto 100 000. */
  maxInputChars?: number;
  /** Tope de caracteres de la evidencia por señal. Por defecto 120. */
  evidenceMaxChars?: number;
  /** Tope de caracteres de la forma canónica devuelta. Por defecto 1000. */
  normalizedMaxChars?: number;
  /** Severidad mínima para que el veredicto sea `suspicious`. Por defecto 0.5. */
  threshold?: number;
  /** Allowlist de contenido: si casa, el veredicto es `clean`. */
  allow?: readonly RegExp[];
}

/** Forma mínima que consume el runtime (contrato estructural, DIP). */
export interface InjectionDetectionLike {
  verdict: InjectionVerdict;
  signals: Array<{ kind: string; severity: number; evidence: string }>;
  normalized: string;
  truncated: boolean;
}

const DEFAULT_MAX_INPUT_CHARS = 100_000;
const DEFAULT_EVIDENCE_MAX_CHARS = 120;
const DEFAULT_NORMALIZED_MAX_CHARS = 1000;
const DEFAULT_THRESHOLD = 0.5;

/** Caracteres invisibles: cero ancho, bidi, soft hyphen, BOM. */
const INVISIBLE_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g;

/**
 * Homoglifos cirílicos y griegos que se ven como latin.
 * (NFKC no los pliega: `А` U+0410 ≠ `A`.)
 */
const HOMOGLYPHS: Readonly<Record<string, string>> = {
  // Cirílico
  а: "a", б: "b", в: "b", г: "r", д: "d", е: "e", ё: "e", ж: "x", з: "3",
  и: "u", й: "u", к: "k", л: "l", м: "m", н: "h", о: "o", п: "n", р: "p",
  с: "c", т: "t", у: "y", ф: "f", х: "x", ц: "u", ч: "y", ш: "w", щ: "w",
  ъ: "b", ы: "b", ь: "b", э: "e", ю: "io", я: "r",
  і: "i", ѕ: "s", ј: "j", ԁ: "d", ԛ: "q", ԝ: "w", һ: "h", ӏ: "l",
  // Griego
  α: "a", β: "b", γ: "y", δ: "d", ε: "e", ζ: "z", η: "n", θ: "o", ι: "i",
  κ: "k", λ: "l", μ: "u", ν: "v", ξ: "e", ο: "o", π: "n", ρ: "p", σ: "o",
  τ: "t", υ: "u", φ: "f", χ: "x", ψ: "y", ω: "w",
  Α: "a", Β: "b", Ε: "e", Ζ: "z", Η: "h", Ι: "i", Κ: "k", Μ: "m", Ν: "n",
  Ο: "o", Ρ: "p", Τ: "t", Υ: "y", Χ: "x", Θ: "o", Γ: "r",
};

const HOMOGLYPH_RE = new RegExp(`[${Object.keys(HOMOGLYPHS).join("")}]`, "g");

/**
 * Forma canónica sobre la que se evalúan las reglas.
 *
 * NFKC (pliega ancho completo, negritas matemáticas, ligaduras) → sin
 * invisibles → homoglifos a latin → minúsculas → espacios colapsados.
 */
export function normalizeForInjectionScan(text: string): string {
  return text
    .normalize("NFKC")
    .replace(INVISIBLE_RE, "")
    .replace(HOMOGLYPH_RE, (c) => HOMOGLYPHS[c] ?? c)
    .toLowerCase()
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Forma derivada: sin marcadores de markdown (rompe `**ignore previous instructions**`). */
function stripMarkdownMarkers(text: string): string {
  return text.replace(/[*_`~]/g, "");
}

/** Forma derivada: sin espacios (rompe `i g n o r e   p r e v i o u s`). */
function compact(text: string): string {
  return text.replace(/\s+/g, "");
}

interface InjectionRule {
  kind: InjectionSignalKind;
  severity: number;
  /** Regla legible (para el log). */
  name: string;
  /** Patrón global sobre la forma canónica. */
  pattern: RegExp;
  /** Forma mínima del texto a la que se aplica. */
  minCompactChars?: number;
}

/**
 * Frase de **directiva** completa (no la palabra suelta): `ignore` a secas
 * aparece en el código legítimo (`ignorecase`, `ignoredeadlinks`, `ignores`)
 * y no es un vector.
 */
const DIRECTIVE_PHRASE =
  "(?:ignore|disregard)\\s+(?:all\\s+|any\\s+|the\\s+|your\\s+|previous|above|earlier)\\w*|you\\s+must|new\\s+instructions?|reveal\\s+your\\s+system|print\\s+your\\s+system";

/** Forma compactada (URLs y slugs): `ignore-previous-instructions`, `you-must`… */
const DIRECTIVE_COMPACT =
  "(?:ignore|disregard)[-_](?:previous|prior|above|all)|you[-_]must|new[-_]instructions?|prompt[-_]injection";

const RULES: readonly InjectionRule[] = [
  // ── 1. Cambio de instrucciones ────────────────────────────────────────
  {
    kind: "instruction_override",
    severity: 0.9,
    name: "override-previous-instructions",
    pattern:
      /\b(?:ignore|disregard|forget|override|discard)\b[^.\n]{0,40}?\b(?:previous|prior|above|preceding|earlier|initial|original|all|everything)\b[^.\n]{0,24}?\b(?:instruction|instructions|prompt|prompts|rule|rules|directive|directives|message|messages|context|guidance)\b/gi,
  },
  {
    kind: "instruction_override",
    severity: 0.85,
    name: "forget-everything",
    pattern:
      /\b(?:forget|ignore|disregard)\s+(?:everything|all)\b[^.\n]{0,30}?\b(?:you\s+(?:were|have\s+been)\s+told|above|before|instructions?|rules?)\b/gi,
  },
  {
    kind: "instruction_override",
    severity: 0.9,
    name: "new-instructions",
    pattern: /\b(?:new|updated|revised|real|actual)\s+(?:system\s+)?instructions?\s*[:\-]/gi,
  },
  {
    kind: "instruction_override",
    severity: 0.9,
    name: "system-prompt-override",
    pattern: /\b(?:system\s+prompt|instructions?)\s+(?:update|overrides?|overridden|changed?|replaced?|revised)\b/gi,
  },
  {
    kind: "instruction_override",
    severity: 0.85,
    name: "from-now-on",
    pattern:
      /\bfrom\s+now\s+on\b[^.\n]{0,40}?\b(?:ignore|disregard|follow|you\s+(?:will|must|are|should))\b/gi,
  },
  {
    kind: "instruction_override",
    severity: 0.85,
    name: "do-not-follow",
    pattern: /\bdo\s+not\s+follow\s+(?:the\s+|any\s+)?(?:previous|prior|above|earlier|these)\b/gi,
  },
  {
    kind: "instruction_override",
    severity: 0.9,
    name: "override-es",
    pattern:
      /(?:^|[.!?:;,\n]\s+)(?:ignora|olvida|desatiende|omite|descarta)\w*\s+(?:todas\s+las\s+|los\s+|las\s+)?(?:instrucciones|indicaciones|reglas)\b/gi,
  },
  {
    kind: "instruction_override",
    severity: 0.9,
    name: "new-instructions-es",
    pattern: /\bnuevas\s+instrucciones\s*[:\-]/gi,
  },

  // ── 2. Exfiltración del system prompt ─────────────────────────────────
  {
    kind: "prompt_exfiltration",
    severity: 0.9,
    name: "reveal-prompt",
    pattern:
      /\b(?:repeat|reprint|print|show|reveal|display|output|echo|write\s+out)\b[^.\n]{0,30}?\b(?:your|the|its)\b[^.\n]{0,20}?\b(?:system\s+)?(?:prompt|instructions?|directives?|rules?)\b/gi,
  },
  {
    kind: "prompt_exfiltration",
    severity: 0.9,
    name: "what-were-your-instructions",
    pattern:
      /\bwhat\s+(?:were|are|was)\s+(?:your|the)\s+(?:original|initial|system)\b[^.\n]{0,24}?\b(?:prompt|instructions?)\b/gi,
  },
  {
    kind: "prompt_exfiltration",
    severity: 0.9,
    name: "verbatim-prompt",
    pattern: /\bverbatim\b[^.\n]{0,30}?\b(?:system\s+)?(?:prompt|instructions?)\b/gi,
  },
  {
    kind: "prompt_exfiltration",
    severity: 0.85,
    name: "repeat-everything-above",
    pattern:
      /\b(?:repeat|output|print|show)\s+(?:everything|all|the\s+text)\s+(?:above|before|preceding)\b/gi,
  },
  {
    kind: "prompt_exfiltration",
    severity: 0.9,
    name: "reveal-prompt-es",
    pattern:
      /\b(?:repite|repetir|muestra|muéstrame|imprime|revela|revelar)\b[^.\n]{0,30}?\b(?:tu|tus|sus)\b[^.\n]{0,20}?\b(?:prompt|instrucciones|reglas)\b/gi,
  },
  {
    kind: "prompt_exfiltration",
    severity: 0.9,
    name: "reveal-system-prompt-es",
    pattern:
      /\b(?:repite|repetir|muestra|muéstrame|imprime|revela|revelar)\b[^.\n]{0,30}?\b(?:el\s+)?(?:system\s+)?prompt\s+del\s+sistema\b/gi,
  },

  // ── 3. Suplantación de rol ─────────────────────────────────────────────
  {
    kind: "role_impersonation",
    severity: 0.75,
    name: "role-header",
    pattern:
      /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\[|<)?(?:system|assistant|developer)(?:\]|>)?\s*:(?!\s*["'`}\],;])/gim,
  },
  {
    kind: "role_impersonation",
    severity: 0.75,
    name: "role-heading",
    pattern: /(?:^|\n)\s*#{1,6}\s*(?:system|assistant|developer|instructions?)\s*(?:\n|$)/gim,
  },
  {
    kind: "role_impersonation",
    severity: 0.7,
    name: "role-bracket-header",
    pattern: /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\[|<)(?:system|assistant|developer)(?:\]|>)\b/gim,
  },
  {
    kind: "role_impersonation",
    severity: 0.9,
    name: "chat-template-marker",
    pattern: /<\|(?:im_start|im_end)\|>/g,
  },
  {
    kind: "role_impersonation",
    severity: 0.8,
    name: "act-as-unrestricted",
    pattern:
      /\b(?:act|behave|respond|roleplay)\s+as\s+(?:an?\s+|the\s+)?(?:unrestricted|unfiltered|uncensored|developer\s+mode|jailbroken|dan|no\s+rules)\b/gi,
  },
  {
    kind: "role_impersonation",
    severity: 0.7,
    name: "pretend-dan",
    pattern:
      /\bpretend\s+(?:to\s+be|you\s+are)\b[^.\n]{0,30}?\b(?:dan|unrestricted|no\s+rules|jailbreak)\b/gi,
  },
  {
    kind: "role_impersonation",
    severity: 0.6,
    name: "simulate-being",
    pattern: /\b(?:simulate|roleplay\s+as)\s+(?:being|you\s+are)\b/gi,
  },
  {
    kind: "role_impersonation",
    severity: 0.8,
    name: "you-are-now-unrestricted",
    pattern:
      /\byou\s+are\s+now\s+(?:an?\s+|the\s+)?(?:unrestricted|unfiltered|uncensored|developer|jailbroken|no\s+longer)\b/gi,
  },
  {
    kind: "role_impersonation",
    severity: 0.45,
    name: "you-are-now",
    pattern: /\byou\s+are\s+now\b/gi,
  },
  {
    kind: "role_impersonation",
    severity: 0.8,
    name: "act-as-es",
    pattern:
      /\bact[uú]a\s+como\s+(?:un\s+|una\s+)?(?:asistente\s+)?(?:sin\s+restricciones|sin\s+reglas|libre)\b/gi,
  },
  {
    kind: "role_impersonation",
    severity: 0.6,
    name: "pretend-es",
    pattern: /\bfinge\s+que\s+eres\b/gi,
  },

  // ── 4. Instrucciones embebidas en markdown/HTML ───────────────────────
  {
    kind: "embedded_instructions",
    severity: 0.7,
    name: "directive-in-code-fence",
    pattern: new RegExp(
      "```[^\\n]{0,80}?\\b(?:" + DIRECTIVE_PHRASE + ")\\b" +
        "|```[\\s\\S]{0,400}?(?:\\n[ \\t]*)(?:" + DIRECTIVE_PHRASE + ")\\b",
      "gi"
    ),
  },
  {
    kind: "embedded_instructions",
    severity: 0.7,
    name: "directive-in-html-comment",
    pattern: new RegExp(
      "<!--[ \\t]*(?:" + DIRECTIVE_PHRASE + ")\\b" +
        "|<!--[\\s\\S]{0,400}?(?:\\n[ \\t]*)(?:" + DIRECTIVE_PHRASE + ")\\b",
      "gi"
    ),
  },
  {
    kind: "embedded_instructions",
    severity: 0.65,
    name: "directive-in-link",
    pattern: new RegExp(
      "!?(?:" + DIRECTIVE_PHRASE + ")[\\s\\S]{0,80}?\\)" +
        "|!?\\[[^\\]\\n]{0,120}\\]\\([^)\\n]{0,200}?\\b(?:" + DIRECTIVE_PHRASE + ")\\b" +
        "|!?\\[[^\\]\\n]{0,120}\\]\\([^)\\n]{0,200}?\\b(?:" + DIRECTIVE_COMPACT + ")",
      "gi"
    ),
  },
  {
    kind: "embedded_instructions",
    severity: 0.65,
    name: "directive-in-emphasis",
    pattern: new RegExp(
      "(?:\\*\\*|__|\\*|_|`)\\s*(?:" + DIRECTIVE_PHRASE + ")[^`\\n]{0,80}(?:\\*\\*|__|\\*|_|`)",
      "gi"
    ),
  },

  // ── 5. Señuelos de secretos/herramientas ──────────────────────────────
  {
    kind: "secret_lure",
    severity: 0.65,
    name: "send-secret-away",
    pattern:
      /\b(?:send|post|upload|email|e-mail|forward|share|exfiltrate|leak|publish|push)\b[^.\n]{0,40}?\b(?:the|your|my|our|all|any)\s+(?:api[\s_-]?keys?|secrets?|access\s+tokens?|tokens?(?!\s+(?:count|limit|budget|max|usage))|credentials?|passwords?|env(?:ironment)?\s+(?:var(?:iable)?s?|file))\b/gi,
  },
  {
    kind: "secret_lure",
    severity: 0.65,
    name: "reveal-secret",
    pattern:
      /\b(?:reveal|print|show|expose|disclose|dump|output)\b[^.\n]{0,30}?\b(?:the|your|my|our)\s+(?:api[\s_-]?keys?|secrets?|access\s+tokens?|tokens?(?!\s+(?:count|limit|budget|max|usage))|credentials?|passwords?|env(?:ironment)?\s+(?:var(?:iable)?s?|file))\b/gi,
  },
  {
    kind: "secret_lure",
    severity: 0.65,
    name: "what-is-the-key",
    pattern:
      /\bwhat(?:'s| is)\b[^.\n]{0,24}?\b(?:the\s+|your\s+)?(?:api[\s_-]?key|secret|access\s+token|password)\b/gi,
  },
];

/** Reglas que sólo se evalúan sobre la forma compacta (sin espacios). */
const COMPACT_MIN_CHARS = 14;

/**
 * Marcas de **mención**: el texto habla *del* vector, no *es* el vector.
 * (Documentación, tests, ficha de extracción…)
 */
const MENTION_MARKERS =
  /\b(?:ejemplo|examples?|detect(?:or|ed|s|ing)?|busc(?:a|ar|ando)|grep|rg|ripgrep|t[eé]cnica|technique|patr[oó]n|pattern|familia|famil(?:y|ies)|prueba|pruebas|test|tests|document(?:a|ado|ación|acion)|describe[sd]?|mencion(?:a|ado)|referencia|doc(?:s|umentaci[oó]n)?|readme|comentario|comment)\b/i;

/**
 * Regiones de **mención**: tramos citados (backtick o comillas dobles) cuyo
 * contexto es una *mención* del vector (documentación, test, ficha…), no el
 * vector en sí.
 *
 * Se calculan sobre la forma **base** y se aplican a todas las formas: así la
 * forma derivada (sin markdown / compacta) no puede reintroducir un vector que
 * la base ya descartó por ser mención.
 */
function mentionRegions(form: string): Array<string> {
  const regions: Array<string> = [];
  for (const quote of ["`", '"']) {
    let open = -1;
    for (let i = 0; i < form.length; i++) {
      if (form[i] !== quote) continue;
      if (open === -1) {
        open = i;
        continue;
      }
      const span = form.slice(open + 1, i);
      const window = form.slice(Math.max(0, open - 200), Math.min(form.length, i + 200));
      if (span.length > 0 && MENTION_MARKERS.test(window)) regions.push(span);
      open = -1;
    }
  }
  return regions;
}

/**
 * ¿El match es una **mención** (el texto cita el vector) y no un vector?
 *
 * Heurística de dos condiciones:
 * 1. El match está dentro de un tramo citado (backtick o comillas dobles): un
 *    fragmento de código o una cita, no una instrucción en voz del modelo.
 * 2. Alrededor hay una marca de mención ("ejemplo", "detecta", "grep", …).
 *
 * Límite honesto: un atacante puede envolver el vector en comillas para
 * esquivarlo. Se acepta ese riesgo porque el corpus legítimo (docs, tests,
 * fichas) menciona las técnicas a constantly; quien tenga un contenido de
 * confianza lo declara con `allow` y el detector ni lo mira.
 */
function isMetaMention(regions: readonly string[], evidence: string): boolean {
  return regions.some((region) => region.includes(evidence));
}

function evidenceOf(match: string, maxChars: number): string {
  const clean = match.replace(/\s+/g, " ").trim();
  return clean.length > maxChars ? `${clean.slice(0, maxChars)}…` : clean;
}

/**
 * Detecta vectores de inyección de prompt en un texto.
 *
 * @param text Contenido a analizar (puede venir de markdown, HTML, un fichero…).
 * @param options Ver {@link PromptInjectionDetectorOptions}.
 */
export function detectPromptInjection(
  text: string,
  options: PromptInjectionDetectorOptions = {}
): InjectionDetection {
  const maxInputChars = options.maxInputChars ?? DEFAULT_MAX_INPUT_CHARS;
  const evidenceMaxChars = options.evidenceMaxChars ?? DEFAULT_EVIDENCE_MAX_CHARS;
  const normalizedMaxChars = options.normalizedMaxChars ?? DEFAULT_NORMALIZED_MAX_CHARS;
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;

  const truncated = text.length > maxInputChars;
  const bounded = truncated ? text.slice(0, maxInputChars) : text;
  const normalized = normalizeForInjectionScan(bounded);

  const normalizedOut =
    normalized.length > normalizedMaxChars
      ? `${normalized.slice(0, normalizedMaxChars)}…`
      : normalized;

  // Allowlist: el contenido declarado de confianza no se marca.
  if (options.allow?.some((re) => re.test(normalized) || re.test(bounded))) {
    return { verdict: "clean", signals: [], normalized: normalizedOut, truncated };
  }

  const signals: InjectionSignal[] = [];
  const seen = new Set<string>();
  // Regiones de mención: se calculan UNA vez sobre la forma base y se
  // aplican a todas las formas (así la forma derivada no reintroduce un
  // vector que la base ya descartó por ser mención).
  const mentions = mentionRegions(normalized);

  const scan = (form: string): void => {
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = rule.pattern.exec(form)) !== null) {
        const matched = match[0];
        if (!matched) {
          rule.pattern.lastIndex += 1;
          continue;
        }
        // Mención (el texto habla del vector) ≠ vector.
        if (isMetaMention(mentions, matched)) break;
        const key = `${rule.kind}:${rule.name}:${rule.severity}`;
        if (!seen.has(key)) {
          seen.add(key);
          signals.push({
            kind: rule.kind,
            severity: rule.severity,
            evidence: evidenceOf(matched, evidenceMaxChars),
          });
        }
        break; // una señal por regla basta
      }
    }
  };

  scan(normalized);

  // Formas derivadas: sólo si la forma base no encontró nada (evita el coste
  // extra en el caso común) y sólo si el texto tiene marcas que lo justifiquen.
  if (signals.length === 0) {
    const needsMarkdown = /[*_`~]/.test(normalized);
    const needsSpacing = /\s{2,}| \w \w/.test(bounded);
    if (needsMarkdown) {
      const noMarkdown = stripMarkdownMarkers(normalized);
      if (noMarkdown !== normalized) scan(noMarkdown);
    }
    if (signals.length === 0 && needsSpacing) {
      const compactForm = compact(normalized);
      if (compactForm.length >= COMPACT_MIN_CHARS) scan(compactForm);
    }
  }

  const suspicious = signals.some((s) => s.severity >= threshold);
  return {
    verdict: suspicious ? "suspicious" : "clean",
    signals,
    normalized: normalizedOut,
    truncated,
  };
}
