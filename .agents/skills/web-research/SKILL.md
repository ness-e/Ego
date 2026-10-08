# Web Research Skill

Orchestrates two MCP search servers for comprehensive web research. Use this skill whenever the task requires searching the web, extracting content, or gathering information from specialized sources.

## Available Tools

Two MCP servers are configured: `smart_search` and `deep_search`. Use the appropriate one based on the type of query.

### smart_search (for general web search)

Use for: general web searches, tech docs, programming Q&A, latest news, competitive research.

```json
// Configuration in opencode.jsonc:
// "command": ["npx", "-y", "github:mckenzieit/smart-web-search"]
```

**Tools:**
- `web_search` — Search via 7 engines (Bing, Brave, DDG, Baidu, Yandex) with automatic failover
- `web_read` — Extract clean content from a URL (trafilatura → readability → BS4 fallback)
- `web_search_and_read` — Search + auto-extract top result content

**Strengths:** 7 search engines with failover, smart content extraction, quality site library, auto-learning

### deep_search (for specialized search)

Use for: academic papers, Wikipedia lookups, GitHub READMEs, Reddit discussions, PDF parsing, credibility checks, date/time, geolocation.

```json
// Configuration in opencode.jsonc:
// "command": ["npx", "-y", "github:KazKozDev/mcp-search-server"]
```

**Tools:**
- `search_duckduckgo` — Web/news search (1 engine)
- `search_arxiv` — Academic papers
- `search_pubmed` — Biomedical research
- `search_wikipedia` / `get_wikipedia_summary` / `get_wikipedia_article` — Wikipedia
- `search_github` / `get_github_readme` — GitHub repos + READMEs
- `search_reddit` / `get_reddit_comments` — Reddit discussions
- `extract_webpage_content` — Content extraction
- `parse_pdf` — PDF text extraction
- `get_current_datetime` / `get_location_by_ip` — Contextual info
- `assess_source_credibility` — Source quality scoring
- `summarize_text` — Local text summarization
- `calculator` — Math evaluation
- `search_places` — Location/address search
- `search_gdelt` — Global news database
- `read_file` / `write_file` / `append_file` / `list_directory` / `delete_file` — File management

## Decision Matrix

| Query Type | Use | Why |
|---|---|---|
| General web search, code, docs | `smart_search.web_search` | 7 engines, more reliable |
| Academic papers (arXiv, PubMed) | `deep_search.search_arxiv` / `search_pubmed` | Specialized APIs |
| Wikipedia lookup | `deep_search.search_wikipedia` | Structured summaries |
| GitHub repo search / README | `deep_search.search_github` / `get_github_readme` | Direct GitHub API |
| Reddit opinions / discussions | `deep_search.search_reddit` | Community perspectives |
| PDF content extraction | `deep_search.parse_pdf` | Native PDF support |
| Date/time / geolocation | `deep_search.get_current_datetime` / `get_location_by_ip` | Context awareness |
| Content from known URL | `smart_search.web_read` | Better extraction pipeline |
| Source credibility check | `deep_search.assess_source_credibility` | 30+ signals |
| Math / calculation | `deep_search.calculator` | Safe AST evaluation |
| News (recent) | `smart_search.web_search` (news mode) or `deep_search.search_gdelt` | Both work |
| Batch / multi-query | `smart_search.web_search` | Better reliability |

## Workflow

1. For **general research**: try `smart_search.web_search` first (most reliable)
2. For **specialized sources**: use `deep_search` tools directly (arXiv, PubMed, Wikipedia, GitHub, Reddit, PDFs)
3. For **content extraction from a URL**: prefer `smart_search.web_read` over `deep_search.extract_webpage_content`
4. For **quick facts**: `deep_search.get_wikipedia_summary` or `deep_search.get_current_datetime`
