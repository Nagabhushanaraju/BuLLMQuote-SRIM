import { t as e } from "./logging-C6nctklm.js";
import { et as t } from "./events-Ba_VD2iP.js";
import "./daemon-bootstrap-BVFr6gBf.js";
//#region src/main/store/workspaceManager.ts
function n(t, n, r) {
	try {
		let i = e();
		i?.log && i.log(t, "main", n, r);
	} catch {}
}
var r = null, i = /* @__PURE__ */ new Map(), a = !1;
function o() {
	return a;
}
function s() {
	return r;
}
function c(e) {
	return i.get(e) ?? null;
}
function l() {
	return Array.from(i.values());
}
async function u() {
	n("INFO", "[WorkspaceManager] Initializing...");
	let e = t(), o = await e.call("workspace.list");
	i.clear();
	for (let e of o) i.set(e.id, e);
	r = (await e.call("workspace.getActive"))?.id ?? null, e.onNotification("workspace.changed", (e) => {
		d(e);
	}), a = !0, n("INFO", `[WorkspaceManager] Initialized (${i.size} workspaces, active=${r ?? "none"})`);
}
async function d(e) {
	let a = t();
	try {
		switch (e.kind) {
			case "workspace.created":
			case "workspace.updated": {
				let t = await a.call("workspace.get", { workspaceId: e.workspaceId });
				t && i.set(t.id, t);
				break;
			}
			case "workspace.deleted":
				i.delete(e.workspaceId);
				break;
			case "workspace.activeChanged":
				r = e.workspaceId;
				break;
			case "knowledgeNote.changed": break;
		}
	} catch (e) {
		n("WARN", "[WorkspaceManager] Cache refresh failed", { err: String(e) });
	}
}
async function f(e) {
	let n = await t().call("workspace.setActive", { workspaceId: e });
	return n.changed && (r = e), n.changed;
}
async function p(e) {
	let n = await t().call("workspace.create", { input: e });
	return i.set(n.id, n), n;
}
async function m(e, n) {
	let r = await t().call("workspace.update", {
		workspaceId: e,
		input: n
	});
	return r && i.set(r.id, r), r;
}
async function h(e) {
	let n = await t().call("workspace.delete", { workspaceId: e });
	return n.deleted && i.delete(e), n.newActiveWorkspaceId !== void 0 && (r = n.newActiveWorkspaceId), n;
}
function g() {
	n("INFO", "[WorkspaceManager] Closing..."), r = null, i.clear(), a = !1;
}
//#endregion
export { c as a, l as c, s as i, f as l, p as n, u as o, h as r, o as s, g as t, m as u };

//# sourceMappingURL=workspaceManager-BR6DH0WM.js.map