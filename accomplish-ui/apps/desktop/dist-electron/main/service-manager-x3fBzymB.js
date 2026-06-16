import { t as e } from "./logging-CWK-J2W5.js";
import { app as t } from "electron";
import n from "path";
import r from "fs";
import { execSync as i } from "child_process";
//#region src/main/daemon/service-manager.ts
function a(t, n) {
	try {
		let r = e();
		r?.log && r.log(t, "daemon", n);
	} catch {}
}
function o() {
	return process.platform === "linux" ? T() : process.platform === "darwin" ? v() : t.getLoginItemSettings().openAtLogin;
}
function s() {
	if (a("INFO", `[ServiceManager] Enabling auto-start for platform: ${process.platform}`), process.platform === "linux") {
		C();
		return;
	}
	if (process.platform === "darwin") {
		g();
		return;
	}
	if (t.isPackaged) {
		let e = l(), n = u(), r = d();
		t.setLoginItemSettings({
			openAtLogin: !0,
			path: e,
			args: [
				n,
				"--data-dir",
				r,
				"--packaged",
				"--resources-path",
				process.resourcesPath,
				"--app-path",
				t.getAppPath()
			]
		}), a("INFO", "[ServiceManager] Auto-start enabled: daemon binary via login item");
	} else t.setLoginItemSettings({
		openAtLogin: !0,
		openAsHidden: !0
	}), a("INFO", "[ServiceManager] Auto-start enabled: Electron hidden (dev mode)");
}
function c() {
	if (a("INFO", `[ServiceManager] Disabling auto-start for platform: ${process.platform}`), process.platform === "linux") {
		w();
		return;
	}
	if (process.platform === "darwin") {
		_();
		return;
	}
	t.setLoginItemSettings({ openAtLogin: !1 }), a("INFO", "[ServiceManager] Auto-start disabled");
}
function l() {
	if (t.isPackaged) {
		let e = `${process.platform}-${process.arch}`, t = n.join(process.resourcesPath, "nodejs", e), i = process.platform === "win32" ? "node.exe" : n.join("bin", "node"), a = n.join(t, i);
		if (r.existsSync(a)) return a;
		try {
			let e = r.readdirSync(t, { withFileTypes: !0 });
			for (let a of e) {
				if (!a.isDirectory()) continue;
				let e = n.join(t, a.name, i);
				if (r.existsSync(e)) return e;
			}
		} catch {}
	}
	return process.execPath;
}
function u() {
	return t.isPackaged ? n.join(process.resourcesPath, "daemon", "index.js") : n.join(t.getAppPath(), "..", "daemon", "dist", "index.js");
}
function d() {
	return t.getPath("userData");
}
var f = "ai.accomplish.daemon";
function p() {
	return n.join(process.env.HOME || "~", "Library", "LaunchAgents");
}
function m() {
	return n.join(p(), `${f}.plist`);
}
function h() {
	let e = l(), r = u(), i = d(), a = [
		"<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
		"<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">",
		"<plist version=\"1.0\">",
		"<dict>",
		`  <key>Label</key><string>${f}</string>`,
		"  <key>ProgramArguments</key>",
		"  <array>",
		`    <string>${e}</string>`,
		`    <string>${r}</string>`,
		"    <string>--data-dir</string>",
		`    <string>${i}</string>`,
		"  </array>",
		"  <key>KeepAlive</key><true/>",
		"  <key>RunAtLoad</key><true/>"
	], o = ["  <key>EnvironmentVariables</key>", "  <dict>"];
	return t.isPackaged ? o.push("    <key>ACCOMPLISH_IS_PACKAGED</key><string>1</string>") : o.push("    <key>ELECTRON_RUN_AS_NODE</key><string>1</string>"), o.push(`    <key>ACCOMPLISH_RESOURCES_PATH</key><string>${t.isPackaged ? process.resourcesPath : `${t.getAppPath()}/resources`}</string>`, `    <key>ACCOMPLISH_APP_PATH</key><string>${t.getAppPath()}</string>`, "  </dict>"), a.push(...o), a.push("  <key>StandardOutPath</key>", `  <string>${n.join(i, "logs", "daemon-service.log")}</string>`, "  <key>StandardErrorPath</key>", `  <string>${n.join(i, "logs", "daemon-service.log")}</string>`, "</dict>", "</plist>", ""), a.join("\n");
}
function g() {
	let e = p(), t = m();
	r.mkdirSync(e, { recursive: !0 }), r.writeFileSync(t, h(), { mode: 420 }), a("INFO", `[ServiceManager] Wrote LaunchAgent to: ${t}`);
	try {
		i(`launchctl unload "${t}" 2>/dev/null || true`, { stdio: "pipe" }), i(`launchctl load "${t}"`, { stdio: "pipe" }), a("INFO", "[ServiceManager] LaunchAgent loaded");
	} catch (e) {
		throw a("ERROR", `[ServiceManager] Failed to load LaunchAgent: ${String(e)}`), e;
	}
}
function _() {
	let e = m();
	try {
		i(`launchctl unload "${e}" 2>/dev/null || true`, { stdio: "pipe" }), a("INFO", "[ServiceManager] LaunchAgent unloaded");
	} catch {}
	r.existsSync(e) && (r.unlinkSync(e), a("INFO", `[ServiceManager] Removed LaunchAgent: ${e}`));
}
function v() {
	return r.existsSync(m());
}
var y = "accomplish-daemon.service";
function b() {
	let e = process.env.XDG_CONFIG_HOME || n.join(process.env.HOME || "~", ".config");
	return n.join(e, "systemd", "user");
}
function x() {
	return n.join(b(), y);
}
function S() {
	let e = [
		"[Unit]",
		"Description=Accomplish AI Daemon",
		"After=default.target",
		"",
		"[Service]",
		"Type=simple",
		`ExecStart=${l()} ${u()} --data-dir ${d()}`
	];
	return t.isPackaged && e.push("Environment=ACCOMPLISH_IS_PACKAGED=1", `Environment=ACCOMPLISH_RESOURCES_PATH=${process.resourcesPath}`, `Environment=ACCOMPLISH_APP_PATH=${t.getAppPath()}`), e.push("Restart=on-failure", "RestartSec=5", "", "[Install]", "WantedBy=default.target", ""), e.join("\n");
}
function C() {
	let e = b(), t = x();
	r.mkdirSync(e, { recursive: !0 }), r.writeFileSync(t, S(), { mode: 420 }), a("INFO", `[ServiceManager] Wrote systemd service to: ${t}`);
	try {
		i("systemctl --user daemon-reload", { stdio: "pipe" }), i(`systemctl --user enable ${y}`, { stdio: "pipe" }), a("INFO", "[ServiceManager] systemd user service enabled");
	} catch (e) {
		throw a("ERROR", `[ServiceManager] Failed to enable systemd service: ${String(e)}`), e;
	}
}
function w() {
	let e = x();
	try {
		i(`systemctl --user disable ${y}`, { stdio: "pipe" }), i(`systemctl --user stop ${y}`, { stdio: "pipe" }), a("INFO", "[ServiceManager] systemd user service disabled and stopped");
	} catch {}
	r.existsSync(e) && (r.unlinkSync(e), a("INFO", `[ServiceManager] Removed service file: ${e}`));
	try {
		i("systemctl --user daemon-reload", { stdio: "pipe" });
	} catch {}
}
function T() {
	try {
		return i(`systemctl --user is-enabled ${y}`, {
			stdio: "pipe",
			encoding: "utf-8"
		}).trim() === "enabled";
	} catch {
		return !1;
	}
}
//#endregion
export { s as n, o as r, c as t };

//# sourceMappingURL=service-manager-x3fBzymB.js.map