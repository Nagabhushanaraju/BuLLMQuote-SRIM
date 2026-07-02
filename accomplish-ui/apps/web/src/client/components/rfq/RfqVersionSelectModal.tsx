import { useState } from 'react';
import { SpinnerGap, FileText, UploadSimple } from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface RfqFileVersion {
  version: number;
  processedAt: string;
  bom: { id: string; fileName: string };
  volume: { id: string; fileName: string };
}

interface RfqVersionSelectModalProps {
  open: boolean;
  rfqId: string;
  versions: RfqFileVersion[];
  onClose: () => void;
  onSelectVersion: (v: RfqFileVersion) => Promise<void>;
  onUploadNew: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RfqVersionSelectModal({
  open,
  rfqId,
  versions,
  onClose,
  onSelectVersion,
  onUploadNew,
}: RfqVersionSelectModalProps) {
  const [activating, setActivating] = useState<number | null>(null);

  const handleSelect = async (v: RfqFileVersion) => {
    setActivating(v.version);
    try {
      await onSelectVersion(v);
    } finally {
      setActivating(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val && activating === null) { onClose(); } }}>
      <DialogContent className="max-w-md border-slate-800 bg-[#030d1d]">
        <DialogHeader>
          <DialogTitle className="text-slate-200">Select Existing Version</DialogTitle>
          <p className="mt-1 text-xs text-slate-400">
            Existing file versions for RFQ{' '}
            <span className="font-mono text-primary">{rfqId || '—'}</span>
          </p>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto space-y-2 py-2 pr-1">
          {versions.map((v) => (
            <div
              key={v.version}
              className="rounded-lg border border-slate-800/80 bg-[#041226]/60 p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Version {v.version}
                </span>
                <span className="text-[10px] text-slate-500">{formatDate(v.processedAt)}</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3 shrink-0 text-slate-500" />
                  <span className="text-[11px] text-slate-400 truncate max-w-[260px]">
                    BOM: <span className="text-slate-300">{v.bom.fileName}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3 shrink-0 text-slate-500" />
                  <span className="text-[11px] text-slate-400 truncate max-w-[260px]">
                    Volume: <span className="text-slate-300">{v.volume.fileName}</span>
                  </span>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => { void handleSelect(v); }}
                disabled={activating !== null}
                className="w-full mt-1"
              >
                {activating === v.version ? (
                  <>
                    <SpinnerGap className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Activating...
                  </>
                ) : (
                  'Use This Version'
                )}
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={onUploadNew}
            disabled={activating !== null}
            className="gap-1.5 text-slate-400 hover:text-slate-200"
          >
            <UploadSimple className="h-3.5 w-3.5" />
            Upload New Version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
