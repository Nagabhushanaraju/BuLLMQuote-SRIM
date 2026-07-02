import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { StageExecutionOutput } from './components/execution/StageExecutionOutput';
import { TaskLauncher } from './components/TaskLauncher';
import { AuthErrorToast } from './components/AuthErrorToast';
import { DaemonConnectionToast } from './components/DaemonConnectionToast';
import SettingsDialog from './components/layout/SettingsDialog';
import { useTaskStore } from './stores/taskStore';
// import { getDaemonClient } from './daemon-bootstrap';
import { SpinnerGap, Warning, FileArrowDown, Cpu, Tag, ShieldWarning } from '@phosphor-icons/react';
import { RfqIntakeUploadModal } from './components/rfq/RfqIntakeUploadModal';
import { RfqVersionSelectModal } from './components/rfq/RfqVersionSelectModal';
import type { RfqFileVersion } from './components/rfq/RfqVersionSelectModal';
import { LocalSessionStatusBar } from './components/layout/LocalSessionStatusBar';
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
  const [intakeModalOpen, setIntakeModalOpen] = useState(false);
  const [versionSelectOpen, setVersionSelectOpen] = useState(false);
  const [rfqVersions, setRfqVersions] = useState<RfqFileVersion[]>([]);

  const [customRfqId, setCustomRfqId] = useState<string>('');
  const [rfqValidationMessage, setRfqValidationMessage] = useState('');



//   const validateRfqId = async (rfqId: string) => {
//   if (!rfqId.trim()) {
//     setRfqValidationMessage('');
//     return;
//   }

//   try {
//     const result = await getDaemonClient().call(
//       'rfq.checkExists',
//       { rfqId }
//     );

//     setRfqValidationMessage(
//       result.exists
//         ? 'RFQ ID already exists'
//         : 'RFQ ID not found'
//     );
//   } catch (err) {
//     setRfqValidationMessage(
//       'Unable to validate RFQ ID'
//     );
//   }
// };

const validateRfqId = async (rfqId: string) => {
  if (!rfqId.trim()) {
    setRfqValidationMessage('');
    return;
  }

  try {
    const accomplish = getAccomplish();

    const result = await accomplish.checkRfqExists({
      rfqId: rfqId.trim(),
    });

    setRfqValidationMessage(
      result.exists
        ? 'RFQ ID already exists'
        : 'RFQ ID not found'
    );
  } catch (err) {
    console.error(err);

    setRfqValidationMessage(
      'Unable to validate RFQ ID'
    );
  }
};


  const [sseConnection, setSseConnection] = useState<EventSource | null>(null);
  const [hitlActive, setHitlActive] = useState<boolean>(false);
  
  const [hitlContext, setHitlContext] = useState<HitlContext | null>(null);
  const [sharedRowData, setSharedRowData] = useState<Record<string, unknown>[]>([]);

  interface HitlContext {
  rfqId: string;
  stage: string;
  type: 'preview' | 'approval';
  }

  // Fallback structural placeholder to satisfy component interface definitions
  const mockRpcClient = useMemo(() => ({
    request: async (channel: string, args: unknown[]) => {
      console.log(`[RPC Outbound] Dispatching channel request: ${channel}`, args);
      return true;
    }
  }), []);

  // ─── ROOT LEVEL SSE CHANNEL INITIALIZATION LOOP ───
  useEffect(() => {
  const sse = new EventSource('http://127.0.0.1:9234/events');

  const handleGlobalInterceptStream = (e: MessageEvent) => {
    try {
      const payload = JSON.parse(e.data);
      if (payload.event === 'hitl:request') {
        console.log("⚠️ HITL Intercept detected! Hydrating data array:", payload.rowData);
        
        setHitlContext({
          rfqId: payload.rfqId,
          stage: payload.stage,
          type: payload.type
        });
        setSharedRowData(payload.rowData || []);
      } else if (payload.event === 'hitl:clear') {
        setHitlContext(null);
        setSharedRowData([]);
      }
    } catch (err) {
      console.error("Error reading stream transmission frames:", err);
    }
  };

  sse.addEventListener('message', handleGlobalInterceptStream);
  setSseConnection(sse);

  return () => {
    sse.removeEventListener('message', handleGlobalInterceptStream);
    sse.close();
  };
}, []);
  // ───────────────────────────────────────────────────

  // Get store state and actions
  const { openLauncher, authError, clearAuthError } = useTaskStore();


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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#020B18]">
      {/* Invisible drag region for window dragging (macOS hiddenInset titlebar) */}
      <div className="drag-region fixed top-0 left-0 right-0 h-10 z-50 pointer-events-none" />

      <RfqIntakeUploadModal
        open={intakeModalOpen}
        rfqId={customRfqId}
        onClose={() => setIntakeModalOpen(false)}
        onSuccess={() => {
          setIntakeModalOpen(false);
          setCurrentWorkflowStage('intake');
        }}
      />

      <RfqVersionSelectModal
        open={versionSelectOpen}
        rfqId={customRfqId}
        versions={rfqVersions}
        onClose={() => setVersionSelectOpen(false)}
        onSelectVersion={async (v) => {
          await getAccomplish().rfqActivateVersion({
            rfqId: customRfqId.trim(),
            bomId: v.bom.id,
            volumeId: v.volume.id,
          });
          setVersionSelectOpen(false);
          setCurrentWorkflowStage('intake');
        }}
        onUploadNew={() => {
          setVersionSelectOpen(false);
          setIntakeModalOpen(true);
        }}
      />

      {/* ─── CANVAS GRID WRAPPER (Three Columns) ─────────────────────────── */}
      <div className="flex flex-1 min-h-0 w-full divide-x divide-slate-800/60">
        
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
                  onChange={(e) => {
                    const value = e.target.value;
                    setCustomRfqId(value);
                    validateRfqId(value);
                  }}
                  placeholder="e.g. RFQ-2026-A"
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-800 bg-[#020b18] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary/60 transition-colors"
                />
                {rfqValidationMessage && (
                  <p className="mt-2 text-xs text-slate-400">
                    {rfqValidationMessage}
                  </p>
                )}
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
                      onClick={() => {
                        setCurrentWorkflowStage(stage.id as 'intake' | 'extraction' | 'pricing' | 'risk');
                        if (stage.id !== 'intake') { return; }
                        if (!customRfqId.trim()) { setIntakeModalOpen(true); return; }
                        void (async () => {
                          try {
                            const data = await getAccomplish().rfqGetFileVersions({ rfqId: customRfqId.trim() });
                            if (data.versions.length > 0) {
                              setRfqVersions(data.versions);
                              setVersionSelectOpen(true);
                            } else {
                              setIntakeModalOpen(true);
                            }
                          } catch {
                            setIntakeModalOpen(true);
                          }
                        })();
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
                        {idx + 1}
                      </div>
                      <IconComponent className="h-5 w-5 flex-shrink-0" />
                      <span className="text-sm tracking-wide">{stage.name}</span>
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

        {/* COLUMN 2: CENTRAL AI ASSISTANT CHAT CONTAINER — collapses when HITL is active */}
        <motion.div
          animate={{ width: hitlContext ? '0%' : '33.333%', opacity: hitlContext ? 0 : 1 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="h-full flex flex-col overflow-hidden bg-[#020B18]"
          style={{ minWidth: 0 }}
        >
          <main className="flex-1 overflow-hidden relative">
            <AnimatedOutletWrapper />
          </main>
        </motion.div>

        {/* COLUMN 3: REAL-TIME OUTPUT STREAM WORKSPACE — expands to 2/3 on HITL */}
        <motion.div
          animate={{ width: hitlContext ? '66.666%' : '33.333%' }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="h-full flex flex-col bg-[#030d1d] overflow-hidden p-6"
          style={{ minWidth: 0 }}
        >
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-slate-200 uppercase">
                {hitlContext ? '⚠️ Intercept Validation View' : 'Stage Execution Output'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {hitlContext 
                  ? 'Human-in-the-loop intervention required. Review table item parameters to proceed.'
                  : 'Real-time compilation logs and structured JSON state schema contract models'
                }
              </p>
            </div>
            <div className="px-2.5 py-1 text-[10px] font-mono rounded bg-slate-900 border border-slate-800 text-primary uppercase tracking-wider">
              {hitlContext ? 'HITL_HALT' : currentWorkflowStage}
            </div>
          </div>

          {/* Dynamic render area tracking layout sequence state switches or grid injections */}
          <div className="flex-1 min-h-0 w-full rounded-xl border border-slate-800/60 bg-[#020b18]/40 overflow-hidden shadow-inner">
            {hitlContext ? (
              /* ✅ Directly pass the context data down through explicit component props */
              <StageExecutionOutput 
                rpcClient={mockRpcClient} 
                hitlContextData={hitlContext}
                rowDataPayload={sharedRowData}
              />
            ) : (
              /* Standard fallback compilation log view cards layout structure when running normally */
              <div className="p-5 font-mono text-xs text-slate-300 leading-relaxed space-y-4 h-full overflow-y-auto">
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
            )}
          </div>
        </motion.div>

      </div>
      {/* ─────────────────────────────────────────────────────────────────── */}

      <LocalSessionStatusBar />

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