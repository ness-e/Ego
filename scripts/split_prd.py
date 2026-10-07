from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
src = root / "Ego_PRD_Blueprint_v2.1.md"
text = src.read_text(encoding="utf-8")

# Keep front matter-ish header until first level-2 heading as overview
parts = re.split(r"(?m)^(?=## )", text)
header = parts[0].strip()
docs_dir = root / "docs" / "prd"
docs_dir.mkdir(parents=True, exist_ok=True)
(docs_dir / "00-overview.md").write_text(header + "\n", encoding="utf-8")

toc_lines = ["# Índice de secciones del PRD\n\n"]
for i, part in enumerate(parts[1:], start=1):
    lines = part.splitlines()
    if not lines:
        continue
    title = lines[0].replace("## ", "", 1).strip()
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower(), flags=re.I).strip("-")
    out = docs_dir / f"{i:02d}-{slug}.md"
    out.write_text(part.strip() + "\n", encoding="utf-8")
    toc_lines.append(f"- [{title}]({out.name})")

(docs_dir / "README.md").write_text("\n".join(toc_lines) + "\n", encoding="utf-8")
print(f"Split into {docs_dir}")
