// Location: src/renderer/components/StageExecutionOutput.tsx
import { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, ColDef } from 'ag-grid-community';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

ModuleRegistry.registerModules([AllCommunityModule]);

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

  const submitAction = async (isApproved: boolean) => {
    setIsSubmitting(true);
    try {
      await rpcClient.request('hitl:submit-decision', [hitlContextData.rfqId, isApproved]);
    } catch (err) {
      console.error("Failed executing override clearance:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columnDefs = useMemo<ColDef[]>(() => [
    { field: 'item_num', headerName: '#', width: 70, pinned: 'left', sort: 'asc' },
    { field: 'cpn', headerName: 'CPN', width: 110, pinned: 'left', filter: true },
    { field: 'mpn', headerName: 'MPN', width: 130, pinned: 'left', filter: true },
    { field: 'mfr', headerName: 'Manufacturer', width: 120 },
    { field: 'description', headerName: 'Description', minWidth: 200, flex: 1 },
    { field: 'bom_qty', headerName: 'BOM Qty', type: 'numericColumn', width: 100 },
    { field: 'required_qty', headerName: 'Req Qty', type: 'numericColumn', width: 100 },
    { field: 'uom', headerName: 'UOM', width: 80 }
  ], []);

  return (
    <div className="flex flex-col h-full w-full bg-[#0b0f19] text-white p-4 font-sans">
      <div className="p-3 border border-yellow-500/20 bg-yellow-500/5 rounded-md mb-4 flex justify-between items-center">
        <div>
          <h4 className="text-xs font-bold text-yellow-400 font-mono uppercase tracking-wider">
            ⚠️ Human-in-the-Loop Intercept Mode
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Pipeline paused at stage: <span className="text-white font-mono">{hitlContextData.stage}</span>. Audit data accuracy below to proceed.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full mb-4 bg-[#090d16] rounded-md border border-border/10 overflow-hidden">
        {hitlContextData.type === 'preview' ? (
          <div className="ag-theme-alpine-dark w-full h-full">
            <AgGridReact
              rowData={rowDataPayload}
              columnDefs={columnDefs}
              defaultColDef={{ sortable: true, filter: true, resizable: true, floatingFilter: true }}
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

      <div className="flex justify-end gap-3 pt-2 border-t border-border/10">
        <button
          onClick={() => submitAction(false)}
          disabled={isSubmitting}
          className="px-4 py-2 bg-red-600/90 hover:bg-red-700 text-xs font-semibold rounded-md transition disabled:opacity-50"
        >
          Halt & Reject Run
        </button>
        <button
          onClick={() => submitAction(true)}
          disabled={isSubmitting}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-xs font-semibold rounded-md text-black transition disabled:opacity-50"
        >
          Clear & Resume Pipeline
        </button>
      </div>
    </div>
  );
}