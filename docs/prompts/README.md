# Versionado de prompts — Ego

> Alcance: solo versionado y documentación. No toca código runtime (`packages/*`) ni tests.

## Archivos

| Archivo | Propósito |
| --- | --- |
| `system-prompt-template.md` | Plantilla canónica de system prompt en 7 capas |
| `ego-example.md` | Ejemplo instanciado para Ego (orquestador + Sub-Ego) |
| `CHANGELOG.md` | Historial de versiones de prompts |

## Política de versionado

- Cada prompt versionado: `nombre vMAJOR.MINOR` en cabecera + entrada en `CHANGELOG.md`.
- `MAJOR`: cambio de invariantes, herramientas permitidas o política de delegación.
- `MINOR`: ajustes de estilo, ejemplos o redacción sin cambiar comportamiento gobernado.
- Los prompts son datos versionados en docs, no código: el runtime los consume vía `SubEgoManifest.behavior` (`docs/architecture/agentes.md`).
- Prohibido incrustar secretos, API keys o rutas absolutas de máquina en prompts.

## Las 7 capas (resumen)

1. Identidad — quién es el agente.
2. Tools — qué herramientas puede llamar y con qué límites.
3. Delegación — cuándo delegar vs ejecutar directamente.
4. Estilo — tono, formato, idioma.
5. Invariantes — reglas innegociables (seguridad, memoria, aprobación).
6. Proyecto — contexto del proyecto activo (inyectado por Meta-Ego).
7. Dinámico — estado del turno: tarea, presupuesto restante, eventos recientes.

Ver plantilla completa en `system-prompt-template.md`.
