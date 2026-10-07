from pathlib import Path
root = Path('C:/Users/Eros/VantaDB Proyect/Ego/docs')
for p in root.rglob('*.md'):
    try:
        t = p.read_text(encoding='utf-8')
    except Exception:
        continue
    if 'Ver docs/prd/' in t:
        p.write_text(t.replace('Ver docs/prd/', 'Ver ../prd/'), encoding='utf-8')
        print('fixed', p)
