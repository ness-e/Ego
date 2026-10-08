# Frontend Design Systems Source Index

Source index for `../SKILL.md` and `technical-reference.md`.

## Verification Policy

- Do not add new version/API/security claims to `../SKILL.md`, `technical-reference.md`, or `../../../docs/CHANGELOG.md` without checking the live source.
- Record newly verified claims with date, source URL, and what was confirmed.
- Existing URLs below were extracted from the pre-v3 lite material and should be re-checked when used for new claims.

## Extracted Sources

| Source | URL | Verification Status |
|--------|-----|---------------------|
| w3.org | https://www.w3.org/TR/css-nesting-1/ | Needs re-verification before new changelog claims. |
| evilmartians.com | https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl | Needs re-verification before new changelog claims. |
| developer.mozilla.org | https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_container_queries | Needs re-verification before new changelog claims. |
| developer.mozilla.org | https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations | Needs re-verification before new changelog claims. |
| w3.org | https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ | Needs re-verification before new changelog claims. |
| chromatic.com | https://www.chromatic.com/blog/developers-guide-to-european-accessibility-act-2025/ | Needs re-verification before new changelog claims. |
| Local design.md handoff pattern | local project artifact | Not an external standard; use as a project-local semantic design handoff pattern. |

## New Verification Log

| Date | Claim | Source | Result |
|------|-------|--------|--------|
| 2026-05-15 | EAA enforcement began 28 June 2025; WCAG 2.1 AA/EN 301 549 remain key compliance anchors, WCAG 2.2 AA is a stronger product baseline. | https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en and https://www.w3.org/TR/WCAG22/ | Confirmed and softened. |
| 2026-05-15 | Neumorphism is not a legal category; document as avoid/high-risk for contrast and affordance failures, not an absolute EAA prohibition. | https://www.w3.org/TR/WCAG22/ | Corrected. |
| 2026-05-15 | design.md remains a local semantic-design pattern in this skill; no new external technical claim added. | Local references | Marked as pattern, not verified ecosystem standard. |
| 2026-05-15 | v3.0 restructuring only; no new technical/version claims added. | Local migration from `versions/v1.0-lite/SKILL.md` | Structural change only. |
