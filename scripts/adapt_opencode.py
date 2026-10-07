from pathlib import Path
import re

root = Path(__file__).resolve().parents[1] / ".opencode"
patterns = [
    ("VantaDB", "Ego"),
    ("vantadb", "Ego"),
    ("VANTA_DB", "EGO"),
    ("vanta-", "ego-"),
    ("Vantadb", "Ego"),
    ("VantaDB Development Protocol", "Ego Development Protocol"),
    ("Vantadb", "Ego"),
]
for path in root.rglob("*"):
    if path.is_file() and path.suffix.lower() in {".md", ".json", ".jsonc", ".yml", ".yaml", ".toml", ".ps1", ".mjs", ".ts", ".js"}:
        try:
            text = path.read_text(encoding="utf-8")
        except Exception:
            continue
        new = text
        for old, newv in patterns:
            new = new.replace(old, newv)
        if new != text:
            path.write_text(new, encoding="utf-8")
            print("updated", path)
