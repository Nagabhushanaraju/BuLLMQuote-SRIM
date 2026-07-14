import { useRef, useState } from 'react';
import { SpinnerGap, FileText, X } from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface RfqIntakeUploadModalProps {
  open: boolean;
  rfqId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RfqIntakeUploadModal({ open, rfqId, onClose, onSuccess }: RfqIntakeUploadModalProps) {
  const [bomFile, setBomFile] = useState<File | null>(null);
  const [volumeFile, setVolumeFile] = useState<File | null>(null);
  const [bomDragOver, setBomDragOver] = useState(false);
  const [volumeDragOver, setVolumeDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bomInputRef = useRef<HTMLInputElement>(null);
  const volumeInputRef = useRef<HTMLInputElement>(null);

  const makeDrop = (setter: (f: File | null) => void, setDrag: (v: boolean) => void) =>
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const file = e.dataTransfer.files?.[0];
      if (file) { setter(file); }
    };

  const handleUpload = async () => {
    if (!bomFile || !volumeFile) { return; }
    if (!rfqId.trim()) {
      setError('Please enter a Target RFQ Reference ID before uploading.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('bom_file', bomFile);
      formData.append('volume_file', volumeFile);
      formData.append('rfq_id', rfqId.trim());

      const RFQ_UPLOAD = (import.meta.env.VITE_RFQ_UPLOAD_URL ?? 'http://192.168.1.27:3000').replace(/\/$/, '');
      const response = await fetch(`${RFQ_UPLOAD}/api/rfq/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as { detail?: string }).detail ?? `Server responded with status ${response.status}`);
      }

      setBomFile(null);
      setVolumeFile(null);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (uploading) { return; }
    setBomFile(null);
    setVolumeFile(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { handleClose(); } }}>
      <DialogContent className="max-w-md border-slate-800 bg-[#030d1d]">
        <DialogHeader>
          <DialogTitle className="text-slate-200">Upload RFQ Files</DialogTitle>
          <p className="mt-1 text-xs text-slate-400">
            BOM and Volume files for RFQ{' '}
            <span className="font-mono text-primary">{rfqId || '—'}</span>
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* BOM File Zone */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">BOM File</p>
            <div
              onDragOver={(e) => { e.preventDefault(); setBomDragOver(true); }}
              onDragLeave={() => setBomDragOver(false)}
              onDrop={makeDrop(setBomFile, setBomDragOver)}
              onClick={() => { if (!bomFile) { bomInputRef.current?.click(); } }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
                bomDragOver
                  ? 'border-primary bg-primary/5'
                  : bomFile
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-slate-700 hover:border-slate-500'
              }`}
            >
              {bomFile ? (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span className="max-w-[200px] truncate text-sm text-slate-200">{bomFile.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setBomFile(null); }}
                    className="ml-1 text-slate-500 hover:text-slate-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <p className="mb-1.5 text-xs text-slate-500">Drop file here or</p>
                  <span className="text-sm font-medium text-primary">Browse files</span>
                  <p className="mt-1 text-[10px] text-slate-600">.xlsx · .xls · .csv</p>
                </>
              )}
            </div>
            <input
              ref={bomInputRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => { if (e.target.files?.[0]) { setBomFile(e.target.files[0]); } }}
            />
          </div>

          {/* Volume File Zone */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Volume File</p>
            <div
              onDragOver={(e) => { e.preventDefault(); setVolumeDragOver(true); }}
              onDragLeave={() => setVolumeDragOver(false)}
              onDrop={makeDrop(setVolumeFile, setVolumeDragOver)}
              onClick={() => { if (!volumeFile) { volumeInputRef.current?.click(); } }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
                volumeDragOver
                  ? 'border-primary bg-primary/5'
                  : volumeFile
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-slate-700 hover:border-slate-500'
              }`}
            >
              {volumeFile ? (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span className="max-w-[200px] truncate text-sm text-slate-200">{volumeFile.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setVolumeFile(null); }}
                    className="ml-1 text-slate-500 hover:text-slate-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <p className="mb-1.5 text-xs text-slate-500">Drop file here or</p>
                  <span className="text-sm font-medium text-primary">Browse files</span>
                  <p className="mt-1 text-[10px] text-slate-600">.xlsx · .xls · .csv</p>
                </>
              )}
            </div>
            <input
              ref={volumeInputRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => { if (e.target.files?.[0]) { setVolumeFile(e.target.files[0]); } }}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <Button
            onClick={() => { void handleUpload(); }}
            disabled={!bomFile || !volumeFile || uploading}
            size="sm"
          >
            {uploading ? (
              <>
                <SpinnerGap className="h-3.5 w-3.5 animate-spin" />
                Uploading...
              </>
            ) : (
              'Upload & Proceed'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
