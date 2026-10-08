---
name: ponytail
description: >
  Use when a command says "modo ponytail" — lazy senior-dev mode (YAGNI ladder:
  reuse > stdlib > native > installed dep > one line > minimum). This is a
  pointer shim; the behavior is injected by the ponytail OpenCode plugin
  (.agents/plugins/ponytail.ts). Do not implement logic here.
compatibility: opencode
---

# Ponytail (shim)

> El comportamiento real lo inyecta el plugin `ponytail` (`.agents/plugins/ponytail.ts`,
> fuente: `PONYTAIL_BASE` env o `~/.agents/ponytail`). Este archivo existe para que
> `skill ponytail` no falle y para documentar los niveles: `lite` | `full` (default) |
> `ultra` | `off` (`/ponytail <nivel>`).
