# Pull Request

## Context

<!-- Link issue(s): Closes #NNN. Which roadmap phase (01–12) does this belong to? -->

## What changed

<!-- Atomic change summary. One logical change per PR. -->

## Test evidence

<!-- Commands run + result. E.g. pnpm lint, pnpm typecheck, pnpm --filter @ego/desktop test -->

- [ ] `pnpm lint` passes (oxlint + typecheck)
- [ ] `pnpm typecheck` passes
- [ ] Tests added/updated and passing: <!-- list -->

## Guardrail checklist (AGENTS.md §4)

- [ ] No VantaDB in renderer (main process only, via `EgoMemoryAdapter`)
- [ ] No business logic in renderer (presentation only)
- [ ] IPC is typed and validated (renderer is untrusted)
- [ ] No `Client` from `"vantadb"` (WASM) — `NativeVantaDB` from `"vantadb/native"` only
- [ ] No embeddings computed in TypeScript fast path
- [ ] No secrets committed (keychain only)
- [ ] Product terminology respected (Sub-Ego in UI/docs, never bare "agent")

## VantaDB friction

<!-- If this PR touches memory/adapters: did you hit engine friction or add a workaround? -->

- [ ] No VantaDB friction, or logged in `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` as `VDB-*` with ID referenced in code

## Review

- [ ] Reviewed by an agent/human different from the author
- [ ] Conventional Commits in English (`feat:|fix:|docs:|refactor:|chore:|test:`)
