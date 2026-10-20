---
diataxis: reference
---

# Novedades (changelog)

Versión amigable del [CHANGELOG.md](../../CHANGELOG.md) canónico
(formato Keep a Changelog + SemVer). Si hay discrepancia, manda el
`CHANGELOG.md` de la raíz.

> **Estado 2026-10-20:** esta entrada y las de
> [`docs/changelog.md`](../changelog.md) y el `CHANGELOG.md` raíz están
> **sincronizadas**. La regla de precedencia es explícita en los tres:
> **manda la raíz**.

## Próximo (sin publicar)

Esto es lo que viene en camino, aún sin número de versión:

- **La app ya no se cae al escribir un turno largo.** Con más de 60 mensajes en
  el hilo, enviar un turno ya no rompe la ventana.
- **El chat se queda con el mismo tema en todo momento.** Los menús desplegables
  ya no son los del sistema operativo, así que respetan el modo oscuro y se
  manejan bien con el teclado y el lector de pantalla.
- **Los botones se pulsan bien.** Todos los objetivos interactivos cumplen el
  mínimo de 44 px.
- **El historial deja de crecer sin límite.** Los turnos antiguos se resumen y
  se guardan aparte, en vez de meterse enteros en cada petición.
- **El agente puede trabajar en segundo plano.** Puede lanzar, pausar, cancelar
  y consultar tareas en background.
- **El contenido externo ya no puede dar órdenes.** Lo que viene de un
  documento o de una web se marca como dato no confiable y se mantiene
  separado de tus instrucciones; si una acción delicate se apoya en ese
  contenido, se te pide aprobación.
- **Ego puede actuar como servidor MCP**, además de consumir servidores MCP.
- **Las paletas del tema en OKLCH**, con el contraste verificado automáticamente
  contra el estándar WCAG 2.2 sobre los colores reales.
- **E2E en Electron desde cero:** ya existe el esqueleto para probar la app
  desktop real de punta a punta (abre la ventana, verifica el bundle y corre
  los escenarios base). En CI se omite con aviso si todavía no hay bundle
  construido.
- **Accesibilidad WCAG 2.2:** base para que Ego sea usable con teclado,
  lector de pantalla y contraste suficiente.
- **Resaltado y movimiento mínimos:** base de Shiki (código legible) y Motion
  (transiciones sobrias) sin inflar dependencias.
- **Navegación y CSP más duras:** base de política de seguridad de contenido
  y navegación endurecida en la ventana desktop.

### Migración

Ninguna acción requerida: todo lo anterior es aditivo y no cambia APIs,
configuración ni formato de datos. Si usas un bundle anterior, reconstruye
con `pnpm build` para probar el flujo E2E completo.

Dos cambios **sí** requieren atención:

- **Los menús desplegables** del selector han cambiado de aspecto (siguen
  siendo el mismo elemento, con la etiqueta y el valor intactos). Si tenías
  capturas o un test que mirara el `<select>` nativo, actualízalo: ahora es un
  componente accesible con teclado.
- **El tema de la ventana ya no depende del sistema operativo.** Sigue siendo
  dark-only, como estaba, pero la app ya no lo cambia por su cuenta.
