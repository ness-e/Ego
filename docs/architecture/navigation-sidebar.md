---
title: "Cognitive Navigation Sidebar — Especificación de Diseño de UX"
kind: design
status: canonical
owner: ness-e
date: 2026-10-07
description: "Especificación formal de diseño del panel lateral de navegación, roster de Sub-Egos, proyectos y superficies de control para Ego Cognitive OS."
tags: [ego, soc, sidebar, navigation-rail, design, ux, ui, projects, sub-egos]
---

# Cognitive Navigation Sidebar — Especificación de Diseño de UX

> **Principio de Interfaz:** *"La navegación no aprisiona el espacio de trabajo; lo organiza bajo demanda."*  
> El Navigation Sidebar de Ego no es un panel estático rígido de 320px que asfixia el Canvas ni un menú web pasivo. Es una **superficie contextual de control de estado y gobierno cognitivo** con arquitectura dual: **Navigation Rail (54px)** y **Expanded Sidebar (260px)**.

---

## 1. Justificación y Análisis de Referencias de la Industria

A partir del análisis de las plataformas líderes de asistencia y agentes (Claude Desktop, ChatGPT, Antigravity, Dots de OpenAI y Grok):

| Referencia | Patrón Incorporado en Ego | Razón Arquitectónica |
|---|---|---|
| **Claude** | Jerarquía de acciones limpias (`+ Nuevo`, `Proyectos`, `Artifacts`, `Personalización`) y footer modal de cuenta/ajustes. | Provee accesibilidad inmediata a configuraciones sin saturar la barra de herramientas. |
| **ChatGPT** | Acceso directo a herramientas modales e historial cronológico de hilos (`session/turns`). | Permite recuperar rápidamente sesiones y turnos anteriores guardados localmente. |
| **Antigravity** | **Estructura arbórea de Proyectos:** Carpetas de proyectos con conversaciones anidadas por contexto compartido. | Materializa el **Principio 2 de Ego (Project Memory)**: el contexto se aisla y comparte a nivel de proyecto. |
| **Dots (OpenAI)** | **Navigation Rail ultra-compacto (Icon Dock):** Permite colapsar el ancho completo manteniendo los iconos operativos activos. | Protege el *budget de pantalla* (1440x900) para que el `Conversation River` y el `Dynamic Canvas` tengan espacio óptimo. |
| **Grok / Multi-Agente** | **Roster visual de Sub-Egos:** Lista de especialistas con avatares procedurales, estados de actividad (`active`, `idle`) y selección directa de portavoz. | Da visibilidad al paradigma multi-agente de Ego sin forzar comandos textuales. |

---

## 2. Modo Operativo Dual: Rail vs Expandido

```
[ MODO COLLAPSED: RAIL (54px) ]           [ MODO EXPANDED: SIDEBAR (260px) ]
┌────┐                                   ┌────────────────────────────────────────┐
│[◨] │ Toggle                            │ [ ◨ ] Ego Cognitive OS     [ + Nuevo ] │
├────┤                                   ├────────────────────────────────────────┤
│ 🔍 │ Buscar (Ctrl+K)                   │ 🔍 Buscar recuerdos, turnos... (Ctrl+K)│
├────┤                                   ├────────────────────────────────────────┤
│ 📁 │ Proyectos                         │ ▼ PROYECTOS (Project Memory)           │
│    │                                   │   📁 Ego Core (Activo)                 │
│    │                                   │   📁 VantaDB Engine                    │
│    │                                   │   + Nuevo proyecto...                  │
├────┤                                   ├────────────────────────────────────────┤
│ 👥 │ Sub-Egos                          │ ▼ SUB-EGOS (Roster de Especialistas)   │
│    │                                   │   (●) Ego Núcleo        · Orquestador  │
│    │                                   │   (●) Sub-Ego Dev       · Ingeniería   │
│    │                                   │   (●) Sub-Ego Producto  · Specs & PRDs │
│    │                                   │   + Diseñar Sub-Ego...                 │
├────┤                                   ├────────────────────────────────────────┤
│ 💬 │ Sesiones                          │ ▼ HISTORIAL DE SESIONES                │
│    │                                   │   • Inicializar persistencia VantaDB   │
│    │                                   │   • Diseño de arquitectura SOC         │
├────┤                                   ├────────────────────────────────────────┤
│ 🗂️ │ Artifacts                         │ ▼ ESPACIO & HERRAMIENTAS               │
│ ⚡ │ MCP Tools                         │   🗂️ Artifacts del Canvas              │
│    │                                   │   ⚡ Servidores MCP (Git, Filesystem)  │
├────┤                                   ├────────────────────────────────────────┤
│ ⚙️ │ Settings                          │ ⚙️ Configuración (Modelos, BYOK, VDB)   │
│ 👤 │ Perfil                            │ 👤 Eros Nessy (Owner Local)            │
└────┘                                   └────────────────────────────────────────┘
```

### Reglas de Transición y Ergonomía
- **Ancho Colapsado:** `w-[54px]` fijo, centrado de iconos, tooltips flotantes en hover.
- **Ancho Expandido:** `w-[260px]`, títulos descriptivos, scroll vertical independiente.
- **Atajos de Teclado:**
  - `Ctrl + B`: Alternar entre modo Rail y Expandido.
  - `Ctrl + N`: Crear nueva sesión en el proyecto activo.
  - `Ctrl + K`: Abrir omnibar de búsqueda en memoria VantaDB.
  - `Ctrl + ,`: Abrir modal de configuración del sistema.

---

## 3. Mapeo Funcional con el Cognitive Runtime de Ego

Cada bloque del Sidebar está respaldado por contratos y subsistemas del backend:

| Bloque Visual | Contrato / Canal IPC | Subsistema de Backend | Persistencia |
|---|---|---|---|
| **Selector de Proyectos** | `ipc.memory.get` / `lifecycle.startSession` | `EgoMemoryLifecycle` | Namespace `projects/<id>/*` en VantaDB |
| **Roster de Sub-Egos** | `ipc.subegos.list` / `ipc.subegos.create` | `EgoMemoryAdapter` | Namespace inmutable `gov/sub_egos` en VantaDB |
| **Historial de Sesiones** | `ipc.memory` (`searchMulti`/`list`) | `EgoMemoryLifecycle` | Namespace `session/turns` en VantaDB |
| **Artifacts** | Canvas Store (`Union.tsx`) | `Dynamic Workspace Engine` | Local Workspace / `.vdb` |
| **Herramientas & MCP** | `ipc.tools.list` (Fase 02) | `ToolRegistry` & `McpClient` | Manifests de Integración |
| **Configuración / Modelos** | `ipc.snapshots` / Model Config | `ModelRouter` (`@ego/models`) | Preferencias de Electron / Keychain |

---

## 4. Estado de Interfaz (UI State) vs Estado de Memoria

Siguiendo el contrato de `Preguntas y respuestas.txt` §Estado de aplicación:

* **Estado de UI (Efímero en React):**
  - `isCollapsed: boolean` (Guardado en `localStorage` o preferencias de ventana).
  - `activeSidebarSection: "projects" | "subegos" | "history" | "tools"`.
  - `searchQuery: string`.
  - `isSettingsModalOpen: boolean`.
* **Estado de Memoria (Persistente en VantaDB):**
  - La lista de proyectos, hilos de turnos, manifiestos de Sub-Egos y registros de auditoría nunca se guardan en el estado de React; siempre se consultan y sincronizan vía IPC tipado con `NativeVantaDB`.
