import { i as quitAndInstall, n as checkForUpdates, o as getUpdateState, s as setOnUpdateDownloaded } from "./updater-Cp6vRK5l.js";
import { Menu, app, dialog, shell } from "electron";
//#region src/main/menu.ts
/**
* Application menu. Installed only when the auto-updater is enabled (see
* app-startup.ts — `initMenu()` runs after a successful `initUpdater()`).
*
* The menu exposes "Check for Updates…" (or "Restart to Update (vX.X.X)…" once
* electron-updater has downloaded a new version). On macOS the updater item sits
* under the app menu next to About; on Windows/Linux it sits at the top of Help.
*
* OSS builds never install this menu — Electron's default menu stays in place.
*/
function buildAppMenu() {
	const isMac = process.platform === "darwin";
	const { updateAvailable, downloadedVersion } = getUpdateState();
	const updateMenuItem = updateAvailable && downloadedVersion ? {
		label: `Restart to Update (v${downloadedVersion})...`,
		click: () => {
			quitAndInstall();
		}
	} : {
		label: "Check for Updates...",
		click: () => {
			checkForUpdates(false);
		}
	};
	const template = [
		...isMac ? [{
			label: app.name,
			submenu: [
				{ role: "about" },
				{ type: "separator" },
				updateMenuItem,
				{ type: "separator" },
				{ role: "services" },
				{ type: "separator" },
				{ role: "hide" },
				{ role: "hideOthers" },
				{ role: "unhide" },
				{ type: "separator" },
				{ role: "quit" }
			]
		}] : [],
		{
			label: "Edit",
			submenu: [
				{ role: "undo" },
				{ role: "redo" },
				{ type: "separator" },
				{ role: "cut" },
				{ role: "copy" },
				{ role: "paste" },
				{ role: "selectAll" }
			]
		},
		{
			label: "View",
			submenu: [
				{ role: "reload" },
				{ role: "forceReload" },
				{ role: "toggleDevTools" },
				{ type: "separator" },
				{ role: "resetZoom" },
				{ role: "zoomIn" },
				{ role: "zoomOut" },
				{ type: "separator" },
				{ role: "togglefullscreen" }
			]
		},
		{
			label: "Window",
			submenu: [
				{ role: "minimize" },
				{ role: "zoom" },
				...isMac ? [{ type: "separator" }, { role: "front" }] : [{ role: "close" }]
			]
		},
		{
			label: "Help",
			submenu: [
				...!isMac ? [updateMenuItem, { type: "separator" }] : [],
				{
					label: "Learn More",
					click: () => shell.openExternal("https://accomplish.ai")
				},
				...!isMac ? [{ type: "separator" }, {
					label: "About Accomplish",
					click: async () => {
						await dialog.showMessageBox({
							type: "info",
							title: "About Accomplish",
							message: "Accomplish",
							detail: `Version ${app.getVersion()}\n\nA desktop automation assistant.\n\n© ${(/* @__PURE__ */ new Date()).getFullYear()} Accomplish AI`,
							buttons: ["OK"]
						});
					}
				}] : []
			]
		}
	];
	Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
function refreshAppMenu() {
	buildAppMenu();
}
function initMenu() {
	buildAppMenu();
	setOnUpdateDownloaded(() => refreshAppMenu());
}
//#endregion
export { initMenu };

//# sourceMappingURL=menu-B40h0ZBb.js.map