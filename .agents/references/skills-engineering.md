# Skill Loading Guides — Dynamic Skill Discovery Protocol (SDP v2)

> Movido desde `.agents/AGENTS.md` — referencia canónica. Consultar cuando necesites decidir qué skill cargar. Si editas, actualiza también el puntero en AGENTS.md.
> **Versión 2.0 (2026-09-01)**: SDP dinámico — búsqueda en catálogo completo (193 skills) por fase, tipo de tarea, archivos clave y keywords del contrato.

---

## Skill Discovery Protocol (SDP v2 — Dinámico)

> **Obligatorio en cada tarea** (agente principal Y sub-agentes). Se ejecuta en **cada fase**: PLAN, TASK, RUN, VERIFY, REVIEW, SHIP.
> `campaign_discover_skills_v2` (MCP, canónico) devuelve base por tipo + scoring dinámico (`campaign_load_skills` deprecated); **SDP v2 expande dinámicamente** buscando en catálogo completo.

### Algoritmo de Discovery (se ejecuta automáticamente en cada fase)

```
INPUT:  fase_actual, task_id, archivos_clave, keywords_contrato, tipo_tarea
OUTPUT: lista ordenada de skills a cargar (max 10, justificadas)

1. BASE_FIJA = campaign_discover_skills_v2(tipo_tarea)                 // canónico (`campaign_load_skills` deprecated)
2. KEYWORDS = extraer_keywords(archivos_clave, task_id, contrato)  // grep en SKILLS-MANIFEST.md + available_skills
3. CANDIDATAS = buscar_en_catalogo(KEYWORDS, fase_actual)         // score por relevancia
4. FILTRADAS = deduplicar(BASE_FIJA + CANDIDATAS)                  // prioridad: fase_actual > tipo_tarea > rating
5. SELECCIONADAS = top_n(FILTRADAS, max_skills=10)                // límite configurable
6. JUSTIFICAR = para cada skill: "fase=X, keyword=Y, rating=Z"    // registro en task file + RESULTADO
7. CARGAR = skill <nombre> para cada una en orden
```

### Parámetros de configuración (en task file o AGENTS.md)

```yaml
sdp_config:
  max_skills_per_phase: 5             # default 5 + base fija por tipo (antes 10: 10 skills × ~2-5k tokens = hasta 50k por fase)
  min_relevance_score: 0.6           # threshold score 0-1
  boost_phase_match: 0.3             # bonus si skill está en lifecycle mapping de la fase
  boost_type_match: 0.2              # bonus si skill coincide con tipo_tarea
  boost_rating: 0.1                  # bonus por rating en SKILLS-MANIFEST.md (1-10)
  exclude_deprecated: true           # no cargar skills DEPRECATED (ej: debugging-and-error-recovery)
  prefer_local: true                 # .agents/skills/ > global
  exclude_families_unless_exact: ["incl-*", "gsap-*", "understand-*"]  # familias pesadas (~100+ micro-skills): solo con keyword exacta, no por scoring difuso
```

### Flujo por Fase (se ejecuta AUTOMÁTICAMENTE al entrar en cada fase)

| Fase | Trigger | Qué busca | Skills base (siempre) | Skills dinámicas (ejemplos) |
|------|---------|-----------|----------------------|----------------------------|
| **PLAN** | `/pipeline plan` | Backlog items, specs, arquitectura | `planning-and-task-breakdown`, `spec-driven-development` | `idea-refine`, `interview-me`, `constraint-driven-development`, `architecture-decision-record` |
| **TASK** | `/pipeline task <ID>` | Task file, archivos clave, tipo tarea | `campaign-executor` + base por tipo | `spec-driven-development`, `systematic-debugging`, `test-driven-development`, skills específicas dominio |
| **RUN** | `/pipeline run` | Plan file, dependencias, waves | `campaign-executor`, `progreso` | Por cada task en wave: skills dinámicas por tipo |
| **BUILD** | Ejecución tarea | Archivos tocados, lenguaje, dominio | `incremental-implementation`, `test-driven-development` | `source-driven-development`, `doubt-driven-development`, `security-and-hardening`, `api-and-interface-design`, `frontend-ui-engineering` |
| **VERIFY** | Post-implementation | Test results, builds, errores | `systematic-debugging` | `browser-testing-with-devtools`, `code-review-and-quality`, `performance-optimization` |
| **REVIEW** | Pre-merge | Diff, blast radius, security | `code-review-and-quality` | `code-simplification`, `security-and-hardening`, `deprecation-and-migration`, `observability-and-instrumentation` |
| **SHIP** | `/ship` | Release readiness, changelog | `git-workflow-and-versioning`, `shipping-and-launch` | `ci-cd-and-automation`, `documentation-and-adrs`, `deprecation-and-migration` |

---

### SDP v3 — mejoras (2026-09-27, decisión owner "todas las mejoras")

> Implementado en `.agents/task-system/mcp/sdp-v3.mjs` (el tool sigue llamándose
> `campaign_discover_skills_v2`; el output agrega `sdpVersion: "v3"` y campos `pinned`/`derivedKeywords`).
> Test: `bun .agents/task-system/scripts/sdp-selftest.mjs` (14 checks).

1. **B1 — Alias ES↔EN + morfología**: keywords en español se normalizan (`seguridad→security`, `deuda→quality`, `entorno→ci`, …) y los plurales se singularizan (`tests→test`, `gates→gate`). Fix del gap "planning en español vs tabla inglesa".
2. **B2 — Drift spec↔impl cerrado**: familias pesadas (`incl-*` 58 dirs, `gsap-*`, `understand-*`) **solo con keyword exacta**; skills `DEPRECATED` excluidas; `minScore` default **0.6**; boost `taskType` 0.2 activo; **base fija obligatoria** (campaign-executor/progreso/tipo siempre seleccionadas aunque rankeen bajo). **Techo real:** `maxSkills` aplica al fill por score; pins+base son obligatorios y pueden excederlo (overshoot típico ≤2-3 extra).
3. **B3 — Índice enriquecido**: `skills-index.json` (196 skills: description + tokens + rating + deprecated) generado por `bun .agents/task-system/scripts/build-skills-index.mjs` (re-ejecutar cuando cambien skills/manifest).
4. **L1 — Re-rank por descripción**: overlap de tokens del contrato vs descripción de la skill (+0.05/token, cap 0.15).
5. **R1 — Policy pins (guardrails)**: por señal de path/contrato se suman skills obligatorias con `score=1, pinned:true`:
   `.agents/**→doubt-driven-development` · `.github/|release-plz|semver|workflow→ci-cd-and-automation+git-workflow-and-versioning` · `unsafe|ffi|pyo3|wasm|auth|secret→security-and-hardening` · `docs/api/→documentation-and-adrs+api-and-interface-design` · `tests/|test_|fix|bug→TDD+systematic-debugging` · `storage|wal|schema|migration→deprecation-and-migration` · `performance|bench|hot path→performance-optimization`. **Los pins NO se negocian.**
6. **S1 — Cuota de diversidad**: con señal de riesgo (security/breaking/release/migration/deuda…) se garantiza ≥1 skill de calidad (`code-review-and-quality`/`doubt-driven-development`/`security-and-hardening`/`test-driven-development`).
7. **S2 — Feedback loop**: `memory/skill-outcomes.json` — registrar con `bun .agents/task-system/scripts/record-skill-outcome.mjs <taskId> ok|fail <skills,coma>` (el orquestador lo hace al cierre de cada tarea); skills con éxito ≥0.7 y ≥3 usos reciben +0.1; banda 0.4–0.7 → +0.05; <0.4 → −0.1.
8. **S3 — Pin manual**: el task file ("Herramientas necesarias") puede fijar skills extra — estándar para tareas 🔴.

## Catálogo de Keywords → Skills (mapeo dinámico)

> Este mapeo se usa para **scoring automático**. Keywords extraídas de: task title, archivos clave, contrato, tipo de tarea.

```yaml
keyword_to_skills:
  # Rust Core / Engine
  "rust": ["source-driven-development", "test-driven-development", "systematic-debugging"]
  "engine": ["api-and-interface-design", "performance-optimization"]
  "storage": ["deprecation-and-migration", "observability-and-instrumentation"]
  "wal": ["security-and-hardening", "deprecation-and-migration"]
  "index": ["performance-optimization", "systematic-debugging"]
  "hnsw": ["performance-optimization", "source-driven-development"]
  "concurrency": ["security-and-hardening", "doubt-driven-development"]
  "ffi": ["security-and-hardening", "systematic-debugging"]
  "pyo3": ["security-and-hardening", "api-and-interface-design"]
  "wasm": ["performance-optimization", "shipping-and-launch"]
  
  # Python / Bindings
  "python": ["source-driven-development", "api-and-interface-design"]
  "sdk": ["api-and-interface-design", "documentation-and-adrs"]
  "bindings": ["security-and-hardening", "test-driven-development"]
  
  # Web / Frontend
  "web": ["frontend-ui-engineering", "browser-testing-with-devtools"]
  "ui": ["frontend-ui-engineering", "design-taste-frontend"]
  "component": ["frontend-ui-engineering", "incremental-implementation"]
  "nextjs": ["frontend-ui-engineering", "source-driven-development"]
  "tailwind": ["frontend-ui-engineering"]
  "motion": ["design-motion-principles", "frontend-ui-engineering"]
  "accessibility": ["a11y-accessibility-audit", "incl-accessible-content-review"]
  "a11y": ["a11y-accessibility-scan", "a11y-accessibility-fix"]
  
  # Testing / Quality
  "test": ["test-driven-development", "systematic-debugging"]
  "debug": ["systematic-debugging", "browser-testing-with-devtools"]
  "flaky": ["systematic-debugging", "code-review-and-quality"]
  "coverage": ["test-driven-development", "constraint-driven-development"]
  "benchmark": ["performance-optimization", "observability-and-instrumentation"]
  "profile": ["performance-optimization", "ego-tuner"]
  
  # Security / Hardening
  "security": ["security-and-hardening", "doubt-driven-development"]
  "unsafe": ["security-and-hardening", "systematic-debugging"]
  "audit": ["ego-audit", "security-and-hardening"]
  "supply-chain": ["security-and-hardening", "deprecation-and-migration"]
  
  # CI/CD / Release
  "ci": ["ci-cd-and-automation", "shipping-and-launch"]
  "release": ["shipping-and-launch", "git-workflow-and-versioning"]
  "version": ["git-workflow-and-versioning", "release-notes-one-pager"]
  "changelog": ["documentation-and-adrs", "release-notes-one-pager"]
  "deploy": ["shipping-and-launch", "observability-and-instrumentation"]
  
  # Architecture / Design
  "architecture": ["api-and-interface-design", "deprecation-and-migration"]
  "design": ["ego-design-orchestrator", "impeccable"]
  "api": ["api-and-interface-design", "spec-driven-development"]
  "interface": ["api-and-interface-design", "frontend-ui-engineering"]
  "refactor": ["code-simplification", "incremental-implementation"]
  "simplify": ["code-simplification", "ponytail"]
  
  # Task System / Campaign
  "pipeline": ["campaign-executor", "progreso"]
  "task": ["campaign-executor", "planning-and-task-breakdown"]
  "plan": ["planning-and-task-breakdown", "spec-driven-development"]
  "backlog": ["progreso", "campaign-executor"]
  
  # Documentation
  "docs": ["documentation-and-adrs", "writing-guidelines"]
  "adr": ["documentation-and-adrs", "deprecation-and-migration"]
  "spec": ["spec-driven-development", "interview-me"]
```

---

## Implementación en Campaign Executor (MCP)

### Nueva tool: `campaign_discover_skills_v2`

```typescript
// En .agents/task-system/mcp/campaign-server.mjs
export async function campaign_discover_skills_v2(args) {
  const { phase, taskId, keyFiles, contractKeywords, taskType, maxSkills = 10 } = args;
  
  // 1. Cargar base fija por tipo
  const baseSkills = await campaign_discover_skills_v2({ taskType });
  
  // 2. Extraer keywords de archivos clave + contrato
  const keywords = extractKeywords(keyFiles, contractKeywords, taskId);
  
  // 3. Buscar en SKILLS-MANIFEST.md + available_skills
  const candidates = await searchSkillsCatalog(keywords, phase);
  
  // 4. Scoring
  const scored = candidates.map(c => ({
    ...c,
    score: calculateScore(c, phase, taskType, keywords)
  })).sort((a, b) => b.score - a.score);
  
  // 5. Deduplicar + limitar
  const selected = deduplicateAndLimit([...baseSkills, ...scored], maxSkills);
  
  // 6. Justificación
  const justified = selected.map(s => ({
    skill: s.name,
    phase,
    reason: buildJustification(s, phase, taskType, keywords),
    score: s.score
  }));
  
  return { skills: justified, metadata: { phase, taskId, keywords, baseCount: baseSkills.length, dynamicCount: scored.length } };
}

function calculateScore(skill, phase, taskType, keywords) {
  let score = skill.rating / 10; // base 0-1
  
  // Boost por fase (lifecycle mapping)
  if (lifecycleMapping[phase]?.includes(skill.name)) score += 0.3;
  
  // Boost por tipo de tarea
  if (typeMapping[taskType]?.includes(skill.name)) score += 0.2;
  
  // Boost por keyword match
  const keywordMatches = skill.keywords.filter(k => keywords.includes(k)).length;
  score += keywordMatches * 0.1;
  
  // Penalty deprecated
  if (skill.deprecated) score -= 0.5;
  
  return Math.min(1, Math.max(0, score));
}
```

---

## Uso en Pipeline Commands

### En `/pipeline plan` (prompts/plan.md)
```markdown
## Paso 0 — SDP Discovery
Ejecutar: `campaign_discover_skills_v2({ phase: "PLAN", taskId: null, keyFiles: ["docs/dev/Backlog.md"], contractKeywords: ["backlog", "triage"], taskType: "planning", maxSkills: 8 })`
→ Carga skills base + dinámicas → registra en plan file
```

### En `/pipeline task <ID>` (prompts/task.md)
```markdown
## Fase 1 — SDP Discovery
Ejecutar: `campaign_discover_skills_v2({ phase: "TASK", taskId: "DRV-012", keyFiles: ["src/engine.rs", "src/storage/mod.rs"], contractKeywords: ["rust", "storage", "wal"], taskType: "feature-add", maxSkills: 10 })`
→ Skills específicas para tarea Rust storage/WAL
```

### En `/pipeline run` (prompts/pipeline-run.md)
```markdown
## Por cada wave/task
Ejecutar SDP v2 con phase="BUILD" + taskType del task file
→ Skills adaptadas a cada tarea en paralelo
```

---

## Skill Loading Guide — Actualizado (Diseño & Creativo)

- **Diseño UI/Frontend**: `ego-design-orchestrator` → `impeccable` → `design-taste-frontend` → **dinámico**: `responsive-craft`, `wireframer`, `ux-flow-designer`, `figma-implement-design`
- **Animación**: `motion` (preferido), `gsap-core` → **dinámico**: `gsap-scrolltrigger`, `gsap-timeline`, `emil-design-eng`
- **Corrección de bugs**: `systematic-debugging` → `writing-plans` → **dinámico**: `browser-testing-with-devtools`, `code-review-and-quality`
- **Features multi-paso**: `brainstorming` → `writing-plans` → **dinámico**: `spec-driven-development`, `planning-and-task-breakdown`, `incremental-implementation`
- **SEO**: `ai-seo` → `seo-audit` → `audit-website` → **dinámico**: `programmatic-seo`, `schema-markup`
- **Video/presentaciones**: `hyperframes` → deck skills → **dinámico**: `remotion-best-practices`, `hyperframes-animation`
- **Branding/Arte**: `brandkit`, `canvas-design`, `algorithmic-art`, `theme-factory`, `color-expert`, `platform-design`

---

## Skill Loading Guide — Ingeniería (Dynamic)

### Base por Tipo de Tarea (campaign_discover_skills_v2 — `campaign_load_skills` deprecated)

| Tipo Tarea | Skills Base (siempre) |
|------------|----------------------|
| `feature-add` | `incremental-implementation`, `test-driven-development`, `spec-driven-development`, `planning-and-task-breakdown` |
| `bug-fix` | `systematic-debugging`, `test-driven-development`, `incremental-implementation` |
| `refactor` | `code-simplification`, `incremental-implementation`, `test-driven-development` |
| `security` | `security-and-hardening`, `doubt-driven-development`, `systematic-debugging` |
| `performance` | `performance-optimization`, `observability-and-instrumentation`, `source-driven-development` |
| `release` | `shipping-and-launch`, `git-workflow-and-versioning`, `ci-cd-and-automation` |
| `docs` | `documentation-and-adrs`, `writing-guidelines`, `spec-driven-development` |
| `research` | `web-research`, `coordinated-web-search`, `spec-driven-development` |

### Lifecycle Mapping (boost por fase)

```markdown
| Fase     | Skills con boost 0.3 |
|----------|---------------------|
| DEFINE   | spec-driven-development, interview-me, idea-refine, constraint-driven-development |
| PLAN     | planning-and-task-breakdown, spec-driven-development |
| BUILD    | incremental-implementation, test-driven-development, context-engineering, source-driven-development, doubt-driven-development, frontend-ui-engineering, api-and-interface-design |
| VERIFY   | systematic-debugging, browser-testing-with-devtools |
| REVIEW   | code-review-and-quality, code-simplification, security-and-hardening, performance-optimization, deprecation-and-migration, observability-and-instrumentation |
| SHIP     | git-workflow-and-versioning, ci-cd-and-automation, shipping-and-launch, documentation-and-adrs, deprecation-and-migration, observability-and-instrumentation |
```

---

## Registro de Skills Cargadas (OBLIGATORIO)

En cada task file (`docs/dev/tasks/<ID>.md`) y en bloque RESULTADO:

```markdown
## Herramientas necesarias → Skills

| Skill | Fase | Justificación | Score |
|-------|------|---------------|-------|
| campaign-executor | TASK | Base type=feature-add | 1.0 |
| spec-driven-development | PLAN | keyword=spec, fase=PLAN boost | 0.9 |
| systematic-debugging | VERIFY | keyword=debug, fase=VERIFY boost | 0.9 |
| security-and-hardening | BUILD | keyword=unsafe, tipo=security | 0.8 |
| api-and-interface-design | BUILD | keyword=api, archivos=src/api/* | 0.8 |
| test-driven-development | BUILD | base type=feature-add | 0.7 |

SKILLS_CARGADAS: campaign-executor, spec-driven-development, systematic-debugging, security-and-hardening, api-and-interface-design, test-driven-development
```

---

## Verificación SDP v2

El SDP se aplicó correctamente cuando:
- [ ] Se ejecutó en **cada fase** (PLAN, TASK, BUILD, VERIFY, REVIEW, SHIP)
- [ ] `max_skills_per_phase` no se excedió (≤10)
- [ ] Cada skill cargada tiene justificación en task file
- [ ] `SKILLS_CARGADAS:` block presente en RESULTADO
- [ ] Skills DEPRECATED no cargadas (`debugging-and-error-recovery`)
- [ ] Skills locales (`.agents/skills/`) priorizadas sobre globales
- [ ] Al menos 1 skill dinámica (no base) cargada por fase

---

## Referencias

- `SKILLS-MANIFEST.md` — catálogo completo 193 skills con ratings
- `.agents/references/definition-of-done.md` — quality bar
- `.agents/references/orchestration-patterns.md` — patrones multi-persona
- `addyosmani/agent-skills` — 25 skills base (instaladas en `.agents/skills/`)
- `docs/dev/references/skills-engineering.md` — este archivo (fuente canónica SDP)

---

## Changelog SDP

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2026-08-19 | Lifecycle mapping estático, discovery manual |
| 2.0 | 2026-09-01 | **SDP dinámico**: búsqueda catálogo completo, scoring por fase/tipo/keywords, auto-ejecución por fase, config YAML, tool MCP `campaign_discover_skills_v2` |