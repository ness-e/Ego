# Contributing to Ego

> Canonical agent rules live in [`AGENTS.md`](AGENTS.md). This file is the human/PR workflow. On conflict, `AGENTS.md` + `docs/jerarquia-canonica.md` win.

## 1. Workflow: fork → branch → PR

1. Fork the repository and clone your fork.
2. Create a feature branch from `main`:
   ```powershell
   git checkout -b feat/short-description
   ```
3. Make atomic commits (one logical change per commit).
4. Push to your fork and open a Pull Request against `main`.
5. Fill in the PR template completely (context, test evidence, guardrail checklist).
6. Wait for review. Do not merge your own PR without a review by a different agent/human (see §5).

Branch naming: `feat/*`, `fix/*`, `docs/*`, `refactor/*`, `chore/*`, `test/*`.

## 2. Development

Requires Node.js ≥22 and pnpm ≥9.

```powershell
# Frozen install
pnpm install --frozen-lockfile

# Dev loop (desktop app)
pnpm dev

# Full build (renderer + desktop main)
pnpm build

# Full test suite
pnpm test

# Scoped commands
pnpm --filter @ego/desktop dev
pnpm --filter @ego/desktop build
pnpm --filter @ego/desktop test
pnpm --filter @ego/desktop typecheck
```

Package-scoped work: prefer `pnpm --filter <package> <script>` over root-wide runs for faster feedback.

## 3. Conventional Commits (English)

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) **in English**:

```
feat: add approval queue to execution manager
fix: prevent renderer direct access to VantaDB
docs: clarify Sub-Ego terminology
refactor: split context assembly from router
chore: bump electron to 33.4.11
test: cover IPC validation errors
perf: cache prompt prefix per turn
```

Rules (per `AGENTS.md` §5, enforced by `commitlint.config.mjs`):

- Type must be one of `feat|fix|docs|refactor|chore|test|perf`.
- Message in English, imperative, lowercase after colon, no trailing period.
- Atomic: one logical change per commit.
- Never `git push --force` without explicit owner instruction.

Enforcement: a `commit-msg` hook (husky + commitlint) validates every local
commit, and the `commit-msg` CI job fails the pipeline on any
non-conventional message in the push/PR range. If the hook blocks you, fix
the message (`git commit --amend`) — do not bypass with `--no-verify`.

## 4. Before commit: oxlint + typecheck

Both must pass before every commit/PR:

```powershell
pnpm lint        # oxlint (apps + packages + tests) + typecheck
pnpm typecheck   # pnpm -r typecheck
```

- `tsc --noEmit` must pass. Do not commit with type errors.
- `any` is prohibited in TypeScript unless explicitly justified in the PR.
- Do not break the existing build. Verify with `pnpm build` when touching `apps/desktop` or `packages/*`.

## 5. Review policy

- Every PR requires review and approval by an **agent/human different from the author** before merge.
- Reviewer checks: guardrails in `AGENTS.md` §4 (no VantaDB in renderer, no business logic in renderer, typed IPC, `EgoMemoryAdapter` gateway), tests included, no silent workarounds for VantaDB issues (must be logged in `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` with `VDB-*` ID).
- Security-sensitive changes (filesystem, terminal, credentials, IPC, permissions) require explicit approval-path verification.
- Respect the strict phase progression in `AGENTS.md` §6: do not sneak in tasks from a future roadmap phase.

## 6. What not to touch casually

- `repos-referencia/` — third-party study clones, never ship code from them directly.
- Credentials/API keys — never commit secrets. Use the OS keychain Credential Manager.
- Public product terminology: use **Sub-Ego** in UI/docs, never bare "agent".
