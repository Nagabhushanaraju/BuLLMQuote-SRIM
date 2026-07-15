import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp } from '@phosphor-icons/react';
import type { useSpeechInput } from '@/hooks/useSpeechInput';
import { ModelIndicator } from '@/components/ui/ModelIndicator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getAccomplish } from '@/lib/accomplish';

interface TaskInputToolbarProps {
  toolbarLeft?: ReactNode;
  onOpenModelSettings?: () => void;
  hideModelWhenNoModel?: boolean;
  speechInput: ReturnType<typeof useSpeechInput>;
  onOpenSpeechSettings?: () => void;
  isSubmitDisabled: boolean;
  isLoading: boolean;
  isInputDisabled: boolean;
  slashCommandOpen: boolean;
  onSubmit: () => void;
  isRecording: boolean;
  value: string;
  isOverLimit: boolean;
  attachmentsCount: number;
}

export function TaskInputToolbar({
  toolbarLeft,
  onOpenModelSettings,
  hideModelWhenNoModel = false,
  speechInput,
  onOpenSpeechSettings,
  isSubmitDisabled,
  isLoading,
  isInputDisabled,
  slashCommandOpen,
  onSubmit,
  isRecording,
  value,
  isOverLimit,
  attachmentsCount,
}: TaskInputToolbarProps) {
  const { t } = useTranslation('common');
  const accomplish = getAccomplish();
  const submitLabel = isLoading ? t('buttons.stop') : t('buttons.submit');
  const isButtonDisabled = isSubmitDisabled || isRecording || slashCommandOpen;

  const buttonColorClass = isLoading
    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
    : isSubmitDisabled || isRecording
      ? 'bg-muted text-muted-foreground/60'
      : 'bg-primary text-primary-foreground hover:bg-primary/90';

  const tooltipText = isOverLimit
    ? t('buttons.messageTooLong')
    : !value.trim() && attachmentsCount === 0
      ? t('buttons.enterMessage')
      : submitLabel;
  const buttonTitle = isButtonDisabled ? tooltipText : submitLabel;

  return (
    <div className="flex h-[40px] items-center justify-between border-t border-border/60 bg-background/40 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center">{toolbarLeft}</div>

      <div className="flex items-center gap-3">
        {onOpenModelSettings && (
          <ModelIndicator
            isRunning={false}
            onOpenSettings={onOpenModelSettings}
            hideWhenNoModel={hideModelWhenNoModel}
          />
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex" title={buttonTitle}>
              <button
                data-testid="task-input-submit"
                type="button"
                aria-label={submitLabel}
                aria-disabled={isButtonDisabled}
                onClick={() => {
                  accomplish.logEvent({
                    level: 'info',
                    message: 'Task input submit clicked',
                    context: {
                      promptLength: value.length,
                      attachmentsCount,
                    },
                  });
                  onSubmit();
                }}
                disabled={isButtonDisabled}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/50 transition-all duration-200 ease-accomplish shadow-sm ${buttonColorClass}`}
              >
                {isLoading ? (
                  <span className="block h-[10px] w-[10px] rounded-[1.5px] bg-destructive-foreground" />
                ) : (
                  <ArrowUp className="h-4 w-4" weight="bold" />
                )}
              </button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <span>{tooltipText}</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
