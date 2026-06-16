/**
 * Settings, provider config, and API key dispatch handlers for the browser bridge.
 * Split from browser-bridge-dispatch.ts to stay under the 200-line file limit.
 */
import { getDaemonClient } from './daemon-bootstrap';
import type {
  OllamaConfig,
  LiteLLMConfig,
  ProviderId,
  ConnectedProvider,
  SelectedModel,
} from '@accomplish_ai/agent-core/desktop-main';
import {
  getAllApiKeys,
  storeApiKey,
  deleteApiKey,
  getBedrockCredentials,
} from './store/secureStorage';

type Fn = (args: unknown[]) => Promise<unknown>;
const str = (v: unknown) => v as string;
const bool = (v: unknown) => v as boolean;

export function buildSettingsDispatch(): Record<string, Fn> {
  const d = () => getDaemonClient();

  return {
    // ── App settings ────────────────────────────────────────────────────────
    'settings:notifications-enabled': async () => {
      const s = await d().call('settings.getAll');
      return s.notificationsEnabled;
    },
    'settings:set-notifications-enabled': async ([e]) =>
      d().call('settings.setNotificationsEnabled', { enabled: bool(e) }),
    'settings:debug-mode': async () => {
      const s = await d().call('settings.getAll');
      return s.app.debugMode;
    },
    'settings:set-debug-mode': async ([e]) =>
      d().call('settings.setDebugMode', { enabled: bool(e) }),
    'settings:theme': async () => {
      const s = await d().call('settings.getAll');
      return s.app.theme;
    },
    'settings:set-theme': async ([t]) =>
      d().call('settings.setTheme', { theme: str(t) as 'system' | 'light' | 'dark' }),
    'settings:language': async () => {
      const s = await d().call('settings.getAll');
      return s.app.language;
    },
    'settings:set-language': async ([l]) =>
      d().call('settings.setLanguage', {
        language: str(l) as 'auto' | 'en' | 'zh-CN' | 'ru' | 'fr',
      }),
    'settings:app-settings': async () => {
      const s = await d().call('settings.getAll');
      return s.app;
    },

    // ── API keys ────────────────────────────────────────────────────────────
    'settings:api-keys': async () => {
      const storedKeys = await getAllApiKeys();
      const bedrockCreds = storedKeys['bedrock'] ? await getBedrockCredentials() : null;
      const bc = bedrockCreds as Record<string, string> | null;
      const keys = Object.entries(storedKeys)
        .filter(([, v]) => v !== null)
        .map(([provider, apiKey]) => {
          let keyPrefix = apiKey && apiKey.length > 0 ? `${apiKey.substring(0, 8)}...` : '';
          let label = 'Local API Key';
          if (provider === 'bedrock') {
            label =
              bc?.authType === 'accessKeys'
                ? 'AWS Access Keys'
                : bc?.authType === 'profile'
                  ? `AWS Profile: ${bc.profileName || 'default'}`
                  : 'AWS Credentials';
            keyPrefix =
              bc?.authType === 'accessKeys'
                ? `${bc.accessKeyId?.substring(0, 8) || 'AKIA'}...`
                : bc?.authType === 'profile'
                  ? `Profile: ${bc.profileName || 'default'}`
                  : 'AWS Credentials';
          } else if (provider === 'vertex') {
            try {
              const c = apiKey ? (JSON.parse(apiKey) as Record<string, string>) : null;
              keyPrefix = c?.projectId
                ? `${c.projectId} (${c.location || 'unknown'})`
                : 'GCP Credentials';
              label =
                c?.authType === 'serviceAccount'
                  ? 'Service Account'
                  : 'Application Default Credentials';
            } catch {
              keyPrefix = 'GCP Credentials';
            }
          }
          return {
            id: `local-${provider}`,
            provider,
            label,
            keyPrefix,
            isActive: true,
            createdAt: new Date().toISOString(),
          };
        });
      const azureConfig = await d().call('settings.getAzureFoundryConfig');
      if (
        azureConfig?.authType === 'entra-id' &&
        !keys.some((k) => k.provider === 'azure-foundry')
      ) {
        keys.push({
          id: 'local-azure-foundry',
          provider: 'azure-foundry',
          label: 'Azure Foundry (Entra ID)',
          keyPrefix: 'Entra ID',
          isActive: azureConfig.enabled ?? true,
          createdAt: new Date().toISOString(),
        });
      }
      return keys;
    },
    'settings:add-api-key': async ([provider, key]) => {
      const p = str(provider);
      const k = str(key);
      await storeApiKey(p, k);
      return {
        id: `local-${p}`,
        provider: p,
        label: 'Local API Key',
        keyPrefix: `${k.substring(0, 8)}...`,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
    },
    'settings:remove-api-key': async ([id]) => {
      const provider = str(id).replace('local-', '');
      if (provider === 'azure-foundry') {
        const existing = await d().call('settings.getAzureFoundryConfig');
        if (existing) {
          await d().call('settings.setAzureFoundryConfig', {
            config: { ...existing, enabled: false, authType: 'api-key' as const },
          });
        }
        return;
      }
      await deleteApiKey(provider);
    },

    // ── Provider settings ───────────────────────────────────────────────────
    'model:get': async () => d().call('settings.getSelectedModel'),
    'model:set': async ([model]) =>
      d().call('settings.setSelectedModel', { model: model as SelectedModel }),
    'provider-settings:get': async () => d().call('provider.getSettings'),
    'provider-settings:set-active': async ([providerId]) =>
      d().call('provider.setActive', { providerId: providerId as ProviderId | null }),
    'provider-settings:get-connected': async ([providerId]) => {
      const s = await d().call('provider.getSettings');
      return (
        (s.connectedProviders as Record<string, ConnectedProvider | undefined>)[str(providerId)] ??
        null
      );
    },
    'provider-settings:set-connected': async ([providerId, provider]) =>
      d().call('provider.setConnected', {
        providerId: providerId as ProviderId,
        provider: provider as ConnectedProvider,
      }),
    'provider-settings:remove-connected': async ([providerId]) =>
      d().call('provider.removeConnected', { providerId: providerId as ProviderId }),
    'provider-settings:update-model': async ([providerId, modelId]) =>
      d().call('provider.updateModel', {
        providerId: providerId as ProviderId,
        modelId: modelId as string | null,
      }),
    'provider-settings:set-debug': async ([e]) =>
      d().call('provider.setDebugMode', { enabled: bool(e) }),
    'provider-settings:get-debug': async () => d().call('provider.getDebugMode'),

    // ── Provider configs ────────────────────────────────────────────────────
    'ollama:get-config': async () => d().call('settings.getOllamaConfig'),
    'ollama:set-config': async ([config]) =>
      d().call('settings.setOllamaConfig', { config: config as OllamaConfig | null }),
    'litellm:get-config': async () => d().call('settings.getLiteLLMConfig'),
    'litellm:set-config': async ([config]) =>
      d().call('settings.setLiteLLMConfig', { config: config as LiteLLMConfig | null }),

    // ── Accomplish AI ───────────────────────────────────────────────────────
    'accomplish-ai:connect': async () => d().call('accomplish-ai.connect'),
    'accomplish-ai:ensure-ready': async () => d().call('accomplish-ai.connect'),
    'accomplish-ai:disconnect': async () => {
      await d()
        .call('accomplish-ai.disconnect')
        .catch(() => {});
      await d().call('provider.removeConnected', { providerId: 'accomplish-ai' as ProviderId });
    },
    'accomplish-ai:get-usage': async () => d().call('accomplish-ai.get-usage'),
    'accomplish-ai:get-status': async () => {
      const s = await d().call('provider.getSettings');
      const cp = s.connectedProviders as Record<string, { connectionStatus?: string } | undefined>;
      return { connected: cp['accomplish-ai']?.connectionStatus === 'connected' };
    },

    // ── Close behavior ──────────────────────────────────────────────────────
    'daemon:get-close-behavior': async () => d().call('settings.getCloseBehavior'),
    'daemon:set-close-behavior': async ([behavior]) =>
      d().call('settings.setCloseBehavior', {
        behavior: str(behavior) as 'keep-daemon' | 'stop-daemon',
      }),
  };
}
