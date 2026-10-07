from pathlib import Path
from html import escape
import datetime

root = Path(__file__).resolve().parents[1]
out = root / "docs" / "ego-review-tracker.html"

DECISIONS = {
    str(root / "docs" / "prd" / "00-overview.md"): {
        "status": "Con cambios",
        "decision": "Ficha al día desktop: tagline 1+1 + Electron + P0 3m + 23.",
        "notes": "Revisable; no congelada."
    },
    str(root / "docs" / "product" / "personas.md"): {
        "status": "Con cambios",
        "decision": "Desktop: comparativa instalador + land KB+CRM + pricing; TAM archivado.",
        "notes": "prd/05 congelado."
    },
    str(root / "docs" / "product" / "vision.md"): {
        "status": "Con cambios",
        "decision": "Desktop: P5 cascada+offline + P6 instalador local.",
        "notes": "prd/04 congelado como histórico."
    },
    str(root / "docs" / "prd" / "04-3-visi-n-filosof-a-y-marca.md"): {
        "status": "Con cambios",
        "decision": "Congelado histórico; fuente vigente en product/vision.md.",
        "notes": "No editar salvo cabecera."
    },
    str(root / "docs" / "product" / "concepto.md"): {
        "status": "Con cambios",
        "decision": "Desktop: P0 KB+CRM + renderer aislado preload.",
        "notes": "prd/06 congelado."
    },
    str(root / "docs" / "prd" / "06-5-concepto-de-producto.md"): {
        "status": "Revisado",
        "decision": "Banner limpio: 23 vigentes.",
        "notes": "Sin pendientes."
    },
    str(root / "apps" / "desktop" / "src" / "main.ts"): {
        "status": "Con cambios",
        "decision": "Dispatch fn.apply + handlers ipc.* completos; prereqs Node/Python.",
        "notes": "Sin Go; renderer placeholder."
    },
    str(root / "apps" / "desktop" / "src" / "preload.ts"): {
        "status": "Con cambios",
        "decision": "Canales ipc.* (MCP ego.* es otro plano).",
        "notes": "contextIsolation."
    },
    str(root / "apps" / "desktop" / "src" / "ipc.ts"): {
        "status": "Con cambios",
        "decision": "Contrato ipc.* unificado.",
        "notes": "Sin colisión ego.*."
    },
    str(root / "apps" / "desktop" / "ego.namespaces.json"): {
        "status": "Con cambios",
        "decision": "24 base + org_id + formato versionado.",
        "notes": "Expansión a slash en P1."
    },
    str(root / "apps" / "desktop" / "package.json"): {
        "status": "Con cambios",
        "decision": "vantadb 0.8.0 exacto (sintaxis npm).",
        "notes": "electron pin en spike."
    },
    str(root / "apps" / "desktop" / "tsconfig.json"): {
        "status": "Revisado",
        "decision": "Build tsc estricto.",
        "notes": "Sin pendientes."
    },
    str(root / "apps" / "desktop" / "renderer" / "index.html"): {
        "status": "Con cambios",
        "decision": "Placeholder; Next export lo sustituye.",
        "notes": "Pendiente renderer real."
    },
    str(root / "packages" / "memory" / "EgoMemoryAdapter.ts"): {
        "status": "Con cambios",
        "decision": "Contrato 8 ops multi-arg.",
        "notes": "Stub; impl P0 pendiente."
    },
    str(root / "docs" / "prd" / "05-4-problema-mercado-y-personas.md"): {
        "status": "Con cambios",
        "decision": "Congelado histórico; fuente vigente en product/personas.md.",
        "notes": "No editar salvo cabecera."
    },
    str(root / "docs" / "product" / "modulos.md"): {
        "status": "Con cambios",
        "decision": "Refase desktop: P0 KB+CRM, P1 Diario+DevQA+Soporte+polling; E2B/n8n fuera.",
        "notes": "prd/12 congelado."
    },
    str(root / "docs" / "prd" / "12-11-m-dulos-funcionales.md"): {
        "status": "Revisado",
        "decision": "Banner limpio: GitHub 11.8 + Voz §14.",
        "notes": "Sin pendientes."
    },
    str(root / "docs" / "product" / "ux-ui.md"): {
        "status": "Con cambios",
        "decision": "Desktop: IPC-bridge + pin tras spike; Tremor acotado + ECharts lazy.",
        "notes": "prd/13 congelado; guía assistant-ui/Electron."
    },
    str(root / "docs" / "product" / "mascota.md"): {
        "status": "Con cambios",
        "decision": "Mascota sombra: superficie por área + 4 prototipos; Rive provisional.",
        "notes": "Carpeta apps/desktop/src/mascot/; 5 subagentes."
    },
    str(root / "apps" / "desktop" / "src" / "mascot" / "mascot.ts"): {
        "status": "Con cambios",
        "decision": "Contrato {area, mood} + acentos P0.",
        "notes": "Sin lógica en renderer."
    },
    str(root / "docs" / "prd" / "13-12-experiencia-de-usuario-e-interfaz.md"): {
        "status": "Revisado",
        "decision": "Banner limpio: pin tras spike.",
        "notes": "Sin pendientes."
    },
    str(root / "docs" / "architecture" / "vision-general.md"): {
        "status": "Con cambios",
        "decision": "Desktop: main/preload/renderer + instalador + fuera P0; IPC verificado web.",
        "notes": "prd/07 congelado."
    },
    str(root / "docs" / "prd" / "07-6-arquitectura-general-y-pol-tica-de-lenguajes.md"): {
        "status": "Con cambios",
        "decision": "Congelado histórico; fuente vigente en architecture/vision-general.md.",
        "notes": "No editar salvo cabecera."
    },
    str(root / "docs" / "prd" / "08-7-vantadb-columna-vertebral-de-memoria.md"): {
        "status": "Con cambios",
        "decision": "Congelado histórico; fuente vigente en architecture/memoria-vantadb.md.",
        "notes": "Foto 0.8.0, no contrato final."
    },
    str(root / "docs" / "prd" / "09-8-esquema-de-datos-namespaces-grafo-y-ttl.md"): {
        "status": "Con cambios",
        "decision": "Congelado histórico; fuente vigente en architecture/namespaces.md.",
        "notes": "Typo susbpace corregido en vigente."
    },
    str(root / "docs" / "prd" / "10-9-jev-motor-de-decisiones-estructuradas.md"): {
        "status": "Con cambios",
        "decision": "Congelado histórico; fuente vigente en architecture/jev.md.",
        "notes": "70% y latencias como objetivos."
    },
    str(root / "docs" / "prd" / "11-10-modelo-multi-agente-departamental.md"): {
        "status": "Con cambios",
        "decision": "Congelado histórico; 23 vigentes en architecture/agentes.md.",
        "notes": "9 como Ola 1."
    },
    str(root / "docs" / "architecture" / "memoria-vantadb.md"): {
        "status": "Con cambios",
        "decision": "Desktop: napi main + user-data + rebuild; Studio inspector.",
        "notes": "Origen en investigacion-de-diseño v2.0/v2.1 §2; revalidar contra VantaDB 1.0."
    },
    str(root / "docs" / "architecture" / "namespaces.md"): {
        "status": "Con cambios",
        "decision": "Desktop: ACL en main + renderer sin acceso.",
        "notes": "Cuarentena patrón; 16 fusionados."
    },
    str(root / "docs" / "architecture" / "jev.md"): {
        "status": "Con cambios",
        "decision": "Jev real verificado web + fallback offline desktop.",
        "notes": "Ver prd/10; harness LangGraph/Mastra."
    },
    str(root / "docs" / "architecture" / "agentes.md"): {
        "status": "Con cambios",
        "decision": "Desktop + P0 4 agentes + P1 5 base; single-user P0-P2.",
        "notes": "ACL propia hasta VantaDB 1.0; gob verificado web."
    },
    str(root / "docs" / "engineering" / "stack.md"): {
        "status": "Con cambios",
        "decision": "Desktop + actualización externa: gate Mastra, tabla LLM corregida, Tremor plan B, WSL2, Flux/Docling.",
        "notes": "prd/17 congelado; ux-ui/integraciones notas; revalidar P0."
    },
    str(root / "docs" / "prd" / "17-16-stack-tecnol-gico-y-matriz-de-librer-as.md"): {
        "status": "Con cambios",
        "decision": "Congelado histórico; fuente vigente en engineering/stack.md.",
        "notes": "No editar salvo cabecera."
    },
    str(root / "docs" / "engineering" / "lenguajes.md"): {
        "status": "Con cambios",
        "decision": "Desktop Electron IPC + Python/Go instalados ya + gates; napi en main.",
        "notes": "prd/07 congelado; web sin evidencia 2026-10-05."
    },
    str(root / "docs" / "engineering" / "integraciones.md"): {
        "status": "Con cambios",
        "decision": "Desktop: MCP local P0 + GitHub polling P1 + n8n/E2B fuera + keychain.",
        "notes": "prd/14 congelado; web sin evidencia 2026-10-05."
    },
    str(root / "docs" / "prd" / "14-13-integraciones.md"): {
        "status": "Con cambios",
        "decision": "Congelado histórico; fuente vigente en engineering/integraciones.md.",
        "notes": "No editar salvo cabecera."
    },
    str(root / "docs" / "operations" / "despliegue.md"): {
        "status": "Con cambios",
        "decision": "Desktop: builder+firma+update; datos local; prereqs bloqueantes.",
        "notes": "prd/07 §6.3 archivado; web sin evidencia 2026-10-05."
    },
    str(root / "docs" / "operations" / "snapshots-respaldo.md"): {
        "status": "Con cambios",
        "decision": "Local + ilimitada + doble escritura; tarea main + verify mensual.",
        "notes": "prd/09 §8.4 congelado; formato VDBJSON."
    },
    str(root / "docs" / "testing" / "estrategia.md"): {
        "status": "Con cambios",
        "decision": "Alineado P0 KB+CRM sin betas; P1 Diario+DevQA; prueba/ externa.",
        "notes": "prd/18 tests aquí, fases en roadmap."
    },
    str(root / "docs" / "prd" / "18-17-roadmap-con-hitos-y-criterios-de-salida.md"): {
        "status": "Con cambios",
        "decision": "Congelado histórico; tests en testing/estrategia.md, fases en roadmap.",
        "notes": "No editar salvo cabecera."
    },
    str(root / "docs" / "roadmap" / "roadmap.md"): {
        "status": "Con cambios",
        "decision": "T0 2026-10-05: P0→2027-01 + P1→2027-05 + P2→2027-11; Jev numérico; CRM ≥25%.",
        "notes": "prd/18 y prd/26 congelados."
    },
    str(root / "docs" / "prd" / "26-25-priorizaci-n-por-olas-y-roadmap-actualizado.md"): {
        "status": "Con cambios",
        "decision": "Congelado histórico; olas vigentes en roadmap/roadmap.md.",
        "notes": "No editar salvo cabecera."
    },
    str(root / "docs" / "roadmap" / "metricas-okr.md"): {
        "status": "Con cambios",
        "decision": "NS + recorte P0 + OKRs sin betas desktop.",
        "notes": "prd/19 congelado."
    },
    str(root / "docs" / "prd" / "19-18-m-tricas-north-star-y-okrs.md"): {
        "status": "Con cambios",
        "decision": "Congelado histórico; vigente en roadmap/metricas-okr.md.",
        "notes": "No editar salvo cabecera."
    },
    str(root / "docs" / "references" / "fuentes.md"): {
        "status": "Con cambios",
        "decision": "Curada foto Oct-2026; fuera P0 marcado; reintentar P0.",
        "notes": "prd/28 congelado; red bloqueada hoy."
    },
    str(root / "docs" / "prd" / "28-26-fuentes-citadas.md"): {
        "status": "Con cambios",
        "decision": "Congelado histórico; vigente en references/fuentes.md.",
        "notes": "No editar salvo cabecera."
    },
    str(root / "docs" / "references" / "glosario.md"): {
        "status": "Con cambios",
        "decision": "Ampliado desktop: 14 términos vigentes.",
        "notes": "Sin prd histórico propio."
    },
    str(root / "docs" / "references" / "diseno-skills.md"): {
        "status": "Con cambios",
        "decision": "Inventario skills + top 8 Ego.",
        "notes": "3 subagentes + web."
    },
    str(root / "docs" / "references" / "gui-desktop.md"): {
        "status": "Con cambios",
        "decision": "10 reglas Electron + tabla apps.",
        "notes": "URLs verificadas."
    },
    str(root / "docs" / "references" / "repos-intel.md"): {
        "status": "Con cambios",
        "decision": "17 repos + veredicto assistant-ui + Dots.",
        "notes": "Clones en repos-referencia/."
    },
    str(root / "docs" / "prd" / "15-14-voz-y-multimodalidad.md"): {
        "status": "Con cambios",
        "decision": "Archivado P2 desktop; vigente modulos+stack.",
        "notes": "Voz solo §14; Whisper local."
    },
    str(root / "docs" / "prd" / "16-15-anal-tica-dashboards-y-detecci-n-de-patrones.md"): {
        "status": "Con cambios",
        "decision": "Archivado distribuido: ux-ui + estrategia + metricas.",
        "notes": "Ética cognitiva vigente."
    },
    str(root / "docs" / "prd" / "20-19-riesgos-limitaciones-y-tica.md"): {
        "status": "Con cambios",
        "decision": "Archivado distribuido desktop; VPS/n8n fuera P0.",
        "notes": "Ética diario y aprobaciones vigentes."
    },
    str(root / "docs" / "prd" / "21-20-pr-ximos-pasos-accionables.md"): {
        "status": "Con cambios",
        "decision": "Archivado; vigente roadmap nuevo + estrategia.",
        "notes": "Plan 30/60/90 server sustituido."
    },
    str(root / "docs" / "prd" / "22-21-validaci-n-externa-de-la-tesis-de-ego.md"): {
        "status": "Con cambios",
        "decision": "Archivado distribuido desktop; Compose→instalador.",
        "notes": "Tesis y refutación vigentes."
    },
    str(root / "docs" / "prd" / "23-22-el-atlas-del-fundador-solitario-el-mapa-completo-de-necesidades.md"): {
        "status": "Con cambios",
        "decision": "Archivado expansión; 23 vigentes en agentes.",
        "notes": "42 necesidades como mapa, no exhaustivo."
    },
    str(root / "docs" / "prd" / "24-23-departamentos-completos-de-9-a-23-agentes.md"): {
        "status": "Con cambios",
        "decision": "Archivado; 14 fichas fusionadas en agentes.",
        "notes": "Server-deps a desktop en P1+."
    },
    str(root / "docs" / "prd" / "25-24-arquitectura-expandida-v2-1-namespaces-routing-y-costes-con-23-agentes.md"): {
        "status": "Con cambios",
        "decision": "Archivado distribuido desktop.",
        "notes": "Costos VPS fuera; tabla LLM en stack."
    },
    str(root / "docs" / "prd" / "27-anexo-a-matriz-de-trazabilidad-de-requisitos.md"): {
        "status": "Con cambios",
        "decision": "Archivado contrato histórico desktop.",
        "notes": "Aceptación en estrategia/roadmap."
    },
    str(root / "docs" / "index.md"): {
        "status": "Con cambios",
        "decision": "Cierre: filas desktop+P0.",
        "notes": "Navegación vigente."
    },
    str(root / "docs" / "PLAN-EGO.md"): {
        "status": "Con cambios",
        "decision": "Reescrito desktop: Electron + P0 3m + prereqs.",
        "notes": "Plan web sustituido."
    },
    str(root / "README.md"): {
        "status": "Con cambios",
        "decision": "Tagline 1+1 + desktop.",
        "notes": "Principio P0 = cierre global."
    },
    str(root / "AGENTS.md"): {
        "status": "Con cambios",
        "decision": "Desktop + adapter; P0 = cierre global.",
        "notes": "Regla oro vigente."
    },
    str(root / "docs" / "prd" / "README.md"): {
        "status": "Revisado",
        "decision": "Índice congelado; ya declara fuentes vigentes.",
        "notes": "Sin cambios necesarios."
    },
}

SCOPE_DIRS = ["docs", "apps", "packages", "scripts"]
SCOPE_FILES = ["README.md", "AGENTS.md"]
SKIP_SUFFIX = {".db", ".log", ".png", ".jpg", ".jpeg"}
rows = []

for s_dir in SCOPE_DIRS:
    d_path = root / s_dir
    if not d_path.exists():
        continue
    for p in sorted(d_path.rglob("*")):
        if p.is_dir():
            continue
        if any(part in {".git", ".opencode", "node_modules", "__pycache__", "out", ".next"} for part in p.parts):
            continue
        if p.suffix.lower() in SKIP_SUFFIX:
            continue
        rel = p.relative_to(root)
        status = DECISIONS.get(str(p), {})
        rows.append((rel, p.stat().st_size, p.suffix or "file", status))

for s_file in SCOPE_FILES:
    f_path = root / s_file
    if f_path.exists():
        status = DECISIONS.get(str(f_path), {})
        rows.append((Path(s_file), f_path.stat().st_size, f_path.suffix or "file", status))

def _opts(cur):
    out = []
    for o in ["Pendiente", "Revisado", "Con cambios", "Rechazado"]:
        out.append(f"<option{' selected' if o == cur else ''}>{o}</option>")
    return "".join(out)

body_rows = []
for rel, size, typ, status in rows:
    cur = status.get('status', 'Pendiente')
    body_rows.append(f"""<tr data-reviewed='{cur == 'Revisado'}'><td><input type='checkbox' class='reviewed' {'checked' if cur == 'Revisado' else ''}></td><td><code>{escape(str(rel))}</code></td><td>{escape(typ)}</td><td>{size}</td><td><select class='decision-status'>{_opts(cur)}</select></td><td><input class='decision' value='{escape(status.get('decision', ''))}' placeholder='Decisión tomada o pendiente'></td><td><textarea class='notes' placeholder='Observaciones...'>{escape(status.get('notes', ''))}</textarea></td></tr>""")

html = f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ego — Revisión y decisiones</title>
<style>
:root {{ --bg:#0b1020; --card:#111827; --muted:#94a3b8; --text:#e5e7eb; --line:#243244; --accent:#38bdf8; }}
* {{ box-sizing:border-box; }} body {{ margin:0; background:var(--bg); color:var(--text); font-family:Inter, system-ui, sans-serif; }}
header {{ padding:24px; background:linear-gradient(135deg,#111827,#1e293b); border-bottom:1px solid var(--line); }}
main {{ padding:20px; }} .toolbar {{ display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; }} input, select, textarea {{ background:#0f172a; color:#e5e7eb; border:1px solid var(--line); border-radius:8px; padding:8px; }}
input[type=checkbox] {{ transform:scale(1.2); }} .search {{ flex:1; min-width:220px; }} table {{ width:100%; border-collapse:collapse; background:rgba(17,24,39,.8); border-radius:14px; overflow:hidden; }} th,td {{ padding:10px; border-bottom:1px solid var(--line); vertical-align:top; font-size:14px; }} th {{ background:#0f172a; color:#cbd5e1; text-align:left; }} td textarea {{ width:280px; min-height:60px; }} .badge {{ display:inline-block; padding:2px 8px; border-radius:999px; background:#164e63; color:#cffafe; font-size:12px; }}
</style>
</head>
<body>
<header><h1>Ego — Revisión de documentos</h1><p>Generated {datetime.date.today().isoformat()} · Total archivos: {len(rows)}</p></header>
<main>
<div class='toolbar'><input class='search' placeholder='Buscar archivo...'><select id='filter'><option>Todos</option><option>Revisado</option><option>Pendiente</option><option>Con cambios</option><option>Rechazado</option></select></div>
<table><thead><tr><th>✓</th><th>Ruta</th><th>Tipo</th><th>Bytes</th><th>Estado</th><th>Decisión</th><th>Notas</th></tr></thead><tbody>{''.join(body_rows)}</tbody></table>
<script>
const rows=[...document.querySelectorAll('tbody tr')];
const search=document.querySelector('.search');
const filter=document.querySelector('#filter');
function apply() {{
  const q=search.value.toLowerCase(); const f=filter.value;
  for (const r of rows) {{
    const path=r.querySelector('code').textContent.toLowerCase();
    const state=r.querySelector('select').selectedIndex === 1 ? 'Revisado' : (r.querySelector('select').selectedIndex === 2 ? 'Con cambios' : (r.querySelector('select').selectedIndex === 3 ? 'Rechazado' : 'Pendiente'));
    r.style.display=(path.includes(q) && (f==='Todos'||state===f)) ? '' : 'none';
  }}
}}
search.addEventListener('input',apply); filter.addEventListener('change',apply);
</script>
</main></body></html>'''
out.write_text(html, encoding='utf-8')
print('wrote', out)
