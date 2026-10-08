# Memory Budget & Resource Management — Reglas (Ego)

> **Scope:** `packages/memory/`, `apps/desktop/src/main/`, límites RSS de Electron Main, subprocesos y gestión de buffers.
> **Status:** 🟢 Vigente
> **Derivado de:** AGENTS.md §1 (Stack tecnológico), §4 (Restricciones duras) y Principio 1 (Memoria local persistente).

## Reglas

### R-1: Fast Path léxico in-process vs Inferencia densa en subproceso
- **Must:** El binding in-process `NativeVantaDB` en el Main Process de Electron opera exclusivamente en modo léxico BM25 puro (fast path de bajísimo consumo RSS).
- **Must:** Toda inferencia densa (ONNX embeddings), búsqueda vectorial semántica y capas cognitivas L0-L3 residen exclusivamente en el subproceso `vantadb-mcp`.
- **Must not:** Cargar modelos de embeddings densos o pesos ONNX en el hilo de Node.js del Main Process de Electron.
- **Por qué:** Regla dura innegociable de AGENTS.md §4. Previene la saturación del heap de V8 en Electron y evita que la inferencia de vectores compita por recursos con la UI de la aplicación desktop.

### R-2: Bounding de buffers en streams de LLM y EventBus
- **Must:** Los eventos transmitidos a través de `EventBus` (`packages/events/`) y los fragmentos (chunks) de streaming del LLM deben procesarse con límites duros de retención en memoria (watermarks).
- **Must not:** Acumular streams indefinidos en arrays de memoria en RAM sin volcado periódico a disco o descarte estructurado.
- **Por qué:** En sesiones largas con herramientas complejas o transcripciones extensas, acumular objetos sin control desencadena fugas de memoria y bloqueos por Garbage Collector (GC pauses).

### R-3: Ciclo de vida y drenaje de recursos en cierre
- **Must:** `EgoMemoryAdapter` debe implementar un método `close()` que drene las escrituras en vuelo y libere los descriptores de archivos de `NativeVantaDB`.
- **Must:** El proceso principal de Electron debe registrar hooks en los eventos `before-quit` y `will-quit` para cerrar limpiamente `EgoMemoryAdapter` y terminar el subproceso `vantadb-mcp`.
- **Must not:** Matar la aplicación de forma abrupta (`process.exit(0)`) sin permitir el flush ordenado de la memoria persistente.
- **Por qué:** Asegura la integridad física de la base de datos de VantaDB en disco y previene corrupciones de índices locales ante reinicios del usuario.