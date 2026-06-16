import { r as e } from "./desktop-main-C9gAzMwt.js";
import { t } from "./logging-C6nctklm.js";
import { A as n, K as r, O as i, et as a, nt as o, tt as s } from "./events-Ba_VD2iP.js";
import { a as c, c as l, f as u, r as d, s as f } from "./daemon-connector-CgkqupE8.js";
//#region src/main/daemon-bootstrap.ts
var p = /* @__PURE__ */ new Map();
function m(e, n) {
	try {
		let r = t();
		r?.log && r.log(e, "daemon", n);
	} catch {}
}
var h = null;
function g() {
	import("./workspaceManager-x_0ZpKgw.js").then((e) => {
		if (e.isInitialized()) return e.initialize();
	}).catch((e) => {
		m("WARN", `[DaemonBootstrap] workspaceManager rebind after client swap failed: ${String(e)}`);
	});
}
async function _() {
	m("INFO", "[DaemonBootstrap] Connecting to daemon...");
	let e = await d();
	return s(e), o("socket"), u(), h && (b(e, h), m("INFO", "[DaemonBootstrap] Re-registered notification forwarding on new client")), await v(e), g(), f((e) => {
		m("INFO", `[DaemonBootstrap] Connection state: ${e}`);
	}, (e) => {
		s(e), h && b(e, h), v(e), g();
	}), m("INFO", "[DaemonBootstrap] Connected to daemon via socket"), e;
}
async function v(t) {
	try {
		l(t, await e({
			dataDir: c(),
			connectTimeout: 2e3
		}));
	} catch {
		m("WARN", "[DaemonBootstrap] Could not set up disconnect monitor");
	}
}
function y(e) {
	h = e;
	let t;
	try {
		t = a();
	} catch {
		m("WARN", "[DaemonBootstrap] Cannot register notification forwarding — no daemon client");
		return;
	}
	b(t, e), m("INFO", "[DaemonBootstrap] Notification forwarding registered");
}
function b(e, t) {
	let a = (e, n) => {
		let r = t();
		if (!(!r || r.isDestroyed())) try {
			r.webContents.send(e, n);
		} catch {}
	};
	e.onNotification("task.progress", (e) => {
		a("task:progress", e), e.taskId && !p.has(e.taskId) && p.set(e.taskId, {
			startTime: Date.now(),
			sessionId: e.sessionId ?? "",
			taskType: "chat"
		});
	}), e.onNotification("task.message", (e) => {
		a("task:update:batch", e);
	}), e.onNotification("task.complete", (e) => {
		a("task:update", {
			taskId: e.taskId,
			type: "complete",
			result: e.result
		});
		try {
			let t = p.get(e.taskId), n = t ? Date.now() - t.startTime : 0;
			i({
				taskId: e.taskId,
				sessionId: t?.sessionId ?? "",
				taskType: t?.taskType ?? "chat"
			}, n, 0, !1), p.delete(e.taskId);
		} catch {}
	}), e.onNotification("task.error", (e) => {
		a("task:update", {
			taskId: e.taskId,
			type: "error",
			error: e.error
		});
		try {
			let t = p.get(e.taskId), i = t ? Date.now() - t.startTime : 0;
			n({
				taskId: e.taskId,
				sessionId: t?.sessionId ?? "",
				taskType: t?.taskType ?? "chat"
			}, i, 0, r(e.error ?? "unknown")), p.delete(e.taskId);
		} catch {}
	}), e.onNotification("task.statusChange", (e) => {
		a("task:status-change", e);
	}), e.onNotification("task.summary", (e) => {
		a("task:summary", e);
	}), e.onNotification("permission.request", (e) => {
		a("permission:request", e);
	}), e.onNotification("todo.update", (e) => {
		a("todo:update", e);
	}), e.onNotification("auth.error", (e) => {
		a("auth:error", e);
	}), e.onNotification("browser.frame", (e) => {
		a("browser:frame", e);
	}), e.onNotification("accomplish-ai.usage-update", (e) => {
		a("accomplish-ai:usage-updated", e);
	}), e.onNotification("whatsapp.qr", (e) => {
		a("integrations:whatsapp:qr", e.qr);
	}), e.onNotification("whatsapp.status", (e) => {
		a("integrations:whatsapp:status", e.status);
	}), e.onNotification("gwsAccount.statusChanged", (e) => {
		let n = e, r = t();
		if (!(!r || r.isDestroyed())) try {
			r.webContents.send("gws:account:status-changed", n.googleAccountId, n.status);
		} catch {}
	}), e.onNotification("skills.changed", (e) => {
		a("skills:changed", e);
	});
}
//#endregion
export { y as n, _ as t };

//# sourceMappingURL=daemon-bootstrap-BVFr6gBf.js.map