import { useState, useRef, useEffect, useCallback, useMemo, Children, isValidElement } from 'react';
import type { ReactNode } from 'react';
import { Check, Copy } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

const COPIED_TIMEOUT_MS = 1200;
const COLLAPSE_THRESHOLD = 10;
const COLLAPSED_VISIBLE_ROWS = 5;

interface MarkdownTableProps {
  children?: ReactNode;
}

/** Count <tr> children of the <tbody> element without touching the DOM. */
function countBodyRows(children: ReactNode): number {
  let count = 0;
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === 'tbody') {
      Children.forEach((child.props as { children?: ReactNode }).children, (row) => {
        if (isValidElement(row)) {
          count++;
        }
      });
    }
  });
  return count;
}

/** Serialize the rendered table DOM to tab-separated values (pastes cleanly into Excel). */
function tableToTsv(table: HTMLTableElement): string {
  return Array.from(table.rows)
    .map((row) =>
      Array.from(row.cells)
        .map((cell) => (cell.textContent ?? '').trim().replace(/\t/g, ' '))
        .join('\t'),
    )
    .join('\n');
}

/**
 * SOP: "Markdown Structured Tables" — production treatment for tables streamed
 * into the chat viewport. Registered as the `table` renderer in
 * message-markdown-config.tsx. Adds alternating row tint, sticky header,
 * one-click copy-as-TSV, and collapses long tables behind a "show more" toggle.
 */
export function MarkdownTable({ children }: MarkdownTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const rowCount = useMemo(() => countBodyRows(children), [children]);

  const handleCopy = useCallback(async () => {
    const table = tableRef.current;
    if (!table) {
      return;
    }
    try {
      await navigator.clipboard.writeText(tableToTsv(table));
      setCopied(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), COPIED_TIMEOUT_MS);
    } catch {
      // clipboard API may be unavailable in non-secure contexts
    }
  }, []);

  const collapsed = rowCount > COLLAPSE_THRESHOLD && !expanded;
  const hiddenRows = rowCount - COLLAPSED_VISIBLE_ROWS;

  return (
    <div className="group/table relative my-3 overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy table to clipboard"
        data-testid="markdown-table-copy-button"
        className={cn(
          'absolute right-2 top-2 z-10 flex items-center gap-1 rounded bg-muted/90 px-2 py-0.5 text-xs backdrop-blur-sm transition-opacity',
          'opacity-0 pointer-events-none',
          'group-hover/table:opacity-100 group-hover/table:pointer-events-auto',
          'focus-visible:opacity-100 focus-visible:pointer-events-auto',
          'text-muted-foreground hover:text-foreground',
          copied && '!text-green-600 dark:!text-green-400',
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied!' : 'Copy'}
      </button>

      <div
        className={cn('overflow-x-auto', collapsed && 'max-h-64 overflow-y-hidden')}
        style={
          collapsed
            ? { maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)' }
            : undefined
        }
      >
        <table
          ref={tableRef}
          className={cn(
            'w-full border-collapse text-sm',
            '[&_thead]:sticky [&_thead]:top-0 [&_thead]:bg-muted',
            '[&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground [&_th]:border-b [&_th]:border-border',
            '[&_td]:px-3 [&_td]:py-1.5 [&_td]:text-foreground [&_td]:border-b [&_td]:border-border/50',
            '[&_tbody_tr:nth-child(even)]:bg-muted/40',
          )}
        >
          {children}
        </table>
      </div>

      {rowCount > COLLAPSE_THRESHOLD && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full border-t border-border bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? 'Collapse table' : `Show ${hiddenRows} more rows`}
        </button>
      )}
    </div>
  );
}
