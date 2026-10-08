# Views DSL — full specification

Source: `notion-fetch {id: "notion://docs/view-dsl-spec"}`. Directives separated by `;` or newline. Property names double-quoted. Keywords case-insensitive.

## FILTER — `FILTER "Prop" <op> <value>`

Ops: `= != > < >= <= CONTAINS STARTS WITH ENDS WITH IS EMPTY IS NOT EMPTY IN ("a","b")`, compounds `AND OR ( )`. Multiple FILTERs AND together.

Value formats: select/multi_select/status = option (status: option OR group) name; date = `"2026-01-31"`; number = `42`; checkbox = `TRUE/FALSE`; relation = **page URL or UUID (never name)**; person/created_by/last_edited_by = `user://<id>` | UUID | `"me"` (never name); verification = `verified|expired|none`. `=`/`CONTAINS` both mean "contains" on multi-value (relation/person); `!=` = "does not contain". `place`/`files` support only emptiness checks; location system prop not filterable.

```
FILTER "Status" = "In Progress"; FILTER "Assignee" IS NOT EMPTY
FILTER ("Status" = "Done" OR "Status" = "Archived") AND "Priority" > 3
FILTER "Project" = "https://www.notion.so/Project-Alpha-0a1b2c3d4e5f60718293a4b5c6d7e8f9"
FILTER "Owner" != "user://151d872b-3d1c-4a3a-9d2f-6c3b1a2b3c4d"
```

## Other directives

```
SORT BY "Due Date" ASC [, "Name" DESC]     -- default ASC
GROUP BY "Status"                          -- REQUIRED for board
CALENDAR BY "Due Date"                     -- REQUIRED calendar (date/created/last_edited/formula-date)
TIMELINE BY "Start" TO "End"               -- REQUIRED timeline (date types)
SHOW "Name", "Status"  |  HIDE "Created Time"
COVER "Files & media" [SIZE small|medium|large] [ASPECT cover|contain]  -- gallery/board
WRAP CELLS true|false  |  FREEZE COLUMNS 2
MAP BY "Location"                          -- REQUIRED map (place prop)
CHART column|bar|line|donut|number [AGGREGATE count|sum|average|min|max... [ON "Prop"]]
  [COLOR gray|blue|green|purple|orange|red|auto|colorful] [HEIGHT small|medium|large|extra_large]
  [SORT x_asc|x_desc|y_asc|y_desc] [STACK BY "Prop"] [CAPTION "text"]
FORM CLOSE|OPEN  |  FORM ANONYMOUS true|false  |  FORM PERMISSIONS none|comment_only|reader|read_and_write|editor
CLEAR FILTER | CLEAR SORT | CLEAR GROUP BY      -- update_view only
```

Chart needs `GROUP BY` for x-axis (`GROUP BY "Status"; CHART column AGGREGATE count`).
