---
title: Guía Canónica del Producto Mínimo Viable (MVP) — Ego Cognitive Operating System
kind: product
status: canonical
version: 1.0.0
date: 2026-10-09
tags: [ego, mvp, product-guide, golden-path, vertical-slice, software-engineering-anchor]
---

# Guía Canónica del Producto Mínimo Viable (MVP) — Ego

> **Propósito:** Definir con rigor técnico y funcional el alcance, arquitectura, caso de uso ancla y criterios de aceptación no negociables para considerar a Ego un **Producto Mínimo Viable (MVP)** real, verificable y utilizable en el mundo real.
> **Autoridad:** Derivado de la Auditoría Estratégica de Producto (2026-10-09) y los 10 Principios Innegociables de Ego.

---

## 1. Declaración de Misión y Caso de Uso Ancla

### 1.1. La Tesis del MVP
Ego no puede validar su propuesta de valor intentando servir a todos los sectores (legal, finanzas, redacción, marketing y desarrollo) simultáneamente. Para trascender la categoría de "framework abstracto" y convertirse en un producto de escritorio cohesivo, Ego debe demostrar que su núcleo cognitivo puede resolver un problema complejo de principio a fin de forma autónoma, segura y persistente.

### 1.2. El Caso de Uso Ancla: Ingeniería y Gestión de Proyectos de Software
Se selecciona **Ingeniería de Software Local-First** como el vector ancla exclusivo del MVP por tres razones estratégicas:
1. **Dogfooding Inmediato:** El equipo de desarrollo y los agentes utilizan Ego para construir, auditar y mantener el propio repositorio de Ego.
2. **Determinismo Mecánico:** El software ofrece retroalimentación unívoca: compiladores, tipado (`tsc`), pruebas unitarias (`vitest`) y linters proveen un veredicto binario (`exit code 0` o `exit code 1`). No hay ambigüedad subjetiva en la verificación de resultados.
3. **Validación Radical de la Memoria Persistente:** Los desarrolladores pierden contexto continuamente al cambiar de rama, reiniciar la máquina o abordar tareas complejas. Demostrar que Ego recuerda decisiones de arquitectura (ADRs), invariantes del código y el estado de tareas a lo largo de múltiples días es la ventaja competitiva decisiva frente a chatbots efímeros.

---

## 2. El Recorrido Canónico del MVP (The 6-Step Golden Path)

Un usuario sin conocimientos internos de la arquitectura de Ego debe poder completar este recorrido de forma repetible en una máquina de escritorio estándar:

```
[1. Configurar & Conectar] ──▶ [2. Importar Repositorio] ──▶ [3. Asignar Tarea en Lenguaje Natural]
                                                                        │
[6. Continuidad Multi-Día] ◀── [5. Inspección en Canvas] ◀── [4. Ejecución con Aprobación HITL]
```

### Paso 1: Configuración Inicial y BYOK (Bring Your Own Key)
* El usuario abre la aplicación Electron empaquetada.
* Introduce su API Key (OpenAI / Anthropic / Groq) o selecciona un runtime local (Ollama).
* Las credenciales se almacenan de forma segura y `ModelRouter` queda inmediatamente operativo sin recurrir a mocks.

### Paso 2: Creación o Importación de Proyecto
* El usuario selecciona una carpeta local de código (ej. un proyecto TypeScript o Rust).
* Ego crea la entidad `Project` en VantaDB (`projects/<id>/*`), analiza el árbol de directorios e indexa los archivos clave.
* La barra lateral refleja el proyecto activo y aísla todo el contexto de memoria.

### Paso 3: Planificación e Invocación de Especialista
* El usuario formula un objetivo en lenguaje natural:  
  *«Audita las dependencias de este proyecto, busca vulnerabilidades conocidas y propone un plan para mitigarlas»*.
* Ego clasifica la intención, propone la creación o activación del Sub-Ego `code_reviewer` y formula un plan de pasos atómicos.

### Paso 4: Ejecución Controlada con Gobernanza HITL
* El Sub-Ego solicita ejecutar un comando en la terminal local (`pnpm audit` o análisis AST).
* La interfaz de chat despliega una **Tarjeta Interactiva de Aprobación (`ActionApprovalCard`)** explicando:
  * Herramienta requerida, comando exacto, justificación causal y nivel de riesgo.
* El usuario pulsa **Aprobar** (o presiona `Enter`); la herramienta se ejecuta dentro del workspace aislado y el log se transmite en vivo.

### Paso 5: Materialización del Resultado en el Canvas
* Los resultados no se pierden en un muro de texto en el chat.
* El panel lateral (Canvas) renderiza:
  * El informe estructurado de vulnerabilidades.
  * El diff de cambios recomendados en `package.json`.
  * La lista de tareas pendientes con casillas de verificación interactivas.

### Paso 6: Persistencia Multi-Día y Reanudación
* El usuario cierra Ego por completo (`Alt+F4` o reinicio del sistema operativo).
* Al abrir Ego al día siguiente, el proyecto seleccionado, el Sub-Ego activo, las decisiones tomadas y los artefactos del Canvas se restauran idénticos en menos de 2 segundos desde VantaDB LSM (`ego_memory.vdb`).

---

## 3. Matriz de Alcance del MVP (In-Scope vs. Out-of-Scope)

| Componente / Capacidad | Estado en MVP (In-Scope) | Fuera de Alcance (Out-of-Scope para MVP) |
|---|---|---|
| **Inferencia / Modelos** | BYOK funcional (OpenAI Compatible, Anthropic, Ollama local) vía `ModelRouter`. | Enrutamiento dinámico complejo por costos multi-proveedor o SLMs embebidos en el bundle. |
| **Memoria** | Persistencia real in-process en VantaDB (Fjall LSM), namespaces `projects/<id>/*` y `egos/<id>/*`. | Replicación en la nube, sincronización multi-dispositivo y GraphRAG masivo distribuido. |
| **Herramientas (Tools)** | Conectores Nivel A: Filesystem restringido al workspace, Terminal segura y Memoria. | Automatización de navegador compleja, integraciones SaaS propietarias o scrapers no locales. |
| **Sub-Egos** | 3 modalidades de fábrica (`SubEgoFactory`), ciclo de vida lazy (`SubEgoRuntime`), aislamiento perimetral (`SubEgoMemoryGuard`). | Delegación recursiva infinita (>3 niveles) o enjambres masivos no supervisados. |
| **Interfaz (UI/UX)** | Chat fluido con streaming, Canvas con Visor de Código/Diffs, Panel de Tareas y Tarjetas HITL. | Motor generativo arbitrario de React en caliente o diseñador visual drag-and-drop. |
| **Personaje / Mascota** | Silueta vectorial no humanoide con micro-animaciones reactivas a estados de herramientas. | Sistema de vestimenta, personalización cosmética avanzada o física esquelética 3D. |
| **Infraestructura CI/CD** | Verificación local estricta (`agent-system` / pnpm test). | Pipelines de GitHub Actions multiplataforma y publicación automática de releases. |

---

## 4. Criterios de Aceptación Definitivos (Definition of Done del MVP)

Ego será declarado un **MVP P0-Alpha Exitoso** cuando cumpla simultáneamente los siguientes 7 requisitos empíricos:

1. **Cero Mocks en Fast-Path:** El flujo de chat en la aplicación desktop ejecuta llamadas reales a través de `ToolExecutionLoop` conectando un modelo real sin fallar a `mock-core`.
2. **Aislamiento de Proyectos Comprobado:** Conmutar entre dos proyectos en la barra lateral conmuta limpiamente el contexto en memoria, scratchpads y archivos sin fugas de datos cruzadas.
3. **Gobernanza HITL en Vivo:** Ningún comando destructivo o de terminal se ejecuta sin mostrar la tarjeta interactiva de aprobación en la UI y recibir confirmación explícita del usuario.
4. **Durabilidad Comprobada post-Crash:** Tras un cierre forzado del proceso (`SIGKILL`), la reapertura de la aplicación recupera la sesión, el historial y los hechos del proyecto sin corrupción de datos.
5. **Rendimiento de Inicio (Cold Start):** La ventana de Electron abre, conecta a VantaDB y renderiza la interfaz en menos de 2.500 ms en hardware estándar.
6. **Presupuesto UI Respetado:** El código de componentes visuales no supera el 20% del esfuerzo total de ingeniería (Decisión P22).
7. **Suite de Pruebas Monorepo en Verde:** Todos los paquetes del workspace compilan con tipado estricto (`tsc --noEmit`) y pasan el 100% de las pruebas automatizadas.
