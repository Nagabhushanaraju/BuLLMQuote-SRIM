import { describe, expect, it } from 'vitest';
import {
  classifyComplexity,
  classifyTaskIntent,
  resolveAutoModel,
  tierOfModel,
} from '@/lib/auto-model';

const settings = {
  activeProviderId: 'anthropic',
  connectedProviders: {
    anthropic: {
      providerId: 'anthropic',
      connectionStatus: 'connected',
      selectedModelId: 'anthropic/claude-sonnet-4-6',
      availableModels: [
        { id: 'anthropic/claude-haiku-4-5' },
        { id: 'anthropic/claude-sonnet-4-6' },
      ],
    },
    openai: {
      providerId: 'openai',
      connectionStatus: 'connected',
      selectedModelId: 'openai/gpt-4o',
      availableModels: [{ id: 'openai/gpt-4o-mini' }, { id: 'openai/gpt-4o' }],
    },
  },
};

describe('auto model routing', () => {
  it('routes normal chat to a cheap fast model', () => {
    expect(classifyTaskIntent('say hello nicely')).toBe('chat');
    expect(classifyComplexity('say hello nicely')).toBe('simple');
    expect(resolveAutoModel('say hello nicely', settings)).toEqual({
      providerId: 'anthropic',
      modelId: 'anthropic/claude-haiku-4-5',
    });
  });

  it('routes code and research tasks to a stronger model', () => {
    expect(classifyTaskIntent('debug this React component')).toBe('coding');
    expect(classifyTaskIntent('research competitors and summarize findings')).toBe('research');
    expect(resolveAutoModel('debug this React component', settings)).toEqual({
      providerId: 'anthropic',
      modelId: 'anthropic/claude-sonnet-4-6',
    });
  });

  it('falls back gracefully when the wanted tier is unavailable', () => {
    const onlyMid = {
      activeProviderId: 'custom',
      connectedProviders: {
        custom: {
          providerId: 'custom',
          connectionStatus: 'connected',
          selectedModelId: 'custom/workhorse',
          availableModels: [{ id: 'custom/workhorse' }],
        },
      },
    };

    expect(tierOfModel('custom/workhorse')).toBe('mid');
    expect(resolveAutoModel('fix this bug', onlyMid)).toEqual({
      providerId: 'custom',
      modelId: 'custom/workhorse',
    });
  });

  it('leaves the current selection alone when no provider is connected', () => {
    expect(
      resolveAutoModel('hello', {
        activeProviderId: null,
        connectedProviders: {},
      }),
    ).toBeNull();
  });
});
