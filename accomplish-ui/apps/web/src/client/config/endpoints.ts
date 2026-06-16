/**
 * Centralized network endpoint registry for the web client.
 *
 * SINGLE SOURCE OF TRUTH for the backend (daemon Browser API) address.
 * Every transport caller — RPC, SSE event stream, session/login, health
 * polling — must read from here instead of hardcoding `http://127.0.0.1:9234`.
 *
 * Resolution order (most migration-proof first):
 *   1. `VITE_BACKEND_URL` env var  → explicit override (set in `.env`, CI, or
 *      the hosting platform). Use this when the API lives on a different
 *      origin/subdomain than the SPA.
 *   2. Dev default                 → `http://127.0.0.1:9234` (matches the
 *      daemon's BrowserApiServer during `pnpm dev:web`).
 *   3. Production default          → same origin that served the app, so
 *      deploying to a real domain (behind a reverse proxy that routes
 *      /rpc, /events, /health to the daemon) needs ZERO code changes.
 *
 * To change the port/host everywhere: edit the dev fallback below, or set
 * VITE_BACKEND_URL. Nothing else in the codebase should reference the address.
 */

function resolveBackendUrl(): string {
  const fromEnv = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) {
    // Strip any trailing slash so `${BACKEND_URL}/rpc` never double-slashes.
    return fromEnv.trim().replace(/\/+$/, '');
  }
  if (import.meta.env.DEV) {
    return `${window.location.protocol}//${window.location.hostname}:9234`;
  }
  // Production build served from a domain: talk to the same origin.
  return window.location.origin;
}

/** Absolute base URL of the backend Browser API (no trailing slash). */
export const BACKEND_URL = resolveBackendUrl();

/**
 * Build an absolute backend URL for a given path.
 * @param path A path beginning with `/` (e.g. `/rpc`, `/events`, `/health`).
 */
export function backendUrl(path: string): string {
  return `${BACKEND_URL}${path}`;
}
