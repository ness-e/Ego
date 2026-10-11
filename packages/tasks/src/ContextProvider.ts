import * as os from "node:os";

export interface AmbientSystemContext {
  timestamp: number;
  platform: "win32" | "darwin" | "linux" | "unknown";
  activeApp?: string;
  windowTitle?: string;
  activeUrl?: string;
  selectedText?: string;
  source: "native" | "mock" | "fallback";
}

export interface ContextCaptureStrategy {
  capture(): Promise<Partial<AmbientSystemContext>>;
}

/**
 * ContextProvider - Capturador desacoplado de contexto ambiental (Patrón Coucou COUC-16 / WindowContextCapture).
 *
 * Captura la aplicación activa, título de ventana o selección de texto en el borde del SO
 * para enriquecer la intencionalidad y contexto al iniciar tareas o turnos en Ego.
 * Diseñado con estrategia inyectable y fallback no intrusivo anti-fallos.
 */
export class ContextProvider {
  private strategy?: ContextCaptureStrategy;

  constructor(strategy?: ContextCaptureStrategy) {
    this.strategy = strategy;
  }

  public setStrategy(strategy: ContextCaptureStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Captura el contexto ambiental del sistema.
   * Si la estrategia inyectada falla o no está presente, retorna un contexto seguro fallback.
   */
  public async captureContext(): Promise<AmbientSystemContext> {
    const rawPlatform = os.platform();
    const platform: AmbientSystemContext["platform"] =
      rawPlatform === "win32" || rawPlatform === "darwin" || rawPlatform === "linux"
        ? rawPlatform
        : "unknown";

    if (!this.strategy) {
      return {
        timestamp: Date.now(),
        platform,
        source: "fallback",
      };
    }

    try {
      const captured = await this.strategy.capture();
      return {
        timestamp: captured.timestamp ?? Date.now(),
        platform: captured.platform ?? platform,
        activeApp: captured.activeApp,
        windowTitle: captured.windowTitle,
        activeUrl: captured.activeUrl,
        selectedText: captured.selectedText,
        source: captured.source ?? "native",
      };
    } catch {
      // Degradar pacíficamente sin propagar excepciones que bloqueen el inicio de la tarea
      return {
        timestamp: Date.now(),
        platform,
        source: "fallback",
      };
    }
  }

  /**
   * Estrategia Mock para tests unitarios y entornos de desarrollo/headless.
   */
  public static createMockStrategy(mockData: Partial<AmbientSystemContext>): ContextCaptureStrategy {
    return {
      capture: async () => ({
        ...mockData,
        source: "mock",
      }),
    };
  }
}
