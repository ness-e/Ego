export * from './types.js';
export * from './BackgroundEngine.js';
export * from './BackgroundTaskTools.js';
export * from './TaskMemory.js';
export * from './TaskCheckpoint.js';
export * from './ResourceScheduler.js';
export * from './TaskCancellation.js';
export * from './TaskNotifications.js';
export * from './ProactivityEngine.js';
// El motor de consolidación ("sueño") vive en `@ego/memory` (EgoMemoryLifecycle
// lo dispara en el hook de inactividad). Se re-exporta aquí para no romper la
// API pública de `@ego/tasks`.
export { DreamConsolidator, type DreamConsolidationStats } from '@ego/memory';
export * from './MemoryCurator.js';
export * from './CurationSettings.js';
export * from './WorkerTaskPool.js';
export * from './RunRecorder.js';
export * from './ContextProvider.js';
export * from './MemoryCleanupJob.js';
export * from './WorkerPolicy.js';

