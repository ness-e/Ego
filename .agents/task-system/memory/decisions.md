# Decisiones Ego (2026-10-05+)

Registro vivo de decisiones del producto desktop. Historia del motor archivada en `archive/`.
Formato: `Tema | Decisión | ref: ruta:línea`.


### ADR-1547: ADR-048: Arquitectura de Background Tasks, Task Memory desacoplada y Resiliencia con Checkpoints LSM en Ego (2026-10-10)
- **Contexto:** La Fase 07 introduce la ejecución de tareas de larga duración en segundo plano (análisis de código, investigación web, resúmenes, proactividad y dream consolidation). Se requiere desacoplar el estado de estas tareas del hilo conversacional de chat (OCLW-13), permitir checkpoints resilientes que soporten caídas inesperadas del proceso Electron (OCLW-15, MEMG-20), garantizar el respeto al bloqueo de descriptores de archivos LSM de NativeVantaDB in-process (VDB-INC-02) y proveer cancelación cooperativa mediante AbortSignal (DIST-20).
- **Decisión:** 1. Crear el paquete @ego/tasks en packages/tasks/ que albergue BackgroundEngine, TaskMemory, TaskCheckpoint, ResourceScheduler, TaskNotifications, ProactivityEngine y TaskCancellation. 2. Task Memory se aísla en el namespace tasks/<task_id> en VantaDB, independiente de sessions/*. 3. Los checkpoints se graban periódicamente con atomic writes en VantaDB para reanudación post-crash sin duplicar transacciones. 4. Se reutiliza la FSM de atención de Coucou (COUC-06) integrada en AttentionStateMachine compartida entre el Activity Widget y la ventana flotante opcional. 5. Se orquesta la consolidación onírica ('Dream Consolidation' KHOJ-05) durante periodos de inactividad de CPU/EventLoop ejecutada in-process.
- **Consecuencias:** Permite tareas autónomas robustas, recuperación instantánea tras interrupción, control de concurrencia adaptativo basado en límites de memoria y CPU, y observabilidad reactiva en UI sin sobrecargar el hilo principal de renderizado.
