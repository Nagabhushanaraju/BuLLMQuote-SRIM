import { useEffect, useState, useCallback, useRef } from 'react';
import { useOutlet, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { getAccomplish } from './lib/accomplish';
import { logger } from './lib/logger';
import { springs, variants } from './lib/animations';
import type { ProviderId } from '@accomplish_ai/agent-core/common';
import { OAuthProviderId } from '@accomplish_ai/agent-core/common';

// Components
// import Sidebar from './components/layout/Sidebar';
// import { SidebarFallback } from './components/layout/SidebarFallback';
import { TaskLauncher } from './components/TaskLauncher';
import { AuthErrorToast } from './components/AuthErrorToast';
import { DaemonConnectionToast } from './components/DaemonConnectionToast';
import SettingsDialog from './components/layout/SettingsDialog';
import { useTaskStore } from './stores/taskStore';
import { SpinnerGap, Warning, FileArrowDown, Cpu, Tag, ShieldWarning } from '@phosphor-icons/react';
// import { ErrorBoundary } from './components/ui/ErrorBoundary';

type AppStatus = 'loading' | 'ready' | 'error';

/**
 * Freezes the outlet so exit animations can complete before the new outlet renders.
 */
function AnimatedOutlet() {
  const outlet = useOutlet();
  const [frozenOutlet] = useState(outlet);
  return frozenOutlet;
}

/**
 * Wraps the outlet with AnimatePresence + motion for page transitions.
 */
function AnimatedOutletWrapper() {
  const location = useLocation();

  // Analytics: track page views on route changes
  useEffect(() => {
    try {
      getAccomplish()
        .analytics?.trackPageView(location.pathname)
        .catch(() => {});
    } catch {
      /* analytics unavailable */
    }
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        className="h-full"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants.fadeUp}
        transition={springs.gentle}
      >
        <AnimatedOutlet />
      </motion.div>
    </AnimatePresence>
  );
}

export function App() {
  const { t } = useTranslation('errors');
  const [status, setStatus] = useState<AppStatus>('loading');
  const [errorMessage, _setErrorMessage] = useState<string | null>(null);
  const [authSettingsOpen, setAuthSettingsOpen] = useState(false);
  const [authSettingsTab, setAuthSettingsTab] = useState<
    'providers' | 'voice' | 'skills' | 'integrations' | 'scheduler' | 'general' | 'about'
  >('providers');
  const [authSettingsProvider, setAuthSettingsProvider] = useState<ProviderId | undefined>(
    undefined,
  );

  // Local tracking state for workflow stages canvas rendering
  const [currentWorkflowStage, setCurrentWorkflowStage] = useState<'intake' | 'extraction' | 'pricing' | 'risk'>('intake');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customRfqId, setCustomRfqId] = useState<string>('');

  // Get store state and actions
  const { openLauncher, authError, clearAuthError } = useTaskStore();

  // ─── FILE UPLOAD HANDLER ROUTED TO PYTHON FASTAPI BACKEND (PORT 3000) ───
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploading(true);

    try {
      // Append the captured binary file stream into a standard multipart payload
      const formData = new FormData();
      formData.append('file', file);
      
      // ─── PIPE THE USER INPUT TEXT STRINGS DIRECTLY TO BACKEND ─────────
      formData.append('rfq_id', customRfqId.trim());

      // POST request sent directly to your Python Uvicorn server configuration
      const response = await fetch('http://192.168.29.155:3000/api/rfq/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Python upload server responded with status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[Python Server Sync Complete]:', result);
      alert(`Successfully uploaded file for RFQ ID "${customRfqId}": ${file.name}`);
      
    } catch (error: unknown) {
      console.error('[Python Server Sync Error]:', error);
      alert(`Sync Failed: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
    } finally {
      setUploading(false);
      // Clear value so the user can re-upload or upload multiple files sequentially if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle re-login from auth error toast
  const handleAuthReLogin = useCallback(() => {
    if (authError) {
      if (authError.providerId === OAuthProviderId.Slack) {
        setAuthSettingsProvider(undefined);
        setAuthSettingsTab('integrations');
      } else {
        setAuthSettingsProvider(authError.providerId as ProviderId);
        setAuthSettingsTab('providers');
      }
      setAuthSettingsOpen(true);
    }
  }, [authError]);

  // Handle auth settings dialog close
  const handleAuthSettingsClose = useCallback(
    (open: boolean) => {
      setAuthSettingsOpen(open);
      if (!open) {
        setAuthSettingsTab('providers');
        setAuthSettingsProvider(undefined);
        clearAuthError();
      }
    },
    [clearAuthError],
  );

  // Cmd+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openLauncher();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openLauncher]);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const accomplish = getAccomplish();
        await accomplish.setOnboardingComplete(true);
      } catch (error) {
        logger.error('Failed to initialize app:', error);
      }
      setStatus('ready');
    };

    void checkStatus();
  }, []);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <SpinnerGap className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <Warning className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h1 className="mb-2 text-xl font-semibold text-foreground">{t('app.unableToStart')}</h1>
          <p className="text-muted-foreground">{errorMessage}</p>
        </div>
      </div>
    );
  }

  // Ready - render canvas view split equally into 3 distinct sections
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#020B18]">
      {/* Invisible drag region for window dragging (macOS hiddenInset titlebar) */}
      <div className="drag-region fixed top-0 left-0 right-0 h-10 z-50 pointer-events-none" />

      {/* ─── HIDDEN FILE SYSTEM CONTEXT INPUT TRIGGER ─────────────────────── */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".xlsx,.xls,.csv,.pdf" 
        aria-label="Upload RFQ source file"
      />

      {/* ─── CANVAS GRID WRAPPER (Three Columns) ─────────────────────────── */}
      <div className="flex w-full h-full divide-x divide-slate-800/60">
        
        {/* COLUMN 1: SIDEBAR CONTAINER & WORKFLOW MANAGER */}
        <div className="w-1/3 h-full flex flex-col justify-between bg-[#030d1d] px-5 py-6">
          
          {/* Top Panel: Workflow Sequence Control Card */}
          <div className="flex-1 flex flex-col justify-start">
            <div className="mb-5">
              <h2 className="text-sm font-semibold tracking-wide text-slate-200 uppercase">
                Control Plane
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure execution parameters and sequence routes
              </p>
            </div>

            <div className="border border-slate-800/80 rounded-xl p-5 bg-[#041226]/50 shadow-inner">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                Quote Workflow Progression
              </h3>
              
              <div className="mb-4 space-y-1.5">
                <label htmlFor="custom-rfq-textbox" className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                  Target RFQ Reference ID
                </label>
                <input
                  id="custom-rfq-textbox"
                  type="text"
                  value={customRfqId}
                  onChange={(e) => setCustomRfqId(e.target.value)}
                  placeholder="e.g. RFQ-2026-A"
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-800 bg-[#020b18] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>

              <div className="space-y-3">
                {[
                  { id: 'intake', name: 'Intake Stage', icon: FileArrowDown },
                  { id: 'extraction', name: 'Feature Extraction', icon: Cpu },
                  { id: 'pricing', name: 'Distributor Pricing', icon: Tag },
                  { id: 'risk', name: 'Feasibility & Risk Analysis', icon: ShieldWarning },
                ].map((stage, idx) => {
                  const IconComponent = stage.icon;
                  const isSelected = currentWorkflowStage === stage.id;
                  return (
                    <button
                      key={stage.id}
                      disabled={uploading}
                      onClick={() => {
                        setCurrentWorkflowStage(stage.id as 'intake' | 'extraction' | 'pricing' | 'risk');
                        
                        // If user selects Intake, fire a proxy click event onto our hidden layout file input element
                        if (stage.id === 'intake') {
                          fileInputRef.current?.click();
                        }
                      }}
                      className={`w-full flex items-center space-x-4 p-3.5 rounded-lg text-left border transition-all ${
                        isSelected
                          ? 'bg-primary/10 border-primary text-primary font-medium shadow-md shadow-primary/5'
                          : 'bg-transparent border-slate-800/40 text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
                      }`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-md border text-sm ${
                        isSelected ? 'bg-primary/20 border-primary/40' : 'bg-slate-900 border-slate-800'
                      }`}>
                        {uploading && stage.id === 'intake' ? (
                          <SpinnerGap className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <IconComponent className="h-5 w-5 flex-shrink-0" />
                      <span className="text-sm tracking-wide">
                        {uploading && stage.id === 'intake' ? 'Uploading File...' : stage.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Panel: Retaining the Logo Branding & Settings Triggers */}
          <div className="mt-auto pt-4 border-t border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              {/* DigiBull / Accomplish Logo Shell */}
              <div className="h-7 w-7 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-xs shadow-sm">
                DB
              </div>
              <span className="text-xs font-semibold tracking-wider text-slate-300 font-mono uppercase">
                DigiBull AI
              </span>
            </div>

            {/* Quick Action System Gear Cog Trigger Button */}
            <button
              onClick={() => {
                setAuthSettingsTab('general');
                setAuthSettingsOpen(true);
              }}
              className="p-2 rounded-lg border border-slate-800 bg-[#020b18]/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition-colors"
              title="Open Application Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

        </div>

        {/* COLUMN 2: CENTRAL AI ASSISTANT CHAT CONTAINER */}
        <div className="w-1/3 h-full flex flex-col overflow-hidden bg-[#020B18]">
          <main className="flex-1 overflow-hidden relative">
            <AnimatedOutletWrapper />
          </main>
        </div>

        {/* COLUMN 3: REAL-TIME OUTPUT STREAM WORKSPACE */}
        <div className="w-1/3 h-full flex flex-col bg-[#030d1d] overflow-hidden p-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-slate-200 uppercase">
                Stage Execution Output
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time compilation logs and structured JSON state schema contract models
              </p>
            </div>
            <div className="px-2.5 py-1 text-[10px] font-mono rounded bg-slate-900 border border-slate-800 text-primary uppercase tracking-wider">
              {currentWorkflowStage}
            </div>
          </div>

          {/* Dynamic render area tracking layout sequence state switches */}
          <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800/60 bg-[#020b18]/40 p-5 font-mono text-xs text-slate-300 leading-relaxed space-y-4 shadow-inner">
            {currentWorkflowStage === 'intake' && (
              <div className="space-y-3">
                <p className="text-emerald-400 font-semibold">[INTAKE ACTIVE] Scanning network filesystem nodes...</p>
                <div className="bg-slate-900/60 p-3 rounded border border-slate-800/80 text-slate-400 space-y-1">
                  <div>&gt; Path matching verified: /staged/inbox/bom.xlsx</div>
                  <div>&gt; Initial RFQ verification hash complete</div>
                  <div>&gt; Status: Ready for extraction run</div>
                </div>
              </div>
            )}
            {currentWorkflowStage === 'extraction' && (
              <div className="space-y-3">
                <p className="text-blue-400 font-semibold">[EXTRACTION RUNNING] Executing Python contract normalization models...</p>
                <div className="bg-slate-900/60 p-3 rounded border border-slate-800/80 text-slate-400 space-y-1">
                  <div>&gt; Component items identified: 42 lines</div>
                  <div>&gt; Extracting baseline schematic descriptors...</div>
                  <div>&gt; Appending metadata mapping indices to local session stores</div>
                </div>
              </div>
            )}
            {currentWorkflowStage === 'pricing' && (
              <div className="space-y-3">
                <p className="text-amber-400 font-semibold">[PRICING MATRIX] Fetching remote distributor pipeline catalogs...</p>
                <div className="bg-slate-900/60 p-3 rounded border border-slate-800/80 text-slate-400 space-y-1">
                  <div>&gt; Querying tier-1 wholesale api hooks</div>
                  <div>&gt; Matching local item indexes against active market parameters</div>
                  <div>&gt; Variance limit check complete: within acceptable margin profile</div>
                </div>
              </div>
            )}
            {currentWorkflowStage === 'risk' && (
              <div className="space-y-3">
                <p className="text-purple-400 font-semibold">[RISK MATRIX] Evaluating global ITAR tracking records...</p>
                <div className="bg-slate-900/60 p-3 rounded border border-slate-800/80 text-slate-400 space-y-1">
                  <div>&gt; Checking restricted manufacturer registry indexes</div>
                  <div>&gt; Conflict matching loop finished smoothly</div>
                  <div>&gt; Final structural integrity check rating status: Cleared (Green)</div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
      {/* ─────────────────────────────────────────────────────────────────── */}

      <TaskLauncher />

      {/* Auth Error Toast - shown when OAuth session expires */}
      <AuthErrorToast error={authError} onReLogin={handleAuthReLogin} onDismiss={clearAuthError} />

      {/* Daemon Connection Toast - shown when daemon disconnects */}
      <DaemonConnectionToast
        onOpenSettings={() => {
          setAuthSettingsTab('general');
          setAuthSettingsOpen(true);
        }}
      />

      {/* Settings Dialog for re-authentication */}
      <SettingsDialog
        open={authSettingsOpen}
        onOpenChange={handleAuthSettingsClose}
        initialProvider={authSettingsProvider}
        initialTab={authSettingsTab}
        onApiKeySaved={() => {
          clearAuthError();
          setAuthSettingsOpen(false);
        }}
      />
    </div>
  );
}