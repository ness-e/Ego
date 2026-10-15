import type { LayoutTemplate } from "../schemas/components.js";

export const dailyReportTemplate: LayoutTemplate = {
  id: "daily-report",
  name: "Reporte diario",
  description: "Resumen diario: KPIs, actividad por hora y tabla de actividades",
  category: "operations",
  layoutType: "grid",
  creator: "ego.nucleus",
  createdAt: Date.now(),
  components: [
    {
      id: "daily-header",
      type: "card",
      props: {
        id: "daily-header",
        title: "Reporte diario",
        subtitle: "Resumen generado por Sub-Ego",
        description: "KPIs + actividad por hora + detalle",
        actions: [],
      },
    },
    {
      id: "daily-hourly",
      type: "chart",
      props: {
        id: "daily-hourly",
        title: "Actividad por hora",
        chartType: "area",
        data: [{ h: "09:00", n: 0 }],
        xKey: "h",
        yKeys: ["n"],
        legend: true,
      },
    },
    {
      id: "daily-table",
      type: "table",
      props: {
        id: "daily-table",
        title: "Actividades",
        columns: [
          { key: "hora", label: "Hora", type: "text", sortable: false },
          { key: "evento", label: "Evento", type: "text", sortable: false },
          { key: "proyecto", label: "Proyecto", type: "text", sortable: false },
        ],
        rows: [],
        actions: [],
      },
    },
  ],
};
