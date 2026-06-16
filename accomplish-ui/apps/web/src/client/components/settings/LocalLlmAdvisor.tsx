import { useState, useEffect, useCallback } from 'react';
import {
  getSystemSpecs,
  recommendLocalModels,
  type SystemSpecs,
  type ModelRecommendation,
} from '@/lib/local-llm-advisor';

/**
 * LOCAL LLM advisor card — detects the machine (CPU/RAM via daemon, GPU/network
 * in-browser) and recommends which local models it can realistically run.
 * Self-contained: fetches its own data, safe to mount anywhere.
 */
export function LocalLlmAdvisor() {
  const [specs, setSpecs] = useState<SystemSpecs | null>(null);
  const [rec, setRec] = useState<ModelRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getSystemSpecs();
      setSpecs(s);
      setRec(recommendLocalModels(s));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not detect system specs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void detect();
  }, [detect]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold tracking-wide text-foreground">LOCAL LLM</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your machine &amp; the local models it can run
          </p>
        </div>
        <button
          type="button"
          onClick={() => void detect()}
          disabled={loading}
          className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.08] disabled:opacity-40"
        >
          {loading ? 'Detecting…' : 'Re-detect'}
        </button>
      </div>

      {error && (
        <p className="text-xs rounded-md px-3 py-2 bg-destructive/10 text-destructive">{error}</p>
      )}

      {specs && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <Spec label="CPU" value={`${specs.cpuModel}`} />
            <Spec label="Cores" value={`${specs.cpuCores}`} />
            <Spec label="RAM" value={`${specs.totalRamGB} GB (${specs.freeRamGB} free)`} />
            <Spec label="GPU" value={specs.gpu} />
            <Spec label="Platform" value={`${specs.platform}/${specs.arch}`} />
            <Spec
              label="Network"
              value={specs.networkMbps != null ? `${specs.networkMbps} Mbps` : 'unknown'}
            />
          </div>

          {rec && (
            <div className="mt-3 rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary">{rec.tier}</span>
                <span className="text-[11px] text-muted-foreground">{rec.reason}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {rec.models.map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground/80"
                  >
                    {m}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Estimates use RAM + GPU presence (Q4 quantization). Actual fit depends on VRAM and
                context length.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate text-foreground" title={value}>
        {value}
      </div>
    </div>
  );
}
