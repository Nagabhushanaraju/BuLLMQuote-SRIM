import { cn } from '@/lib/utils';
import type { HuggingFaceDevicePreference } from './providers/useHuggingFaceProviderConnect';

interface LocalModelRuntimeSelectorProps {
  devicePreference: HuggingFaceDevicePreference;
  onChange: (devicePreference: HuggingFaceDevicePreference) => void;
  compact?: boolean;
}

const DEVICE_OPTIONS: Array<{
  value: HuggingFaceDevicePreference;
  label: string;
  description: string;
}> = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'Best available hardware',
  },
  {
    value: 'cuda',
    label: 'GPU',
    description: 'CUDA / local GPU',
  },
  {
    value: 'webgpu',
    label: 'WebGPU',
    description: 'Browser GPU (experimental)',
  },
  {
    value: 'cpu',
    label: 'CPU',
    description: 'Fallback (slow, most compatible)',
  },
];

export function LocalModelRuntimeSelector({
  devicePreference,
  onChange,
  compact = false,
}: LocalModelRuntimeSelectorProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-background/70 p-3', compact && 'p-2.5')}>
      <div className="mb-3">
        <div className="text-sm font-semibold text-foreground">Runtime target</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose where DigiBull should run the local model.
        </p>
      </div>

      <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 xl:grid-cols-4')}>
        {DEVICE_OPTIONS.map((option) => {
          const selected = option.value === devicePreference;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-xl border px-3 py-2 text-left transition-all duration-200',
                selected
                  ? 'border-primary bg-primary/10 text-primary shadow-[0_14px_36px_-28px_hsl(var(--primary)/0.8)]'
                  : 'border-border bg-card/70 text-foreground hover:border-primary/20 hover:bg-card',
              )}
            >
              <div className="text-sm font-medium">{option.label}</div>
              <div className="mt-1 text-[11px] leading-4 text-muted-foreground">
                {option.description}
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
        Multi-GPU selection (GPU 0 / GPU 1) is not supported yet - DigiBull uses automatic GPU
        selection whenever a GPU mode is selected.
      </p>
    </div>
  );
}
