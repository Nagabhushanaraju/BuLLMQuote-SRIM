import { useState, useEffect, useCallback } from 'react';
import type { McpConnector } from '@accomplish_ai/agent-core/common';
import { getAccomplish } from '@/lib/accomplish';
import { isDeveloperMode, setDeveloperMode } from '@/lib/developer-mode';
import { cn } from '@/lib/utils';

/**
 * Quick-add templates for the SRIM 3.2 / DigiBull integration stack. URLs are
 * editable placeholders (local defaults) — clicking prefills the add form so the
 * user just confirms/adjusts the endpoint. These are the MCP/services from the
 * SRIM architecture (orchestration, execution, gateway, state, dashboards, tools).
 */
const SRIM_MCP_PRESETS: ReadonlyArray<{ name: string; url: string }> = [
  { name: 'Dify (orchestration)', url: 'http://localhost:5001/mcp' },
  { name: 'FastMCP (execution)', url: 'http://localhost:8000/mcp' },
  { name: 'MCP Jungle (gateway)', url: 'http://localhost:8080/mcp' },
  { name: 'Postgres (state/memory)', url: 'http://localhost:8081/mcp' },
  { name: 'Apache Superset', url: 'http://localhost:8088/mcp' },
  { name: 'TestSprite', url: 'http://localhost:8090/mcp' },
  { name: 'Playwright', url: 'http://localhost:8091/mcp' },
  { name: 'Chrome DevTools', url: 'http://localhost:8092/mcp' },
  { name: 'Git', url: 'http://localhost:8093/mcp' },
  { name: 'Filesystem', url: 'http://localhost:8094/mcp' },
  { name: 'VibeShip Scanner', url: 'http://localhost:8095/mcp' },
  { name: 'Report Generator', url: 'http://localhost:8096/mcp' },
  { name: 'Accessibility Scanner', url: 'http://localhost:8097/mcp' },
];

/**
 * Developer settings (BETA) — gated by a client-side developer-mode toggle.
 * Houses the MCP connection manager (add remote MCP servers this app connects
 * TO) pre-seeded with the SRIM stack, plus the inbound integration API key.
 */
export function DeveloperSection() {
  const [devMode, setDevMode] = useState(isDeveloperMode());
  const [connectors, setConnectors] = useState<McpConnector[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyEnabled, setApiKeyEnabled] = useState(false);

  type DevKeyApi = {
    getDevApiKey: () => Promise<{ apiKey: string; enabled: boolean }>;
    regenerateDevApiKey: () => Promise<{ apiKey: string; enabled: boolean }>;
  };

  const refresh = useCallback(async () => {
    try {
      setConnectors(await getAccomplish().getConnectors());
    } catch {
      // ignore — list stays as-is
    }
  }, []);

  const loadKey = useCallback(async () => {
    try {
      const api = getAccomplish() as unknown as DevKeyApi;
      const r = await api.getDevApiKey();
      setApiKey(r.apiKey);
      setApiKeyEnabled(r.enabled);
    } catch {
      // ignore
    }
  }, []);

  const regenKey = useCallback(async () => {
    try {
      const api = getAccomplish() as unknown as DevKeyApi;
      const r = await api.regenerateDevApiKey();
      setApiKey(r.apiKey);
      setApiKeyEnabled(r.enabled);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (devMode) {
      void refresh();
      void loadKey();
    }
  }, [devMode, refresh, loadKey]);

  const add = useCallback(async () => {
    const n = name.trim();
    const u = url.trim();
    if (!n || !u) {
      setError('Name and URL are required.');
      return;
    }
    try {
      new URL(u);
    } catch {
      setError('Enter a valid URL (https://…).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await getAccomplish().addConnector(n, u);
      setName('');
      setUrl('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add connection.');
    } finally {
      setBusy(false);
    }
  }, [name, url, refresh]);

  const remove = useCallback(
    async (id: string) => {
      try {
        await getAccomplish().deleteConnector(id);
        await refresh();
      } catch {
        // ignore
      }
    },
    [refresh],
  );

  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 font-medium text-foreground">
            Developer
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-primary/15 text-primary">
              BETA
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            MCP connections &amp; integration tools for wiring Accomplish into other workflows.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={devMode}
          onClick={() => {
            const next = !devMode;
            setDeveloperMode(next);
            setDevMode(next);
          }}
          className={cn(
            'ml-4 relative h-6 w-11 shrink-0 rounded-full transition-colors',
            devMode ? 'bg-primary' : 'bg-input',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
              devMode ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
      </div>

      {devMode && (
        <>
          <div className="rounded-lg border border-border bg-background p-3 space-y-3">
            <div className="text-sm font-medium text-foreground">MCP connections (remote)</div>
            <p className="text-xs text-muted-foreground">
              Add remote MCP servers (local or hosted) the agent can use as tools. Any number of
              connections are supported.
            </p>

            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Quick-add · SRIM stack (edit URL after)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SRIM_MCP_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      setName(p.name);
                      setUrl(p.url);
                      setError(null);
                    }}
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name (e.g. MCP Jungle)"
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://host/mcp"
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => void add()}
                disabled={busy}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                {busy ? 'Adding…' : 'Add'}
              </button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}

            <ul className="space-y-1.5">
              {connectors.length === 0 && (
                <li className="text-xs text-muted-foreground">No connections yet.</li>
              )}
              {connectors.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{c.url}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void remove(c.id)}
                    className="ml-3 text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-background p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              Integration API key
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                  apiKeyEnabled
                    ? 'bg-success-subtle text-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {apiKeyEnabled ? 'ACTIVE' : 'DISABLED'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              External workflows (Dify / FastMCP) send this as <code>Authorization: Bearer …</code>{' '}
              to call <code>http://127.0.0.1:9234/rpc</code>. Grants full local API access.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={apiKey ?? '••••••••'}
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (apiKey) void navigator.clipboard?.writeText(apiKey);
                }}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => void regenKey()}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
              >
                Regenerate
              </button>
            </div>
            {!apiKeyEnabled && (
              <p className="text-[11px] text-warning">
                Inbound access is OFF. To activate, start the daemon with{' '}
                <code>ACCOMPLISH_ENABLE_INTEGRATION_API=1</code> (security opt-in).
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
