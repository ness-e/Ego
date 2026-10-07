"use client";
import { useState } from "react";
import { Card, SectionTitle } from "./ui";
import { tickets } from "../lib/mock";

export function Support() {
  const [sel, setSel] = useState(tickets[0]);
  return (
    <div className="grid grid-cols-[280px_1fr] gap-4">
      <div className="flex flex-col gap-2">
        {tickets.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setSel(t)}
            className={`rounded-md border p-3 text-left ${
              sel.id === t.id ? "border-ink bg-raised" : "border-hairline bg-panel"
            }`}
          >
            <p className="font-mono text-[11px] text-dim">T-{i + 1} · {t.estado} · {t.edad}</p>
            <p className="mt-0.5 text-sm font-medium">{t.titulo}</p>
          </button>
        ))}
      </div>
      <Card>
        <SectionTitle index="S-01">{sel.titulo}</SectionTitle>
        <p className="mb-2 text-sm">
          <span className="text-faint">Por qué sugerí esto: </span>
          {sel.sugerencia}
        </p>
        <p className="text-sm text-faint">Historial completo + editor de versiones del artículo vinculado.</p>
      </Card>
    </div>
  );
}
