import { describe, it, expect, vi } from 'vitest';
import { JevProvider } from '../src/providers/JevProvider.js';

describe('JevProvider (DEC-04 - TypeSafe AI System One)', () => {
  it('se declara no disponible si no se proporciona API key', () => {
    const provider = new JevProvider({ apiKey: undefined });
    expect(provider.isAvailable()).toBe(false);
  });

  it('retorna null inmediatamente sin llamar a la red si no está disponible', async () => {
    const customFetch = vi.fn();
    const provider = new JevProvider({ apiKey: undefined, customFetch: customFetch as unknown as typeof fetch });

    const result = await provider.evaluate({
      prompt: 'Hacer commit de cambios',
      options: ['engineering', 'knowledge']
    });

    expect(result).toBeNull();
    expect(customFetch).not.toHaveBeenCalled();
  });

  it('procesa correctamente una respuesta 200 de evaluación paralela', async () => {
    const mockResponse = {
      chosen: 'engineering',
      confidence: 0.94,
      scores: {
        engineering: 0.94,
        knowledge: 0.06
      }
    };

    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const provider = new JevProvider({
      apiKey: 'test-jev-key-123',
      customFetch: customFetch as unknown as typeof fetch
    });

    expect(provider.isAvailable()).toBe(true);

    const result = await provider.evaluate({
      prompt: 'Hacer commit de cambios en git',
      options: ['engineering', 'knowledge']
    });

    expect(result).not.toBeNull();
    expect(result?.chosenOption).toBe('engineering');
    expect(result?.confidence).toBe(0.94);
    expect(customFetch).toHaveBeenCalledTimes(1);
  });

  it('degrada a null limpiamente si el endpoint responde con error 500 o timeout', async () => {
    const customFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503
    });

    const provider = new JevProvider({
      apiKey: 'test-jev-key-123',
      customFetch: customFetch as unknown as typeof fetch
    });

    const result = await provider.evaluate({
      prompt: 'Buscar datos',
      options: ['engineering', 'knowledge']
    });

    expect(result).toBeNull();
  });
});
