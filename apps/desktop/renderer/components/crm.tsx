"use client";
import { useState } from "react";
import { Card, SectionTitle } from "./ui";
import { deals, etapas } from "../lib/mock";

export function CRM() {
  const [sel, setSel] = useState(deals[1]);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-3">
        {etapas.map((e, i) => (
          <div key={e}>
            <p className="mb-2 font-mono text-[11px] tracking-[0.18em] text-faint uppercase">
              <span className="mr-1 text-dim">0{i + 1}</span>
              {e}
            </p>
            <div className="flex min-h-24 flex-col gap-2 border-t border-hairline pt-2">
              {deals
                .filter((d) => d.etapa === e)
                .map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSel(d)}
                    className={`rounded-md border p-3 text-left transition-transform active:scale-[0.98] ${
                      sel.id === d.id ? "border-ink bg-raised" : "border-hairline bg-panel"
                    }`}
                  >
                    <p className="text-sm font-medium">{d.cliente}</p>
                    <p className="font-mono text-xs text-faint">
                      {d.titulo} · ${d.valor}
                    </p>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      <Card>
        <SectionTitle index="CRM-F">Ficha: {sel.cliente} — {sel.titulo}</SectionTitle>
        <p className="text-sm text-faint">
          Etapa {sel.etapa} · {sel.riesgo ? "riesgo churn" : "sano"} · timeline de deals, tickets, pedidos y
          facturas vinculados por aristas del grafo.
        </p>
      </Card>
    </div>
  );
}
