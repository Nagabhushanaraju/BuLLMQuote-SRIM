import { X, WarningCircle } from '@phosphor-icons/react';
import type { FileAttachmentInfo } from '@accomplish_ai/agent-core/common';
import { formatFileSize } from '@/lib/fileUtils';
import { FileTypeIcon } from './FileTypeIcon';

interface TaskInputAttachmentListProps {
  attachments: FileAttachmentInfo[];
  attachmentError: string | null;
  onRemove: (id: string) => void;
}

export function TaskInputAttachmentList({
  attachments,
  attachmentError,
  onRemove,
}: TaskInputAttachmentListProps) {
  const hasContent = attachmentError || attachments.length > 0;
  const totalSize = attachments.reduce((sum, file) => sum + file.size, 0);

  if (!hasContent) {
    return null;
  }

  return (
    <>
      {attachmentError && (
        <div
          role="alert"
          aria-live="polite"
          className="px-4 py-1.5 text-xs text-destructive flex items-center gap-1.5"
        >
          <WarningCircle className="h-3 w-3 shrink-0" />
          {attachmentError}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="px-4 pb-2 space-y-2">
          <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <span>{attachments.length} file{attachments.length === 1 ? '' : 's'} attached</span>
            <span>{formatFileSize(totalSize)} total</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((file) => (
              <div
                key={file.id}
                className="group flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/50 px-2 py-1 text-xs text-muted-foreground"
              >
                <FileTypeIcon type={file.type} className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[120px]" title={file.name}>
                  {file.name}
                </span>
                <span className="text-muted-foreground/50">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => onRemove(file.id)}
                  className="ml-0.5 rounded-sm opacity-50 transition-opacity hover:opacity-100"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
