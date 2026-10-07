export const deals = [
  { id: "d1", cliente: "Acme", titulo: "Plan anual", etapa: "Propuesta", valor: 4800, riesgo: false },
  { id: "d2", cliente: "Nube", titulo: "Piloto Q&A", etapa: "Negociación", valor: 1200, riesgo: true },
  { id: "d3", cliente: "Taller Ruiz", titulo: "Soporte", etapa: "Descubrimiento", valor: 600, riesgo: false },
];

export const etapas = ["Descubrimiento", "Propuesta", "Negociación", "Cierre"];

export const tickets = [
  { id: "t1", titulo: "Error al exportar", estado: "abierto", edad: "2d", sugerencia: "Artículo KB-14 cubre este caso (confianza 0.86)" },
  { id: "t2", titulo: "Duda facturación", estado: "pendiente", edad: "5h", sugerencia: "Borrador listo para aprobar" },
];

export const kbDocs = [
  { id: "kb1", titulo: "Límite de tarifa", frescura: "al día", citas: 12 },
  { id: "kb2", titulo: "ADR-0007 adapter", frescura: "revisar", citas: 4 },
];

export const union = {
  actividad: ["PR #42 abierto con evidencia", "3 tickets con borrador listo", "Snapshot diario verificado"],
  contexto: "Dev Q&A:Namespaces v1 + adapter con tests de contrato.",
  alertas: [{ texto: "Deal Nube sin movimiento 6 días", grave: true }],
  cognitivo: "6.2h trabajo profundo · 2 tareas inconclusas · sin señales de carga",
};
