# CoucouCompanionEngine — Motor Modular de Personajes Desktop 2.5D

Este directorio contiene una implementación original, modular y completamente tipada de un motor de compañeros virtuales de escritorio inspirado en la arquitectura de **Coucou** (macOS/Tauri), combinando geometría analítica superelíptica, FSMs desacopladas, árbitro de prioridades para flujos HITL y síntesis de sonido procedural.

---

## 1. Estructura de Módulos

```
examples/coucou-companion/
├── CoucouCompanionEngine.ts     # Fachada coordinadora central
├── geometry/
│   └── superellipsoid.ts        # Superficie analítica r(y) = (1 - |y|^p)^(1/p) y normales
├── animation/
│   ├── animationClock.ts        # Reloj desacoplado de framerate fijo
│   └── spring.ts                # Oscilador armónico amortiguado (Euler semi-implícito)
├── behavior/
│   ├── spatialPresence.ts       # FSM espacial con detección de proximidad e histéresis
│   └── stateArbiter.ts          # Árbitro de prioridades (HITL > Usuario > Emoción > Idle)
├── accessories/
│   └── outfitSystem.ts          # Anillos de corte elíptico y partición por oclusión Z
├── runtime/
│   └── agentEventBridge.ts      # Puente de eventos tipados con watchdog y deduplicación
├── audio/
│   └── audioFeedback.ts         # Síntesis Web Audio API con limitación de repetición
├── rendering/
│   └── renderer2d.ts            # Pipeline de dibujo en 9 capas con luz volumétrica
└── tests/
    ├── geometry.test.ts         # Aserciones matemáticas (continuidad, no-NaN, normales)
    ├── stateTransitions.test.ts # Aserciones de estados (prioridad HITL, histéresis)
    └── run-tests.ts             # Ejecutor de pruebas
```

---

## 2. Ejecución de Pruebas Unitarias

Para ejecutar la batería de pruebas en Node.js mediante `tsx` o `ts-node`:

```bash
npx tsx examples/coucou-companion/tests/run-tests.ts
```

---

## 3. Contratos de Integración Clave

* **Geometría**: Superficie analítica parametrizada con semiejes $(a, b, c)$ y exponente $p = 2.7$.
* **Prioridad HITL**: Las solicitudes `waitingForApproval` imponen el badge `bang` (`!`) e interrumpen inmediatamente cualquier animación secundaria o estado de sueño.
* **Proximidad con Histéresis**: El personaje duerme si $d \ge 160\text{ px}$ durante más de $120\text{ s}$; despierta al cruzar el umbral $d \le 120\text{ px}$.
