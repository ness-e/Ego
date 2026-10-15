import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FloatingWindow } from '../src/windows/FloatingWindowView.js';
import { FloatingWindowManager } from '../src/windows/FloatingWindow.js';
import { BrowserWindow, screen } from 'electron';

vi.mock('electron', () => {
  const mockWin = {
    showInactive: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    isDestroyed: vi.fn(() => false),
    setIgnoreMouseEvents: vi.fn(),
    getSize: vi.fn(() => [180, 180]),
    setPosition: vi.fn(),
    loadURL: vi.fn(async () => undefined),
    loadFile: vi.fn(async () => undefined),
    webContents: {
      send: vi.fn(),
      on: vi.fn(),
      setWindowOpenHandler: vi.fn(() => ({ action: "deny" as const })),
    },
  };

  return {
    BrowserWindow: vi.fn(() => mockWin),
    screen: {
      getPrimaryDisplay: vi.fn(() => ({
        workAreaSize: { width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      })),
      getDisplayNearestPoint: vi.fn(() => ({
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      })),
      getCursorScreenPoint: vi.fn(() => ({ x: 500, y: 500 })),
    },
  };
});

describe('FloatingWindow & Manager (WIDG-01 / WIDG-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FloatingWindow (WIDG-01)', () => {
    it('crea BrowserWindow frameless, transparente y alwaysOnTop', () => {
      const prototype = new FloatingWindow({
        width: 160,
        height: 160,
        transparent: true,
        alwaysOnTop: true,
      });

      const win = prototype.createWindow();
      expect(win).toBeDefined();
      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 160,
          height: 160,
          frame: false,
          transparent: true,
          alwaysOnTop: true,
          focusable: false,
        })
      );
    });

    it('alterna el modo click-through pasando eventos al escritorio', () => {
      const prototype = new FloatingWindow();
      const win = prototype.createWindow();

      prototype.setClickThrough(true);
      expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
      expect(prototype.isWindowInteractive()).toBe(false);

      prototype.setClickThrough(false);
      expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
      expect(prototype.isWindowInteractive()).toBe(true);
    });

    it('reposiciona la ventana respetando el área de trabajo del monitor más cercano', () => {
      const prototype = new FloatingWindow({ width: 180, height: 180 });
      const win = prototype.createWindow();

      prototype.repositionToDisplay({ x: 100, y: 100 });
      expect(screen.getDisplayNearestPoint).toHaveBeenCalledWith({ x: 100, y: 100 });
      expect(win.setPosition).toHaveBeenCalled();
    });

    it('endurece webPreferences con sandbox:true + preload (F5T10/H26)', () => {
      const prototype = new FloatingWindow({ width: 160, height: 160 });
      prototype.createWindow();
      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          webPreferences: expect.objectContaining({
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: expect.any(String),
          }),
        })
      );
    });
  });

  describe('FloatingWindowManager (WIDG-02)', () => {
    it('controla visibilidad y sincronización de estados', () => {
      const manager = new FloatingWindowManager();
      manager.show();

      expect(manager.getState().visible).toBe(true);

      manager.updateState({
        attentionState: 'compact',
        activeSubEgoId: 'ego.nucleus',
      });

      const state = manager.getState();
      expect(state.attentionState).toBe('compact');
      expect(state.activeSubEgoId).toBe('ego.nucleus');

      manager.hide();
      expect(manager.getState().visible).toBe(false);
    });

    it('habilita interacción con el cursor cuando la atención requiere aprobación HITL', () => {
      const manager = new FloatingWindowManager();
      manager.show();

      manager.updateState({ attentionState: 'hitl_approval' });
      const prototypeWindow = (manager as any).prototype.getWindow();
      expect(prototypeWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
    });
  });
});
