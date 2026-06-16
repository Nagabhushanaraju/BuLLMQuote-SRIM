import { n as e } from "./build-config-bo7E3mNy.js";
import { app as t, net as n } from "electron";
import r from "fs";
import { createHash as i, randomUUID as a } from "crypto";
import { execSync as o } from "child_process";
import s from "electron-store";
//#region src/main/identity/device-fingerprint.ts
function c() {
	try {
		return o("ioreg -rd1 -c IOPlatformExpertDevice", {
			encoding: "utf8",
			timeout: 5e3
		}).match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/)?.[1] ?? null;
	} catch {
		return null;
	}
}
function l() {
	try {
		return o("powershell -NoProfile -Command \"(Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -Name MachineGuid).MachineGuid\"", {
			encoding: "utf8",
			timeout: 5e3
		}).trim() || null;
	} catch {
		return null;
	}
}
function u() {
	try {
		return r.readFileSync("/etc/machine-id", "utf8").trim() || null;
	} catch {
		try {
			return r.readFileSync("/var/lib/dbus/machine-id", "utf8").trim() || null;
		} catch {
			return null;
		}
	}
}
function d() {
	switch (process.platform) {
		case "darwin": return c();
		case "win32": return l();
		case "linux": return u();
		default: return null;
	}
}
function f() {
	let e = d();
	return e ? i("sha256").update(e).digest("hex").substring(0, 32) : null;
}
//#endregion
//#region src/main/analytics/analytics-service.ts
function p() {
	return e().gaMeasurementId;
}
function m() {
	return e().gaApiSecret;
}
function h() {
	return process.env.GA_DEBUG_MODE === "1" || process.env.GA_DEBUG_MODE === "true";
}
function g() {
	return `https://www.google-analytics.com/mp/collect?measurement_id=${p()}&api_secret=${m()}`;
}
var _ = null;
function v() {
	return _ ||= new s({
		name: "analytics",
		defaults: {
			clientId: "",
			deviceFingerprint: "",
			firstSeenAt: "",
			firstLaunchVersion: "",
			firstTaskCompleted: !1
		}
	}), _;
}
var y = "", b = 0, x = 0, S = 0, C = [], w = !0;
function T() {
	let e = v().get("clientId"), n = !e;
	return e || (e = a(), v().set("clientId", e), v().set("firstSeenAt", (/* @__PURE__ */ new Date()).toISOString()), v().set("firstLaunchVersion", t.getVersion())), v().get("firstLaunchVersion") || v().set("firstLaunchVersion", t.getVersion()), y = a(), b = Date.now(), x = Date.now(), S = 0, console.log("[Analytics] Initialized with client ID:", e.substring(0, 8) + "..."), console.log("[Analytics] Session ID:", y.substring(0, 8) + "..."), console.log("[Analytics] Environment:", t.isPackaged ? "production" : "dev"), h() && console.log("[Analytics] Debug mode enabled — events sent to GA4 DebugView"), { isFirstLaunch: n };
}
function E() {
	let e = v().get("deviceFingerprint");
	if (e) {
		console.log("[Analytics] Device fingerprint loaded from cache:", e.substring(0, 8) + "...");
		return;
	}
	let t = f();
	t ? (v().set("deviceFingerprint", t), console.log("[Analytics] Device fingerprint computed:", t.substring(0, 8) + "...")) : console.warn("[Analytics] Device fingerprint computation failed, will fall back to clientId");
}
function D() {
	return v().get("deviceFingerprint") || v().get("clientId");
}
function O() {
	return v().get("clientId");
}
function k() {
	return y;
}
function A() {
	return v().get("firstSeenAt") || "";
}
function j() {
	return v().get("firstLaunchVersion") || "";
}
function M() {
	return v().get("firstTaskCompleted");
}
function N() {
	v().set("firstTaskCompleted", !0);
}
function P() {
	S++;
}
function F() {
	return S;
}
function I() {
	return Math.floor((Date.now() - x) / 1e3);
}
function L() {
	return !!(v().get("clientId") && m() && p());
}
var R = null;
async function z() {
	R ||= (await import("./tracking-context-y_LqEFeG.js")).buildCommonTrackingFields;
	let { ga_session_id: e, ga_client_id: t, first_launched_at: n, ...r } = R();
	return {
		...r,
		session_id: b,
		trace_session_id: y,
		engagement_time_msec: 100
	};
}
async function B(e) {
	let t = v().get("clientId");
	if (!t) return console.warn("[Analytics] No client ID, skipping send"), !1;
	if (!m()) return console.warn("[Analytics] No API secret configured, skipping send"), !1;
	let r = {
		client_id: t,
		user_properties: { first_seen_at: { value: v().get("firstSeenAt") || "" } },
		events: e
	};
	try {
		let e = JSON.stringify(r), t = await n.fetch(g(), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: e
		});
		return t.ok ? !0 : (console.error("[Analytics] GA4 request failed:", t.status, t.statusText), !1);
	} catch (e) {
		return console.error("[Analytics] Failed to send events:", e), !1;
	}
}
async function V(e, t = {}) {
	try {
		try {
			let { trackMixpanelEvent: n } = await import("./mixpanel-service-c4kBnk2P.js");
			n(e, t);
		} catch {}
		if (!L()) return;
		let n = await z(), r = {
			name: e,
			params: {
				...t,
				...n,
				...h() ? { debug_mode: !0 } : {}
			}
		};
		if (!w) {
			C.push(r), console.log(`[Analytics] Queued event (offline): ${e}`);
			return;
		}
		await B([r]) ? console.log(`[Analytics] Sent event: ${e}`) : (C.push(r), console.log(`[Analytics] Queued event (send failed): ${e}`));
	} catch (t) {
		console.error(`[Analytics] Failed to track event "${e}":`, t);
	}
}
function H() {
	C.length > 0 && (console.log(`[Analytics] Attempting to flush ${C.length} events on quit`), B([...C]).catch((e) => {
		console.error("[Analytics] Failed to flush on quit:", e);
	}));
}
//#endregion
export { j as a, F as c, E as d, M as f, f as h, D as i, P as l, V as m, k as n, A as o, N as p, O as r, I as s, H as t, T as u };

//# sourceMappingURL=analytics-service-UJ3ooobv.js.map