# ADR 0014: Virtualización del chat con `virtua` a partir de 60 mensajes #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-19 |
| Estado | Aceptado |
| Nivel jerárquico | 10.Implementation (`docs/jerarquia-canonica.md`) |

## Contexto ##

El hilo de chat de Ego crece de forma no acotada: una sesión larga con
conversaciones y respuestas largas monta cientos de nodos de mensaje en el
DOM. `ThreadPrimitive.Messages` de `@assistant-ui/react` no admite un
contenedor externo ni virtualización, de modo que renderizar los mensajes
uno a uno es la única opción dentro de la librería.

La primera aproximación fue una virtualización "barata" por turnos
(`apps/desktop/renderer/components/ego-chat.tsx`), pero generaba un árbol de
nodos distinto del que `ThreadPrimitive` espera, lo que rompía la
correlación índice↔mensaje y hacía imposible escalar por encima de ~60
mensajes.

La solución adoptada en el commit `a31a4b5`
("perf(renderer): implement threshold-based message list virtualization with
virtua in ego-chat") externaliza la lista a `virtua`.

## Decisión ##

La lista de mensajes del chat se virtualiza con **`virtua`**.

- Componente: `apps/desktop/renderer/components/chat/ChatMessageList.tsx`
  (`Virtualizer` de `virtua`).
- Umbral: `CHAT_VIRTUALIZATION_THRESHOLD = 60`
  (`apps/desktop/renderer/components/ego-chat.tsx`). Por debajo del umbral se
  mantiene el render nativo de `assistant-ui` (`aui.thread.message`), por
  encima se renderiza la lista virtualizada.
- `itemSize` es solo la **estimación inicial** del alto de un item; `virtua`
  no impone un alto fijo.
- La virtualización es **condicional**: un `Virtualizer` incondicional en
  hilos cortos rompería las suites de tests y el `aria-live` del compositor.

## Alternativas consideradas ##

- **Render nativo de `assistant-ui` sin virtualizar (descartado):** el coste
  de montaje crece linealmente con el número de mensajes y degrada la
  interacción en sesiones largas.
- **`react-window` / `react-virtualized` (descartado):** APIs basadas en
  altura fija; el contenido de Ego es de altura variable (markdown, código,
  diffs), lo que obliga a medir y rompe el scroll.
- **Virtualización manual por rangos (descartada):** reimplementa lo que
  `virtua` ya resuelve, con el coste de mantener un índice de offsets.
- **`virtua` (elegido):** library de virtualización por React con
  `Virtualizer` integrado, medición de altura variable y API mínima.

## Consecuencias ##

- Positivas: el DOM del chat deja de crecer linealmente con el historial; el
  scroll y el envío de turno se mantienen fluidos en sesiones largas.
- Negativas: el camino virtualizado **no** es equivalente al nativo — con más
  de 60 mensajes, `ThreadPrimitive.MessageByIndex` resuelve contra el store de
  `assistant-ui` mientras el `Virtualizer` itera el array local, lo que
  desincroniza el índice.
- Deuda asumida: ese desync está registrado como `EGO-FIND-20` (crítico) en
  `docs/roadmap/Backlog.md` (A4). La alternativa documentada por la librería
  es `ThreadPrimitive.Unstable_MessageById`.
- Riesgo: el umbral 60 es un valor local, no derivado de medición; debe
  revisarse cuando exista telemetría de sesiones reales.

## Referencias ##

- `apps/desktop/renderer/components/chat/ChatMessageList.tsx`
- `apps/desktop/renderer/components/ego-chat.tsx` (`CHAT_VIRTUALIZATION_THRESHOLD`)
- `apps/desktop/renderer/package.json` (`virtua ^0.53.5`)
- `docs/roadmap/Backlog.md` (`EGO-FIND-20`)
