# Databases — schema DDL, property types, row values, querying

Sources: `https://developers.notion.com/reference/property-object` + tool descriptions. Schema first: `notion-fetch` on `collection://<id>` or DB URL (returns schema + `<templates>`).

## DDL (create-database / update-data-source)

```sql
CREATE TABLE ("Name" TITLE, "Done" CHECKBOX, "Due" DATE,
  "Priority" SELECT('High':red, 'Medium':yellow, 'Low':green),
  "Tags" MULTI_SELECT('eng':blue), "Price" NUMBER FORMAT 'dollar',
  "Total" FORMULA('prop("Price") * 1.1'),
  "Project" RELATION('ds_id'),                       -- one-way
  "Tasks" RELATION('ds_id', DUAL 'Parent' 'parent'),  -- two-way w/ synced name+id
  "Sum" ROLLUP('rel_prop','target_prop','sum'),
  "Task ID" UNIQUE_ID PREFIX 'TASK', "Link" URL, "Mail" EMAIL,
  "Tel" PHONE_NUMBER, "Files" FILES, "State" STATUS, "When" DATE COMMENT 'desc');
ADD COLUMN "P" SELECT('A':red); DROP COLUMN "Old"; RENAME COLUMN "A" TO "B";
ALTER COLUMN "P" SET SELECT('A':red,'B':blue);
```

Rules: exactly one `TITLE` (no add/drop); max one `UNIQUE_ID`; colors `default gray brown orange yellow green blue purple pink red`; `STATUS` groups `To-do/In progress/Complete` (UI to reconfigure groups); `FORMULA` uses `prop("Name")` (ID-stable); `RELATION` target DB must be shared with connection.

All 22 types: `TITLE RICH_TEXT NUMBER SELECT MULTI_SELECT STATUS DATE CHECKBOX URL EMAIL PHONE_NUMBER PEOPLE FILES FORMULA RELATION ROLLUP UNIQUE_ID CREATED_TIME LAST_EDITED_TIME CREATED_BY LAST_EDITED_BY VERIFICATION PLACE`.

## Row values via MCP (SQLite map)

Outside a DB only `title` is allowed. Inside a DB use exact schema names:

```
"Task Name": "text" | "Priority": 5 | "Done": "__YES__" | "__NO__"
"date:Due:start": "2024-12-25" | "date:Due:end": "2024-12-30" | "date:Due:is_datetime": 0|1
"place:HQ:name/address/latitude/longitude/google_place_id"
"Status": "In Progress"                       -- select/status by OPTION NAME
"Tags": ["eng","design"]                      -- multi-select array
"Project": ["<page-URL-or-UUID>", ...]        -- relation array
"Assignee": ["user://<uuid>" | "<uuid>" | "me"]  -- person array (names NOT accepted)
"Files": [{"type":"file_upload","file_upload":{"id":"<upload-id>"}}] / folder URLs / <folder> tags
userDefined:URL / userDefined:id              -- props literally named id/url
```

`unique_id/formula/rollup/created_*/last_edited_*` are read-only/computed. `place` reads back `null` via API (partial support).

## Querying (notion-query-data-sources)

- `rows`: `data_source_url` + structured `filter` (and/or groups, 2 levels) + `sort[{property,direction}]` + `limit≤100`. Faithful rich text (mentions/links/dates/equations preserved). No cursor.
- `sql`: `data_source_urls[]` + SQLite `SELECT ... FROM "collection://..." WHERE ...` + `params[?]`. Checkbox `__YES__/__NO__`; normalize dates with `datetime()/date()`; **SQL text is lossy** — re-read rich text via rows/fetch before editing.
- `view`: `view_url` + `is_archived` (false = live, true = archived partition) + `page_size` + `start_cursor` (`has_more`/`next_cursor` loop, same `is_archived` each page).

Canonical `tasks`/`projects`/`skills` types via `database_type` carry required props automatically.
