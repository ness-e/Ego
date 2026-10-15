// docs/.vitepress/config.mts — CFG-14: VitePress mínimo (docs-only).
// Sin firma DIST-04: el sitio documenta distribución unsigned verificable.
// Uso (sin tocar package.json): npx vitepress dev docs | npx vitepress build docs
// Requiere: npx descargará `vitepress` bajo demanda (no es dependencia del producto).
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Ego',
  description: 'Sistema Operativo Cognitivo — documentación',
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
    socialLinks: [{ icon: 'github', link: 'https://github.com/ego/ego' }],
  },
})
