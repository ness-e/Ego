import React, { useState } from "react";
import type { EditorProps } from "@ego/ui-runtime";
import { Copy, Check, FileCode } from "@phosphor-icons/react";

interface EditorViewProps {
  props: EditorProps;
}

export const EditorView: React.FC<EditorViewProps> = ({ props }) => {
  const [copied, setCopied] = useState(false);
  const lines = props.code.split("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Error al copiar código:", err);
    }
  };

  return (
    <div className="rounded-xl border border-hairline bg-panel shadow-xs overflow-hidden select-text">
      {/* Header */}
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

      {/* Code body with line numbers */}
      <div className="p-3 bg-zinc-950 overflow-x-auto max-h-[420px] font-mono text-[12px] leading-relaxed text-zinc-200">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-white/5">
                {props.lineNumbers !== false && (
                  <td className="w-8 pr-3 text-right text-zinc-600 select-none text-[11px]">
                    {idx + 1}
                  </td>
                )}
                <td className="whitespace-pre">{line || " "}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
