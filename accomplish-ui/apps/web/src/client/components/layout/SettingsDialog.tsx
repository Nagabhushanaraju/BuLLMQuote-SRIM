import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { SignOut } from '@phosphor-icons/react';
import { settingsVariants, settingsTransitions } from '@/lib/animations';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ProviderId } from '@accomplish_ai/agent-core/common';
import { ProviderGrid } from '@/components/settings/ProviderGrid';
import { ProviderSettingsPanel } from '@/components/settings/ProviderSettingsPanel';
import { SkillsPanel, AddSkillDropdown } from '@/components/settings/skills';
import { AboutTab } from '@/components/settings/AboutTab';
import { GeneralTab } from '@/components/settings/GeneralTab';
import { SandboxSection } from '@/components/settings/SandboxSection';
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
          className="srim-settings-dialog srim-shell-surface max-w-5xl w-full h-[82vh] max-h-[760px] flex flex-col overflow-hidden p-0"
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
        className="srim-settings-dialog srim-shell-surface max-w-5xl w-full h-[82vh] max-h-[760px] flex overflow-hidden p-0"
        data-testid="settings-dialog"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <LayoutGroup id="srim-settings-navigation">
        <nav className="srim-shell-surface-soft flex h-full w-56 shrink-0 flex-col border-r border-border/70 p-3">
          <div className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0">
            <div className="mb-2 rounded-2xl border border-border/70 bg-background/55 px-3 py-3">
              <div className="flex items-center gap-2">
              <img
                src={logoImage}
                alt="SRIM"
                style={{ height: '24px', width: '24px', objectFit: 'contain' }}
              />
                <div>
                  <span className="block text-sm font-semibold text-foreground tracking-wide">SRIM</span>
                  <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Customize appearance</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="srim-shell-chip srim-shell-chip--primary">CAM 3.0</span>
                <span className="srim-shell-chip">Powered by DigiBull</span>
              </div>
            </div>
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => s.setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-sm font-medium text-left transition-all',
                  s.activeTab === tab.id
                    ? 'border-primary/20 bg-background/80 text-foreground shadow-sm'
                    : 'border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/55 hover:text-foreground',
                )}
                >
                {s.activeTab === tab.id && (
                  <motion.span layoutId="active-settings-tab" className="absolute inset-0 rounded-2xl bg-background/80 shadow-sm" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />
                )}
                <span className="relative z-10 flex items-center gap-2.5">
                  <tab.icon className="h-4 w-4 shrink-0" />
                  {t(tab.labelKey)}
                </span>
                </button>
            ))}
          </div>
          <div className="pt-2 border-t border-border/70 shrink-0">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-2xl border border-border/60 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            >
              <SignOut className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          </div>
        </nav>
        </LayoutGroup>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 bg-background/55 px-6 py-4 backdrop-blur-xl">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
              {SETTINGS_TABS.find((tab) => tab.id === s.activeTab)?.labelKey &&
                t(SETTINGS_TABS.find((tab) => tab.id === s.activeTab)!.labelKey)}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Appearance, providers, and local behavior share the same brand tokens.
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-6">
              <AnimatePresence>
                {s.closeWarning && (
                  <motion.div
                    className="srim-shell-surface-soft rounded-2xl border border-warning/30 p-4 mb-6"
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
                            className="rounded-xl border border-border/60 bg-background/70 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:border-border hover:bg-background/90"
                          >
                            {t('warnings.closeAnyway')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={s.activeTab}
                initial={{ opacity: 0, y: 12, filter: 'blur(3px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, filter: 'blur(3px)' }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                className="srim-settings-tab-content"
              >
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
              {s.activeTab === 'general' && (
                <GeneralTab
                  notificationsEnabled={s.notificationsEnabled}
                  onNotificationsToggle={s.handleNotificationsToggle}
                  debugMode={s.debugMode}
                  onDebugToggle={s.handleDebugToggle}
                />
              )}
              {s.activeTab === 'about' && <AboutTab appVersion={s.appVersion} />}
              </motion.div>
              </AnimatePresence>

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
                  className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
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
