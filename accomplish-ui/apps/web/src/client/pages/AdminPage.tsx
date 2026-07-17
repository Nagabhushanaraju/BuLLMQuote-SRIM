import { useMemo, useState } from 'react';
import {
  ChartLineUp,
  CheckCircle,
  Gear,
  Key,
  LockKey,
  MagnifyingGlass,
  ShieldCheck,
  UsersThree,
} from '@phosphor-icons/react';

const NAV_ITEMS = [
  { key: 'users', label: 'Users', detail: 'Manage accounts and assignments', icon: UsersThree },
  { key: 'access', label: 'Access control', detail: 'Define who can reach what', icon: LockKey },
  { key: 'skills', label: 'Skill permissions', detail: 'Protect workflow actions', icon: Key },
  { key: 'activity', label: 'Activity', detail: 'Review recent changes', icon: ChartLineUp },
  { key: 'settings', label: 'Admin settings', detail: 'Adjust console behavior', icon: Gear },
] as const;

const SKILLS = [
  'BOM intake and normalization',
  'Feature extraction',
  'Distributor pricing',
  'Alternative detection',
  'Feasibility and risk review',
];

const DEMO_USERS = [
  { id: 'SRIM-001', name: 'DigiBull Tester', email: 'tester@digibull.ai', role: 'Admin', status: 'Active', access: 'All skills' },
  { id: 'SRIM-002', name: 'RFQ Operator', email: 'operator@digibull.ai', role: 'Operator', status: 'Active', access: '3 skills' },
  { id: 'SRIM-003', name: 'Review User', email: 'review@digibull.ai', role: 'Reviewer', status: 'Pending', access: '2 skills' },
];

const ROLE_CARDS = [
  {
    title: 'Admin',
    summary: 'Full access to users, roles, and protected skills.',
    chip: 'All skills',
    accent: 'text-primary',
  },
  {
    title: 'Operator',
    summary: 'Can run workflows and use approved assistance paths.',
    chip: '3 skill groups',
    accent: 'text-sky-500',
  },
  {
    title: 'Reviewer',
    summary: 'Read-only access with signoff visibility.',
    chip: 'Review only',
    accent: 'text-emerald-500',
  },
];

const ACTIVITY_FEED = [
  { label: 'Role audit synced', detail: 'User assignments refreshed from local policy.', time: '2m ago' },
  { label: 'Skill lock updated', detail: 'Alternative detection remains protected.', time: '17m ago' },
  { label: 'Brand tokens applied', detail: 'Orange and blue accents now flow through the console.', time: '1h ago' },
  { label: 'Admin session verified', detail: 'Tester access confirmed on the local daemon.', time: 'Today' },
];

export function AdminPage() {
  const [active, setActive] = useState<(typeof NAV_ITEMS)[number]['key']>('users');
  const [query, setQuery] = useState('');
  const filteredUsers = useMemo(
    () =>
      DEMO_USERS.filter((user) =>
        `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );
  const activeLabel = NAV_ITEMS.find((item) => item.key === active)?.label ?? 'Admin';

  return (
    <div className="srim-theme-shell flex h-full min-h-0 w-full overflow-hidden">
      <aside className="hidden w-[19rem] shrink-0 flex-col border-r border-border/70 bg-background/70 px-4 py-4 backdrop-blur-xl lg:flex">
        <div className="rounded-3xl border border-border/70 bg-background/80 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <img
              src="/assets/cam-new.png"
              alt="CAM 3.0 BOM Automation"
              className="h-12 w-12 rounded-2xl object-cover ring-1 ring-primary/20"
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">CAM 3.0</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">Role center</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Role-based access and skill control for SRIM.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="srim-shell-chip srim-shell-chip--primary">RBAC ready</span>
            <span className="srim-shell-chip">Powered by DigiBull</span>
          </div>
        </div>

        <nav className="mt-4 space-y-2" aria-label="Admin navigation">
          {NAV_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const selected = active === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActive(item.key)}
                className={`group flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-all ${
                  selected
                    ? 'border-primary/25 bg-primary/10 shadow-sm'
                    : 'border-border/60 bg-background/55 hover:border-primary/20 hover:bg-background/80'
                }`}
                aria-current={selected ? 'page' : undefined}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold ${
                    selected
                      ? 'border-primary/30 bg-primary/12 text-primary'
                      : 'border-border/70 bg-background/80 text-muted-foreground group-hover:border-primary/25 group-hover:text-foreground'
                  }`}
                >
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                  <Icon
                      className={`h-4 w-4 shrink-0 ${
                        selected ? 'text-primary' : 'text-muted-foreground'
                      }`}
                      weight={selected ? 'fill' : 'regular'}
                    />
                    <span className="text-sm font-medium text-foreground/95">{item.label}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                </div>
                <CheckCircle
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    selected ? 'text-emerald-500' : 'text-muted-foreground/50'
                  }`}
                />
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-3xl border border-primary/20 bg-primary/10 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <ShieldCheck className="h-4 w-4" />
            Admin access
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Permissions are controlled by the local daemon.
          </p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="border-b border-border/70 bg-background/55 px-5 py-4 backdrop-blur-xl sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                DigiBull AI · Admin
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{activeLabel}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage users, roles, and protected skills from one place.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <ShieldCheck className="h-4 w-4" />
              Role aware
            </div>
          </div>
        </header>

        <div className="space-y-6 p-5 sm:p-8">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Total users', '24', 'Across SRIM'],
              ['Active roles', '4', 'Admin, operator, reviewer'],
              ['Protected skills', '18', 'Role-aware permissions'],
              ['Pending reviews', '3', 'Needs signoff'],
            ].map(([label, value, sub]) => (
              <div key={label} className="srim-theme-panel-soft rounded-3xl border p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </section>

          {active === 'users' && (
            <section className="srim-theme-panel overflow-hidden rounded-3xl border shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 p-4 sm:p-5">
                <div>
                  <h2 className="font-semibold text-foreground">Users and roles</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Manage who can use SRIM workflows and skills.
                  </p>
                </div>
                <label className="relative block">
                  <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search users"
                    className="h-10 w-64 rounded-xl border border-border bg-background/75 pl-9 pr-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                  />
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-muted/35 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">User</th>
                      <th className="px-5 py-3">Role</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Skill access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-t border-border/60">
                        <td className="px-5 py-4">
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-emerald-500">{user.status}</td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">{user.access}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {active === 'access' && (
            <section className="grid gap-4 xl:grid-cols-3">
              {ROLE_CARDS.map((role, index) => (
                <div key={role.title} className="srim-theme-panel rounded-3xl border p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className={`text-xs uppercase tracking-[0.18em] ${role.accent}`}>
                        Role {String(index + 1).padStart(2, '0')}
                      </p>
                      <h2 className="mt-2 text-lg font-semibold text-foreground">{role.title}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{role.summary}</p>
                    </div>
                    <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
                  </div>
                  <div className="mt-4 rounded-2xl border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                    {role.chip}
                  </div>
                </div>
              ))}
            </section>
          )}

          {active === 'skills' && (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {SKILLS.map((skill, index) => (
                <div key={skill} className="srim-theme-panel rounded-3xl border p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.18em] text-primary">
                        Skill {String(index + 1).padStart(2, '0')}
                      </p>
                      <h2 className="mt-2 font-semibold text-foreground">{skill}</h2>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        Controlled by the assigned role and local skills service.
                      </p>
                    </div>
                    <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary via-sky-500 to-primary"
                      style={{ width: `${74 + (index % 3) * 8}%` }}
                    />
                  </div>
                </div>
              ))}
            </section>
          )}

          {active === 'activity' && (
            <section className="grid gap-4 xl:grid-cols-2">
              <div className="srim-theme-panel rounded-3xl border p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-foreground">Recent activity</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Latest role and policy changes.</p>
                  </div>
                  <ChartLineUp className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-4 space-y-3">
                  {ACTIVITY_FEED.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">{item.label}</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                        </div>
                        <span className="rounded-full border border-border/70 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          {item.time}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="srim-theme-panel rounded-3xl border p-5 shadow-sm">
                <h2 className="font-semibold text-foreground">Workflow guardrails</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  The local daemon keeps the admin console and skills service in sync.
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    'Admins can assign users to predefined roles.',
                    'Protected skills stay locked unless the role allows them.',
                    'Branding and layout follow the active theme tokens.',
                  ].map((line) => (
                    <div key={line} className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-foreground/90">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {active === 'settings' && (
            <section className="grid gap-4 xl:grid-cols-2">
              <div className="srim-theme-panel rounded-3xl border p-5 shadow-sm">
                <h2 className="font-semibold text-foreground">Console settings</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  This is a UI sample for admin behavior, not a live policy editor yet.
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    'Theme colors are linked to the same brand tokens used by the main app.',
                    'Dark and light surfaces stay aligned with the customization panel.',
                    'Database-backed RBAC can be wired later without changing the visual shell.',
                  ].map((line) => (
                    <div key={line} className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-foreground/90">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
              <div className="srim-theme-panel rounded-3xl border p-5 shadow-sm">
                <h2 className="font-semibold text-foreground">Brand policy</h2>
                <p className="mt-1 text-xs text-muted-foreground">DigiBull palette used in this console.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Orange</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground" style={{ color: 'var(--digibull-orange)' }}>
                      #FD9B00
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Blue</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground" style={{ color: 'var(--digibull-blue)' }}>
                      #0093B6
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          <footer className="flex items-center justify-between border-t border-border/60 pt-5 text-xs text-muted-foreground">
            <span>CAM 3.0 · SRIM</span>
            <span>Powered by DigiBull</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
