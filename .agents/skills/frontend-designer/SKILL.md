---
name: frontend-designer
description: "Trigger: frontend design, CSS architecture, tokens, responsive UI, accessibility, motion. Produce production UI design systems."
license: Apache-2.0
metadata:
  author: kozz36
  version: "3.0"
---

## Activation Contract

Use this skill for frontend design systems decisions when the agent must choose, review, or document production-ready technical direction.

- Designing or reviewing UI systems, component anatomy, tokens, layout, or visual interaction.
- Choosing CSS architecture, responsive behavior, accessibility constraints, or motion rules.
- Converting visual direction into implementation-ready frontend guidance.

Do not use this skill for generic explanation, copy editing, or one-off code changes that do not affect architecture or reusable implementation patterns.

## Hard Rules

- Design tokens are contracts; do not hardcode visual decisions in isolated components.
- Prioritize accessible defaults before visual novelty.
- Use motion only when it communicates state, hierarchy, or continuity.
- Keep responsive rules container-aware where component reuse matters.
- Keep the main answer decision-first; move deep rationale to local references instead of long inline prose.
- Verify new version/API claims before adding them to changelogs or decision guidance.

## Decision Gates

| Need | Action |
|------|--------|
| Reusable UI system | Define tokens, component states, and accessibility invariants first. |
| One-off marketing section | Optimize for visual outcome but still preserve semantic HTML and performance. |
| Complex layouts | Prefer container queries and composition over breakpoint sprawl. |
| Animation | Use CSS transitions for simple states; JS animation only for coordinated timelines. |

## Execution Steps

1. Identify product constraints, team skill, runtime, data ownership, security boundary, and validation path.
2. Select the smallest architecture that satisfies those constraints.
3. Read `references/technical-reference.md` when detailed matrices, anti-patterns, commands, or source links are needed.
4. State the chosen pattern, rejected alternatives, and what breaks at runtime if the choice is wrong.
5. Add or update changelog entries only for verified technical changes.

## Output Contract

Return:
- Recommended decision and why.
- Alternatives rejected with concrete tradeoffs.
- Runtime risks, failure triggers, and mitigation.
- Validation steps or evidence needed before adoption.

## References

- `references/technical-reference.md` — curated technical basis for v3.0 decisions.
- `references/source-index.md` — source links and verification status for version-sensitive claims.
