import { t as e } from "./build-config-bo7E3mNy.js";
import { a as t, i as n, n as r, o as i, r as a } from "./analytics-service-UJ3ooobv.js";
import { app as o, session as s } from "electron";
import * as c from "os";
//#region src/main/utils/tracking-context.ts
var l = null;
function u() {
	return l === null && (l = s.defaultSession.getUserAgent()), l;
}
var d = null;
function f() {
	switch (process.platform) {
		case "darwin": return "macOS";
		case "win32": return "Windows";
		case "linux": return "Linux";
		default: return process.platform;
	}
}
function p() {
	return {
		platform: process.platform,
		app_version: o.getVersion(),
		ga_session_id: r(),
		environment: o.isPackaged ? "production" : "dev",
		user_id: n(),
		ga_client_id: a(),
		arch: process.arch,
		os_name: f(),
		os_version: c.release(),
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		plan_type: e(),
		deployment_type: "saas",
		org_id: "none",
		user_role: "user",
		electron_user_agent: u(),
		browser_user_agent: d || void 0,
		first_launched_at: i(),
		first_app_version: t()
	};
}
//#endregion
export { p as t };

//# sourceMappingURL=tracking-context-LHFreLae.js.map