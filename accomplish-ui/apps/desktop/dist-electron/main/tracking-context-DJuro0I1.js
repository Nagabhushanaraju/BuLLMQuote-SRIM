import { t as getAppTier } from "./build-config-yaGG3zlR.js";
import { a as getFirstLaunchVersion, i as getDeviceFingerprint, n as getAnalyticsSessionId, o as getFirstSeenAt, r as getClientId } from "./analytics-service-BFn-2QoE.js";
import { app, session } from "electron";
import * as os from "os";
//#region src/main/utils/tracking-context.ts
/**
* tracking-context.ts — Common tracking fields shared between GA4 and Mixpanel.
*
* Ported from accomplish-commercial-fork with enterprise code removed:
* - __APP_TIER__ replaced with getAppTier() from build-config
* - org_id and user_role hardcoded to defaults (no enterprise identity)
*/
var _electronUserAgent = null;
function getElectronUserAgent() {
	if (_electronUserAgent === null) _electronUserAgent = session.defaultSession.getUserAgent();
	return _electronUserAgent;
}
var _browserUserAgent = null;
function getReadableOsName() {
	switch (process.platform) {
		case "darwin": return "macOS";
		case "win32": return "Windows";
		case "linux": return "Linux";
		default: return process.platform;
	}
}
/**
* Common tracking fields shared between trace steps and GA events.
*/
function buildCommonTrackingFields() {
	return {
		platform: process.platform,
		app_version: app.getVersion(),
		ga_session_id: getAnalyticsSessionId(),
		environment: app.isPackaged ? "production" : "dev",
		user_id: getDeviceFingerprint(),
		ga_client_id: getClientId(),
		arch: process.arch,
		os_name: getReadableOsName(),
		os_version: os.release(),
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		plan_type: getAppTier(),
		deployment_type: "saas",
		org_id: "none",
		user_role: "user",
		electron_user_agent: getElectronUserAgent(),
		browser_user_agent: _browserUserAgent || void 0,
		first_launched_at: getFirstSeenAt(),
		first_app_version: getFirstLaunchVersion()
	};
}
//#endregion
export { buildCommonTrackingFields as t };

//# sourceMappingURL=tracking-context-DJuro0I1.js.map