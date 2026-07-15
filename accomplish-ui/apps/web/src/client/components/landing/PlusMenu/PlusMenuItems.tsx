import { useTranslation } from 'react-i18next';
import { Paperclip } from '@phosphor-icons/react';
import type { Skill } from '@accomplish_ai/agent-core/common';
import {
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { SkillsSubmenu } from './SkillsSubmenu';

interface PlusMenuItemsProps {
  skills: Skill[];
  attachmentCount: number;
  maxAttachments: number;
  isRefreshing: boolean;
  onAttachFiles?: () => void;
  onSkillSelect: (command: string) => void;
  onManageSkills: () => void;
  onCreateNewSkill: () => void;
  onRefresh: () => void;
}

export function PlusMenuItems({
  skills,
  attachmentCount,
  maxAttachments,
  isRefreshing,
  onAttachFiles,
  onSkillSelect,
  onManageSkills,
  onCreateNewSkill,
  onRefresh,
}: PlusMenuItemsProps) {
  const { t } = useTranslation('home');

  return (
    <DropdownMenuContent align="start" className="w-[200px]">
      <DropdownMenuItem
        disabled={!onAttachFiles || attachmentCount >= maxAttachments}
        onSelect={() => {
          onAttachFiles?.();
        }}
      >
        <Paperclip className="h-4 w-4 mr-2 shrink-0" />
        {t('plusMenu.attachFiles')}
        {attachmentCount > 0 && (
          <span
            className="ml-auto pl-4 text-[10px] text-muted-foreground whitespace-nowrap"
            aria-label={`${attachmentCount} of ${maxAttachments} files attached`}
          >
            {attachmentCount}/{maxAttachments}
          </span>
        )}
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <svg
            className="h-4 w-4 mr-2"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {t('plusMenu.useSkills')}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-[280px] p-0">
          <SkillsSubmenu
            skills={skills}
            onSkillSelect={onSkillSelect}
            onManageSkills={onManageSkills}
            onCreateNewSkill={onCreateNewSkill}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
          />
        </DropdownMenuSubContent>
      </DropdownMenuSub>

    </DropdownMenuContent>
  );
}
