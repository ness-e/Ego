import { describe, it, expect } from 'vitest';
import { SubEgoSelector } from '../src/SubEgoSelector.js';
import { type SubEgoManifest } from '@ego/subegos';
import { type ClassifiedIntent } from '../src/schemas/intent.js';

describe('SubEgoSelector (DEC-05)', () => {
  const selector = new SubEgoSelector();

  const mockDevSubEgo: SubEgoManifest = {
    id: 'ego.dev',
    name: 'Dev Specialist',
    role: 'Software Engineer',
    description: 'Especialista en código, terminal y git',
    systemPrompt: 'Eres un ingeniero de software senior.',
    responsibilities: ['Escribir código'],
    capabilities: ['fs', 'git', 'terminal'],
    tools: ['fs', 'git', 'terminal'],
    permissions: [],
    namespaces: { read: [], write: [] },
    behavior: { tone: 'analytical', proactivity: 'moderate', verbosity: 'balanced' },
    autonomy: 'supervised',
    budget: { maxTokensPerCall: 4000, maxDailyCostUsd: 2.0, requiresApprovalAboveUsd: 0.5 },
    trigger: 'manual',
    state: 'active',
    creator: 'user',
    createdAtMs: Date.now(),
    updatedAtMs: Date.now()
  };

  const mockResearchSubEgo: SubEgoManifest = {
    id: 'ego.research',
    name: 'Research Specialist',
    role: 'Knowledge Researcher',
    description: 'Especialista en búsqueda de información y síntesis',
    systemPrompt: 'Eres un investigador analítico.',
    responsibilities: ['Buscar documentos'],
    capabilities: ['knowledge', 'search'],
    tools: [],
    permissions: [],
    namespaces: { read: [], write: [] },
    behavior: { tone: 'analytical', proactivity: 'moderate', verbosity: 'balanced' },
    autonomy: 'supervised',
    budget: { maxTokensPerCall: 4000, maxDailyCostUsd: 2.0, requiresApprovalAboveUsd: 0.5 },
    trigger: 'manual',
    state: 'active',
    creator: 'user',
    createdAtMs: Date.now(),
    updatedAtMs: Date.now()
  };

  const mockPausedSubEgo: SubEgoManifest = {
    ...mockDevSubEgo,
    id: 'ego.dev.paused',
    state: 'paused'
  };

  it('selecciona ego.dev para intenciones de ingeniería con herramientas fs y git', () => {
    const intent: ClassifiedIntent = {
      intentId: '123e4567-e89b-12d3-a456-426614174000',
      intentDigest: 'a'.repeat(64),
      primaryDomain: 'engineering',
      secondaryDomains: [],
      urgency: 'normal',
      confidence: 0.95,
      entities: [],
      suggestedTools: ['fs', 'git'],
      preconditions: [],
      requiresApproval: false
    };

    const result = selector.select(intent, [mockDevSubEgo, mockResearchSubEgo]);
    expect(result.selectedSubEgoId).toBe('ego.dev');
    expect(result.affinityScore).toBeGreaterThanOrEqual(0.70);
    expect(result.allowedTools).toEqual(['fs', 'git']);
  });

  it('ignora Sub-Egos pausados o inactivos', () => {
    const intent: ClassifiedIntent = {
      intentId: '123e4567-e89b-12d3-a456-426614174000',
      intentDigest: 'a'.repeat(64),
      primaryDomain: 'engineering',
      secondaryDomains: [],
      urgency: 'normal',
      confidence: 0.95,
      entities: [],
      suggestedTools: ['fs'],
      preconditions: [],
      requiresApproval: false
    };

    const result = selector.select(intent, [mockPausedSubEgo]);
    // Debe caer a ego.nucleus porque el único candidato dev está en paused
    expect(result.selectedSubEgoId).toBe('ego.nucleus');
  });

  it('degrada a ego.nucleus si la afinidad no supera el umbral', () => {
    const intent: ClassifiedIntent = {
      intentId: '123e4567-e89b-12d3-a456-426614174000',
      intentDigest: 'b'.repeat(64),
      primaryDomain: 'crm',
      secondaryDomains: [],
      urgency: 'normal',
      confidence: 0.70,
      entities: [],
      suggestedTools: [],
      preconditions: [],
      requiresApproval: false
    };

    const result = selector.select(intent, [mockDevSubEgo]);
    expect(result.selectedSubEgoId).toBe('ego.nucleus');
  });
});
