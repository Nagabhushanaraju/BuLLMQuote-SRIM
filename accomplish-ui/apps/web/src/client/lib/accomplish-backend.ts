/**
 * HTTP/SSE client — connects apps/web to apps/daemon on port 9234.
 *
 * Runs unconditionally in the browser. Sets window.accomplish synchronously
 * (before React renders) so Zustand stores can subscribe at module-init time.
 * All business logic lives in the daemon; this file is pure transport.
 *
 * No Electron. No mocks. No IPC.
 */

import { getSessionToken, clearSession } from './session';
import { BACKEND_URL } from '../config/endpoints';

// Preserve any desktop preload surface so Electron-only capabilities (for example
// local model downloads) remain reachable even when the browser bridge is active.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nativeAccomplish = typeof window !== 'undefined' ? (window as any).accomplish : undefined;
const nativeAccomplishShell =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  typeof window !== 'undefined' ? (window as any).accomplishShell : undefined;

// Backend address comes from the centralized endpoint registry (config/endpoints.ts),
// not a hardcoded literal — change the port/host there or via VITE_BACKEND_URL.
const BRIDGE = BACKEND_URL;

// per-channel subscriber sets (populated at store init time before SSE opens)
const subs = new Map<string, Set<(d: unknown) => void>>();
const attached = new Set<string>();

const token = getSessionToken();
const es = new EventSource(`${BRIDGE}/events${token ? `?token=${encodeURIComponent(token)}` : ''}`);
es.addEventListener('open', () => {
  for (const ch of subs.keys()) ensureAttached(ch);
});

function ensureAttached(ch: string): void {
  if (attached.has(ch)) return;
  attached.add(ch);
  es.addEventListener(ch, (e: Event) => {
    const set = subs.get(ch);
    if (!set?.size) return;
    let data: unknown;
    try {
      data = JSON.parse((e as MessageEvent<string>).data);
    } catch {
      return;
    }
    for (const cb of set) {
      try {
        cb(data);
      } catch {
        /* ignore */
      }
    }
  });
}

async function rpc(ch: string, args: unknown[]): Promise<unknown> {
  const token = getSessionToken();
  const r = await fetch(`${BRIDGE}/rpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ channel: ch, args }),
  });
  if (r.status === 401) {
    clearSession();
    window.location.hash = '#/login';
    throw new Error('Session expired — please log in again');
  }
  const d = (await r.json()) as { result?: unknown; error?: string };
  if (d.error) throw new Error(d.error);
  return d.result;
}

const EV: Record<string, string> = {
  onTaskUpdate: 'task:update',
  onTaskUpdateBatch: 'task:update:batch',
  onTaskProgress: 'task:progress',
  onTaskSummary: 'task:summary',
  onTodoUpdate: 'todo:update',
  onAuthError: 'auth:error',
  onTaskStatusChange: 'task:status-change',
  onPermissionRequest: 'permission:request',
  onWorkspaceChanged: 'workspace:changed',
  onAccomplishAiUsageUpdate: 'accomplish-ai:usage-updated',
  onSkillsChanged: 'skills:changed',
};

const RPC: Record<string, string> = {
  startTask: 'task:start',
  listTasks: 'task:list',
  checkRfqExists:     'rfq.checkExists',
  rfqGetFileVersions: 'rfq.getFileVersions',
  rfqActivateVersion: 'rfq.activateVersion',
  getTask: 'task:get',
  cancelTask: 'task:cancel',
  interruptTask: 'task:interrupt',
  deleteTask: 'task:delete',
  clearTaskHistory: 'task:clear-history',
  getTaskTodos: 'task:get-todos',
  resumeSession: 'session:resume',
  respondToPermission: 'permission:respond',
  getApiKeys: 'settings:api-keys',
  addApiKey: 'settings:add-api-key',
  removeApiKey: 'settings:remove-api-key',
  getTheme: 'settings:theme',
  setTheme: 'settings:set-theme',
  getLanguage: 'settings:language',
  setLanguage: 'settings:set-language',
  getDebugMode: 'settings:debug-mode',
  setDebugMode: 'settings:set-debug-mode',
  getNotificationsEnabled: 'settings:notifications-enabled',
  setNotificationsEnabled: 'settings:set-notifications-enabled',
  getAppSettings: 'settings:app-settings',
  getCloseBehavior: 'daemon:get-close-behavior',
  setCloseBehavior: 'daemon:set-close-behavior',
  daemonPing: 'daemon:ping',
  getProviderSettings: 'provider-settings:get',
  setActiveProvider: 'provider-settings:set-active',
  getConnectedProvider: 'provider-settings:get-connected',
  setConnectedProvider: 'provider-settings:set-connected',
  removeConnectedProvider: 'provider-settings:remove-connected',
  updateProviderModel: 'provider-settings:update-model',
  setProviderDebugMode: 'provider-settings:set-debug',
  getProviderDebugMode: 'provider-settings:get-debug',
  getSelectedModel: 'model:get',
  setSelectedModel: 'model:set',
  listWorkspaces: 'workspace:list',
  getActiveWorkspaceId: 'workspace:get-active',
  switchWorkspace: 'workspace:switch',
  createWorkspace: 'workspace:create',
  updateWorkspace: 'workspace:update',
  deleteWorkspace: 'workspace:delete',
  listKnowledgeNotes: 'knowledge-notes:list',
  createKnowledgeNote: 'knowledge-notes:create',
  updateKnowledgeNote: 'knowledge-notes:update',
  deleteKnowledgeNote: 'knowledge-notes:delete',
  // Connectors — API uses getConnectors/startConnectorOAuth/completeConnectorOAuth
  getConnectors: 'connectors:list',
  listConnectors: 'connectors:list',
  addConnector: 'connectors:add',
  deleteConnector: 'connectors:delete',
  setConnectorEnabled: 'connectors:set-enabled',
  disconnectConnector: 'connectors:disconnect',
  startConnectorOAuth: 'connectors:start-oauth',
  completeConnectorOAuth: 'connectors:complete-oauth',
  getBuiltInConnectorAuthStatus: 'connectors:get-built-in-auth-status',
  loginBuiltInConnector: 'connectors:built-in-login',
  logoutBuiltInConnector: 'connectors:built-in-logout',
  getSlackMcpOauthStatus: 'connectors:slack-oauth-status',
  loginSlackMcp: 'connectors:built-in-login',
  logoutSlackMcp: 'connectors:built-in-logout',
  listFavorites: 'favorites:list',
  addFavorite: 'favorites:add',
  removeFavorite: 'favorites:remove',
  hasFavorite: 'favorites:has',
  // Scheduler — API uses listSchedules/createSchedule/deleteSchedule/setScheduleEnabled
  listSchedules: 'scheduler:list',
  createSchedule: 'scheduler:create',
  deleteSchedule: 'scheduler:delete',
  setScheduleEnabled: 'scheduler:set-enabled',
  connectAccomplishAi: 'accomplish-ai:connect',
  ensureAccomplishAiReady: 'accomplish-ai:ensure-ready',
  disconnectAccomplishAi: 'accomplish-ai:disconnect',
  getAccomplishAiUsage: 'accomplish-ai:get-usage',
  getAccomplishAiStatus: 'accomplish-ai:get-status',
  getOllamaConfig: 'ollama:get-config',
  setOllamaConfig: 'ollama:set-config',
  getLiteLLMConfig: 'litellm:get-config',
  setLiteLLMConfig: 'litellm:set-config',
  // Skills management
  getSkills: 'skills:list',
  getEnabledSkills: 'skills:list-enabled',
  setSkillEnabled: 'skills:set-enabled',
  getSkillContent: 'skills:get-content',
  getUserSkillsPath: 'skills:get-user-path',
  addSkillFromGitHub: 'skills:add-from-github',
  deleteSkill: 'skills:delete',
  resyncSkills: 'skills:resync',
  // WhatsApp
  getWhatsAppConfig: 'whatsapp:get-config',
  connectWhatsApp: 'whatsapp:connect',
  disconnectWhatsApp: 'whatsapp:disconnect',
  setWhatsAppEnabled: 'whatsapp:set-enabled',
  // Sandbox config
  getSandboxConfig: 'sandbox:get-config',
  setSandboxConfig: 'sandbox:set-config',
  // Provider connection tests (run in daemon — need Node.js SDKs)
  testAzureFoundryConnection: 'azure-foundry:test-connection',
  validateBedrockCredentials: 'bedrock:validate-credentials',
  fetchBedrockModels: 'bedrock:fetch-models',
  saveBedrockCredentials: 'bedrock:save-credentials',
  getBedrockCredentials: 'bedrock:get-credentials',
  // ── Parity wiring (bucket A) — backed by existing daemon services / agent-core ──
  getTodosForTask: 'task:get-todos',
  getOpenAiBaseUrl: 'settings:get-openai-base-url',
  setOpenAiBaseUrl: 'settings:set-openai-base-url',
  getCloudBrowserConfig: 'settings:get-cloud-browser',
  setCloudBrowserConfig: 'settings:set-cloud-browser',
  getAzureFoundryConfig: 'azure-foundry:get-config',
  setAzureFoundryConfig: 'azure-foundry:set-config',
  saveAzureFoundryConfig: 'azure-foundry:set-config',
  getLMStudioConfig: 'lmstudio:get-config',
  setLMStudioConfig: 'lmstudio:set-config',
  getHuggingFaceLocalConfig: 'huggingface-local:get-config',
  setHuggingFaceLocalConfig: 'huggingface-local:set-config',
  fetchProviderModels: 'models:fetch-provider',
  fetchOpenRouterModels: 'models:fetch-openrouter',
  fetchLiteLLMModels: 'models:fetch-litellm',
  fetchLMStudioModels: 'models:fetch-lmstudio',
  fetchNimModels: 'models:fetch-nim',
  fetchVertexModels: 'vertex:fetch-models',
  testNimConnection: 'nim:test-connection',
  testCustomConnection: 'custom:test-connection',
  validateApiKey: 'provider:validate-api-key',
  validateApiKeyForProvider: 'provider:validate-api-key-for-provider',
  validateVertexCredentials: 'vertex:validate-credentials',
  hasApiKey: 'secrets:has-api-key',
  hasAnyApiKey: 'secrets:has-any-api-key',
  getAllApiKeys: 'secrets:get-all-api-keys',
  // ── Batch 2 (bucket B): Vertex credentials + Speech (ElevenLabs) ──
  saveVertexCredentials: 'vertex:save-credentials',
  getVertexCredentials: 'vertex:get-credentials',
  speechIsConfigured: 'speech:is-configured',
  speechGetConfig: 'speech:get-config',
  speechValidate: 'speech:validate',
  getOpenAiOauthStatus: 'openai-oauth:status',
  getSystemSpecs: 'system:get-specs',
  getAbout: 'system:about',
  getDevApiKey: 'dev:get-api-key',
  regenerateDevApiKey: 'dev:regenerate-api-key',
};

type FileType = 'image' | 'pdf' | 'code' | 'text' | 'other';
function getFileType(name: string): FileType {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (
    [
      'js',
      'jsx',
      'ts',
      'tsx',
      'py',
      'rb',
      'go',
      'rs',
      'java',
      'c',
      'cpp',
      'cs',
      'swift',
      'kt',
      'sh',
      'bash',
      'json',
      'css',
      'scss',
      'sql',
    ].includes(ext)
  )
    return 'code';
  if (['txt', 'md', 'csv', 'log', 'xml', 'html', 'htm', 'yml', 'yaml', 'toml', 'ini'].includes(ext))
    return 'text';
  return 'other';
}

function browserPickFiles(opts?: {
  multiple?: boolean;
  directory?: boolean;
}): Promise<Array<{ id: string; name: string; path: string; type: FileType; size: number }>> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (opts?.multiple) input.multiple = true;
    if (opts?.directory) {
      (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
    }
    input.style.display = 'none';
    document.body.appendChild(input);
    const cleanup = () => {
      try {
        document.body.removeChild(input);
      } catch {
        /* already removed */
      }
    };
    input.onchange = () => {
      const files = Array.from(input.files || []);
      cleanup();
      resolve(
        files.map((f) => ({
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: f.name,
          path: (f as File & { path?: string }).path || f.name,
          type: getFileType(f.name),
          size: f.size,
        })),
      );
    };
    input.addEventListener('cancel', () => {
      cleanup();
      resolve([]);
    });
    input.click();
  });
}

const noop = () => () => {};
const noopAsync = async () => null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).accomplish = new Proxy({} as Record<string, unknown>, {
  get(_t, prop: string | symbol) {
    const key = String(prop);

    if (key in EV) {
      return (cb: (d: unknown) => void) => {
        const ch = EV[key];
        if (!subs.has(ch)) subs.set(ch, new Set());
        subs.get(ch)!.add(cb);
        ensureAttached(ch);
        return () => {
          subs.get(ch)?.delete(cb);
        };
      };
    }

    if (key in RPC) return (...args: unknown[]) => rpc(RPC[key], args);

    if (nativeAccomplish) {
      const nativeValue = Reflect.get(nativeAccomplish, prop);
      if (nativeValue !== undefined) {
        return typeof nativeValue === 'function' ? nativeValue.bind(nativeAccomplish) : nativeValue;
      }
    }

    // Provider connection tests — run directly in the browser (no daemon needed,
    // these are just HTTP fetches to the provider's own API endpoint).
    if (key === 'testOllamaConnection') {
      return async (url: string) => {
        try {
          const r = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(15000) });
          if (!r.ok) return { success: false, error: `Ollama returned status ${r.status}` };
          const data = (await r.json()) as { models?: Array<{ name: string; size: number }> };
          const models = (data.models || []).map((m) => ({
            id: m.name,
            displayName: m.name,
            size: m.size,
            toolSupport: 'unknown' as const,
          }));
          return { success: true, models };
        } catch (e) {
          return { success: false, error: e instanceof Error ? e.message : 'Connection failed' };
        }
      };
    }
    if (key === 'testLiteLLMConnection') {
      return async (url: string) => {
        try {
          const r = await fetch(`${url}/models`, { signal: AbortSignal.timeout(10000) });
          return r.ok ? { success: true } : { success: false, error: `HTTP ${r.status}` };
        } catch (e) {
          return { success: false, error: e instanceof Error ? e.message : 'Connection failed' };
        }
      };
    }
    if (key === 'testLMStudioConnection') {
      return async (url: string) => {
        try {
          const r = await fetch(`${url}/v1/models`, { signal: AbortSignal.timeout(10000) });
          return r.ok ? { success: true } : { success: false, error: `HTTP ${r.status}` };
        } catch (e) {
          return { success: false, error: e instanceof Error ? e.message : 'Connection failed' };
        }
      };
    }

    // Browser-native replacements
    if (key === 'openExternal')
      return (url: string) => {
        window.open(url, '_blank');
      };
    // OpenAI "Sign in with ChatGPT": ask the daemon to start the OAuth flow,
    // then open the returned authorize URL in a new tab (UI polls status after).
    if (key === 'loginOpenAiWithChatGpt') {
      return async () => {
        const r = (await rpc('openai-oauth:login', [])) as { ok: boolean; openedUrl?: string };
        if (r?.openedUrl) {
          window.open(r.openedUrl, '_blank');
        }
        return r;
      };
    }
    if (key === 'getVersion') return async () => '0.0.0-browser';
    if (key === 'getPlatform')
      return async () => (navigator.platform.toLowerCase().includes('win') ? 'win32' : 'darwin');
    if (key === 'isE2EMode') return async () => false;
    if (key === 'getBuildCapabilities')
      return async () => ({ hasFreeMode: false, hasAnalytics: false });
    if (key === 'getOnboardingComplete') return async () => true;
    if (key === 'setOnboardingComplete') return noopAsync;

    // Browser-native file/folder pickers
    if (key === 'pickFiles') return () => browserPickFiles({ multiple: true });
    if (key === 'pickFolder')
      return async () => {
        const files = await browserPickFiles({ directory: true });
        if (!files.length) return null;
        const parts = (files[0].path as string).replace(/\\/g, '/').split('/');
        return parts.slice(0, -1).join('/') || files[0].name;
      };
    if (key === 'pickSkillFolder')
      return async () => {
        const files = await browserPickFiles({ directory: true });
        if (!files.length) return null;
        const parts = (files[0].path as string).replace(/\\/g, '/').split('/');
        return parts.slice(0, -1).join('/') || null;
      };

    // Electron-only / not available in browser — safe stubs
    if (key === 'respondToClose') return () => {};
    if (key === 'isAutoStartEnabled') return async () => false;
    if (key === 'getDaemonSocketPath') return async () => '';
    if (key === 'daemonStart' || key === 'daemonStop' || key === 'daemonRestart') {
      return async () => ({ success: false, message: 'Daemon is managed externally' });
    }
    if (key === 'startBrowserPreview') return async () => ({ success: false });
    if (key === 'stopBrowserPreview') return async () => ({ stopped: false });
    if (key === 'getBrowserPreviewStatus') return async () => ({ active: false });
    // speechTranscribe: audio is an ArrayBuffer, which can't go through the JSON
    // RPC table — base64-encode it (chunked, to avoid call-stack limits) and send.
    if (key === 'speechTranscribe') {
      return async (audioData: ArrayBuffer, mimeType?: string) => {
        const bytes = new Uint8Array(audioData);
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        return rpc('speech:transcribe', [btoa(binary), mimeType ?? 'audio/webm']);
      };
    }
    // Skills that require native OS (open in editor, show in folder) — not available in browser
    if (key === 'openSkillInEditor' || key === 'showSkillInFolder') return noopAsync;
    if (key === 'addSkillFromFolder') return noopAsync;

    // Analytics — OSS no-op
    if (key === 'analytics') return new Proxy({}, { get: () => noopAsync });

    // Google Workspace — stub (OAuth requires Electron redirect)
    if (key === 'gws')
      return {
        listAccounts: async () => [],
        startAuth: async () => ({ state: '', authUrl: '' }),
        completeAuth: async () => {
          throw new Error('OAuth not supported in browser mode');
        },
        removeAccount: noopAsync,
        updateLabel: noopAsync,
        cancelAuth: noopAsync,
        onStatusChanged: noop,
        onAuthError: noop,
      };

    if (key.startsWith('on')) return noop;
    return noopAsync;
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).accomplishShell = nativeAccomplishShell ?? {
  isElectron: true,
  version: '0.0.0-browser',
  platform: navigator.platform.toLowerCase().includes('win') ? 'win32' : 'darwin',
};
