# Dirección Artística de Ego y Sub-Egos + Propuesta de Backlog (CHAR-03 / integración)

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-08 |
| Estado | **Aprobada e insertada en `Backlog.md` (2026-10-08).** `CANV-08` reconciliado: su alcance técnico pasa a `CHAR-05/06` |
| Depende de | `docs/research/character-audit-and-coucou-inventory.md` |

---

## 1. Brief de identidad visual (entrada para CHAR-03)

### Definición Estética Clave
Ego y sus Sub-Egos son **criaturas/bots limpios, carismáticos y tangibles**, en la línea estética amigable de personajes como Coucou/Mochi o Astro Bot, pero con identidad original:
- **Tienen anatomía de criatura:** poseen una cabeza/cuerpo armónico, **ojos grandes y expresivos** (con parpadeo y dirección de mirada), **boca reactiva** (sonrisa, sorpresa, concentración) y **brazos/manitas** procedurales que gesticulan, saludan o interactúan.
- **NO son humanos vestidos:** no llevan corbatas, trajes, ropa humana de tela ni pantalones. Su personalidad se transmite mediante silueta, proporciones, apéndices (antenas, orejitas, crestas) y gesticulación.
- **NO son entes abstractos ni logos matemáticos:** no son poliedros fríos, átomos, diagramas ni orbes flotantes sin vida. Son personajes vivos y empáticos.
- **100% procedurales en código (Canvas 2D / Path2D):** su geometría y animación se calculan en tiempo real a 60 fps sin requerir sprites ni imágenes rasterizadas.
- **Legibilidad multiescala:** la silueta es nítida a 16–20 px en la barra de menú o docks, y rica en detalles cinéticos a 72–120 px en el chat y widget.

### Ejes de diferenciación de un Sub-Ego (sin disfraces humanos)

| Eje | Parámetro | Ejemplo |
| --- | --- | --- |
| Silueta & Proporción | Relación cabeza/cuerpo, masa | Compacto/rechoncho vs estilizado |
| Rasgos anatómicos | `traits` (orejitas, antenas, penachos) | Antenas sensoriales, orejas suaves |
| Expresión facial | Estilo de ojos, escala de boca | Ojos vivaces, visor focalizado, sonrisa amplia |
| Manitas / Brazos | Postura y cinemática | Manos descansadas, manos activas tecleando |
| Paleta & Acento | Color del cuerpo + energía | Base clara/neutra + acento cromático vivo |
| Comportamiento | Ritmo de respiración, rebote | Pausado y analítico vs ágil y entusiasta |

### Catálogo de Candidatos Prototipados (CHAR-03)

#### 🌟 Sección II: Colección Identidad Ego — Diseños Personalizados (Modo Ego)
Diseñados a partir de la filosofía del Sistema Operativo Cognitivo, persistencia mnemónica (VantaDB) y soberanía local, manteniendo el renderizado procedural cerámico y la ternura de Coucou:

| Candidato Ego | Concepto de Marca & Filosofía | Rasgos Distintivos de Ingeniería | Expresividad & Sub-Egos |
| --- | --- | --- | --- |
| **E1 — Ego Prime (El Núcleo Cognitivo)** | Representa el Cognitive Runtime unificado. | **Cognitive Core:** Joya/sensor mnemónico romboidal en la coronilla que respira lumínicamente al consultar VantaDB. | **Manitas orbitales magnéticas** con micro-anillos cuánticos sutiles. |
| **E2 — Ego Vanta (Edición Obsidiana Soberana)** | El "Dark Mode" nativo de Ego y el espíritu directo del motor VantaDB. | **Cerámica de grafito obsidiana profundo** (`#161922`), reflejos de titanio, ojos y núcleo en **cian electromagnético puro** (`#00E5FF`). | Máximo contraste visual y alta gama técnica. |
| **E3 — Ego Synapse (Sensores de Intención)** | El orquestador de intenciones y delegación de Sub-Egos. | **Aletas/sensores biónicos suaves** integrados en la curvatura de la coronilla. Su cara interna pulsa con el color del Sub-Ego activo. | Excelente legibilidad de silueta a 16 px en docks y barras. |
| **E4 — Ego Halo (Diadema Cuántica Multimodal)** | Coordinación de pipelines multi-modelo asíncronos. | **Halo toroidal cuántico flotante** que sigue la inclinación de la mirada y pulsa con actividad asíncrona de herramientas. | Visualización elegante de tareas de fondo. |

#### 👑 Sección III: Ego y Familia de Sub-Egos Especializados (Diferenciación Anatómica Profunda)
Diferenciación estructural de esencia: siluetas corporales (`Path2D`), geometrías de ojos, extremidades cinéticas y apéndices biométricos especializados según su rol cognitivo:

| Entidad | Rol Cognitivo | Silueta Corporal & Proporción | Estilo de Ojos & Visor | Apéndices & Extremidades |
| --- | --- | --- | --- | --- |
| **EGO PRIME** | Cognitive Runtime & Orquestador Central | Cúpula armónica parabólica balanceada (`#FAFAFC`), centro de masa estable. | Ojos esféricos de mirada omnisciente con destello cyan y dilatación reactiva. | **Cognitive Core** frontal y **orbes gravitacionales satelitales** en órbita continua. |
| **SUB-DEV** | Ingeniería de Software & Código | Prisma hexagonal vertical técnico (`#F0F3F8`), bordes biselados. | **Cyber-Visor horizontal** de doble ranura con escaneo HUD activo. | Antena angular de telemetría y manos robóticas articuladas en postura de tecleo veloz. |
| **SUB-FIN** | Finanzas, Presupuesto & Tokens | Trapezoide achatado de base ancha hiperestable (`#F4F6F4`), máxima solidez. | Ojos analíticos de escrutinio horizontal con micropuntos de enfoque métrico. | Escudo mnemónico perimetral y manos cuadradas en compostura formal. |
| **SUB-CRE** | Creatividad, Canvas & Diseño | Gota orgánica asimétrica fluida (`#FCF2F8`) con curvatura elástica. | Ojos de triple destello estrellado artístico y pestañas cinéticas. | Cresta ondulante reactiva a la emoción y bracitos flexibles de trazo libre. |
| **SUB-RES** | Investigación, GraphRAG & Análisis | Cabeza bilobulada de búho erudito (`#F2F4FC`) con separación hemisférica. | Lentes circulares concéntricas de escaneo mnemónico en gradiente. | Antenas gemelas de sonar/radar con esferas receptoras y manos en pinza investigativa. |
| **SUB-CRM** | Comunicación, Usuarios & Relaciones | Nube ultra-redondeada acolchada (`#FFF5ED`) con triple curvatura bulbosa. | Ojos cerrados/arqueados en sonrisa empática permanente con rubor cálido. | Orejitas suaves acolchadas y manitas esponjosas en postura de bienvenida abierta. |

#### 🏛 Sección I: Línea Base Coucou (Referencia Técnica Intacta)
Los 4 candidatos de fidelidad directa a la matemática de Coucou (`p = 2.7`):

| Candidato | Estilo Geométrico | Características Clave | Identidad |
| --- | --- | --- | --- |
| **C1 — Ego Pure** | Superelipse de Lamé pura idéntica a Coucou/Mochi. | Acabado marshmallow/cerámico puro, máxima ternura, ojos píldora reactivos y manitas suaves. | La línea de referencia directa de Coucou. |
| **C2 — Ego Auris** | Superelipse con orejitas/sensores suaves en coronilla. | Mismo sombreado y mirada esférica, pero con silueta reconocible a 16 px sin confundirse con un óvalo neutro. | Silueta animal/bot tierna y balanceada. |
| **C3 — Ego Sprout** | Superelipse con antena/brote bioluminiscente superior. | Brote oscilante con resorte y bolita de luz reactiva que pulsa con el estado operativo del runtime. | Ideal para reflejar computación viva en el header. |
| **C4 — Ego Lumia** | Superelipse con estilización orgánica de gota suave. | Cúspide sutil hacia arriba, postura erguida pero tierna, mirada amplia y manitas activas. | Silueta vertical limpia para docks y barras laterales. |

---

## 2. Gramática de estados (reutilizable por cualquier criatura)

Mantener el `CharacterState` canónico de `character-system.md` (14 estados) y mapear cada uno a **canales abstractos**, no a rasgos concretos:

| Canal | Qué controla |
| --- | --- |
| `gaze` | foco de atención |
| `pulse` | ritmo (respiración/trabajo) |
| `posture` | tensión/apertura |
| `aura` | efecto perimetral (atención, éxito, error) |
| `accent` | intensidad del color de acento |

Beneficio: cambiar de criatura (CHAR-03) no invalida estados, tests ni contratos.

---

## 3. Propuesta de tareas para `docs/roadmap/Backlog.md`

IDs `CHAR-*`/`WIDG-*` libres (verificado). Ajustes frente al plan original en **negrita**.

| ID | Fase | Trabajo | Esfuerzo | Depende de | Nota |
| --- | --- | --- | --- | --- | --- |
| CHAR-01 | pre-03 | Auditoría (este análisis) | 1–2 d | — | ✅ hecho (docs) |
| CHAR-02 | pre-03 | Inventario Coucou + procedencia | 2–3 d | CHAR-01 | ✅ hecho (docs) |
| CHAR-03 | pre-03 | Prototipos de silueta + elección | 2–4 d | CHAR-01/02 | siguiente paso |
| CHAR-04 | 03 | Contrato `CharacterProfile` con `traits` (sin `outfit`) | 1–2 d | CHAR-03, `SUB-01`, `SUB-11` | enlazar al manifiesto |
| CHAR-05 | 03 | Motor procedural + renderer vectorial | 3–5 d | CHAR-04 | **incluye golden frames** |
| CHAR-06 | 03 | Estados, interpolación, expresiones | 3–5 d | CHAR-05 | |
| CHAR-07 | 03 | Presets y `TraitRegistry` | 2–3 d | CHAR-04/05 | sin ropa |
| CHAR-08 | 03–04 | Iconos, botones, chat, selector (`SUB-08`) | 2–4 d | CHAR-05/06 | |
| CHAR-09 | 04 | Transición Ego↔Sub-Ego | 2–3 d | CHAR-06/08 | |
| CHAR-10 | 04 | Personalización y persistencia | 3–5 d | CHAR-07 | |
| **`CANV-11`** | 04 | Activity Widget in-app (ya existe) | 2 d | CHAR-06 | **no duplicar con WIDG** |
| WIDG-01 | 07 | Investigación ventana flotante | 2–3 d | CHAR-02 | ya cubierta en §3 del inventario; reduce a prototipo |
| WIDG-02 | 07 | Ventana flotante `desktop-float` | 3–5 d | WIDG-01, CHAR-05 | |
| WIDG-03 | 07 | `AttentionStateMachine` pura (`COUC-06`) | 2–4 d | `CANV-11`, eventos | **sin duplicar CANV-11** |
| WIDG-04 | 07 | Interacción y HITL desde widget (ACK 800 ms) | 2–4 d | WIDG-03, `SEC-*` | |
| CHAR-11 | 10 | Rendimiento, a11y, `prefers-reduced-motion` | 2–3 d | CHAR-05..10 | |
| WIDG-05 | 10–12 | Empaquetado, restauración, Wayland | 3–5 d | WIDG-02..04 | |

### Criterios de aceptación mínimos por tarea de código
Implementado + integrado + prueba funcional + prueba de error + persistencia + sin regresiones (ciclo `AGENTS.md`).

### Riesgos principales (FMEA resumido)

| Fallo | Efecto | Mitigación |
| --- | --- | --- |
| Elegir silueta sin validar a 16 px | rediseño costoso tras Fase 03 | CHAR-03 con prueba a 16/24/48 px |
| Renderer decide permisos | brecha de seguridad | renderer solo recibe estado resuelto |
| Widget flotante roba foco | UX hostil | `focusable:false`, test manual por plataforma |
| Animación constante | fatiga, CPU | frecuencia adaptativa 60→15 fps, reduced-motion, kill-switch |
| Código de personajes antes de cerrar Fase 02 / abrir Fase 03 | viola `AGENTS.md` | solo docs/prototipo HTML aislado hasta entonces |
