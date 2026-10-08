# Memoria VantaDB — Arquitectura de Integración (VantaDB Integration Architecture)

| Campo | Valor |
| --- | --- |
| Estado | Canónico — fuente vigente de integración VantaDB × Ego |
| Owner | ness-e |
| Fecha | 2026-10-06 |
| VantaDB verificado | 0.8.0 (auditoría de código completa: ~500 archivos Rust/TS, engine + bindings + MCP) |

---

## 1. Role of VantaDB in Ego (Rol de VantaDB en Ego)

> **Decisión Canónica:** VantaDB es el motor de memoria, conocimiento y recuperación local-first desarrollado como proyecto first-party independiente y utilizado por Ego como su principal substrate de Project Memory.
>
> **Ego define los contratos de memoria que necesita como Cognitive OS; VantaDB proporciona implementaciones nativas de esos contratos mediante su motor Rust y sus superficies de interoperabilidad.**

VantaDB **NO** es "la base de datos local de Ego" ni un simple almacén relacional/vectorial. Es la **infraestructura local de memoria, conocimiento y recuperación cognitiva** de Ego.

```
                    EGO (Cognitive OS)
                     │
              Cognitive Runtime
                     │
             Memory Orchestrator
                     │
          ┌──────────┴──────────┐
          │                     │
    NativeVantaDB         Cognitive Bridge
     (Fast Path)             (stdio MCP)
      in-process                  │
          │                  vantadb-mcp
   Fjall / HNSW /                 │
   BM25 / Graph /            vanta-memory
      IQL v4                    (L0-L3)
```

Ego y VantaDB son proyectos independientes pero coordinados del mismo creador:
- **Ego** se enfoca en la intención del usuario, orquestación, Sub-Egos, herramientas, selección de modelos (Model Router), Decision Intelligence, Workspace y gobernanza.
- **VantaDB** se enfoca en persistencia soberana, recuperación híbrida (RRF/MMR), grafos de relaciones, compresión de contexto, consolidación de memoria (dreams), puntos de control de tareas y embeddings locales.

---

## 2. Memory Abstraction (Abstracción de Memoria y Memory Orchestrator)

Ego no se acopla directamente a los detalles internos de VantaDB; la memoria es una capacidad contractual (`EgoMemory`).

El patrón arquitectónico implementado es **Memory Orchestrator**:

```
Ego Memory API (Contrato)
       │
       ▼
Memory Orchestrator (EgoMemoryAdapter)
       │
       ├── Native Store Adapter (NativeVantaDB in-process)
       │
       └── Cognitive Memory Adapter (vantadb-mcp stdio subprocess)
```

### Contrato contractual de EgoMemory

```ts
export interface EgoMemory {
  // Fast Path (In-Process)
  put(record: MemoryInput): Promise<MemoryRecord>;
  putBatch(records: MemoryInput[]): Promise<MemoryRecord[]>;
  get(namespace: string, key: string): Promise<MemoryRecord | null>;
  delete(namespace: string, key: string): Promise<boolean>;
  search(request: EgoSearchRequest): Promise<SearchHit[]>;
  searchMulti(namespaces: string[], query: string, options?: EgoSearchOptions): Promise<SearchHit[]>;
  supersedeFact(oldKey: string, newItem: EgoPut): Promise<void>;
  quarantine(item: EgoPut, reason?: string): Promise<void>;
  promote(quarantineKey: string, targetNamespace?: string, targetKey?: string): Promise<void>;
  graphQuery(queryStr: string): Promise<unknown>;

  // Cognitive Path (vanta-memory vía vantadb-mcp en P0)
  recall(params: RecallParams): Promise<RecallResult>;
  assembleContext(messages: ChatMessage[], budget: number): Promise<AssembledContext>;
  consolidate(sessionKey: string): Promise<ConsolidationReport>;
  reinforce(namespace: string, key: string, outcome: "used" | "corrected"): Promise<void>;
  checkpoint(taskId: string, step: number, state: unknown): Promise<void>;
}
```

Ego interactúa con el `Memory Orchestrator` sin necesidad de saber qué backend físico ejecuta cada llamada.

---

## 3. NativeVantaDB (Fast Path In-Process)

El **Fast Path** atiende las operaciones de alta frecuencia y baja latencia directamente en el hilo del proceso principal de Node.js (Electron main):

* **Binding:** Addon nativo compilado con `napi-rs` (`vantadb-node`) consumido a través del wrapper tipado `NativeVantaDB` de `"vantadb/native"`.
* **Rendimiento:** Ejecución asíncrona sobre el pool de subprocesos Tokio en Rust (`spawn_blocking`), sin bloqueo del event loop de Node ni serialización JSON-RPC.
* **Persistencia:** Motor Fjall LSM con Write-Ahead Logging (WAL) protegido por SHA-256 chain y auto-recuperación CRC32C.
* **Binding correcto vs prohibido:**
  ```ts
  // ✅ CORRECTO — persistencia real en disco (Fjall LSM)
  import { NativeVantaDB } from "vantadb/native";
  const db = await NativeVantaDB.connect(storagePath, { read_only: false });

  // ❌ PROHIBIDO — WASM volátil en memoria (sin persistencia en disco)
  import { Client } from "vantadb";
  ```

---

## 4. Cognitive Memory Bridge (Puente de Memoria Cognitiva)

Las capacidades cognitivas superiores de VantaDB se canalizan a través de un puente gestionado:
- En **P0**, opera mediante un subproceso hijo conectado por `stdio` ejecutando el binario `vantadb-mcp`.
- El Cognitive Bridge implementa reconexión automática, aislamiento de errores de subproceso, timeouts gobernados y cola de peticiones con prioridad.
- Las respuestas se normalizan en objetos tipados de TypeScript antes de ser entregadas al Cognitive Runtime.

---

## 5. vanta-memory (Pipeline Cognitivo L0-L3)

`vanta-memory` es el subsistema en Rust puro que implementa la memoria cognitiva multicapa:

* **L0 — Captura en bruto:** Registro de interacciones, mensajes, eventos del sistema y hechos sin procesar.
* **L1 — Extracción y Deduplicación:** Extracción de hechos atómicos, resolución de entidades y detección de duplicados semánticos.
* **L2 — Escenas Episódicas:** Agrupación situacional de hechos por sesión, objetivo o contexto temporal (`scene_*`) con tasa de enfriamiento (*heat decay*).
* **L3 — Persona y Síntesis:** Consolidación de perfil, directivas estables, preferencias del usuario y aprendizaje procedimental.

*Restricción técnica P0:* `vanta-memory` no expone exports directos a Node.js en `vantadb-node 0.7.0 / 0.8.0`. Por tanto, el acceso se realiza mediante `vantadb-mcp`.

---

## 6. MCP Internal Bridge (Puente MCP Interno vs Externo)

Ego distingue formalmente dos naturalezas de uso para el protocolo MCP (Model Context Protocol):

| Categoría | Propósito | Implementación | Alcance |
|---|---|---|---|
| **MCP Interno** | Interoperabilidad entre procesos locales para memoria cognitiva | `vantadb-mcp` (88 tools vía stdio) | Solo P0 (transitorio hacia P1) |
| **MCP Externo** | Conexión con servicios, SaaS y herramientas externas | Servidores MCP oficiales (GitHub) y comunitarios | Permanente (Nivel B de integración) |
| **Ego MCP Server** | Exposición soberana del contexto del Proyecto Vivo | Servidor stdio local expuesto a IDEs externos | Permanente |

Esta separación previene ambigüedades arquitectónicas: el uso de MCP para VantaDB es un detalle de transporte interno, no una integración de terceros.

---

## 7. Memory Operation Routing (Enrutamiento de Operaciones de Memoria)

El `Memory Orchestrator` distribuye cada operación de acuerdo con su perfil:

```
Operación                          Destino            Mecanismo
──────────────────────────────────────────────────────────────────
put / putBatch                     NativeVantaDB      Fast Path (in-process)
get / delete / list                NativeVantaDB      Fast Path (in-process)
search (BM25 léxico puro)         NativeVantaDB      Fast Path (<2ms, query_vector=[])
searchMulti (federada BM25)       NativeVantaDB      Fast Path (Promise.all paralelo)
supersedeFact                      NativeVantaDB      Fast Path (ADR-028, inmutable)
quarantine / promote               NativeVantaDB      Fast Path (ADR-046)
graphQuery (IQL)                   NativeVantaDB      Fast Path
──────────────────────────────────────────────────────────────────
memory_recall (scopes)             vantadb-mcp        Cognitive Path (stdio)
context_assemble (compresión)      vantadb-mcp        Cognitive Path (stdio)
dream_consolidate (inactividad)    vantadb-mcp        Cognitive Path (stdio)
task_checkpoint (MEMG-20)          vantadb-mcp        Cognitive Path (stdio)
memory_reinforce (+0.05/-0.10)     vantadb-mcp        Cognitive Path (stdio)
code_* (inteligencia de código)    vantadb-mcp        Cognitive Path (stdio)
temporal_resolve (español→ms)      vantadb-mcp        Cognitive Path (stdio)
```

---

## 8. Embeddings y Estrategia de Vectorización (Auto-Embed ONNX)

* **Capacidad Arquitectónica de VantaDB:** VantaDB posee capacidad nativa de embeddings locales mediante ONNX Runtime (`multilingual-e5-small`, 384 dimensiones, ~220 MB en disco) en su subsistema cognitivo `vanta-memory` y en el subproceso `vantadb-mcp`.
* **Realidad del Fast-Path In-Process (`NativeVantaDB` en Ego P0):** La ruta NAPI-RS in-process utilizada por Ego (`Embedded::put_one`) opera actualmente optimizada para persistencia inmediata de ultrabaja latencia (<2ms) y búsqueda léxica BM25 pura (`query_vector: []`), prescindiendo de dependencias dinámicas pesadas de ONNX Runtime en el proceso principal de Electron (ver `docs/VANTADB-FEEDBACK-Y-MEJORAS.md` §VDB-INC-01).
* **Consumo de Inferencia Semántica:** Cuando Ego requiere indexación vectorial densa o auto-embedding de hechos, la operación se canaliza a través del Cognitive Path (`vantadb-mcp`). Ego no debe asumir auto-embedding transparente en `put()` del fast-path in-process hasta que la feature `embed-on-put` esté disponible en los binarios NAPI-RS y respaldada por tests de contrato.
* **Prohibición estricta:** **Queda terminantemente prohibido calcular o inferir embeddings en TypeScript dentro de Ego.** Toda la inferencia vectorial es patrimonio exclusivo del ecosistema nativo de VantaDB.

---

## 9. Graph / GraphRAG (Grafo de Conocimiento y Recuperación)

* **Modelo de Grafo:** Nodos (`insertNode`, `getNode`) y aristas dirigidas tipadas (`addEdge`, `removeEdge`) integrados en el motor principal.
* **Algoritmos nativos:** Recorridos BFS, DFS, ordenamiento topológico, verificación acíclica (`graphIsDag`) y cálculo de grado.
* **Identificadores de nodo (`node_id`):** En Rust son enteros `u128`. En JavaScript y TypeScript se tratan **obligatoriamente como `string`** para evitar truncamiento por encima de `Number.MAX_SAFE_INTEGER`.
* **Pipeline GraphRAG:** Expansión semántica `seed → expand → weight → generate context`. (Evolución prioritaria `DIST-15` en VantaDB para exponerlo en el SDK de Node).
* **Estado de Integración:** `SPECIFIED`. Ego interactúa con el grafo básico NAPI-RS; el pipeline GraphRAG completo es una capacidad cognitiva de VantaDB disponible a través del Cognitive Path (`vantadb-mcp`).

---

## 10. Context Engine (Compresión y Ensamblado de Contexto)

Ego no construye su propio algoritmo heurístico de poda de tokens en TypeScript; consume el **Context Engine** de VantaDB:
- **Ensamblado determinista:** Herramienta `context_assemble` que comprime el historial y la memoria bajo un presupuesto estricto de tokens.
- **Poda multinivel:** Nivel 1 (resumen ejecutivo), Nivel 2 (hechos clave y decisiones), Nivel 3 (mensajes crudos recientes).
- **Mecanismo Spill-to-Disk:** Si la carga contextual excede la memoria disponible, pagina segmentos históricos a disco sin perder coherencia.

---

## 11. Dream Consolidation (Consolidación Onírica en Inactividad)

* **Estado de Integración:** `SPECIFIED`. En Ego P0 `EgoMemoryLifecycle` gestiona localmente los temporizadores de inactividad y el auto-refuerzo Hebbiano de llaves (`pendingReinforcements`); la síntesis profunda de escenas L1-L3 reside en el Cognitive Path (`vantadb-mcp`).

Durante los periodos de inactividad del usuario o entre sesiones:
- El Cognitive Runtime invoca `dream_consolidate` a través del Cognitive Bridge.
- VantaDB ejecuta en segundo plano:
  1. Deduplicación semántica de hechos redundantes.
  2. Detección y resolución de contradicciones causales.
  3. Enfriamiento de memorias episódicas transitorias.
  4. Promoción de patrones recurrentes a directivas estables de Sub-Ego (L3).

---

## 12. Task Checkpoints (Puntos de Control de Tareas Resilientes)

Para la ejecución de tareas complejas en segundo plano y recuperación tras reinicios:
- El Execution Manager de Ego emite checkpoints periódicos mediante `task_checkpoint` (patrón `MEMG-20`).
- Si la aplicación de escritorio se cierra abruptamente, al reabrirse Ego restaura el estado exacto de la tarea, variables de entorno y pasos completados desde VantaDB.

---

## 13. Persistence / Recovery (Fjall LSM, WAL y Recuperación)

* **Almacenamiento:** Estructura basada en LSM-Tree (Fjall) con segmentos inmutables y compactación en segundo plano.
* **Durabilidad:** Registro Write-Ahead Log (WAL) con comprobación criptográfica SHA-256 por bloque y fsync configurable.
* **Cierre ordenado:** El método `close()` activa la barrera de durabilidad `OpGate`, esperando que todas las operaciones en vuelo finalicen antes de cerrar los descriptores de archivo.

---

## 14. Security / Encryption (Cifrado y Purga Criptográfica)

* **Cifrado en reposo:** Compatible con cifrado de página AES-256-GCM.
* **Purga criptográfica (VER-02):** Destrucción verificable de claves y datos sensibles en cumplimiento de políticas de privacidad.
* **Aislamiento de credenciales:** Las claves de API y secretos **NUNCA se almacenan en VantaDB**, sino exclusivamente en el Keychain nativo del sistema operativo gestionado por el Credential Manager.

---

## 15. Export / Import (Snapshots .vdbdump y Portabilidad)

* **Formato:** Archivos `.vdbdump` con cabecera `VDBJSON\n` conteniendo registros estructurados, metadatos y vectores.
* **Operaciones:** Rutinas `export_all` y `bulk_import` locales sin requerir servicios externos, permitiendo backups manuales o programados dentro de la carpeta `userData` del usuario.

---

## 16. Version Compatibility & Governance (Compatibilidad y Gobernanza)

* **Namespaces Gobernados:** Estructura canónica definida en `ego.namespaces.json` v2.
* **Metadatos obligatorios en cada hecho:** `org_id`, `source`, `ts`, `agent_id`, `confidence`, `state`.
* **Cuarentena (ADR-046):** Namespace `quarantine/pending` con TTL de 14 días para datos no verificados.
* **Sustitución (ADR-028):** Reemplazo suave (*soft-replace*) con versionado histórico y aristas `SUPERSEDED_BY`.
* **Prohibiciones de infraestructura:**
  - `vanta-proxy` está **FROZEN** (diseñado para interceptar CLIs externas, no aplica a Ego).
  - `vantadb-server` está **PROHIBIDO** en desktop (se usa exclusivamente modo embebido in-process).

---

## 17. Future Direct vanta-memory Binding (Evolución P0 → P1 → P2)

La arquitectura de integración sigue una hoja de ruta evolutiva planificada:

```
┌─────────────────────────────────────────────────────────────────┐
│ P0: ARQUITECTURA HÍBRIDA (ESTABLE / ACTUAL)                     │
│                                                                 │
│ Electron Main Process                                           │
│  ├── NativeVantaDB (in-process vía napi-rs) → Fast Path         │
│  └── vantadb-mcp (subprocess stdio)        → Cognitive Path     │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ P1: FACHADA COGNITIVA UNIFICADA IN-PROCESS                      │
│                                                                 │
│ VantaDB expone una fachada de alto nivel en vantadb-node:       │
│  ├── Fast Path + Cognitive Path integrados en NativeVantaDB     │
│  ├── Eliminación del subproceso stdio interno                   │
│  └── vantadb-mcp queda exclusivamente como servidor externo      │
│      para herramientas como Cursor, Claude Desktop o VS Code    │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ P2+: SUSTRATO MULTI-SUPERFICIE SOBERANO                         │
│                                                                 │
│ Motor Rust universal con tres superficies desacopladas:         │
│  ├── 1. Native API (Node/Electron vía napi-rs)                  │
│  ├── 2. MCP API (interoperabilidad abierta de herramientas)     │
│  └── 3. Rust Crate API (consumo embebido directo para alto      │
│         rendimiento en herramientas de sistema)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Matriz de Responsabilidades (Ego vs VantaDB)

| Responsabilidad | Ego | VantaDB |
|---|:---:|:---:|
| Intención de producto y orquestación | **Sí** | No |
| Coordinación y ciclo de vida de Sub-Egos | **Sí** | No |
| Enrutamiento de modelos (Model Router) | **Sí** | No |
| Registro y ejecución de herramientas (Tool Registry) | **Sí** | No |
| Gobernanza, permisos y aprobaciones (HITL) | **Sí** | Infraestructura parcial |
| Definición del contrato de memoria (`EgoMemory`) | **Sí** | No |
| Almacenamiento persistente local-first | Consume | **Implementa** |
| Búsqueda híbrida (BM25 + HNSW + RRF) | Consume | **Implementa** |
| Grafo de conocimiento y topología | Consume | **Implementa** |
| GraphRAG (recuperación relacional) | Consume | **Implementa** |
| Compresión y ensamblado de contexto | Consume | **Implementa** |
| Consolidación onírica (*dreaming*) | Consume | **Implementa** |
| Puntos de control de tareas (*checkpoints*) | Consume | **Implementa** |
| Embeddings locales autónomos (ONNX) | Consume | **Implementa** |
| Resolución temporal en lenguaje natural | Consume | **Implementa** |
| Inteligencia de dependencias de código | Consume | **Implementa** |
| Dynamic Workspace y renderizado de Canvas | **Sí** | No |
| Experiencia de usuario (Chat, Shell, Mascota) | **Sí** | No |
| Integraciones externas (GitHub, REST, etc.) | **Sí** | No |
