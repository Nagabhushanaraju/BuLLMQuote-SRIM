/** Browser session management for NetBird PAT and local auth screens. */

import { BACKEND_URL } from '../config/endpoints';

const SESSION_KEY = 'accomplish_session';
// Centralized backend address — see config/endpoints.ts.
const BRIDGE = BACKEND_URL;

interface Session {
  token: string;
  user: { name: string; email: string; role?: 'admin' | 'operator' };
  createdAt: number;
}

interface AuthSessionResponse {
  sessionToken?: string;
  user?: { name: string; email: string; role?: 'admin' | 'operator' };
  error?: string;
}

export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function getSessionToken(): string | null {
  return getSession()?.token ?? null;
}

export function isLoggedIn(): boolean {
  return getSession() !== null;
}

export function isAdminSession(): boolean {
  return getSession()?.user.role === 'admin';
}

export function saveSession(token: string, user: { name: string; email: string; role?: 'admin' | 'operator' }): void {
  const session: Session = { token, user, createdAt: Date.now() };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function loginWithPat(pat: string): Promise<{ name: string; email: string }> {
  const res = await fetch(`${BRIDGE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: pat }),
  });
  const data = (await res.json()) as AuthSessionResponse;
  if (!res.ok || !data.sessionToken) {
    throw new Error(data.error ?? 'Login failed');
  }
  saveSession(data.sessionToken, data.user!);
  return data.user!;
}

/**
 * DEV/TESTING login with username + password (test-login bypass on the daemon).
 * Works only against a non-production backend; see apps/daemon/src/test-login.ts.
 */
export async function loginWithCredentials(
  username: string,
  password: string,
): Promise<{ name: string; email: string }> {
  const res = await fetch(`${BRIDGE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = (await res.json()) as {
    sessionToken?: string;
    user?: { name: string; email: string };
    error?: string;
  };
  if (!res.ok || !data.sessionToken) {
    throw new Error(data.error ?? 'Login failed');
  }
  saveSession(data.sessionToken, data.user!);
  return data.user!;
}

/**
 * Email/password uses the same daemon credential shape as username/password.
 * A production auth backend can map this to a real account provider later.
 */
export async function loginWithEmailPassword(
  email: string,
  password: string,
): Promise<{ name: string; email: string }> {
  return loginWithCredentials(email, password);
}

export async function loginWithGoogle(): Promise<never> {
  throw new Error(
    'Google OAuth login is ready in the UI, but the auth backend is not connected yet.',
  );
}

export async function requestMobileOtp(_mobile: string): Promise<never> {
  throw new Error('Mobile OTP login is ready in the UI, but the OTP backend is not connected yet.');
}

export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${BRIDGE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Request failed');
  }
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const res = await fetch(`${BRIDGE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'Password reset failed');
  }
}

export async function requestOnboarding(_input: {
  name: string;
  email: string;
  company?: string;
}): Promise<never> {
  throw new Error(
    'New-user onboarding is ready in the UI, but the onboarding backend is not connected yet.',
  );
}

export async function registerUser(
  username: string,
  email: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${BRIDGE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  const data = (await res.json()) as { success?: boolean; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'Registration failed');
  }
}

export async function logout(): Promise<void> {
  const token = getSessionToken();
  if (token) {
    await fetch(`${BRIDGE}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  clearSession();
}
