import { d as getNodePath$1 } from "./id-BkuVT4wi.js";
import { a as getPidFilePath, o as getSocketPath, r as createSocketTransport, s as DaemonClient } from "./desktop-main-CXudHk3S.js";
import { t as getLogCollector } from "./logging-ZKSN6tdj.js";
import { n as getBuildConfig, r as getBuildId } from "./build-config-yaGG3zlR.js";
import { BrowserWindow, app } from "electron";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
//#region src/main/utils/bundled-node.ts
function getElectronPlatformConfig() {
	return {
		userDataPath: app.getPath("userData"),
		tempPath: app.getPath("temp"),
		isPackaged: app.isPackaged,
		resourcesPath: process.resourcesPath,
		appPath: app.getAppPath(),
		platform: process.platform,
		arch: process.arch
	};
}
function getNodePath() {
	return getNodePath$1(getElectronPlatformConfig());
}
//#endregion
//#region src/main/daemon/daemon-connector.ts
/**
* Daemon Connector
*
* Spawns the daemon as a detached process (survives Electron exit) and
* connects via Unix socket / Windows named pipe. If the daemon is already
* running (e.g. started by OS login item), reuses the existing instance.
*
* Also handles reconnection with exponential backoff if the daemon
* disconnects (crash, restart, etc.).
*/
/** How long to wait for the daemon to become ready after spawning. */
var SPAWN_READY_TIMEOUT_MS = 1e4;
/** Interval between connection attempts while waiting for daemon. */
var POLL_INTERVAL_MS = 200;
/** Short delay to allow a login-item-started daemon to finish booting. */
var LOGIN_ITEM_RETRY_DELAY_MS = 500;
/** Reconnection backoff config */
var RECONNECT_INITIAL_MS = 200;
var RECONNECT_MAX_MS = 5e3;
var RECONNECT_MAX_ATTEMPTS = 10;
function log(level, msg, data) {
	try {
		const l = getLogCollector();
		if (l?.log) l.log(level, "daemon", msg, data);
	} catch {}
}
/**
* Resolve the data directory for the daemon.
* Must match the data-dir contract: daemon uses same DB, socket, PID.
*/
function getDataDir() {
	return app.getPath("userData");
}
/**
* Resolve the path to the daemon entry script.
*/
function getDaemonEntryPath() {
	if (app.isPackaged) return path.join(process.resourcesPath, "daemon", "index.js");
	return path.join(app.getAppPath(), "..", "daemon", "dist", "index.js");
}
/**
* Try to connect to an already-running daemon.
* Returns a connected DaemonClient, or null if the daemon is not reachable.
*/
async function tryConnect(dataDir) {
	let transport = null;
	let client = null;
	try {
		transport = await createSocketTransport({
			dataDir,
			connectTimeout: 2e3
		});
		client = new DaemonClient({ transport });
		await client.ping();
		return client;
	} catch {
		if (client) client.close();
		else if (transport) transport.close();
		return null;
	}
}
/**
* Error thrown when a stale daemon could not be stopped during version-guard restart.
*/
var DaemonRestartError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "DaemonRestartError";
	}
};
/**
* Try to connect to a daemon with matching build identity.
*
* If the daemon is reachable but has a different buildId (or no buildId — older version),
* sends a shutdown request and waits for the old daemon to exit so the caller can spawn a new one.
*
* Used by both ensureDaemonRunning() and reconnectWithBackoff() — centralized guard.
*/
async function tryConnectBuildChecked(dataDir) {
	const client = await tryConnect(dataDir);
	if (!client) return null;
	try {
		const pingResult = await client.ping();
		const expectedBuildId = getBuildId();
		if (pingResult.buildId === expectedBuildId) return client;
		log("INFO", `[DaemonConnector] Build mismatch: daemon=${pingResult.buildId ?? "none"}, app=${expectedBuildId}. Restarting daemon...`);
		await client.call("daemon.shutdown").catch(() => {});
		client.close();
		await waitForDaemonExit(dataDir, 3e4);
		return null;
	} catch (err) {
		client.close();
		if (err instanceof DaemonRestartError) throw err;
		return null;
	}
}
/**
* Wait for the daemon process to exit by polling the PID file.
* Throws DaemonRestartError if the daemon doesn't exit within timeoutMs.
* Does NOT clean up socket/PID files — the old daemon still owns them if alive.
*/
async function waitForDaemonExit(dataDir, timeoutMs = 3e4) {
	const pidPath = getPidFilePath(dataDir);
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (!fs.existsSync(pidPath)) return;
		try {
			const content = fs.readFileSync(pidPath, "utf8");
			const { pid } = JSON.parse(content);
			process.kill(pid, 0);
			await sleep(200);
		} catch {
			return;
		}
	}
	throw new DaemonRestartError("Old daemon did not exit within 30s after shutdown request. Please restart the application.");
}
/**
* Dev-mode resolver for a real Node binary to spawn the daemon with.
*
* Pre-M6: dev mode used `process.execPath` + `ELECTRON_RUN_AS_NODE=1`,
* which runs Electron's embedded Node (ABI 145 for Electron 41). That
* worked because the daemon's `better-sqlite3` was rebuilt to match
* Electron's ABI as part of desktop's `@electron/rebuild` postinstall.
*
* Post-M6 (daemon-only-SQLite migration): desktop no longer owns
* `better-sqlite3`, `@electron/rebuild` is gone, and the daemon's own
* copy is built for normal Node's ABI (137 for Node 24). Spawning with
* Electron-as-Node now crashes immediately:
*   "better_sqlite3.node was compiled against NODE_MODULE_VERSION 137.
*    This version of Node.js requires NODE_MODULE_VERSION 145."
*
* Preference order:
*   1. Bundled Node under `resources/nodejs/<platform>-<arch>/…` —
*      same binary the packaged app uses. Requires
*      `pnpm -F @accomplish/desktop download:nodejs` to have been run;
*      the build scripts chain it in, so most dev checkouts already
*      have it.
*   2. `process.env.npm_node_execpath` — the Node that launched pnpm.
*      This is also the Node that ran `pnpm install` in
*      `apps/daemon/`, so its ABI matches whatever prebuild
*      prebuild-install resolved for `apps/daemon/node_modules/
*      better-sqlite3`. Reliable when pnpm is on the shell's PATH.
*   3. Literal `node` — last resort. May pick up a different Node
*      major than the one that built the daemon's native deps, so
*      this only succeeds if the user has Node 24 on PATH.
*/
function getDevNodePath() {
	try {
		return getNodePath();
	} catch {}
	const pnpmNode = process.env.npm_node_execpath;
	if (pnpmNode && fs.existsSync(pnpmNode)) return pnpmNode;
	return "node";
}
/**
* Spawn the daemon as a fully detached process.
* The daemon process survives Electron exit (detached + unref).
*/
function spawnDaemon(dataDir) {
	const nodeBin = app.isPackaged ? getNodePath() : getDevNodePath();
	const entryPath = getDaemonEntryPath();
	log("INFO", `[DaemonConnector] Spawning daemon: ${nodeBin} ${entryPath} --data-dir ${dataDir}`);
	const daemonEnv = {
		...process.env,
		ACCOMPLISH_BUILD_ID: getBuildId()
	};
	delete daemonEnv.ELECTRON_RUN_AS_NODE;
	const bc = getBuildConfig();
	if (bc.accomplishGatewayUrl) daemonEnv.ACCOMPLISH_GATEWAY_URL = bc.accomplishGatewayUrl;
	if (app.isPackaged) {
		daemonEnv.ACCOMPLISH_IS_PACKAGED = "1";
		daemonEnv.ACCOMPLISH_RESOURCES_PATH = process.resourcesPath;
		daemonEnv.ACCOMPLISH_APP_PATH = app.getAppPath();
	} else {
		daemonEnv.ACCOMPLISH_APP_PATH = app.getAppPath();
		daemonEnv.ACCOMPLISH_RESOURCES_PATH = path.join(app.getAppPath(), "resources");
	}
	const logPath = getDaemonLogPath(dataDir);
	const logFd = fs.openSync(logPath, "a");
	try {
		const child = spawn(nodeBin, [
			entryPath,
			"--data-dir",
			dataDir
		], {
			detached: true,
			stdio: [
				"ignore",
				logFd,
				logFd
			],
			env: daemonEnv
		});
		child.unref();
		log("INFO", `[DaemonConnector] Daemon spawned (detached, pid=${child.pid})`);
	} finally {
		fs.closeSync(logFd);
	}
}
/**
* Get the path to today's daemon log file (date-rotated, matches app log pattern).
* Also cleans up old daemon logs (keeps last 7 days).
*/
function getDaemonLogPath(dataDir) {
	const logsDir = path.join(dataDir, "logs");
	fs.mkdirSync(logsDir, { recursive: true });
	const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
	const logPath = path.join(logsDir, `daemon-${today}.log`);
	try {
		const files = fs.readdirSync(logsDir).filter((f) => f.startsWith("daemon-") && f.endsWith(".log"));
		if (files.length > 7) {
			files.sort();
			for (const old of files.slice(0, files.length - 7)) fs.unlinkSync(path.join(logsDir, old));
		}
	} catch {}
	return logPath;
}
/** Active log tail watcher — only one at a time */
var logWatcher = null;
/**
* Start tailing the daemon log file in dev mode.
* Prints new lines to the main process console with colored prefix.
* Safe to call multiple times — replaces any existing tail.
*/
function tailDaemonLog() {
	if (app.isPackaged) return;
	stopTailingDaemonLog();
	const logPath = getDaemonLogPath(getDataDir());
	if (!fs.existsSync(logPath)) return;
	const CYAN = "\x1B[36m";
	const RESET = "\x1B[0m";
	let fileSize = fs.statSync(logPath).size;
	logWatcher = fs.watch(logPath, () => {
		try {
			const newSize = fs.statSync(logPath).size;
			if (newSize <= fileSize) {
				fileSize = newSize;
				return;
			}
			const buf = Buffer.alloc(newSize - fileSize);
			const fd = fs.openSync(logPath, "r");
			fs.readSync(fd, buf, 0, buf.length, fileSize);
			fs.closeSync(fd);
			fileSize = newSize;
			const lines = buf.toString().trimEnd().split("\n");
			for (const line of lines) if (line.trim()) process.stdout.write(`${CYAN}[Daemon]${RESET} ${line}\n`);
		} catch {}
	});
}
/**
* Stop tailing the daemon log file.
*/
function stopTailingDaemonLog() {
	if (logWatcher) {
		logWatcher.close();
		logWatcher = null;
	}
}
/**
* Wait for the daemon to become connectable, polling at POLL_INTERVAL_MS.
*/
async function waitForDaemon(dataDir, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const client = await tryConnect(dataDir);
		if (client) return client;
		await sleep(POLL_INTERVAL_MS);
	}
	throw new Error(`Daemon did not become ready within ${timeoutMs}ms. Socket path: ${getSocketPath(dataDir)}`);
}
/**
* Ensure a daemon is running and return a connected DaemonClient.
*/
async function ensureDaemonRunning() {
	const dataDir = getDataDir();
	log("INFO", "[DaemonConnector] Attempting connection to existing daemon...");
	const existing = await tryConnectBuildChecked(dataDir);
	if (existing) {
		log("INFO", "[DaemonConnector] Connected to existing daemon");
		return existing;
	}
	log("INFO", "[DaemonConnector] No daemon found, retrying after short delay...");
	await sleep(LOGIN_ITEM_RETRY_DELAY_MS);
	const retried = await tryConnectBuildChecked(dataDir);
	if (retried) {
		log("INFO", "[DaemonConnector] Connected to daemon (login item)");
		return retried;
	}
	log("INFO", "[DaemonConnector] Spawning new daemon...");
	spawnDaemon(dataDir);
	const client = await waitForDaemon(dataDir, SPAWN_READY_TIMEOUT_MS);
	log("INFO", "[DaemonConnector] Connected to newly spawned daemon");
	return client;
}
var reconnecting = false;
var reconnectSuppressed = false;
var onStateChange = null;
var onClientReplaced = null;
/**
* Whether the daemon was explicitly stopped by the user.
* Used by workspace guards to distinguish intentional stop from transient disconnect.
*/
function isDaemonStopped() {
	return reconnectSuppressed;
}
/**
* Suppress automatic reconnection. Call before explicit daemon stop/restart
* to prevent the reconnect monitor from fighting the intentional disconnect.
*/
function suppressReconnect() {
	reconnectSuppressed = true;
	log("INFO", "[DaemonConnector] Reconnection suppressed");
}
/**
* Re-enable automatic reconnection after explicit stop/restart completes.
*/
function enableReconnect() {
	reconnectSuppressed = false;
	log("INFO", "[DaemonConnector] Reconnection re-enabled");
}
/**
* Register handlers for reconnection lifecycle events.
*
* @param stateHandler — called when connection state changes
* @param clientHandler — called with the new DaemonClient after successful reconnection
*/
function onReconnect(stateHandler, clientHandler) {
	onStateChange = stateHandler;
	onClientReplaced = clientHandler;
}
/**
* Set up disconnect detection on a DaemonClient's transport.
* When the socket closes, begins reconnection with exponential backoff.
*/
function setupDisconnectHandler(client, transport) {
	transport.onDisconnect(() => {
		if (reconnecting || reconnectSuppressed) return;
		reconnecting = true;
		log("WARN", "[DaemonConnector] Daemon disconnected — starting reconnection...");
		onStateChange?.("disconnected");
		broadcastToRenderer("daemon:disconnected");
		reconnectWithBackoff().finally(() => {
			reconnecting = false;
		});
	});
}
async function reconnectWithBackoff() {
	let delay = RECONNECT_INITIAL_MS;
	for (let attempt = 1; attempt <= RECONNECT_MAX_ATTEMPTS; attempt++) {
		if (reconnectSuppressed) {
			log("INFO", "[DaemonConnector] Reconnect loop cancelled (suppressed)");
			return;
		}
		onStateChange?.("reconnecting");
		log("INFO", `[DaemonConnector] Reconnect attempt ${attempt}/${RECONNECT_MAX_ATTEMPTS}...`);
		await sleep(delay);
		if (reconnectSuppressed) {
			log("INFO", "[DaemonConnector] Reconnect loop cancelled after delay (suppressed)");
			return;
		}
		const dataDir = getDataDir();
		let client = null;
		try {
			client = await tryConnectBuildChecked(dataDir);
		} catch (err) {
			if (err instanceof DaemonRestartError) {
				log("ERROR", `[DaemonConnector] ${String(err)}`);
				broadcastToRenderer("daemon:reconnect-failed");
				return;
			}
		}
		if (client) {
			log("INFO", "[DaemonConnector] Reconnected to daemon");
			onStateChange?.("connected");
			onClientReplaced?.(client);
			broadcastToRenderer("daemon:reconnected");
			return;
		}
		delay = Math.min(delay * 2, RECONNECT_MAX_MS);
	}
	if (reconnectSuppressed) {
		log("INFO", "[DaemonConnector] Reconnect spawn cancelled (suppressed)");
		return;
	}
	log("WARN", "[DaemonConnector] All reconnect attempts failed — spawning new daemon...");
	const dataDir = getDataDir();
	spawnDaemon(dataDir);
	try {
		const client = await waitForDaemon(dataDir, SPAWN_READY_TIMEOUT_MS);
		log("INFO", "[DaemonConnector] Connected to newly spawned daemon after reconnect");
		onStateChange?.("connected");
		onClientReplaced?.(client);
		broadcastToRenderer("daemon:reconnected");
	} catch (err) {
		log("ERROR", `[DaemonConnector] Failed to reconnect: ${String(err)}`);
		broadcastToRenderer("daemon:reconnect-failed");
	}
}
function broadcastToRenderer(channel) {
	for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) try {
		win.webContents.send(channel);
	} catch {}
}
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
//#endregion
export { getDataDir as a, setupDisconnectHandler as c, suppressReconnect as d, tailDaemonLog as f, getDaemonEntryPath as i, spawnDaemon as l, enableReconnect as n, isDaemonStopped as o, ensureDaemonRunning as r, onReconnect as s, DaemonRestartError as t, stopTailingDaemonLog as u };

//# sourceMappingURL=daemon-connector-B4Xt49yq.js.map