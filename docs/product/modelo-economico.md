| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de modelo económico |
| Owner | ness-e |
| Fecha | 2026-10-06 |
| Fuente histórica | `../prd/19-18-modelo-econ-mico.md` + Decisiones P14-P15 2026-10-06 |

# Modelo económico de Ego

## Modelo económico de Ego
El modelo económico se basa en la separación estricta entre la capacidad del software y el consumo de inteligencia artificial: **SaaS por suscripción + consumo de IA por separado + BYOK**. No se ofrecen licencias perpetuas. 
La suscripción otorga acceso a las capacidades, características, almacenamiento y automatizaciones de Ego. El uso intensivo de IA (inferencia) es una capa separada, medida y gestionada a través de créditos o presupuesto.

## Open Source
Ego es software libre bajo la licencia **Apache 2.0**. Todo el código fuente es abierto, fomentando la adopción, transparencia, confianza, comunidad y contribuciones externas.
La monetización de Ego no se basa en el licenciamiento del código, sino en **servicios comerciales** añadidos, tales como Ego Cloud, sincronización, respaldos, créditos de IA, gestión de infraestructura y automatizaciones en la nube.
La ventaja competitiva de Ego radica en la velocidad, UX, calidad, ecosistema de integraciones, y la facilidad de sus servicios e infraestructura.

## Estructura de ingresos

| Fuente | Descripción |
| --- | --- |
| Suscripción | Diferentes tiers (Free, Individual, Advanced, Team, Organization, Enterprise) para acceso a las capacidades del producto. |
| Créditos de IA | Asignación incluida en planes y recargas prepago adicionales para consumo de modelos. |
| BYOK (Bring Your Own Key) | Opción voluntaria donde el usuario conecta sus propias llaves y paga al proveedor de IA directamente. |
| Ego Cloud | Infraestructura gestionada para usuarios que prefieren no auto-hospedar. |
| Sync & Backups | Servicios de sincronización cifrada y copias de seguridad continuas. |
| Cloud Automation | Ejecución de tareas programadas y workflows sin requerir la máquina local encendida. |
| Collaboration | Capacidades de multijugador, gestión de equipos y entornos compartidos. |
| Managed Services | Servicios administrados para usuarios corporativos. |
| Futuro | Enterprise, soporte premium, integraciones avanzadas exclusivas. |

## Estructura de costos
La operación comercial de Ego contempla costos por:
- Inferencia de IA (consumo de modelos alojados por terceros o propios).
- Bases de datos y almacenamiento en la nube (Sync/Backups).
- Capacidad de cómputo (Cloud Automation, Ego Cloud).
- Ancho de banda y transferencia de datos.
- Proveedor de autenticación (Auth).
- Comisiones del proveedor de facturación (MoR).
- Observabilidad, monitoreo y telemetría.
- Servicios de email y comunicaciones transaccionales.
- Integraciones y APIs de terceros.

## Dimensiones de los planes
Los planes de Ego no se definen únicamente por la cantidad de "Sub-Egos" disponibles, sino a través de múltiples ejes de capacidad:

| Dimensión | Descripción |
| --- | --- |
| Proyectos | Cantidad de workspaces o proyectos aislados gestionables. |
| Memoria / Almacenamiento | Retención de memoria vectorial, historial, límite de almacenamiento de artefactos. |
| Automatizaciones | Reglas, flujos y tareas programadas en la nube. |
| Tareas concurrentes | Número de Sub-Egos o hilos ejecutando trabajo de forma paralela. |
| Integraciones | Acceso a integraciones específicas (ej. GitHub, Jira, Figma, bases de datos). |
| Herramientas | Acceso a herramientas avanzadas del SOC (browser headless, entornos de ejecución aislados). |
| Colaboración | Cantidad de asientos, permisos granulares y espacios de trabajo compartidos. |
| Presupuesto de IA | Volumen de créditos de IA incluidos en el ciclo de facturación. |
| Funciones Avanzadas | Capacidades enterprise, SLA, SSO. |

## Model Router y proveedores
Ego implementa una capa de abstracción denominada **Model Router**. Esta capa consolida la oferta de múltiples proveedores cloud (OpenAI, Anthropic, Gemini, OpenRouter, etc.), modelos locales y BYOK.
El enrutador selecciona de manera inteligente y dinámica el proveedor óptimo para cada inferencia basándose en:
- Capacidad requerida de la tarea (razonamiento, código, creatividad).
- Costo y presupuesto disponible.
- Latencia esperada.
- Ventana de contexto necesaria.
- Disponibilidad del servicio.
- Preferencias del usuario.

## AI Wallet / Presupuesto de IA
Cada usuario o equipo cuenta con un **AI Wallet** configurable. 
Este sistema define políticas de gasto como límites diarios, selección forzada de modelos para tareas rutinarias y umbrales de aprobación para operaciones costosas.
El Wallet se nutre de los créditos incluidos en la suscripción, las recargas manuales (top-ups) y la integración de BYOK, proporcionando total visibilidad sobre el consumo.

## Facturación
El sistema de facturación se delega en un proveedor externo de tipo **MoR** (Merchant of Record), como Paddle o Lemon Squeezy, que gestiona cobros, impuestos internacionales y devoluciones. 
La comunicación de estados de pago hacia Ego se realiza vía webhooks, evitando implementar sistemas de cobro desde cero y garantizando el cumplimiento fiscal global.

## Entitlements
Se implementa una capa de **Entitlements** (derechos) que está totalmente desacoplada del proveedor de pagos.
El sistema de Ego no pregunta "¿el usuario pagó?", sino "¿qué derechos y límites tiene esta cuenta?". Esto facilita modelos freemium, descuentos, grants educacionales, créditos de prueba o ajustes manuales sin afectar la lógica del producto.

## Usuarios locales vs Cloud
Se establecen tres modalidades principales de uso:
- **Local/Auto-hospedado (Free)**: El usuario provee el cómputo, su propia base de datos, infraestructura y claves de IA (modelos locales o BYOK). No paga suscripción.
- **Ego Cloud**: Entorno completamente gestionado. El usuario paga suscripción que incluye infraestructura, sincronización y créditos de IA.
- **Híbrido**: Uso de infraestructura cloud de Ego pero delegando la inferencia en claves propias (BYOK), combinando ventajas de ambas aproximaciones.

## Evolución
El modelo comercial se desplegará progresivamente:
- **P0**: Lanzamiento Open Source. Orientado a local-first. Servicios comerciales mínimos.
- **P1**: Beta de Ego Cloud. Venta de créditos de IA. Sincronización y respaldos básicos.
- **P2**: Capacidades de Collaboration. Cloud Automation. Planes Advanced.
- **Futuro**: Enterprise, infraestructura dedicada y Managed Services.

## Principios económicos
Las decisiones comerciales de Ego se rigen por tres principios rectores:
1. "El usuario paga por la capacidad de Ego; el uso intensivo de IA se mide y controla por separado."
2. "Ego Open Source democratiza el acceso al sistema; Ego Cloud monetiza la complejidad de operarlo."
3. "Ego no debe cobrar por permitir utilizar su código; debe cobrar por valor, infraestructura y capacidades."

## Precios
*(Precios no definidos en esta etapa. El objetivo es documentar el modelo de captura de valor. Los precios exactos se determinarán iterativamente en función de los costos reales de infraestructura e inferencia y el comportamiento del usuario en producción).*
