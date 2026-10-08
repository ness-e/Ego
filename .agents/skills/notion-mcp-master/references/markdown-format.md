# Notion-Flavored Markdown — complete format

Source: `notion-fetch {id: "notion://docs/enhanced-markdown-spec"}`. Tabs = nesting. Escape with `\`: `\ * ~ ` $ [ ] < > { } | ^`.

## Rich text (inline)

| Effect | Syntax |
|---|---|
| Bold / italic / strikethrough | `**x**` / `*x*` / `~~x~~` |
| Underline | `<span underline="true">x</span>` |
| Inline code (single + multi-line) | `` `x` `` / `` `L1<br>L2` `` (never raw newline inside) |
| Link / citation | `[t](URL)` / `[^URL]` |
| Inline color | `<span color="Color">x</span>` |
| Inline math | `$`Eq`$` (backticks mandatory) |
| Line break inside block | `<br>` |
| Custom emoji | `:emoji_name:` |

Colors (block `{color="C"}` or inline `<span>`): text `gray brown orange yellow green blue purple pink red`; backgrounds same + `_bg` suffix.

## Blocks

```
Text line {color="Color"}
  Children (tab-indented)
# H1 {color} / ## H2 / ### H3 / #### H4   (H5/H6 → H4)
- bullet {color}        (must contain inline rich text, not bare children)
1. numbered {color}
<empty-block/>          (own line; plain blank lines are stripped)
> quote {color} / > L1<br>L2  (raw newline = separate quotes; lone > = ugly empty quote)
- [ ] todo / - [x] todo
---
<table fit-page-width? header-row? header-column?> + <colgroup><col color? width?> + <tr color?><td color?>rich-text-only</td>
$$ Eq $$                (block equation)
```lang ... ```        (literal content, no escaping; mermaid: quote labels, <br> breaks)
```

## Mentions (URL mandatory, inner text optional)

```xml
<mention-user url="..."/> <mention-page url="..."/> <mention-database url="..."/>
<mention-data-source url="..."/> <mention-agent url="..."/>
<mention-date start="YYYY-MM-DD" end="YYYY-MM-DD"/>
<mention-date start="YYYY-MM-DD" startTime="HH:mm" timeZone="IANA"/>
```

## Advanced blocks (page content only)

```xml
<details color?><summary>Rich text</summary>
  Children (indented = toggleable)
</details>
# H1 {toggle="true"} + indented children  (toggle headings H1–H3)
<callout icon="emoji|icons/..._gray" color?>  Rich text + children (Markdown inside, not HTML) </callout>
<columns><column ratio?="50"> Children </column><column>…</column></columns>
<tabs><tab icon?="...">
  Title (first indented line)
  Children
</tab></tabs>
<page url="URL" color?>Title</page>                 <!-- MOVES page as subpage! mention ≠ move -->
<folder url="URL">Title</folder>                    <!-- existing only; traverse via fetch -->
<database url? inline? icon? color? data-source-url? wiki?>Title</database>
<audio src="URL">cap</audio> <file src="URL">cap</file>
<embed src="file-upload://...">cap</embed>          <!-- HTML artifacts ALWAYS <embed> -->
![cap](URL)   <pdf src="URL">cap</pdf>   <video src="URL">cap</video>
<table_of_contents/>
<synced_block url?> Children </synced_block>        <!-- omit url on create -->
<synced_block_reference url="URL" notice?> Children </synced_block_reference>
<meeting-notes> Title
  <summary>AI summary</summary>   <!-- omit on create -->
  <notes>User notes</notes>
  <transcript>…</transcript>      <!-- READ-ONLY, omit on create, never edit -->
</meeting-notes>
<unknown url="URL" alt="Alt"/>
```

Table notes: attrs default `false`; color precedence cell > row > column; cells rich-text-only (use `**b**` not `<b>`); merges UI-only (select → Merge cells).
