from pathlib import Path
from html import escape
import datetime, re
p = Path('C:/Users/Eros/VantaDB Proyect/Ego/scripts/generate_review_tracker.py')
t = p.read_text(encoding='utf-8')
adds = '''    str(root / "docs" / "architecture" / "vision-general.md"): {
        "status": "Con cambios",
        "decision": "Fuente vigente 6 capas + flujo + TS-first + transversal; 9→23 y sin pin pendientes.",
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
'''
t = t.replace('    str(root / "docs" / "architecture" / "memoria-vantadb.md"): {', adds + '    str(root / "docs" / "architecture" / "memoria-vantadb.md"): {')
p.write_text(t, encoding='utf-8')
print('tracker updated')
