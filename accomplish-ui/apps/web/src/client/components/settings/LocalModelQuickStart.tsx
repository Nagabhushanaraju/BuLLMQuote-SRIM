import { motion } from 'framer-motion';
import type { ProviderId } from '@accomplish_ai/agent-core/common';
import { springs } from '@/lib/animations';
import { FormError, ModelSelector } from './shared';
import { LocalModelRuntimeSelector } from './LocalModelRuntimeSelector';
import { useHuggingFaceProviderConnect } from './providers/useHuggingFaceProviderConnect';

interface LocalModelQuickStartProps {
  onOpenProvider: (providerId: ProviderId) => void;
}

function ProgressBar({ progress, modelId }: { progress: number; modelId: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate pr-3">{modelId}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export function LocalModelQuickStart({ onOpenProvider }: LocalModelQuickStartProps) {
  const {
    selectedModelId,
    setSelectedModelId,
    devicePreference,
    setDevicePreference,
    connecting,
    error,
    downloadProgress,
    isDownloading,
    cachedModels,
    allModels,
    serverStatus,
    handleConnect,
    handleDisconnect,
  } = useHuggingFaceProviderConnect({
    onConnect: async () => {},
    onDisconnect: async () => {},
  });

  const selectedLabel =
    allModels.find((model) => model.id === selectedModelId)?.name || selectedModelId;
  const isCachedModel = cachedModels.some((model) => model.id === selectedModelId);
  const isServerRunning = serverStatus.running;
  const modelState = (() => {
    if (error) {
      return {
        label: 'Failed',
        className: 'bg-destructive/10 text-destructive',
        dotClassName: 'bg-destructive',
      };
    }
    if (isDownloading) {
      return {
        label: 'Downloading...',
        className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
        dotClassName: 'bg-sky-500',
      };
    }
    if (!selectedModelId) {
      return {
        label: 'No model selected',
        className: 'bg-muted text-muted-foreground',
        dotClassName: 'bg-muted-foreground/60',
      };
    }
    if (isCachedModel) {
      return {
        label: 'Installed',
        className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        dotClassName: 'bg-emerald-500',
      };
    }
    return {
      label: 'Ready to download',
      className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
      dotClassName: 'bg-amber-500',
    };
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.gentle}
      className="mb-4 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold tracking-wide text-foreground">
            LOCAL MODEL DOWNLOADS
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Download a local model right here, choose where it runs, then jump into the HuggingFace
            Local provider when you want to connect it.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenProvider('huggingface-local')}
          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/20 hover:bg-primary/5"
        >
          Open provider
        </button>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
        <div className="space-y-3">
          <ModelSelector
            models={allModels}
            value={selectedModelId || null}
            onChange={setSelectedModelId}
            error={false}
            placeholder="Pick a local model"
          />

          {isDownloading && selectedModelId && (
            <ProgressBar progress={downloadProgress} modelId={selectedLabel} />
          )}

          <FormError error={error} />

          <div className="rounded-xl border border-border bg-background/70 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Status
              </span>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs ${
                  isServerRunning
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isServerRunning ? 'bg-emerald-500' : 'bg-muted-foreground/60'
                  }`}
                />
                {isServerRunning
                  ? `Running on port ${serverStatus.port ?? 'local'}`
                  : 'Model server is idle'}
              </span>
              {selectedLabel && (
                <span className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground/80">
                  {selectedLabel}
                </span>
              )}
              <span
                className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs ${modelState.className}`}
              >
                <span className={`h-2 w-2 rounded-full ${modelState.dotClassName}`} />
                {modelState.label}
              </span>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              {isServerRunning
                ? 'Your local inference server is already up. You can keep it running or switch models.'
                : 'Cached models start faster. New ones will download before the local server starts.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleConnect()}
              disabled={connecting || !selectedModelId}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connecting
                ? 'Preparing local model...'
                : isCachedModel
                  ? 'Run cached model'
                  : 'Download and run'}
            </button>

            <button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={!isServerRunning}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-destructive/25 hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Stop local server
            </button>
          </div>
        </div>

        <LocalModelRuntimeSelector
          devicePreference={devicePreference}
          onChange={setDevicePreference}
        />
      </div>
    </motion.div>
  );
}
