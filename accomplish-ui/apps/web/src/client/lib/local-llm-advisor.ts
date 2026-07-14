/**
 * LOCAL LLM advisor — detects the machine's capabilities and recommends which
 * local models it can realistically run. CPU/RAM come from the daemon (Node
 * `os`, accurate); GPU and network are probed in the browser. Pure logic +
 * web APIs only — no new backend subsystem.
 */
import { getAccomplish } from './accomplish';

export interface DaemonSpecs {
  platform: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  totalRamGB: number;
  freeRamGB: number;
}

export interface SystemSpecs extends DaemonSpecs {
  gpu: string;
  hasDedicatedGpu: boolean;
  networkMbps: number | null;
}

export interface ModelRecommendation {
  tier: string;
  reason: string;
  models: string[];
}

/** Read the GPU renderer string via WebGL's debug-renderer extension. */
function detectGpu(): { gpu: string; hasDedicatedGpu: boolean } {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) {
      return { gpu: 'unknown', hasDedicatedGpu: false };
    }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    const dedicated = /nvidia|geforce|rtx|gtx|radeon|rx |amd|arc|a\d{3}0/i.test(renderer);
    return { gpu: renderer, hasDedicatedGpu: dedicated };
  } catch {
    return { gpu: 'unknown', hasDedicatedGpu: false };
  }
}

function detectNetworkMbps(): number | null {
  const nav = navigator as unknown as { connection?: { downlink?: number } };
  return typeof nav.connection?.downlink === 'number' ? nav.connection.downlink : null;
}

/** Combine daemon specs (CPU/RAM) with browser-probed GPU + network. */
export async function getSystemSpecs(): Promise<SystemSpecs> {
  const accomplish = getAccomplish() as unknown as { getSystemSpecs: () => Promise<DaemonSpecs> };
  const daemon = await accomplish.getSystemSpecs();
  const { gpu, hasDedicatedGpu } = detectGpu();
  return { ...daemon, gpu, hasDedicatedGpu, networkMbps: detectNetworkMbps() };
}

/**
 * Recommend local model sizes from RAM (primary) and GPU presence. Sizes follow
 * common llama.cpp Q4 guidance: a model needs roughly its parameter count in GB
 * of RAM/VRAM at 4-bit, plus headroom for context.
 */
export function recommendLocalModels(
  specs: Pick<SystemSpecs, 'totalRamGB' | 'hasDedicatedGpu'>,
): ModelRecommendation {
  const ram = specs.totalRamGB;
  const gpu = specs.hasDedicatedGpu;

  if (ram < 8) {
    return {
      tier: 'Light (≤3B)',
      reason: `${ram} GB RAM — stick to small models so the system stays responsive.`,
      models: ['Llama 3.2 3B (Q4)', 'Phi-3 Mini', 'Qwen2.5 3B', 'Gemma 2 2B'],
    };
  }
  if (ram < 16) {
    return {
      tier: 'Standard (7–8B)',
      reason: `${ram} GB RAM${gpu ? ' + dedicated GPU' : ''} — 7–8B models run comfortably at Q4.`,
      models: ['Llama 3.1 8B (Q4)', 'Mistral 7B', 'Qwen2.5 7B', 'Gemma 2 9B'],
    };
  }
  if (ram < 32) {
    return {
      tier: 'Capable (13–14B)',
      reason: `${ram} GB RAM${gpu ? ' + dedicated GPU' : ''} — up to 13–14B at Q4, or 8B at higher precision.`,
      models: ['Qwen2.5 14B (Q4)', 'Phi-4 14B', 'Llama 3.1 8B (Q8)', 'DeepSeek-Coder 16B'],
    };
  }
  if (ram < 64) {
    return {
      tier: 'High (30–34B)',
      reason: `${ram} GB RAM${gpu ? ' + dedicated GPU' : ''} — 30–34B models at Q4 are realistic.`,
      models: ['Qwen2.5 32B (Q4)', 'Yi 34B', 'Gemma 2 27B', 'Codestral 22B'],
    };
  }
  return {
    tier: 'Workstation (70B+)',
    reason: `${ram} GB RAM${gpu ? ' + dedicated GPU' : ''} — large 70B-class models at Q4 are feasible.`,
    models: ['Llama 3.3 70B (Q4)', 'Qwen2.5 72B', 'Mixtral 8x22B', 'DeepSeek V2'],
  };
}
