/**
 * BrowserApiServer — HTTP+SSE server on 127.0.0.1:9234 built into the daemon.
 * Lets a browser tab at localhost:5173 call daemon services directly without
 * Electron, enabling `pnpm dev:web` to work with the real backend.
 */
import http from 'node:http';
import { createTaskId, BROWSER_API_PORT, WEB_DEV_ORIGIN } from '@accomplish_ai/agent-core';
import type { StorageAPI, AccomplishRuntime, StorageDeps } from '@accomplish_ai/agent-core';
import type { TaskService } from './task-service.js';
import type { SettingsService } from './settings-service.js';
import type { WorkspaceService } from './workspace-service.js';
import type { SecretsService } from './secrets-service.js';
import type { ConnectorService } from './connector-service.js';
import type { SchedulerService } from './scheduler-service.js';
import type { WhatsAppDaemonService } from './whatsapp-service.js';
import type { SkillsService } from './skills-service.js';
import { log } from './logger.js';
import { matchTestLogin } from './test-login.js';
import type { OpenAiOauthManager } from './opencode/auth-openai.js';

// Address comes from the central registry (agent-core/common/constants), with
// env overrides so a port/domain change needs no code edits.
const PORT = Number(process.env.ACCOMPLISH_BACKEND_PORT) || BROWSER_API_PORT;
const ORIGIN = process.env.ACCOMPLISH_WEB_ORIGIN || WEB_DEV_ORIGIN;

// NetBird management API base URL — override for self-hosted deployments.
// e.g. ACCOMPLISH_NETBIRD_API_URL=https://netbird.yourcompany.com
const NETBIRD_API_BASE = (
  process.env.ACCOMPLISH_NETBIRD_API_URL ?? 'https://api.netbird.io'
).replace(/\/$/, '');

// Allowed CORS origins — ACCOMPLISH_WEB_ORIGIN is the primary, with optional
// comma-separated extras in ACCOMPLISH_EXTRA_ORIGINS (e.g. http://100.121.25.134:5173).
const _ALLOWED_ORIGINS: Set<string> = new Set(
  [ORIGIN, ...(process.env.ACCOMPLISH_EXTRA_ORIGINS ?? '').split(',')]
    .map((o) => o.trim())
    .filter(Boolean),
);

/**
 * Trim whitespace and strip one layer of matching surrounding quotes from a
 * user-entered API key (e.g. a key pasted as `"sk-..."` or `'nvapi-...'`).
 * Stray quotes otherwise become part of the `Authorization: Bearer` header and
 * every provider call fails auth.
 */
function sanitizeApiKey(raw: string): string {
  let k = (raw ?? '').trim();
  if (
    k.length >= 2 &&
    ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'")))
  ) {
    k = k.slice(1, -1).trim();
  }
  return k;
}

export interface BrowserApiServices {
  taskService: TaskService;
  settingsService: SettingsService;
  workspaceService: WorkspaceService;
  secretsService: SecretsService;
  connectorService: ConnectorService;
  schedulerService: SchedulerService;
  storage: StorageAPI;
  skillsService: SkillsService;
  whatsappService: WhatsAppDaemonService;
  accomplishRuntime: AccomplishRuntime;
  openAiOauthManager: OpenAiOauthManager;
}

interface SessionData {
  userId: string;
  name: string;
  email: string;
  createdAt: number;
}

export class BrowserApiServer {
  private sseClients = new Set<http.ServerResponse>();
  private server: http.Server | null = null;
  /** In-memory session store: sessionToken → user info */
  private sessions = new Map<string, SessionData>();

  /** True when at least one browser tab has an open SSE connection. */
  hasConnectedClients(): boolean {
    return this.sseClients.size > 0;
  }

  private validateSession(req: http.IncomingMessage): boolean {
    // Check Authorization header (for RPC calls)
    const auth = req.headers['authorization'];
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (bearer && this.sessions.has(bearer)) return true;
    // Developer integration API key — lets external workflows (Dify/FastMCP) call
    // the local API. OPT-IN: only honored when the daemon operator explicitly sets
    // ACCOMPLISH_ENABLE_INTEGRATION_API=1. The daemon already binds to 127.0.0.1
    // only, so reachability is local-host; this flag is the second gate.
    if (bearer && process.env.ACCOMPLISH_ENABLE_INTEGRATION_API === '1') {
      const devKey = this.svc.secretsService.getApiKey('__dev_api_key__');
      if (devKey && bearer === devKey) return true;
    }
    // Check query param (for EventSource which can't set headers)
    const qp = new URL(req.url ?? '/', 'http://localhost').searchParams.get('token');
    if (qp && this.sessions.has(qp)) return true;
    return false;
  }

  constructor(private readonly svc: BrowserApiServices) {
    const s = (ch: string, d: unknown) => this.send(ch, d);
    const { taskService, workspaceService } = svc;
    taskService.on('progress', (d) => s('task:progress', d));
    taskService.on('message', (d) => s('task:update:batch', d));
    taskService.on('complete', (d: { taskId: string; result: unknown }) =>
      s('task:update', { taskId: d.taskId, type: 'complete', result: d.result }),
    );
    taskService.on('error', (d: { taskId: string; error?: unknown }) =>
      s('task:update', { taskId: d.taskId, type: 'error', error: d.error }),
    );
    taskService.on('statusChange', (d) => s('task:status-change', d));
    taskService.on('summary', (d) => s('task:summary', d));
    taskService.on('permission', (d) => s('permission:request', d));
    taskService.on('todo:update', (d) => s('todo:update', d));
    taskService.on('auth:error', (d) => s('auth:error', d));
    workspaceService.on('workspace.changed', (d) => s('workspace:changed', d));
    svc.whatsappService.on('qr', (qr: string) => s('integrations:whatsapp:qr', qr));
    svc.whatsappService.on('status', (status: string) => s('integrations:whatsapp:status', status));
    svc.skillsService.on('skills.changed', (d: unknown) => s('skills:changed', d));
    svc.accomplishRuntime.onUsageUpdate((usage) => s('accomplish-ai:usage-updated', usage));
  }

  private send(ch: string, data: unknown): void {
    if (!this.sseClients.size) return;
    const msg = `event: ${ch}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const r of this.sseClients) {
      try {
        r.write(msg);
      } catch {
        this.sseClients.delete(r);
      }
    }
  }

  private cors(req: http.IncomingMessage, res: http.ServerResponse): void {
    const reqOrigin = req.headers['origin'] ?? '*';
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Vary', 'Origin');
  }

  private async dispatch(channel: string, args: unknown[]): Promise<unknown> {
    const {
      taskService,
      settingsService,
      workspaceService,
      secretsService,
      connectorService,
      schedulerService,
      storage,
    } = this.svc;
    const s = (v: unknown) => v as string;
    const b = (v: unknown) => v as boolean;
    const sm = (v: unknown) => v as string | undefined;
    switch (channel) {
      case 'task:start': {
        const cfg = args[0] as Record<string, unknown>;
        return taskService.startTask({ ...cfg, taskId: createTaskId() } as Parameters<
          typeof taskService.startTask
        >[0]);
      }
      case 'task:list': {
        const ws = workspaceService.getActive();
        return taskService.listTasks(ws?.id, !!ws?.isDefault);
      }
      case 'task:get':
        return storage.getTask(s(args[0])) || null;
      case 'task:cancel':
        return taskService.stopTask({ taskId: s(args[0]) });
      case 'task:interrupt':
        return taskService.interruptTask({ taskId: s(args[0]) });
      case 'task:delete': {
        const id = s(args[0]);
        if (taskService.hasActiveTask(id)) await taskService.stopTask({ taskId: id });
        storage.deleteTask(id);
        return null;
      }
      case 'task:clear-history':
        storage.clearHistory();
        return null;
      case 'task:get-todos':
        return storage.getTodosForTask(s(args[0]));
      case 'session:resume': {
        // Browser sends positional args: [sessionId, prompt, existingTaskId?, attachments?]
        return taskService.resumeSession({
          sessionId: s(args[0]),
          prompt: s(args[1]),
          existingTaskId: sm(args[2]),
          attachments: args[3] as Parameters<typeof taskService.resumeSession>[0]['attachments'],
          workspaceId: workspaceService.getActive()?.id,
        });
      }
      case 'permission:respond': {
        const r = args[0] as Record<string, unknown>;
        const tid = s(r.taskId);
        if (!taskService.hasActiveTask(tid)) throw new Error(`No active task: ${tid}`);
        await taskService.sendResponse(
          tid,
          r as unknown as Parameters<typeof taskService.sendResponse>[1],
        );
        return null;
      }
      case 'workspace:list':
        return workspaceService.list();
      case 'workspace:get-active':
        return workspaceService.getActive()?.id ?? null;
      case 'workspace:switch':
        return workspaceService.setActive(s(args[0]));
      case 'workspace:create':
        return workspaceService.create(args[0] as Parameters<typeof workspaceService.create>[0]);
      case 'workspace:update':
        return workspaceService.update(
          s(args[0]),
          args[1] as Parameters<typeof workspaceService.update>[1],
        );
      case 'workspace:delete':
        return workspaceService.delete(s(args[0])).deleted;
      case 'knowledge-notes:list':
        return workspaceService.listKnowledgeNotes(s(args[0]));
      case 'knowledge-notes:create':
        return workspaceService.createKnowledgeNote(
          args[0] as Parameters<typeof workspaceService.createKnowledgeNote>[0],
        );
      case 'knowledge-notes:update':
        return workspaceService.updateKnowledgeNote(
          s(args[0]),
          s(args[1]),
          args[2] as Parameters<typeof workspaceService.updateKnowledgeNote>[2],
        );
      case 'knowledge-notes:delete':
        workspaceService.deleteKnowledgeNote(s(args[0]), s(args[1]));
        return null;
      case 'settings:theme':
        return settingsService.getAll().app.theme;
      case 'settings:set-theme':
        settingsService.setTheme(s(args[0]) as Parameters<typeof settingsService.setTheme>[0]);
        return null;
      case 'settings:language':
        return settingsService.getAll().app.language;
      case 'settings:set-language':
        settingsService.setLanguage(
          s(args[0]) as Parameters<typeof settingsService.setLanguage>[0],
        );
        return null;
      case 'settings:debug-mode':
        return settingsService.getAll().app.debugMode;
      case 'settings:set-debug-mode':
        settingsService.setDebugMode(b(args[0]));
        return null;
      case 'settings:notifications-enabled':
        return settingsService.getNotificationsEnabled();
      case 'settings:set-notifications-enabled':
        settingsService.setNotificationsEnabled(b(args[0]));
        return null;
      case 'settings:app-settings':
        return settingsService.getAll().app;
      case 'daemon:get-close-behavior':
        return settingsService.getCloseBehavior();
      case 'daemon:set-close-behavior':
        settingsService.setCloseBehavior(
          s(args[0]) as Parameters<typeof settingsService.setCloseBehavior>[0],
        );
        return null;
      case 'settings:api-keys': {
        const keys = await secretsService.getAllApiKeys();
        return Object.entries(keys)
          .filter(([, v]) => v != null)
          .map(([p, k]) => ({
            id: `local-${p}`,
            provider: p,
            label: 'Local API Key',
            keyPrefix: k ? `${k.substring(0, 8)}...` : '',
            isActive: true,
            createdAt: new Date().toISOString(),
          }));
      }
      case 'settings:add-api-key': {
        const p = s(args[0]);
        const k = sanitizeApiKey(s(args[1]));
        secretsService.storeApiKey(p, k);
        return {
          id: `local-${p}`,
          provider: p,
          label: 'Local API Key',
          keyPrefix: `${k.substring(0, 8)}...`,
          isActive: true,
          createdAt: new Date().toISOString(),
        };
      }
      case 'settings:remove-api-key':
        secretsService.deleteApiKey(s(args[0]).replace('local-', ''));
        return null;
      case 'provider-settings:get':
        return settingsService.getProviderSettings();
      case 'provider-settings:set-active':
        settingsService.setActiveProvider(
          args[0] as Parameters<typeof settingsService.setActiveProvider>[0],
        );
        return null;
      case 'provider-settings:get-connected':
        return (
          (settingsService.getProviderSettings().connectedProviders as Record<string, unknown>)[
            s(args[0])
          ] ?? null
        );
      case 'provider-settings:set-connected':
        settingsService.setConnectedProvider(
          args[0] as Parameters<typeof settingsService.setConnectedProvider>[0],
          args[1] as Parameters<typeof settingsService.setConnectedProvider>[1],
        );
        return null;
      case 'provider-settings:remove-connected':
        settingsService.removeConnectedProvider(
          args[0] as Parameters<typeof settingsService.removeConnectedProvider>[0],
        );
        return null;
      case 'provider-settings:update-model':
        settingsService.updateProviderModel(
          args[0] as Parameters<typeof settingsService.updateProviderModel>[0],
          sm(args[1]) ?? null,
        );
        return null;
      case 'provider-settings:set-debug':
        settingsService.setProviderDebugMode(b(args[0]));
        return null;
      case 'provider-settings:get-debug':
        return settingsService.getProviderDebugMode();
      case 'model:get':
        return settingsService.getSelectedModel();
      case 'model:set':
        settingsService.setSelectedModel(
          args[0] as Parameters<typeof settingsService.setSelectedModel>[0],
        );
        return null;
      case 'ollama:get-config':
        return settingsService.getOllamaConfig();
      case 'ollama:set-config':
        settingsService.setOllamaConfig(
          args[0] as Parameters<typeof settingsService.setOllamaConfig>[0],
        );
        return null;
      case 'litellm:get-config':
        return settingsService.getLiteLLMConfig();
      case 'litellm:set-config':
        settingsService.setLiteLLMConfig(
          args[0] as Parameters<typeof settingsService.setLiteLLMConfig>[0],
        );
        return null;
      case 'connectors:list':
        return connectorService.list();
      // OAuth connector flows — return stub values (need Electron shell.openExternal for full flow)
      case 'connectors:get-built-in-auth-status':
        return [];
      case 'connectors:built-in-login':
        return { ok: false, error: 'OAuth requires desktop app' };
      case 'connectors:built-in-logout':
        return null;
      case 'connectors:slack-oauth-status':
        return { connected: false, pendingAuthorization: false };
      case 'connectors:start-oauth':
        return { state: '', authUrl: '' };
      case 'connectors:complete-oauth':
        return null;
      case 'connectors:add': {
        const id = `mcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const now = new Date().toISOString();
        const c = {
          id,
          name: s(args[0]),
          url: s(args[1]),
          status: 'disconnected' as const,
          isEnabled: true,
          createdAt: now,
          updatedAt: now,
        };
        connectorService.upsert(c);
        return c;
      }
      case 'connectors:delete':
        connectorService.deleteTokens(s(args[0]));
        connectorService.delete(s(args[0]));
        return null;
      case 'connectors:set-enabled':
        connectorService.setEnabled(s(args[0]), b(args[1]));
        return null;
      case 'favorites:list':
        return storage.getFavorites();
      case 'favorites:add': {
        const t = storage.getTask(s(args[0]));
        if (!t) throw new Error(`Task not found: ${s(args[0])}`);
        storage.addFavorite(t.id, t.prompt, t.summary);
        return null;
      }
      case 'favorites:remove':
        storage.removeFavorite(s(args[0]));
        return null;
      case 'favorites:has':
        return storage.isFavorite(s(args[0]));
      case 'scheduler:list':
        return schedulerService.listSchedules(sm(args[0]));
      case 'scheduler:create':
        return schedulerService.createSchedule(s(args[0]), s(args[1]), sm(args[2]));
      case 'scheduler:delete':
        schedulerService.deleteSchedule(s(args[0]));
        return null;
      case 'scheduler:set-enabled':
        schedulerService.setEnabled(s(args[0]), b(args[1]));
        return null;
      case 'accomplish-ai:get-status':
        return {
          connected:
            settingsService.getProviderSettings().connectedProviders['accomplish-ai']
              ?.connectionStatus === 'connected',
        };
      case 'daemon:ping':
        return { status: 'ok', uptime: process.uptime() };

      // ── Accomplish AI Free Tier ─────────────────────────────────────────────
      case 'accomplish-ai:connect':
      case 'accomplish-ai:ensure-ready': {
        const storageDeps: StorageDeps = {
          readKey: (key) => this.svc.storage.get(key),
          writeKey: (key, value) => this.svc.storage.set(key, value),
          readGaClientId: () => null,
        };
        return this.svc.accomplishRuntime.connect(storageDeps);
      }
      case 'accomplish-ai:disconnect':
        this.svc.accomplishRuntime.disconnect();
        return null;
      case 'accomplish-ai:get-usage':
        return this.svc.accomplishRuntime.getUsage();

      // ── Skills ──────────────────────────────────────────────────────────────
      case 'skills:list':
        return this.svc.skillsService.list();
      case 'skills:list-enabled':
        return this.svc.skillsService.listEnabled();
      case 'skills:set-enabled':
        this.svc.skillsService.setEnabled(s(args[0]), b(args[1]));
        return null;
      case 'skills:get-content':
        return this.svc.skillsService.getContent(s(args[0]));
      case 'skills:get-user-path':
        return this.svc.skillsService.getUserSkillsPath();
      case 'skills:add-from-github':
        return this.svc.skillsService.addFromPath(s(args[0]));
      case 'skills:delete':
        this.svc.skillsService.delete(s(args[0]));
        return null;
      case 'skills:resync':
        return this.svc.skillsService.resync();

      // ── WhatsApp ────────────────────────────────────────────────────────────
      case 'whatsapp:get-config':
        return this.svc.whatsappService.getConfig();
      case 'whatsapp:connect':
        await this.svc.whatsappService.connect();
        return null;
      case 'whatsapp:disconnect':
        await this.svc.whatsappService.disconnect();
        return null;
      case 'whatsapp:set-enabled':
        this.svc.whatsappService.setEnabled(b(args[0]));
        return null;

      // ── Sandbox config ──────────────────────────────────────────────────────
      case 'sandbox:get-config':
        return settingsService.getSandboxConfig();
      case 'sandbox:set-config':
        settingsService.setSandboxConfig(
          args[0] as Parameters<typeof settingsService.setSandboxConfig>[0],
        );
        return null;

      // Provider connection tests — run in daemon so Node.js SDKs are available
      case 'ollama:test-connection': {
        const { testOllamaConnection } = await import('@accomplish_ai/agent-core');
        return testOllamaConnection(s(args[0]));
      }
      case 'litellm:test-connection': {
        const { testLiteLLMConnection } = await import('@accomplish_ai/agent-core');
        return testLiteLLMConnection(s(args[0]), sm(args[1]));
      }
      case 'lmstudio:test-connection': {
        const { testLMStudioConnection } = await import('@accomplish_ai/agent-core');
        return testLMStudioConnection({ url: s(args[0]) });
      }
      case 'azure-foundry:test-connection': {
        const { testAzureFoundryConnection } = await import('@accomplish_ai/agent-core');
        return testAzureFoundryConnection(
          args[0] as Parameters<typeof testAzureFoundryConnection>[0],
        );
      }
      case 'bedrock:validate-credentials': {
        const { validateBedrockCredentials } = await import('@accomplish_ai/agent-core');
        return validateBedrockCredentials(
          args[0] as Parameters<typeof validateBedrockCredentials>[0],
        );
      }
      case 'bedrock:fetch-models': {
        const { fetchBedrockModels } = await import('@accomplish_ai/agent-core');
        return fetchBedrockModels(args[0] as Parameters<typeof fetchBedrockModels>[0]);
      }
      case 'bedrock:save-credentials': {
        secretsService.storeBedrockCredentials(JSON.stringify(args[0]));
        return null;
      }
      case 'bedrock:get-credentials': {
        return secretsService.getBedrockCredentials();
      }

      // ── Parity wiring (bucket A) — delegate to existing services / agent-core ──
      case 'settings:get-openai-base-url':
        return settingsService.getOpenAiBaseUrl();
      case 'settings:set-openai-base-url':
        settingsService.setOpenAiBaseUrl(
          args[0] as Parameters<typeof settingsService.setOpenAiBaseUrl>[0],
        );
        return null;
      case 'settings:get-cloud-browser':
        return settingsService.getCloudBrowserConfig();
      case 'settings:set-cloud-browser':
        settingsService.setCloudBrowserConfig(
          args[0] as Parameters<typeof settingsService.setCloudBrowserConfig>[0],
        );
        return null;
      case 'azure-foundry:get-config':
        return settingsService.getAzureFoundryConfig();
      case 'azure-foundry:set-config':
        settingsService.setAzureFoundryConfig(
          args[0] as Parameters<typeof settingsService.setAzureFoundryConfig>[0],
        );
        return null;
      case 'lmstudio:get-config':
        return settingsService.getLMStudioConfig();
      case 'lmstudio:set-config':
        settingsService.setLMStudioConfig(
          args[0] as Parameters<typeof settingsService.setLMStudioConfig>[0],
        );
        return null;
      case 'huggingface-local:get-config':
        return settingsService.getHuggingFaceLocalConfig();
      case 'huggingface-local:set-config':
        settingsService.setHuggingFaceLocalConfig(
          args[0] as Parameters<typeof settingsService.setHuggingFaceLocalConfig>[0],
        );
        return null;
      case 'secrets:has-api-key':
        return (await secretsService.getApiKey(s(args[0]))) != null;
      case 'secrets:has-any-api-key':
        return secretsService.hasAnyApiKey();
      case 'secrets:get-all-api-keys':
        return secretsService.getAllApiKeys();
      case 'provider:validate-api-key': {
        const { validateApiKey } = await import('@accomplish_ai/agent-core');
        return validateApiKey(...(args as Parameters<typeof validateApiKey>));
      }
      // The UI's standard provider forms (OpenAI, Anthropic, Zai, OpenRouter, ...)
      // call validateApiKeyForProvider(provider, key, options) and read `.valid`.
      // Normalize the options object, then delegate to agent-core validateApiKey.
      case 'provider:validate-api-key-for-provider': {
        const provider = s(args[0]);
        const key = s(args[1]);
        const raw = (args[2] ?? {}) as Record<string, unknown>;
        const options: Record<string, unknown> = {};
        if (typeof raw.baseUrl === 'string') {
          options.baseUrl = raw.baseUrl;
        }
        const region = raw.zaiRegion ?? raw.region;
        if (typeof region === 'string') {
          options.zaiRegion = region;
        }
        const { validateApiKey } = await import('@accomplish_ai/agent-core');
        return validateApiKey(
          provider as Parameters<typeof validateApiKey>[0],
          key,
          options as Parameters<typeof validateApiKey>[2],
        );
      }
      case 'vertex:validate-credentials': {
        const { validateVertexCredentials } = await import('@accomplish_ai/agent-core');
        return validateVertexCredentials(...(args as Parameters<typeof validateVertexCredentials>));
      }
      case 'vertex:fetch-models': {
        const { fetchVertexModels } = await import('@accomplish_ai/agent-core');
        return fetchVertexModels(...(args as Parameters<typeof fetchVertexModels>));
      }
      // UI calls fetchProviderModels(providerId, { baseUrl?, zaiRegion? }). Mirror the
      // Electron model-discovery handler: resolve the provider's models endpoint,
      // pull the stored key, build any urlOverride, then call the low-level fetcher.
      case 'models:fetch-provider': {
        const providerId = s(args[0]);
        const opts = (args[1] ?? {}) as { baseUrl?: string; zaiRegion?: string };
        const { DEFAULT_PROVIDERS, ZAI_ENDPOINTS, fetchProviderModels } =
          await import('@accomplish_ai/agent-core');
        const providerConfig = DEFAULT_PROVIDERS.find((p) => p.id === providerId);
        if (!providerConfig?.modelsEndpoint) {
          return { success: false, error: 'No models endpoint configured for this provider' };
        }
        const apiKey = secretsService.getApiKey(providerId);
        if (!apiKey) {
          return { success: false, error: 'No API key found for this provider' };
        }
        let urlOverride: string | undefined;
        let endpointConfig = providerConfig.modelsEndpoint;
        if (providerId === 'openai' && typeof opts.baseUrl === 'string' && opts.baseUrl) {
          urlOverride = `${opts.baseUrl.replace(/\/+$/, '')}/models`;
          endpointConfig = { ...endpointConfig, modelFilter: undefined };
        }
        if (providerId === 'zai' && opts.zaiRegion) {
          const region = opts.zaiRegion as keyof typeof ZAI_ENDPOINTS;
          urlOverride = `${ZAI_ENDPOINTS[region]}/models`;
        }
        return fetchProviderModels({ endpointConfig, apiKey, urlOverride, timeout: 10000 });
      }
      case 'models:fetch-openrouter': {
        const { fetchOpenRouterModels } = await import('@accomplish_ai/agent-core');
        const apiKey = secretsService.getApiKey('openrouter');
        return fetchOpenRouterModels(apiKey || '', 10000);
      }
      case 'models:fetch-litellm': {
        const { fetchLiteLLMModels } = await import('@accomplish_ai/agent-core');
        return fetchLiteLLMModels(...(args as Parameters<typeof fetchLiteLLMModels>));
      }
      case 'models:fetch-lmstudio': {
        const { fetchLMStudioModels } = await import('@accomplish_ai/agent-core');
        return fetchLMStudioModels(...(args as Parameters<typeof fetchLMStudioModels>));
      }
      case 'models:fetch-nim': {
        const { fetchNimModels } = await import('@accomplish_ai/agent-core');
        return fetchNimModels(...(args as Parameters<typeof fetchNimModels>));
      }
      case 'nim:test-connection': {
        const { testNimConnection } = await import('@accomplish_ai/agent-core');
        return testNimConnection(...(args as Parameters<typeof testNimConnection>));
      }
      case 'custom:test-connection': {
        const { testCustomConnection } = await import('@accomplish_ai/agent-core');
        return testCustomConnection(...(args as Parameters<typeof testCustomConnection>));
      }

      // ── Batch 2 (bucket B): Vertex credentials — stored in the secret store,
      // mirroring the bedrock helper. credentials arrive as a JSON string.
      case 'vertex:save-credentials': {
        const creds = sanitizeApiKey(s(args[0]));
        secretsService.storeApiKey('vertex', creds);
        return {
          id: 'local-vertex',
          provider: 'vertex',
          label: 'Vertex Credentials',
          keyPrefix: '••••',
          isActive: true,
          createdAt: new Date().toISOString(),
        };
      }
      case 'vertex:get-credentials': {
        const raw = secretsService.getApiKey('vertex');
        if (!raw) {
          return null;
        }
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }

      // ── Batch 2 (bucket B): Speech (ElevenLabs) — runs in the daemon (HTTP).
      case 'speech:is-configured': {
        const { createSpeechService } = await import('@accomplish_ai/agent-core');
        return createSpeechService({ storage }).isElevenLabsConfigured();
      }
      case 'speech:get-config': {
        const { createSpeechService } = await import('@accomplish_ai/agent-core');
        const key = createSpeechService({ storage }).getElevenLabsApiKey();
        return {
          enabled: key != null,
          hasApiKey: key != null,
          ...(key ? { apiKeyPrefix: `${key.substring(0, 4)}…` } : {}),
        };
      }
      case 'speech:validate': {
        const { createSpeechService } = await import('@accomplish_ai/agent-core');
        return createSpeechService({ storage }).validateElevenLabsApiKey(sm(args[0]));
      }
      case 'speech:transcribe': {
        // audio arrives base64-encoded (ArrayBuffer can't cross the JSON bridge).
        const { createSpeechService } = await import('@accomplish_ai/agent-core');
        const audio = Buffer.from(s(args[0]), 'base64');
        return createSpeechService({ storage }).transcribeAudio(audio, sm(args[1]) ?? 'audio/webm');
      }

      // ── Batch 2 (bucket B): OpenAI "Sign in with ChatGPT" OAuth. The manager
      // (transient opencode runtime) handles the loopback callback + token
      // exchange; login returns the authorize URL for the browser to open, then
      // the UI polls status until connected.
      case 'openai-oauth:status':
        return this.svc.openAiOauthManager.status();
      case 'openai-oauth:login': {
        const { authorizeUrl } = await this.svc.openAiOauthManager.startLogin();
        return { ok: true, openedUrl: authorizeUrl };
      }

      // ── Provenance / authorship — openly queryable so the app can SHOW who
      // built this SRIM/DigiBull build. Attribution, not a tamper trap: removing
      // it loses the credit, it does not break anything.
      case 'system:about': {
        return {
          app: 'SRIM',
          brand: 'DigiBull.ai',
          author: 'Nagabhushana Raju S',
          location: 'Mysore, Karnataka, India',
          build: 'SRIM / DigiBull build of Accomplish',
        };
      }

      // ── Developer integration API key. Generating/showing the key is safe;
      // it only grants access when the daemon operator explicitly enables it via
      // ACCOMPLISH_ENABLE_INTEGRATION_API=1 (see validateSession). Off by default.
      case 'dev:get-api-key': {
        let k = secretsService.getApiKey('__dev_api_key__');
        if (!k) {
          k = `srim_${crypto.randomUUID().replace(/-/g, '')}`;
          secretsService.storeApiKey('__dev_api_key__', k);
        }
        return { apiKey: k, enabled: process.env.ACCOMPLISH_ENABLE_INTEGRATION_API === '1' };
      }
      case 'dev:regenerate-api-key': {
        const k = `srim_${crypto.randomUUID().replace(/-/g, '')}`;
        secretsService.storeApiKey('__dev_api_key__', k);
        return { apiKey: k, enabled: process.env.ACCOMPLISH_ENABLE_INTEGRATION_API === '1' };
      }

      // ── LOCAL LLM advisor: real machine specs (CPU/RAM) from Node `os`. The
      // browser adds GPU (WebGL) + network client-side. Used to recommend which
      // local models the machine can realistically run.
      case 'system:get-specs': {
        const os = await import('node:os');
        const cpus = os.cpus();
        return {
          platform: process.platform,
          arch: process.arch,
          cpuModel: cpus[0]?.model?.trim() ?? 'unknown',
          cpuCores: cpus.length,
          totalRamGB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
          freeRamGB: Math.round((os.freemem() / 1024 ** 3) * 10) / 10,
        };
      }

      default:
        throw new Error(`Unknown channel: ${channel}`);
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const { method, url } = req;
        if (method === 'OPTIONS') {
          this.cors(req, res);
          res.writeHead(204);
          res.end();
          return;
        }
        this.cors(req, res);
        if (method === 'GET' && url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
          return;
        }

        // ── Auth endpoints (no session required) ──────────────────────────────
        if (method === 'POST' && url === '/auth/login') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c;
          });
          req.on('end', () => {
            void (async () => {
              try {
                const {
                  token: pat,
                  username,
                  email,
                  password,
                } = JSON.parse(body) as {
                  token?: string;
                  username?: string;
                  email?: string;
                  password?: string;
                };
                // DEV/TESTING bypass: accept the configured test token or
                // username/password without contacting NetBird. No-op in
                // production builds (see test-login.ts).
                const testUser = matchTestLogin({ token: pat, username, password });
                if (testUser) {
                  const sessionToken = crypto.randomUUID();
                  this.sessions.set(sessionToken, {
                    userId: testUser.id,
                    name: testUser.name,
                    email: testUser.email,
                    createdAt: Date.now(),
                  });
                  log.info(`[Auth] Test login: ${testUser.email}`);
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(
                    JSON.stringify({
                      sessionToken,
                      user: { name: testUser.name, email: testUser.email },
                    }),
                  );
                  return;
                }
                // PostgreSQL auth: username/email + password (no PAT)
                if ((username || email) && password && !pat) {
                  const identifier = username ?? email ?? '';
                  const { pgLogin } = await import('./auth/pg-auth.js');
                  const pgUser = await pgLogin(identifier, password);
                  if (pgUser) {
                    const sessionToken = crypto.randomUUID();
                    this.sessions.set(sessionToken, {
                      userId: pgUser.id,
                      name: pgUser.name,
                      email: pgUser.email,
                      createdAt: Date.now(),
                    });
                    log.info(`[Auth] PostgreSQL login: ${pgUser.email}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(
                      JSON.stringify({
                        sessionToken,
                        user: { name: pgUser.name, email: pgUser.email },
                      }),
                    );
                    return;
                  }
                  res.writeHead(401, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'Invalid credentials' }));
                  return;
                }
                if (!pat) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'Token required' }));
                  return;
                }
                // Validate PAT against NetBird API — /api/users returns the list of
                // users the token has access to; the calling user appears first.
                const nbRes = await fetch(`${NETBIRD_API_BASE}/api/users`, {
                  headers: { Authorization: `Bearer ${pat}` },
                });
                if (!nbRes.ok) {
                  const errText = await nbRes.text().catch(() => '');
                  log.warn(`[Auth] NetBird API rejected token: HTTP ${nbRes.status} — ${errText}`);
                  res.writeHead(401, { 'Content-Type': 'application/json' });
                  res.end(
                    JSON.stringify({ error: `Invalid NetBird token (HTTP ${nbRes.status})` }),
                  );
                  return;
                }
                const users = (await nbRes.json()) as Array<{
                  id: string;
                  name: string;
                  email: string;
                }>;
                const user = users.find((u) => u.email) ?? users[0];
                if (!user) {
                  res.writeHead(401, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'Could not identify user from token' }));
                  return;
                }
                const sessionToken = crypto.randomUUID();
                this.sessions.set(sessionToken, {
                  userId: user.id,
                  name: user.name ?? 'NetBird User',
                  email: user.email ?? '',
                  createdAt: Date.now(),
                });
                log.info(`[Auth] User logged in: ${user.email}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({ sessionToken, user: { name: user.name, email: user.email } }),
                );
              } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Login failed' }));
              }
            })();
          });
          return;
        }

        if (method === 'POST' && url === '/auth/register') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c;
          });
          req.on('end', () => {
            void (async () => {
              try {
                const { username, email, password } = JSON.parse(body) as {
                  username?: string;
                  email?: string;
                  password?: string;
                };
                if (!username?.trim() || !email?.trim() || !password) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'Username, email and password are required' }));
                  return;
                }
                const { pgRegister } = await import('./auth/pg-auth.js');
                await pgRegister(username.trim(), email.trim().toLowerCase(), password);
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
              } catch (e) {
                const msg = e instanceof Error ? e.message : 'Registration failed';
                const status = msg.includes('already exists') ? 409 : 500;
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: msg }));
              }
            })();
          });
          return;
        }

        if (method === 'POST' && url === '/auth/forgot-password') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c;
          });
          req.on('end', () => {
            void (async () => {
              try {
                const { email } = JSON.parse(body) as { email?: string };
                if (!email?.trim()) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'Email is required' }));
                  return;
                }
                const { pgForgotPassword } = await import('./auth/pg-auth.js');
                // pgForgotPassword returns null silently when email not found — no enumeration
                const resetToken = await pgForgotPassword(email.trim().toLowerCase());
                if (resetToken) {
                  const { sendPasswordResetEmail } = await import('./email-service.js');
                  await sendPasswordResetEmail(email.trim().toLowerCase(), resetToken);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
              } catch (e) {
                log.warn(`[Auth] Forgot-password error: ${e instanceof Error ? e.message : e}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
              }
            })();
          });
          return;
        }

        if (method === 'POST' && url === '/auth/reset-password') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c;
          });
          req.on('end', () => {
            void (async () => {
              try {
                const { token, password } = JSON.parse(body) as {
                  token?: string;
                  password?: string;
                };
                if (!token?.trim() || !password) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'Token and password are required' }));
                  return;
                }
                const { pgResetPassword } = await import('./auth/pg-auth.js');
                await pgResetPassword(token.trim(), password);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
              } catch (e) {
                const msg = e instanceof Error ? e.message : 'Reset failed';
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: msg }));
              }
            })();
          });
          return;
        }

        if (method === 'POST' && url === '/auth/logout') {
          const auth = req.headers['authorization'];
          if (auth?.startsWith('Bearer ')) this.sessions.delete(auth.slice(7));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
          return;
        }

        // ── Protected routes — require valid session ──────────────────────────
        if (!this.validateSession(req)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized — please log in' }));
          return;
        }

        if (method === 'GET' && url === '/events') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });
          res.write(':ok\n\n');
          this.sseClients.add(res);
          req.on('close', () => this.sseClients.delete(res));
          return;
        }
        if (method === 'POST' && url === '/rpc') {
          let body = '';
          req.on('data', (c: Buffer) => {
            body += c;
          });
          req.on('end', () => {
            void (async () => {
              try {
                const { channel, args = [] } = JSON.parse(body) as {
                  channel: string;
                  args?: unknown[];
                };
                const result = await this.dispatch(channel, args);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ result: result ?? null }));
              } catch (e) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
              }
            })();
          });
          return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{"error":"Not found"}');
      });
      this.server.listen(PORT, '0.0.0.0', () => {
        log.info(`[BrowserApi] Listening on port ${PORT}`);
        // Keep SSE connections alive so browsers don't time them out
        setInterval(() => this.send(':heartbeat', {}), 30_000);
        resolve();
      });
      this.server.on('error', (e: NodeJS.ErrnoException) => {
        if (e.code === 'EADDRINUSE') {
          log.warn(`[BrowserApi] Port ${PORT} in use`);
          resolve();
        } else {
          reject(e);
        }
      });
    });
  }

  stop(): void {
    this.server?.close();
  }
}
