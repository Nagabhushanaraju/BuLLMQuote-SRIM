// Location: src/renderer/components/StageExecutionOutput.tsx
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, ColDef, CellValueChangedEvent, IRowNode } from 'ag-grid-community';
import { SpinnerGap, FileXls } from '@phosphor-icons/react';
import { utils, writeFile } from 'xlsx';
import { BomQualityStrip, findDuplicateMpns, type QualityFilter } from './BomQualityStrip';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

ModuleRegistry.registerModules([AllCommunityModule]);

const PYTHON_BRIDGE = (import.meta.env.VITE_PYTHON_BRIDGE_URL ?? 'http://192.168.1.27:3010').replace(/\/$/, '');

interface HitlContext {
  rfqId: string;
  stage: string;
  type: 'preview' | 'approval' | 'alternates';
}

interface StageExecutionOutputProps {
  rpcClient: { request: (channel: string, args: unknown[]) => Promise<unknown> };
  hitlContextData: HitlContext;
  rowDataPayload: Record<string, unknown>[];
}

interface AlternateSupplier {
  supplier: string;
  price: number;
  moq: number;
  lead_time: string;
  stock: number;
}

interface AlternateCandidate {
  mpn: string;
  manufacturer: string;
  bom_item_id: string;
  is_preferred: boolean;
  description: string;
  suppliers: AlternateSupplier[];
}

interface AlternateGroup {
  cpn: string;
  required_qty: number;
  alternates: AlternateCandidate[];
}

interface AlternateRow {
  cpn: string;
  required_qty: number;
  mpn: string;
  manufacturer: string;
  bom_item_id: string;
  description: string;
  suppliers: AlternateSupplier[];
}

export function StageExecutionOutput({ rpcClient, hitlContextData, rowDataPayload }: StageExecutionOutputProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<Record<string, Record<string, unknown>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all');
  const gridRef = useRef<AgGridReact>(null);

  const [alternates, setAlternates] = useState<AlternateGroup[]>([]);
  const [alternatesLoading, setAlternatesLoading] = useState(false);
  const [alternatesError, setAlternatesError] = useState<string | null>(null);
  const [selectedByCpn, setSelectedByCpn] = useState<Record<string, string>>({});

  // Extract rows from { success, data: [...] } format or use flat array directly
  const rowData = useMemo(() => {
    if (Array.isArray(rowDataPayload)) { return rowDataPayload; }
    const nested = (rowDataPayload as unknown as { data?: Record<string, unknown>[] }).data;
    return nested ?? [];
  }, [rowDataPayload]);

  const duplicateMpns = useMemo(() => findDuplicateMpns(rowData), [rowData]);

  // KPI tile clicks filter the grid via AG Grid's external filter hooks.
  const isExternalFilterPresent = useCallback(() => qualityFilter !== 'all', [qualityFilter]);
  const doesExternalFilterPass = useCallback(
    (node: IRowNode) => {
      const row = node.data as Record<string, unknown> | undefined;
      if (!row) { return true; }
      if (qualityFilter === 'missingCpn') {
        return row.cpn === null || row.cpn === undefined || row.cpn === '';
      }
      if (qualityFilter === 'duplicateMpn') {
        return duplicateMpns.has(String(row.mpn ?? ''));
      }
      if (qualityFilter === 'qtyMismatch') {
        return row.bom_qty !== row.required_qty;
      }
      return true;
    },
    [qualityFilter, duplicateMpns],
  );

  useEffect(() => {
    gridRef.current?.api?.onFilterChanged();
  }, [qualityFilter]);

  // Fires automatically whenever the incoming HITL context type is 'alternates' —
  // no user-triggered toggle; the SSE event itself decides which data set to show.
  useEffect(() => {
    if (hitlContextData.type !== 'alternates') { return; }

    setAlternatesLoading(true);
    setAlternatesError(null);

    fetch(`${PYTHON_BRIDGE}/api/bom/alternatives/${hitlContextData.rfqId}`)
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error((json as { detail?: string }).detail ?? `Server error ${r.status}`);
        }
        return json as { data: AlternateGroup[] };
      })
      .then((json) => {
        const groups = json.data ?? [];
        setAlternates(groups);

        const preferred: Record<string, string> = {};
        for (const group of groups) {
          const pref = group.alternates.find((a) => a.is_preferred);
          if (pref) { preferred[group.cpn] = pref.mpn; }
        }
        setSelectedByCpn(preferred);
      })
      .catch((err) => {
        setAlternatesError(err instanceof Error ? err.message : 'Failed to load alternates');
      })
      .finally(() => setAlternatesLoading(false));
  }, [hitlContextData.type, hitlContextData.rfqId]);

  const alternateRows = useMemo<AlternateRow[]>(
    () =>
      alternates.flatMap((group) =>
        group.alternates.map((alt) => ({
          cpn: group.cpn,
          required_qty: group.required_qty,
          mpn: alt.mpn,
          manufacturer: alt.manufacturer,
          bom_item_id: alt.bom_item_id,
          description: alt.description,
          suppliers: alt.suppliers,
        })),
      ),
    [alternates],
  );

  const handleSelectAlternate = useCallback(
    async (cpn: string, mpn: string) => {
      const previous = selectedByCpn[cpn];
      setSelectedByCpn((prev) => ({ ...prev, [cpn]: mpn }));

      try {
        const res = await fetch(
          `${PYTHON_BRIDGE}/api/bom/alternatives/${hitlContextData.rfqId}/select`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpn, mpn }),
          },
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { detail?: string }).detail ?? `Server error ${res.status}`);
        }
      } catch (err) {
        setSelectedByCpn((prev) => ({ ...prev, [cpn]: previous }));
        setAlternatesError(err instanceof Error ? err.message : 'Selection failed');
      }
    },
    [selectedByCpn, hitlContextData.rfqId],
  );

  const alternateColumnDefs = useMemo<ColDef[]>(
    () => [
      { field: 'bom_item_id', hide: true },
      { field: 'cpn', headerName: 'CPN', width: 110, pinned: 'left', filter: true },
      { field: 'required_qty', headerName: 'Req Qty', type: 'numericColumn', width: 100 },
      { field: 'manufacturer', headerName: 'Manufacturer', width: 140 },
      { field: 'mpn', headerName: 'MPN', width: 130, filter: true },
      { field: 'description', headerName: 'Description', minWidth: 200, flex: 1 },
      {
        headerName: 'Suppliers',
        minWidth: 260,
        flex: 1,
        cellRenderer: (params: { data?: AlternateRow }) => {
          const suppliers = params.data?.suppliers ?? [];
          if (suppliers.length === 0) { return '—'; }
          return (
            <div className="text-[11px] leading-tight py-1 space-y-0.5">
              {suppliers.map((s) => (
                <div key={s.supplier}>
                  {s.supplier} — ${s.price} · MOQ {s.moq} · {s.lead_time} · {s.stock} in stock
                </div>
              ))}
            </div>
          );
        },
      },
      {
        headerName: 'Select',
        width: 90,
        pinned: 'right',
        cellRenderer: (params: { data?: AlternateRow }) => {
          const row = params.data;
          if (!row) { return null; }
          return (
            <input
              type="radio"
              name={`alt-select-${row.cpn}`}
              checked={selectedByCpn[row.cpn] === row.mpn}
              onChange={() => { void handleSelectAlternate(row.cpn, row.mpn); }}
              aria-label={`Select ${row.mpn} for ${row.cpn}`}
            />
          );
        },
      },
    ],
    [selectedByCpn, handleSelectAlternate],
  );

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

  const handleDownloadExcel = useCallback(() => {
    const isAlternates = hitlContextData.type === 'alternates';
    const exportRows = isAlternates
      ? alternateRows.map(({ suppliers, ...rest }) => ({
          ...rest,
          suppliers: suppliers
            .map((s) => `${s.supplier} $${s.price} MOQ${s.moq} ${s.lead_time} qty${s.stock}`)
            .join('; '),
        }))
      : rowData.map(({ bom_item_id: _bomItemId, ...rest }) => rest);

    if (exportRows.length === 0) { return; }

    const worksheet = utils.json_to_sheet(exportRows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'BOM');
    writeFile(workbook, `bom-${hitlContextData.rfqId}-${hitlContextData.type}.xlsx`);
  }, [hitlContextData, rowData, alternateRows]);

  const exportRowCount = hitlContextData.type === 'alternates' ? alternateRows.length : rowData.length;

  const pendingCount = Object.keys(pendingEdits).length;

  const columnDefs = useMemo<ColDef[]>(() => [
    { field: 'bom_item_id', hide: true, editable: false },
    { field: 'item_num', headerName: '#', width: 70, pinned: 'left', sort: 'asc', editable: false },
    {
      field: 'cpn',
      headerName: 'CPN',
      width: 110,
      pinned: 'left',
      filter: true,
      // Missing CPN is the most common intake defect — flag the cell amber
      cellStyle: (params) =>
        params.value === null || params.value === undefined || params.value === ''
          ? { backgroundColor: 'rgba(245,158,11,0.12)', borderLeft: '2px solid rgba(245,158,11,0.5)' }
          : null,
    },
    {
      field: 'mpn',
      headerName: 'MPN',
      width: 130,
      pinned: 'left',
      filter: true,
      cellStyle: (params) =>
        duplicateMpns.has(String(params.value ?? ''))
          ? { backgroundColor: 'rgba(239,68,68,0.12)', borderLeft: '2px solid rgba(239,68,68,0.5)' }
          : null,
    },
    { field: 'mfr', headerName: 'Manufacturer', width: 120 },
    { field: 'description', headerName: 'Description', minWidth: 200, flex: 1 },
    { field: 'bom_qty', headerName: 'BOM Qty', type: 'numericColumn', width: 100 },
    {
      field: 'required_qty',
      headerName: 'Req Qty',
      type: 'numericColumn',
      width: 100,
      cellStyle: (params) =>
        params.data && params.data.bom_qty !== params.data.required_qty
          ? { backgroundColor: 'rgba(245,158,11,0.12)' }
          : null,
    },
    { field: 'uom', headerName: 'UOM', width: 80 },
  ], [duplicateMpns]);

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

      {hitlContextData.type === 'preview' && (
        <BomQualityStrip rows={rowData} active={qualityFilter} onSelect={setQualityFilter} />
      )}

      <div className="flex-1 min-h-0 w-full mb-4 bg-background/75 rounded-md border border-border/70 overflow-hidden">
        {hitlContextData.type === 'preview' && (
          <div className="ag-theme-alpine-dark w-full h-full">
            <AgGridReact
              ref={gridRef}
              rowData={rowData}
              columnDefs={columnDefs}
              isExternalFilterPresent={isExternalFilterPresent}
              doesExternalFilterPass={doesExternalFilterPass}
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
        )}

        {hitlContextData.type === 'alternates' && (
          alternatesLoading ? (
            <div className="flex items-center justify-center h-full text-xs font-mono text-muted-foreground">
              <SpinnerGap className="h-4 w-4 animate-spin mr-2" />
              Loading alternate manufacturers...
            </div>
          ) : alternateRows.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs font-mono text-muted-foreground p-6 text-center">
              No alternates found for this RFQ.
            </div>
          ) : (
            <div className="ag-theme-alpine-dark w-full h-full">
              <AgGridReact
                rowData={alternateRows}
                columnDefs={alternateColumnDefs}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                }}
                pagination={true}
                paginationPageSize={25}
                enableCellTextSelection={true}
              />
            </div>
          )
        )}

        {hitlContextData.type === 'approval' && (
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

      {alternatesError && (
        <p className="mb-3 text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded px-3 py-2">
          {alternatesError}
        </p>
      )}

      <div className="flex justify-between items-center gap-3 pt-2 border-t border-border/10">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={exportRowCount === 0}
            className="px-4 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-xs font-semibold rounded-md transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <FileXls className="h-3.5 w-3.5" />
            Download Excel
          </button>
          {pendingCount > 0 && (
            <button
              type="button"
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
            type="button"
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
