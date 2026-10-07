import { Card, SectionTitle, EmptyState } from "./ui";

export function Journal() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionTitle index="J-01">Hoy</SectionTitle>
        <p className="text-sm text-faint">Captura por chat y dictado. Señales derivadas con componentes explicados.</p>
      </Card>
      <Card>
        <SectionTitle index="J-02">Carga semanal</SectionTitle>
        <p className="font-mono text-[13px] text-faint">Trabajo profundo 6.2h · inconclusas 2 · aplicar o descartar.</p>
      </Card>
      <EmptyState title="Sin entradas aún" hint="El diario se llena desde el chat o el dictado." action="Dictar nota" />
    </div>
  );
}

export function Dev() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionTitle index="D-01">Mapa semántico</SectionTitle>
        <p className="font-mono text-[13px] text-faint">dev/files · dev/errors · dev/adrs con citas a archivos y decisiones.</p>
      </Card>
      <Card>
        <SectionTitle index="D-02">PRs — 0 abiertos</SectionTitle>
        <p className="text-sm text-faint">Merge a main y deploys siempre con confirmación humana.</p>
      </Card>
    </div>
  );
}

export function Gov() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <SectionTitle index="G-01">Reglas</SectionTitle>
        <p className="text-sm text-faint">Envíos y pagos exigen aprobación explícita. Umbrales conservadores.</p>
      </Card>
      <Card>
        <SectionTitle index="G-02">Auditoría</SectionTitle>
        <p className="font-mono text-[13px] text-faint">gov/audit append-only con veredicto Jev completo + kill switch en 1 clic.</p>
      </Card>
    </div>
  );
}
