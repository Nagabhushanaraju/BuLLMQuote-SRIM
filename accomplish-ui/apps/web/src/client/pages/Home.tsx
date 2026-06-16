import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { TaskInputBar } from '@/components/landing/TaskInputBar';
import { SettingsDialog } from '@/components/layout/SettingsDialog';
import { springs } from '@/lib/animations';
import { PlusMenu } from '@/components/landing/PlusMenu';
import { useHomePage } from './home/useHomePage';
import { FavoritesSection } from './home/FavoritesSection';
import { ExamplesSection } from './home/ExamplesSection';

export function HomePage() {
  const { t } = useTranslation('home');
  const {
    prompt,
    setPrompt,
    showAllFavorites,
    setShowAllFavorites,
    attachments,
    attachmentError,
    setAttachments,
    workingDirectory,
    setWorkingDirectory,
    showSettingsDialog,
    settingsInitialTab,
    favoritesList,
    removeFavorite,
    isLoading,
    useCaseExamples,
    displayedFavorites,
    hasMoreFavorites,
    handleSubmit,
    handleSettingsDialogChange,
    handleOpenSpeechSettings,
    handleOpenModelSettings,
    handleApiKeySaved,
    handleExampleClick,
    handleSkillSelect,
    handleAttachFiles,
    handleOpenSettings,
    MAX_FILES,
  } = useHomePage();

  return (
    <>
      <SettingsDialog
        open={showSettingsDialog}
        onOpenChange={handleSettingsDialogChange}
        onApiKeySaved={handleApiKeySaved}
        initialTab={settingsInitialTab}
      />

      <div className="relative flex h-full flex-col overflow-hidden bg-[#020B18]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Orange blob — top left, mirrors logo left half */}
          <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-orange-500/[0.18] blur-[160px]" />
          {/* Amber secondary — blends into orange */}
          <div className="absolute -left-10 top-[15%] h-[360px] w-[360px] rounded-full bg-amber-400/[0.12] blur-[130px]" />
          {/* Blue blob — top right, mirrors logo right half */}
          <div className="absolute -right-36 -top-20 h-[560px] w-[560px] rounded-full bg-blue-500/[0.18] blur-[155px]" />
          {/* Cyan secondary — blends into blue */}
          <div className="absolute right-[5%] top-[30%] h-[320px] w-[320px] rounded-full bg-cyan-400/[0.10] blur-[120px]" />
          {/* Deep blue — bottom fade */}
          <div className="absolute bottom-[-10%] left-1/2 h-[400px] w-[500px] -translate-x-1/2 rounded-full bg-blue-900/[0.35] blur-[140px]" />
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto px-4 sm:px-6">
          {/* Above-fold: fills full viewport height */}
          <div className="flex min-h-full flex-col">
            {/* Spacer pushes title+input to bottom */}
            <div className="flex-1" />

            {/* Title + input — together at the bottom */}
            <div className="mx-auto w-full max-w-[760px] pb-8">
              <motion.h1
                data-testid="home-title"
                initial={{ opacity: 0, scale: 0.93, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                className="mb-4 w-full text-center font-apparat text-[26px] tracking-[-0.03em] text-foreground sm:text-[32px] lg:text-[38px]"
              >
                {t('title')}
              </motion.h1>
              <div className="mx-auto w-full max-w-[760px]">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springs.gentle, delay: 0.35 }}
                  className="w-full"
                >
                  <TaskInputBar
                    value={prompt}
                    onChange={setPrompt}
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                    placeholder={t('inputPlaceholder')}
                    typingPlaceholder={true}
                    large={true}
                    autoFocus={true}
                    autoSubmitOnTranscription={false}
                    onOpenSpeechSettings={handleOpenSpeechSettings}
                    onOpenModelSettings={handleOpenModelSettings}
                    hideModelWhenNoModel={true}
                    attachments={attachments}
                    attachmentError={attachmentError}
                    onAttachmentsChange={setAttachments}
                    toolbarLeft={
                      <PlusMenu
                        onSkillSelect={handleSkillSelect}
                        onOpenSettings={handleOpenSettings}
                        onAttachFiles={handleAttachFiles}
                        onSelectFolder={setWorkingDirectory}
                        disabled={isLoading}
                        attachmentCount={attachments.length}
                        maxAttachments={MAX_FILES}
                      />
                    }
                  />
                  {workingDirectory && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="max-w-[400px] truncate" title={workingDirectory}>
                        {t('selectedFolder.badge', { folder: workingDirectory })}
                      </span>
                      <button
                        type="button"
                        onClick={() => setWorkingDirectory(undefined)}
                        className="ml-1 transition-colors hover:text-foreground"
                        aria-label={t('selectedFolder.clearAriaLabel')}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </motion.div>
              </div>
              {/* end inner max-w wrapper */}
            </div>
            {/* end title+input wrapper */}
          </div>
          {/* end above-fold flex */}

          {/* Below fold — only visible on scroll */}
          <div className="mx-auto w-full max-w-[760px] pb-8">
            <FavoritesSection
              favoritesList={favoritesList}
              displayedFavorites={displayedFavorites}
              hasMoreFavorites={hasMoreFavorites}
              showAllFavorites={showAllFavorites}
              onSetPrompt={setPrompt}
              onRemoveFavorite={removeFavorite}
              onShowAll={() => setShowAllFavorites(true)}
            />

            <ExamplesSection
              useCaseExamples={useCaseExamples}
              onExampleClick={handleExampleClick}
            />
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[120px] bg-gradient-to-t from-[#020B18] to-transparent" />
      </div>
    </>
  );
}
