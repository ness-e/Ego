# Mascota — fuente vigente

| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de mascota Ego (sombra) |
| Owner | ness-e |
| Fecha | 2026-10-05 |
| Fuente histórica | Blueprint imagen (sombra maleable + Núcleo de Asistencia + Enfoque/Celebración/Apoyo) + `../product/concepto.md` (identidad única) + `../architecture/agentes.md` (voces por rol) |
| VantaDB | N/A (UI puro; estado `org/root` + snapshots) |
| Regla | Este archivo se edita; la mascota vive en `apps/desktop/src/mascot/` |
| Decisión 2026-10-05 | Personalidad full = superficie por área (criterio único compartido); prototipar las 4; carpeta estándar; APARCADA hasta P1+ (puente Rive pendiente) |

## Concepto

Sombra/masa negra base del blueprint (cuerpo maleable + Núcleo-engranaje + ojos con brillo).
Muta por área (código, notas/KB, marketing, CRM…) con acentos; comparte 6 muecas
(idle, thinking, approval, celebrate, error, support). Núcleo (criterio, memoria,
gobernanza) único; personalidad = superficie + voz del rol. Sin esto se rompe la identidad.

## Dónde vive

Renderer como componente visual puro (`<EgoMascot area mood/>`), estado desde main
vía IPC (`agent_id`, área/namespace, estado). Presente en bienvenida, chat, paneles y
aprobación. Ventana frameless transparente + alwaysOnTop + click-through.

## Tabla comparativa (5 subagentes + web, oct-2026)

| Tecnología | Aspecto | Rendimiento | Viabilidad | Rol asignado |
| --- | --- | --- | --- | --- |
| Rive | 9/10 (vector+feathering, SM madura) | 9/10 (222-648KB, 60fps, settling idle) | 9/10 (MIT, 1 `.riv` offline, MCP oficial+Polymation) | Runtime producción 2D |
| Lottie | 8/10 | 9/10 (45KB player) | 7/10 (~30 clips, SM joven) | Fallback playback |
| Spline 3D | 9/10 | 5/10 (561KB+escena+GPU) | 6/10 (offline solo Enterprise) | Prototipo/momentos 3D |
| three.js+Blender | 9/10 | 9/10 (~600KB, morphs GPU) | 8/10 (glTF probado; MCP solo autoría) | Opción 3D real |

Fuentes: rive.app/docs (sizes, SM, react, MCP), dotLottie (docs.lottiefiles.com, spec), docs.spline.design (Code API, pricing, self-hosted), blender.org/lab/mcp-server, djeada/mcp-for-blender, callstack.com, pixelpoint.io, polymation.stunning.gg.

## Qué diseñar (P0)

1 base + 3 acentos (lupa KB, nodo CRM, escudo gov) + 6 caretas + 4 transiciones
(idle/thinking/approval/celebrate). Resto de áreas reutiliza rig (acento+tinte).
Riesgos: exports Rive exigen Cadet + lock-in `.riv` (1 seat, versionar binario);
inputs legacy→DataBinding (empezar en ViewModels); drag Electron vs canvas + cap WebGL.
