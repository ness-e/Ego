// docs/.vitepress/config.mts — STAB-15: VitePress es el site canónico
// (decisión registrada en docs/adr/0006-docs-site.md).
// Sin firma DIST-04: el sitio documenta distribución unsigned verificable.
// Uso: pnpm docs:dev | pnpm docs:build  (vitepress pinneado en devDependencies).
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Ego',
  description: 'Sistema Operativo Cognitivo — documentación',
  // agent-ops/ son worklogs internos de agentes (HTML crudo, tareas
  // efímeras): no se publican; el índice los enlaza como referencia
  // interna del repo (ver ignoreDeadLinks abajo).
  srcExclude: ['agent-ops/**'],
  // agent-ops/: worklogs internos (ver arriba). CHANGELOG/CONTRIBUTING/
  // CODE_OF_CONDUCT: viven en la raíz del repo (fuera del root del site)
  // y sus enlaces son válidos en GitHub aunque el site no los sirva.
  ignoreDeadLinks: [/agent-ops\//, /CHANGELOG/, /CONTRIBUTING/, /CODE_OF_CONDUCT/],
  themeConfig: {
    nav: [
      { text: 'Inicio', link: '/' },
      { text: 'Quickstart', link: '/getting-started' },
      { text: 'Changelog', link: '/changelog' },
    ],
    sidebar: [
      {
        text: 'Ego',
        items: [
          { text: 'Inicio', link: '/' },
          { text: 'Quickstart', link: '/getting-started' },
          { text: 'Changelog', link: '/changelog' },
        ],
      },
    ],
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/ness-e/Ego' }],
  },
})
