---
name: documentation-skill
description: >-
  Create, edit, review or reorganise any Markdown document under docs/ in the
  Ego repository. Use whenever a task creates a .md file, edits prose in
  docs/, adds or changes an internal link, adds frontmatter, writes an ADR, a
  plan, a research note or a runbook, or touches docs/index.md, llms.txt or any
  file under docs/. Encodes the GitHub-first, Obsidian-compatible
  documentation standard: which link syntax renders on GitHub, which frontmatter
  keys are canonical, how kind decides path, and which seven checks must pass
  before a document is considered done.
metadata:
  version: "1.0.0"
  created: "2026-09-28"
  applies-to: "docs/**/*.md, llms.txt, .obsidian/**"
  companion-scripts: "scripts/docs/*.mjs"
  normativity: "docs/architecture/"
---

# Documentation Skill — Ego

The standard for every Markdown document in this repository. It exists because
`docs/` is **two things at once**: a GitHub-rendered documentation site and an
Obsidian vault. Most of these rules come from resolving that tension, not from
taste.

**The one-line version:** write plain CommonMark that renders correctly on
github.com first and is good in Obsidian second.

---

## 0. Non-negotiables

These five are the difference between a document that works and one that does
not. Everything below is detail.

1. **Never write `[[wikilinks]]` in prose.** They render as literal `[[text]]`
   on GitHub. Use `[Label](relative/path.md)`.
2. **Always give a new document frontmatter** with at least `title` and `kind`.
3. **`kind` is derived from the path, never chosen independently.** If the path
   and the `kind` disagree, CI fails.
4. **Never hand-edit a generated index** (`docs/index.md`, `docs/api/index.md`,
   `docs/user/index.md`, `docs/architecture/adr/README.md`, `llms.txt`).
   They carry a `<!-- GENERATED -->` banner. Run `gen-index.mjs --write`.
5. **Never write `last_reviewed`.** A self-reported date is not a measurement.
   Freshness is `git log -1 --format=%cs -- <file>`, which is exact and free.

---

## 1. Links

### Syntax

| Purpose | Write | Renders on GitHub |
|---|---|---|
| Internal document | `[HNSW](../glosario/hnsw.md)` | yes |
| Heading inside a doc | `[Durability](./HTTP_API.md#durability)` | yes |
| Image | `![Diagram](../assets/wal.png)` | yes |
| External | `[docs.rs](https://docs.rs/Ego)` | yes |
| Obsidian property `links:` | `links: "[[README]]"` | n/a — see §1.4 |

**Never:** `[[Page]]`, `![[embed]]`, `[[note#^block-id]]` in prose.

### 1.1 Relative, never shortest

Paths are relative to the **containing file**:

```markdown
<!-- docs/architecture/vision-general.md linking to docs/user/glosario/hnsw.md -->
[HNSW](../../user/glosario/hnsw.md)

<!-- docs/user/glosario/ai-agents.md linking to docs/user/glosario/rag.md -->
[RAG](./rag.md)
```

The vault has 69 groups of duplicate basenames (`README.md` ×16, `index.md` ×9).
Obsidian's `shortest` format resolves `[[README]]` ambiguously in that situation;
a relative path has exactly one possible resolution. That is why
`.obsidian/app.json` sets `newLinkFormat: "relative"`.

**Link to the thing itself, not to a duplicate of it.** `docs/user/book/src/**`
is an mdBook copy of the docs tree. Linking into it creates a second source of
truth. Link to `docs/`.

### 1.2 Links inside tables need escaped pipes

A `|` inside a link label or URL inside a table cell breaks the cell:

```markdown
| Correct  | [OIDC](./oidc.md) | yes |
| Wrong    | [a|b](./x.md) | yes |   <!-- splits into 3 cells -->
| Also wrong | [a\|b](./x.md) |   <!-- inside code span, fine -->
```

If a link label itself must contain a pipe, escape it: `\|`.

### 1.3 Broken links: report, never guess

If you do not know where a link should point, do not invent a path.

> **A wrong link is worse than a broken link.** A broken link is loud; a wrong
> link misdirects the reader *and* the agent, and it passes every existence
> check downstream.

`repair-links.mjs` follows the same rule: it repairs only on a **unique**
match, and reports everything ambiguous for a human decision.

### 1.4 The one place wikilinks are correct

```yaml
---
links: "[[README]]"
---
```

Obsidian resolves a property's **type from its name, vault-wide**. `links:` is
typed as a wikilink list across all 1721 files. Rewriting those to Markdown
links corrupts the property everywhere. The migration scripts exempt front
matter deliberately.

---

## 2. Frontmatter

Schema: `docs/_schema/frontmatter.schema.json`. Gate: `scripts/docs/check-docs.mjs`.

```yaml
---
title: "Hybrid retrieval: BM25 + HNSW fused with RRF"
kind: reference
status: active
description: "One line, no trailing period. This is the text that appears in every generated index and in llms.txt."
tags: [api, hnsw, rrf]
supersedes: null
superseded_by: null
---
```

| Key | Required | Notes |
|---|---|---|
| `title` | **yes** | Must match the H1, or the H1 should be removed. Two titles is what makes a doc look unfinished. |
| `kind` | **yes** | Enum below. Must agree with the path. |
| `status` | no | `draft` `active` `stable` `proposed` `accepted` `rejected` `deprecated` `archived` `superseded` |
| `description` | no | One line, ≤200 chars. **Without it the file is omitted from generated indexes.** |
| `aliases` | no | Always a list, even with one element. List-vs-scalar flips the Obsidian property type. |
| `tags` | no | Lowercase-hyphenated, 2-3 max. `docs/_schema/tags.txt` is advisory. |
| `supersedes` / `superseded_by` | no | Repo-relative paths. ADRs only. |

`additionalProperties: false`. Retired keys — `type`, `last_reviewed`,
`related`, `language` — are violations.

### 2.1 `kind` decides the path

```
index      README.md / index.md
concept    docs/concepts|architecture|strategy|vision/
tutorial   docs/tutorials/
howto      docs/user/, docs/guides/, docs/howto/
runbook    docs/operations/, docs/runbooks/, docs/workflow/
reference  docs/api/
glossary   docs/glosario/, docs/glossary/
adr        docs/**/adr/
plan       docs/plans/
task       docs/tasks/
research   docs/research/
review     docs/reviews/, docs/avance/
report     docs/reports/, docs/benchmarks/
changelog  CHANGELOG.md
```

### 2.2 Why the schema is small

GitHub renders frontmatter as a **key/value table above the body** — it does not
show raw YAML, and there is no way to suppress it. Every key is a visible row on
1721 pages, and nested YAML becomes a nested table. Three flat scalar keys is
the sweet spot: enough to generate an index, few enough not to dominate the
rendered page.

### 2.3 `tags` are a human decision

The corpus uses ~430 distinct tags. Do not add more without a reason. Prefer
reusing an existing tag. The gate enforces only the **format**, because that is
what breaks Obsidian's vault-wide property typing — not the vocabulary.

---

## 3. Document kinds: what each one owes the reader

Borrowed from Diátaxis, which separates four needs that were previously mixed.

| Kind | The reader's question | Rule |
|---|---|---|
| **tutorial** | "Teach me, I'm stuck." | One path, end to end, working. No alternatives presented as if they were options. |
| **howto** | "Do this specific thing." | Starts from a goal, not from the system. Assume competence. |
| **reference** | "What exactly does this do?" | Exhaustive, uniform, no narrative. **Prefer generated over hand-written.** |
| **concept / explanation** | "Why is it like this?" | The only kind where prose is the point. Keep it short — see §5. |

**A change to the public API that is not reflected in the `reference` kind is
incomplete.** `docs/api/` is version-gated by `gate-docs.yml`; if you touch
`src/server/router.rs` or an SDK signature, the matching `docs/api/` page
changes in the same PR.

---

## 4. Architecture Decision Records

54 ADRs in `docs/architecture/adr/`. Format: **MADR**, MIT/CC0.

Mandatory sections — these are what make an ADR an ADR rather than a note:

```markdown
# NNNN. Decision title

## Context and problem statement
What forces are at play? What is the actual problem?

## Considered options
- Option A — pros / cons
- Option B — pros / cons
- Option C — pros / cons

## Decision outcome
Chosen option and **why**.

### Positive consequences
### Negative consequences          <- an ADR without this is incomplete
```

Rules:

- **Immutable once accepted.** A change of mind is a **new** ADR that names the
  one it supersedes via `supersedes:` / `superseded_by:`. Never edit the body of
  an accepted ADR to change the decision.
- **Record at least two considered options.** "A decision that does not identify
  alternatives and choose one of them is not a decision" — and an agent reading
  a single-option ADR will re-propose the rejected one.
- **Status vocabulary is MADR's**: `proposed` `accepted` `rejected` `superseded`
  `deprecated`. The schema adopts it rather than forcing 54 files to comply with
  an invented enum.
- A file that is not architecturally significant does not need to be an ADR. A
  description of one implementation detail is not a decision record.

---

## 5. Length: the Nygard constraint

> *"Large documents are never kept up to date. Small, modular documents have at
> least a chance at being updated. Nobody ever reads large documents."*
> — Michael Nygard, Cognitect, 2011

Apply concretely:

- No document over ~300 lines without a table of contents and a split plan.
- `docs/CHANGELOG.md` y `docs/roadmap/Backlog.md` son
  archivos gestionados mecánicamente o append-only.
- If a reader needs two documents to answer one question, the boundary between
  them is wrong.

---

## 6. Generated vs hand-written — do not duplicate

**One fact, one file. Everywhere else, a link.**

> The NYT's 2021 link study found **13% of links that still resolve no longer
> lead to the content they promised** — content drift, not 404. A link fails
> loudly. A copy fails silently.

| Value | Owner | Tool |
|---|---|---|
| Version string | `Cargo.toml` | gated by `gate-docs.yml` |
| HTTP API surface | `docs/api/openapi.yaml` | `check_openapi_parity.mjs` |
| Rust public API | rustdoc | `cargo doc` in `ci-rustdoc.yml` |
| Python API | docstrings | `pydoclint` |
| TypeScript API | `typedoc` | TS SDK build |
| Changelog | release-plz | never hand-edited |
| Indexes | `gen-index.mjs` | never hand-edited |

**If a value can be generated, generate it.** If you hand-copy a generated
value, one of the two copies is already wrong.

---

## 7. The Definition of Done

Run these before declaring a document finished. All are offline and take seconds.

```bash
node scripts/docs/check-links.mjs      # 0 broken internal links
node scripts/docs/check-docs.mjs       # 0 schema violations, 0 kind mismatches
node scripts/docs/gen-index.mjs --write # regenerate indexes, commit the diff
npx markdownlint-cli2 "docs/**/*.md"   # no new errors vs the workflow baseline
```

Then confirm by reading:

- [ ] Would a reader who knows Ego find this in the generated index?
- [ ] Does the H1 match `title`, or is one of them absent?
- [ ] Is every claim here either sourced or verifiable by a command in the repo?
- [ ] If a code example exists, would it still run?
- [ ] If this document becomes wrong, what makes that visible? (A gate, not a
      date in the frontmatter.)

---

## 8. Anti-patterns

| Anti-pattern | Why it is wrong |
|---|---|
| `[[wikilink]]` in prose | Literal text on GitHub |
| A second `CHANGELOG.md` in `docs/user/book/src/` | Second source of truth; the duplicate drifts silently |
| Adding a file and not regenerating the index | The orphan it creates is invisible until the index is generated again |
| `last_reviewed: 2026-09-28` | A self-report, not a measurement. The date goes stale in the same commit that wrote it |
| `related: [...]` maintained by hand | Same failure mode as a hand-maintained index, at smaller scale |
| A 500-line architecture document | Never updated, never read (Nygard) |
| An ADR with one option | The agent will re-propose what you rejected |
| Guessing a link target to make CI green | A wrong link is worse than a broken one |
| `description` that starts with "1. topk semantics…" | Derived from a list, not from prose. Fix the derivation, not the string |
| Bulk `markdownlint --fix` on hand-written prose | Reformat churn that hides real edits in the diff |

---

## 9. Commands

```bash
# validate
node scripts/docs/check-links.mjs
node scripts/docs/check-docs.mjs --fix-hints

# regenerate what is derived
node scripts/docs/gen-index.mjs --write
node scripts/docs/stamp-frontmatter.mjs --write

# repair (only repairs unique matches; reports the rest)
node scripts/docs/repair-links.mjs
node scripts/docs/wikilinks-to-md.mjs

# CI freshness check
node scripts/docs/gen-index.mjs --check
```

---

## 10. Normative references

- `docs/jerarquia-canonica.md` — 12-level decision authority hierarchy
- `docs/architecture/vision-general.md` — canonical Ego cognitive runtime architecture
- `docs/engineering/stack-tecnico.md` — technical stack and standards
- `docs/roadmap/Backlog.md` — master roadmap backlog
- https://obsidian.md/help/links — "If interoperability is important to you, you can disable Wikilinks and use Markdown links instead"
- https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting — GFM support
- https://diataxis.fr/ — the four kinds
- https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions — Nygard on ADRs
- https://adr.github.io/madr/ — MADR format
