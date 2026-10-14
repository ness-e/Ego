/**
 * T08 (UI-05): parser puro de slash-commands y @-menciones del Composer.
 * Sin dependencias React — testeable en aislamiento. NO toca el runtime
 * de streaming (T02): solo clasifica el texto saliente del composer.
 */

export interface SlashCommand {
  /** Comando sin la barra inicial, en minúsculas (ej. "help"). */
  name: string;
  /** Resto de la línea tras el comando. */
  args: string;
}

/** Comandos locales (se resuelven sin turno LLM). */
export const LOCAL_SLASH_COMMANDS = new Set(["help", "clear"]);

/**
 * Si el texto es un slash-command (`/cmd args`), lo devuelve; si no, null.
 * Solo vale al inicio del mensaje (tras espacios).
 */
export function parseSlashCommand(text: string): SlashCommand | null {
  const m = /^\s*\/([a-zA-Z][a-zA-Z0-9_-]*)([\s\S]*)$/.exec(text);
  if (!m) return null;
  return { name: m[1].toLowerCase(), args: m[2].trim() };
}

/** Texto de ayuda del composer (comando local `/help`). */
export const SLASH_HELP_TEXT = [
  "Comandos del composer:",
  "· /help — muestra esta ayuda",
  "· /clear — limpia el hilo local",
  "· @ruta/al/archivo — adjunta mención de archivo al turno",
].join("\n");

/**
 * Extrae rutas mencionadas con @ (`@src/app.ts`, `@"mi archivo.ts"`).
 * Devuelve rutas únicas en orden de aparición.
 */
export function extractMentions(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /@(?:"([^"]+)"|([A-Za-z0-9_./\\:@~-]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const path = (m[1] ?? m[2] ?? "").trim().replace(/[.,;:!?)]+$/, "");
    if (path && !seen.has(path)) {
      seen.add(path);
      out.push(path);
    }
  }
  return out;
}
