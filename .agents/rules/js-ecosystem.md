# JavaScript & TypeScript Ecosystem — Reglas (Ego)

> **Scope:** Raíz, monorepo pnpm (`packages/*`, `apps/*`), configuraciones de TypeScript, Node.js 22 y dependencias.
> **Status:** 🟢 Vigente
> **Derivado de:** AGENTS.md §1 (Stack tecnológico y versiones) y §4 (Restricciones duras).

## Reglas

### R-1: Versiones de Runtime y Gestor de Paquetes
- **Must:** Operar estrictamente sobre Node.js 22 LTS (Main process) y pnpm workspaces.
- **Must:** Mantener `pnpm-lock.yaml` sincronizado e instalar exclusivamente con `pnpm install --frozen-lockfile`.
- **Must not:** Introducir npm o yarn como gestores alternativos ni commitear `package-lock.json` o `yarn.lock`.
- **Por qué:** Asegura reproducibilidad exacta de dependencias y aislamiento limpio entre paquetes del monorepo (`packages/memory`, `packages/models`, `packages/runtime`, etc.).

### R-2: TypeScript Strict sin excepciones
- **Must:** Compilar con `strict: true` en todas las configuraciones `tsconfig.json`.
- **Must not:** Usar `any` en código nuevo sin justificación arquitectónica explícita y comentada. Preferir `unknown` con discriminadores de tipo o schemas Zod.
- **Por qué:** La orquestación multi-modelo y el Cognitive Runtime requieren garantías estáticas para prevenir fallos en tiempo de ejecución.

### R-3: Integración de VantaDB vía binding nativo (`NativeVantaDB`)
- **Must:** Toda integración con la base de datos de memoria usa `NativeVantaDB` importado desde `"vantadb/native"` (napi-rs in-process).
- **Must not:** Importar `Client` de `"vantadb"` (WASM) en ningún entorno de Ego.
- **Must not:** Levantar `vantadb-server` local para el desktop; la memoria in-process debe correr embebida vía NAPI.
- **Por qué:** Restricción dura de AGENTS.md §4. El binding NAPI-rs provee máximo rendimiento sin la sobrecarga ni limitaciones de memoria del runtime WebAssembly.

### R-4: Monorepo y dependencias internas (`workspace:*`)
- **Must:** Las dependencias entre paquetes internos (`packages/*`) deben declararse usando el protocolo `workspace:*`.
- **Must not:** Publicar dependencias internas a npm ni hardcodear rutas relativas profundas (`../../packages/...`) en `package.json`.
- **Por qué:** Permite resolución limpia por pnpm y compilación modular independiente con `pnpm build`.
