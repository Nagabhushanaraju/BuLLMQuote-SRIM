import type React from 'react';
import type { UseSlashCommandReturn } from '@/hooks/useSlashCommand';
import { SlashCommandPopover } from '@/components/landing/SlashCommandPopover';

interface TaskInputTextareaProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder: string;
  disabled: boolean;
  isRecording: boolean;
  slashCommand: UseSlashCommandReturn;
}

export function TaskInputTextarea({
  textareaRef,
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  isRecording,
  slashCommand,
}: TaskInputTextareaProps) {
  return (
    <div className="px-4 pt-3 pb-1 relative">
      <textarea
        data-testid="task-input-textarea"
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          slashCommand.handleChange(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled || isRecording}
        rows={3}
        aria-expanded={slashCommand.state.isOpen}
        aria-controls={slashCommand.state.isOpen ? 'slash-command-listbox' : undefined}
        aria-activedescendant={
          slashCommand.state.isOpen
            ? `slash-suggestion-${slashCommand.state.selectedIndex}`
            : undefined
        }
        className="w-full min-h-[72px] max-h-[220px] resize-none overflow-y-auto rounded-[14px] border border-transparent bg-background/70 px-4 py-3 text-[16px] leading-relaxed tracking-[-0.015em] text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors duration-200 focus:border-primary/25 focus:bg-background disabled:cursor-not-allowed disabled:opacity-50"
      />
      <SlashCommandPopover
        isOpen={slashCommand.state.isOpen}
        skills={slashCommand.state.filteredSkills}
        selectedIndex={slashCommand.state.selectedIndex}
        query={slashCommand.state.query}
        textareaRef={textareaRef}
        triggerStart={slashCommand.state.triggerStart}
        onSelect={slashCommand.selectSkill}
        onDismiss={slashCommand.dismiss}
      />
    </div>
  );
}
