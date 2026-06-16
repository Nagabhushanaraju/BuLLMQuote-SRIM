import { useState, useEffect, useCallback } from 'react';
import { getAccomplish } from '@/lib/accomplish';
import type { ConnectedProvider } from '@accomplish_ai/agent-core/common';
import type { HuggingFaceLocalCredentials } from '@accomplish_ai/agent-core/common';

export interface SuggestedModel {
  id: string;
  displayName: string;
  downloaded: boolean;
  sizeBytes?: number;
}

export type HuggingFaceDevicePreference = 'auto' | 'cpu' | 'cuda' | 'webgpu';

interface HuggingFaceLocalConfigSnapshot {
  selectedModelId: string | null;
  serverPort: number | null;
  enabled: boolean;
  quantization: 'q4' | 'fp32' | null;
  devicePreference: HuggingFaceDevicePreference | null;
}

interface HuggingFaceServerStatus {
  running: boolean;
  port: number | null;
  loadedModel: string | null;
  isLoading: boolean;
}

export interface UseHuggingFaceProviderConnectReturn {
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  devicePreference: HuggingFaceDevicePreference;
  setDevicePreference: (devicePreference: HuggingFaceDevicePreference) => void;
  connecting: boolean;
  error: string | null;
  downloadProgress: number;
  isDownloading: boolean;
  suggestedModels: SuggestedModel[];
  cachedModels: SuggestedModel[];
  serverStatus: HuggingFaceServerStatus;
  allModels: Array<{ id: string; name: string }>;
  refreshModels: () => Promise<void>;
  handleConnect: () => Promise<void>;
  handleDisconnect: () => Promise<void>;
}

interface UseHuggingFaceProviderConnectParams {
  onConnect: (provider: ConnectedProvider) => void | Promise<void>;
  onDisconnect: () => void | Promise<void>;
}

const DEFAULT_SERVER_STATUS: HuggingFaceServerStatus = {
  running: false,
  port: null,
  loadedModel: null,
  isLoading: false,
};

const DEFAULT_CONFIG: HuggingFaceLocalConfigSnapshot = {
  selectedModelId: null,
  serverPort: null,
  enabled: true,
  quantization: 'q4',
  devicePreference: 'auto',
};

function normalizeServerStatus(
  status?: Partial<HuggingFaceServerStatus> | null,
): HuggingFaceServerStatus {
  return {
    ...DEFAULT_SERVER_STATUS,
    ...(status ?? {}),
  };
}

function chooseModelId(
  allModelIds: string[],
  preferred?: string | null,
  current?: string | null,
): string {
  const candidates = [preferred, current, allModelIds[0]];
  return (
    candidates.find((candidate): candidate is string =>
      Boolean(candidate && allModelIds.includes(candidate)),
    ) ?? ''
  );
}

export function useHuggingFaceProviderConnect({
  onConnect,
  onDisconnect,
}: UseHuggingFaceProviderConnectParams): UseHuggingFaceProviderConnectReturn {
  const [selectedModelId, setSelectedModelId] = useState('');
  const [configSnapshot, setConfigSnapshot] =
    useState<HuggingFaceLocalConfigSnapshot>(DEFAULT_CONFIG);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [suggestedModels, setSuggestedModels] = useState<SuggestedModel[]>([]);
  const [cachedModels, setCachedModels] = useState<SuggestedModel[]>([]);
  const [serverStatus, setServerStatus] = useState<HuggingFaceServerStatus>(DEFAULT_SERVER_STATUS);
  const [configReady, setConfigReady] = useState(false);

  const refreshModels = useCallback(async (preferredModelId?: string | null) => {
    const accomplish = getAccomplish();
    const { cached, suggested } = await accomplish.listHuggingFaceModels();
    setCachedModels(cached);
    setSuggestedModels(suggested);

    const dedupedModelIds = [
      ...cached.map((model) => model.id),
      ...suggested
        .filter((model) => !cached.some((cachedModel) => cachedModel.id === model.id))
        .map((model) => model.id),
    ];

    setSelectedModelId((current) => chooseModelId(dedupedModelIds, preferredModelId, current));
  }, []);

  const refreshServerStatus = useCallback(async () => {
    const accomplish = getAccomplish();
    try {
      const status = await accomplish.getHuggingFaceServerStatus();
      setServerStatus(normalizeServerStatus(status));
    } catch {
      setServerStatus(DEFAULT_SERVER_STATUS);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const accomplish = getAccomplish();

      try {
        const [config] = await Promise.all([accomplish.getHuggingFaceLocalConfig()]);
        if (cancelled) return;

        const nextConfig: HuggingFaceLocalConfigSnapshot = {
          ...DEFAULT_CONFIG,
          ...config,
          quantization: config?.quantization ?? DEFAULT_CONFIG.quantization,
          devicePreference: config?.devicePreference ?? DEFAULT_CONFIG.devicePreference,
        };

        setConfigSnapshot(nextConfig);
        await Promise.all([refreshModels(config?.selectedModelId), refreshServerStatus()]);
      } catch {
        if (!cancelled) {
          await Promise.allSettled([refreshModels(), refreshServerStatus()]);
        }
      } finally {
        if (!cancelled) {
          setConfigReady(true);
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [refreshModels, refreshServerStatus]);

  useEffect(() => {
    if (!configReady) {
      return;
    }

    const accomplish = getAccomplish();
    void accomplish.setHuggingFaceLocalConfig({
      selectedModelId: selectedModelId || null,
      serverPort: configSnapshot.serverPort,
      enabled: true,
      quantization: configSnapshot.quantization,
      devicePreference: configSnapshot.devicePreference,
    });
  }, [
    configReady,
    selectedModelId,
    configSnapshot.serverPort,
    configSnapshot.quantization,
    configSnapshot.devicePreference,
  ]);

  useEffect(() => {
    const accomplish = getAccomplish();
    const unsub = accomplish.onHuggingFaceDownloadProgress((progress) => {
      if (progress.status === 'downloading') {
        setDownloadProgress(progress.progress);
      } else if (progress.status === 'complete') {
        setDownloadProgress(100);
        setIsDownloading(false);
        void refreshModels(progress.modelId);
      } else if (progress.status === 'error') {
        setIsDownloading(false);
        setError(progress.error ?? 'Download failed');
      }
    });
    return () => {
      if (typeof unsub === 'function') {
        unsub();
      }
    };
  }, [refreshModels]);

  const setDevicePreference = useCallback((devicePreference: HuggingFaceDevicePreference) => {
    setConfigSnapshot((previous) => ({
      ...previous,
      devicePreference,
    }));
  }, []);

  const handleConnect = async () => {
    if (!selectedModelId) {
      setError('Please select a model first');
      return;
    }

    setConnecting(true);
    setIsDownloading(true);
    setDownloadProgress(0);
    setError(null);

    try {
      const accomplish = getAccomplish();
      await accomplish.setHuggingFaceLocalConfig({
        selectedModelId,
        serverPort: configSnapshot.serverPort,
        enabled: true,
        quantization: configSnapshot.quantization,
        devicePreference: configSnapshot.devicePreference,
      });

      const downloadResult = await accomplish.downloadHuggingFaceModel(selectedModelId);
      if (!downloadResult.success) {
        setError(downloadResult.error ?? 'Download failed');
        setIsDownloading(false);
        setConnecting(false);
        return;
      }

      setIsDownloading(false);

      const serverResult = await accomplish.startHuggingFaceServer(selectedModelId);
      if (!serverResult.success) {
        setError(serverResult.error ?? 'Failed to start inference server');
        setConnecting(false);
        return;
      }

      const modelDisplayId = `huggingface-local/${selectedModelId}`;

      const provider: ConnectedProvider = {
        providerId: 'huggingface-local',
        connectionStatus: 'connected',
        selectedModelId: modelDisplayId,
        credentials: {
          type: 'huggingface-local',
          modelId: selectedModelId,
        } as HuggingFaceLocalCredentials,
        lastConnectedAt: new Date().toISOString(),
        availableModels: [
          {
            id: modelDisplayId,
            name: selectedModelId.split('/').pop() ?? selectedModelId,
          },
        ],
      };

      await Promise.resolve(onConnect(provider));
      await Promise.all([refreshModels(selectedModelId), refreshServerStatus()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setIsDownloading(false);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const accomplish = getAccomplish();
      await accomplish.stopHuggingFaceServer();
    } catch {
      // Ignore errors during disconnect
    }
    setServerStatus(DEFAULT_SERVER_STATUS);
    await Promise.resolve(onDisconnect());
  };

  const allModels = [
    ...cachedModels.map((m) => ({ id: m.id, name: `${m.displayName} ✓` })),
    ...suggestedModels
      .filter((s) => !cachedModels.some((c) => c.id === s.id))
      .map((m) => ({ id: m.id, name: m.displayName })),
  ];

  return {
    selectedModelId,
    setSelectedModelId,
    devicePreference: configSnapshot.devicePreference ?? 'auto',
    setDevicePreference,
    connecting,
    error,
    downloadProgress,
    isDownloading,
    suggestedModels,
    cachedModels,
    serverStatus: normalizeServerStatus(serverStatus),
    allModels,
    refreshModels: async () => {
      await Promise.all([refreshModels(selectedModelId), refreshServerStatus()]);
    },
    handleConnect,
    handleDisconnect,
  };
}
