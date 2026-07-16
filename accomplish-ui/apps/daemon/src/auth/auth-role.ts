export type AuthRole = 'admin' | 'operator';

/**
 * Admin access is configured on the daemon, never trusted from browser input.
 * Keep the list explicit so a normal authenticated user cannot open the admin UI.
 */
export function getAuthRole(email: string): AuthRole {
  const admins = (process.env.SRIM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase()) ? 'admin' : 'operator';
}
