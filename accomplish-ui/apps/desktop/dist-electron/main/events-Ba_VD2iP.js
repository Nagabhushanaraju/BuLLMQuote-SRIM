import { t as e } from "./logging-C6nctklm.js";
import { c as t, f as n, l as r, m as i, o as a, p as o, s } from "./analytics-service-UJ3ooobv.js";
import { nativeTheme as c } from "electron";
//#region src/main/daemon/daemon-lifecycle.ts
var l = null;
function u(e) {
	l = e;
}
function d(e) {}
function f() {
	if (!l) throw Error("Daemon not bootstrapped. Call bootstrapDaemon() first.");
	return l;
}
function p() {
	l &&= (l.close(), null);
	try {
		let t = e();
		t?.log && t.log("INFO", "daemon", "[DaemonLifecycle] Daemon client disconnected");
	} catch {}
}
//#endregion
//#region src/main/store/secureStorage.ts
async function m(e, t) {
	await f().call("secrets.storeApiKey", {
		provider: e,
		apiKey: t
	});
}
async function ee(e) {
	return f().call("secrets.getApiKey", { provider: e });
}
async function h(e) {
	return f().call("secrets.deleteApiKey", { provider: e });
}
async function g() {
	return f().call("secrets.getAllApiKeys");
}
async function _() {
	return f().call("secrets.getBedrockCredentials");
}
async function v() {
	return f().call("secrets.hasAnyApiKey");
}
function y() {}
//#endregion
//#region src/main/analytics/error-classifier.ts
function b(e) {
	let t = String(e).toLowerCase();
	return t.includes("auth") || t.includes("oauth") || t.includes("unauthorized") || t.includes("accessdenied") || t.includes("invalidsignature") ? "auth_error" : t.includes("throttl") || t.includes("rate_limit") || t.includes("ratelimit") || t.includes("429") ? "rate_limit" : t.includes("timeout") || t === "aborterror" ? "timeout" : t.includes("network") || t.includes("econnrefused") || t.includes("enotfound") || t.includes("503") ? "network_error" : t.includes("contextoverflowerror") || t.includes("n_keep") || t.includes("n_ctx") || t.includes("context window is too small") || t.includes("context size has been exceeded") || t.includes("exceeds the available context size") ? "context_overflow" : t.includes("interrupt") || t.includes("cancel") || t.includes("abort") ? "user_interrupted" : t.includes("tool_error") || t.includes("validation") ? "tool_error" : "unknown";
}
//#endregion
//#region src/main/analytics/events.ts
async function x(e) {
	let t = a(), n = t ? Math.floor((Date.now() - new Date(t).getTime()) / 1e3) : 0, r = await g(), o = Object.values(r).filter((e) => e !== null).length;
	i("app_launched", {
		event_category: "app_lifecycle",
		launch_type: e ? "cold" : "warm",
		time_since_install_s: n,
		connected_providers_count: o,
		theme: c.shouldUseDarkColors ? "dark" : "light"
	});
}
var S = 6e4, C = 5, w = [];
function T(e, t) {
	let n = Date.now();
	for (; w.length > 0 && n - w[0] >= S;) w.shift();
	w.length >= C || (w.push(n), i("app_crash", {
		event_category: "app_lifecycle",
		error_type: e,
		error_message: t.substring(0, 500)
	}));
}
function E(e, t) {
	i("page_view", {
		page_path: e,
		page_title: t,
		event_category: "navigation"
	});
}
function D(e, t) {
	i("submit_task", {
		event_category: "engagement",
		model: e,
		provider: t
	});
}
function O() {
	i("new_task", { event_category: "engagement" });
}
function k() {
	i("open_settings", { event_category: "engagement" });
}
function A(e, t, n) {
	i("save_api_key", {
		event_category: "settings",
		provider: e,
		success: t,
		...n && { connection_method: n }
	});
}
function j(e) {
	i("select_provider", {
		event_category: "settings",
		provider: e
	});
}
function M(e, t) {
	i("select_model", {
		event_category: "settings",
		model: e,
		provider: t
	});
}
function N(e) {
	i("toggle_debug_mode", {
		event_category: "settings",
		enabled: e
	});
}
function P() {
	i("update_check", { event_category: "updates" });
}
function F(e, t) {
	i("update_available", {
		event_category: "updates",
		current_version: e,
		new_version: t
	});
}
function I() {
	i("update_not_available", { event_category: "updates" });
}
function L(e) {
	i("update_download_start", {
		event_category: "updates",
		new_version: e
	});
}
function R(e) {
	i("update_download_complete", {
		event_category: "updates",
		new_version: e
	});
}
function te(e) {
	i("update_install_start", {
		event_category: "updates",
		new_version: e
	});
}
function z(e, t) {
	i("update_failed", {
		event_category: "updates",
		error_type: e,
		error_message: t
	});
}
function B(e, t, n) {
	r(), i("task_start", {
		event_category: "task_lifecycle",
		task_id: e.taskId,
		opencode_session_id: e.sessionId,
		task_type: e.taskType,
		model: t,
		provider: n
	});
}
function V(e, t, r, s, c, l, u, d) {
	try {
		if (i("task_complete", {
			event_category: "task_lifecycle",
			task_id: e.taskId,
			opencode_session_id: e.sessionId,
			task_type: e.taskType,
			duration_ms: t,
			total_steps: r,
			had_errors: s,
			model: c,
			provider: d,
			tokens_input: l?.input,
			tokens_output: l?.output,
			tokens_reasoning: l?.reasoning,
			tokens_cache_read: l?.cache_read,
			tokens_cache_write: l?.cache_write,
			cost_usd: u
		}), !n()) {
			let t = a(), n = t ? Math.floor((Date.now() - new Date(t).getTime()) / 864e5) : 0;
			i("first_task_complete", {
				event_category: "activation",
				task_id: e.taskId,
				opencode_session_id: e.sessionId,
				task_type: e.taskType,
				days_since_install: n,
				model: c,
				provider: d
			}), o();
		}
	} catch (e) {
		console.error("[Analytics] Failed to track task complete:", e);
	}
}
function H(e, t, n, r, a, o, s, c, l) {
	i("task_error", {
		event_category: "task_lifecycle",
		task_id: e.taskId,
		opencode_session_id: e.sessionId,
		task_type: e.taskType,
		duration_ms: t,
		total_steps: n,
		error_type: r,
		model: a,
		provider: c,
		tokens_input: o?.input,
		tokens_output: o?.output,
		tokens_reasoning: o?.reasoning,
		tokens_cache_read: o?.cache_read,
		tokens_cache_write: o?.cache_write,
		cost_usd: s,
		failure_reason: l ? l.slice(0, 500) : void 0
	});
}
function U(e, t, n, r) {
	i("permission_requested", {
		event_category: "task_lifecycle",
		task_id: e.taskId,
		opencode_session_id: e.sessionId,
		task_type: e.taskType,
		permission_type: t,
		model: n,
		provider: r
	});
}
function W(e, t, n, r, a) {
	i("permission_response", {
		event_category: "task_lifecycle",
		task_id: e.taskId,
		opencode_session_id: e.sessionId,
		task_type: e.taskType,
		permission_type: t,
		granted: n,
		model: r,
		provider: a
	});
}
function G(e, t, n, r) {
	i("tool_used", {
		event_category: "task_lifecycle",
		task_id: e.taskId,
		opencode_session_id: e.sessionId,
		task_type: e.taskType,
		tool_name: t,
		model: n,
		provider: r
	});
}
function K(e, t, n, r, a) {
	i("user_interaction", {
		event_category: "task_lifecycle",
		task_id: e.taskId,
		opencode_session_id: e.sessionId,
		task_type: e.taskType,
		interaction_type: t,
		used_suggestion: n,
		model: r,
		provider: a
	});
}
async function q() {
	let e = await g(), n = Object.values(e).filter((e) => e !== null).length;
	i("app_close", {
		event_category: "session",
		duration_seconds: s(),
		task_count: t(),
		connected_providers_count: n
	});
}
function J() {
	i("app_backgrounded", { event_category: "session" });
}
function Y() {
	i("app_foregrounded", { event_category: "session" });
}
function X(e, t, n, r) {
	i("model_selection_step", {
		event_category: "model_selection",
		step: e,
		is_onboarding: t,
		provider: n,
		model: r
	});
}
function Z(e, t, n) {
	i("model_selection_complete", {
		event_category: "model_selection",
		provider: e,
		is_onboarding: t,
		model: n
	});
}
function Q(e, t) {
	i("model_selection_abandoned", {
		event_category: "model_selection",
		last_step: e,
		is_onboarding: t
	});
}
function ne() {
	i("history_viewed", { event_category: "feature_usage" });
}
function re() {
	i("task_from_history", { event_category: "feature_usage" });
}
function ie() {
	i("history_cleared", { event_category: "feature_usage" });
}
function ae() {
	i("task_details_expanded", { event_category: "feature_usage" });
}
function oe() {
	i("output_copied", { event_category: "feature_usage" });
}
function $(e) {
	i("provider_disconnected", {
		event_category: "settings",
		provider: e
	});
}
function se(e) {
	i("help_link_clicked", {
		event_category: "settings",
		provider: e
	});
}
function ce(e) {
	i("skill_action", {
		event_category: "feature_usage",
		...e
	});
}
function le(e) {
	i("save_voice_api_key", {
		event_category: "settings",
		success: e
	});
}
function ue() {
	i("export_logs", { event_category: "feature_usage" });
}
function de() {
	i("thread_exported", { event_category: "feature_usage" });
}
function fe(e) {
	i("task_launcher_action", {
		event_category: "feature_usage",
		action: e
	});
}
function pe(e, t, n, r, a, o, s, c, l) {
	i("task_feedback", {
		event_category: "task_lifecycle",
		task_id: e,
		opencode_session_id: t,
		rating: n,
		task_status: r,
		feedback_stage: a,
		model: o,
		provider: s,
		feedback_reason: c,
		feedback_text: l?.substring(0, 500)
	});
}
function me(e, t) {
	i("stop_agent", {
		event_category: "task_lifecycle",
		task_id: e,
		opencode_session_id: t
	});
}
function he(e) {
	i("provider_box_clicked", {
		event_category: "model_selection",
		...e
	});
}
//#endregion
export { m as $, H as A, R as B, M as C, D, me as E, de as F, K as G, z as H, N as I, h as J, b as K, G as L, re as M, fe as N, V as O, B as P, v as Q, F as R, le as S, ce as T, te as U, L as V, I as W, ee as X, g as Y, _ as Z, U as _, x as a, $ as b, ie as c, Z as d, f as et, X as f, E as g, oe as h, Y as i, pe as j, ae as k, ne as l, k as m, q as n, d as nt, ue as o, O as p, y as q, T as r, p as rt, se as s, J as t, u as tt, Q as u, W as v, j as w, A as x, he as y, P as z };

//# sourceMappingURL=events-Ba_VD2iP.js.map