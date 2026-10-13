"""Repara enlaces Markdown escritos como relativos-a-raiz (`](docs/...)`) dentro de docs/.

Regla segura (C10): solo reescribe un enlace si, resuelto desde el directorio
del archivo que lo contiene, el destino NO existe pero SI existe resuelto
desde la raiz `docs/`. En ese caso lo sustituye por la ruta relativa correcta
calculada con os.path.relpath. Idempotente: una segunda pasada no cambia nada.

Uso: `python scripts/fix_links.py [--check]` (--check: solo informa, exit 1 si hay rotos).
"""
from __future__ import annotations

import os
import re
import sys

LINK_RE = re.compile(r"\]\((docs/[^\s)#]+)(#[^\s)]+)?\)")
LEGACY_RE = re.compile(r"Ver docs/prd/")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")


def fix_file(path: str, check_only: bool = False) -> int:
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    fixed = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal fixed
        root_rel, anchor = match.group(1), match.group(2) or ""
        as_resolved = os.path.normpath(os.path.join(os.path.dirname(path), root_rel))
        as_rooted = os.path.normpath(os.path.join(DOCS, root_rel[len("docs/"):]))
        if os.path.exists(as_resolved) or not os.path.exists(as_rooted):
            return match.group(0)
        correct = os.path.relpath(as_rooted, os.path.dirname(path)).replace(os.sep, "/")
        fixed += 1
        return f"]({correct}{anchor})"

    text = LINK_RE.sub(repl, text)

    legacy_hits = len(LEGACY_RE.findall(text))
    if legacy_hits:
        text = LEGACY_RE.sub("Ver ../prd/", text)
        fixed += legacy_hits

    if fixed and not check_only:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text)
    return fixed


def main() -> int:
    check_only = "--check" in sys.argv
    total = 0
    touched: list[str] = []
    for dirpath, _dirnames, filenames in os.walk(DOCS):
        for name in filenames:
            if not name.endswith(".md"):
                continue
            full = os.path.join(dirpath, name)
            try:
                n = fix_file(full, check_only)
            except OSError:
                continue
            if n:
                total += n
                touched.append(os.path.relpath(full, ROOT))
    for rel in touched:
        print(("would-fix " if check_only else "fixed ") + rel)
    print(f"{total} enlace(s) {'rotos' if check_only else 'reparados'}")
    if check_only and total:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
