# Task: INT-02 — Conexión de Proveedores Reales y BYOK en Desktop

> **Fase:** 03.1 — MVP Convergence & System Integration  
> **Estado:** ✅ completed  
> **Fecha:** 2026-10-09  
> **Responsable:** coder / Antigravity  
> **Plan:** `docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md`

---

## 1. Contexto & Propósito

En `apps/desktop/src/main.ts`, `new ModelRouter()` solo registraba `MockProvider`. A pesar de existir `OpenAICompatibleProvider`, la aplicación de escritorio no leía claves de API de variables de entorno (`OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `OLLAMA_BASE_URL`) ni permitía al usuario operar con modelos reales en modo BYOK (Bring Your Own Key).

`INT-02` resuelve la segunda gran carencia de P0.2 conectando proveedores reales en `main.ts` con fallback seguro a `MockProvider` si no se detectan credenciales o servidores activos, garantizando que nunca se rompa el arranque offline ni se expongan secretos al proceso renderer.

---

## 2. Criterios de Aceptación (DoD)

- [x] `main.ts` inicializa proveedores reales en `ModelRouter`:
  - `openai`: si `process.env.OPENAI_API_KEY` existe.
  - `deepseek`: si `process.env.DEEPSEEK_API_KEY` existe.
  - `ollama`: configurado con endpoint local (por defecto `http://localhost:11434/v1`).
- [x] Fallback determinista a `MockProvider` si ninguna clave está disponible o los endpoints no responden.
- [x] Secretos nunca expuestos al renderer process ni persistidos en logs no seguros.
- [x] Pruebas automatizadas de registro y resolución en verde (`apps/desktop/test/ipc-tool-loop.test.ts`).
- [x] `pnpm typecheck` exit 0.
