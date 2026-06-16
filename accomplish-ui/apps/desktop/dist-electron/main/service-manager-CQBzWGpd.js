import { t as getLogCollector } from "./logging-ZKSN6tdj.js";
import { app } from "electron";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
//#region src/main/daemon/service-manager.ts
/**
* Service Manager
*
* Cross-platform daemon auto-start registration.
* "Start at Login" now starts the **daemon binary** (not the full Electron app).
*
*   - macOS: LaunchAgent plist with KeepAlive
*   - Windows: Electron login item (starts Electron hidden, which spawns daemon)
*   - Linux: systemd user service for the daemon binary
*
* This file MUST use `path.join()` for all file paths (Windows CI compatibility).
*/
function logD(level, msg) {
	try {
		const l = getLogCollector();
		if (l?.log) l.log(level, "daemon", msg);
	} catch (_e) {}
}
/** Whether the daemon is registered to auto-start on login. */
function isAutoStartEnabled() {
	if (process.platform === "linux") return isSystemdServiceEnabled();
	if (process.platform === "darwin") return isLaunchAgentInstalled();
	return app.getLoginItemSettings().openAtLogin;
}
/** Register the daemon to auto-start on login. */
function enableAutoStart() {
	logD("INFO", `[ServiceManager] Enabling auto-start for platform: ${process.platform}`);
	if (process.platform === "linux") {
		installSystemdService();
		return;
	}
	if (process.platform === "darwin") {
		installLaunchAgent();
		return;
	}
	if (app.isPackaged) {
		const nodePath = getDaemonNodePath();
		const entryPath = getDaemonEntryPath();
		const dataDir = getDataDir();
		app.setLoginItemSettings({
			openAtLogin: true,
			path: nodePath,
			args: [
				entryPath,
				"--data-dir",
				dataDir,
				"--packaged",
				"--resources-path",
				process.resourcesPath,
				"--app-path",
				app.getAppPath()
			]
		});
		logD("INFO", "[ServiceManager] Auto-start enabled: daemon binary via login item");
	} else {
		app.setLoginItemSettings({
			openAtLogin: true,
			openAsHidden: true
		});
		logD("INFO", "[ServiceManager] Auto-start enabled: Electron hidden (dev mode)");
	}
}
/** Unregister the daemon from auto-starting on login. */
function disableAutoStart() {
	logD("INFO", `[ServiceManager] Disabling auto-start for platform: ${process.platform}`);
	if (process.platform === "linux") {
		uninstallSystemdService();
		return;
	}
	if (process.platform === "darwin") {
		uninstallLaunchAgent();
		return;
	}
	app.setLoginItemSettings({ openAtLogin: false });
	logD("INFO", "[ServiceManager] Auto-start disabled");
}
function getDaemonNodePath() {
	if (app.isPackaged) {
		const platformArch = `${process.platform}-${process.arch}`;
		const nodejsBase = path.join(process.resourcesPath, "nodejs", platformArch);
		const nodeBinary = process.platform === "win32" ? "node.exe" : path.join("bin", "node");
		const directPath = path.join(nodejsBase, nodeBinary);
		if (fs.existsSync(directPath)) return directPath;
		try {
			const children = fs.readdirSync(nodejsBase, { withFileTypes: true });
			for (const child of children) {
				if (!child.isDirectory()) continue;
				const nested = path.join(nodejsBase, child.name, nodeBinary);
				if (fs.existsSync(nested)) return nested;
			}
		} catch {}
	}
	return process.execPath;
}
function getDaemonEntryPath() {
	if (app.isPackaged) return path.join(process.resourcesPath, "daemon", "index.js");
	return path.join(app.getAppPath(), "..", "daemon", "dist", "index.js");
}
function getDataDir() {
	return app.getPath("userData");
}
var LAUNCH_AGENT_LABEL = "ai.accomplish.daemon";
function getLaunchAgentDir() {
	return path.join(process.env.HOME || "~", "Library", "LaunchAgents");
}
function getLaunchAgentPath() {
	return path.join(getLaunchAgentDir(), `${LAUNCH_AGENT_LABEL}.plist`);
}
function getLaunchAgentContent() {
	const nodePath = getDaemonNodePath();
	const entryPath = getDaemonEntryPath();
	const dataDir = getDataDir();
	const lines = [
		"<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
		"<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">",
		"<plist version=\"1.0\">",
		"<dict>",
		`  <key>Label</key><string>${LAUNCH_AGENT_LABEL}</string>`,
		"  <key>ProgramArguments</key>",
		"  <array>",
		`    <string>${nodePath}</string>`,
		`    <string>${entryPath}</string>`,
		`    <string>--data-dir</string>`,
		`    <string>${dataDir}</string>`,
		"  </array>",
		"  <key>KeepAlive</key><true/>",
		"  <key>RunAtLoad</key><true/>"
	];
	const envDict = ["  <key>EnvironmentVariables</key>", "  <dict>"];
	if (app.isPackaged) envDict.push("    <key>ACCOMPLISH_IS_PACKAGED</key><string>1</string>");
	else envDict.push("    <key>ELECTRON_RUN_AS_NODE</key><string>1</string>");
	envDict.push(`    <key>ACCOMPLISH_RESOURCES_PATH</key><string>${app.isPackaged ? process.resourcesPath : `${app.getAppPath()}/resources`}</string>`, `    <key>ACCOMPLISH_APP_PATH</key><string>${app.getAppPath()}</string>`, "  </dict>");
	lines.push(...envDict);
	lines.push("  <key>StandardOutPath</key>", `  <string>${path.join(dataDir, "logs", "daemon-service.log")}</string>`, "  <key>StandardErrorPath</key>", `  <string>${path.join(dataDir, "logs", "daemon-service.log")}</string>`, "</dict>", "</plist>", "");
	return lines.join("\n");
}
function installLaunchAgent() {
	const agentDir = getLaunchAgentDir();
	const agentPath = getLaunchAgentPath();
	fs.mkdirSync(agentDir, { recursive: true });
	fs.writeFileSync(agentPath, getLaunchAgentContent(), { mode: 420 });
	logD("INFO", `[ServiceManager] Wrote LaunchAgent to: ${agentPath}`);
	try {
		execSync(`launchctl unload "${agentPath}" 2>/dev/null || true`, { stdio: "pipe" });
		execSync(`launchctl load "${agentPath}"`, { stdio: "pipe" });
		logD("INFO", "[ServiceManager] LaunchAgent loaded");
	} catch (err) {
		logD("ERROR", `[ServiceManager] Failed to load LaunchAgent: ${String(err)}`);
		throw err;
	}
}
function uninstallLaunchAgent() {
	const agentPath = getLaunchAgentPath();
	try {
		execSync(`launchctl unload "${agentPath}" 2>/dev/null || true`, { stdio: "pipe" });
		logD("INFO", "[ServiceManager] LaunchAgent unloaded");
	} catch {}
	if (fs.existsSync(agentPath)) {
		fs.unlinkSync(agentPath);
		logD("INFO", `[ServiceManager] Removed LaunchAgent: ${agentPath}`);
	}
}
function isLaunchAgentInstalled() {
	return fs.existsSync(getLaunchAgentPath());
}
var SYSTEMD_SERVICE_NAME = "accomplish-daemon.service";
function getSystemdServiceDir() {
	const configDir = process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || "~", ".config");
	return path.join(configDir, "systemd", "user");
}
function getSystemdServicePath() {
	return path.join(getSystemdServiceDir(), SYSTEMD_SERVICE_NAME);
}
function getSystemdServiceContent() {
	const lines = [
		"[Unit]",
		"Description=Accomplish AI Daemon",
		"After=default.target",
		"",
		"[Service]",
		"Type=simple",
		`ExecStart=${getDaemonNodePath()} ${getDaemonEntryPath()} --data-dir ${getDataDir()}`
	];
	if (app.isPackaged) lines.push(`Environment=ACCOMPLISH_IS_PACKAGED=1`, `Environment=ACCOMPLISH_RESOURCES_PATH=${process.resourcesPath}`, `Environment=ACCOMPLISH_APP_PATH=${app.getAppPath()}`);
	lines.push("Restart=on-failure", "RestartSec=5", "", "[Install]", "WantedBy=default.target", "");
	return lines.join("\n");
}
function installSystemdService() {
	const serviceDir = getSystemdServiceDir();
	const servicePath = getSystemdServicePath();
	fs.mkdirSync(serviceDir, { recursive: true });
	fs.writeFileSync(servicePath, getSystemdServiceContent(), { mode: 420 });
	logD("INFO", `[ServiceManager] Wrote systemd service to: ${servicePath}`);
	try {
		execSync("systemctl --user daemon-reload", { stdio: "pipe" });
		execSync(`systemctl --user enable ${SYSTEMD_SERVICE_NAME}`, { stdio: "pipe" });
		logD("INFO", "[ServiceManager] systemd user service enabled");
	} catch (err) {
		logD("ERROR", `[ServiceManager] Failed to enable systemd service: ${String(err)}`);
		throw err;
	}
}
function uninstallSystemdService() {
	const servicePath = getSystemdServicePath();
	try {
		execSync(`systemctl --user disable ${SYSTEMD_SERVICE_NAME}`, { stdio: "pipe" });
		execSync(`systemctl --user stop ${SYSTEMD_SERVICE_NAME}`, { stdio: "pipe" });
		logD("INFO", "[ServiceManager] systemd user service disabled and stopped");
	} catch {}
	if (fs.existsSync(servicePath)) {
		fs.unlinkSync(servicePath);
		logD("INFO", `[ServiceManager] Removed service file: ${servicePath}`);
	}
	try {
		execSync("systemctl --user daemon-reload", { stdio: "pipe" });
	} catch {}
}
function isSystemdServiceEnabled() {
	try {
		return execSync(`systemctl --user is-enabled ${SYSTEMD_SERVICE_NAME}`, {
			stdio: "pipe",
			encoding: "utf-8"
		}).trim() === "enabled";
	} catch {
		return false;
	}
}
//#endregion
export { enableAutoStart as n, isAutoStartEnabled as r, disableAutoStart as t };

//# sourceMappingURL=service-manager-CQBzWGpd.js.map