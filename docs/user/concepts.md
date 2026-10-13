# Conceptos clave

## Chat: el canal de intención

El chat es donde expresas lo que quieres hacer. Escribes un objetivo
en lenguaje natural y Ego lo enruta internamente: selecciona el modelo,
consulta la memoria y activa al especialista adecuado. El avatar del
especialista aparece solo en su primer mensaje o cuando cambia el
interlocutor, para no saturar la conversación.

## Canvas: la superficie de trabajo

El Canvas es el área junto al chat donde vive el trabajo en curso:
informes estructurados, diffs de código, tablas editables, tableros y
formularios. Características:

- **Dinámico:** cambia a medida que la tarea evoluciona; no todas las
  tareas lo necesitan (una pregunta simple se responde solo con texto).
- **Seleccionable:** puedes seleccionar elementos del Canvas y
  enviarlos al chat como contexto explícito para seguir trabajando
  sobre ellos.
- **Persistente por proyecto:** los artefactos del Canvas se guardan y
  se restauran al reabrir el proyecto.

## Sub-Egos: especialistas, no pantallas

Los Sub-Egos son entidades cognitivas especializadas por dominio
(ingeniería, producto, etc.), no secciones de la interfaz. Un Sub-Ego
no implica una pantalla: aparece en el chat o el Canvas cuando su
dominio es relevante y se repliega al terminar. Los que fijes para
acceso frecuente quedan anclados como accesos directos.

Cada Sub-Ego tiene un espacio privado de trabajo que ningún otro
Sub-Ego puede leer directamente; comparten solo lo que publican en la
memoria compartida del proyecto.

## Proyectos y memoria

Todo pertenece a un **proyecto**: conversaciones, artefactos,
decisiones y hechos. Al cambiar de proyecto conmutan el contexto, los
borradores y los archivos sin fugas entre proyectos. La memoria
persiste en disco en la base local (VantaDB), por eso sobrevive a
cierres y reinicios.

## Aprobaciones (HITL)

Las acciones con impacto —escribir fuera del área del proyecto, borrar
archivos, ejecutar comandos, contactar servicios externos— quedan
retenidas hasta que las apruebas en la tarjeta del chat (`Aprobar` /
`Rechazar` / `Inspeccionar diff`, con `Enter` / `Esc` como atajos).
Comprender por qué se propone algo (explicabilidad) y autorizarlo
(aprobación) son cosas distintas: puedes pedir el "¿por qué?" de
cualquier propuesta sin que eso la ejecute.

## Estado Dinámico al abrir

Al abrir Ego ves un resumen vivo generado a partir del estado real de
tus proyectos: qué ocurrió, qué está en curso, qué quedó ejecutándose,
qué necesita atención y qué conviene hacer hoy. Cada elemento es
accionable: selecciónalo para profundizar con contexto.

## Actividad en segundo plano

El indicador de actividad (en el marco superior de la ventana) muestra
qué se está ejecutando sin interrumpirte: reposa imperceptible cuando
no hay nada en curso, muestra el avance durante el trabajo y se expande
cuando una aprobación requiere tu decisión.

## Tus datos

Local-first: tus conversaciones, keys (cifradas), proyectos y memoria
viven en tu equipo. La única red que Ego genera es hacia los
proveedores de modelo que configures y hacia el feed de
actualizaciones, si lo configuras. Puedes exportar tus sesiones a un
archivo de respaldo (`.vdbdump`) e importarlo de vuelta.
