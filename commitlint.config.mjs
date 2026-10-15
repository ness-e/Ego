// commitlint config — Ego (STAB-15).
// Tipos canónicos: feat|fix|docs|refactor|chore|test|perf
// (alineado con cliff.toml commit_parsers + CONTRIBUTING.md §3).
// Uso local: hook .husky/commit-msg. Uso CI: job `commit-msg` en ci.yml.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'refactor', 'chore', 'test', 'perf'],
    ],
    // Historial real usa identificadores en mayúsculas tras el tipo
    // (`feat: STAB-12 ...`, `docs: STAB Wave 4 ...` — ver git log).
    // Se exige el TIPO (contrato release-please), no el case del subject.
    'subject-case': [0, 'never'],
    // El estilo STAB lleva detalle largo en el subject (p.ej. `feat: STAB-14
    // ... + ADR-0006/0011`, ~140 chars). Se exige tipo, no brevedad extrema.
    'header-max-length': [2, 'always', 150],
  },
}
