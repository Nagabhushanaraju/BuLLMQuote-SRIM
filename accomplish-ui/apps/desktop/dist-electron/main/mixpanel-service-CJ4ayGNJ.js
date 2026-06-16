import { n as e } from "./build-config-bo7E3mNy.js";
import { i as t, o as n } from "./analytics-service-UJ3ooobv.js";
import { t as r } from "./tracking-context-LHFreLae.js";
import i from "mixpanel";
//#region src/main/analytics/mixpanel-service.ts
var a = null;
function o() {
	let o = e().mixpanelToken;
	if (!o) return;
	a = i.init(o, { geolocate: !0 });
	let s = t(), c = r(), l = n();
	a.people.set(s, {
		$distinct_id: s,
		$user_id: s,
		$os: c.os_name,
		$created: l || void 0,
		first_seen_at: l || void 0,
		ga_client_id: c.ga_client_id,
		app_version: c.app_version,
		first_app_version: c.first_app_version,
		platform: c.platform,
		os_name: c.os_name,
		plan_type: c.plan_type
	}), console.log("[Mixpanel] Initialized with distinct_id:", s.substring(0, 8) + "...");
}
function s(e, n = {}) {
	try {
		if (!a) return;
		let i = r(), o = t(), s = {
			distinct_id: o,
			ga_client_id: i.ga_client_id,
			$os: i.os_name,
			$os_version: i.os_version
		};
		for (let [e, t] of Object.entries({
			...n,
			...i
		})) t !== void 0 && (s[e] = t);
		delete s.user_id, s.$user_id = o, a.track(e, s);
	} catch (t) {
		console.error(`[Mixpanel] Failed to track event "${e}":`, t);
	}
}
function c() {}
//#endregion
export { o as n, s as r, c as t };

//# sourceMappingURL=mixpanel-service-CJ4ayGNJ.js.map