import { describe, it, expect } from 'vitest';
import { IntentClassifier } from '../src/IntentClassifier.js';

describe('IntentClassifier (DEC-02, COUC-03)', () => {
  const classifier = new IntentClassifier();

  it('debe clasificar correctamente una intención de ingeniería de software con herramientas de disco y git', () => {
    const result = classifier.classify({
      prompt: 'Revisa el archivo src/main.ts y haz git commit con los cambios',
      projectId: 'proj-alpha',
      workspacePath: 'C:/repos/test'
    });

    expect(result.primaryDomain).toBe('engineering');
    expect(result.suggestedTools).toContain('fs_read_file');
    expect(result.suggestedTools).toContain('fs_write_file');
    expect(result.suggestedTools).toContain('git_status');
    expect(result.suggestedTools).toContain('git_diff');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.intentDigest).toHaveLength(64);
    expect(result.entities.some(e => e.type === 'file' && e.value === 'src/main.ts')).toBe(true);
    expect(result.entities.some(e => e.type === 'git_command')).toBe(true);
  });

  it('debe clasificar correctamente una intención de búsqueda de conocimiento', () => {
    const result = classifier.classify({
      prompt: 'Buscar en la memoria los documentos sobre arquitectura de red',
      projectId: 'proj-alpha'
    });

    expect(result.primaryDomain).toBe('knowledge');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('debe marcar requiresApproval cuando el prompt incluye comandos destructivos', () => {
    const result = classifier.classify({
      prompt: 'Eliminar y borrar los archivos temporales con rm -rf',
      projectId: 'proj-alpha',
      workspacePath: 'C:/repos/test'
    });

    expect(result.requiresApproval).toBe(true);
  });

  it('debe detectar precondiciones no satisfechas si falta workspacePath para herramientas de disco', () => {
    const result = classifier.classify({
      prompt: 'Modifica el archivo config.json',
      projectId: 'proj-alpha'
      // sin workspacePath
    });

    const wsPrecondition = result.preconditions.find(p => p.name === 'workspace_available');
    expect(wsPrecondition).toBeDefined();
    expect(wsPrecondition?.satisfied).toBe(false);
  });

  it('debe generar el mismo intentDigest para la misma intención normalizada (idempotencia COUC-03)', () => {
    const result1 = classifier.classify({
      prompt: '  Hacer build de la app  ',
      projectId: 'proj-1',
      activeSubEgoId: 'ego.nucleus'
    });

    const result2 = classifier.classify({
      prompt: 'hacer build de la app',
      projectId: 'proj-1',
      activeSubEgoId: 'ego.nucleus'
    });

    expect(result1.intentDigest).toBe(result2.intentDigest);
  });
});
