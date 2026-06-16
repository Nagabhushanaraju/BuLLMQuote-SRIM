import { t as e } from "./desktop-main-BR3V7oXg.js";
import { app as t } from "electron";
import n from "path";
//#region src/main/logging/log-file-writer.ts
var r = null;
function i() {
	if (!r) {
		let i = t.getPath("userData");
		r = e({ logDir: n.join(i, "logs") });
	}
	return r;
}
function a() {
	r &&= (r.shutdown(), null);
}
//#endregion
//#region src/main/logging/log-collector.ts
var o = null;
function s() {
	return o ||= i(), o;
}
function c() {
	s().initialize();
}
function l() {
	o &&= (o.shutdown(), null), a();
}
//#endregion
export { c as n, l as r, s as t };

//# sourceMappingURL=logging-CWK-J2W5.js.map