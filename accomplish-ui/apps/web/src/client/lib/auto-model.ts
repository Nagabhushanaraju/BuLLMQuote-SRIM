/**
 * "Auto" model selection — picks a model by TASK TYPE across all connected
 * providers. A short/simple prompt routes to a cheap/fast model; a long or
 * code/engineering prompt routes to a stronger model. Resolution happens at
 * task-submit time (taskStore.startTask) and is applied via setActiveProvider +
 * updateProviderModel, so the daemon picks it up at task:start — NO daemon change.
 *
 * Client-only and best-effort: if it can't resolve, the task starts on whatever
 * the active provider already has selected.
 */

const AUTO_KEY = 'model.autoMode';
export const AUTO_MODE_CHANGE_EVENT = 'accomplish:auto-model-changed';

export function isAutoMode(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAutoMode(on: boolean): void {
  try {
    localStorage.setItem(AUTO_KEY, String(on));
    window.dispatchEvent(
      new CustomEvent<boolean>(AUTO_MODE_CHANGE_EVENT, {
        detail: on,
      }),
    );
  } catch {
    // localStorage unavailable — auto mode simply won't persist.
  }
}

export type Complexity = 'simple' | 'complex';
export type TaskIntent = 'chat' | 'coding' | 'research' | 'planning' | 'analysis';

// Signals that a prompt is a real engineering/multi-step task (→ stronger model).
const COMPLEX_RE =
  /```|\b(refactor|debug|implement|architect|design|optimi[sz]e|analy[sz]e|migrat\w*|build|create|generate|algorithm|plan|review|test|research|scrape|crawl|compare|summari[sz]e|explain why|step[- ]by[- ]step|multi[- ]step)\b/i;

const CODING_RE =
  /```|\b(code|bug|debug|fix|refactor|implement|typescript|javascript|react|vite|api|function|component|test|build error|stack trace)\b/i;
const RESEARCH_RE =
  /\b(research|scrape|crawl|browse|source|compare|summari[sz]e|market|latest|find out|investigate)\b/i;
const PLANNING_RE =
  /\b(plan|roadmap|architect|design|strategy|step[- ]by[- ]step|multi[- ]step)\b/i;
const ANALYSIS_RE = /\b(analy[sz]e|review|audit|diagnose|explain why|evaluate)\b/i;

export function classifyTaskIntent(prompt: string): TaskIntent {
  const p = (prompt || '').trim();
  if (CODING_RE.test(p)) {
    return 'coding';
  }
  if (RESEARCH_RE.test(p)) {
    return 'research';
  }
  if (PLANNING_RE.test(p)) {
    return 'planning';
  }
  if (ANALYSIS_RE.test(p)) {
    return 'analysis';
  }
  return 'chat';
}

export function classifyComplexity(prompt: string): Complexity {
  const p = (prompt || '').trim();
  if (p.length > 240) {
    return 'complex';
  }
  if ((p.match(/\n/g)?.length ?? 0) >= 2) {
    return 'complex';
  }
  if (COMPLEX_RE.test(p)) {
    return 'complex';
  }
  if (classifyTaskIntent(p) !== 'chat') {
    return 'complex';
  }
  return 'simple';
}

export type Tier = 'cheap' | 'strong' | 'mid';

const CHEAP_RE =
  /(haiku|mini|flash|nano|lite|small|tiny|gemma|phi-3|phi-4-mini|\b[1-9]b\b|\b1[0-3]b\b)/i;
const STRONG_RE =
  /(opus|sonnet|gpt-4|4o\b|\bo1\b|\bo3\b|70b|72b|123b|175b|180b|253b|405b|480b|671b|large|ultra|\bpro\b|\bmax\b|nemotron-(?:ultra|super))/i;

export function tierOfModel(modelId: string): Tier {
  const id = modelId.toLowerCase();
  if (STRONG_RE.test(id)) {
    return 'strong';
  }
  if (CHEAP_RE.test(id)) {
    return 'cheap';
  }
  return 'mid';
}

interface ConnectedProviderLike {
  providerId: string;
  connectionStatus?: string;
  selectedModelId?: string | null;
  availableModels?: Array<{ id: string }>;
}

interface ProviderSettingsLike {
  activeProviderId?: string | null;
  connectedProviders?: Record<string, ConnectedProviderLike>;
}

export interface AutoPick {
  providerId: string;
  modelId: string;
}

/**
 * Resolve the best (provider, model) for this prompt across connected providers.
 * Returns null if nothing is connected (caller leaves the current selection).
 */
export function resolveAutoModel(prompt: string, settings: ProviderSettingsLike): AutoPick | null {
  const providers = Object.values(settings.connectedProviders ?? {}).filter(
    (p) => p && p.connectionStatus === 'connected',
  );
  if (providers.length === 0) {
    return null;
  }

  const intent = classifyTaskIntent(prompt);
  const want: Tier =
    intent === 'chat' && classifyComplexity(prompt) === 'simple' ? 'cheap' : 'strong';
  const active = settings.activeProviderId ?? null;

  const candidates: Array<{ providerId: string; modelId: string; tier: Tier; isActive: boolean }> =
    [];
  for (const p of providers) {
    const models = p.availableModels?.map((m) => m.id) ?? [];
    if (p.selectedModelId) {
      models.push(p.selectedModelId);
    }
    for (const modelId of models) {
      candidates.push({
        providerId: p.providerId,
        modelId,
        tier: tierOfModel(modelId),
        isActive: p.providerId === active,
      });
    }
  }
  if (candidates.length === 0) {
    return null;
  }

  // Prefer a candidate already on the active provider, else the first match.
  const preferActive = (list: typeof candidates) => list.find((c) => c.isActive) ?? list[0];

  const wantedActive = candidates.filter((c) => c.tier === want && c.isActive);
  if (wantedActive.length > 0) {
    return { providerId: wantedActive[0].providerId, modelId: wantedActive[0].modelId };
  }
  const wantedAny = candidates.filter((c) => c.tier === want);
  if (wantedAny.length > 0) {
    const c = preferActive(wantedAny);
    return { providerId: c.providerId, modelId: c.modelId };
  }
  // No exact-tier match — degrade gracefully through the middle tier.
  const fallbackOrder: Tier[] = want === 'strong' ? ['mid', 'cheap'] : ['mid', 'strong'];
  for (const t of fallbackOrder) {
    const matches = candidates.filter((c) => c.tier === t);
    if (matches.length > 0) {
      const c = preferActive(matches);
      return { providerId: c.providerId, modelId: c.modelId };
    }
  }
  return { providerId: candidates[0].providerId, modelId: candidates[0].modelId };
}
