from pathlib import Path
p = Path('C:/Users/Eros/VantaDB Proyect/Ego/docs/prd/00-overview.md')
s = p.read_text(encoding='utf-8')
parts = []
for f in ['01-tabla-de-contenidos.md', '02-1-resumen-ejecutivo.md']:
    q = Path('C:/Users/Eros/VantaDB Proyect/Ego/docs/prd') / f
    if q.exists():
        parts.append(q.read_text(encoding='utf-8').strip())
        q.unlink()
if parts:
    s = s.rstrip() + "\n\n---\n\n" + "\n\n---\n\n".join(parts) + "\n"
    p.write_text(s, encoding='utf-8')
print(p.read_text(encoding='utf-8')[:500])
