| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de stack tecnológico |
| Owner | ness-e |
| Fecha | 2026-10-06 |
| Fuente histórica | `../prd/19-tech-stack.md` + Decisiones P18-P19 2026-10-06 |

# Stack Técnico de Ego

## Principio fundamental
**"Las tecnologías implementan Ego. No definen Ego."**

## Stack de Ego Desktop
El cliente principal de Ego para escritorio se construye sobre las siguientes tecnologías:
- **Electron**: Contenedor principal de la aplicación de escritorio.
- **React + TypeScript**: Framework de UI.
- **Vite (vía electron-vite)**: Bundler y herramientas de desarrollo (reemplaza a Next.js para el renderer de escritorio).

*Nota: Next.js NO se utiliza para la aplicación de escritorio.*

## Stack de Ego Web
**Next.js** está reservado exclusivamente para Ego Web, lo que incluye:
- Landing pages y marketing.
- Autenticación y facturación.
- Cloud Dashboard.
- Documentación pública.

## Base de datos local
- **VantaDB**: Base de datos principal local, conectada a través de un **binding nativo de Node (napi-rs)**, y no mediante WASM en el renderer.
- **Regla (VantaDB primero)**: No habrá una segunda base de datos local sin una justificación explícita.

## Seguridad Electron
- `contextIsolation = true`: Aislamiento estricto entre el proceso principal y el renderizador.
- `sandbox = true`: Renderizador en entorno aislado.
- `nodeIntegration = false`: Sin acceso a Node.js desde el renderizador.
- El renderer NUNCA accede a Node o a VantaDB directamente. Todo se canaliza a través de un script `preload` fuertemente tipado e IPC.
- Política de Seguridad de Contenido (CSP) restrictiva.

## Interfaz de Usuario (UI)
- **Navegación**: React Router.
- **Primitivas UI**: Radix / shadcn.
- **Editor de código**: Monaco Editor.
- **Terminal**: xterm.js.
- **Capa de Chat**: `@assistant-ui/react` (utilizado específicamente como capa de chat, no como framework de toda la app).
- **Workspace/Canvas**: Workspace dinámico y Canvas propios de Ego.

## Estado
- **Datos del proyecto**: VantaDB (persistido).
- **Estado de UI**: Store ligero, como Zustand.
- **Cuenta y Facturación**: Cloud Control Plane (remoto).

## Modelos de IA
- **Enrutamiento**: Model Router propio de Ego.
- **Integración AI**: AI SDK utilizado únicamente como adaptador.
- Flexibilidad total: Multi-proveedor, BYOK (Bring Your Own Key), Modelos Locales, APIs compatibles con OpenAI y Custom.

## Decision Intelligence
- Capa de abstracción propia.
- **Jev** funciona como un proveedor dentro de esta capa.
- Combinación de Reglas + Modelos (ligeros) + LLMs.

## Cognitive Runtime
- **Propio de Ego**.
- No se utilizan frameworks externos como Mastra o LangGraph en el núcleo del runtime.

## Ejecución (Execution Runtime)
- El entorno de ejecución está separado del Cognitive Runtime.
- El código se ejecuta en un sandbox seguro, no en el renderer de Electron.

## Build y Distribución
- **Empaquetado**: electron-vite.
- **Distribución**: Electron Builder o Forge.
