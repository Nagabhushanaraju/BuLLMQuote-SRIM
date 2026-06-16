import { parse as e } from "dotenv";
import { app as t } from "electron";
import n from "path";
import r from "fs";
import { execSync as i } from "child_process";
import { z as a } from "zod";
//#region src/main/config/build-config.ts
var o = a.object({
	buildEnvVersion: a.string().default(""),
	mixpanelToken: a.string().default(""),
	gaApiSecret: a.string().default(""),
	gaMeasurementId: a.string().default(""),
	sentryDsn: a.string().default(""),
	accomplishGatewayUrl: a.string().default(""),
	buildId: a.string().default(""),
	accomplishUpdaterUrl: a.string().default("")
}), s = null;
function c(...e) {
	for (let t of e) if (t && t.length > 0) return t;
	return "";
}
function l() {
	if (s) return s;
	let i = t.isPackaged ? n.join(process.resourcesPath, "build.env") : n.join(process.env.APP_ROOT || "", "build.env"), a = {}, l = !1;
	try {
		a = e(r.readFileSync(i, "utf8")), l = !0;
	} catch {}
	let u = o.safeParse({
		buildEnvVersion: c(a.BUILD_ENV_VERSION, process.env.BUILD_ENV_VERSION),
		mixpanelToken: c(a.MIXPANEL_TOKEN, process.env.MIXPANEL_TOKEN),
		gaApiSecret: c(a.GA_API_SECRET, process.env.GA_API_SECRET),
		gaMeasurementId: c(a.GA_MEASUREMENT_ID, process.env.GA_MEASUREMENT_ID),
		sentryDsn: c(a.SENTRY_DSN, process.env.SENTRY_DSN),
		accomplishGatewayUrl: c(a.ACCOMPLISH_GATEWAY_URL, process.env.ACCOMPLISH_GATEWAY_URL),
		buildId: c(a.ACCOMPLISH_BUILD_ID, process.env.ACCOMPLISH_BUILD_ID),
		accomplishUpdaterUrl: c(a.ACCOMPLISH_UPDATER_URL, t.isPackaged ? void 0 : process.env.ACCOMPLISH_UPDATER_URL)
	});
	if (u.success ? s = u.data : (console.warn("[BuildConfig] Validation failed, using empty defaults:", u.error.message), s = o.parse({})), s.buildEnvVersion) {
		let e = l && a.BUILD_ENV_VERSION ? "build.env" : "process.env";
		console.log(`[BuildConfig] Loaded build config (buildEnvVersion=${s.buildEnvVersion}, source=${e})`);
	} else s.mixpanelToken || s.gaApiSecret || s.sentryDsn || s.accomplishGatewayUrl || s.accomplishUpdaterUrl ? console.log("[BuildConfig] Loaded build config from process.env (dev / custom fallback)") : console.log("[BuildConfig] No build.env or env vars found — running in OSS mode");
	return s;
}
function u() {
	return s || l();
}
function d() {
	return !!u().accomplishGatewayUrl;
}
function f() {
	return !!u().accomplishUpdaterUrl;
}
function p() {
	let e = u();
	return !!(e.mixpanelToken || e.gaApiSecret || e.sentryDsn);
}
function m() {
	return u().buildEnvVersion ? "lite" : "oss";
}
var h = null;
function g() {
	if (h) return h;
	let e = u().buildId;
	if (e) return h = e, h;
	try {
		return h = i("git rev-parse --short HEAD", {
			encoding: "utf8",
			stdio: "pipe"
		}).trim(), h;
	} catch {}
	return h = t.getVersion(), h;
}
//#endregion
export { f as a, p as i, u as n, d as o, g as r, l as s, m as t };

//# sourceMappingURL=build-config-bo7E3mNy.js.map