import { motion } from 'framer-motion';
import { CaretRight } from '@phosphor-icons/react';
import { StatusChip, type ChipState } from '@/components/ui/StatusChip';

export type WorkflowStage = 'intake' | 'extraction' | 'pricing' | 'risk';

interface AgentActivityStripProps {
  currentStage: WorkflowStage;
  /** When true, the current stage is paused waiting on human review. */
  hitlActive?: boolean;
}

const STAGE_ORDER: WorkflowStage[] = ['intake', 'extraction', 'pricing', 'risk'];

const STAGE_LABELS: Record<WorkflowStage, string> = {
  intake: 'BOM Intake',
  extraction: 'Feature Extraction',
  pricing: 'Distributor Pricing',
  risk: 'Risk Analysis',
};

// Representative completed-stage durations shown until real SSE tool events
// carry actual timings (deterministic — not wall-clock).
const STAGE_DURATIONS: Record<WorkflowStage, string> = {
  intake: '3.1s',
  extraction: '11.4s',
  pricing: '8.7s',
  risk: '5.2s',
};

function chipStateFor(
  stage: WorkflowStage,
  currentIndex: number,
  index: number,
  hitlActive: boolean,
): { state: ChipState; detail?: string } {
  if (index < currentIndex) {
    return { state: 'done', detail: STAGE_DURATIONS[stage] };
  }
  if (index === currentIndex) {
    return hitlActive ? { state: 'warning', detail: 'HITL hold' } : { state: 'running' };
  }
  return { state: 'pending' };
}

/**
 * SOP: "MCP Operational Status Badges" — CI-pipeline-style strip of stage
 * chips above the execution output. Completed stages freeze with duration,
 * the active stage pulses, and a HITL pause flips the active chip to warning.
 */
export function AgentActivityStrip({ currentStage, hitlActive = false }: AgentActivityStripProps) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex items-center gap-1 overflow-x-auto pb-3"
      data-testid="agent-activity-strip"
    >
      {STAGE_ORDER.map((stage, index) => {
        const { state, detail } = chipStateFor(stage, currentIndex, index, hitlActive);
        return (
          <div key={stage} className="flex items-center gap-1">
            {index > 0 && <CaretRight className="h-3 w-3 shrink-0 text-slate-700" />}
            <StatusChip state={state} label={STAGE_LABELS[stage]} detail={detail} />
          </div>
        );
      })}
    </motion.div>
  );
}
