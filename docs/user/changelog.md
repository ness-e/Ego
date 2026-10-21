---
diataxis: reference
---

# Novedades (changelog)

Versión amigable del [CHANGELOG.md](../../CHANGELOG.md) canónico
(formato Keep a Changelog + SemVer). Si hay discrepancia, manda el
`CHANGELOG.md` de la raíz.

> **Estado 2026-10-20:** las entradas de la **Ola 1** y de la **Ola 2** están
> **sincronizadas** en [`docs/changelog.md`](../changelog.md) y el `CHANGELOG.md`
> raíz. La regla de precedencia es explícita en los tres: **manda la raíz**.

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
- **Las imágenes de los mensajes ya no pueden espiarte.** El contenido del chat
  se limpia con una lista blanca y las imágenes solo pueden venir de la propia
  app: una imagen remota incrustada en un mensaje ya no puede enviar datos
  fuera.
- **El personaje avisa cuando algo falla pero todo sigue.** Antes, si una
  herramienta fallaba y el turno continuaba, el personaje se quedaba en
  «pensando» como si nada. Ahora se pone en ámbar, con un triángulo de aviso,
  y vuelve a su estado normal en el siguiente turno.
- **El personaje conserva su aspecto en el modo estudio.** Al abrir el
  lienzo y volver, los estados ya no se mezclan.
- **Varias herramientas se ejecutan a la vez.** En vez de hacerlas una detrás
  de otra, las del mismo turno corren en paralelo y los resultados llegan en el
  mismo orden de siempre. Medido: 220 ms en lugar de 600 ms.
- **Ego se puede conectar como servidor MCP** desde otros programas, siempre
  en tu propio equipo (`127.0.0.1`), con una clave que se guarda en el
  almacén de credenciales del sistema y que **nunca** se pasa a la interfaz.
  Cada herramienta sensible sigue pidiendo tu aprobación, igual que en el
  chat.
- **Menos ruido en el linter de código:** los ficheros de terceros que se
  incluyen por licencia ya no se revisan como si fueran código tuyo, y el
  linter de estilos que se quejaba de colores hardcodeados ya no falla por
  culpa de un cambio en un fichero ajeno.

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
- **Electron se ha actualizado** de una versión que ya no recibía parches de
  seguridad a una con soporte. No cambia nada de tu uso diario, pero
  conviene **reconstruir** (`pnpm build`) y reinstalar la app: las versiones
  antiguas siguen arrancando, aunque sin las correcciones de seguridad del
  motor.
- **El servidor MCP de Ego escucha solo en `127.0.0.1`** y exige una clave.
  El canal para obtener esa clave (variable de entorno o fichero protegido en
  el directorio de datos de la app) **todavía se está documentando**: hasta
  que se cierre, un cliente MCP externo no puede autenticarse de forma
  soportada. Ver `EGO-FIND-81` en el Backlog y
  [ADR-0021](../adr/0021-mcp-server-transporte-y-token.md).
