import { i as e, n as t, o as n, s as r } from "./updater-DdLmf4tz.js";
import { Menu as i, app as a, dialog as o, shell as s } from "electron";
//#region src/main/menu.ts
function c() {
	let r = process.platform === "darwin", { updateAvailable: c, downloadedVersion: l } = n(), u = c && l ? {
		label: `Restart to Update (v${l})...`,
		click: () => {
			e();
		}
	} : {
		label: "Check for Updates...",
		click: () => {
			t(!1);
		}
	}, d = [
		...r ? [{
			label: a.name,
			submenu: [
				{ role: "about" },
				{ type: "separator" },
				u,
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
				...r ? [{ type: "separator" }, { role: "front" }] : [{ role: "close" }]
			]
		},
		{
			label: "Help",
			submenu: [
				...r ? [] : [u, { type: "separator" }],
				{
					label: "Learn More",
					click: () => s.openExternal("https://accomplish.ai")
				},
				...r ? [] : [{ type: "separator" }, {
					label: "About Accomplish",
					click: async () => {
						await o.showMessageBox({
							type: "info",
							title: "About Accomplish",
							message: "Accomplish",
							detail: `Version ${a.getVersion()}\n\nA desktop automation assistant.\n\n© ${(/* @__PURE__ */ new Date()).getFullYear()} Accomplish AI`,
							buttons: ["OK"]
						});
					}
				}]
			]
		}
	];
	i.setApplicationMenu(i.buildFromTemplate(d));
}
function l() {
	c();
}
function u() {
	c(), r(() => l());
}
//#endregion
export { u as initMenu };

//# sourceMappingURL=menu-B2mVYGNd.js.map