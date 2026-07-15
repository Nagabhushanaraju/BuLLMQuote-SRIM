// Location: src/renderer/components/StageExecutionOutput.tsx
import { useMemo, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, ColDef, CellValueChangedEvent } from 'ag-grid-community';
import { SpinnerGap } from '@phosphor-icons/react';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

ModuleRegistry.registerModules([AllCommunityModule]);

const PYTHON_BRIDGE = 'http://192.168.1.27:3010';

interface HitlContext {
  rfqId: string;
  stage: string;
  type: 'preview' | 'approval';
}

interface StageExecutionOutputProps {
  rpcClient: { request: (channel: string, args: unknown[]) => Promise<unknown> };
  hitlContextData: HitlContext;              
  rowDataPayload: Record<string, unknown>[];  
}

export function StageExecutionOutput({ rpcClient, hitlContextData, rowDataPayload }: StageExecutionOutputProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<Record<string, Record<string, unknown>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Extract rows from { success, data: [...] } format or use flat array directly
  const rowData = useMemo(() => {
    if (Array.isArray(rowDataPayload)) { return rowDataPayload; }
    const nested = (rowDataPayload as unknown as { data?: Record<string, unknown>[] }).data;
    return nested ?? [];
  }, [rowDataPayload]);

  const submitAction = async (isApproved: boolean) => {
    setIsSubmitting(true);
    try {
      await rpcClient.request('hitl:submit-decision', [hitlContextData.rfqId, isApproved]);
    } catch (err) {
      console.error('Failed executing override clearance:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const rowKey = event.data.bom_item_id as string;
    setPendingEdits((prev) => ({ ...prev, [rowKey]: { ...event.data } }));
  }, []);

  const handleSaveChanges = async () => {
    const rows = Object.values(pendingEdits);
    if (rows.length === 0) { return; }

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(
        `${PYTHON_BRIDGE}/api/bom/batch-update/${hitlContextData.rfqId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rows),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as { detail?: string }).detail ?? `Server error ${response.status}`);
      }

      setPendingEdits({});
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const pendingCount = Object.keys(pendingEdits).length;

  const columnDefs = useMemo<ColDef[]>(() => [
    { field: 'bom_item_id', hide: true, editable: false },
    { field: 'item_num', headerName: '#', width: 70, pinned: 'left', sort: 'asc', editable: false },
    { field: 'cpn', headerName: 'CPN', width: 110, pinned: 'left', filter: true },
    { field: 'mpn', headerName: 'MPN', width: 130, pinned: 'left', filter: true },
    { field: 'mfr', headerName: 'Manufacturer', width: 120 },
    { field: 'description', headerName: 'Description', minWidth: 200, flex: 1 },
    { field: 'bom_qty', headerName: 'BOM Qty', type: 'numericColumn', width: 100 },
    { field: 'required_qty', headerName: 'Req Qty', type: 'numericColumn', width: 100 },
    { field: 'uom', headerName: 'UOM', width: 80 },
  ], []);

  return (
    <div className="srim-theme-shell flex flex-col h-full w-full p-4 font-sans">
      <div className="p-3 border border-yellow-500/20 bg-yellow-500/5 rounded-md mb-4 flex justify-between items-center">
        <div>
          <h4 className="text-xs font-bold text-yellow-400 font-mono uppercase tracking-wider">
            ⚠️ Human-in-the-Loop Intercept Mode
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Pipeline paused at stage: <span className="text-white font-mono">{hitlContextData.stage}</span>. Edit cells below, then save before proceeding.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 shrink-0">
            {pendingCount} unsaved {pendingCount === 1 ? 'row' : 'rows'}
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 w-full mb-4 bg-background/75 rounded-md border border-border/70 overflow-hidden">
        {hitlContextData.type === 'preview' ? (
          <div className="ag-theme-alpine-dark w-full h-full">
            <AgGridReact
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
                floatingFilter: true,
                editable: true,
              }}
              getRowStyle={(params) =>
                (params.data?.bom_item_id as string) in pendingEdits
                  ? { backgroundColor: 'rgba(234,179,8,0.07)', borderLeft: '2px solid rgba(234,179,8,0.5)' }
                  : undefined
              }
              onCellValueChanged={handleCellValueChanged}
              pagination={true}
              paginationPageSize={25}
              enableCellTextSelection={true}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-xs font-mono text-muted-foreground p-6 text-center">
            Simple validation requested. Review tracking files and verify execution path via clearance toggles.
          </div>
        )}
      </div>

      {saveError && (
        <p className="mb-3 text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded px-3 py-2">
          {saveError}
        </p>
      )}

      <div className="flex justify-between items-center gap-3 pt-2 border-t border-border/10">
        <div>
          {pendingCount > 0 && (
            <button
              onClick={() => { void handleSaveChanges(); }}
              disabled={isSaving}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-xs font-semibold rounded-md text-black transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <SpinnerGap className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                `Save Changes (${pendingCount})`
              )}
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { void submitAction(false); }}
            disabled={isSubmitting}
            className="px-4 py-2 bg-red-600/90 hover:bg-red-700 text-xs font-semibold rounded-md transition disabled:opacity-50"
          >
            Halt & Reject Run
          </button>
          <button
            onClick={() => { void submitAction(true); }}
            disabled={isSubmitting}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-xs font-semibold rounded-md text-black transition disabled:opacity-50"
          >
            Clear & Resume Pipeline
          </button>
        </div>
      </div>
    </div>
  );
}
