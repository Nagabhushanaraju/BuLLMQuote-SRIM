import { r as createSocketTransport } from "./desktop-main-CXudHk3S.js";
import { t as getLogCollector } from "./logging-ZKSN6tdj.js";
import { A as trackTaskError, K as classifyErrorCategory, O as trackTaskComplete, et as getDaemonClient, nt as setMode, tt as setClient } from "./events-6ieLJMcf.js";
import { a as getDataDir, c as setupDisconnectHandler, f as tailDaemonLog, r as ensureDaemonRunning, s as onReconnect } from "./daemon-connector-B4Xt49yq.js";
//#region src/main/daemon-bootstrap.ts
/** Per-task context for analytics — populated on task.start notification, consumed on complete/error. */
var taskContextMap = /* @__PURE__ */ new Map();
function log(level, msg) {
	try {
		const l = getLogCollector();
		if (l?.log) l.log(level, "daemon", msg);
	} catch {}
}
/** Window getter for notification forwarding. Set during bootstrap. */
var windowGetter = null;
/**
* Re-hydrate the `workspaceManager` cache and re-subscribe to
* `workspace.changed` notifications on the current `DaemonClient`.
*
* Idempotent no-op when the manager hasn't been initialized yet (the
* initial `app-startup.ts` bootstrap handles that path explicitly). Used
* by every code path that replaces the underlying client:
*   - `bootstrapDaemon()` on explicit `daemon:restart` / `daemon:start`
*     (review round 2 finding P2.A).
*   - `onReconnect` callback on automatic disconnect recovery (M5
*     review finding P2.2).
*
* Without this, the workspace cache stays attached to the old client's
* (now cleared) handler map and goes silently stale after any client
* swap — `workspace:list`, active workspace, and task filters drift.
*/
function rebindWorkspaceManager() {
	import("./workspaceManager-DZ1_JwAD.js").then((workspaceManager) => {
		if (workspaceManager.isInitialized()) return workspaceManager.initialize();
	}).catch((err) => {
		log("WARN", `[DaemonBootstrap] workspaceManager rebind after client swap failed: ${String(err)}`);
	});
}
/**
* Boot the daemon — connect to existing or spawn a new one.
* Returns the connected DaemonClient.
*/
async function bootstrapDaemon() {
	log("INFO", "[DaemonBootstrap] Connecting to daemon...");
	const client = await ensureDaemonRunning();
	setClient(client);
	setMode("socket");
	tailDaemonLog();
	if (windowGetter) {
		registerNotificationHandlers(client, windowGetter);
		log("INFO", "[DaemonBootstrap] Re-registered notification forwarding on new client");
	}
	await setupTransportReconnection(client);
	rebindWorkspaceManager();
	onReconnect((state) => {
		log("INFO", `[DaemonBootstrap] Connection state: ${state}`);
	}, (newClient) => {
		setClient(newClient);
		if (windowGetter) registerNotificationHandlers(newClient, windowGetter);
		setupTransportReconnection(newClient);
		rebindWorkspaceManager();
	});
	log("INFO", "[DaemonBootstrap] Connected to daemon via socket");
	return client;
}
/**
* Set up transport-level disconnect detection for reconnection.
*/
async function setupTransportReconnection(client) {
	try {
		setupDisconnectHandler(client, await createSocketTransport({
			dataDir: getDataDir(),
			connectTimeout: 2e3
		}));
	} catch {
		log("WARN", "[DaemonBootstrap] Could not set up disconnect monitor");
	}
}
/**
* Register forwarding of daemon notifications to the renderer process.
*
* Uses a dynamic window getter so that if the window is recreated (e.g.
* macOS `activate` event), notifications route to the current window.
*
* Must be called after bootstrapDaemon().
*/
function registerNotificationForwarding(getWindow) {
	windowGetter = getWindow;
	let client;
	try {
		client = getDaemonClient();
	} catch {
		log("WARN", "[DaemonBootstrap] Cannot register notification forwarding — no daemon client");
		return;
	}
	registerNotificationHandlers(client, getWindow);
	log("INFO", "[DaemonBootstrap] Notification forwarding registered");
}
/**
* Wire notification handlers on a specific DaemonClient instance.
* Called both on initial bootstrap and after reconnection.
*/
function registerNotificationHandlers(client, getWindow) {
	const forward = (channel, data) => {
		const win = getWindow();
		if (!win || win.isDestroyed()) return;
		try {
			win.webContents.send(channel, data);
		} catch {}
	};
	client.onNotification("task.progress", (data) => {
		forward("task:progress", data);
		if (data.taskId && !taskContextMap.has(data.taskId)) taskContextMap.set(data.taskId, {
			startTime: Date.now(),
			sessionId: data.sessionId ?? "",
			taskType: "chat"
		});
	});
	client.onNotification("task.message", (data) => {
		forward("task:update:batch", data);
	});
	client.onNotification("task.complete", (data) => {
		forward("task:update", {
			taskId: data.taskId,
			type: "complete",
			result: data.result
		});
		try {
			const ctx = taskContextMap.get(data.taskId);
			const durationMs = ctx ? Date.now() - ctx.startTime : 0;
			trackTaskComplete({
				taskId: data.taskId,
				sessionId: ctx?.sessionId ?? "",
				taskType: ctx?.taskType ?? "chat"
			}, durationMs, 0, false);
			taskContextMap.delete(data.taskId);
		} catch {}
	});
	client.onNotification("task.error", (data) => {
		forward("task:update", {
			taskId: data.taskId,
			type: "error",
			error: data.error
		});
		try {
			const ctx = taskContextMap.get(data.taskId);
			const durationMs = ctx ? Date.now() - ctx.startTime : 0;
			trackTaskError({
				taskId: data.taskId,
				sessionId: ctx?.sessionId ?? "",
				taskType: ctx?.taskType ?? "chat"
			}, durationMs, 0, classifyErrorCategory(data.error ?? "unknown"));
			taskContextMap.delete(data.taskId);
		} catch {}
	});
	client.onNotification("task.statusChange", (data) => {
		forward("task:status-change", data);
	});
	client.onNotification("task.summary", (data) => {
		forward("task:summary", data);
	});
	client.onNotification("permission.request", (data) => {
		forward("permission:request", data);
	});
	client.onNotification("todo.update", (data) => {
		forward("todo:update", data);
	});
	client.onNotification("auth.error", (data) => {
		forward("auth:error", data);
	});
	client.onNotification("browser.frame", (data) => {
		forward("browser:frame", data);
	});
	client.onNotification("accomplish-ai.usage-update", (data) => {
		forward("accomplish-ai:usage-updated", data);
	});
	client.onNotification("whatsapp.qr", (data) => {
		forward("integrations:whatsapp:qr", data.qr);
	});
	client.onNotification("whatsapp.status", (data) => {
		forward("integrations:whatsapp:status", data.status);
	});
	client.onNotification("gwsAccount.statusChanged", (data) => {
		const payload = data;
		const win = getWindow();
		if (!win || win.isDestroyed()) return;
		try {
			win.webContents.send("gws:account:status-changed", payload.googleAccountId, payload.status);
		} catch {}
	});
	client.onNotification("skills.changed", (data) => {
		forward("skills:changed", data);
	});
}
//#endregion
export { registerNotificationForwarding as n, bootstrapDaemon as t };

//# sourceMappingURL=daemon-bootstrap-fPqxRQhF.js.map