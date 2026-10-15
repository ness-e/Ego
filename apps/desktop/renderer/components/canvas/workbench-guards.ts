import { z } from "zod";

/**
 * CFG-13 — Guards del Workbench (espejo renderer de REV-02/main.ts).
 *
 * El main ya niega navegación no-loopback a nivel ventana
 * (`isAllowedNavigationUrl`, `applyNavigationGuards`). Este módulo replica
 * la política en el renderer para clasificar URLs ANTES de montar un
 * `<iframe>`: defensa en profundidad, cero canales IPC nuevos.
 *
 * Política: solo `http:`/`https:` contra hosts loopback. Sin `file:`
 * (el iframe con `file:` hereda origen opaco y rompe el sandbox),
 * sin credenciales embebidas (phishing), sin hosts externos.
 */

/** Hosts loopback canónicos (REV-02: `DEV_NAV_HOSTS` en main.ts). */
export const LOOPBACK_HOSTS: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
]);

/** Normaliza `hostname` de URL (IPv6 llega con corchetes: `[::1]`). */
export function normalizeHostname(hostname: string): string {
  const lower = hostname.trim().toLowerCase();
  return lower.startsWith("[") && lower.endsWith("]")
    ? lower.slice(1, -1)
    : lower;
}

export type BrowserBlockReason =
  | "external"
  | "protocol"
  | "credentials"
  | "invalid";

export type BrowserUrlVerdict =
  | { allowed: true; url: string; host: string }
  | { allowed: false; reason: BrowserBlockReason; raw: string };

/**
 * Clasifica una URL candidata para el browser view. Nunca lanza.
 * `""` (vacío) se reporta como `invalid` — el estado `empty` lo deriva
 * la vista a partir del draft vacío, no del clasificador.
 */
export function classifyBrowserUrl(raw: string): BrowserUrlVerdict {
  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { allowed: false, reason: "invalid", raw };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { allowed: false, reason: "protocol", raw };
  }
  if (parsed.username || parsed.password) {
    return { allowed: false, reason: "credentials", raw };
  }
  const host = normalizeHostname(parsed.hostname);
  if (!host || !LOOPBACK_HOSTS.has(host)) {
    return { allowed: false, reason: "external", raw };
  }
  return { allowed: true, url: parsed.toString(), host };
}

/** Mensaje honesto por motivo de bloqueo (UI + tests). */
export function blockReasonMessage(reason: BrowserBlockReason): string {
  switch (reason) {
    case "external":
      return "Bloqueado: solo dev-servers loopback (localhost / 127.0.0.1 / ::1). Las URLs externas no se cargan en el workspace.";
    case "protocol":
      return "Bloqueado: solo http: y https:. Otros esquemas (file:, data:, javascript:) están denegados.";
    case "credentials":
      return "Bloqueado: la URL contiene credenciales embebidas (riesgo de phishing).";
    case "invalid":
      return "URL inválida: no se pudo interpretar como URL absoluta.";
  }
}

/** Zod: string que además pasa el guard loopback (frontera del form). */
export const BrowserUrlSchema = z
  .string()
  .trim()
  .min(1, "La URL no puede estar vacía")
  .refine((v) => classifyBrowserUrl(v).allowed, {
    message: "Solo dev-servers loopback http(s) (localhost / 127.0.0.1 / ::1)",
  });

export type BrowserUrl = z.infer<typeof BrowserUrlSchema>;

// ---------------------------------------------------------------------------
// Preview read-only de archivos (CFG-13): allowlist de extensiones + tope.
// ---------------------------------------------------------------------------

/** Extensiones legibles como texto plano en el preview (solo lectura). */
export const PREVIEWABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  "md",
  "markdown",
  "txt",
  "json",
  "jsonc",
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "css",
  "html",
  "yml",
  "yaml",
  "toml",
  "xml",
  "svg",
  "log",
]);

/** Tope de caracteres del preview (el resto se trunca con aviso). */
export const MAX_PREVIEW_CHARS = 200_000;

export function previewExtensionOf(filePath: string): string | null {
  const base = filePath.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return null;
  return base.slice(dot + 1).toLowerCase();
}

/** ¿El path es previsualizable como texto read-only? Nunca lanza. */
export function isPreviewableFile(filePath: string): boolean {
  const ext = previewExtensionOf(filePath);
  return ext !== null && PREVIEWABLE_EXTENSIONS.has(ext);
}

export interface TruncatedPreview {
  text: string;
  truncated: boolean;
  totalChars: number;
}

/** Trunca el contenido al tope con aviso (puro, testeable). */
export function truncatePreview(content: string): TruncatedPreview {
  if (content.length <= MAX_PREVIEW_CHARS) {
    return { text: content, truncated: false, totalChars: content.length };
  }
  return {
    text: content.slice(0, MAX_PREVIEW_CHARS),
    truncated: true,
    totalChars: content.length,
  };
}

// ---------------------------------------------------------------------------
// Atajos custom (CFG-13): schema Zod + persistencia validada.
// ---------------------------------------------------------------------------

/** Acciones direccionables por atajo custom (cerrado, sin `any`). */
export const SHORTCUT_ACTIONS = [
  "workbench-browser",
  "workbench-cron",
  "workbench-themes",
  "new-session",
  "toggle-inspector",
] as const;

export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];

/**
 * Combinaciones reservadas por el shell (Omnibar Ctrl+K, inspector Ctrl+I,
 * ajustes Ctrl+,). Un custom no puede pisarlas.
 */
export const RESERVED_SHORTCUT_KEYS: ReadonlySet<string> = new Set([
  "ctrl+k",
  "ctrl+i",
  "ctrl+,",
]);

/** Normaliza `Ctrl+Shift+X` → `ctrl+shift+x` para comparar. */
export function normalizeShortcutKeys(keys: string): string {
  return keys
    .split("+")
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0)
    .join("+");
}

export const CustomShortcutSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(48)
    .regex(/^[a-z0-9-]+$/, "id: solo minúsculas, dígitos y guiones"),
  label: z.string().min(1).max(80),
  keys: z
    .string()
    .min(1)
    .max(32)
    .refine((v) => !RESERVED_SHORTCUT_KEYS.has(normalizeShortcutKeys(v)), {
      message: "Combinación reservada por el shell (Ctrl+K / Ctrl+I / Ctrl+,)",
    }),
  action: z.enum(SHORTCUT_ACTIONS),
});

export type CustomShortcut = z.infer<typeof CustomShortcutSchema>;

export const SHORTCUT_STORAGE_KEY = "ego:custom-shortcuts";

/** Carga validada desde storage: ante cualquier duda, `[]` (puro). */
export function loadCustomShortcuts(raw: unknown): CustomShortcut[] {
  const parsed = z.array(CustomShortcutSchema).safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/** Nombre del evento DOM que dispara un atajo (`detail: {action}`). */
export const SHORTCUT_EVENT_NAME = "ego:shortcut";
