"use client";
import { useState } from "react";
import { Card, SectionTitle, ApprovalCard } from "./ui";
import { union } from "../lib/mock";

export function Union() {
  const [decided, setDecided] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionTitle index="01">Actividad autónoma</SectionTitle>
        <ul className="flex flex-col gap-1.5 font-mono text-[13px]">
          {union.actividad.map((a) => (
            <li key={a} className="flex items-baseline gap-2">
              <span className="text-dim" aria-hidden>—</span>
              {a}
            </li>
          ))}
        </ul>
      </Card>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <SectionTitle index="02">Restauración de contexto</SectionTitle>
          <p className="text-sm text-faint">{union.contexto}</p>
        </Card>
        <Card>
          <SectionTitle index="03">Estado cognitivo</SectionTitle>
          <p className="font-mono text-[13px] text-faint">{union.cognitivo}</p>
        </Card>
      </div>
      <Card>
        <SectionTitle index="04">Alertas</SectionTitle>
        {union.alertas.map((a) => (
          <p key={a.texto} className="text-sm">
            <span className="mr-2 border border-ink/40 px-1 font-mono text-[11px] tracking-wide uppercase">
              riesgo
            </span>
            {a.texto}
          </p>
        ))}
      </Card>
      {decided ? (
        <p className="font-mono text-[13px] text-faint">Decisión registrada en gov/audit: {decided}.</p>
      ) : (
        <ApprovalCard
          title="Enviar propuesta a Nube ($1.200)"
          impact="Supera el umbral autónomo. Se registra en gov/audit al aprobar."
          onApprove={() => setDecided("propuesta aprobada")}
          onReject={() => setDecided("propuesta rechazada")}
        />
      )}
    </div>
  );
}
