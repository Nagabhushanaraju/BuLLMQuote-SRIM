import { t as getLogCollector } from "./logging-ZKSN6tdj.js";
import { et as getDaemonClient } from "./events-6ieLJMcf.js";
import "./daemon-bootstrap-fPqxRQhF.js";
//#region src/main/store/workspaceManager.ts
function log(level, msg, data) {
	try {
		const l = getLogCollector();
		if (l?.log) l.log(level, "main", msg, data);
	} catch (_e) {}
}
var _activeWorkspaceId = null;
var _workspaces = /* @__PURE__ */ new Map();
var _initialized = false;
function isInitialized() {
	return _initialized;
}
/** Synchronous accessor used by task-handlers for the default-workspace
*  detection during `task:list` / `task:start` / `session:resume`. */
function getActiveWorkspace() {
	return _activeWorkspaceId;
}
/** Synchronous cache lookup. Returns null if the id is unknown — callers
*  that need up-to-the-moment freshness should use the `workspace.get` RPC
*  directly; this helper exists specifically for the hot path in
*  `task-handlers.ts` where the cache is expected to be warm. */
function getWorkspace(workspaceId) {
	return _workspaces.get(workspaceId) ?? null;
}
function listWorkspaces() {
	return Array.from(_workspaces.values());
}
/**
* Hydrate the cache from the daemon and subscribe to change notifications
* on the CURRENT `DaemonClient`.
*
* Must be called AFTER `bootstrapDaemon()` has resolved — the daemon's
* `WorkspaceService.ensureInitialized()` guarantees a default workspace
* exists and that `active_workspace_id` is valid, so this function just
* pulls the current state.
*
* Called twice in the lifecycle:
*   1. Once at app startup, after the initial bootstrap. Subscribes to
*      the original client.
*   2. On every daemon reconnect, from `daemon-bootstrap.ts`. The old
*      client was `close()`d by the reconnect path (which clears its
*      notification-handlers map), so without re-subscribing here the
*      cache would go permanently stale on a daemon restart. See review
*      finding P2.2 post-M5.
*
* Subscribing once per current client — we don't save handler refs for
* `offNotification` because a closed client has no surviving listeners
* to leak. A double-subscribe on the SAME client would simply re-fetch
* each workspace twice on every change event (idempotent, not incorrect).
*/
async function initialize() {
	log("INFO", "[WorkspaceManager] Initializing...");
	const client = getDaemonClient();
	const list = await client.call("workspace.list");
	_workspaces.clear();
	for (const ws of list) _workspaces.set(ws.id, ws);
	_activeWorkspaceId = (await client.call("workspace.getActive"))?.id ?? null;
	client.onNotification("workspace.changed", (payload) => {
		refreshCacheFromEvent(payload);
	});
	_initialized = true;
	log("INFO", `[WorkspaceManager] Initialized (${_workspaces.size} workspaces, active=${_activeWorkspaceId ?? "none"})`);
}
async function refreshCacheFromEvent(payload) {
	const client = getDaemonClient();
	try {
		switch (payload.kind) {
			case "workspace.created":
			case "workspace.updated": {
				const ws = await client.call("workspace.get", { workspaceId: payload.workspaceId });
				if (ws) _workspaces.set(ws.id, ws);
				break;
			}
			case "workspace.deleted":
				_workspaces.delete(payload.workspaceId);
				break;
			case "workspace.activeChanged":
				_activeWorkspaceId = payload.workspaceId;
				break;
			case "knowledgeNote.changed": break;
		}
	} catch (err) {
		log("WARN", "[WorkspaceManager] Cache refresh failed", { err: String(err) });
	}
}
async function switchWorkspace(workspaceId) {
	const result = await getDaemonClient().call("workspace.setActive", { workspaceId });
	if (result.changed) _activeWorkspaceId = workspaceId;
	return result.changed;
}
async function createWorkspace(input) {
	const ws = await getDaemonClient().call("workspace.create", { input });
	_workspaces.set(ws.id, ws);
	return ws;
}
async function updateWorkspace(workspaceId, input) {
	const ws = await getDaemonClient().call("workspace.update", {
		workspaceId,
		input
	});
	if (ws) _workspaces.set(ws.id, ws);
	return ws;
}
async function deleteWorkspace(workspaceId) {
	const result = await getDaemonClient().call("workspace.delete", { workspaceId });
	if (result.deleted) _workspaces.delete(workspaceId);
	if (result.newActiveWorkspaceId !== void 0) _activeWorkspaceId = result.newActiveWorkspaceId;
	return result;
}
function close() {
	log("INFO", "[WorkspaceManager] Closing...");
	_activeWorkspaceId = null;
	_workspaces.clear();
	_initialized = false;
}
//#endregion
export { getWorkspace as a, listWorkspaces as c, getActiveWorkspace as i, switchWorkspace as l, createWorkspace as n, initialize as o, deleteWorkspace as r, isInitialized as s, close as t, updateWorkspace as u };

//# sourceMappingURL=workspaceManager-DfKC3lQM.js.map