import { n as getBuildConfig } from "./build-config-yaGG3zlR.js";
import { app, net } from "electron";
import fs from "fs";
import { createHash, randomUUID } from "crypto";
import { execSync } from "child_process";
import Store from "electron-store";
//#region src/main/identity/device-fingerprint.ts
/**
* device-fingerprint.ts — Generates a stable device identifier for gateway auth.
*
* Produces a 32-char hex string by SHA-256 hashing a platform-specific machine UUID.
* Same hardware → same fingerprint across restarts and reinstalls.
*
* Placed in identity/ (not analytics/) because this is used for gateway DPoP
* identity binding, not for product analytics.
*/
function getMacUUID() {
	try {
		return execSync("ioreg -rd1 -c IOPlatformExpertDevice", {
			encoding: "utf8",
			timeout: 5e3
		}).match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/)?.[1] ?? null;
	} catch {
		return null;
	}
}
function getWindowsGuid() {
	try {
		return execSync("powershell -NoProfile -Command \"(Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -Name MachineGuid).MachineGuid\"", {
			encoding: "utf8",
			timeout: 5e3
		}).trim() || null;
	} catch {
		return null;
	}
}
function getLinuxMachineId() {
	try {
		return fs.readFileSync("/etc/machine-id", "utf8").trim() || null;
	} catch {
		try {
			return fs.readFileSync("/var/lib/dbus/machine-id", "utf8").trim() || null;
		} catch {
			return null;
		}
	}
}
function getRawMachineUUID() {
	switch (process.platform) {
		case "darwin": return getMacUUID();
		case "win32": return getWindowsGuid();
		case "linux": return getLinuxMachineId();
		default: return null;
	}
}
function computeDeviceFingerprint() {
	const uuid = getRawMachineUUID();
	if (!uuid) return null;
	return createHash("sha256").update(uuid).digest("hex").substring(0, 32);
}
//#endregion
//#region src/main/analytics/analytics-service.ts
/**
* analytics-service.ts — GA4 Measurement Protocol analytics + device fingerprint caching.
*
* No-ops gracefully when GA4 is not configured (OSS builds).
* Also manages client ID, session ID, and device fingerprint state used by
* both GA4 and Mixpanel (initialized independently of either sink).
*
* Ported from accomplish-commercial-fork with:
* - Hardcoded GA_MEASUREMENT_ID removed — read from build config
* - Hardcoded GA_API_SECRET removed — read from build config
* - __APP_TIER__ removed — uses getAppTier() from build-config
* - Device fingerprint uses identity/device-fingerprint.ts (not analytics/)
*/
function getGaMeasurementId() {
	return getBuildConfig().gaMeasurementId;
}
function getGaApiSecret() {
	return getBuildConfig().gaApiSecret;
}
function isDebugMode() {
	return process.env.GA_DEBUG_MODE === "1" || process.env.GA_DEBUG_MODE === "true";
}
function getEndpoint() {
	return `https://www.google-analytics.com/mp/collect?measurement_id=${getGaMeasurementId()}&api_secret=${getGaApiSecret()}`;
}
var _analyticsStore = null;
function getAnalyticsStore() {
	if (!_analyticsStore) _analyticsStore = new Store({
		name: "analytics",
		defaults: {
			clientId: "",
			deviceFingerprint: "",
			firstSeenAt: "",
			firstLaunchVersion: "",
			firstTaskCompleted: false
		}
	});
	return _analyticsStore;
}
var sessionId = "";
var numericSessionId = 0;
var sessionStartTime = 0;
var sessionTaskCount = 0;
var eventQueue = [];
var isOnline = true;
/**
* Initialize core analytics state: client ID, session IDs, fingerprint cache.
* Call once at startup when any analytics/Sentry feature is enabled.
* Does NOT depend on GA4 or Mixpanel being configured — initializes shared state.
*/
function initAnalytics() {
	let clientId = getAnalyticsStore().get("clientId");
	const isFirstLaunch = !clientId;
	if (!clientId) {
		clientId = randomUUID();
		getAnalyticsStore().set("clientId", clientId);
		getAnalyticsStore().set("firstSeenAt", (/* @__PURE__ */ new Date()).toISOString());
		getAnalyticsStore().set("firstLaunchVersion", app.getVersion());
	}
	if (!getAnalyticsStore().get("firstLaunchVersion")) getAnalyticsStore().set("firstLaunchVersion", app.getVersion());
	sessionId = randomUUID();
	numericSessionId = Date.now();
	sessionStartTime = Date.now();
	sessionTaskCount = 0;
	console.log("[Analytics] Initialized with client ID:", clientId.substring(0, 8) + "...");
	console.log("[Analytics] Session ID:", sessionId.substring(0, 8) + "...");
	console.log("[Analytics] Environment:", app.isPackaged ? "production" : "dev");
	if (isDebugMode()) console.log("[Analytics] Debug mode enabled — events sent to GA4 DebugView");
	return { isFirstLaunch };
}
/**
* Compute and cache the device fingerprint.
* Call once after initAnalytics() during startup.
*/
function initDeviceFingerprint() {
	const cached = getAnalyticsStore().get("deviceFingerprint");
	if (cached) {
		console.log("[Analytics] Device fingerprint loaded from cache:", cached.substring(0, 8) + "...");
		return;
	}
	const fingerprint = computeDeviceFingerprint();
	if (fingerprint) {
		getAnalyticsStore().set("deviceFingerprint", fingerprint);
		console.log("[Analytics] Device fingerprint computed:", fingerprint.substring(0, 8) + "...");
	} else console.warn("[Analytics] Device fingerprint computation failed, will fall back to clientId");
}
function getDeviceFingerprint() {
	return getAnalyticsStore().get("deviceFingerprint") || getAnalyticsStore().get("clientId");
}
function getClientId() {
	return getAnalyticsStore().get("clientId");
}
function getAnalyticsSessionId() {
	return sessionId;
}
function getFirstSeenAt() {
	return getAnalyticsStore().get("firstSeenAt") || "";
}
function getFirstLaunchVersion() {
	return getAnalyticsStore().get("firstLaunchVersion") || "";
}
function isFirstTaskCompleted() {
	return getAnalyticsStore().get("firstTaskCompleted");
}
function markFirstTaskCompleted() {
	getAnalyticsStore().set("firstTaskCompleted", true);
}
function incrementTaskCount() {
	sessionTaskCount++;
}
function getSessionTaskCount() {
	return sessionTaskCount;
}
function getSessionDuration() {
	return Math.floor((Date.now() - sessionStartTime) / 1e3);
}
function isGA4Configured() {
	return !!(getAnalyticsStore().get("clientId") && getGaApiSecret() && getGaMeasurementId());
}
var _buildCommonTrackingFields = null;
async function getMetadata() {
	if (!_buildCommonTrackingFields) _buildCommonTrackingFields = (await import("./tracking-context-FlP0bD2N.js")).buildCommonTrackingFields;
	const { ga_session_id: _sessionUuid, ga_client_id: _clientId, first_launched_at: _firstLaunched, ...common } = _buildCommonTrackingFields();
	return {
		...common,
		session_id: numericSessionId,
		trace_session_id: sessionId,
		engagement_time_msec: 100
	};
}
async function sendToGA4(events) {
	const clientId = getAnalyticsStore().get("clientId");
	if (!clientId) {
		console.warn("[Analytics] No client ID, skipping send");
		return false;
	}
	if (!getGaApiSecret()) {
		console.warn("[Analytics] No API secret configured, skipping send");
		return false;
	}
	const payload = {
		client_id: clientId,
		user_properties: { first_seen_at: { value: getAnalyticsStore().get("firstSeenAt") || "" } },
		events
	};
	try {
		const jsonBody = JSON.stringify(payload);
		const response = await net.fetch(getEndpoint(), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: jsonBody
		});
		if (!response.ok) {
			console.error("[Analytics] GA4 request failed:", response.status, response.statusText);
			return false;
		}
		return true;
	} catch (error) {
		console.error("[Analytics] Failed to send events:", error);
		return false;
	}
}
/**
* Track an analytics event to GA4 (and Mixpanel via trackMixpanelEvent).
*/
async function trackEvent(eventName, params = {}) {
	try {
		try {
			const { trackMixpanelEvent } = await import("./mixpanel-service-D10eDVgD.js");
			trackMixpanelEvent(eventName, params);
		} catch {}
		if (!isGA4Configured()) return;
		const metadata = await getMetadata();
		const event = {
			name: eventName,
			params: {
				...params,
				...metadata,
				...isDebugMode() ? { debug_mode: true } : {}
			}
		};
		if (!isOnline) {
			eventQueue.push(event);
			console.log(`[Analytics] Queued event (offline): ${eventName}`);
			return;
		}
		if (!await sendToGA4([event])) {
			eventQueue.push(event);
			console.log(`[Analytics] Queued event (send failed): ${eventName}`);
		} else console.log(`[Analytics] Sent event: ${eventName}`);
	} catch (error) {
		console.error(`[Analytics] Failed to track event "${eventName}":`, error);
	}
}
/**
* Flush any pending GA4 events (call on app quit — best effort).
*/
function flushAnalytics() {
	if (eventQueue.length > 0) {
		console.log(`[Analytics] Attempting to flush ${eventQueue.length} events on quit`);
		sendToGA4([...eventQueue]).catch((err) => {
			console.error("[Analytics] Failed to flush on quit:", err);
		});
	}
}
//#endregion
export { getFirstLaunchVersion as a, getSessionTaskCount as c, initDeviceFingerprint as d, isFirstTaskCompleted as f, computeDeviceFingerprint as h, getDeviceFingerprint as i, incrementTaskCount as l, trackEvent as m, getAnalyticsSessionId as n, getFirstSeenAt as o, markFirstTaskCompleted as p, getClientId as r, getSessionDuration as s, flushAnalytics as t, initAnalytics as u };

//# sourceMappingURL=analytics-service-BFn-2QoE.js.map