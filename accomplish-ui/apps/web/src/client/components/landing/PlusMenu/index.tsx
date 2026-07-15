import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from '@phosphor-icons/react';
import type { Skill } from '@accomplish_ai/agent-core/common';
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PlusMenuItems } from './PlusMenuItems';
import { CreateSkillModal } from '@/components/skills/CreateSkillModal';
import { createLogger } from '@/lib/logger';

const logger = createLogger('PlusMenu');

interface PlusMenuProps {
  onSkillSelect: (command: string) => void;
  onOpenSettings: (tab: 'skills') => void;
  onAttachFiles?: () => void;
  disabled?: boolean;
  attachmentCount?: number;
  maxAttachments?: number;
}

export function PlusMenu({
  onSkillSelect,
  onOpenSettings,
  onAttachFiles,
  disabled,
  attachmentCount = 0,
  maxAttachments = 5,
}: PlusMenuProps) {
  const { t } = useTranslation('home');
  const [open, setOpen] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (open && window.accomplish) {
      window.accomplish
        .getEnabledSkills()
        .then((skills) => setSkills(skills.filter((s) => !s.isHidden)))
        .catch((err) => logger.error('Failed to load skills:', err));

    }
  }, [open]);

  const handleRefresh = async () => {
    const accomplish = window.accomplish;
    if (!accomplish || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const [, updatedSkills] = await Promise.all([
        new Promise((resolve) => setTimeout(resolve, 600)),
        accomplish.resyncSkills().then(() => accomplish.getEnabledSkills()),
      ]);
      setSkills(updatedSkills.filter((s) => !s.isHidden));
    } catch (err) {
      logger.error('Failed to refresh skills:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSkillSelect = (command: string) => {
    onSkillSelect(command);
    setOpen(false);
  };

  const handleManageSkills = () => {
    setOpen(false);
    onOpenSettings('skills');
  };

  const handleCreateNewSkill = () => {
    setOpen(false);
    setCreateModalOpen(true);
  };


  return (
    <>
      <CreateSkillModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            disabled={disabled}
            className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            title={t('plusMenu.addContent')}
          >
            <Plus className="h-4 w-4" weight="light" />
          </button>
        </DropdownMenuTrigger>
        <PlusMenuItems
          skills={skills}
          attachmentCount={attachmentCount}
          maxAttachments={maxAttachments}
          isRefreshing={isRefreshing}
          onAttachFiles={
            onAttachFiles
              ? () => {
                  onAttachFiles();
                  setOpen(false);
                }
              : undefined
          }
          onSkillSelect={handleSkillSelect}
          onManageSkills={handleManageSkills}
          onCreateNewSkill={handleCreateNewSkill}
          onRefresh={handleRefresh}
        />
      </DropdownMenu>
    </>
  );
}
