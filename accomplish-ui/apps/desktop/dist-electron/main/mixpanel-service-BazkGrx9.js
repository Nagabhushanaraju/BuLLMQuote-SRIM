import { n as getBuildConfig } from "./build-config-yaGG3zlR.js";
import { i as getDeviceFingerprint, o as getFirstSeenAt } from "./analytics-service-BFn-2QoE.js";
import { t as buildCommonTrackingFields } from "./tracking-context-DJuro0I1.js";
import Mixpanel from "mixpanel";
//#region src/main/analytics/mixpanel-service.ts
/**
* mixpanel-service.ts — Mixpanel event tracking.
*
* No-ops gracefully when MIXPANEL_TOKEN is not configured (OSS builds).
*
* Ported from accomplish-commercial-fork with:
* - Hardcoded MIXPANEL_TOKEN removed — read from build config
*/
var mixpanelClient = null;
/**
* Initialize Mixpanel client and identify the user.
* Call once after initAnalytics() so getClientId() returns a value.
* No-ops if MIXPANEL_TOKEN is not configured.
*/
function initMixpanel() {
	const token = getBuildConfig().mixpanelToken;
	if (!token) return;
	mixpanelClient = Mixpanel.init(token, { geolocate: true });
	const distinctId = getDeviceFingerprint();
	const common = buildCommonTrackingFields();
	const firstSeen = getFirstSeenAt();
	mixpanelClient.people.set(distinctId, {
		$distinct_id: distinctId,
		$user_id: distinctId,
		$os: common.os_name,
		$created: firstSeen || void 0,
		first_seen_at: firstSeen || void 0,
		ga_client_id: common.ga_client_id,
		app_version: common.app_version,
		first_app_version: common.first_app_version,
		platform: common.platform,
		os_name: common.os_name,
		plan_type: common.plan_type
	});
	console.log("[Mixpanel] Initialized with distinct_id:", distinctId.substring(0, 8) + "...");
}
/**
* Track an event to Mixpanel with the same shape as GA4 events.
* No-ops silently if initMixpanel() hasn't been called yet.
*/
function trackMixpanelEvent(eventName, params = {}) {
	try {
		if (!mixpanelClient) return;
		const common = buildCommonTrackingFields();
		const distinctId = getDeviceFingerprint();
		const properties = {
			distinct_id: distinctId,
			ga_client_id: common.ga_client_id,
			$os: common.os_name,
			$os_version: common.os_version
		};
		for (const [key, value] of Object.entries({
			...params,
			...common
		})) if (value !== void 0) properties[key] = value;
		delete properties.user_id;
		properties.$user_id = distinctId;
		mixpanelClient.track(eventName, properties);
	} catch (error) {
		console.error(`[Mixpanel] Failed to track event "${eventName}":`, error);
	}
}
/**
* Flush pending Mixpanel events (call on app quit).
* The Node SDK sends events immediately per track() call in the default config.
* This function exists for API symmetry with flushAnalytics().
*/
function flushMixpanel() {}
//#endregion
export { initMixpanel as n, trackMixpanelEvent as r, flushMixpanel as t };

//# sourceMappingURL=mixpanel-service-BazkGrx9.js.map