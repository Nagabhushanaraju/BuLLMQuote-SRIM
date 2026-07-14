import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export type QualityFilter = 'all' | 'missingCpn' | 'duplicateMpn' | 'qtyMismatch';

interface BomQualityStripProps {
  rows: Record<string, unknown>[];
  active: QualityFilter;
  onSelect: (filter: QualityFilter) => void;
}

export interface BomQualityStats {
  total: number;
  missingCpn: number;
  duplicateMpn: number;
  qtyMismatch: number;
  clean: number;
}

/** MPN values appearing on more than one row. */
export function findDuplicateMpns(rows: Record<string, unknown>[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    const mpn = String(row.mpn ?? '');
    if (!mpn) {
      continue;
    }
    if (seen.has(mpn)) {
      duplicates.add(mpn);
    }
    seen.add(mpn);
  }
  return duplicates;
}

export function computeBomQualityStats(rows: Record<string, unknown>[]): BomQualityStats {
  const duplicates = findDuplicateMpns(rows);
  let missingCpn = 0;
  let duplicateMpn = 0;
  let qtyMismatch = 0;
  let clean = 0;
  for (const row of rows) {
    const isMissingCpn = row.cpn === null || row.cpn === undefined || row.cpn === '';
    const isDuplicate = duplicates.has(String(row.mpn ?? ''));
    const isQtyMismatch =
      row.bom_qty !== undefined &&
      row.required_qty !== undefined &&
      row.bom_qty !== row.required_qty;
    if (isMissingCpn) {
      missingCpn++;
    }
    if (isDuplicate) {
      duplicateMpn++;
    }
    if (isQtyMismatch) {
      qtyMismatch++;
    }
    if (!isMissingCpn && !isDuplicate && !isQtyMismatch) {
      clean++;
    }
  }
  return { total: rows.length, missingCpn, duplicateMpn, qtyMismatch, clean };
}

interface TileConfig {
  filter: QualityFilter;
  label: string;
  count: (s: BomQualityStats) => number;
  toneClasses: string;
  activeClasses: string;
}

const TILES: TileConfig[] = [
  {
    filter: 'all',
    label: 'Line Items',
    count: (s) => s.total,
    toneClasses: 'text-slate-300 border-slate-800',
    activeClasses: 'border-slate-500 bg-slate-800/40',
  },
  {
    filter: 'missingCpn',
    label: 'Missing CPN',
    count: (s) => s.missingCpn,
    toneClasses: 'text-amber-400 border-amber-500/30',
    activeClasses: 'border-amber-400 bg-amber-500/10',
  },
  {
    filter: 'duplicateMpn',
    label: 'Duplicate MPN',
    count: (s) => s.duplicateMpn,
    toneClasses: 'text-red-400 border-red-500/30',
    activeClasses: 'border-red-400 bg-red-500/10',
  },
  {
    filter: 'qtyMismatch',
    label: 'Qty Mismatch',
    count: (s) => s.qtyMismatch,
    toneClasses: 'text-amber-400 border-amber-500/30',
    activeClasses: 'border-amber-400 bg-amber-500/10',
  },
];

/**
 * Rendering SOP: "Adaptive Structured Grid" — clickable data-quality KPI tiles
 * above the HITL grid. Clicking a tile filters the grid to the affected rows,
 * turning "review 104 rows" into "review the 12 problems".
 */
export function BomQualityStrip({ rows, active, onSelect }: BomQualityStripProps) {
  const stats = useMemo(() => computeBomQualityStats(rows), [rows]);

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3" data-testid="bom-quality-strip">
      {TILES.map((tile) => {
        const count = tile.count(stats);
        const isActive = active === tile.filter;
        return (
          <button
            key={tile.filter}
            type="button"
            onClick={() => onSelect(isActive ? 'all' : tile.filter)}
            disabled={tile.filter !== 'all' && count === 0}
            className={cn(
              'flex items-baseline gap-1.5 rounded-lg border px-3 py-1.5 transition-colors',
              'disabled:opacity-40 disabled:cursor-default',
              tile.toneClasses,
              isActive ? tile.activeClasses : 'bg-transparent hover:bg-slate-800/30',
            )}
          >
            <span className="text-sm font-semibold font-mono">{count}</span>
            <span className="text-[10px] uppercase tracking-wider opacity-80">{tile.label}</span>
          </button>
        );
      })}
      <span className="ml-auto text-[10px] font-mono text-emerald-400/80">
        {stats.clean} clean rows
      </span>
    </div>
  );
}
