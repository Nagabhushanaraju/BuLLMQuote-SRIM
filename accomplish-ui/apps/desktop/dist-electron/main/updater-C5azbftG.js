import { t as e } from "./logging-CWK-J2W5.js";
import { B as t, H as n, R as r, U as i, V as a, W as o, z as s } from "./events-I4bj9Pyf.js";
import { n as c } from "./build-config-bo7E3mNy.js";
import { app as l, clipboard as u, dialog as d, shell as f } from "electron";
import p from "path";
import m from "fs";
import h from "electron-store";
import g from "http";
import * as _ from "@sentry/electron/main";
import v from "https";
import { coerce as y, gt as b, valid as ee } from "semver";
import { load as te } from "js-yaml";
//#region src/main/updater/feed-config.ts
function x() {
	return c().accomplishUpdaterUrl.replace(/\/+$/, "");
}
function ne(e, t) {
	return e === "win" ? "latest-win.yml" : t === "arm64" ? "latest-linux-arm64.yml" : "latest-linux.yml";
}
//#endregion
//#region src/main/updater/dialogs.ts
async function re(e, t) {
	let { response: n } = await d.showMessageBox({
		type: "info",
		title: "Update Ready",
		message: `Version ${e} has been downloaded.`,
		detail: "The update will be installed when you restart the app. Would you like to restart now?",
		buttons: ["Restart Now", "Later"],
		defaultId: 0,
		cancelId: 1
	});
	n === 0 && await t();
}
async function S() {
	await d.showMessageBox({
		type: "info",
		title: "No Updates",
		message: "You're up to date!",
		detail: `Accomplish ${l.getVersion()} is the latest version.`,
		buttons: ["OK"]
	});
}
async function C() {
	await d.showMessageBox({
		type: "error",
		title: "Update Check Failed",
		message: "Could not check for updates",
		detail: "Failed to fetch update information. Please try again later.",
		buttons: ["OK"]
	});
}
async function w(e, t, n) {
	let r = await d.showMessageBox({
		type: "info",
		title: "Update Available",
		message: "A new version of Accomplish is available!",
		detail: `Version ${t} is available.\nYou are currently on version ${e}.\n\nClick "Download" to open the download page in your browser.`,
		buttons: [
			"Download",
			"Copy URL",
			"Later"
		],
		defaultId: 0,
		cancelId: 2
	});
	r.response === 0 ? await f.openExternal(n) : r.response === 1 && u.writeText(n);
}
//#endregion
//#region src/main/updater/logger.ts
function T(t, n, r) {
	try {
		e()?.log?.(t, "main", n, r);
	} catch {}
}
//#endregion
//#region src/main/updater/origin.ts
function ie(e, t) {
	let n, r;
	try {
		n = new URL(e), r = new URL(t);
	} catch {
		return !1;
	}
	if (n.protocol !== r.protocol) return !1;
	let i = n.hostname, a = r.hostname;
	if (O(a) || O(i)) return i === a;
	let o = ae(a);
	return i === o || i.endsWith("." + o);
}
function E(e, t) {
	let n = e.trim();
	if (!n || n.startsWith("//")) return !1;
	try {
		let e = new URL(n);
		return e.protocol !== "http:" && e.protocol !== "https:" ? !1 : ie(n, t);
	} catch {
		return !0;
	}
}
function D(e, t) {
	let n = [];
	if (typeof e.path == "string" && n.push(e.path), Array.isArray(e.files)) {
		for (let t of e.files) if (t && typeof t == "object") {
			let e = t.url;
			typeof e == "string" && n.push(e);
		}
	}
	return n.every((e) => E(e, t));
}
function O(e) {
	return e.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(e);
}
function ae(e) {
	let t = e.split(".");
	return t.length <= 2 ? e : t.slice(-2).join(".");
}
//#endregion
//#region src/main/updater/state.ts
var k = null, A = null, j = null, M = null, N = !1;
function oe(e) {
	k = e;
}
function P() {
	return k;
}
function se(e) {
	A = e;
}
function ce() {
	return A;
}
function F(e) {
	j = e;
}
function I(e) {
	N = e;
}
function L() {
	return N;
}
function R(e) {
	M = e;
}
function z() {
	M?.();
}
function B() {
	return {
		updateAvailable: !!j,
		downloadedVersion: A,
		availableVersion: j?.version ?? null
	};
}
//#endregion
//#region src/main/updater/listeners.ts
function V(e, i) {
	e.on("update-available", (t) => {
		let i = L();
		if (I(!1), !D(t, x())) {
			F(null), T("WARN", "[Updater] Rejected update with untrusted download URL", { version: t.version }), n("invalid_manifest", `Native update manifest contains untrusted download URL for version ${t.version}`), i && C();
			return;
		}
		F(t), T("INFO", "[Updater] update-available", { version: t.version }), r(l.getVersion(), t.version), a(t.version), i && d.showMessageBox({
			type: "info",
			title: "Update Available",
			message: `Version ${t.version} is available.`,
			detail: "Accomplish is downloading the update in the background. You will be prompted to restart when it is ready.",
			buttons: ["OK"]
		}), e.downloadUpdate().catch((e) => {
			T("ERROR", "[Updater] downloadUpdate failed", { err: e.message }), n(e.name || "download_failed", e.message);
		});
	}), e.on("update-not-available", async () => {
		o(), L() && (I(!1), await d.showMessageBox({
			type: "info",
			title: "No Updates",
			message: "You're up to date!",
			detail: `Accomplish ${l.getVersion()} is the latest version.`,
			buttons: ["OK"]
		}));
	}), e.on("download-progress", (e) => {
		P()?.setProgressBar(e.percent / 100);
	}), e.on("update-downloaded", (e) => {
		T("INFO", "[Updater] update-downloaded", { version: e.version }), P()?.setProgressBar(-1), se(e.version), t(e.version), z(), re(e.version, i);
	}), e.on("error", (e) => {
		I(!1), P()?.setProgressBar(-1), T("ERROR", "[Updater] error", { err: e.message }), n(e.name || "unknown_error", e.message);
	});
}
//#endregion
//#region src/main/updater/store.ts
var H = 1440 * 60 * 1e3, U = null;
function W() {
	return U ||= new h({
		name: "updater",
		defaults: { lastUpdateCheck: 0 }
	}), U;
}
function G() {
	let e = W().get("lastUpdateCheck");
	return e ? Date.now() - e > H : !0;
}
function K() {
	W().set("lastUpdateCheck", Date.now());
}
//#endregion
//#region src/main/updater/versioning.ts
function le(e) {
	let t;
	try {
		t = te(e);
	} catch {
		return null;
	}
	if (!t || typeof t != "object") return null;
	let { version: n, path: r } = t;
	return typeof n != "string" || typeof r != "string" ? null : {
		version: n,
		path: r
	};
}
function q(e) {
	return ee(e) ?? y(e)?.version ?? null;
}
//#endregion
//#region src/main/updater/manual-manifest.ts
async function ue(e) {
	return new Promise((t) => {
		let n = e.startsWith("http://") ? g.get : v.get, r;
		try {
			r = n(e, (n) => {
				if (n.statusCode !== 200) {
					T("WARN", "[Updater] Manifest fetch non-200", {
						url: e,
						statusCode: n.statusCode
					}), t(null);
					return;
				}
				let r = "";
				n.on("data", (e) => {
					r += e;
				}), n.on("end", () => t(r));
			});
		} catch (n) {
			T("ERROR", "[Updater] Manifest fetch threw synchronously", {
				url: e,
				err: String(n)
			}), t(null);
			return;
		}
		r.on("error", (n) => {
			T("ERROR", "[Updater] Manifest fetch failed", {
				url: e,
				err: String(n)
			}), t(null);
		});
	});
}
async function J(e, t, r, i) {
	n(e, t), T("WARN", `[Updater] ${e}`, { detail: t }), i && _.captureMessage(`Update check: ${e}`, { tags: {
		component: "updater",
		phase: i
	} }), r || await C();
}
async function Y(e, t, i) {
	let a = x();
	if (!a) return;
	let c = `${a}/${ne(t, i)}`, u = l.getVersion();
	s();
	let d = await ue(c);
	if (d === null) {
		await J("fetch_failed", `Could not fetch ${c}`, e);
		return;
	}
	let f = le(d);
	if (!f) {
		await J("invalid_manifest", `Could not parse ${c}`, e, "parse");
		return;
	}
	let p = q(f.version);
	if (!p) {
		await J("invalid_version", `Unparseable remote version: ${f.version}`, e, "version");
		return;
	}
	let m = f.path.startsWith("http://") || f.path.startsWith("https://");
	if (!E(f.path, a)) {
		await J("invalid_manifest", `Manifest path origin does not match feed URL: ${f.path}`, e, "parse");
		return;
	}
	K();
	let h = q(u);
	if (!h) {
		n("invalid_version", `Unparseable local version: ${u}`);
		return;
	}
	if (!b(p, h)) {
		o(), e || await S();
		return;
	}
	let g = m ? f.path : `${a}/${f.path}`;
	r(u, f.version), T("INFO", "[Updater] Manual update available", {
		currentVersion: u,
		newVersion: f.version,
		downloadUrl: g
	}), await w(u, f.version, g);
}
//#endregion
//#region src/main/updater/index.ts
var X = null;
async function Z() {
	if (!X) {
		let e = await import("electron-updater"), t = (Object.prototype.hasOwnProperty.call(e, "autoUpdater") ? e.autoUpdater : void 0) ?? e.default?.autoUpdater;
		if (!t) throw Error("electron-updater autoUpdater export unavailable");
		X = t;
	}
	return X;
}
async function de(e) {
	if (oe(e), x() && process.platform !== "win32" && !(process.platform === "linux" && !process.env.APPIMAGE)) try {
		let e = await Z();
		if (e.autoDownload = !1, e.autoInstallOnAppQuit = !0, !l.isPackaged) {
			let t = l.getAppPath();
			m.mkdirSync(t, { recursive: !0 }), m.writeFileSync(p.join(t, "dev-app-update.yml"), `provider: generic\nurl: ${x()}\n`), e.forceDevUpdateConfig = !0;
		}
		e.setFeedURL({
			provider: "generic",
			url: x()
		}), V(e, $);
	} catch (e) {
		throw _.captureException(e, { tags: {
			component: "updater",
			phase: "init"
		} }), e;
	}
}
async function Q(e) {
	if (x()) {
		if (process.platform === "win32") {
			await Y(e, "win");
			return;
		}
		if (process.platform === "linux" && !process.env.APPIMAGE) {
			await Y(e, "linux", process.arch === "arm64" ? "arm64" : "x64");
			return;
		}
		try {
			I(!e), s();
			let t = await (await Z()).checkForUpdates();
			if (t?.updateInfo && !D(t.updateInfo, x())) return;
			K();
		} catch (t) {
			I(!1);
			let r = t instanceof Error ? t.message : String(t);
			e || d.showErrorBox("Update Check Failed", r), T("ERROR", "[Updater] checkForUpdates failed", { err: r }), n("check_failed", r), _.captureException(t, { tags: {
				component: "updater",
				phase: "check"
			} });
		}
	}
}
async function $() {
	i(ce() ?? ""), (await Z()).quitAndInstall(!1, !0);
}
function fe() {
	x() && G() && Q(!0);
}
//#endregion
export { G as a, $ as i, Q as n, B as o, de as r, R as s, fe as t };

//# sourceMappingURL=updater-C5azbftG.js.map