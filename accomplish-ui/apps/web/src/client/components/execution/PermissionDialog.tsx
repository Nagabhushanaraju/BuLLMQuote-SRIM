import { useState } from 'react';
import { motion } from 'framer-motion';
import { springs } from '../../lib/animations';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, AlertCircle, File, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PermissionRequest } from '@accomplish_ai/agent-core/common';
import { isDeleteOperation, getDisplayFilePaths } from './permission-utils';
import { PermissionDialogFile } from './PermissionDialogFile';
import { PermissionDialogQuestion } from './PermissionDialogQuestion';
import { PermissionDialogTool } from './PermissionDialogTool';

interface PermissionDialogProps {
  permissionRequest: PermissionRequest;
  onRespond: (allowed: boolean, selectedOptions?: string[], customText?: string) => void;
}

export function PermissionDialog({ permissionRequest, onRespond }: PermissionDialogProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [customResponse, setCustomResponse] = useState('');
  const isQuestion = permissionRequest.type === 'question';

  const handleRespond = (allowed: boolean) => {
    const hasCustomText = isQuestion && customResponse.trim();
    onRespond(
      allowed,
      isQuestion ? (hasCustomText ? [] : selectedOptions) : undefined,
      hasCustomText ? customResponse.trim() : undefined,
    );
    setSelectedOptions([]);
    setCustomResponse('');
  };

  const isDelete = isDeleteOperation(permissionRequest);
  const questionDisabled = selectedOptions.length === 0 && !customResponse.trim();

  if (isQuestion) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={springs.gentle}
        className="mx-auto w-full max-w-3xl"
        data-testid="execution-permission-card"
      >
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.05] shadow-[0_24px_80px_-56px_hsl(var(--primary)/0.7)]">
          <div className="border-b border-border/70 bg-muted/30 p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-inner">
                <Brain className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                  DigiBull Question
                </div>
                <h3 className="mt-1 text-lg font-semibold text-foreground">
                  {permissionRequest.header || 'DigiBull needs one detail'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  The AI paused here because it wants your answer before it continues.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5">
            <PermissionDialogQuestion
              permissionRequest={permissionRequest}
              selectedOptions={selectedOptions}
              setSelectedOptions={setSelectedOptions}
              customResponse={customResponse}
              setCustomResponse={setCustomResponse}
              onSubmit={() => handleRespond(true)}
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border/70 bg-background/60 p-5 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => handleRespond(false)}
              className="sm:min-w-32"
              data-testid="permission-deny-button"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleRespond(true)}
              className="sm:min-w-32"
              data-testid="permission-allow-button"
              disabled={questionDisabled}
            >
              Send answer
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      data-testid="execution-permission-card"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={springs.bouncy}
      >
        <Card className="w-full max-w-lg mx-4 max-h-[80vh] flex flex-col overflow-hidden">
          <div className="flex items-start gap-4 p-6 pb-4 shrink-0">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full shrink-0',
                isDelete
                  ? 'bg-red-500/10'
                  : permissionRequest.type === 'file'
                    ? 'bg-amber-500/10'
                    : permissionRequest.type === 'question'
                      ? 'bg-primary/10'
                      : 'bg-warning/10',
              )}
            >
              {isDelete ? (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              ) : permissionRequest.type === 'file' ? (
                <File className="h-5 w-5 text-amber-600" />
              ) : permissionRequest.type === 'question' ? (
                <Brain className="h-5 w-5 text-primary" />
              ) : (
                <AlertCircle className="h-5 w-5 text-warning" />
              )}
            </div>
            <h3
              className={cn('text-lg font-semibold', isDelete ? 'text-red-600' : 'text-foreground')}
            >
              {isDelete
                ? 'File Deletion Warning'
                : permissionRequest.type === 'file'
                  ? 'File Permission Required'
                  : permissionRequest.type === 'question'
                    ? permissionRequest.header || 'Question'
                    : 'Permission Required'}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto px-6 min-h-0">
            {permissionRequest.type === 'file' && (
              <PermissionDialogFile permissionRequest={permissionRequest} />
            )}
            {permissionRequest.type === 'question' && (
              <PermissionDialogQuestion
                permissionRequest={permissionRequest}
                selectedOptions={selectedOptions}
                setSelectedOptions={setSelectedOptions}
                customResponse={customResponse}
                setCustomResponse={setCustomResponse}
                onSubmit={() => handleRespond(true)}
              />
            )}
            {permissionRequest.type === 'tool' && (
              <PermissionDialogTool permissionRequest={permissionRequest} />
            )}
          </div>

          <div className="flex gap-3 p-6 pt-4 shrink-0 border-t border-border">
            <Button
              variant="outline"
              onClick={() => handleRespond(false)}
              className="flex-1"
              data-testid="permission-deny-button"
            >
              {permissionRequest.type === 'question' ? 'Cancel' : 'Deny'}
            </Button>
            <Button
              onClick={() => handleRespond(true)}
              className={cn('flex-1', isDelete && 'bg-red-600 hover:bg-red-700 text-white')}
              data-testid="permission-allow-button"
            >
              {isDelete
                ? getDisplayFilePaths(permissionRequest).length > 1
                  ? 'Delete All'
                  : 'Delete'
                : 'Allow'}
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
