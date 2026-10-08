# Frontend Desktop & Web — Reglas (Ego)

> **Scope:** `apps/desktop/renderer/`, `@assistant-ui/react`, Vite + React 19, componentes de UI y fronteras de presentación.
> **Status:** 🟢 Vigente
> **Derivado de:** AGENTS.md §2 (Modelo conceptual), §4 (Restricciones duras) y Principio 8 (Chat + Dynamic Workspace).

## Reglas

### R-FE-1: Desacoplamiento total del Renderer (Presentación Pura)
- **Must:** El Renderer (`apps/desktop/renderer/`) debe funcionar exclusivamente como capa de presentación. Toda la lógica de negocio, ejecución de herramientas, enrutamiento cognitivo y almacenamiento reside en el Main Process (`apps/desktop/src/main/`).
- **Must not:** Importar paquetes de Node.js (`fs`, `child_process`, `path`, etc.) ni bindings nativos (`NativeVantaDB`) en el Renderer.
- **Por qué:** Cumplimiento de `contextIsolation=true`, `sandbox=true` y `nodeIntegration=false`. Violaciones introducen vulnerabilidades de inyección y rompen la portabilidad.

### R-FE-2: Stack de Interfaz: React 19 + `@assistant-ui/react`
- **Must:** La experiencia de chat conversacional se construye sobre `@assistant-ui/react`, integrando flujos reactivos de streaming e interacción con el usuario.
- **Must not:** Reimplementar loops de streaming de chat desde cero cuando `@assistant-ui/react` ya provee gestión de turnos, estado de composer e hilos conversacionales.
- **Por qué:** Estandarización del stack acordada en Q1–Q25. Acelera el desarrollo de P0 manteniendo la UI robusta y alineada con la especificación.

### R-FE-3: Prohibición absoluta de Next.js en la aplicación Desktop
- **Must:** Ego Desktop corre sobre Electron + Vite + React 19. Next.js está estrictamente reservado para servicios web externos (landing, billing, auth en Ego Web).
- **Must not:** Introducir Next.js, App Router o SSR en el entorno de escritorio de Ego.
- **Por qué:** Regla dura innegociable de AGENTS.md §4. Next.js en Electron agrega complejidad innecesaria, problemas de bundling estático y overhead de memoria.

### R-FE-4: Presupuesto de UI (UI Budget: 15–20% en P0)
- **Must:** Priorizar funcionalidad y robustez del runtime: "Funcional primero. Usable siempre. Perfecto después."
- **Must not:** Consumir ciclos de ingeniería en animaciones decorativas complejas, micro-interacciones pesadas o micro-optimizaciones cosméticas que degraden el framerate o retrasen el roadmap funcional.
- **Por qué:** Criterio estricto de ingeniería en P0-Alpha (Fases 01–05). El valor central de Ego radica en su capacidad cognitiva, memoria persistente y ejecución de herramientas.

### R-FE-5: Manejo robusto de errores con Error Boundaries
- **Must:** Aislar los componentes del Canvas dinámico y widgets interactivos dentro de React Error Boundaries independientes.
- **Must not:** Permitir que una excepción en un widget de workspace bloquee o rompa el hilo principal del chat.
- **Por qué:** Resiliencia de la interfaz: el usuario debe poder continuar interactuando con Ego aunque un componente visual falle en renderizar.
