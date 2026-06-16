'use client';

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useTaskStore } from '@/stores/taskStore';
import { getAccomplish } from '@/lib/accomplish';
import { staggerContainer } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import ConversationListItem from './ConversationListItem';
import SettingsDialog from './SettingsDialog';
import WorkspaceSelector from './WorkspaceSelector';
import { Gear, ChatText, MagnifyingGlass } from '@phosphor-icons/react';
import { DaemonStatusDot } from '@/components/DaemonStatusDot';
import logoImage from '/assets/digibull-logo.png';

export default function Sidebar() {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    | 'providers'
    | 'voice'
    | 'skills'
    | 'integrations'
    | 'workspaces'
    | 'scheduler'
    | 'general'
    | 'about'
  >('providers');
  const { tasks, loadTasks, updateTaskStatus, addTaskUpdate, openLauncher } = useTaskStore();
  const accomplish = getAccomplish();
  const { t } = useTranslation('sidebar');

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Subscribe to task status changes (queued -> running) and task updates (complete/error)
  // This ensures sidebar always reflects current task status
  useEffect(() => {
    const unsubscribeStatusChange = accomplish.onTaskStatusChange?.((data) => {
      updateTaskStatus(data.taskId, data.status);
    });

    const unsubscribeTaskUpdate = accomplish.onTaskUpdate((event) => {
      addTaskUpdate(event);
    });

    return () => {
      unsubscribeStatusChange?.();
      unsubscribeTaskUpdate();
    };
  }, [updateTaskStatus, addTaskUpdate, accomplish]);

  const handleNewConversation = () => {
    navigate('/');
  };

  return (
    <>
      <div className="flex h-screen w-[260px] flex-col border-r border-white/[0.07] bg-[#020B18] pt-12">
        {/* Workspace Selector */}
        <div className="px-3 pt-3 pb-1">
          <WorkspaceSelector
            onManageWorkspaces={() => {
              setSettingsInitialTab('workspaces');
              setShowSettings(true);
            }}
          />
        </div>

        {/* Action Buttons */}
        <div className="px-3 py-3 border-b border-white/[0.07] flex gap-2">
          <Button
            data-testid="sidebar-new-task-button"
            onClick={handleNewConversation}
            variant="default"
            size="sm"
            className="flex-1 justify-center gap-2"
            title={t('newTask')}
          >
            <ChatText className="h-4 w-4" />
            {t('newTask')}
          </Button>
          <Button
            onClick={openLauncher}
            variant="outline"
            size="sm"
            className="px-2"
            title={t('searchTasks')}
          >
            <MagnifyingGlass className="h-4 w-4" />
          </Button>
        </div>

        {/* Conversation List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            <AnimatePresence mode="wait">
              {tasks.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {t('noConversations')}
                </motion.div>
              ) : (
                <motion.div
                  key="task-list"
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="space-y-1"
                >
                  {tasks.map((task) => (
                    <ConversationListItem key={task.id} task={task} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Bottom Section - Logo and Settings */}
        <div className="px-3 py-4 border-t border-white/[0.07] flex items-center justify-between">
          {/* Logo - Bottom Left */}
          <div className="flex items-center gap-2 pl-1.5">
            <img
              src={logoImage}
              alt="SRIM"
              style={{ height: '26px', width: '26px', objectFit: 'contain' }}
            />
            <span
              className="text-sm font-black tracking-wide"
              style={{
                background: 'linear-gradient(135deg,#ffffff 0%,#67e8f9 44%,#facc15 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              SRIM
            </span>
          </div>

          {/* Settings Button + Daemon Status - Bottom Right */}
          <div className="flex items-center gap-2">
            <DaemonStatusDot />
            <Button
              data-testid="sidebar-settings-button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setSettingsInitialTab('providers');
                setShowSettings(true);
              }}
              title={t('settings')}
            >
              <Gear className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        initialTab={settingsInitialTab}
      />
    </>
  );
}
