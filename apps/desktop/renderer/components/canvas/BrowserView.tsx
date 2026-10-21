import React, { useEffect, useRef, useState } from "react";
import {
  classifyBrowserUrl,
  blockReasonMessage,
  type BrowserBlockReason,
} from "./workbench-guards.js";
import { Button } from "../ui-kit/Button.js";
import { Input } from "../ui-kit/Input.js";

/**
 * CFG-13 — Browser view solo-loopback (con guards navegación REV-02).
 *
 * Política (defensa en profundidad, espejo de `main.ts`):
 * renderer clasifica ANTES de montar el `<iframe>`; main niega de todos
 * modos cualquier navegación no-loopback a nivel ventana.
 * El iframe corre con `sandbox="allow-scripts"` SIN `allow-same-origin`:
 * el dev-server ejecuta su JS/HMR pero queda en origen opaco (no toca el
 * DOM del shell ni `window.ego`).
 *
 * 9 estados (contrato CFG-13, testeados en `test/workbench-cfg13.test.tsx`):
 * `empty | editing | invalid | blocked-protocol | blocked-external |
 *  blocked-credentials | loading | ready | error`
 */
export const BROWSER_STATUSES = [
  "empty",
  "editing",
  "invalid",
  "blocked-protocol",
  "blocked-external",
  "blocked-credentials",
  "loading",
  "ready",
  "error",
] as const;

export type BrowserStatus = (typeof BROWSER_STATUSES)[number];

function reasonToStatus(reason: BrowserBlockReason): BrowserStatus {
  switch (reason) {
    case "protocol":
      return "blocked-protocol";
    case "external":
      return "blocked-external";
    case "credentials":
      return "blocked-credentials";
    case "invalid":
      return "invalid";
  }
}

export interface BrowserViewProps {
  initialUrl?: string;
}

export const BrowserView: React.FC<BrowserViewProps> = ({ initialUrl = "" }) => {
  const [draft, setDraft] = useState(initialUrl);
  // `committed === null` → aún no se cargó nada (estados de edición).
  const [committed, setCommitted] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [frameKey, setFrameKey] = useState(0);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  /**
   * T10 (A4-31) — Re-validación del `src` en CADA render.
   *
   * `classifyBrowserUrl` solo se aplicaba en el submit: una URL ya
   * comiteada no volvía a pasar por el guard. Aquí se revalida el
   * `committed` en cada render y, si deja de ser válida, se desmonta el
   * iframe (fail-closed) en vez de dejar un iframe con origen externo.
   */
  const committedVerdict = committed === null ? null : classifyBrowserUrl(committed);
  const committedAllowed = committedVerdict?.allowed === true ? committed : null;
  const committedBlockReason =
    committedVerdict && !committedVerdict.allowed ? committedVerdict.reason : null;

  // Listeners nativos (no props React `onLoad/onError`): `error` del iframe
  // no llega vía delegación React en todos los runtimes; nativo es
  // determinista en Chromium y en happy-dom (tests).
  useEffect(() => {
    if (committed === null) return;
    const node = frameRef.current;
    if (!node) return;
    const onLoad = () => setPhase("ready");
    const onError = () => setPhase("error");
    node.addEventListener("load", onLoad);
    node.addEventListener("error", onError);
    return () => {
      node.removeEventListener("load", onLoad);
      node.removeEventListener("error", onError);
    };
  }, [committed, frameKey]);

  let status: BrowserStatus;
  let blockedReason: BrowserBlockReason | null = null;
  if (committedBlockReason !== null) {
    // T10 (A4-31): la URL comiteada ya no es válida → fail-closed.
    blockedReason = committedBlockReason;
    status = reasonToStatus(committedBlockReason);
  } else if (committedAllowed !== null) {
    status = phase;
  } else if (draft.trim() === "") {
    status = "empty";
  } else {
    const verdict = classifyBrowserUrl(draft);
    if (verdict.allowed) {
      status = "editing";
    } else {
      blockedReason = verdict.reason;
      status = reasonToStatus(verdict.reason);
    }
  }

  const canLoad = committed === null && status === "editing";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canLoad) return;
    const verdict = classifyBrowserUrl(draft);
    if (!verdict.allowed) return;
    setCommitted(verdict.url);
    setPhase("loading");
  };

  const handleClose = () => {
    setCommitted(null);
    setPhase("loading");
  };

  const handleReload = () => {
    setPhase("loading");
    setFrameKey((k) => k + 1);
  };

  return (
    <div
      className="flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-hairline bg-panel p-4 shadow-[var(--ego-elevation-l1)]"
      data-browser-status={status}
    >
      <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-2">
        <label htmlFor="cfg13-browser-url" className="sr-only">
          URL del dev-server (solo loopback)
        </label>
        <div className="min-w-0 flex-1">
          <Input
            id="cfg13-browser-url"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="http://localhost:5173"
            spellCheck={false}
            autoComplete="off"
            className="font-mono"
          />
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={!canLoad}>
          Cargar
        </Button>
        {committed !== null && (
          <>
            <Button type="button" variant="secondary" size="sm" onClick={handleReload}>
              Recargar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
              Cerrar
            </Button>
          </>
        )}
      </form>

      <div
        role="status"
        aria-live="polite"
        data-testid="browser-status"
        className="shrink-0 text-xs text-faint"
      >
        {status === "empty" && "Sin URL: escribí un dev-server loopback (p. ej. http://localhost:5173)."}
        {status === "editing" && "URL loopback válida: lista para cargar."}
        {blockedReason !== null && (
          <span className="text-warning">{blockReasonMessage(blockedReason)}</span>
        )}
        {status === "loading" && "Cargando dev-server…"}
        {status === "ready" && (
          <span className="font-mono text-xs text-dim">{committedAllowed}</span>
        )}
        {status === "error" && "El iframe reportó un error de carga. Verificá que el dev-server esté corriendo."}
      </div>

      {committedAllowed !== null && status !== "error" && (
        <iframe
          key={frameKey}
          ref={frameRef}
          title="Vista de dev-server (solo loopback)"
          src={committedAllowed}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          className="min-h-[320px] w-full flex-1 rounded-[var(--radius-card)] border border-hairline bg-paper"
        />
      )}
      {status === "error" && (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-hairline p-6 text-center">
          <p className="text-xs text-faint">No se pudo cargar el contenido.</p>
          <Button type="button" variant="secondary" size="sm" onClick={handleReload}>
            Reintentar
          </Button>
        </div>
      )}
    </div>
  );
};
