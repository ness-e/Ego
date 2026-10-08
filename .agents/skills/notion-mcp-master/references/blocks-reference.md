# Blocks — API types ↔ Markdown mapping, children, limits

Source: `https://developers.notion.com/reference/block`. Via MCP you write **Markdown**, never block JSON — this table is for understanding fetch output and coverage.

## All block types → Markdown

| API `type` | Markdown | Children? |
|---|---|---|
| `paragraph` | text line | yes |
| `heading_1..4` (+`is_toggleable`) | `#`/`##`/`###`/`####` + `{toggle="true"}` | yes (toggleable or H1–H4) |
| `bulleted_list_item` / `numbered_list_item` | `-` / `1.` | yes |
| `to_do` | `- [ ]` / `- [x]` | yes |
| `quote` | `>` (`<br>` multi-line) | yes |
| `callout` | `<callout icon color>` | yes |
| `code` (71 langs incl. `mermaid`) | ```` ```lang ```` | no |
| `equation` | `$$...$$` | no |
| `divider` | `---` | no |
| `table_of_contents` / `breadcrumb` | `<table_of_contents/>` / API-only | no |
| `table` / `table_row` | `<table><colgroup><col><tr><td>` | table→rows |
| `image` / `video` / `file` / `pdf` / `audio` | `![c](URL)` / `<video>` / `<file>` / `<pdf>` / `<audio>` | no |
| `bookmark` / `embed` / `link_preview` | bookmark/link_preview API-only; embed → `<embed>` | no |
| `child_page` / `child_database` | `<page>` / `<database>` (MOVE semantics!) | yes |
| `column_list` / `column` (`width_ratio` 0–1, sum 1) | `<columns><column ratio>` (≥2 cols, each ≥1 child) | yes |
| `toggle` | `<details><summary>` | yes |
| `synced_block` (+`reference`) | `<synced_block(_reference) url>` | yes |
| `template` | API-only (use `template_id`) | yes |
| `transcription` → renamed `meeting-notes` (API `2026-03-11`) | `<meeting-notes><summary><notes><transcript>` | yes |
| `unsupported` (`button`, `form`, …) | `<unknown url alt>` | no |

`has_children` + `in_trash` flags on every block. `created_by/last_edited_by` need read-content capability.

## Operational limits

- `fetch` truncates big pages: `truncated:true` + `unknown_block_ids[]` (≤50) + `unknown_block_count` → re-fetch IDs; `object_not_found` on retry = permissions, not failure.
- `update_content`: batch all-or-nothing; `old_str` non-empty, unique unless `replace_all_matches`.
- `replace_content`: dropping `<page>`/`<database>` deletes/moves children — include tags or set `allow_deleting_content:true` (confirm with user first).
- `apply_template`/large writes: async — `succeeded` covers write only; poll content for template output.
- Standard API request limits apply per user across all MCP calls, plus keyword-search 30/min.
