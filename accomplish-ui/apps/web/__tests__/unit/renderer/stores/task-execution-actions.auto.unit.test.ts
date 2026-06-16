/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Task } from '@accomplish_ai/agent-core/common';
import type { TaskState } from '@/stores/taskStore';

const mockAccomplish = vi.hoisted(() => ({
  getProviderSettings: vi.fn(),
  setActiveProvider: vi.fn(),
  updateProviderModel: vi.fn(),
  startTask: vi.fn(),
  logEvent: vi.fn(),
  analytics: {
    trackSubmitTask: vi.fn(),
  },
}));

vi.mock('@/lib/accomplish', () => ({
  getAccomplish: () => mockAccomplish,
}));

vi.mock('@/lib/auto-model', () => ({
  isAutoMode: () => true,
  resolveAutoModel: vi.fn(),
}));

import { createTaskExecutionActions } from '@/stores/task-execution-actions';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task_test',
    prompt: 'hello',
    status: 'running',
    messages: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  } as Task;
}

function createStateHarness() {
  let state = {
    _taskStateToken: 1,
    tasks: [],
    currentTask: null,
    isLoading: false,
    error: null,
  } as unknown as TaskState;

  const set = vi.fn((partial: Partial<TaskState> | ((state: TaskState) => Partial<TaskState>)) => {
    state = {
      ...state,
      ...(typeof partial === 'function' ? partial(state) : partial),
    };
  });

  return {
    set,
    get: () => state,
    state: () => state,
  };
}

describe('task execution auto model routing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockAccomplish.getProviderSettings.mockReturnValue(new Promise(() => {}));
    mockAccomplish.startTask.mockResolvedValue(createTask());
    mockAccomplish.logEvent.mockResolvedValue(undefined);
    mockAccomplish.analytics.trackSubmitTask.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not leave startTask stuck when Auto routing hangs', async () => {
    const harness = createStateHarness();
    const actions = createTaskExecutionActions(harness.set, harness.get);

    const startPromise = actions.startTask({ prompt: 'hello' });

    await vi.advanceTimersByTimeAsync(2500);
    const task = await startPromise;

    expect(mockAccomplish.startTask).toHaveBeenCalledWith({ prompt: 'hello' });
    expect(task?.id).toBe('task_test');
    expect(harness.state().currentTask?.id).toBe('task_test');
    expect(harness.state().isLoading).toBe(false);
    expect(mockAccomplish.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warn',
        message: 'UI auto model routing skipped',
      }),
    );
  });
});
