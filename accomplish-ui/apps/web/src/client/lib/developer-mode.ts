/**
 * Developer mode — a client-only UI gate (localStorage) that reveals the
 * Developer settings section (MCP connection manager, integration API key).
 * No backend effect on its own.
 */
const KEY = 'developer.mode';

export function isDeveloperMode(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function setDeveloperMode(on: boolean): void {
  try {
    localStorage.setItem(KEY, String(on));
  } catch {
    // localStorage unavailable — preference simply won't persist.
  }
}
