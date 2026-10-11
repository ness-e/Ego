/**
 * SlashCommandParser.ts — Contrato y parser de comandos slash de Ego SOC.
 * Extraído y adaptado de Hermes Agent (HERM-12).
 */

import { fuzzyRank } from "./FuzzySearch.js";

export const SLASH_COMMAND_RE = /^\/[^\s/]*(?:\s|$)/;

export const looksLikeSlashCommand = (text: string): boolean =>
  SLASH_COMMAND_RE.test(text.trim());

const SLASH_PARTS_RE = /^(\S+)([\s\S]*)$/;

export interface ParsedSlashCommand {
  name: string;
  arg: string;
}

export interface SlashCommandMeta {
  name: string;
  description: string;
  syntax: string;
  category: "model" | "subego" | "session" | "system" | "workspace";
}

export const CANONICAL_SLASH_COMMANDS: SlashCommandMeta[] = [
  {
    name: "model",
    description: "Cambia o consulta el modelo de lenguaje del Model Router",
    syntax: "/model [nombre-modelo]",
    category: "model",
  },
  {
    name: "subego",
    description: "Selecciona el Sub-Ego activo o delega el turno cognitivo",
    syntax: "/subego [ego.id]",
    category: "subego",
  },
  {
    name: "resume",
    description: "Abre el selector de sesiones recientes para reanudar un hilo",
    syntax: "/resume [query]",
    category: "session",
  },
  {
    name: "compact",
    description: "Fuerza la compactación y síntesis de memoria de la sesión actual",
    syntax: "/compact",
    category: "system",
  },
  {
    name: "canvas",
    description: "Enfoca o abre un componente en el Dynamic Workspace",
    syntax: "/canvas [component-id]",
    category: "workspace",
  },
  {
    name: "daily",
    description: "Abre el briefing ejecutivo de Daily State matutino",
    syntax: "/daily",
    category: "system",
  },
  {
    name: "clear",
    description: "Limpia la pantalla de mensajes de la sesión actual",
    syntax: "/clear",
    category: "session",
  },
  {
    name: "help",
    description: "Muestra la ayuda de comandos y capacidades de Ego",
    syntax: "/help",
    category: "system",
  },
];

/**
 * Parsea una línea de texto de comando slash separando el nombre en minúsculas y el argumento.
 * Mantiene intactos los saltos de línea y espaciados internos del argumento.
 */
export function parseSlashCommand(input: string): ParsedSlashCommand {
  const stripped = input.trim().replace(/^\/+/, "");
  const match = SLASH_PARTS_RE.exec(stripped);

  if (!match) {
    return { name: "", arg: "" };
  }

  return {
    name: match[1].toLowerCase(),
    arg: match[2].trim(),
  };
}

/**
 * Retorna sugerencias de comandos ordenadas por coincidencia difusa.
 */
export function getSlashCompletions(query: string): SlashCommandMeta[] {
  const clean = query.replace(/^\/+/, "").trim();
  if (!clean) {
    return [...CANONICAL_SLASH_COMMANDS];
  }

  const ranked = fuzzyRank(CANONICAL_SLASH_COMMANDS, clean, (cmd) => `${cmd.name} ${cmd.description}`);
  return ranked.map((r) => r.item);
}
