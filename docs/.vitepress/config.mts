// docs/.vitepress/config.mts — ADR-0012: VitePress es el site canónico
// (decisión registrada en docs/adr/0012-docs-site.md).
// Sin firma DIST-04: el sitio documenta distribución unsigned verificable.
// Uso: pnpm docs:dev | pnpm docs:build  (vitepress pinneado en devDependencies).
//
// La sidebar de este fichero es la navegación del sitio y DEBE mantenerse
// sincronizada con docs/index.md (el índice maestro). docs/index.md es la
// fuente de verdad del corpus; este fichero es su proyección navegable.
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Ego',
  description: 'Sistema Operativo Cognitivo — documentación',
  // agent-ops/ son worklogs internos de agentes (HTML crudo, tareas
  // efímeras): no se publican; el índice los enlaza como referencia
  // interna del repo (ver ignoreDeadLinks abajo).
  //
  // El research externo (`research/Arquitectura*.md`) **sí** se publica: es
  // research no normativo pero documentado (ADR-0011 lo descarta como
  // requisito, no como material de referencia). Su `{{SECRET:…}}` ya no
  // rompe el build gracias al escape de la regla EGO-VUE-INTERPOLATION.
  srcExclude: ['agent-ops/**'],
  // agent-ops/: worklogs internos (ver arriba). CHANGELOG/CONTRIBUTING/
  // CODE_OF_CONDUCT/AGENTS: viven en la raíz del repo (fuera del root del
  // site) y sus enlaces son válidos en GitHub aunque el site no los sirva.
  ignoreDeadLinks: [/agent-ops\//, /CHANGELOG/, /CONTRIBUTING/, /CODE_OF_CONDUCT/, /AGENTS/],
  markdown: {
    /**
     * EGO-VUE-INTERPOLATION: el sitio compila cada `.md` como plantilla Vue,
     * así que un `{{` literal en el Markdown se interpreta como interpolación
     * y **rompe el build** (`vite:vue` → "Did not expect a type annotation
     * here"). Ha pasado tres veces en la Ola 1 (`{{SECRET:…}}` en el
     * documento maestro, en la matriz de contraste y en una ficha de
     * extracción).
     *
     * Solución: escapar el `{{` de apertura en el HTML final del Markdown.
     * El navegador decodifica `&#123;&#123;` a `{{` **después** de que Vue
     * haya analizado la plantilla → se ve literal y no se interpola. Solo
     * se escapa la apertura (`{{`): un `}}` suelto es texto inocuo para Vue.
     *
     * Los documentos de Ego son Markdown plano: no usan interpolación Vue
     * legítima, así que el escape no pierde información.
     */
    config: (md) => {
      const defaultRender = md.renderer.render.bind(md.renderer)
      md.renderer.render = (tokens, options, env) =>
        defaultRender(tokens, options, env).replace(/\{\{/g, '&#123;&#123;')
    },
  },
  themeConfig: {
    nav: [
      { text: 'Inicio', link: '/' },
      { text: 'Guía de usuario', link: '/user/getting-started' },
      { text: 'Arquitectura', link: '/architecture/vision-general' },
      { text: 'Quickstart dev', link: '/getting-started' },
      { text: 'Changelog', link: '/changelog' },
    ],
    sidebar: [
      {
        text: 'Ego',
        items: [
          { text: 'Inicio', link: '/' },
          { text: 'Guía de usuario', link: '/user/getting-started' },
          { text: 'Quickstart dev', link: '/getting-started' },
          { text: 'Changelog', link: '/changelog' },
        ],
      },
      {
        text: 'Gobernanza',
        items: [
          { text: 'Jerarquía canónica', link: '/jerarquia-canonica' },
          { text: 'Plan maestro', link: '/PLAN-EGO' },
          { text: 'Principios innegociables', link: '/product/principios-innegociables' },
          { text: 'VantaDB: hallazgos y mejoras', link: '/VANTADB-FEEDBACK-Y-MEJORAS' },
        ],
      },
      {
        text: 'Producto',
        items: [
          { text: 'Visión', link: '/product/vision' },
          { text: 'Concepto', link: '/product/concepto' },
          { text: 'Definición de SOC', link: '/product/definicion-soc' },
          { text: 'Personas', link: '/product/personas' },
          { text: 'Módulos', link: '/product/modulos' },
          { text: 'UX/UI', link: '/product/ux-ui' },
          { text: 'Guía MVP', link: '/product/guia-mvp' },
          { text: 'Modelo económico', link: '/product/modelo-economico' },
          { text: 'Mascota', link: '/product/mascota' },
          { text: 'Dirección de arte', link: '/product/character-art-direction' },
        ],
      },
      {
        text: 'Arquitectura',
        items: [
          { text: 'Doctrina rectora', link: '/architecture/arquitectura-unificada' },
          { text: 'Visión general', link: '/architecture/vision-general' },
          { text: 'Memoria VantaDB', link: '/architecture/memoria-vantadb' },
          { text: 'Namespaces', link: '/architecture/namespaces' },
          { text: 'Sub-Egos y agentes', link: '/architecture/agentes' },
          { text: 'Alma del Sub-Ego', link: '/architecture/subego-soul' },
          { text: 'Dominios funcionales', link: '/architecture/dominios-funcionales' },
          { text: 'Ciclo de memoria', link: '/architecture/ciclo-memoria-unificado' },
          { text: 'UI Runtime', link: '/architecture/ui-runtime' },
          { text: 'Workspace dinámico', link: '/architecture/workspace-dinamico' },
          { text: 'Navigation Sidebar', link: '/architecture/navigation-sidebar' },
          { text: 'Sandbox de iframes', link: '/architecture/ui-iframe-sandbox-spec' },
          { text: 'Character System', link: '/architecture/character-system' },
          { text: 'Jev', link: '/architecture/jev' },
        ],
      },
      {
        text: 'Engineering',
        items: [
          { text: 'Stack técnico', link: '/engineering/stack-tecnico' },
          { text: 'Lenguajes', link: '/engineering/lenguajes' },
          { text: 'Integraciones', link: '/engineering/integraciones' },
          { text: 'Testing E2E', link: '/engineering/testing-e2e' },
          { text: 'VantaDB readiness', link: '/engineering/vantadb-readiness-plan' },
        ],
      },
      {
        text: 'Design',
        items: [
          { text: 'Design System canónico', link: '/design/design-system' },
        ],
      },
      {
        text: 'Roadmap',
        items: [
          { text: 'Backlog canónico', link: '/roadmap/Backlog' },
          { text: 'Fases y Golden Paths', link: '/roadmap/roadmap' },
          { text: 'Métricas y OKR', link: '/roadmap/metricas-okr' },
        ],
      },
      {
        text: 'Operación',
        items: [
          { text: 'Distribución', link: '/deployment/distribution' },
          { text: 'Release notes (plantilla)', link: '/deployment/release-notes-template' },
          { text: 'Snapshots y respaldo', link: '/operations/snapshots-respaldo' },
          { text: 'Estrategia de testing', link: '/testing/estrategia' },
          { text: 'DEV_LOOP', link: '/dev/desktop/DEV_LOOP' },
          { text: 'Inventario E2E omitidos', link: '/dev/e2e-skip-inventory' },
        ],
      },
      {
        text: 'ADR',
        items: [
          { text: '0001 Electron + Vite (superseded)', link: '/adr/0001-electron-vite' },
          { text: '0002 VantaDB primero', link: '/adr/0002-vantadb-primero' },
          { text: '0003 Renderer tonto', link: '/adr/0003-renderer-tonto' },
          { text: '0004 Dark-only', link: '/adr/0004-dark-only' },
          { text: '0005 PromptAssembly', link: '/adr/0005-promptassembly-turno' },
          { text: '0006 ApprovalIdentity', link: '/adr/0006-approval-identity' },
          { text: '0007 InteractionTransport', link: '/adr/0007-interaction-transport' },
          { text: '0008 WorkerPolicy', link: '/adr/0008-worker-policy' },
          { text: '0009 ChangeSet payloadRef', link: '/adr/0009-changeset-payloadref' },
          { text: '0010 NetPolicy security', link: '/adr/0010-netpolicy-security' },
          { text: '0011 STAB-14 asimilados/descartes', link: '/adr/0011-stab14-asimilados-descartes' },
          { text: '0012 Sitio VitePress', link: '/adr/0012-docs-site' },
          { text: '0013 CodeMirror 6', link: '/adr/0013-codemirror6-en-canvas' },
          { text: '0014 Virtualización virtua', link: '/adr/0014-virtualizacion-chat-virtua' },
          { text: '0015 Radix Select', link: '/adr/0015-radix-select-accesible' },
          { text: '0016 Shiki Web Worker', link: '/adr/0016-shiki-web-worker' },
          { text: '0017 ContextCompaction', link: '/adr/0017-context-compaction-llm-inyectable' },
        ],
      },
      {
        text: 'Review & Extracción',
        items: [
          { text: 'Review hub', link: '/review/README' },
          { text: 'Backlog hermes-agent', link: '/review/backlog-hermes' },
          { text: 'Backlog openclaw', link: '/review/backlog-openclaw' },
          { text: 'Backlog coucou', link: '/review/backlog-coucou' },
          { text: 'Backlog khoj', link: '/review/backlog-khoj' },
          { text: 'Backlog helmor', link: '/review/backlog-helmor' },
          { text: 'Backlog career-ops', link: '/review/backlog-career-ops' },
          { text: 'Backlog deepseek-harness', link: '/review/backlog-deepseek-harness' },
          { text: 'Extracciones hub', link: '/extractions/README' },
        ],
      },
      {
        text: 'Referencias',
        items: [
          { text: 'Glosario', link: '/references/glosario' },
          { text: 'Fuentes', link: '/references/fuentes' },
          { text: 'GUI desktop', link: '/references/gui-desktop' },
          { text: 'Repos intel', link: '/references/repos-intel' },
          { text: 'Diseño de skills', link: '/references/diseno-skills' },
          { text: 'Prompts', link: '/prompts/README' },
        ],
      },
    ],
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/ness-e/Ego' }],
  },
})
