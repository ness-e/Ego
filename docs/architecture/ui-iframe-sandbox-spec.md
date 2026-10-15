| Campo | Valor |
| --- | --- |
| Estado | Vigente — SPEC de seguridad, runtime descartado en P0 |
| Owner | ness-e |
| Fecha | 2026-10-15 |
| Veredicto | `🚫 Descartada (runtime)` / Asimilada solo como SPEC |

## Principio

Ego usa Modelo A declarativo. Los Sub-Egos emiten `CanvasComponentManifest` validado con Zod (`packages/ui-runtime/src/schemas/components.ts`). El renderer solo monta componentes nativos del registry (`apps/desktop/renderer/components/canvas/registry.ts:49-61`). **Cero ejecución de código del LLM.**

## SPEC iframe 3-capas (solo si P-futuro lo exige)

1. `sandbox="allow-scripts"` SIN `allow-same-origin`. La combinación `allow-scripts + allow-same-origin` permite auto-eliminación del sandbox. Prohibida.
2. `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'">`. Inmutable tras parse. Sin `frame-ancestors` en meta.
3. `MessageChannel` scoped, no `postMessage` crudo. Allow-list estricta en padre, validación `event.origin`/`event.source` por mensaje, nunca `"*"`. El canal se cierra si el iframe navega.

## MCP Apps (SEP-1724): por qué no en P0

- Default `sandbox="allow-scripts allow-same-origin"` viola §1.
- Superficie nueva: prompt-injection vía UI, exfiltración vía `connectSrc`, clickjacking, robo de foco. Requiere distinción visual host vs agente, control z-index/opacidad y permisos granulares.
- Referencia Hermes PR #75828 solo como referencia de implementación, no dependencia.
- `SEC-01..09` ya DONE. Reabrir iframe exige threat model + E2E CDP + aprobación HITL.

## Guardrails Electron vigentes

`contextIsolation=true`, `sandbox=true`, `nodeIntegration=false` (`apps/desktop/AGENTS.md`). Renderer sin VantaDB ni lógica de negocio. Todo por IPC tipado vía `preload.ts` y `EgoMemoryAdapter` en main.
