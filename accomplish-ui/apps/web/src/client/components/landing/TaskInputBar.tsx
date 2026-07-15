'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WarningCircle } from '@phosphor-icons/react';
import type { FileAttachmentInfo } from '@accomplish_ai/agent-core';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AUTO_MODE_CHANGE_EVENT, isAutoMode } from '@/lib/auto-model';
import { cn } from '@/lib/utils';
import { TaskInputAttachmentList } from './TaskInputAttachmentList';
import { TaskInputTextarea } from './TaskInputTextarea';
import { TaskInputToolbar } from './TaskInputToolbar';
import { useTaskInputBar } from './useTaskInputBar';

export { FileTypeIcon } from './FileTypeIcon';

interface TaskInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  typingPlaceholder?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  large?: boolean;
  autoFocus?: boolean;
  onOpenSpeechSettings?: () => void;
  onOpenModelSettings?: () => void;
  hideModelWhenNoModel?: boolean;
  autoSubmitOnTranscription?: boolean;
  toolbarLeft?: ReactNode;
  attachments?: FileAttachmentInfo[];
  onAttachmentsChange?: (attachments: FileAttachmentInfo[]) => void;
  attachmentError?: string | null;
}

export function TaskInputBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Assign a task or ask anything',
  typingPlaceholder = false,
  isLoading = false,
  disabled = false,
  large: _large = false,
  autoFocus = false,
  onOpenSpeechSettings,
  onOpenModelSettings,
  hideModelWhenNoModel = false,
  autoSubmitOnTranscription = true,
  toolbarLeft,
  attachments = [],
  onAttachmentsChange,
  attachmentError: externalAttachmentError = null,
}: TaskInputBarProps) {
  const { t } = useTranslation('common');
  const [autoModeEnabled, setAutoModeEnabled] = useState(() => isAutoMode());

  const {
    textareaRef,
    effectivePlaceholder,
    isInputDisabled,
    isOverLimit,
    isSubmitDisabled,
    attachmentError,
    slashCommand,
    speechInput,
    behavior,
    isDragOver,
    removeAttachment,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    MAX_FILES,
    MAX_FILE_SIZE,
  } = useTaskInputBar({
    value,
    onChange,
    onSubmit,
    placeholder,
    typingPlaceholder,
    isLoading,
    disabled,
    autoFocus,
    autoSubmitOnTranscription,
    attachments,
    onAttachmentsChange,
    externalAttachmentError,
  });

  useEffect(() => {
    const syncAutoMode = () => {
      setAutoModeEnabled(isAutoMode());
    };

    syncAutoMode();
    window.addEventListener(AUTO_MODE_CHANGE_EVENT, syncAutoMode);
    window.addEventListener('storage', syncAutoMode);

    return () => {
      window.removeEventListener(AUTO_MODE_CHANGE_EVENT, syncAutoMode);
      window.removeEventListener('storage', syncAutoMode);
    };
  }, []);

  return (
    <div className="w-full space-y-2">
      {speechInput.error && (
        <Alert
          variant="destructive"
          className="py-2 px-3 flex items-center gap-2 [&>svg]:static [&>svg~*]:pl-0"
        >
          <WarningCircle className="h-4 w-4" />
          <AlertDescription className="text-xs leading-tight">
            {speechInput.error.message}
            {speechInput.error.code === 'EMPTY_RESULT' && (
              <button
                onClick={() => speechInput.retry()}
                className="ml-2 underline hover:no-underline"
                type="button"
              >
                {t('buttons.retry')}
              </button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div
        className={cn(
          'srim-composer group relative overflow-hidden rounded-[20px] border bg-card/90 shadow-[0_18px_60px_-32px_hsl(var(--foreground)/0.24)] transition-all duration-300 ease-accomplish cursor-text backdrop-blur-sm focus-within:border-primary/35 focus-within:shadow-[0_22px_80px_-36px_hsl(var(--primary)/0.32)] hover:-translate-y-0.5 hover:shadow-[0_24px_80px_-36px_hsl(var(--primary)/0.24)]',
          isDragOver
            ? 'border-primary/60 ring-1 ring-primary/30 bg-primary/5'
            : 'border-border/70',
        )}
        onClick={() => !isDragOver && textareaRef.current?.focus()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="srim-composer-line pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />

        {isDragOver && (
          <div className="px-4 py-4 text-center">
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-primary shadow-sm">
              <span className="inline-flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              Ready to drop
            </div>
            <div className="mt-2 text-sm font-medium text-primary">
              {t('plusMenu.dropFilesHere')}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('plusMenu.dropFilesHint', { max: MAX_FILES, size: MAX_FILE_SIZE / 1024 / 1024 })}
            </p>
          </div>
        )}

        {!isDragOver && (
        <TaskInputTextarea
            textareaRef={textareaRef}
            value={value}
            onChange={onChange}
            onKeyDown={behavior.handleKeyDown}
            placeholder={effectivePlaceholder}
            disabled={isInputDisabled}
            isRecording={speechInput.isRecording}
            slashCommand={slashCommand}
          />
        )}

        <TaskInputAttachmentList
          attachments={isDragOver ? [] : attachments}
          attachmentError={attachmentError}
          onRemove={removeAttachment}
        />

        <TaskInputToolbar
          toolbarLeft={toolbarLeft}
          onOpenModelSettings={onOpenModelSettings}
          hideModelWhenNoModel={hideModelWhenNoModel}
          speechInput={speechInput}
          onOpenSpeechSettings={onOpenSpeechSettings}
          isSubmitDisabled={isSubmitDisabled}
          isLoading={isLoading}
          isInputDisabled={isInputDisabled}
          slashCommandOpen={slashCommand.state.isOpen}
          onSubmit={onSubmit}
          isRecording={speechInput.isRecording}
          value={value}
          isOverLimit={isOverLimit}
          attachmentsCount={attachments.length}
        />
      </div>

      {autoModeEnabled && (
        <div className="srim-auto-status flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-foreground/80">
          <span className="inline-flex h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="font-medium text-foreground">DigiBull Auto is on.</span>
          <span className="text-muted-foreground">The model is picked from the task you type.</span>
        </div>
      )}
    </div>
  );
}
