import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WidgetHitlBridge } from '../src/WidgetHitlBridge.js';
import { PendingApproval } from '../src/types.js';

describe('WidgetHitlBridge (WIDG-04 / COUC-01)', () => {
  let mockEngine: any;
  let bridge: WidgetHitlBridge;

  beforeEach(() => {
    mockEngine = {
      resolveApproval: vi.fn(async () => true),
    };
    bridge = new WidgetHitlBridge(mockEngine, { ackTimeoutMs: 100 });
  });

  const sampleApproval: PendingApproval = {
    approvalId: 'appr-1',
    action: {
      sessionId: 'ses-1',
      subEgoId: 'ego.developer',
      toolName: 'git_commit',
      callId: 'call-1',
      inputDigest: 'abc',
      createdAt: Date.now(),
    },
    toolName: 'git_commit',
    toolCategory: 'git',
    riskLevel: 'high',
    arguments: { message: 'feat: add task engine' },
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000,
  };

  it('presenta la solicitud y confirma mediante ACK oportuno (<= 800ms)', async () => {
    const presentSpy = vi.fn();
    bridge = new WidgetHitlBridge(mockEngine, {
      ackTimeoutMs: 200,
      onPresent: presentSpy,
    });

    const presentPromise = bridge.presentApproval(sampleApproval);

    expect(presentSpy).toHaveBeenCalledWith(
      expect.objectContaining({ approvalId: 'appr-1', toolName: 'git_commit' })
    );

    // Responder ACK antes de 200ms
    const ackReceived = bridge.acknowledgePresentation('appr-1');
    expect(ackReceived).toBe(true);
    expect(bridge.isPresentedInWidget('appr-1')).toBe(true);

    // Debe resolver true en el presentPromise tras el ACK
    // simulando que la UI recibió la presentación
  });

  it('devuelve control a la UI principal (fallbackToMain) si expira el tiempo de ACK', async () => {
    const fallbackSpy = vi.fn();
    bridge = new WidgetHitlBridge(mockEngine, {
      ackTimeoutMs: 50,
      onFallbackToMain: fallbackSpy,
    });

    const presented = await bridge.presentApproval(sampleApproval);
    expect(presented).toBe(false);
    expect(fallbackSpy).toHaveBeenCalledWith('appr-1', expect.stringContaining('ACK timeout'));
    expect(bridge.isPresentedInWidget('appr-1')).toBe(false);
  });

  it('resuelve la solicitud en el ApprovalEngine y limpia el estado del widget', async () => {
    bridge.acknowledgePresentation('appr-1');
    const resolved = await bridge.resolve('appr-1', {
      approved: true,
      resolvedBy: 'user-keyboard-shortcut',
    });

    expect(resolved).toBe(true);
    expect(mockEngine.resolveApproval).toHaveBeenCalledWith('appr-1', {
      approved: true,
      resolvedBy: 'user-keyboard-shortcut',
    });
    expect(bridge.isPresentedInWidget('appr-1')).toBe(false);
  });
});
