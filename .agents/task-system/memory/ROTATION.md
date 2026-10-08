# Rotación de memoria — task-system/memory (D9) + TTL sesiones (D10)

Fuente: MEM-ROTATE-04. Sustituye al Trigger 3 manual: regla automática con umbrales fijos.

## 1. Umbrales (cualquiera dispara)

| Archivo | Umbral | Acción |
|---------|--------|--------|
| `memory/lessons.md`, `memory/decisions.md` | **50 KB o 200 líneas** | Rotar a `archive/` |
| `opencode-loop/ses_*.json` | **TTL 30 días o >50 files** | Borrar viejos, keep 50 newest |
| `task-system/enforcement/sessions/*.json` | **TTL 30 días o >20 files** | Borrar viejos, keep 20 newest |
| `task-system/enforcement/verify-log.jsonl` | **50 KB o 200 líneas** | Truncar a últimas 200 líneas |

## 2. Rotación lessons/decisions

1. Nuevo archivo `archive/<base>-archive-YYYY-MM-DD.md` (ej: `lessons-archive-2026-09-05.md`) con cabecera `# Archive <base> — YYYY-MM-DD (auto-rotación MEM-ROTATE-04)` + entradas movidas. Si ya existe para la fecha, append con separador `---`.
2. En el archivo vivo se conserva el header (título + quote + `---` + sweep-note) + las entradas **más recientes** que quepan en **≤200 líneas y <50 KB**.
3. **Nunca** tocar `archive/*` existente ni borrar sin archivar. Verificar con `ls archive/`.
4. decisions.md bajo umbral → no se rota (solo se documenta).

## 3. TTL sesiones (D10)

- `opencode-loop/ses_*.json`: ordenar por `LastWriteTime, Name`, borrar todos menos los 50 newest. **Nunca** tocar `opencode-loop/goals/*.md` ni `loop.log`.
- Los `ses_*.json` son placeholders runtime de 32 B (`{"version":4,"jobs":[]}`), regenerables — borrado directo, sin archive.
- `enforcement/sessions/`: mismo criterio, cap 20. `verify-log.jsonl`: keep últimas 200 líneas.
- Nota mtime: un checkout git resetea `LastWriteTime` (todos quedan "recientes"). El cap por conteo es el que garantiza el techo cuando el TTL por fecha no dispara; el script aplica **ambos** (borra lo >30d Y lo que exceda el cap).

## 4. Gitignore (D10)

`.agents/.gitignore` debe contener (verificado por `grep` + `git check-ignore`):

```
opencode-loop/*.json
opencode-loop/ses_*.json
task-system/traces/*.jsonl
task-system/enforcement/sessions/
task-system/enforcement/verify-log.jsonl
```

Los `ses_*.json` commiteados antes del ignore siguen trackeados: hay que des-trackearlos una vez con `git -C .agents rm --cached opencode-loop/ses_*.json` (keep on disk). A partir de ahí `git check-ignore` los reporta como ignorados.

## 5. Uso

```powershell
# Dry-run (no muta):
pwsh .agents/task-system/memory/rotate-memory.ps1 -WhatIf
# Ejecutar:
pwsh .agents/task-system/memory/rotate-memory.ps1
```

## 6. Verificación del contrato

```powershell
# (a) rotación documentada + archive fechado:
ls .agents/task-system/memory/archive/
# (b) TTL + caps + goals intactos + gitignore:
python -c "from pathlib import Path; print(len(list(Path('.agents/opencode-loop').glob('ses_*.json'))))"
ls .agents/opencode-loop/goals/
git -C .agents check-ignore -v opencode-loop/<un-ses>.json
git -C .agents status --short
```
