import { d as e } from "./id-CqFLcoJO.js";
import { a as t, o as n, r, s as i } from "./desktop-main-BR3V7oXg.js";
import { t as a } from "./logging-CWK-J2W5.js";
import { n as o, r as s } from "./build-config-bo7E3mNy.js";
import { BrowserWindow as c, app as l } from "electron";
import u from "path";
import d from "fs";
import { spawn as f } from "child_process";
//#region src/main/utils/bundled-node.ts
function p() {
	return {
		userDataPath: l.getPath("userData"),
		tempPath: l.getPath("temp"),
		isPackaged: l.isPackaged,
		resourcesPath: process.resourcesPath,
		appPath: l.getAppPath(),
		platform: process.platform,
		arch: process.arch
	};
}
function m() {
	return e(p());
}
//#endregion
//#region src/main/daemon/daemon-connector.ts
var h = 1e4, g = 200, _ = 500, v = 200, y = 5e3, b = 10;
function x(e, t, n) {
	try {
		let r = a();
		r?.log && r.log(e, "daemon", t, n);
	} catch {}
}
function S() {
	return l.getPath("userData");
}
function C() {
	return l.isPackaged ? u.join(process.resourcesPath, "daemon", "index.js") : u.join(l.getAppPath(), "..", "daemon", "dist", "index.js");
}
async function w(e) {
	let t = null, n = null;
	try {
		return t = await r({
			dataDir: e,
			connectTimeout: 2e3
		}), n = new i({ transport: t }), await n.ping(), n;
	} catch {
		return n ? n.close() : t && t.close(), null;
	}
}
var T = class extends Error {
	constructor(e) {
		super(e), this.name = "DaemonRestartError";
	}
};
async function E(e) {
	let t = await w(e);
	if (!t) return null;
	try {
		let n = await t.ping(), r = s();
		return n.buildId === r ? t : (x("INFO", `[DaemonConnector] Build mismatch: daemon=${n.buildId ?? "none"}, app=${r}. Restarting daemon...`), await t.call("daemon.shutdown").catch(() => {}), t.close(), await D(e, 3e4), null);
	} catch (e) {
		if (t.close(), e instanceof T) throw e;
		return null;
	}
}
async function D(e, n = 3e4) {
	let r = t(e), i = Date.now() + n;
	for (; Date.now() < i;) {
		if (!d.existsSync(r)) return;
		try {
			let e = d.readFileSync(r, "utf8"), { pid: t } = JSON.parse(e);
			process.kill(t, 0), await q(200);
		} catch {
			return;
		}
	}
	throw new T("Old daemon did not exit within 30s after shutdown request. Please restart the application.");
}
function O() {
	try {
		return m();
	} catch {}
	let e = process.env.npm_node_execpath;
	return e && d.existsSync(e) ? e : "node";
}
function k(e) {
	let t = l.isPackaged ? m() : O(), n = C();
	x("INFO", `[DaemonConnector] Spawning daemon: ${t} ${n} --data-dir ${e}`);
	let r = {
		...process.env,
		ACCOMPLISH_BUILD_ID: s()
	};
	delete r.ELECTRON_RUN_AS_NODE;
	let i = o();
	i.accomplishGatewayUrl && (r.ACCOMPLISH_GATEWAY_URL = i.accomplishGatewayUrl), l.isPackaged ? (r.ACCOMPLISH_IS_PACKAGED = "1", r.ACCOMPLISH_RESOURCES_PATH = process.resourcesPath, r.ACCOMPLISH_APP_PATH = l.getAppPath()) : (r.ACCOMPLISH_APP_PATH = l.getAppPath(), r.ACCOMPLISH_RESOURCES_PATH = u.join(l.getAppPath(), "resources"));
	let a = A(e), c = d.openSync(a, "a");
	try {
		let i = f(t, [
			n,
			"--data-dir",
			e
		], {
			detached: !0,
			stdio: [
				"ignore",
				c,
				c
			],
			env: r
		});
		i.unref(), x("INFO", `[DaemonConnector] Daemon spawned (detached, pid=${i.pid})`);
	} finally {
		d.closeSync(c);
	}
}
function A(e) {
	let t = u.join(e, "logs");
	d.mkdirSync(t, { recursive: !0 });
	let n = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), r = u.join(t, `daemon-${n}.log`);
	try {
		let e = d.readdirSync(t).filter((e) => e.startsWith("daemon-") && e.endsWith(".log"));
		if (e.length > 7) {
			e.sort();
			for (let n of e.slice(0, e.length - 7)) d.unlinkSync(u.join(t, n));
		}
	} catch {}
	return r;
}
var j = null;
function M() {
	if (l.isPackaged) return;
	N();
	let e = A(S());
	if (!d.existsSync(e)) return;
	let t = d.statSync(e).size;
	j = d.watch(e, () => {
		try {
			let n = d.statSync(e).size;
			if (n <= t) {
				t = n;
				return;
			}
			let r = Buffer.alloc(n - t), i = d.openSync(e, "r");
			d.readSync(i, r, 0, r.length, t), d.closeSync(i), t = n;
			let a = r.toString().trimEnd().split("\n");
			for (let e of a) e.trim() && process.stdout.write(`[36m[Daemon][0m ${e}\n`);
		} catch {}
	});
}
function N() {
	j &&= (j.close(), null);
}
async function P(e, t) {
	let r = Date.now() + t;
	for (; Date.now() < r;) {
		let t = await w(e);
		if (t) return t;
		await q(g);
	}
	throw Error(`Daemon did not become ready within ${t}ms. Socket path: ${n(e)}`);
}
async function F() {
	let e = S();
	x("INFO", "[DaemonConnector] Attempting connection to existing daemon...");
	let t = await E(e);
	if (t) return x("INFO", "[DaemonConnector] Connected to existing daemon"), t;
	x("INFO", "[DaemonConnector] No daemon found, retrying after short delay..."), await q(_);
	let n = await E(e);
	if (n) return x("INFO", "[DaemonConnector] Connected to daemon (login item)"), n;
	x("INFO", "[DaemonConnector] Spawning new daemon..."), k(e);
	let r = await P(e, h);
	return x("INFO", "[DaemonConnector] Connected to newly spawned daemon"), r;
}
var I = !1, L = !1, R = null, z = null;
function B() {
	return L;
}
function V() {
	L = !0, x("INFO", "[DaemonConnector] Reconnection suppressed");
}
function H() {
	L = !1, x("INFO", "[DaemonConnector] Reconnection re-enabled");
}
function U(e, t) {
	R = e, z = t;
}
function W(e, t) {
	t.onDisconnect(() => {
		I || L || (I = !0, x("WARN", "[DaemonConnector] Daemon disconnected — starting reconnection..."), R?.("disconnected"), K("daemon:disconnected"), G().finally(() => {
			I = !1;
		}));
	});
}
async function G() {
	let e = v;
	for (let t = 1; t <= b; t++) {
		if (L) {
			x("INFO", "[DaemonConnector] Reconnect loop cancelled (suppressed)");
			return;
		}
		if (R?.("reconnecting"), x("INFO", `[DaemonConnector] Reconnect attempt ${t}/${b}...`), await q(e), L) {
			x("INFO", "[DaemonConnector] Reconnect loop cancelled after delay (suppressed)");
			return;
		}
		let n = S(), r = null;
		try {
			r = await E(n);
		} catch (e) {
			if (e instanceof T) {
				x("ERROR", `[DaemonConnector] ${String(e)}`), K("daemon:reconnect-failed");
				return;
			}
		}
		if (r) {
			x("INFO", "[DaemonConnector] Reconnected to daemon"), R?.("connected"), z?.(r), K("daemon:reconnected");
			return;
		}
		e = Math.min(e * 2, y);
	}
	if (L) {
		x("INFO", "[DaemonConnector] Reconnect spawn cancelled (suppressed)");
		return;
	}
	x("WARN", "[DaemonConnector] All reconnect attempts failed — spawning new daemon...");
	let t = S();
	k(t);
	try {
		let e = await P(t, h);
		x("INFO", "[DaemonConnector] Connected to newly spawned daemon after reconnect"), R?.("connected"), z?.(e), K("daemon:reconnected");
	} catch (e) {
		x("ERROR", `[DaemonConnector] Failed to reconnect: ${String(e)}`), K("daemon:reconnect-failed");
	}
}
function K(e) {
	for (let t of c.getAllWindows()) if (!t.isDestroyed()) try {
		t.webContents.send(e);
	} catch {}
}
function q(e) {
	return new Promise((t) => setTimeout(t, e));
}
//#endregion
export { S as a, W as c, V as d, M as f, C as i, k as l, H as n, B as o, F as r, U as s, T as t, N as u };

//# sourceMappingURL=daemon-connector-D2tzq5ua.js.map