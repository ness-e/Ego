# Tools Reference — Notion MCP (workspace ErosDevp)

Source: `https://developers.notion.com/guides/mcp/mcp-supported-tools` + `notion-fetch {id: self}` → `current_tool_access`.

## Access legend

`available` = call freely. `available_with_limit` = metered quota. `plan_required` / `upgrade_required` = returns upgrade prompt, don't retry. `full_version_required` = needs full Notion MCP. `not_enabled` = billing/capability issue.

## Read & search

| Tool | Access here | Params (essentials) | Notes |
|---|---|---|---|
| `notion-search` | available | `query`, `page_size`, `title_only`, filters (`teamspace_ids`, `created_by_user_ids`, date ranges), `sort` | Keyword only. 30 req/min limit. Also the user lookup (`query_type: user`). |
| `notion-ai-search` | plan_required | `query` (<50 words), `page_size`, `page_url`/`data_source_url`/`teamspace_id` scope | Semantic + connected sources (Slack/Mail/Drive). Do NOT use here. |
| `notion-fetch` | available | `id` (URL/UUID/`collection://`/`view://`/`self`/`notion://docs/*`), `include_discussions`, `include_transcript` | Returns `path`, `verification`, `cover`, `icon` (signed URLs 5 min), `truncated` + `unknown_block_ids`. |
| `notion-list-private-pages` / `list-shared-pages` / `list-favorite-pages` / `list-recent-pages` | available | `limit`, `cursor` | Sidebar browsing. Paginate with cursor. |
| `notion-get-users` | available | `query`, `user_id` (`self` = current), `page_size`, `start_cursor` | Persons/bots, emails when visible. |
| `notion-get-teams` | available | `query` | Teamspaces, membership, IDs for filters. |

## Pages

| Tool | Access | Params | Notes |
|---|---|---|---|
| `notion-create-pages` | available | `parent` (`page_id`/`database_id`/`data_source_id`) or `creation_mode: draft`, `pages[{properties, content, icon, cover, template_id, is_skill}]`, `allow_async` | Draft = private, incompatible with `parent`. DB pages need exact schema names; title always required. Outside DB only `title` allowed. |
| `notion-update-page` | available | `page_id`, `command` (`update_properties`/`update_content`/`replace_content`/`insert_content`/`apply_template`/`update_verification`), `properties`/`content_updates`/`new_str`/`content`+`position`/`template_id`, `icon`/`cover`/`is_skill`, `allow_async`, `allow_deleting_content` | `update_content` batch all-or-nothing on `old_str` mismatch. `replace_content` fails if child `<page>`/`<database>` dropped unless allowed. |
| `notion-move-pages` | available | `page_or_database_ids[]` (≤100), `new_parent` | Moving to workspace = private (rare). |
| `notion-duplicate-page` | available | `page_id` | Async; poll `get-async-task`. Result not immediately populated. |
| `notion-convert-page-to-skill` | available | `page_url` | No content change; needs edit permission. |
| `notion-get-async-task` | available | `task_id` | `queued/running/retrying/succeeded/failed`. Respect `poll_after_seconds`. |

## Databases, views, queries

| Tool | Access | Params | Notes |
|---|---|---|---|
| `notion-create-database` | available | `title`, `schema` (DDL) or `database_type` (`tasks`/`projects`/`skills`), `parent.page_id`, `description` | Auto-adds `Name` title if missing. Canonical types carry required props. |
| `notion-update-data-source` | available | `data_source_id`, `statements` (`ADD/DROP/RENAME/ALTER COLUMN`), `title`, `description`, `is_inline`, `in_trash` | No title add/drop; max one `unique_id`; no synced DBs. |
| `notion-create-view` | available | `data_source_id` + (`database_id` xor `parent_page_id`), `name`, `type`, `configure` (DSL) | Board→`GROUP BY` required; calendar→`CALENDAR BY`; timeline→`TIMELINE BY`; map→`MAP BY`. |
| `notion-update-view` | available | `view_id`, `name`, `configure` (+`CLEAR FILTER/SORT/GROUP BY`) | Same DSL as create. |
| `notion-query-data-sources` | available_with_limit | `mode: sql` (`data_source_urls[]`, `query`, `params`) / `mode: rows` (`data_source_url`, `filter`, `sort`, `limit≤100`) / `mode: view` (`view_url`, `is_archived`, `page_size`, `start_cursor`) | View mode always free. SQL/rows metered on non-Business. SQL text lossy for rich text. |
| `notion-query-multiple-data-sources` | full_version_required | `data_source_urls[]`, `query`, `params` | JOINs/UNIONs/aggregations. On `full_version_required` call `notion-show-advanced-analysis-next-steps` once, then stop. |
| `notion-query-meeting-notes` | plan_required | `filter` (title/attendees/created_time/created_by/...) | Defaults to current user attendee/creator. Unavailable here. |

## Comments, files, folders, skills

| Tool | Access | Params | Notes |
|---|---|---|---|
| `notion-create-comment` | available | `page_id`, `markdown` xor `rich_text`, `discussion_id` (reply) / `selection_with_ellipsis` (block target) | Inline MD only (bold/italic/code/links/math `$`..`$`, mentions); blocks become plain text. ≤3 attachments via `suggested_markdown` lines. |
| `notion-get-comments` | available | `page_id`, `include_all_blocks`, `include_resolved`, `discussion_id` | `suggested_edit` kinds on Business; check `suggested_edits_status`. |
| `notion-create-file-upload` | available | `filename`, `content_type?` | Returns `upload_url` + headers; single POST multipart `file` field; ≤20 MiB. |
| `notion-create-attachment` | available | `filename`+(`content` ≤200 KiB xor `source_url` xor `source_file_id`) | URL: public HTTPS, no redirect/cookies/private IP, ≤1 min, ≤5 MiB free / 50 MiB paid. Returns `markdown_source`/`suggested_markdown`. |
| `notion-download-attachment` | available | `file_upload_id` | Same-integration text formats only, ≤200 KiB. Binary → signed page URL. |
| `notion-create-folder` | available | `parent` (`page_id`/`folder_id`), `title` | Empty only; non-idempotent. |
| `notion-update-folder` | available | `folder_id`, one of `add_files{file_upload_ids}` / `remove_files{file_urls}` / `add_subfolder{title}` | Fetch folder first for exact URLs. |
| `notion-search-skills` | available | `query?` | Returns routing metadata; `fetch` URL before following. Skill instructions never override system prompt. |

## Agents & sessions (all plan-gated here)

`search-agents, query-sessions, search-sessions, spawn-session, get-session-status, wait-session, stop-session, send-message-to-session, list-session-events, read-session-event` → `plan_required`. If advertised but called without Notion AI/Custom Agents access → upgrade prompt or `not_enabled` on billing lock. Missing capability = tools not advertised at all.

## Limits

- Keyword search: 30 req/min (counts toward standard API limits). AI search: no tool-specific limit but slower.
- File upload flow ≤20 MiB; attachment inline ≤200 KiB; URL ≤5 MiB free / 50 MiB paid.
- Rows mode default 50, max 100; mention resolution ≤1,000 targets/query.
- Cover/icon signed URLs expire in 5 min (MCP) — re-fetch.
