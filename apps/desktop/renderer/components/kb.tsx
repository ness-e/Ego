"use client";
import { useState } from "react";
import { Card, SectionTitle, EmptyState } from "./ui";
import { kbDocs } from "../lib/mock";

export function KB() {
  const [q, setQ] = useState("");
  const docs = kbDocs.filter((d) => d.titulo.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex flex-col gap-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="¿Qué decidimos sobre…?"
        aria-label="Buscar en base de conocimiento"
        className="w-full max-w-xl rounded-md border border-hairline bg-panel px-3 py-1.5 text-sm placeholder:text-dim focus:border-ink/50 focus:outline-none"
      />
      {docs.length === 0 ? (
        <EmptyState title="Sin resultados" hint="La consulta sin resultado es señal de vacío de contenido." action="Crear documento" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-hairline">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.18em] text-faint uppercase">
                <th className="px-4 py-2 font-medium">Documento</th>
                <th className="px-4 py-2 font-medium">Frescura</th>
                <th className="px-4 py-2 font-medium">Citas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2.5 font-medium">{d.titulo}</td>
                  <td className="px-4 py-2.5 font-mono text-[13px] text-faint">{d.frescura}</td>
                  <td className="px-4 py-2.5 font-mono text-[13px]">{d.citas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Card>
        <SectionTitle index="KB-G">Grafo</SectionTitle>
        <p className="text-sm text-faint">Adyacencias kb/docs → dev/adrs → crm/deals (vista ECharts en P1).</p>
      </Card>
    </div>
  );
}
