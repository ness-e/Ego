# Public API & Contract — Reglas (Ego)

> **Scope:** `packages/*/src/index.ts`, contratos públicos, esquemas de datos y fronteras IPC de Ego.
> **Status:** 🟢 Vigente
> **Derivado de:** AGENTS.md, Jerarquía Canónica (Nivel 4-5) y Arquitectura Modular Monorepo.

## Reglas

### R-1: Exportaciones públicas fuertemente tipadas en TypeScript Strict
- **Must:** Todo módulo o paquete (`packages/*`) debe exponer su API pública exclusivamente a través de su punto de entrada canónico `src/index.ts`. Todos los tipos, parámetros y retornos deben estar tipados estrictamente (TypeScript strict).
- **Must not:** Usar `any` en firmas públicas. Si un dato es dinámico o desconocido, usar `unknown` combinado con validadores en tiempo de ejecución (Zod / TypeGuards).
- **Por qué:** Los paquetes de Ego (`@ego/memory`, `@ego/models`, `@ego/runtime`, `@ego/execution`, `@ego/tools`, `@ego/events`) deben interoperar sin ambigüedades. Un contrato roto en un paquete causa fallas silenciosas en tiempo de ejecución del Cognitive Runtime.

### R-2: Estabilidad de contratos IPC (Main ↔ Renderer)
- **Must:** Toda comunicación entre el proceso Main y el Renderer debe realizarse mediante canales fuertemente tipados definidos en `apps/desktop/src/preload/` y validados en el Main Process.
- **Must not:** Exponer APIs privadas de Node.js, `child_process`, `fs` o el binding `NativeVantaDB` directamente al Renderer (`contextIsolation=true`, `sandbox=true`).
- **Por qué:** El renderer es una superficie no confiable (untrusted). Exponer primitivas del sistema operativo compromete la seguridad y viola el principio 9 de Ego (local-first con aislamiento).

### R-3: EgoMemoryAdapter como gateway único a VantaDB
- **Must:** Todo acceso a memoria persistente debe canalizarse obligatoriamente a través de `EgoMemoryAdapter` (`packages/memory/`).
- **Must not:** Ningún paquete (`runtime`, `tools`, `models`, `desktop`) puede instanciar o invocar directamente `NativeVantaDB` de `"vantadb/native"` sin pasar por el adapter.
- **Por qué:** Regla innegociable de AGENTS.md §4. Centraliza el ciclo de vida, la gestión de namespaces (`ego.namespaces.json`), el manejo de fallos y el fast-path BM25 in-process vs L0-L3 en subproceso MCP.

### R-4: Errores estructurados y tipados (`EgoError`)
- **Must:** Todo error emitido por la API pública debe ser una instancia de `EgoError` con código de error canónico (`code`), mensaje inteligible y causa original (`cause`).
- **Must not:** Lanzar strings planos (`throw "error"`) o errores anónimos no capturables.
- **Por qué:** Permite al Cognitive Runtime, al ToolExecutionLoop y a la UI de chat clasificar el fallo (ej. cuota excedida, aborto por timeout, error de persistencia) y ejecutar estrategias de recuperación o feedback al usuario.

### R-5: Paridad de herramientas (Tools) y esquemas Zod
- **Must:** Toda herramienta registrada en `ToolRegistry` (`packages/tools/`) debe declarar su esquema de parámetros con Zod exhaustivo y un schema de salida tipado.
- **Must not:** Registrar herramientas con esquemas vacíos o aceptar payloads arbitrarios sin sanitizar.
- **Por qué:** El Cognitive Runtime delega la ejecución de herramientas a LLMs; un esquema ambiguo provoca alucinaciones en la llamada y roturas en la ejecución.
