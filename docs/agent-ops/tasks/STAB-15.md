# STAB-15 — Docs enforcement + Diátaxis + empresa

> Estado: ⏳ IN PROGRESS (DISCOVERY completo, ACT en curso)
> Plan: `docs/agent-ops/plans/2026-10-16-plan-estabilizacion-ego.md` §Task 16
> SDP: writing-guidelines (skill) + base-only (docs-only, sin candidatos MCP en este harness)

## Contrato (del plan)

- Hook `commit-msg` convencional + CI falla ante mensaje no-convencional
- `docs/index` 4 secciones (user/design/adr/deployment + dev/agent-ops)
- Front-matter Diátaxis en user docs (tutorial/how-to/reference/explanation)
- 3 GIFs outcome en getting-started (proyecto→tarea→HITL→Canvas)
- Decisión site VitePress documentada + `pnpm docs:build` en docs-lint.yml
- Fix CHANGELOG placeholder `github.com/ego/ego` → `ness-e/Ego`
- Deprecación cruzada `operations/despliegue.md` vs `deployment/distribution.md`

## Spec (Gate D — por-evidencia; sin `question` en este harness, defaults reversibles)

| # | Decisión | Alternativas | Default aplicado | Evidencia |
|---|----------|--------------|------------------|-----------|
| D1 | Site | VitePress (Recomendado) / Docusaurus | VitePress | ✅ decidido-por-evidencia (`docs/.vitepress/config.mts:1-29` existe; contrato del plan dice "decisión site VitePress documentada") |
| D2 | Enforcement commits | commitlint+husky (Recomendado) / script zero-dep | commitlint + husky (hay red: `npm ping` PONG) | ✅ decidido-por-evidencia (contrato nombra husky+commitlint+lint-staged) |
| D3 | Tipos permitidos | `feat\|fix\|docs\|refactor\|chore\|test\|perf` | Esos 7 | ✅ decidido-por-evidencia (`cliff.toml:40-66` parsers + contrato) |
| D4 | GIFs | Capturas reales app (pesado/frágil) / diagramas SVG→GIF honestos (Recomendado) | Diagramas flujo outcome en `docs/user/assets/`, etiquetados como diagramas; capturas reales = follow-up | ✅ decidido-por-evidencia (sin display/app corriendo; contrato pide "outcome", no screencast) |
| D5 | Repo upstream | `ness-e/Ego` | Ese | ✅ decidido-por-evidencia (`git remote -v` → `https://github.com/ness-e/Ego.git`) |
| D6 | Diátaxis | `diataxis:` front-matter con 4 valores | tutorial/how-to/reference/explanation según tabla | ✅ decidido-por-evidencia (contrato; https://diataxis.fr/ verificada 2026-10-16 HTTP 200) |

Mapa Diátaxis user docs: getting-started=tutorial, configuration=how-to,
troubleshooting=how-to, concepts=explanation, faq=reference, changelog=reference.

## Impacto mapeado (Regla 0)

- Leídos completos: `package.json`, `cliff.toml`, `CONTRIBUTING.md`,
  `docs/index.md`, `docs/user/{getting-started,configuration,troubleshooting,faq,changelog,concepts,README}.md`,
  `.github/workflows/{ci.yml,docs-lint.yml}`, `docs/operations/despliegue.md`,
  `docs/deployment/distribution.md`, `CHANGELOG.md`, `docs/.vitepress/config.mts`,
  `.markdownlint.json`, `.agents/references/definition-of-done.md`,
  `.agents/task-system/prompts/question-gates.md` (Gate D).
- Referencias hacia dentro: ninguna (docs-only, sin imports de código).
- Referencias entrantes: `docs/user/README.md`→user docs; `docs/index.md`→todo;
  `faq.md:50`→snapshots (no se toca); `docs-lint.yml` globs `docs/**/*.md`.
- Veredicto: blast = docs + 2 workflows (append-only jobs) + package.json
  scripts/devDeps + hooks versionados. Riesgo bajo. Rollback: `git revert`.
- Fuera de blast (NO tocar): `packages/*`, `apps/*`, `.ego-worktrees/`,
  `dist/`, `out/`, task files STAB-11/12/13/14/16, untracked ajenos en worktree
  (`Arreglar-OpenCode.ps1`, `Untitled-1.py`, `__pycache__/`,
  `robot-chat-follow.png`, plan isla-flotante, `scripts/release/`,
  `docs/agent-ops/reports/verify-audit.jsonl` modificado ajeno).

## Steps

- [x] S1 DISCOVERY: refs + Gate D por-evidencia + task file (este archivo)
- [x] S2 Enforcement: deps + `commitlint.config.mjs` + `.husky/*` + scripts
      `prepare`/`docs:build`/`docs:dev`/`lint:commit` + `lint-staged` +
      CONTRIBUTING §3 (perf + hook/CI)
- [x] S3 CI: job `commit-msg` en `ci.yml` (append) + job `docs-build` en
      `docs-lint.yml` (append)
- [x] S4 Upstream: `cliff.toml` ness-e/Ego + `CHANGELOG.md:45-46` +
      `config.mts` socialLink + comentario deps + ADR-0006 site
- [x] S5 Index + deprecación: `docs/index.md` (+6 áreas + mapa Diátaxis,
      Diátaxis verificada HTTP 200) + `despliegue.md` deprecated →
      `distribution.md` (+supersede)
- [x] S6 Diátaxis: front-matter en 6 user docs
- [x] S7 GIFs: 3 SVG → magick(RSVG) → `.gif` (verificado visual) + embed
      getting-started §3/§4/§6
- [x] S8 `CODE_OF_CONDUCT.md` (raíz)
- [ ] S9 VERIFY: commitlint rango + markdownlint + `pnpm docs:build` +
      `git log` + YAML workflows + pre-commit review + commit local (NUNCA push)
- [ ] S10 Cierre: plan file estado + RESULTADO

## Review

- Tier: **Fast** (solo docs + workflows append-only + hooks + config; sin
  código prod, sin IPC/schema, sin serialización).
- Verify mecánico (contrato STAB-15):
  - `commitlint --from HEAD~8 --to HEAD` → exit 0 ✅ (historial STAB pasa con
    type-enum 7 tipos + subject-case off + header 150, reglas justificadas
    por-evidencia en `commitlint.config.mjs`)
  - Negativos `mensaje sin tipo` / `wip: algo` → exit 1 ✅ (CI fallará igual)
  - `pnpm docs:build` (vitepress 1.6.4) → exit 0, `dist/index.html` ✅
    (hallazgos: `agent-ops/**` excluido del site por HTML crudo que rompe el
    compilador Vue — archivo ajeno fuera de scope; 3 dead links fuera del
    root ignorados con justificación; 76/76 enlaces del índice resuelven)
  - GIFs: render RSVG→magick verificado visual (3 diagramas outcome) ✅
  - Diátaxis: https://diataxis.fr verificada HTTP 200 ✅
  - YAML workflows parse OK (node js-yaml) ✅; package.json parse OK ✅
  - Hook local cableado: `core.hooksPath=.husky/_` → delega a
    `.husky/commit-msg` ✅; `.gitignore` negado `!.husky/` para versionarlos ✅
- Spot-check reviewer: diff limitado a paths del contrato; sin prod.
- Veredicto: **approve (Fast)** — review P2-01 por agente distinto pendiente
  (orquestador).

## Deuda / follow-up

- Capturas GIF reales de la app cuando haya build distribuible (diagramas
  SVG→GIF = placeholder honesto, etiquetado como tal).
- markdownlint repo-wide: 119 issues preexistentes en 9 archivos (MD003
  open-ATX dominante vs `atx_closed`, MD031/MD040/MD013/MD024 en
  CONTRIBUTING/CHANGELOG). Este task no introduce violaciones nuevas
  (iguala estilo por archivo). Normalización global = follow-up (FIND
  propuesto para el orquestador, fuera del blast STAB-15).
- `pnpm-lock.yaml` churn por 5 devDeps nuevas (esperado).

## Deuda / follow-up

- Capturas GIF reales de la app (screencast proyecto→tarea→HITL→Canvas) cuando
  haya build distribuible; los diagramas SVG→GIF quedan como placeholder honesto.
- `pnpm add` ejecutado por este worker modifica `pnpm-lock.yaml` (churn
  esperado; revisar diff antes del commit).
- markdownlint repo-wide preexistente (estilo open-ATX vs MD003 atx_closed en
  user docs): NO se normaliza aquí (fuera de alcance); solo no introducir
  violaciones nuevas.
