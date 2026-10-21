import React, { useEffect, useState } from "react";
import {
  CustomShortcutSchema,
  SHORTCUT_ACTIONS,
  SHORTCUT_EVENT_NAME,
  SHORTCUT_STORAGE_KEY,
  loadCustomShortcuts,
  normalizeShortcutKeys,
  type CustomShortcut,
  type ShortcutAction,
} from "./workbench-guards.js";
import { Select } from "../ui-kit/Select.js";
import { Input } from "../ui-kit/Input.js";
import { Button } from "../ui-kit/Button.js";

/**
 * CFG-13 — Atajos custom (renderer-only, sin IPC).
 * Persistencia en `localStorage` validada con Zod; ante corrupción se
 * arranca vacío (nunca rompe el shell). Las combinaciones reservadas
 * (Ctrl+K omnibar, Ctrl+I inspector, Ctrl+, ajustes) se rechazan.
 * Al dispararse, emiten `CustomEvent("ego:shortcut", {detail:{action}})`
 * que consume `WorkbenchView` (tabs) — el shell puede suscribirse igual.
 */
function comboOf(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  parts.push(e.key.toLowerCase());
  return normalizeShortcutKeys(parts.join("+"));
}

function readStored(): CustomShortcut[] {
  try {
    const raw = localStorage.getItem(SHORTCUT_STORAGE_KEY);
    if (!raw) return [];
    return loadCustomShortcuts(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export const ShortcutsPanel: React.FC = () => {
  const [shortcuts, setShortcuts] = useState<CustomShortcut[]>(readStored);
  const [label, setLabel] = useState("");
  const [keys, setKeys] = useState("");
  const [action, setAction] = useState<ShortcutAction>("workbench-browser");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(shortcuts));
    } catch {
      // storage lleno/no disponible: los atajos viven solo en memoria.
    }
  }, [shortcuts]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // No robar teclas mientras se escribe en inputs (salvo Escape).
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) {
        return;
      }
      const combo = comboOf(e);
      const hit = shortcuts.find((s) => normalizeShortcutKeys(s.keys) === combo);
      if (hit) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent(SHORTCUT_EVENT_NAME, { detail: { action: hit.action } })
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const id = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    const parsed = CustomShortcutSchema.safeParse({ id, label, keys, action });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const detail = first ? `${first.path.join(".") || "atajo"}: ${first.message}` : "atajo: inválido";
      setFormError(detail);
      return;
    }
    if (shortcuts.some((s) => s.id === parsed.data.id)) {
      setFormError("Ya existe un atajo con ese nombre.");
      return;
    }
    setShortcuts((prev) => [...prev, parsed.data]);
    setLabel("");
    setKeys("");
    setFormError(null);
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)]">
      <h3 className="mb-3 border-b border-hairline pb-3 text-sm font-semibold text-ink">
        Atajos Personalizados
      </h3>
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="flex w-40 flex-col gap-1">
          <label htmlFor="cfg13-sc-label" className="text-xs text-faint">Nombre</label>
          <Input
            id="cfg13-sc-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Abrir navegador"
          />
        </div>
        <div className="flex w-36 flex-col gap-1">
          <label htmlFor="cfg13-sc-keys" className="text-xs text-faint">Teclas</label>
          <Input
            id="cfg13-sc-keys"
            value={keys}
            onChange={(e) => setKeys(e.target.value)}
            placeholder="ctrl+shift+b"
            spellCheck={false}
            autoComplete="off"
            className="font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="cfg13-sc-action" className="text-xs text-faint">Acción</label>
          <Select
            id="cfg13-sc-action"
            ariaLabel="Acción"
            value={action}
            onValueChange={(v) => setAction(v as ShortcutAction)}
            options={SHORTCUT_ACTIONS.map((a) => ({ value: a, label: a }))}
          />
        </div>
        <Button type="submit" variant="primary" size="md">
          Agregar
        </Button>
      </form>
      {formError !== null && (
        <p role="alert" className="mt-2 text-xs text-error">{formError}</p>
      )}
      {shortcuts.length === 0 ? (
        <p role="status" className="mt-2 text-xs text-faint">
          Sin atajos custom. Reservadas: Ctrl+K, Ctrl+I, Ctrl+,.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {shortcuts.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-[var(--radius-card)] border border-hairline bg-raised px-2 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-xs text-ink">{s.label}</p>
                <p className="font-mono text-xs text-faint">{s.keys} → {s.action}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShortcuts((prev) => prev.filter((x) => x.id !== s.id))}
                aria-label={`Eliminar atajo ${s.label}`}
                className="shrink-0"
              >
                Eliminar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
