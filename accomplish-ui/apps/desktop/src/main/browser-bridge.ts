/**
 * Browser Bridge — dev-only HTTP server on 127.0.0.1:9234.
 *
 * Lets a regular browser tab at localhost:5173 talk to the real daemon
 * while Electron is running. Three routes:
 *   GET  /health  — liveness probe
 *   GET  /events  — SSE stream for daemon push notifications
 *   POST /rpc     — JSON-RPC proxy to daemon
 *
 * Only started when !app.isPackaged (guarded in app-startup.ts).
 */
import http from 'node:http';
import { BROWSER_API_PORT, WEB_DEV_ORIGIN } from '@accomplish_ai/agent-core/common';
import { getDaemonClient } from './daemon-bootstrap';
import { buildDispatch } from './browser-bridge-dispatch';

// Address comes from the central registry (agent-core/common/constants), with
// env overrides so a port/domain change needs no code edits.
const PORT = Number(process.env.ACCOMPLISH_BACKEND_PORT) || BROWSER_API_PORT;
const ALLOWED_ORIGIN = process.env.ACCOMPLISH_WEB_ORIGIN || WEB_DEV_ORIGIN;

const sseClients = new Set<http.ServerResponse>();
let dispatch: ReturnType<typeof buildDispatch> | null = null;

function getDispatch() {
  if (!dispatch) {
    dispatch = buildDispatch();
  }
  return dispatch;
}

function sendSse(channel: string, data: unknown): void {
  if (sseClients.size === 0) {
    return;
  }
  const payload = `event: ${channel}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

function cors(res: http.ServerResponse, req?: http.IncomingMessage): void {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Chrome 107+ requires this header for requests to loopback/private addresses
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req?.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
}

function handleHealth(res: http.ServerResponse): void {
  cors(res);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
}

function handleEvents(req: http.IncomingMessage, res: http.ServerResponse): void {
  cors(res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(':ok\n\n');
  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
  });
}

async function handleRpc(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  cors(res);
  let body = '';
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });
  await new Promise<void>((resolve) => {
    req.on('end', resolve);
  });

  let channel: string;
  let args: unknown[];
  try {
    const parsed = JSON.parse(body) as { channel: string; args?: unknown[] };
    channel = parsed.channel;
    args = parsed.args ?? [];
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const handler = getDispatch()[channel];
  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Unknown channel: ${channel}` }));
    return;
  }

  try {
    const result = await handler(args);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ result: result ?? null }));
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
  }
}

function subscribeNotifications(): void {
  const client = getDaemonClient();
  const fwd = (ch: string) => (data: unknown) => sendSse(ch, data);

  client.onNotification('task.progress', fwd('task:progress'));
  client.onNotification('task.message', fwd('task:update:batch'));
  client.onNotification('task.complete', (data) => {
    const d = data as { taskId: string; result: unknown };
    sendSse('task:update', { taskId: d.taskId, type: 'complete', result: d.result });
  });
  client.onNotification('task.error', (data) => {
    const d = data as { taskId: string; error: unknown };
    sendSse('task:update', { taskId: d.taskId, type: 'error', error: d.error });
  });
  client.onNotification('task.statusChange', fwd('task:status-change'));
  client.onNotification('task.summary', fwd('task:summary'));
  client.onNotification('permission.request', fwd('permission:request'));
  client.onNotification('todo.update', fwd('todo:update'));
  client.onNotification('auth.error', fwd('auth:error'));
  client.onNotification('workspace.changed', fwd('workspace:changed'));
  client.onNotification('accomplish-ai.usage-update', fwd('accomplish-ai:usage-updated'));
  client.onNotification('skills.changed', fwd('skills:changed'));
}

let server: http.Server | null = null;

export function startBrowserBridge(): void {
  if (server) {
    return;
  }

  server = http.createServer((req, res) => {
    const { method, url } = req;

    if (method === 'OPTIONS') {
      cors(res, req);
      res.writeHead(204);
      res.end();
      return;
    }

    if (method === 'GET' && url === '/health') {
      handleHealth(res);
      return;
    }
    if (method === 'GET' && url === '/events') {
      handleEvents(req, res);
      return;
    }
    if (method === 'POST' && url === '/rpc') {
      handleRpc(req, res).catch((err) => {
        if (!res.headersSent) {
          cors(res);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    cors(res);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(PORT, '127.0.0.1');
  subscribeNotifications();
}
