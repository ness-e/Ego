# ADR 0003: Renderer tonto (solo presentación) #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-15 |
| Estado | Aceptado |
| Nivel jerárquico | 4.Architecture (`docs/jerarquia-canonica.md`) |

## Contexto ##

El renderer (Chromium + React) ejecuta contenido UI potencialmente
influido por datos externos, por lo que debe tratarse como no confiable
frente al proceso principal (`AGENTS.md` §2, seguridad Electron).

## Decisión ##

El **renderer solo presenta**; toda la lógica de negocio vive en el
proceso principal:

- `contextIsolation=true`, `sandbox=true`, `nodeIntegration=false`.
- Preload fuertemente tipado como única vía IPC; todo mensaje se valida.
- Prohibido: acceso directo a VantaDB desde el renderer, keys o
  secretos en el renderer, lógica de negocio en componentes.

## Consecuencias ##

- Positivas: superficie de ataque mínima; secretos (Keychain/DPAPI)
  nunca salen del proceso principal; contratos IPC auditables.
- Negativas: más código de puente (tipos + validadores IPC) por cada
  capacidad expuesta al UI; el UI budget se mantiene en 15-20% de P0.
- Riesgos: atajos por fuera del preload reintroducen la superficie que
  este ADR cierra; cualquier excepción requiere ADR nuevo.

## Referencias ##

- `AGENTS.md` §2 (seguridad Electron), §4 (guardrails + seguridad).
- `docs/roadmap/Backlog.md` — Fase 02 (approval/HITL), Fase 11
  (Security: permisos, sandbox, validación IPC, auditoría).
- `docs/architecture/ui-runtime.md`.
