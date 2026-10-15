import React, { useState, useEffect, useRef } from "react";
import type { EditorProps } from "@ego/ui-runtime";
import { Copy, Check, FileCode } from "@phosphor-icons/react";
import { Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { EditorView as PMView } from "prosemirror-view";

interface EditorViewProps {
  props: EditorProps;
}

// Schema básico mínimo: doc > code_block(text). Sin prosemirror-schema-basic
// para no sumar dep; suficiente para visor/editable mono-bloque.
const pmSchema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM: () => ["p", 0],
    },
    code_block: {
      content: "text*",
      group: "block",
      attrs: { language: { default: "typescript" } },
      code: true,
      defining: true,
      parseDOM: [{ tag: "pre", preserveWhitespace: "full" }],
      toDOM: (node) => ["pre", ["code", { "data-language": node.attrs.language }, 0]],
    },
    text: { group: "inline" },
    hard_break: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{ tag: "br" }],
      toDOM: () => ["br"],
    },
  },
  marks: {},
});

function buildDoc(code: string, language: string) {
  const text = code ?? "";
  const block =
    text.length > 0
      ? pmSchema.node("code_block", { language }, pmSchema.text(text))
      : pmSchema.node("code_block", { language });
  return pmSchema.node("doc", null, [block]);
}

export const EditorView: React.FC<EditorViewProps> = ({ props }) => {
  const [copied, setCopied] = useState(false);
  const [pmFailed, setPmFailed] = useState(false);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const pmRef = useRef<PMView | null>(null);
  const lines = props.code.split("\n");
  const showPlaceholder = !props.code;

  const handleCopy = async () => {
    try {
      const current =
        pmRef.current && !props.readOnly
          ? pmRef.current.state.doc.textContent
          : props.code;
      await navigator.clipboard.writeText(current);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Error al copiar código:", err);
    }
  };

  // Monta ProseMirror mínimo: schema básico + placeholder + readonly según props.
  // Contrato registry intacto: misma firma { props: EditorProps }, mismo header
  // (filePath/title, language, readOnly badge, copiar). Si PM falla → tabla legacy.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || pmFailed) return;
    let view: PMView | null = null;
    try {
      const state = EditorState.create({
        schema: pmSchema,
        doc: buildDoc(props.code, props.language),
      });
      view = new PMView(mount, {
        state,
        editable: () => !props.readOnly,
        attributes: {
          "data-testid": "pm-editor",
          "data-language": props.language,
          spellcheck: "false",
        },
      });
      pmRef.current = view;
    } catch (err) {
      console.warn("[EditorView] ProseMirror mount fallido, fallback a tabla:", err);
      setPmFailed(true);
      return;
    }
    return () => {
      view?.destroy();
      if (pmRef.current === view) pmRef.current = null;
    };
    // Recrea ante cambio de código/readonly/idioma (visor declarativo; no
    // edición colaborativa en P0). Intencionalmente sin deps de view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.code, props.readOnly, props.language, pmFailed]);

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
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-dim hover:text-ink hover:bg-hairline transition-colors"
          title="Copiar contenido"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          <span>{copied ? "Copiado" : "Copiar"}</span>
        </button>
      </div>

      {/* Cuerpo ProseMirror mínimo */}
      {!pmFailed ? (
        <div className="relative bg-paper max-h-[420px] overflow-auto">
          <div
            ref={mountRef}
            className="p-3 font-mono text-[12px] leading-relaxed text-ink [&_.ProseMirror]:outline-none [&_.ProseMirror]:whitespace-pre-wrap [&_.ProseMirror]:break-words"
          />
          {showPlaceholder && (
            <div className="pointer-events-none absolute top-3 left-3 font-mono text-[12px] text-faint">
              Escribe código…
            </div>
          )}
          {/* Contenido oculto para lectores/tests que buscan texto plano */}
          <span className="sr-only">{props.code}</span>
        </div>
      ) : (
        /* Fallback legacy con números de línea */
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
      )}
    </div>
  );
};
