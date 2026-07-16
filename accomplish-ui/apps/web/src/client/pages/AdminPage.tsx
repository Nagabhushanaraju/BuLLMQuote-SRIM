import { useMemo, useState } from 'react';
import { ChartLineUp, CheckCircle, Gear, Key, LockKey, MagnifyingGlass, ShieldCheck, UsersThree } from '@phosphor-icons/react';

const NAV_ITEMS = [
  { key: 'users', label: 'Users', icon: UsersThree },
  { key: 'access', label: 'Access control', icon: LockKey },
  { key: 'skills', label: 'Skill permissions', icon: Key },
  { key: 'activity', label: 'Activity', icon: ChartLineUp },
  { key: 'settings', label: 'Admin settings', icon: Gear },
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

export function AdminPage() {
  const [active, setActive] = useState<(typeof NAV_ITEMS)[number]['key']>('users');
  const [query, setQuery] = useState('');
  const filteredUsers = useMemo(() => DEMO_USERS.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <div className="srim-theme-shell flex h-full min-h-0 w-full overflow-hidden">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/70 bg-background/70 px-3 py-4 backdrop-blur-xl md:flex">
        <div className="mb-6 flex items-center gap-3 px-3">
          <img src="/assets/cam-new.png" alt="CAM 3.0 BOM Automation" className="h-10 w-10 rounded-lg object-cover" />
          <div>
            <p className="text-sm font-bold tracking-wide text-foreground">CAM 3.0</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Admin console</p>
          </div>
        </div>
        <nav className="space-y-1" aria-label="Admin navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const selected = active === item.key;
            return (
              <button key={item.key} type="button" onClick={() => setActive(item.key)} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors ${selected ? 'bg-primary/15 text-primary shadow-sm' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`} aria-current={selected ? 'page' : undefined}>
                <Icon className="h-5 w-5" weight={selected ? 'fill' : 'regular'} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto rounded-xl border border-primary/20 bg-primary/10 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary"><ShieldCheck className="h-4 w-4" /> Admin access</div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Permissions are controlled by the local daemon.</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 bg-background/55 px-5 py-4 backdrop-blur-xl sm:px-8">
          <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">DigiBull AI</p><h1 className="mt-1 text-xl font-bold tracking-tight text-foreground">{active === 'users' ? 'User access' : NAV_ITEMS.find((item) => item.key === active)?.label}</h1></div>
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"><CheckCircle className="h-4 w-4" /> Admin view</div>
        </header>

        <div className="space-y-6 p-5 sm:p-8">
          <div className="grid gap-3 sm:grid-cols-3">
            {[['Total users', '24', 'Across SRIM'], ['Active roles', '4', 'Admin, operator, reviewer'], ['Protected skills', '18', 'Role-aware permissions']].map(([label, value, sub]) => <div key={label} className="srim-theme-panel-soft rounded-2xl border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold text-foreground">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{sub}</p></div>)}
          </div>

          {active === 'users' && <section className="srim-theme-panel rounded-2xl border shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 p-4 sm:p-5"><div><h2 className="font-semibold text-foreground">Users and roles</h2><p className="mt-1 text-xs text-muted-foreground">Manage who can use SRIM workflows and skills.</p></div><label className="relative block"><MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users" className="h-10 w-56 rounded-xl border border-border bg-background/70 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary" /></label></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Skill access</th></tr></thead><tbody>{filteredUsers.map((user) => <tr key={user.id} className="border-t border-border/60"><td className="px-5 py-4"><p className="font-medium text-foreground">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></td><td className="px-5 py-4"><span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary">{user.role}</span></td><td className="px-5 py-4 text-xs text-emerald-500">{user.status}</td><td className="px-5 py-4 text-xs text-muted-foreground">{user.access}</td></tr>)}</tbody></table></div>
          </section>}

          {active === 'skills' && <section className="grid gap-3 sm:grid-cols-2">{SKILLS.map((skill, index) => <div key={skill} className="srim-theme-panel rounded-2xl border p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.18em] text-primary">Skill {String(index + 1).padStart(2, '0')}</p><h2 className="mt-2 font-semibold text-foreground">{skill}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Controlled by the assigned role and local skills service.</p></div><CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" /></div></div>)}</section>}

          {active !== 'users' && active !== 'skills' && <section className="srim-theme-panel rounded-2xl border p-8"><p className="text-sm text-muted-foreground">This admin area is ready for the {NAV_ITEMS.find((item) => item.key === active)?.label.toLowerCase()} workflow.</p></section>}
          <footer className="flex items-center justify-between border-t border-border/60 pt-5 text-xs text-muted-foreground"><span>CAM 3.0 · SRIM</span><span>Powered by DigiBull</span></footer>
        </div>
      </main>
    </div>
  );
}
