import { motion } from 'framer-motion';

export interface ArchNode {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  delay: number;
}

export const ARCH_NODES: ArchNode[] = [
  { id: 'n1', label: 'Workflow Orchestrator', color: '#EA580C', x: 50, y: 12, delay: 0.4 },
  { id: 'n2', label: 'Config & State Store', color: '#00A877', x: 8, y: 36, delay: 0.52 },
  { id: 'n3', label: 'Tool Gateway', color: '#0D9488', x: 76, y: 36, delay: 0.64 },
  { id: 'n4', label: 'Query Executor', color: '#10B981', x: 10, y: 63, delay: 0.76 },
  { id: 'n5', label: 'Audit & Logs', color: '#7C3AED', x: 33, y: 82, delay: 0.88 },
  { id: 'n6', label: 'Document Engine', color: '#22D3EE', x: 55, y: 63, delay: 1.0 },
];

export const CONNECTIONS: Array<{ from: string; to: string }> = [
  { from: 'n1', to: 'n2' },
  { from: 'n2', to: 'n3' },
  { from: 'n2', to: 'n4' },
  { from: 'n3', to: 'n4' },
  { from: 'n3', to: 'n6' },
  { from: 'n4', to: 'n5' },
  { from: 'n2', to: 'n5' },
  { from: 'n5', to: 'n6' },
];

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function SrimNode({ node }: { node: ArchNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: node.delay, ease: EASE }}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2"
    >
      <motion.div
        animate={{ y: [-6, 6] }}
        transition={{
          duration: 3 + node.delay * 0.4,
          repeat: Infinity,
          repeatType: 'mirror',
          ease: 'easeInOut',
        }}
        className="relative"
      >
        {/* Pulsing ring */}
        <motion.div
          animate={{ scale: [1, 1.85], opacity: [0.5, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: node.delay }}
          className="absolute inset-0 rounded-2xl border"
          style={{ borderColor: node.color }}
        />
        {/* Node card */}
        <div
          className="relative rounded-2xl border px-4 py-3 backdrop-blur-sm"
          style={{
            borderColor: `${node.color}50`,
            backgroundColor: `${node.color}14`,
            boxShadow: `0 0 28px ${node.color}28`,
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: node.color, boxShadow: `0 0 8px ${node.color}` }}
            />
            <span className="whitespace-nowrap text-[13px] font-bold text-white/85">
              {node.label}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
