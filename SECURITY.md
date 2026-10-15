# Security Policy

## Supported scope

Ego is a local-first desktop app (Electron 33 + React 19) with embedded local memory (VantaDB 0.8.0, in-process via napi-rs) and a `vantadb-mcp` cognitive subprocess.

In scope:

- `apps/desktop` — Electron main, preload, renderer, IPC surface.
- `packages/*` — Cognitive Runtime, memory adapter (`EgoMemoryAdapter`), execution, tools, permissions/approval.
- Local VantaDB data handling — persistence, export/import (`.vdbdump`), crash recovery, migrations.

Out of scope for this repo: Ego Web (Next.js landing/auth/billing, when it exists), third-party clones under `repos-referencia/`.

## Reporting a vulnerability

**Do not open a public GitHub issue for vulnerabilities.**

Report privately to the repository owner via a private channel (DM or email to the owner). Include:

1. Affected version/commit and platform (OS + Ego version).
2. Steps to reproduce or proof of concept.
3. Impact assessment (what an attacker can read/write/execute).
4. Whether credentials, keychain material, or local VantaDB data is exposed.

The owner will acknowledge receipt, assess severity, prepare a fix, and coordinate disclosure. Public issues or PRs describing unpatched vulnerabilities will be closed/hidden to protect users.

## Handling rules for contributors

- Never commit credentials or API keys. Secrets live in the OS keychain Credential Manager — never in VantaDB, the renderer, or source code.
- Renderer is untrusted: `contextIsolation=true`, `sandbox=true`, `nodeIntegration=false`. All privileged access goes through typed preload IPC.
- Sensitive actions (filesystem, code execution, services, finance, communication) require configurable human approval — do not bypass or weaken approval paths.
