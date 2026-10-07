from pathlib import Path
root = Path('C:/Users/Eros/VantaDB Proyect/Ego/docs/prd')
maps = {
    '07-6-arquitectura-general-y-pol-tica-de-lenguajes.md': '../architecture/vision-general.md (+ ../engineering/lenguajes.md pendiente)',
    '08-7-vantadb-columna-vertebral-de-memoria.md': '../architecture/memoria-vantadb.md',
    '09-8-esquema-de-datos-namespaces-grafo-y-ttl.md': '../architecture/namespaces.md (+ ../operations/snapshots-respaldo.md §8.4 pendiente)',
    '10-9-jev-motor-de-decisiones-estructuradas.md': '../architecture/jev.md',
    '11-10-modelo-multi-agente-departamental.md': '../architecture/agentes.md (23 vigentes)',
}
for name, target in maps.items():
    p = root / name
    t = p.read_text(encoding='utf-8')
    if not t.startswith('> Estado:'):
        p.write_text(f'> Estado: histórico v2.1 congelado — no editar. Fuente vigente: `{target}`.\n\n' + t, encoding='utf-8')
        print('frozen', name)
