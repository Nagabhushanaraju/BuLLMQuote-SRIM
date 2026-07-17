import { lazy, Suspense, useEffect, useState, useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
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
import { useTaskStore } from './stores/taskStore';
// import { getDaemonClient } from './daemon-bootstrap';
import { SpinnerGap, Warning, FileArrowDown, Cpu, Tag, ShieldWarning } from '@phosphor-icons/react';
import { RfqIntakeUploadModal } from './components/rfq/RfqIntakeUploadModal';
import { RfqVersionSelectModal } from './components/rfq/RfqVersionSelectModal';
import type { RfqFileVersion } from './components/rfq/RfqVersionSelectModal';
import { LocalSessionStatusBar } from './components/layout/LocalSessionStatusBar';
// import { ErrorBoundary } from './components/ui/ErrorBoundary';

const SettingsDialog = lazy(() => import('./components/layout/SettingsDialog'));

type AppStatus = 'loading' | 'ready' | 'error';

const CONTROL_PANEL_STOPS = [24, 28, 32, 36, 40];
const OUTPUT_PANEL_STOPS = [32, 36, 40, 44, 48];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snapToNearest(value: number, stops: number[]) {
  return stops.reduce((best, stop) => (Math.abs(stop - value) < Math.abs(best - value) ? stop : best), stops[0]);
}

function snapPaneRatios(
  ratios: [number, number, number],
  side: 'control' | 'output',
): [number, number, number] {
  const [left, center, right] = ratios;

  if (side === 'control') {
    const snappedLeft = clamp(snapToNearest(left, CONTROL_PANEL_STOPS), 22, 42);
    const nextCenter = clamp(100 - snappedLeft - right, 30, 48);
    const nextLeft = clamp(100 - nextCenter - right, 22, 42);
    return [nextLeft, nextCenter, right];
  }

  const snappedCenter = clamp(snapToNearest(center, OUTPUT_PANEL_STOPS), 30, 48);
  const nextRight = clamp(100 - left - snappedCenter, 22, 42);
  const nextCenter = clamp(100 - left - nextRight, 30, 48);
  return [left, nextCenter, nextRight];
}

function AnimatedOutlet() {
  // Lazy routes resolve after the first render; do not freeze the initial null outlet.
  return useOutlet();
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
        .catch(() => { });
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
    'providers' | 'skills' | 'general' | 'about'
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
  const [paneRatios, setPaneRatios] = useState<[number, number, number]>([30, 40, 30]);
  const splitWrapperRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<null | {
    side: 'control' | 'output';
    startX: number;
    startRatios: [number, number, number];
  }>(null);



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

  const startPanelDrag = useCallback((side: 'control' | 'output', event: ReactPointerEvent<HTMLButtonElement>) => {
    const wrapper = splitWrapperRef.current;
    if (!wrapper) return;

    event.preventDefault();
    dragStateRef.current = {
      side,
      startX: event.clientX,
      startRatios: paneRatios,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag || drag.side !== side) return;
      const usableWidth = wrapper.getBoundingClientRect().width;
      const delta = ((moveEvent.clientX - drag.startX) / usableWidth) * 100;
      const next = [...drag.startRatios] as [number, number, number];

      if (side === 'control') {
        next[0] = Math.min(42, Math.max(22, drag.startRatios[0] + delta));
        next[1] = 100 - next[0] - next[2];
        if (next[1] < 30) {
          next[1] = 30;
          next[0] = 100 - next[1] - next[2];
        }
      } else {
        next[1] = Math.min(48, Math.max(30, drag.startRatios[1] + delta));
        next[2] = 100 - next[0] - next[1];
        if (next[2] < 22) {
          next[2] = 22;
          next[1] = 100 - next[0] - next[2];
        }
      }

      setPaneRatios(next);
    };
    const handlePointerUp = () => {
      setPaneRatios((current) => snapPaneRatios(current, side));
      dragStateRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [paneRatios]);

  // Get store state and actions
  const { openLauncher, authError, clearAuthError } = useTaskStore();


  // Handle re-login from auth error toast
  const handleAuthReLogin = useCallback(() => {
    if (authError) {
      if (authError.providerId === OAuthProviderId.Slack) {
        setAuthSettingsProvider(undefined);
        setAuthSettingsTab('providers');
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

  // Ready - render the three-pane canvas with snap-stop dividers.
  const gridTemplateColumns = `minmax(280px, ${paneRatios[0]}fr) 12px minmax(360px, ${paneRatios[1]}fr) 12px minmax(280px, ${paneRatios[2]}fr)`;

  return (
    <div
      className="srim-console srim-theme-shell flex flex-col h-screen w-screen overflow-hidden"
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty('--pointer-x', `${((event.clientX - rect.left) / rect.width) * 100}%`);
        event.currentTarget.style.setProperty('--pointer-y', `${((event.clientY - rect.top) / rect.height) * 100}%`);
      }}
    >
      {/* Invisible drag region for window dragging (macOS hiddenInset titlebar) */}
      <div className="drag-region fixed top-0 left-0 right-0 h-10 z-50 pointer-events-none" />
      <div className="srim-orbit-field pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <motion.div className="srim-orbit srim-orbit-one" animate={{ rotate: 360 }} transition={{ duration: 32, repeat: Infinity, ease: 'linear' }} />
        <motion.div className="srim-orbit srim-orbit-two" animate={{ rotate: -360 }} transition={{ duration: 44, repeat: Infinity, ease: 'linear' }} />
        <motion.div className="srim-signal-dot" animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.35, 0.9, 0.35] }} transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }} />
      </div>

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
      <div
        ref={splitWrapperRef}
        className="srim-pane-grid flex flex-1 min-h-0 w-full"
        style={{ gridTemplateColumns }}
      >
        {/* COLUMN 1: SIDEBAR CONTAINER & WORKFLOW MANAGER */}
        <div className="srim-column-shell relative h-full min-w-0 overflow-hidden">
            <motion.div
              className="srim-panel srim-panel-left srim-theme-panel relative h-full flex flex-col justify-between px-5 py-6"
              style={{ minWidth: 0, width: '100%' }}
            >

            {/* Top Panel: Workflow Sequence Control Card */}
            <div className="flex-1 flex flex-col justify-start">
              <div className="mb-5">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-primary">Live</span>
                  <span>Drag to resize</span>
                  <span>Snap points on release</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                      Workflow rail
                    </h2>
                    <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
                      Pick a stage, keep the run visible, and move the rails to suit the task.
                    </p>
                  </div>
                </div>
              </div>

              <div className="srim-panel-body srim-theme-panel-soft border rounded-2xl p-5 shadow-inner">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                      RFQ intake
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Start with a reference, then move through the workflow.
                    </p>
                  </div>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                    3 panes
                  </span>
                </div>

                <div className="mb-4 space-y-1.5">
                  <label htmlFor="custom-rfq-textbox" className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Reference ID
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
                    placeholder="RFQ-2026-A"
                    className="w-full rounded-xl border border-border bg-background/80 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary/60 focus:outline-none"
                  />
                  {rfqValidationMessage && (
                    <p className="srim-theme-muted mt-2 text-xs">
                      {rfqValidationMessage}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  {[
                    { id: 'intake', name: 'Load RFQ', detail: 'Open a version or start a new intake.', icon: FileArrowDown },
                    { id: 'extraction', name: 'Extract parts', detail: 'Normalize line items and attributes.', icon: Cpu },
                    { id: 'pricing', name: 'Check pricing', detail: 'Compare distributor signals and ranges.', icon: Tag },
                    { id: 'risk', name: 'Review risk', detail: 'Surface exceptions before release.', icon: ShieldWarning },
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
                        className={`srim-stage-button group relative w-full overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200 ${isSelected
                          ? 'border-primary/60 bg-gradient-to-r from-primary/18 via-primary/8 to-transparent text-foreground shadow-lg shadow-primary/10'
                          : 'border-border/70 bg-background/30 text-muted-foreground hover:border-primary/30 hover:bg-primary/[0.06] hover:text-foreground'
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${isSelected ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border bg-background/70 group-hover:border-primary/40'}`}>
                            {String(idx + 1).padStart(2, '0')}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <IconComponent className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                              <span className="text-sm font-medium tracking-wide">{stage.name}</span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{stage.detail}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Panel: Retaining the Logo Branding & Settings Triggers */}
            <div className="mt-auto flex items-center justify-between border-t border-border/70 bg-background/90 pt-4 backdrop-blur-sm sticky bottom-0">
              <div className="flex items-center space-x-2.5">
                {/* DigiBull / Accomplish Logo Shell */}
                <img 
                  src="/assets/digibull-logo.png" 
                  alt="DigiBull Logo" 
                  className="h-7 w-auto object-contain" 
                />
                <span className="text-xs font-semibold tracking-wider text-foreground/80 font-mono uppercase">
                  POWERED BY DigiBull
                </span>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  setAuthSettingsTab('general');
                  setAuthSettingsOpen(true);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/70 text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary shadow-sm"
                title="Open Application Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
              </button>
            </div>

          </motion.div>
        </div>

        <div className="srim-pane-gutter" role="separator" aria-label="Resize control plane and chat">
          <button
            type="button"
            className="srim-splitter-handle"
            onPointerDown={(event) => startPanelDrag('control', event)}
            aria-label="Resize control plane and chat"
          />
        </div>

        {/* COLUMN 2: CENTRAL AI ASSISTANT CHAT CONTAINER — collapses when HITL is active */}
        <div className="srim-column-shell relative h-full min-w-0 overflow-hidden">
            <motion.div
            className="srim-panel srim-chat srim-theme-shell h-full flex flex-col overflow-hidden"
            style={{ minWidth: 0, width: '100%' }}
          >
            <main className="flex-1 overflow-hidden relative">
              <AnimatedOutletWrapper />
            </main>
          </motion.div>
        </div>

        <div className="srim-pane-gutter" role="separator" aria-label="Resize chat and stage output">
          <button
            type="button"
            className="srim-splitter-handle"
            onPointerDown={(event) => startPanelDrag('output', event)}
            aria-label="Resize chat and stage output"
          />
        </div>

        {/* COLUMN 3: REAL-TIME OUTPUT STREAM WORKSPACE — expands to 2/3 on HITL */}
        <div className="srim-column-shell relative h-full min-w-0 overflow-hidden">
            <motion.div
            className="srim-panel srim-output srim-theme-panel relative h-full flex flex-col overflow-hidden p-6"
            style={{ minWidth: 0, width: '100%' }}
          >
            <div className="flex items-center justify-between border-b border-primary/20 pb-4 mb-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-primary">
                  {hitlContext ? 'Review required' : 'Live output'}
                </h2>
                <p className="srim-theme-muted text-xs mt-0.5">
                  {hitlContext
                    ? 'Check the captured state before the run continues.'
                    : 'Track the active stage and inspect the current run.'
                  }
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 text-[10px] font-mono rounded-full bg-primary/10 border border-primary/30 text-primary uppercase tracking-wider shadow-sm shadow-primary/10">
                  {hitlContext ? 'Review mode' : currentWorkflowStage}
                </div>
              </div>
            </div>

            {/* Dynamic render area tracking layout sequence state switches or grid injections */}
            <div className="srim-panel-body flex-1 min-h-0 w-full rounded-xl border border-border/70 bg-background/70 overflow-hidden shadow-inner">
              {hitlContext ? (
                /* ✅ Directly pass the context data down through explicit component props */
                <StageExecutionOutput
                  rpcClient={mockRpcClient}
                  hitlContextData={hitlContext}
                  rowDataPayload={sharedRowData}
                />
              ) : (
                /* Standard fallback compilation log view cards layout structure when running normally */
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={hitlContext ? 'hitl' : currentWorkflowStage}
                    initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="srim-log h-full overflow-y-auto p-5 font-mono text-xs leading-relaxed text-foreground/85"
                  >
                    {currentWorkflowStage === 'intake' && (
                      <div className="space-y-3">
                        <p className="text-emerald-400 font-semibold">[INTAKE ACTIVE] Scanning incoming RFQ files...</p>
                        <div className="bg-background/80 p-3 rounded border border-border/70 text-foreground/70 space-y-1">
                          <div>&gt; Source matched: /staged/inbox/bom.xlsx</div>
                          <div>&gt; Reference checksum verified</div>
                          <div>&gt; Status: Ready for the next step</div>
                        </div>
                      </div>
                    )}
                    {currentWorkflowStage === 'extraction' && (
                      <div className="space-y-3">
                        <p className="text-blue-400 font-semibold">[EXTRACTION RUNNING] Normalizing line items and metadata...</p>
                        <div className="bg-background/80 p-3 rounded border border-border/70 text-foreground/70 space-y-1">
                          <div>&gt; Parts identified: 42 lines</div>
                          <div>&gt; Capturing baseline descriptors...</div>
                          <div>&gt; Writing mapped attributes to the session</div>
                        </div>
                      </div>
                    )}
                    {currentWorkflowStage === 'pricing' && (
                      <div className="space-y-3">
                        <p className="text-amber-400 font-semibold">[PRICING MATRIX] Comparing distributor signals...</p>
                        <div className="bg-background/80 p-3 rounded border border-border/70 text-foreground/70 space-y-1">
                          <div>&gt; Querying active supply sources</div>
                          <div>&gt; Matching items against market ranges</div>
                          <div>&gt; Margin profile within tolerance</div>
                        </div>
                      </div>
                    )}
                    {currentWorkflowStage === 'risk' && (
                      <div className="space-y-3">
                        <p className="text-purple-400 font-semibold">[RISK MATRIX] Checking review and compliance signals...</p>
                        <div className="bg-background/80 p-3 rounded border border-border/70 text-foreground/70 space-y-1">
                          <div>&gt; Restricted source list checked</div>
                          <div>&gt; Conflict matching complete</div>
                          <div>&gt; Final status: Cleared</div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </div>

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
      {authSettingsOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}
    </div>
  );
}
