from pathlib import Path

root = Path(__file__).resolve().parents[1]

dirs = [
    "docs/product", "docs/engineering", "docs/operations", "docs/architecture",
    "docs/testing", "docs/roadmap", "docs/references",
]
for d in dirs:
    (root / d).mkdir(parents=True, exist_ok=True)

files = {
    "docs/index.md": "# Índice de documentación\n\n- product/: qué construye Ego\n- engineering/: cómo se construye\n- operations/: cómo se despliega\n- architecture/: diseño y decisiones\n- testing/: calidad y contratos\n- roadmap/: planificación y gates\n- references/: fuentes y glosario\n- prd/: secciones del PRD v2.1\n",
    "docs/product/vision.md": "# Visión\n\nVer docs/prd/04-3-visi-n-filosof-a-y-marca.md\n",
    "docs/product/personas.md": "# Personas\n\nVer docs/prd/05-4-problema-mercado-y-personas.md\n",
    "docs/product/concepto.md": "# Concepto\n\nVer docs/prd/06-5-concepto-de-producto.md\n",
    "docs/product/modulos.md": "# Módulos\n\nVer docs/prd/12-11-m-dulos-funcionales.md\n",
    "docs/product/ux-ui.md": "# UX/UI\n\nVer docs/prd/13-12-experiencia-de-usuario-e-interfaz.md\n",
    "docs/engineering/stack.md": "# Stack\n\nVer docs/prd/17-16-stack-tecnol-gico-y-matriz-de-librer-as.md\n",
    "docs/engineering/lenguajes.md": "# Lenguajes\n\nVer docs/prd/07-6-arquitectura-general-y-pol-tica-de-lenguajes.md\n",
    "docs/engineering/integraciones.md": "# Integraciones\n\nVer docs/prd/14-13-integraciones.md\n",
    "docs/operations/despliegue.md": "# Despliegue\n\nVer docs/prd/07-6-arquitectura-general-y-pol-tica-de-lenguajes.md §6.3\n",
    "docs/operations/snapshots-respaldo.md": "# Snapshots\n\nVer docs/prd/09-8-esquema-de-datos-namespaces-grafo-y-ttl.md §8.4\n",
    "docs/architecture/vision-general.md": "# Visión general\n\nVer docs/prd/07-6-arquitectura-general-y-pol-tica-de-lenguajes.md\n",
    "docs/architecture/memoria-vantadb.md": "# Memoria VantaDB\n\nVer docs/prd/08-7-vantadb-columna-vertebral-de-memoria.md\n",
    "docs/architecture/namespaces.md": "# Namespaces\n\nVer docs/prd/09-8-esquema-de-datos-namespaces-grafo-y-ttl.md\n",
    "docs/architecture/jev.md": "# Jev\n\nVer docs/prd/10-9-jev-motor-de-decisiones-estructuradas.md\n",
    "docs/architecture/agentes.md": "# Agentes\n\nVer docs/prd/11-10-modelo-multi-agente-departamental.md\n",
    "docs/testing/estrategia.md": "# Estrategia de tests\n\nDefinida en .agents/agents/ego-review.md + docs/prd/18-17-roadmap-con-hitos-y-criterios-de-salida.md\n",
    "docs/roadmap/roadmap.md": "# Roadmap\n\nVer docs/prd/18-17-roadmap-con-hitos-y-criterios-de-salida.md\n",
    "docs/roadmap/metricas-okr.md": "# Métricas\n\nVer docs/prd/19-18-m-tricas-north-star-y-okrs.md\n",
    "docs/references/fuentes.md": "# Fuentes\n\nVer docs/prd/28-26-fuentes-citadas.md\n",
    "docs/references/glosario.md": "# Glosario\n\n- VantaDB: motor de memoria embebido\n- Jev: router de decisiones\n- Namespace: contenedor lógico\n- TTL: tiempo de vida\n- Supersede: reemplazo atómico\n- Cuarentena: validación previa\n",
}

for rel, content in files.items():
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    if not p.exists():
        p.write_text(content, encoding="utf-8")
        print("created", p)
