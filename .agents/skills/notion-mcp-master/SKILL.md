---
name: notion-mcp-master
description: "Master guide for Notion MCP in this workspace: every tool, Notion-flavored Markdown for all block types, database properties and SQLite value formats, views DSL, comments, files, folders, skills. Use when reading, searching, creating or updating Notion pages, databases, views, comments, or when exact Markdown/property/filter syntax is needed."
---

# Notion MCP Master

Canonical workflow for Notion work via MCP. Detail lives in `references/` — read only the file the task needs.

## 0. Connection check (once per session when in doubt)

```json
{ "tool": "notion-fetch", "arguments": { "id": "self" } }
```

Returns workspace (`ErosDevp`), user, and `current_tool_access` map. Route by its statuses — see [tools-reference](references/tools-reference.md). Key routing in this workspace:

- Content search: `ai_search` is `plan_required` → use `notion-search` (keyword), never `ai-search`.
- Single data source queries: `query_data_sources` is `available_with_limit` (metered quota; view mode always free).
- Multi-source SQL JOINs: `full_version_required` → single-source only, or ask for upgrade.
- Meeting notes / Custom Agents / sessions: `plan_required` → report as unavailable, don't retry.

## 1. Search → fetch → act

1. **Search**: `notion-search` for keywords (title-only, filters, user lookup by name/email). No semantic search here.
2. **Fetch** every important match before relying on it (`path`, `verification`, `page_last_edited_at`, `truncated` + `unknown_block_ids`). Large pages truncate — re-fetch subtree IDs.
3. **Act**: create/update/query/comment. After structural edits, re-fetch to verify.

Sources: `notion://docs/enhanced-markdown-spec`, `notion://docs/view-dsl-spec` (fetch via `notion-fetch`), official docs index `https://developers.notion.com/llms.txt`.

## 2. Writing pages (content format)

All page `content` is **Notion-flavored Markdown**, never raw API block JSON. Full syntax → [markdown-format](references/markdown-format.md). Rules that bite:

- Tabs for nesting, `\` escapes `\ * ~ ` $ [ ] < > { } | ^`.
- No raw newlines inside inline code or multi-line quotes — use `<br>`.
- Empty line = `<empty-block/>` on its own line.
- `<page url="...">` MOVES that page as subpage; `<mention-page>` only references. Same for `<database>` vs `<mention-database>`.
- HTML artifacts = `<embed src="file-upload://...">`, never code/file block.
- Table cells = rich text only; merges only in UI.
- Meeting-notes `<transcript>` is read-only; omit `<summary>`/`<transcript>` on create.

Update commands: `update_properties` | `update_content` (exact `old_str`, batch-all-or-nothing) | `replace_content` (must preserve `<page>`/`<database>` child tags or pass `allow_deleting_content`) | `insert_content` (`start`/`end`) | `apply_template` (async, poll content) | `update_verification`.

`allow_async: true` default for writes; on `async_task` poll `notion-get-async-task` until `succeeded` before dependent steps. `succeeded` ≠ template content ready — verify by fetch.

## 3. Databases

- Schema first: `notion-fetch` on `collection://...` URL gives schema + templates.
- Types/DDL/SQLite row values → [database-properties](references/database-properties.md). Gotchas: exactly one `title`; `__YES__`/`__NO__` for checkbox; `date:{Prop}:start/end/is_datetime`; relations = URL/UUID arrays; person = `user://` URI or `me`; SQL text is lossy (re-read with rows mode before rewriting rich text).
- Query: `notion-query-data-sources` modes `rows` (faithful rich text) / `sql` / `view` (`view://` URL, `is_archived` flag). Limit 100/req, `has_more` + `next_cursor` in view mode.

## 4. Views

`table, board, list, calendar, timeline, gallery, form, chart, map, dashboard`. Configure with DSL → [views-dsl](references/views-dsl.md). Board needs `GROUP BY`; calendar `CALENDAR BY`; timeline `TIMELINE BY`; map `MAP BY`. Relation filter = page URL/UUID (never name); person filter = `user://` URI or `me`.

## 5. Everything else

- Tools inventory with params, access states, limits → [tools-reference](references/tools-reference.md).
- API block types ↔ Markdown mapping, children rules, rate limits → [blocks-reference](references/blocks-reference.md).
- Comments: page-level, block-level via `selection_with_ellipsis` (~10 chars each end), thread replies via `discussion_id`. Max 3 file attachments per comment via `suggested_markdown` line.
- Files: `create-file-upload` (local ≤20 MiB) → POST multipart → `suggested_markdown`; `create-attachment` (inline ≤200 KiB / URL ≤5–50 MiB, no redirects/auth); `download-attachment` (text only, same integration).
- Folders: create empty under page; `add_files` (upload IDs) / `remove_files` (exact URLs from fetch) / `add_subfolder` — one command per call. Folders can't be created from Markdown.
- Skills: `search-skills` → `fetch` URL before following; `convert-page-to-skill` / `is_skill` flag to publish.
