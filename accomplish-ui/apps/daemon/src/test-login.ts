/**
 * DEV/TESTING ONLY — local login bypass.
 *
 * The real login validates a NetBird Personal Access Token against
 * https://api.netbird.io/api/users (see browser-api-server.ts). That requires a
 * real NetBird account, which is unavailable during local testing. This module
 * provides a self-contained bypass so the app can be exercised end-to-end
 * without NetBird: a fixed test token AND a username/password pair.
 *
 * SAFETY: disabled automatically when NODE_ENV === 'production'. It can be
 * force-disabled with ACCOMPLISH_DISABLE_TEST_LOGIN=1, or force-enabled with
 * ACCOMPLISH_TEST_LOGIN=1. Credentials are overridable via env vars. These same
 * values are written to apps/daemon/.test-login.json and shown on the login page
 * (dev build only) so testers can copy them.
 */

export interface TestLoginUser {
  id: string;
  name: string;
  email: string;
}

export interface TestLoginConfig {
  enabled: boolean;
  token: string;
  username: string;
  password: string;
  user: TestLoginUser;
}

// Default DEV credentials. NOT secrets — they only unlock a local testing build.
const DEFAULT_TOKEN = 'srim-dev-token';
const DEFAULT_USERNAME = 'digibull';
const DEFAULT_PASSWORD = 'srim-test-2026';

export function getTestLoginConfig(): TestLoginConfig {
  const forceOff = process.env.ACCOMPLISH_DISABLE_TEST_LOGIN === '1';
  const forceOn = process.env.ACCOMPLISH_TEST_LOGIN === '1';
  const enabled = !forceOff && (forceOn || process.env.NODE_ENV !== 'production');

  return {
    enabled,
    token: process.env.ACCOMPLISH_TEST_LOGIN_TOKEN || DEFAULT_TOKEN,
    username: process.env.ACCOMPLISH_TEST_LOGIN_USER || DEFAULT_USERNAME,
    password: process.env.ACCOMPLISH_TEST_LOGIN_PASS || DEFAULT_PASSWORD,
    user: {
      id: 'test-user-digibull',
      name: 'DigiBull Tester',
      email: 'tester@digibull.ai',
    },
  };
}

/**
 * Returns the test user if the supplied credentials match the configured test
 * login, or null otherwise. Accepts either a bare token or username+password.
 */
export function matchTestLogin(input: {
  token?: string;
  username?: string;
  password?: string;
}): TestLoginUser | null {
  const cfg = getTestLoginConfig();
  if (!cfg.enabled) {
    return null;
  }
  if (input.token && input.token === cfg.token) {
    return cfg.user;
  }
  if (
    input.username &&
    input.password &&
    input.username === cfg.username &&
    input.password === cfg.password
  ) {
    return cfg.user;
  }
  return null;
}
