import { t as getLogCollector } from "./logging-ZKSN6tdj.js";
import { B as trackUpdateDownloadComplete, H as trackUpdateFailed, R as trackUpdateAvailable, U as trackUpdateInstallStart, V as trackUpdateDownloadStart, W as trackUpdateNotAvailable, z as trackUpdateCheck } from "./events-6ieLJMcf.js";
import { n as getBuildConfig } from "./build-config-yaGG3zlR.js";
import { app, clipboard, dialog, shell } from "electron";
import path from "path";
import fs from "fs";
import Store from "electron-store";
import http from "http";
import * as Sentry from "@sentry/electron/main";
import https from "https";
import { coerce, gt, valid } from "semver";
import { load } from "js-yaml";
//#region src/main/updater/feed-config.ts
/**
* Feed URL + manifest-name resolution for the auto-updater.
*
* URL comes from build-config (`ACCOMPLISH_UPDATER_URL`, CI-injected in Free builds
* or opt-in via .env in dev). Manifest names are hardcoded per the accomplish-release
* upload contract — do not parameterize.
*
* See: accomplish-release/scripts/upload-r2-{windows,macos,linux}.sh
*/
/**
* Feed URL with trailing slashes trimmed so `${url}/${manifest}` never emits a
* double-slash (some CDNs tolerate it; some don't). Returns '' when not configured.
*/
function getFeedUrl() {
	return getBuildConfig().accomplishUpdaterUrl.replace(/\/+$/, "");
}
/**
* Manifest filenames as published by accomplish-release. DO NOT parameterize —
* the names are fixed by the upload contract (channel is encoded in the URL path
* prefix, not the filename).
*
* - Windows:  always `latest-win.yml`
* - Linux x64: `latest-linux.yml`
* - Linux arm64: `latest-linux-arm64.yml` (electron-updater's arch-suffix convention)
*
* macOS is served by the native electron-updater path, which derives the filename
* internally (`latest-mac.yml` with default `'latest'` channel) — this helper is
* NOT used for mac.
*/
function getManifestName(platform, arch) {
	if (platform === "win") return "latest-win.yml";
	if (arch === "arm64") return "latest-linux-arm64.yml";
	return "latest-linux.yml";
}
//#endregion
//#region src/main/updater/dialogs.ts
/**
* Native dialog wrappers for the auto-updater. All copy is platform-agnostic —
* the "Download the latest installer" wording works for macOS/Windows/Linux users
* regardless of package format (AppImage / deb / dmg / NSIS / extracted tarball).
*/
/**
* "Update Ready" dialog — shown after electron-updater has downloaded a new version
* in the background. Offers to restart now or later.
*/
async function showUpdateReadyDialog(version, quitAndInstall) {
	const { response } = await dialog.showMessageBox({
		type: "info",
		title: "Update Ready",
		message: `Version ${version} has been downloaded.`,
		detail: "The update will be installed when you restart the app. Would you like to restart now?",
		buttons: ["Restart Now", "Later"],
		defaultId: 0,
		cancelId: 1
	});
	if (response === 0) await quitAndInstall();
}
/**
* "No Updates" dialog — shown when a user-initiated check finds nothing new.
* Silent auto-checks never reach this dialog.
*/
async function showNoUpdatesDialog() {
	await dialog.showMessageBox({
		type: "info",
		title: "No Updates",
		message: `You're up to date!`,
		detail: `Accomplish ${app.getVersion()} is the latest version.`,
		buttons: ["OK"]
	});
}
/**
* "Update Check Failed" dialog — shown on fetch failure, manifest parse failure,
* or unparseable version strings during a user-initiated check. Silent checks
* never reach this dialog (error is still tracked).
*/
async function showUpdateCheckFailedDialog() {
	await dialog.showMessageBox({
		type: "error",
		title: "Update Check Failed",
		message: "Could not check for updates",
		detail: "Failed to fetch update information. Please try again later.",
		buttons: ["OK"]
	});
}
/**
* "Update Available" dialog for the manual path (Windows / non-AppImage Linux),
* where the app cannot auto-install. Offers Download / Copy URL / Later.
*/
async function showManualUpdateDialog(currentVersion, newVersion, downloadUrl) {
	const response = await dialog.showMessageBox({
		type: "info",
		title: "Update Available",
		message: `A new version of Accomplish is available!`,
		detail: `Version ${newVersion} is available.\nYou are currently on version ${currentVersion}.\n\nClick "Download" to open the download page in your browser.`,
		buttons: [
			"Download",
			"Copy URL",
			"Later"
		],
		defaultId: 0,
		cancelId: 2
	});
	if (response.response === 0) await shell.openExternal(downloadUrl);
	else if (response.response === 1) clipboard.writeText(downloadUrl);
}
//#endregion
//#region src/main/updater/logger.ts
/**
* Shared logger helper for the updater modules. Matches the pattern used by
* index.ts at the app-lifecycle level — best-effort, `'main'` source, never
* throws. Extracted here so each updater submodule doesn't carry its own copy.
*/
function log(level, msg, data) {
	try {
		getLogCollector()?.log?.(level, "main", msg, data);
	} catch {}
}
//#endregion
//#region src/main/updater/origin.ts
/**
* Origin check for manifest `path:` URLs.
*
* Manifests may carry absolute download URLs (e.g. `https://downloads.accomplish.ai/...`)
* on a different subdomain than the manifest host (`https://d.accomplish.ai/...`), so a
* strict same-origin check is too tight. Instead we accept any URL whose hostname shares
* the feed URL's apex (last two labels) — covers `downloads.accomplish.ai` vs
* `d.accomplish.ai` without accepting `evil.example.com`.
*
* This is defense-in-depth: the release scripts are trusted, but a poisoned manifest
* (cache, misconfig, supply-chain compromise) should not redirect users' browsers to an
* attacker-controlled URL. If you self-host a dev updater, use the same apex for the
* feed URL and the manifest `path:` — or relax this check in a fork.
*
* KNOWN LIMITATION: the last-two-labels heuristic does NOT consult the Public Suffix List,
* so a feed hosted on a multi-part TLD like `foo.co.uk` would treat any `*.co.uk` as
* "same apex" and accept `bar.co.uk` (unrelated customer). Fine for `accomplish.ai`, but
* operators onboarding a `.co.uk` / `.com.br` / `.github.io` feed should replace this
* heuristic with an explicit allowed-download-host policy before shipping.
*/
/** Returns true when both URLs parse, use the same scheme (no HTTP↔HTTPS downgrade),
*  and share the same last-two-labels apex. */
function isSameApex(candidate, reference) {
	let candidateUrl;
	let referenceUrl;
	try {
		candidateUrl = new URL(candidate);
		referenceUrl = new URL(reference);
	} catch {
		return false;
	}
	if (candidateUrl.protocol !== referenceUrl.protocol) return false;
	const candidateHost = candidateUrl.hostname;
	const referenceHost = referenceUrl.hostname;
	if (isIpLiteral(referenceHost) || isIpLiteral(candidateHost)) return candidateHost === referenceHost;
	const apex = getApex(referenceHost);
	return candidateHost === apex || candidateHost.endsWith("." + apex);
}
/** Relative manifest paths are trusted; absolute URLs must pass `isSameApex`. */
function isTrustedManifestPath(candidate, feedUrl) {
	const value = candidate.trim();
	if (!value) return false;
	if (value.startsWith("//")) return false;
	try {
		const url = new URL(value);
		if (url.protocol !== "http:" && url.protocol !== "https:") return false;
		return isSameApex(value, feedUrl);
	} catch {
		return true;
	}
}
/**
* Validate every download URL electron-updater exposes in native UpdateInfo
* before we allow `downloadUpdate()`.
*/
function isTrustedUpdateInfo(info, feedUrl) {
	const candidates = [];
	if (typeof info.path === "string") candidates.push(info.path);
	if (Array.isArray(info.files)) {
		for (const file of info.files) if (file && typeof file === "object") {
			const url = file.url;
			if (typeof url === "string") candidates.push(url);
		}
	}
	return candidates.every((candidate) => isTrustedManifestPath(candidate, feedUrl));
}
function isIpLiteral(host) {
	return host.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}
function getApex(hostname) {
	const labels = hostname.split(".");
	if (labels.length <= 2) return hostname;
	return labels.slice(-2).join(".");
}
//#endregion
//#region src/main/updater/state.ts
var mainWindow = null;
var downloadedVersion = null;
var updateAvailable = null;
var onUpdateDownloadedCallback = null;
var userCheckInFlight = false;
function setMainWindow(window) {
	mainWindow = window;
}
function getMainWindow() {
	return mainWindow;
}
function setDownloadedVersion(v) {
	downloadedVersion = v;
}
function getDownloadedVersion() {
	return downloadedVersion;
}
function setUpdateAvailable(info) {
	updateAvailable = info;
}
function setUserCheckInFlight(v) {
	userCheckInFlight = v;
}
function getUserCheckInFlight() {
	return userCheckInFlight;
}
function setOnUpdateDownloaded(callback) {
	onUpdateDownloadedCallback = callback;
}
function invokeOnUpdateDownloaded() {
	onUpdateDownloadedCallback?.();
}
function getUpdateState() {
	return {
		updateAvailable: !!updateAvailable,
		downloadedVersion,
		availableVersion: updateAvailable?.version ?? null
	};
}
//#endregion
//#region src/main/updater/listeners.ts
/**
* Wire the five electron-updater lifecycle events. Caller passes `quitAndInstall`
* so the update-downloaded dialog's "Restart Now" button can trigger it without
* a circular import.
*/
function registerAutoUpdaterListeners(autoUpdater, quitAndInstall) {
	autoUpdater.on("update-available", (info) => {
		const shouldNotifyUpdateAvailable = getUserCheckInFlight();
		setUserCheckInFlight(false);
		if (!isTrustedUpdateInfo(info, getFeedUrl())) {
			setUpdateAvailable(null);
			log("WARN", "[Updater] Rejected update with untrusted download URL", { version: info.version });
			trackUpdateFailed("invalid_manifest", `Native update manifest contains untrusted download URL for version ${info.version}`);
			if (shouldNotifyUpdateAvailable) showUpdateCheckFailedDialog();
			return;
		}
		setUpdateAvailable(info);
		log("INFO", "[Updater] update-available", { version: info.version });
		trackUpdateAvailable(app.getVersion(), info.version);
		trackUpdateDownloadStart(info.version);
		if (shouldNotifyUpdateAvailable) dialog.showMessageBox({
			type: "info",
			title: "Update Available",
			message: `Version ${info.version} is available.`,
			detail: "Accomplish is downloading the update in the background. You will be prompted to restart when it is ready.",
			buttons: ["OK"]
		});
		autoUpdater.downloadUpdate().catch((error) => {
			log("ERROR", "[Updater] downloadUpdate failed", { err: error.message });
			trackUpdateFailed(error.name || "download_failed", error.message);
		});
	});
	autoUpdater.on("update-not-available", async () => {
		trackUpdateNotAvailable();
		if (!getUserCheckInFlight()) return;
		setUserCheckInFlight(false);
		await dialog.showMessageBox({
			type: "info",
			title: "No Updates",
			message: `You're up to date!`,
			detail: `Accomplish ${app.getVersion()} is the latest version.`,
			buttons: ["OK"]
		});
	});
	autoUpdater.on("download-progress", (progress) => {
		getMainWindow()?.setProgressBar(progress.percent / 100);
	});
	autoUpdater.on("update-downloaded", (info) => {
		log("INFO", "[Updater] update-downloaded", { version: info.version });
		getMainWindow()?.setProgressBar(-1);
		setDownloadedVersion(info.version);
		trackUpdateDownloadComplete(info.version);
		invokeOnUpdateDownloaded();
		showUpdateReadyDialog(info.version, quitAndInstall);
	});
	autoUpdater.on("error", (error) => {
		setUserCheckInFlight(false);
		getMainWindow()?.setProgressBar(-1);
		log("ERROR", "[Updater] error", { err: error.message });
		trackUpdateFailed(error.name || "unknown_error", error.message);
	});
}
//#endregion
//#region src/main/updater/store.ts
/**
* Persistent store for the auto-updater's daily-check throttle. Kept in its own
* module so both the native path (updater/index.ts) and the manual path
* (updater/manual-manifest.ts) can record a successful check without circular
* imports, and so `autoCheckForUpdates()` throttles to once-per-day on every
* platform — not only on macOS / AppImage.
*/
var CHECK_INTERVAL_MS = 1440 * 60 * 1e3;
var store = null;
function getStore() {
	if (!store) store = new Store({
		name: "updater",
		defaults: { lastUpdateCheck: 0 }
	});
	return store;
}
function shouldAutoCheck() {
	const lastCheck = getStore().get("lastUpdateCheck");
	if (!lastCheck) return true;
	return Date.now() - lastCheck > CHECK_INTERVAL_MS;
}
/** Call after a successful check (native OR manual) to reset the daily throttle. */
function recordCheckedNow() {
	getStore().set("lastUpdateCheck", Date.now());
}
//#endregion
//#region src/main/updater/versioning.ts
/**
* Pure version/manifest helpers for the manual update-check path. Kept separate
* from the orchestrator so (a) the per-file LOC cap stays honored and (b) these
* pure functions can be exercised in isolation by unit tests without pulling in
* Electron, Sentry, or network mocks.
*/
/** Returns null on malformed YAML, non-object roots, or missing/wrong-typed version/path fields. */
function parseManifest(raw) {
	let doc;
	try {
		doc = load(raw);
	} catch {
		return null;
	}
	if (!doc || typeof doc !== "object") return null;
	const { version, path: p } = doc;
	if (typeof version !== "string" || typeof p !== "string") return null;
	return {
		version,
		path: p
	};
}
/**
* Coerce a semver-looking string to a canonical version.
*   - `valid()` preserves pre-release qualifiers: "1.2.3-beta.1" stays as-is so
*     release-vs-pre-release ordering is correct.
*   - `coerce()` handles "1.2", "v1.2.3" etc. without throwing.
* Returns null for genuinely uncoerceable strings (including empty); callers
* distinguish this from "no newer version" to track manifest bugs separately.
*/
function normalizeVersion(v) {
	return valid(v) ?? coerce(v)?.version ?? null;
}
//#endregion
//#region src/main/updater/manual-manifest.ts
/**
* Manual update-check orchestrator for platforms without native electron-updater:
*   - Windows (NSIS one-click; native path fetches `latest.yml`, not the
*     `latest-win.yml` our release contract publishes)
*   - Linux without APPIMAGE (deb users, extracted tarballs, distro packages)
*
* Contract: never throws. Every failure path routes through `trackUpdateFailed(...)`
* and (for non-silent checks) a user-visible error dialog. A menu click cannot
* produce an unhandled rejection even if the feed URL is malformed or the
* manifest is corrupt.
*
* Pure helpers live in ./versioning to keep this file focused on the I/O orchestrator.
*/
/**
* GET the manifest body; resolves null on any failure (non-200, network error,
* malformed URL that causes `get()` to throw synchronously). Never throws.
*/
async function fetchManifest(url) {
	return new Promise((resolve) => {
		const get = url.startsWith("http://") ? http.get : https.get;
		let req;
		try {
			req = get(url, (res) => {
				if (res.statusCode !== 200) {
					log("WARN", "[Updater] Manifest fetch non-200", {
						url,
						statusCode: res.statusCode
					});
					resolve(null);
					return;
				}
				let data = "";
				res.on("data", (chunk) => {
					data += chunk;
				});
				res.on("end", () => resolve(data));
			});
		} catch (error) {
			log("ERROR", "[Updater] Manifest fetch threw synchronously", {
				url,
				err: String(error)
			});
			resolve(null);
			return;
		}
		req.on("error", (error) => {
			log("ERROR", "[Updater] Manifest fetch failed", {
				url,
				err: String(error)
			});
			resolve(null);
		});
	});
}
/** Consolidated failure-branch: track + log + optional Sentry + optional dialog. */
async function reportFailure(errorType, detail, silent, sentryPhase) {
	trackUpdateFailed(errorType, detail);
	log("WARN", `[Updater] ${errorType}`, { detail });
	if (sentryPhase) Sentry.captureMessage(`Update check: ${errorType}`, { tags: {
		component: "updater",
		phase: sentryPhase
	} });
	if (!silent) await showUpdateCheckFailedDialog();
}
/**
* User-initiated (silent=false) or startup auto-check (silent=true) path for
* Windows / non-AppImage Linux. Never throws. On success, records the check so
* `shouldAutoCheck()` throttles to once per day across all platforms.
*/
async function checkForUpdatesManual(silent, platform, arch) {
	const feedUrl = getFeedUrl();
	if (!feedUrl) return;
	const manifestUrl = `${feedUrl}/${getManifestName(platform, arch)}`;
	const currentVersion = app.getVersion();
	trackUpdateCheck();
	const raw = await fetchManifest(manifestUrl);
	if (raw === null) {
		await reportFailure("fetch_failed", `Could not fetch ${manifestUrl}`, silent);
		return;
	}
	const info = parseManifest(raw);
	if (!info) {
		await reportFailure("invalid_manifest", `Could not parse ${manifestUrl}`, silent, "parse");
		return;
	}
	const remoteNorm = normalizeVersion(info.version);
	if (!remoteNorm) {
		await reportFailure("invalid_version", `Unparseable remote version: ${info.version}`, silent, "version");
		return;
	}
	const isAbsolute = info.path.startsWith("http://") || info.path.startsWith("https://");
	if (!isTrustedManifestPath(info.path, feedUrl)) {
		await reportFailure("invalid_manifest", `Manifest path origin does not match feed URL: ${info.path}`, silent, "parse");
		return;
	}
	recordCheckedNow();
	const currentNorm = normalizeVersion(currentVersion);
	if (!currentNorm) {
		trackUpdateFailed("invalid_version", `Unparseable local version: ${currentVersion}`);
		return;
	}
	if (!gt(remoteNorm, currentNorm)) {
		trackUpdateNotAvailable();
		if (!silent) await showNoUpdatesDialog();
		return;
	}
	const downloadUrl = isAbsolute ? info.path : `${feedUrl}/${info.path}`;
	trackUpdateAvailable(currentVersion, info.version);
	log("INFO", "[Updater] Manual update available", {
		currentVersion,
		newVersion: info.version,
		downloadUrl
	});
	await showManualUpdateDialog(currentVersion, info.version, downloadUrl);
}
//#endregion
//#region src/main/updater/index.ts
var _autoUpdater = null;
async function lazyAutoUpdater() {
	if (!_autoUpdater) {
		const mod = await import("electron-updater");
		const autoUpdater = (Object.prototype.hasOwnProperty.call(mod, "autoUpdater") ? mod.autoUpdater : void 0) ?? mod.default?.autoUpdater;
		if (!autoUpdater) throw new Error("electron-updater autoUpdater export unavailable");
		_autoUpdater = autoUpdater;
	}
	return _autoUpdater;
}
async function initUpdater(window) {
	setMainWindow(window);
	if (!getFeedUrl()) return;
	if (process.platform === "win32") return;
	if (process.platform === "linux" && !process.env.APPIMAGE) return;
	try {
		const autoUpdater = await lazyAutoUpdater();
		autoUpdater.autoDownload = false;
		autoUpdater.autoInstallOnAppQuit = true;
		if (!app.isPackaged) {
			const appPath = app.getAppPath();
			fs.mkdirSync(appPath, { recursive: true });
			fs.writeFileSync(path.join(appPath, "dev-app-update.yml"), `provider: generic\nurl: ${getFeedUrl()}\n`);
			autoUpdater.forceDevUpdateConfig = true;
		}
		autoUpdater.setFeedURL({
			provider: "generic",
			url: getFeedUrl()
		});
		registerAutoUpdaterListeners(autoUpdater, quitAndInstall);
	} catch (err) {
		Sentry.captureException(err, { tags: {
			component: "updater",
			phase: "init"
		} });
		throw err;
	}
}
async function checkForUpdates(silent) {
	if (!getFeedUrl()) return;
	if (process.platform === "win32") {
		await checkForUpdatesManual(silent, "win");
		return;
	}
	if (process.platform === "linux" && !process.env.APPIMAGE) {
		await checkForUpdatesManual(silent, "linux", process.arch === "arm64" ? "arm64" : "x64");
		return;
	}
	try {
		setUserCheckInFlight(!silent);
		trackUpdateCheck();
		const result = await (await lazyAutoUpdater()).checkForUpdates();
		if (result?.updateInfo && !isTrustedUpdateInfo(result.updateInfo, getFeedUrl())) return;
		recordCheckedNow();
	} catch (err) {
		setUserCheckInFlight(false);
		const message = err instanceof Error ? err.message : String(err);
		if (!silent) dialog.showErrorBox("Update Check Failed", message);
		log("ERROR", "[Updater] checkForUpdates failed", { err: message });
		trackUpdateFailed("check_failed", message);
		Sentry.captureException(err, { tags: {
			component: "updater",
			phase: "check"
		} });
	}
}
async function quitAndInstall() {
	trackUpdateInstallStart(getDownloadedVersion() ?? "");
	(await lazyAutoUpdater()).quitAndInstall(false, true);
}
function autoCheckForUpdates() {
	if (!getFeedUrl()) return;
	if (!shouldAutoCheck()) return;
	checkForUpdates(true);
}
//#endregion
export { shouldAutoCheck as a, quitAndInstall as i, checkForUpdates as n, getUpdateState as o, initUpdater as r, setOnUpdateDownloaded as s, autoCheckForUpdates as t };

//# sourceMappingURL=updater-Cp6vRK5l.js.map