# unified-review

> Universal review, audit, and certification skill for OpenCode. Replaces
> `Ego-full-review`, `Ego-certify`, and `Ego-audit` with a
> single skill that works on **any** software project (Rust, Python, TS,
> Go, mixed) and ships with a Ego-specific profile.

## What's in this folder

```
unified-review/
├── SKILL.md                      ← the skill (install this in OpenCode)
├── ARCHITECTURE.md               ← design doc (sub-agent flow, data contracts, failure handling)
├── README.md                     ← this file
├── profiles/
│   ├── default.yml               ← generic profile (any project) — markdown reports
│   └── Ego.yml               ← Ego profile — both MD + HTML reports
└── templates/
    ├── report.html.tmpl          ← HTML report template (self-contained, print-friendly)
    └── pre-push.ps1.tmpl         ← PowerShell pre-push hook (referenced by Ego.yml)
```

## Report formats

The skill writes reports to `docs/dev/reviews/review-<mode>-<timestamp>.<ext>`:

| Profile | Format | Files |
|---------|--------|-------|
| `default` | `markdown` | `.md` only (portable, git-diffable) |
| `Ego` | `both` | `.md` + `.html` (MD for git, HTML for stakeholders) |

The HTML template is **self-contained**: inline CSS, no external CDN/fonts,
works offline, dark-mode aware via `prefers-color-scheme`, print-friendly.
See `SKILL.md → Report Format → HTML template` for the full placeholder
reference (40+ placeholders, conditional blocks, HTML-escaping rules).

To preview the HTML output, see `sample-report.html` (in the parent
`download/` directory) which renders a sample `certify` run with 1 critical
finding, ISO 25010 heatmap, SonarQube Quality Gate, and prioritized
recommendations.

## Installation (OpenCode)

1. **Copy the folder** to your OpenCode skills directory:

   ```
   .agents/skills/unified-review/
   ```

   (Either project-local `.agents/skills/` or global `~/.config/opencode/skills/`.)

2. **Verify the skill loads**: start OpenCode and check that
   `unified-review` appears in the `skill` tool's `<available_skills>` list.
   If it doesn't, check:
   - `SKILL.md` is in all caps.
   - Frontmatter has `name` and `description`.
   - `name` (`unified-review`) matches the directory name.

3. **(Optional) Define custom subagent types**. The Ego profile
   references `ego-worker`, `ego-audit`, `ego-tuner`, `ego-docs`,
   `ego-arch`, `ego-lead`. If you don't define them, the orchestrator
   falls back to the built-in `general` subagent. To get the full Ego
   experience, create markdown files in `.agents/agents/` — see
   `ARCHITECTURE.md → Section 7` for ready-to-use definitions.

4. **(Optional) Configure permissions**. Add this to `opencode.json`:

   ```json
   {
     "permission": {
       "bash": "allow",
       "read": "allow",
       "edit": "ask",
       "write": "allow",
       "task": "allow",
       "skill": "allow"
     },
     "agent": {
       "build": {
         "permission": {
           "task": {
             "*": "deny",
             "general": "allow",
             "explore": "allow",
             "scout": "allow",
             "ego-*": "allow"
           }
         }
       }
     }
   }
   ```

## Quick start

### Generic project (any language)

```
# Quick: did I break anything?
/review quick

# Pre-push gate
/review certify

# PR review
/review review

# Quarterly deep dive
/review full
```

### Ego

```
# Pre-push certify (matches legacy Ego-certify)
/review certify --profile Ego

# Full quarterly review (matches legacy Ego-full-review)
/review full --profile Ego

# Legacy alias (matches legacy Ego-audit)
/audit              # → /review full
/audit quick        # → /review quick
/audit certify      # → /review certify
/audit review       # → /review review
/audit full         # → /review full
```

## Migration from legacy skills

| Old | New |
|-----|-----|
| `Ego-full-review` skill | `/review full --profile Ego` |
| `Ego-certify` skill | `/review certify --profile Ego` |
| `Ego-audit` skill | this skill (`/audit` is now an alias) |
| `/audit` | `/review full` (alias kept) |
| `/audit quick` | `/review quick` |
| `/audit certify` | `/review certify` |
| `/audit review` | `/review review` |
| `/audit full` | `/review full` |

You can delete the three legacy skills once you've verified the unified
skill produces equivalent (or better) output.

## What you get vs the legacy skills

| Capability | Legacy | Unified |
|-----------|--------|---------|
| Compile + lint + tests | ✅ | ✅ (in L1 sub-agent) |
| Security audit | ✅ | ✅ (L7, ego-audit sub-agent) |
| Performance audit | ✅ | ✅ (L8, ego-tuner sub-agent) |
| Code review with veto | ✅ | ✅ (L9, ego-audit sub-agent) |
| CI/CD parity check | ✅ (L7a in certify) | ✅ (L4, ego-lead sub-agent) |
| Docs coverage | ✅ | ✅ (L5, ego-docs sub-agent) |
| Architecture review | ✅ | ✅ (L6, ego-arch sub-agent) |
| ISO 25010 + SonarQube + CII + OWASP + CodeClimate scoring | ✅ (full-review only) | ✅ (when scoring.enabled in profile) |
| 12-category findings taxonomy | ✅ (full-review F9) | ✅ (in every profile) |
| PowerShell pre-push hook | ✅ (certify) | ✅ (template + generator) |
| Codegraph impact analysis | ✅ (certify L0) | ✅ (L0 in default + Ego) |
| Ponytail integration | partial | ✅ (respects off/lite/full/ultra modes) |
| Campaign task system integration | ✅ (audit only) | ✅ (in every profile, auto-detected) |
| Parallel execution | ❌ (sequential monolithic) | ✅ (fan-out with task tool, max 4 parallel) |
| Context budget | ❌ (often truncates on Ego) | ✅ (< 10% orchestrator, 15-20% per sub-agent) |
| Works on non-Ego projects | ❌ (hardcoded paths) | ✅ (default profile auto-detects) |

## Customizing for your project

1. Create `profiles/<myproject>.yml` next to `default.yml`.
2. Set `profile.inherits: default` (or `Ego` if you want a Ego-like base).
3. Override only what differs (commands, paths, thresholds, subagent types).
4. Run `/review <mode> --profile myproject`.

See `default.yml` and `Ego.yml` for the full schema with examples.

## Documentation

- `SKILL.md` — full skill reference (entry points, detection engine, phase
  catalog, fan-out pattern, findings taxonomy, scoring, report format,
  integrations, usage examples).
- `ARCHITECTURE.md` — design doc (sub-agent flow diagrams, data contracts,
  failure handling, context budget analysis, subagent type definitions,
  extension points, testing guide).
- `profiles/default.yml` — generic profile with extensive inline comments.
- `profiles/Ego.yml` — Ego profile with all Ego-specific
  commands, paths, scoring thresholds, and subagent type mappings.

## License

MIT. See `SKILL.md` frontmatter.

## Version

1.0.0 — 2026-07-26
