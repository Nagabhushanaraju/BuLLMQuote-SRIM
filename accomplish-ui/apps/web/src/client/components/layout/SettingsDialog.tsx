import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { SignOut } from '@phosphor-icons/react';
import { settingsVariants, settingsTransitions } from '@/lib/animations';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ProviderId } from '@accomplish_ai/agent-core/common';
import { ProviderGrid } from '@/components/settings/ProviderGrid';
import { ProviderSettingsPanel } from '@/components/settings/ProviderSettingsPanel';
import { SpeechSettingsForm } from '@/components/settings/SpeechSettingsForm';
import { SkillsPanel, AddSkillDropdown } from '@/components/settings/skills';
import { WorkspacesPanel } from '@/components/settings/WorkspacesPanel';
import { AboutTab } from '@/components/settings/AboutTab';
import { GeneralTab } from '@/components/settings/GeneralTab';
import { SandboxSection } from '@/components/settings/SandboxSection';
import { IntegrationsPanel } from '@/components/settings/integrations';
import { SchedulerPanel } from '@/components/settings/scheduler';

import { CloudBrowsersPanel } from '@/components/settings/CloudBrowsersPanel';
import { cn } from '@/lib/utils';
import { logout } from '@/lib/session';
import logoImage from '/assets/digibull-logo.png';
import { SETTINGS_TABS, type SettingsTabId } from './settings-tabs';
import { useSettingsDialog } from './useSettingsDialog';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApiKeySaved?: () => void;
  initialProvider?: ProviderId;
  initialTab?: SettingsTabId;
}

export function SettingsDialog({
  open,
  onOpenChange,
  onApiKeySaved,
  initialProvider,
  initialTab = 'providers',
}: SettingsDialogProps) {
  const { t } = useTranslation('settings');
  const s = useSettingsDialog({ open, onOpenChange, onApiKeySaved, initialProvider, initialTab });
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true, state: { loggedOut: true } });
  };

  if (s.loading || !s.settings) {
    return (
      <Dialog open={open} onOpenChange={s.handleOpenChange}>
        <DialogContent
          className="max-w-4xl w-full h-[80vh] max-h-[720px] flex flex-col overflow-hidden p-0"
          data-testid="settings-dialog"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{t('title')}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={s.handleOpenChange}>
      <DialogContent
        className="max-w-4xl w-full h-[80vh] max-h-[720px] flex overflow-hidden p-0"
        data-testid="settings-dialog"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <nav className="w-48 shrink-0 border-r border-border bg-muted/30 p-3 flex flex-col h-full">
          <div className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0">
            <div className="px-3 py-2 mb-1 flex items-center gap-2">
              <img
                src={logoImage}
                alt="SRIM"
                style={{ height: '24px', width: '24px', objectFit: 'contain' }}
              />
              <span className="text-sm font-bold text-foreground tracking-wide">SRIM</span>
            </div>
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => s.setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left',
                  s.activeTab === tab.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
                )}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
          <div className="pt-2 border-t border-border shrink-0">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <SignOut className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          </div>
        </nav>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <h3 className="text-sm font-semibold text-foreground">
              {SETTINGS_TABS.find((tab) => tab.id === s.activeTab)?.labelKey &&
                t(SETTINGS_TABS.find((tab) => tab.id === s.activeTab)!.labelKey)}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-6">
              <AnimatePresence>
                {s.closeWarning && (
                  <motion.div
                    className="rounded-lg border border-warning bg-warning/10 p-4 mb-6"
                    variants={settingsVariants.fadeSlide}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={settingsTransitions.enter}
                  >
                    <div className="flex items-start gap-3">
                      <svg
                        className="h-5 w-5 text-warning flex-shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-warning">
                          {t('warnings.noProviderReady')}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t('warnings.noProviderReadyDescription')}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={s.handleForceClose}
                            className="rounded-md px-3 py-1.5 text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80"
                          >
                            {t('warnings.closeAnyway')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {s.activeTab === 'providers' && (
                <div className="space-y-6">
                  <section>
                    <ProviderGrid
                      settings={s.settings}
                      selectedProvider={s.selectedProvider}
                      onSelectProvider={s.handleSelectProvider}
                      expanded={s.gridExpanded}
                      onToggleExpanded={() => s.setGridExpanded(!s.gridExpanded)}
                    />
                  </section>
                  <AnimatePresence>
                    {s.selectedProvider && (
                      <motion.section
                        variants={settingsVariants.slideDown}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={settingsTransitions.enter}
                      >
                        <ProviderSettingsPanel
                          key={s.selectedProvider}
                          providerId={s.selectedProvider}
                          connectedProvider={s.settings?.connectedProviders?.[s.selectedProvider]}
                          onConnect={s.handleConnect}
                          onUpdateProvider={s.handleUpdateProvider}
                          onDisconnect={s.handleDisconnect}
                          onModelChange={s.handleModelChange}
                          showModelError={s.showModelError}
                        />
                      </motion.section>
                    )}
                  </AnimatePresence>
                  <SandboxSection visible={!!s.selectedProvider} />
                </div>
              )}

              {s.activeTab === 'skills' && (
                <div className="space-y-4">
                  <SkillsPanel refreshTrigger={s.skillsRefreshTrigger} />
                </div>
              )}
              {s.activeTab === 'browsers' && (
                <div className="space-y-6">
                  <CloudBrowsersPanel />
                </div>
              )}
              {s.activeTab === 'integrations' && (
                <div className="space-y-6">
                  <IntegrationsPanel />
                </div>
              )}
              {s.activeTab === 'scheduler' && (
                <div className="space-y-6">
                  <SchedulerPanel />
                </div>
              )}
              {s.activeTab === 'workspaces' && (
                <div className="space-y-6">
                  <WorkspacesPanel />
                </div>
              )}
              {s.activeTab === 'voice' && (
                <div className="space-y-6">
                  <SpeechSettingsForm />
                </div>
              )}
              {s.activeTab === 'general' && (
                <GeneralTab
                  notificationsEnabled={s.notificationsEnabled}
                  onNotificationsToggle={s.handleNotificationsToggle}
                  debugMode={s.debugMode}
                  onDebugToggle={s.handleDebugToggle}
                />
              )}
              {s.activeTab === 'about' && <AboutTab appVersion={s.appVersion} />}

              <div className="mt-4 flex items-center justify-between">
                <div>
                  {s.activeTab === 'skills' && (
                    <AddSkillDropdown
                      onSkillAdded={() => s.setSkillsRefreshTrigger((prev) => prev + 1)}
                      onClose={() => onOpenChange(false)}
                    />
                  )}
                </div>
                <button
                  onClick={s.handleDone}
                  className="flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  data-testid="settings-done-button"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {t('buttons.done')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
