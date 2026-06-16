/**
 * Channel dispatch table for the browser bridge server.
 * Maps IPC channel names to daemon RPC calls.
 * Settings/provider handlers live in browser-bridge-dispatch-settings.ts.
 */
import { getDaemonClient } from './daemon-bootstrap';
import { createTaskId } from '@accomplish_ai/agent-core/desktop-main';
import type {
  FileAttachmentInfo,
  KnowledgeNoteCreateInput,
  KnowledgeNoteUpdateInput,
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
} from '@accomplish_ai/agent-core/desktop-main';
import * as workspaceManager from './store/workspaceManager';
import { buildSettingsDispatch } from './browser-bridge-dispatch-settings';

type Fn = (args: unknown[]) => Promise<unknown>;
const str = (v: unknown) => v as string;
const strMaybe = (v: unknown) => v as string | undefined;
const bool = (v: unknown) => v as boolean;

export function buildDispatch(): Record<string, Fn> {
  const d = () => getDaemonClient();

  const core: Record<string, Fn> = {
    // ── Tasks ────────────────────────────────────────────────────────────────
    'task:start': async ([config]) => {
      const cfg = config as Record<string, unknown>;
      const taskId = createTaskId();
      return d().call('task.start', {
        prompt: cfg.prompt as string,
        taskId,
        modelId: cfg.modelId as string | undefined,
        workspaceId: (cfg.workspaceId ?? workspaceManager.getActiveWorkspace() ?? undefined) as
          | string
          | undefined,
        workingDirectory: cfg.workingDirectory as string | undefined,
        allowedTools: cfg.allowedTools as string[] | undefined,
        systemPromptAppend: cfg.systemPromptAppend as string | undefined,
        outputSchema: cfg.outputSchema as object | undefined,
        sessionId: cfg.sessionId as string | undefined,
        attachments: cfg.attachments as FileAttachmentInfo[] | undefined,
      });
    },
    'task:list': async () => {
      const activeId = workspaceManager.getActiveWorkspace();
      const activeWorkspace = activeId ? workspaceManager.getWorkspace(activeId) : null;
      const isDefault = !!activeWorkspace?.isDefault;
      const workspaceId = activeId && activeWorkspace ? activeId : undefined;
      return d().call('task.list', { workspaceId, includeUnassigned: isDefault });
    },
    'task:get': async ([taskId]) => d().call('task.get', { taskId: str(taskId) }),
    'task:cancel': async ([taskId]) => d().call('task.cancel', { taskId: str(taskId) }),
    'task:interrupt': async ([taskId]) => d().call('task.interrupt', { taskId: str(taskId) }),
    'task:delete': async ([taskId]) => d().call('task.delete', { taskId: str(taskId) }),
    'task:clear-history': async () => d().call('task.clearHistory'),
    'task:get-todos': async ([taskId]) => d().call('task.getTodos', { taskId: str(taskId) }),
    'session:resume': async ([sessionId, prompt, existingTaskId, attachments]) =>
      d().call('session.resume', {
        sessionId: str(sessionId),
        prompt: str(prompt),
        existingTaskId: strMaybe(existingTaskId),
        workspaceId: workspaceManager.getActiveWorkspace() ?? undefined,
        attachments: attachments as FileAttachmentInfo[] | undefined,
      }),
    'permission:respond': async ([response]) => {
      const r = response as Record<string, unknown>;
      return d().call('permission.respond', {
        requestId: str(r.requestId),
        taskId: str(r.taskId),
        decision: r.decision as 'allow' | 'deny',
        message: strMaybe(r.message),
        selectedOptions: r.selectedOptions as string[] | undefined,
        customText: strMaybe(r.customText),
      });
    },

    // ── Workspaces ────────────────────────────────────────────────────────────
    'workspace:list': async () => workspaceManager.listWorkspaces(),
    'workspace:get-active': async () => workspaceManager.getActiveWorkspace(),
    'workspace:switch': async ([workspaceId]) => {
      const count = await d()
        .call('task.getActiveCount')
        .catch(() => 0);
      if (count > 0) {
        return { success: false, reason: 'Cannot switch workspace while tasks are running' };
      }
      const switched = await workspaceManager.switchWorkspace(str(workspaceId));
      return { success: switched };
    },
    'workspace:create': async ([input]) =>
      workspaceManager.createWorkspace(input as WorkspaceCreateInput),
    'workspace:update': async ([id, input]) =>
      workspaceManager.updateWorkspace(str(id), input as WorkspaceUpdateInput),
    'workspace:delete': async ([id]) => {
      const result = await workspaceManager.deleteWorkspace(str(id));
      return result.deleted;
    },
    'knowledge-notes:list': async ([workspaceId]) =>
      d().call('knowledgeNote.list', { workspaceId: str(workspaceId) }),
    'knowledge-notes:create': async ([input]) =>
      d().call('knowledgeNote.create', { input: input as KnowledgeNoteCreateInput }),
    'knowledge-notes:update': async ([id, workspaceId, input]) =>
      d().call('knowledgeNote.update', {
        noteId: str(id),
        workspaceId: str(workspaceId),
        input: input as KnowledgeNoteUpdateInput,
      }),
    'knowledge-notes:delete': async ([id, workspaceId]) =>
      d().call('knowledgeNote.delete', { noteId: str(id), workspaceId: str(workspaceId) }),

    // ── Connectors ────────────────────────────────────────────────────────────
    'connectors:list': async () => d().call('connectors.list'),
    'connectors:add': async ([name, url]) => {
      const id = `mcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date().toISOString();
      const connector = {
        id,
        name: str(name),
        url: str(url),
        status: 'disconnected' as const,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      };
      await d().call('connectors.upsert', { connector });
      return connector;
    },
    'connectors:delete': async ([id]) => {
      await d().call('connectors.deleteTokens', { connectorId: str(id) });
      await d().call('connectors.delete', { id: str(id) });
    },
    'connectors:set-enabled': async ([id, enabled]) =>
      d().call('connectors.setEnabled', { id: str(id), enabled: bool(enabled) }),
    'connectors:disconnect': async ([connectorId]) => {
      await d().call('connectors.deleteTokens', { connectorId: str(connectorId) });
      await d().call('connectors.setStatus', {
        id: str(connectorId),
        status: 'disconnected' as const,
      });
    },

    // ── Favorites ─────────────────────────────────────────────────────────────
    'favorites:list': async () => d().call('favorites.list'),
    'favorites:add': async ([taskId]) => {
      const task = await d().call('task.get', { taskId: str(taskId) });
      if (!task) {
        throw new Error(`Task not found: ${str(taskId)}`);
      }
      await d().call('favorites.add', {
        taskId: str(taskId),
        prompt: task.prompt,
        summary: task.summary,
      });
    },
    'favorites:remove': async ([taskId]) => d().call('favorites.remove', { taskId: str(taskId) }),
    'favorites:has': async ([taskId]) => d().call('favorites.isFavorite', { taskId: str(taskId) }),

    // ── Scheduler ─────────────────────────────────────────────────────────────
    'scheduler:list': async ([workspaceId]) =>
      d().call('task.listScheduled', { workspaceId: strMaybe(workspaceId) }),
    'scheduler:create': async ([cron, prompt, workspaceId]) =>
      d().call('task.schedule', {
        cron: str(cron),
        prompt: str(prompt),
        workspaceId: strMaybe(workspaceId),
      }),
    'scheduler:delete': async ([scheduleId]) =>
      d().call('task.cancelScheduled', { scheduleId: str(scheduleId) }),
    'scheduler:set-enabled': async ([scheduleId, enabled]) =>
      d().call('task.setScheduleEnabled', { scheduleId: str(scheduleId), enabled: bool(enabled) }),
  };

  return { ...core, ...buildSettingsDispatch() };
}
