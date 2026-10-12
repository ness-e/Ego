import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskMemory } from '../src/TaskMemory.js';

describe('TaskMemory (TASK-02 / OCLW-13)', () => {
  let mockAdapter: any;
  let taskMemory: TaskMemory;
  const storeMap = new Map<string, unknown>();

  beforeEach(() => {
    storeMap.clear();
    mockAdapter = {
      put: vi.fn(async (item: { namespace: string; key: string; payload: unknown }) => {
        storeMap.set(`${item.namespace}:${item.key}`, item.payload);
      }),
      get: vi.fn(async (ns: string, key: string) => {
        const stored = storeMap.get(`${ns}:${key}`);
        return stored === undefined ? null : { key, payload: stored, metadata: {} };
      }),
    };
    taskMemory = new TaskMemory(mockAdapter);
  });

  it('inicializa la memoria de tarea en namespace aislado', async () => {
    const memory = await taskMemory.initialize(
      'task-100',
      'Indexar repositorio local',
      { repoPath: '/test/repo' },
      'subego-dev'
    );

    expect(memory.taskId).toBe('task-100');
    expect(memory.goal).toBe('Indexar repositorio local');
    expect(memory.subEgoId).toBe('subego-dev');
    expect(mockAdapter.put).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: 'tasks/task-100',
        key: 'state',
        metadata: expect.objectContaining({ type: 'task_memory_snapshot', taskId: 'task-100' }),
      })
    );
  });

  it('anexa hallazgos intermedios sin tocar la sesión del chat', async () => {
    await taskMemory.initialize('task-100', 'Auditar código');
    await taskMemory.appendFinding('task-100', 'Encontradas 3 funciones complejas en parser.ts');
    await taskMemory.appendFinding('task-100', 'Falta validación de tipos en config.json');

    const snapshot = await taskMemory.getSnapshot('task-100');
    expect(snapshot).not.toBeNull();
    expect(snapshot?.intermediateFindings).toHaveLength(2);
    expect(snapshot?.intermediateFindings[0]).toContain('parser.ts');
  });

  it('registra artefactos generados y resumen final', async () => {
    await taskMemory.initialize('task-100', 'Generar reporte');
    await taskMemory.recordArtifact('task-100', {
      id: 'art-1',
      name: 'reporte-final.pdf',
      uri: 'file:///data/reporte-final.pdf',
    });
    await taskMemory.finalizeOutcome('task-100', 'Auditoría completada satisfactoriamente con 0 alertas críticas');

    const snapshot = await taskMemory.getSnapshot('task-100');
    expect(snapshot?.generatedArtifacts).toHaveLength(1);
    expect(snapshot?.generatedArtifacts[0].name).toBe('reporte-final.pdf');
    expect(snapshot?.outcomeSummary).toContain('Auditoría completada');
  });

  it('lanza error al operar sobre memoria de tarea no inicializada', async () => {
    await expect(taskMemory.appendFinding('no-existe', 'hallazgo')).rejects.toThrow(
      'Task memory for no-existe not initialized'
    );
  });
});
