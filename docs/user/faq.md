---
diataxis: reference
---

# Preguntas frecuentes (FAQ) #

> Respuestas cortas para el uso diario de Ego. Procedimientos
> paso a paso en [Primeros pasos](./getting-started.md) y
> [Conceptos clave](./concepts.md).

## 1. ¿Qué es BYOK y por qué Ego lo usa? ##

BYOK (*bring your own key*) significa que Ego no incluye credenciales
propias ni te factura inferencia: aportas tu API key (OpenAI,
Anthropic, Google o DeepSeek) y Ego la usa solo desde tu equipo.
Detalle en [Configuración](./configuration.md).

## 2. ¿Puedo usar Ego sin pagar APIs? (Ollama) ##

Sí. Instala Ollama en tu máquina y selecciona el proveedor `ollama`
(`http://localhost:11434` por defecto). No requiere API key y todo el
cómputo queda en local. Si Ego responde con textos genéricos o de
prueba, sigue en modo `mock`: conecta un proveedor real.

## 3. ¿Qué es un proyecto en Ego? ##

Todo en Ego ocurre dentro de un **proyecto**: conversaciones, memoria,
artefactos del Canvas y archivos se aíslan por proyecto. Créalo en la
barra lateral (nombre + carpeta local) y cambia de proyecto para
conmutar de contexto sin fugas entre proyectos.

## 4. ¿Qué son las sesiones y cómo las retomo? ##

Cada conversación es una sesión con historial persistente por proyecto.
La barra lateral lista tus sesiones: reabre cualquiera para retomar
donde quedaste. Si al abrir ves el chat vacío, no perdiste nada:
revisa el historial de sesiones o el Estado Dinámico del Proyecto.

## 5. ¿Qué son las aprobaciones y cuándo aparecen? ##

Cuando un Sub-Ego necesita una acción con impacto (comando de terminal,
escribir fuera del área de trabajo, borrar archivos), el chat muestra
una **tarjeta de aprobación** con herramienta, comando, justificación
y nivel de riesgo. **Aprobar** (`Enter`) ejecuta; **Rechazar** (`Esc`)
bloquea. Las credenciales nunca pasan por este flujo.

## 6. ¿Cómo hago backup de mi memoria? (`.vdbdump`) ##

Ego genera un respaldo diario automático en tu carpeta `userData` y
ofrece respaldo manual en 1 clic antes de operaciones críticas. El
formato portable `.vdbdump` (magic `VDBJSON`) exporta todos los
namespaces, Sub-Egos y el grafo. Guarda una copia externa para migrar
de equipo. Fuente vigente:
[Snapshots y respaldo](../operations/snapshots-respaldo.md).

## 7. ¿Cómo funcionan las actualizaciones? ##

Ego comprueba versiones contra el feed de `EGO_UPDATE_FEED_URL`
(30 s tras arrancar, luego cada 6 h, solo en app empaquetada). Si hay
versión nueva, recibes un aviso discreto. La instalación es manual por
ahora: descarga el instalador de tu sistema (NSIS/DMG/AppImage) y
reinstala. Sin feed configurado, el comprobador queda inactivo.
Los instaladores son **unsigned** hasta DIST-04: SmartScreen/Gatekeeper
mostrarán avisos esperables. Verifica el hash contra `SHASUMS.txt`
(`certutil -hashfile <exe> SHA256` en Windows;
`shasum -a 256 <artefacto>` en macOS/Linux). Detalle:
[Distribución](../deployment/distribution.md).

## 8. ¿Qué atajos de teclado hay? ##

- `Ctrl+B`: mostrar/ocultar barra lateral.
- `Ctrl+N`: nueva sesión.
- `Ctrl+K`: buscar en memoria.
- `Enter` / `Esc`: aprobar / rechazar en tarjetas de aprobación.
- En macOS, `Cmd` equivale a `Ctrl`.

## 9. ¿Puedo cambiar a tema claro? ##

No. Ego es **dark-only** por decisión de diseño (ver
[ADR 0004](../adr/0004-dark-only.md)): un único modo oscuro con
4 presets seleccionables. No hay tema claro ni conmutador claro/oscuro.

## 10. No encuentro mi problema aquí, ¿qué hago? ##

Ve a [Solución de problemas](./troubleshooting.md): cubre modo `mock`
inesperado, keys que no funcionan, avisos de actualización y más. Si tu
síntoma no está o la solución no funciona, anota qué esperabas, qué
hiciste y el mensaje exacto del error antes de pedir ayuda.
