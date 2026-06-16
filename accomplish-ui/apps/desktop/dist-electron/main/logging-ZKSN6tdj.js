import { t as createLogWriter } from "./desktop-main-CXudHk3S.js";
import { app } from "electron";
import path from "path";
//#region src/main/logging/log-file-writer.ts
/**
* Electron-specific LogFileWriter wrapper.
*
* This thin wrapper injects the Electron app's userData path into the
* platform-agnostic LogFileWriter from @accomplish/core.
*/
var instance$1 = null;
function getLogFileWriter() {
	if (!instance$1) {
		const userDataPath = app.getPath("userData");
		instance$1 = createLogWriter({ logDir: path.join(userDataPath, "logs") });
	}
	return instance$1;
}
function shutdownLogFileWriter() {
	if (instance$1) {
		instance$1.shutdown();
		instance$1 = null;
	}
}
//#endregion
//#region src/main/logging/log-collector.ts
var instance = null;
function getLogCollector() {
	if (!instance) instance = getLogFileWriter();
	return instance;
}
function initializeLogCollector() {
	getLogCollector().initialize();
}
function shutdownLogCollector() {
	if (instance) {
		instance.shutdown();
		instance = null;
	}
	shutdownLogFileWriter();
}
//#endregion
export { initializeLogCollector as n, shutdownLogCollector as r, getLogCollector as t };

//# sourceMappingURL=logging-ZKSN6tdj.js.map