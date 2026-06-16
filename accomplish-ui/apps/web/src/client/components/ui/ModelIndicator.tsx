/**
 * ModelIndicator component
 *
 * Ultra-minimal Claude-style model selector.
 * Shows current model with inline switching for same-provider siblings
 * and sub-menu access to all other connected providers.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretDown, Warning } from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getModelDisplayName,
  DEFAULT_PROVIDERS,
  PROVIDER_META,
} from '@accomplish_ai/agent-core/common';
import type { ProviderId, ConnectedProvider } from '@accomplish_ai/agent-core/common';
import { useProviderSettings } from '@/components/settings/hooks/useProviderSettings';
import { logger } from '@/lib/logger';
import { ProviderSubMenu } from '@/components/ui/ProviderSubMenu';
import { cn } from '@/lib/utils';
import { AUTO_MODE_CHANGE_EVENT, isAutoMode, setAutoMode } from '@/lib/auto-model';

interface ModelIndicatorProps {
  /** Whether a task is currently running */
  isRunning?: boolean;
  /**
   * @deprecated No longer used inside the dropdown. Kept for call-site compatibility.
   */
  onOpenSettings?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Hide the indicator when no model is selected (instead of showing warning) */
  hideWhenNoModel?: boolean;
}

export function ModelIndicator({
  isRunning = false,
  className,
  hideWhenNoModel = false,
}: ModelIndicatorProps) {
  const { t } = useTranslation('common');
  const { settings, loading, refetch, updateModel, switchProviderModel } = useProviderSettings();
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState(isAutoMode());

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        refetch();
      }
      setOpen(isOpen);
    },
    [refetch],
  );

  useEffect(() => {
    refetch();
    const interval = setInterval(refetch, 2000);
    return () => clearInterval(interval);
  }, [refetch]);

  useEffect(() => {
    const syncAutoMode = () => setAuto(isAutoMode());
    const handleAutoChange = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setAuto(Boolean(customEvent.detail));
    };

    window.addEventListener(AUTO_MODE_CHANGE_EVENT, handleAutoChange);
    window.addEventListener('storage', syncAutoMode);
    return () => {
      window.removeEventListener(AUTO_MODE_CHANGE_EVENT, handleAutoChange);
      window.removeEventListener('storage', syncAutoMode);
    };
  }, []);

  const activeProviderId = settings?.activeProviderId;
  const activeProvider = activeProviderId ? settings?.connectedProviders[activeProviderId] : null;
  const selectedModelId = activeProvider?.selectedModelId;

  const hasModel = Boolean(activeProviderId && selectedModelId);
  const modelDisplayName = selectedModelId ? getModelDisplayName(selectedModelId) : null;
  const isWarning = !hasModel && !loading;

  const siblingModels: Array<{ id: string; displayName: string }> = (() => {
    if (!activeProviderId) {
      return [];
    }
    const dynamic = activeProvider?.availableModels;
    // undefined → fall back to static config; explicit [] → real empty state, don't fall back
    const source =
      dynamic !== undefined
        ? dynamic.map((m) => ({ id: m.id, displayName: m.name }))
        : (DEFAULT_PROVIDERS.find((p) => p.id === activeProviderId)?.models ?? []).map((m) => ({
            id: m.fullId,
            displayName: getModelDisplayName(m.fullId),
          }));
    return selectedModelId != null ? source.filter((m) => m.id !== selectedModelId) : source;
  })();

  const otherProviders = Object.entries(settings?.connectedProviders ?? {}).filter(
    ([id, p]) => id !== activeProviderId && p.connectionStatus === 'connected',
  ) as Array<[ProviderId, ConnectedProvider]>;

  const handleSelectModel = useCallback(
    async (modelId: string) => {
      if (!activeProviderId) {
        return;
      }
      try {
        await updateModel(activeProviderId, modelId);
        setAutoMode(false);
        setAuto(false);
        setOpen(false);
      } catch (err) {
        logger.error('Failed to update model in handleSelectModel', err);
        setOpen(true);
      }
    },
    [activeProviderId, updateModel],
  );

  const handleSelectProviderModel = useCallback(
    async (providerId: ProviderId, modelId: string) => {
      try {
        await switchProviderModel(providerId, modelId);
        setAutoMode(false);
        setAuto(false);
        setOpen(false);
      } catch (err) {
        logger.error('Failed to switch provider model', err);
        setOpen(true);
      }
    },
    [switchProviderModel],
  );

  if (loading) {
    return (
      <div className={cn('flex items-center gap-1 px-1 animate-pulse', className)}>
        <div className="w-20 h-4 rounded bg-muted-foreground/10" />
      </div>
    );
  }

  if (hideWhenNoModel && !hasModel) {
    return null;
  }

  if (isRunning) {
    return (
      <div
        className={cn('flex items-center gap-1 px-2 py-1', className)}
        data-testid="model-indicator-trigger"
      >
        {auto && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
        <span className="text-[13px] font-medium text-foreground/60">
          {auto ? 'Auto' : modelDisplayName}
        </span>
      </div>
    );
  }

  const providerLabel = activeProviderId
    ? (PROVIDER_META[activeProviderId]?.name ?? activeProviderId)
    : null;

  let triggerLabel: string;
  if (isWarning) {
    triggerLabel = t('model.selectModel');
  } else if (auto) {
    triggerLabel = 'Auto';
  } else {
    triggerLabel = modelDisplayName ?? '';
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-all duration-150',
            'hover:bg-black/[0.04] dark:hover:bg-white/[0.08] focus:outline-none hover:-translate-y-px',
            isWarning && 'text-warning',
            auto &&
              'border border-primary/15 bg-primary/8 text-primary shadow-[0_10px_28px_-20px_hsl(var(--primary)/0.7)] hover:bg-primary/12',
            className,
          )}
          data-testid="model-indicator-trigger"
        >
          {auto && !isWarning && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          )}
          {isWarning && <Warning className="w-3.5 h-3.5 text-warning flex-shrink-0" />}
          <span
            className={cn(
              'text-[13px] font-medium',
              isWarning ? 'text-warning' : auto ? 'text-primary' : 'text-foreground/80',
            )}
          >
            {triggerLabel}
          </span>
          <CaretDown
            className={cn(
              'w-3 h-3 flex-shrink-0 transition-transform duration-150',
              isWarning ? 'text-warning/60' : 'text-muted-foreground/60',
              open && 'rotate-180',
            )}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-52 shadow-lg">
        <DropdownMenuItem
          disabled={isRunning}
          className="px-3 py-2 text-sm cursor-pointer"
          onSelect={(e) => {
            e.preventDefault();
            setAutoMode(true);
            setAuto(true);
            setOpen(false);
          }}
        >
          <span className="flex items-center gap-2">
            {auto && <span className="text-primary text-[10px]">●</span>}
            Auto · by task type
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {hasModel && (
          <div className="px-3 py-2">
            <div className="text-[11px] text-muted-foreground/60 uppercase tracking-wide mb-0.5">
              {providerLabel} · {t('model.current')}
            </div>
            <div className="text-sm font-medium text-foreground">{modelDisplayName}</div>
          </div>
        )}

        {activeProviderId && siblingModels.length > 0 && (
          <>
            {hasModel && <DropdownMenuSeparator />}
            {siblingModels.map((model) => (
              <DropdownMenuItem
                key={model.id}
                disabled={isRunning}
                className="px-3 py-2 text-sm cursor-pointer"
                onSelect={(e) => {
                  e.preventDefault();
                  void handleSelectModel(model.id);
                }}
              >
                {model.displayName}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {!activeProviderId && isWarning && (
          <div className="px-3 py-2 text-sm text-muted-foreground">{t('model.selectModel')}</div>
        )}

        {otherProviders.length > 0 && (
          <>
            {(hasModel || siblingModels.length > 0) && <DropdownMenuSeparator />}
            {otherProviders.map(([providerId, provider]) => (
              <ProviderSubMenu
                key={providerId}
                providerId={providerId}
                provider={provider}
                onSelectModel={handleSelectProviderModel}
                disabled={isRunning}
              />
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
