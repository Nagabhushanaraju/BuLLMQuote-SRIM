import {
  createMessageId,
  type TaskConfig,
  type Task,
  type TaskStatus,
  type FileAttachmentInfo,
} from '@accomplish_ai/agent-core/common';
import { getAccomplish } from '../lib/accomplish';
import { isAutoMode, resolveAutoModel } from '../lib/auto-model';
import type { TaskState } from './taskStore';
import { hasTaskStateToken } from './task-state-helpers';
import { createTaskPermissionActions } from './task-permission-actions';
import { createTaskUpdateActions } from './task-update-actions';
import { createTaskLifecycleActions } from './task-lifecycle-actions';

type SetFn = (partial: Partial<TaskState> | ((state: TaskState) => Partial<TaskState>)) => void;
type GetFn = () => TaskState;

const AUTO_ROUTE_TIMEOUT_MS = 2500;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

/** Task execution slice: startTask, sendFollowUp, permission handling. */
export function createTaskExecutionActions(set: SetFn, get: GetFn) {
  return {
    startTask: async (config: TaskConfig): Promise<Task | null> => {
      const accomplish = getAccomplish();
      const taskStateToken = get()._taskStateToken;
      set({ isLoading: true, error: null });
      try {
        // "Auto" model mode is best-effort. It must never block task:start, because
        // the user needs clear feedback that their request actually left the input.
        if (isAutoMode()) {
          try {
            const settings = await withTimeout(
              accomplish.getProviderSettings(),
              AUTO_ROUTE_TIMEOUT_MS,
              'Auto model routing timed out',
            );
            const pick = resolveAutoModel(config.prompt ?? '', settings);
            if (pick) {
              await withTimeout(
                accomplish.setActiveProvider(
                  pick.providerId as Parameters<typeof accomplish.setActiveProvider>[0],
                ),
                AUTO_ROUTE_TIMEOUT_MS,
                'Auto provider switch timed out',
              );
              await withTimeout(
                accomplish.updateProviderModel(
                  pick.providerId as Parameters<typeof accomplish.updateProviderModel>[0],
                  pick.modelId,
                ),
                AUTO_ROUTE_TIMEOUT_MS,
                'Auto model update timed out',
              );
            }
          } catch (autoError) {
            void accomplish.logEvent({
              level: 'warn',
              message: 'UI auto model routing skipped',
              context: {
                error: autoError instanceof Error ? autoError.message : String(autoError),
              },
            });
          }
        }

        void accomplish.logEvent({
          level: 'info',
          message: 'UI start task',
          context: { prompt: config.prompt, taskId: config.taskId, files: config.files?.length },
        });
        // Analytics: track task submission from UI
        accomplish.analytics?.trackSubmitTask().catch(() => {});
        const task = await accomplish.startTask(config);
        const currentState = get();
        if (!hasTaskStateToken(currentState, taskStateToken)) {
          return null;
        }
        const currentTasks = currentState.tasks;
        set({
          currentTask: task,
          tasks: [task, ...currentTasks.filter((t) => t.id !== task.id)],
          isLoading: task.status === 'queued',
        });
        void accomplish.logEvent({
          level: 'info',
          message: task.status === 'queued' ? 'UI task queued' : 'UI task started',
          context: { taskId: task.id, status: task.status },
        });
        return task;
      } catch (err) {
        if (!hasTaskStateToken(get(), taskStateToken)) {
          return null;
        }
        set({
          error: err instanceof Error ? err.message : 'Failed to start task',
          isLoading: false,
        });
        void accomplish.logEvent({
          level: 'error',
          message: 'UI task start failed',
          context: { error: err instanceof Error ? err.message : String(err) },
        });
        return null;
      }
    },

    sendFollowUp: async (message: string, attachments?: FileAttachmentInfo[]): Promise<boolean> => {
      const accomplish = getAccomplish();
      const { currentTask, startTask } = get();
      const taskStateToken = get()._taskStateToken;
      if (!currentTask) {
        set({ error: 'No active task to continue' });
        void accomplish.logEvent({ level: 'warn', message: 'UI follow-up failed: no active task' });
        return false;
      }
      const sessionId = currentTask.result?.sessionId || currentTask.sessionId;
      if (!sessionId && currentTask.status === 'interrupted') {
        void accomplish.logEvent({
          level: 'info',
          message: 'UI follow-up: starting fresh task (no session from interrupted task)',
          context: { taskId: currentTask.id },
        });
        const newTask = await startTask({ prompt: message, files: attachments });
        return newTask !== null;
      }
      if (!sessionId) {
        set({ error: 'No session to continue - please start a new task' });
        void accomplish.logEvent({
          level: 'warn',
          message: 'UI follow-up failed: missing session',
          context: { taskId: currentTask.id },
        });
        return false;
      }
      const userMessage = {
        id: createMessageId(),
        type: 'user' as const,
        content: message,
        timestamp: new Date().toISOString(),
        attachments: attachments
          ? attachments.map((a) => ({ type: 'json' as const, data: 'placeholder', label: a.name }))
          : undefined,
      };
      const taskId = currentTask.id;
      set((state) => ({
        isLoading: true,
        error: null,
        currentTask: state.currentTask
          ? {
              ...state.currentTask,
              status: 'running',
              result: undefined,
              messages: [...state.currentTask.messages, userMessage],
            }
          : null,
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, status: 'running' as TaskStatus } : t,
        ),
      }));
      try {
        void accomplish.logEvent({
          level: 'info',
          message: 'UI follow-up sent',
          context: { taskId: currentTask.id, message, attachments: attachments?.length },
        });
        const task = await accomplish.resumeSession(
          sessionId,
          message,
          currentTask.id,
          attachments,
        );
        if (!hasTaskStateToken(get(), taskStateToken)) {
          return false;
        }
        set((state) => ({
          currentTask: state.currentTask ? { ...state.currentTask, status: task.status } : null,
          isLoading: task.status === 'queued',
          tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status: task.status } : t)),
        }));
        return true;
      } catch (err) {
        if (!hasTaskStateToken(get(), taskStateToken)) {
          return false;
        }
        set((state) => ({
          error: err instanceof Error ? err.message : 'Failed to send message',
          isLoading: false,
          currentTask: state.currentTask ? { ...state.currentTask, status: 'failed' } : null,
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, status: 'failed' as TaskStatus } : t,
          ),
        }));
        void accomplish.logEvent({
          level: 'error',
          message: 'UI follow-up failed',
          context: {
            taskId: currentTask.id,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        return false;
      }
    },

    ...createTaskLifecycleActions(set, get),
    ...createTaskPermissionActions(set, get),
    ...createTaskUpdateActions(set, get),
  };
}
