import React, { useState, useEffect, useRef } from "react";
import type { EditorProps } from "@ego/ui-runtime";
import { Copy, Check, FileCode, WarningCircle } from "@phosphor-icons/react";
import { EditorState, Compartment, type Extension } from "@codemirror/state";
import {
  EditorView as CMView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
} from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";

/**
 * T6 (EGO-FIND-57) — Editor de código CodeMirror 6 que EDITA de verdad.
 *
 * Antes (commit `135afdc`):
 *  - no había `onChange`: la edición nunca llegaba al Canvas,
 *  - `props.code` estaba en las deps del `useEffect` → el editor se
 *    destruía/recreaba en cada cambio (cursor, selección e undo perdidos),
 *  - el fallback a tabla estática ocultaba el fallo sin aviso al usuario.
 *
 * Ahora:
 *  - el montaje y la ACTUALIZACIÓN del documento están separados: el
 *    `EditorView` se monta una vez y el contenido se sincroniza con
 *    `view.dispatch({ changes })` (conserva cursor, selección e historial),
 *  - `onChange` propaga cada transacción al consumidor,
 *  - el fallback muestra un aviso visible en vez de una tabla silenciosa.
 */

interface EditorViewProps {
  props: EditorProps & { onChange?: (code: string) => void };
}

function getLanguageExtension(lang?: string): Extension {
  const normalized = (lang || "").toLowerCase();
  if (normalized === "python" || normalized === "py") return python();
  if (normalized === "markdown" || normalized === "md") return markdown();
  return javascript({ jsx: true, typescript: true });
}

/** Extensiones de CodeMirror: se construyen UNA vez por montaje. */
function buildExtensions(
  props: EditorProps,
  onDocChange: (doc: string) => void,
  readOnlyCompartment: Compartment
): Extension[] {
  const extensions: Extension[] = [
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
    oneDark,
    getLanguageExtension(props.language),
    // Solo-lectura: un `Compartment` permite reconfigurarlo SIN recrear el
    // editor (los `Facet` no se pueden cambiar vía `effects`).
    // OJO: `EditorView` está **sombreado** por el componente React exportado
    // en este módulo → hay que usar el alias `CMView` para lo de
    // `@codemirror/view`.
    readOnlyCompartment.of(EditorState.readOnly.of(Boolean(props.readOnly))),
    // T6: `updateListener` es la API de CodeMirror 6 para observar cada
    // transacción del documento (incluye `undo`/`redo`).
    CMView.updateListener.of((update) => {
      if (!update.docChanged) return;
      onDocChange(update.state.doc.toString());
    }),
    CMView.theme({
      "&": {
        fontSize: "12px",
        fontFamily: "var(--font-mono, monospace)",
        backgroundColor: "transparent",
        color: "var(--ego-color-ink, #f5f6f8)",
        height: "100%",
        maxHeight: "420px",
      },
      ".cm-content": {
        padding: "8px 0",
        caretColor: "#38bdf8",
      },
      ".cm-gutters": {
        backgroundColor: "rgba(255, 255, 255, 0.02)",
        color: "var(--ego-color-dim, #71717a)",
        borderRight: "1px solid rgba(255, 255, 255, 0.06)",
        fontSize: "11px",
      },
      ".cm-activeLine": {
        backgroundColor: "rgba(255, 255, 255, 0.04)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        color: "var(--ego-color-ink, #ffffff)",
      },
    }),
  ];

  if (props.lineNumbers !== false) {
    extensions.unshift(lineNumbers(), highlightActiveLineGutter(), foldGutter());
  }
  return extensions;
}

export const EditorView: React.FC<EditorViewProps> = ({ props }) => {
  const [copied, setCopied] = useState(false);
  const [cmFailed, setCmFailed] = useState(false);
  const [cmError, setCmError] = useState<string | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cmRef = useRef<CMView | null>(null);
  // Último documento aplicado: evita redispatch si `props.code` no cambió.
  const lastAppliedRef = useRef<string>(props.code ?? "");
  const onChangeRef = useRef(props.onChange);
  onChangeRef.current = props.onChange;
  // `Compartment` para reconfigurar el modo solo-lectura sin recrear el editor.
  const readOnlyCompartmentRef = useRef(new Compartment());

  const lines = (props.code ?? "").split("\n");

  const handleCopy = async () => {
    try {
      const current =
        cmRef.current && !props.readOnly
          ? cmRef.current.state.doc.toString()
          : props.code;
      await navigator.clipboard.writeText(current);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Error al copiar código:", err);
    }
  };

  // --- Montaje: UNA vez. Las deps son estables a propósito. ---------------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || cmFailed) return;
    let view: CMView | null = null;
    try {
      const state = EditorState.create({
        doc: props.code ?? "",
        extensions: buildExtensions(
          props,
          (doc) => {
            if (doc === lastAppliedRef.current) return;
            lastAppliedRef.current = doc;
            onChangeRef.current?.(doc);
          },
          readOnlyCompartmentRef.current
        ),
      });

      view = new CMView({
        state,
        parent: mount,
      });

      // Atributos de testing (paridad con la suite existente).
      view.dom.setAttribute("data-testid", "pm-editor");
      view.dom.setAttribute("data-language", props.language || "typescript");
      view.dom.setAttribute("spellcheck", "false");

      cmRef.current = view;
    } catch (err) {
      // T6: el fallo NO se enmascara — se registra y se muestra al usuario.
      console.warn("[EditorView] CodeMirror 6 mount fallido, fallback a tabla:", err);
      setCmError(err instanceof Error ? err.message : String(err));
      setCmFailed(true);
      return;
    }
    return () => {
      view?.destroy();
      if (cmRef.current === view) cmRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmFailed]);

  // --- Actualización del documento: SIN recrear el editor. ---------------
  useEffect(() => {
    const view = cmRef.current;
    if (!view) return;
    const next = props.code ?? "";
    if (next === lastAppliedRef.current) return;
    lastAppliedRef.current = next;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
    });
  }, [props.code]);

  // El modo solo-lectura se puede togglear sin recrear el editor.
  useEffect(() => {
    const view = cmRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure(
        EditorState.readOnly.of(Boolean(props.readOnly))
      ),
    });
  }, [props.readOnly]);

  return (
    <div className="rounded-xl border border-hairline bg-panel shadow-xs overflow-hidden select-text">
      {/* Header (contrato intacto) */}
      <div className="flex items-center justify-between px-3 py-2 bg-raised/80 border-b border-hairline text-xs">
        <div className="flex items-center gap-2">
          <FileCode size={14} className="text-cyan-400" />
          <span className="font-mono text-ink font-semibold">
            {props.filePath || props.title || "editor"}
          </span>
          <span className="rounded bg-hairline px-1.5 py-0.2 text-[10px] font-mono text-dim uppercase">
            {props.language}
          </span>
          {props.readOnly && (
            <span className="text-[10px] text-faint font-mono">Solo lectura</span>
          )}
        </div>
        <button
          onClick={handleCopy}
          aria-label="Copiar contenido"
          data-testid="editor-copy-button"
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-dim hover:text-ink hover:bg-hairline transition-colors"
          title="Copiar contenido"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          <span>{copied ? "Copiado" : "Copiar"}</span>
        </button>
      </div>

      {/* Cuerpo CodeMirror 6 profesional */}
      {!cmFailed ? (
        <div className="relative bg-paper max-h-[420px] overflow-auto">
          <div ref={mountRef} className="text-[12px] leading-relaxed" />
          {/* Contenido oculto para lectores/tests que buscan texto plano */}
          <span className="sr-only">{props.code}</span>
        </div>
      ) : (
        /* Fallback: tabla legible + AVISO VISIBLE del fallo (T6). */
        <>
          <div
            role="alert"
            data-editor-fallback="true"
            className="flex items-center gap-2 border-b border-amber-800/40 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-300"
          >
            <WarningCircle size={13} className="shrink-0" aria-hidden />
            <span>
              El editor interactivo no pudo montarse; se muestra una vista de solo lectura.
              {cmError ? ` Detalle: ${cmError}` : ""}
            </span>
          </div>
          <div className="p-3 bg-paper overflow-x-auto max-h-[420px] font-mono text-[12px] leading-relaxed text-ink">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-raised">
                    {props.lineNumbers !== false && (
                      <td className="w-8 pr-3 text-right text-dim select-none text-[11px]">
                        {idx + 1}
                      </td>
                    )}
                    <td className="whitespace-pre">{line || " "}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
