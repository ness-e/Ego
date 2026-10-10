#!/usr/bin/env python3
"""
scripts/ingest/bulk_import.py — Worker desacoplado de extracción y fragmentación masiva para Ego.
Adhiere estrictamente a VDB-INC-02: NO abre VantaDB directamente para evitar FjallError: Locked.
Emite streams de chunks y progreso por stdout en formato JSON-Lines para que Electron Main
realice la inserción en base de datos.
"""

import sys
import os
import json
import hashlib
import glob
from typing import List, Dict, Any

def calculate_hash(content: str) -> str:
    return hashlib.sha256(content.strip().replace("\r\n", "\n").encode("utf-8")).hexdigest()

def estimate_tokens(text: str) -> int:
    words = len(text.strip().split())
    chars = len(text) // 4
    return max(int(words * 1.3), chars, 1)

def chunk_text(text: str, source_path: str, mime_type: str, max_tokens: int = 256, overlap_tokens: int = 32) -> List[Dict[str, Any]]:
    lines = text.replace("\r\n", "\n").split("\n")
    chunks = []
    current_lines = []
    current_tokens = 0
    heading_path = []
    chunk_index = 0
    in_code_block = False

    def commit():
        nonlocal chunk_index, current_lines, current_tokens
        if not current_lines:
            return
        content = "\n".join(current_lines).strip()
        if not content:
            return
        content_hash = calculate_hash(content)
        token_count = estimate_tokens(content)
        chunk_id = f"{source_path}:{chunk_index}:{content_hash[:8]}"
        chunk = {
            "id": chunk_id,
            "content": content,
            "tokenCount": token_count,
            "headingPath": list(heading_path),
            "contentHash": content_hash,
            "sourcePath": source_path,
            "mimeType": mime_type,
            "index": chunk_index,
        }
        chunks.append(chunk)
        chunk_index += 1

        # Overlap
        retained = []
        retained_tokens = 0
        for l in reversed(current_lines):
            lt = estimate_tokens(l)
            if retained_tokens + lt <= overlap_tokens:
                retained.insert(0, l)
                retained_tokens += lt
            else:
                break
        current_lines = retained
        current_tokens = retained_tokens

    for line in lines:
        if line.strip().startswith("```"):
            in_code_block = not in_code_block
        if not in_code_block:
            if line.startswith("#"):
                parts = line.split(maxsplit=1)
                level = len(parts[0])
                if len(parts) > 1 and parts[0] == "#" * level:
                    title = parts[1].strip()
                    if current_tokens >= max_tokens * 0.4:
                        commit()
                    heading_path = heading_path[:max(0, level - 1)]
                    heading_path.append(title)
        lt = estimate_tokens(line)
        if current_tokens + lt > max_tokens and current_lines:
            if not in_code_block or current_tokens > max_tokens * 1.5:
                commit()
        current_lines.append(line)
        current_tokens += lt

    commit()
    return chunks

def process_file(file_path: str) -> List[Dict[str, Any]]:
    ext = os.path.splitext(file_path)[1].lower()
    mime = "text/plain"
    if ext in [".md", ".markdown"]:
        mime = "text/markdown"
    elif ext == ".json":
        mime = "application/json"
    elif ext == ".csv":
        mime = "text/csv"

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except Exception as e:
        sys.stderr.write(f"Error leyendo {file_path}: {e}\n")
        return []

    return chunk_text(content, file_path, mime)

def main():
    if len(sys.argv) < 2:
        sys.stderr.write("Uso: python bulk_import.py <directorio_o_archivo>\n")
        sys.exit(1)

    target_path = sys.argv[1]
    files = []
    if os.path.isfile(target_path):
        files = [target_path]
    elif os.path.isdir(target_path):
        for root, _, filenames in os.walk(target_path):
            for fn in filenames:
                ext = os.path.splitext(fn)[1].lower()
                if ext in [".md", ".markdown", ".txt", ".json", ".csv"]:
                    files.append(os.path.join(root, fn))

    total = len(files)
    total_chunks = 0

    for i, fp in enumerate(files):
        chunks = process_file(fp)
        for c in chunks:
            total_chunks += 1
            print(json.dumps({"type": "chunk", "chunk": c}), flush=True)

        print(json.dumps({
            "type": "progress",
            "current": i + 1,
            "total": total,
            "file": fp,
            "chunksSoFar": total_chunks
        }), flush=True)

    print(json.dumps({
        "type": "done",
        "totalFiles": total,
        "totalChunks": total_chunks
    }), flush=True)

if __name__ == "__main__":
    main()
