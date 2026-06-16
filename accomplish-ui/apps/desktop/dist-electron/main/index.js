import { A as e, C as t, D as n, E as r, F as i, G as a, H as o, I as s, J as c, K as l, L as u, M as d, N as ee, O as te, P as ne, Q as f, R as re, W as ie, X as p, ct as ae, dt as oe, et as se, ft as ce, gt as le, ht as ue, j as de, lt as fe, mt as pe, n as me, nt as he, ot as ge, pt as _e, q as ve, rt as ye, tt as be, ut as xe } from "./id-CqFLcoJO.js";
import { n as Se } from "./desktop-main-BR3V7oXg.js";
import { n as Ce, t as m } from "./logging-CWK-J2W5.js";
import { $ as h, A as we, C as Te, D as Ee, E as De, F as Oe, G as ke, I as Ae, J as je, L as Me, M as Ne, N as Pe, O as Fe, P as Ie, Q as Le, S as Re, T as ze, X as g, Y as Be, Z as Ve, _ as He, a as Ue, b as We, c as Ge, d as Ke, et as _, f as qe, g as Je, h as Ye, i as Xe, j as Ze, k as Qe, l as $e, m as et, n as tt, o as nt, p as rt, r as it, s as at, t as ot, u as st, v as ct, w as lt, x as ut, y as dt } from "./events-I4bj9Pyf.js";
import { a as ft, i as pt, n as mt, r as ht, s as gt, t as _t } from "./build-config-bo7E3mNy.js";
import { d as vt, h as yt, m as bt, u as xt } from "./analytics-service-UJ3ooobv.js";
import { o as St, r as v } from "./daemon-connector-D2tzq5ua.js";
import { n as Ct, t as wt } from "./daemon-bootstrap-DTBTKBYO.js";
import { a as Tt, c as Et, i as y, l as Dt, n as Ot, o as kt, r as At, u as jt } from "./workspaceManager-I3zXqCQM.js";
import { S as Mt, _ as Nt, a as Pt, b as Ft, c as It, d as Lt, f as b, g as Rt, h as zt, i as Bt, l as Vt, m as Ht, n as Ut, o as Wt, p as Gt, r as Kt, s as qt, u as Jt, v as Yt, x as Xt, y as Zt } from "./app-shutdown-guKpCw4Q.js";
import { i as x, n as Qt, r as $t, t as en } from "./mock-task-flow-Dhf1Zwyv.js";
import { n as tn, t as S } from "./connector-d96BtNbD.js";
import { n as nn } from "./mixpanel-service-CJ4ayGNJ.js";
import { config as rn } from "dotenv";
import { BrowserWindow as C, Menu as an, app as w, dialog as T, ipcMain as E, nativeImage as on, nativeTheme as D, shell as O } from "electron";
import k from "path";
import A from "fs";
import { fileURLToPath as sn } from "url";
import j from "crypto";
import { execFile as cn } from "child_process";
import { promisify as ln } from "util";
import * as M from "@sentry/electron/main";
//#region src/main/store/legacyMigration.ts
function un() {
	let e = w.getPath("appData"), t = w.isPackaged;
	return [
		{ path: k.join(e, "Accomplish") },
		{ path: k.join(e, "accomplish") },
		{
			path: k.join(e, "Openwork"),
			dbName: t ? "openwork.db" : "openwork-dev.db"
		},
		{
			path: k.join(e, "openwork"),
			dbName: t ? "openwork.db" : "openwork-dev.db"
		},
		{
			path: k.join(e, "@accomplish", "desktop-v2"),
			dbName: t ? "openwork.db" : "openwork-dev.db"
		}
	];
}
var N = w.isPackaged ? "accomplish.db" : "accomplish-dev.db", dn = w.isPackaged ? "secure-storage.json" : "secure-storage-dev.json";
function fn(e) {
	let t = e || N;
	return [
		{
			src: t,
			dest: N
		},
		{
			src: `${t}-wal`,
			dest: `${N}-wal`
		},
		{
			src: `${t}-shm`,
			dest: `${N}-shm`
		},
		{
			src: dn,
			dest: dn
		}
	];
}
function pn() {
	try {
		let e = w.getPath("userData"), t = k.join(e, N);
		if (A.existsSync(t)) return console.log("[Migration] Current userData already has data, skipping migration"), !1;
		for (let t of ["openwork.db", "openwork-dev.db"]) {
			let n = k.join(e, t);
			if (A.existsSync(n)) {
				console.log(`[Migration] Found legacy database name in current userData path: ${t}`);
				let n = fn(t), r = 0;
				for (let t of n) {
					let n = k.join(e, t.src), i = k.join(e, t.dest);
					if (t.src !== t.dest) try {
						A.existsSync(n) && (A.copyFileSync(n, i), console.log(`[Migration] Copied: ${t.src} -> ${t.dest}`), r++);
					} catch (e) {
						console.error(`[Migration] Failed to copy ${t.src}:`, e);
					}
				}
				if (r > 0) return console.log(`[Migration] In-place migration complete. Copied ${r} files.`), !0;
			}
		}
		let n;
		try {
			n = un();
		} catch (e) {
			return console.error("[Migration] Failed to get legacy paths:", e), !1;
		}
		for (let t of n) try {
			if (!A.existsSync(t.path)) continue;
			let n = t.dbName || N, r = k.join(t.path, n);
			if (!A.existsSync(r)) continue;
			console.log(`[Migration] Found legacy data at: ${t.path}`);
			try {
				A.existsSync(e) || (A.mkdirSync(e, { recursive: !0 }), console.log(`[Migration] Created userData directory: ${e}`));
			} catch (e) {
				return console.error("[Migration] Failed to create userData directory:", e), !1;
			}
			let i = fn(t.dbName), a = 0;
			for (let n of i) {
				let r = k.join(t.path, n.src), i = k.join(e, n.dest);
				try {
					A.existsSync(r) && (A.copyFileSync(r, i), console.log(`[Migration] Copied: ${n.src} -> ${n.dest}`), a++);
				} catch (e) {
					console.error(`[Migration] Failed to copy ${n.src}:`, e);
				}
			}
			return console.log(`[Migration] Migration complete. Copied ${a} files.`), console.log(`[Migration] Original data preserved at: ${t.path}`), a > 0;
		} catch (e) {
			console.error(`[Migration] Error processing legacy path ${t.path}:`, e);
		}
		return console.log("[Migration] No legacy data found to migrate"), !1;
	} catch (e) {
		return console.error("[Migration] Unexpected error during migration:", e), !1;
	}
}
//#endregion
//#region src/main/store/storage.ts
function mn() {
	let e = w.getPath("userData"), t = w.isPackaged ? "" : "-dev";
	return {
		appSettingsPath: k.join(e, `app-settings${t}.json`),
		providerSettingsPath: k.join(e, `provider-settings${t}.json`),
		taskHistoryPath: k.join(e, `task-history${t}.json`)
	};
}
var P = new class {
	cachedUserSkillsPath = null;
	async getUserSkillsPath() {
		return this.cachedUserSkillsPath ||= await _().call("skills.getUserSkillsPath"), this.cachedUserSkillsPath;
	}
	async initialize() {}
	async resync() {
		return _().call("skills.resync");
	}
	async getAll() {
		return _().call("skills.list");
	}
	async getEnabled() {
		return _().call("skills.listEnabled");
	}
	async setEnabled(e, t) {
		await _().call("skills.setEnabled", {
			skillId: e,
			enabled: t
		});
	}
	async getContent(e) {
		return _().call("skills.getContent", { skillId: e });
	}
	async addFromFile(e) {
		return _().call("skills.addFromPath", { sourcePath: e });
	}
	async addFromFolder(e) {
		return _().call("skills.addFromPath", { sourcePath: e });
	}
	async addFromGitHub(e) {
		return _().call("skills.addFromPath", { sourcePath: e });
	}
	async delete(e) {
		await _().call("skills.delete", { skillId: e });
	}
}();
//#endregion
//#region src/main/ipc/validation.ts
function F(e) {
	return e instanceof Error ? e : Error(typeof e == "string" ? e : "Unknown IPC error");
}
//#endregion
//#region src/main/ipc/handlers/utils.ts
var I = 15e3;
function L(e) {
	if (!e || e.isDestroyed()) throw Error("Untrusted window");
	let t = C.getFocusedWindow();
	if (C.getAllWindows().length > 1 && t && t.id !== e.id) throw Error("IPC request must originate from the focused window");
	return e;
}
function hn() {
	return global.E2E_SKIP_AUTH === !0 || process.argv.includes("--e2e-skip-auth") || process.env.E2E_SKIP_AUTH === "1";
}
function R(e, t) {
	E.handle(e, async (n, ...r) => {
		try {
			return await t(n, ...r);
		} catch (t) {
			try {
				let n = m();
				n?.log && n.log("ERROR", "ipc", `IPC handler ${e} failed`, { error: String(t) });
			} catch {}
			throw F(t);
		}
	});
}
//#endregion
//#region src/main/ipc/handlers/attachment-utils.ts
var gn = new Set([
	"image",
	"pdf",
	"code",
	"text",
	"other"
]), _n = 10485760;
function vn(e) {
	if (!Array.isArray(e)) return [];
	let t = [];
	for (let n of e) {
		if (!n || typeof n != "object") continue;
		let e = n, r = typeof e.path == "string" ? e.path.slice(0, 4096) : void 0, i = typeof e.name == "string" ? e.name.slice(0, 512) : void 0, a = typeof e.type == "string" && gn.has(e.type) ? e.type : void 0, o = typeof e.size == "number" ? e.size : void 0, s = o !== void 0 && o >= 0 ? Math.min(o, _n) : void 0;
		!r || !i || !a || s === void 0 || t.push({
			path: r,
			name: i,
			type: a,
			size: s
		});
	}
	return t;
}
//#endregion
//#region src/main/ipc/handlers/task-handlers.ts
async function yn() {
	try {
		let e = await _().call("provider.getSettings");
		return Object.values(e.connectedProviders).some((e) => e?.connectionStatus === "connected" && !!e.selectedModelId);
	} catch {
		return !1;
	}
}
function bn() {
	R("task:start", async (e, t) => {
		if (L(C.fromWebContents(e.sender)), !x() && !await yn()) throw Error("No provider is ready. Please connect a provider and select a model in Settings.");
		let n = me();
		if (x()) {
			let r = C.fromWebContents(e.sender), i = en(n, t.prompt), a = Qt(t.prompt);
			return $t(r, {
				taskId: n,
				prompt: t.prompt,
				scenario: a,
				delayMs: 50
			}), i;
		}
		let r = vn(t.files), i = await _().call("task.start", {
			prompt: t.prompt,
			taskId: n,
			modelId: t.modelId,
			workspaceId: y() ?? void 0,
			workingDirectory: t.workingDirectory,
			allowedTools: t.allowedTools,
			systemPromptAppend: t.systemPromptAppend,
			outputSchema: t.outputSchema,
			sessionId: t.sessionId,
			attachments: r
		});
		try {
			Ie({
				taskId: n,
				sessionId: t.sessionId || "",
				taskType: "chat"
			}, t.modelId);
		} catch {}
		return i;
	}), R("task:cancel", async (e, t) => {
		t && (await _().call("task.cancel", { taskId: t }), await b(t));
	}), R("task:interrupt", async (e, t) => {
		t && (await _().call("task.interrupt", { taskId: t }), await b(t));
	}), R("task:get", async (e, t) => await _().call("task.get", { taskId: t }) || null), R("task:list", async (e) => {
		let t = _(), n = y(), r = n ? Tt(n) : null, i = !!r?.isDefault, a = n && r ? n : void 0;
		return await t.call("task.list", {
			workspaceId: a,
			includeUnassigned: i
		});
	}), R("task:delete", async (e, t) => {
		await _().call("task.delete", { taskId: t }), await b(t);
	}), R("task:clear-history", async (e) => {
		await _().call("task.clearHistory"), await Lt();
	}), R("task:get-todos", async (e, t) => await _().call("task.getTodos", { taskId: t })), R("browser-preview:start", async (e, t, n) => {
		if (!t || typeof t != "string") throw Error("taskId is required");
		return await Jt(t, n), { success: !0 };
	}), R("browser-preview:stop", async (e, t) => {
		if (!t || typeof t != "string") throw Error("taskId is required");
		return await b(t), { stopped: !0 };
	}), R("browser-preview:status", async () => ({ active: Vt() })), R("session:resume", async (e, t, n, r, i) => {
		L(C.fromWebContents(e.sender));
		let a = p(t, "sessionId", 128), o = p(n, "prompt"), s = r ? p(r, "taskId", 128) : void 0;
		if (!x() && !await yn()) throw Error("No provider is ready. Please connect a provider and select a model in Settings.");
		let c = vn(i);
		return await _().call("session.resume", {
			sessionId: a,
			prompt: o,
			existingTaskId: s,
			workspaceId: y() ?? void 0,
			attachments: c
		});
	}), R("permission:respond", async (e, t) => {
		x() || await _().call("permission.respond", t);
	});
}
//#endregion
//#region src/main/ipc/handlers/api-key-handlers/settings-api-key-handlers.ts
var xn = new Set([
	"aws-agentcore",
	"browserbase",
	"steel"
]);
function Sn() {
	R("settings:api-keys", async (e) => {
		let t = await Be(), n = t.bedrock ? await Ve() : null, r = Object.entries(t).filter(([e, t]) => t !== null).map(([e, t]) => {
			let r = "";
			if (e === "bedrock") r = n ? n.authType === "accessKeys" ? `${n.accessKeyId?.substring(0, 8) || "AKIA"}...` : n.authType === "profile" ? `Profile: ${n.profileName || "default"}` : "AWS Credentials" : "AWS Credentials";
			else if (e === "vertex") try {
				let e = t ? JSON.parse(t) : null;
				r = e?.projectId ? `${e.projectId} (${e.location || "unknown"})` : "GCP Credentials";
			} catch {
				r = "GCP Credentials";
			}
			else r = t && t.length > 0 ? `${t.substring(0, 8)}...` : "";
			let i;
			if (e === "bedrock") i = n?.authType === "accessKeys" ? "AWS Access Keys" : n?.authType === "profile" ? `AWS Profile: ${n.profileName || "default"}` : n?.authType === "apiKey" ? "Bedrock API Key" : "AWS Credentials";
			else if (e === "vertex") try {
				i = (t ? JSON.parse(t) : null)?.authType === "serviceAccount" ? "Service Account" : "Application Default Credentials";
			} catch {
				i = "GCP Credentials";
			}
			else i = "Local API Key";
			return {
				id: `local-${e}`,
				provider: e,
				label: i,
				keyPrefix: r,
				isActive: !0,
				createdAt: (/* @__PURE__ */ new Date()).toISOString()
			};
		}), i = await _().call("settings.getAzureFoundryConfig"), a = r.some((e) => e.provider === "azure-foundry");
		return i && i.authType === "entra-id" && !a && r.push({
			id: "local-azure-foundry",
			provider: "azure-foundry",
			label: "Azure Foundry (Entra ID)",
			keyPrefix: "Entra ID",
			isActive: i.enabled ?? !0,
			createdAt: (/* @__PURE__ */ new Date()).toISOString()
		}), r;
	}), R("settings:add-api-key", async (e, t, n, r) => {
		if (!ae.has(t)) throw Error("Unsupported API key provider");
		if (xn.has(t)) throw Error(`Provider '${t}' keys must be saved via the cloud browser settings panel`);
		let i = p(n, "apiKey", t === "vertex" ? 8192 : 256), a = r ? p(r, "label", 128) : void 0;
		return await h(t, i), {
			id: `local-${t}`,
			provider: t,
			label: a || "Local API Key",
			keyPrefix: i.substring(0, 8) + "...",
			isActive: !0,
			createdAt: (/* @__PURE__ */ new Date()).toISOString()
		};
	}), R("settings:remove-api-key", async (e, t) => {
		let n = p(t, "id", 128).replace("local-", "");
		if (n === "azure-foundry") {
			let e = _(), t = await e.call("settings.getAzureFoundryConfig");
			t && await e.call("settings.setAzureFoundryConfig", { config: {
				...t,
				enabled: !1,
				authType: "api-key"
			} });
			return;
		}
		await je(n);
	});
}
//#endregion
//#region src/main/ipc/handlers/api-key-handlers/api-key-validation-handlers.ts
function Cn(e) {
	if (!e || typeof e != "object") return {};
	let t = {};
	typeof e.baseUrl == "string" && (t.baseUrl = e.baseUrl);
	let n = e.zaiRegion ?? e.region;
	return typeof n == "string" && (t.zaiRegion = n), typeof e.deploymentName == "string" && (t.deploymentName = e.deploymentName), typeof e.authType == "string" && (t.authType = e.authType), t;
}
function wn() {
	R("api-key:exists", async (e) => !!await g("anthropic")), R("api-key:set", async (e, t) => {
		await h("anthropic", p(t, "apiKey", 256));
	}), R("api-key:get", async (e) => await g("anthropic")), R("api-key:validate", async (e, t) => {
		let n = p(t, "apiKey", 256), r = m();
		r.logEnv("INFO", "[API Key] Validation requested for provider: anthropic");
		let i = await ge("anthropic", n, { timeout: I });
		return i.valid ? r.logEnv("INFO", "[API Key] Validation succeeded") : r.logEnv("WARN", "[API Key] Validation failed", { error: i.error }), i;
	}), R("api-key:validate-provider", async (e, t, n, r) => {
		if (!ae.has(t)) return {
			valid: !1,
			error: "Unsupported provider"
		};
		let i = Cn(r), a = m();
		if (a.logEnv("INFO", `[API Key] Validation requested for provider: ${t}`), xe.has(t)) {
			let e;
			try {
				e = p(n, "apiKey", 256);
			} catch (e) {
				return {
					valid: !1,
					error: e instanceof Error ? e.message : "Invalid API key"
				};
			}
			let r;
			if (t === "openai") {
				let e = i?.baseUrl;
				if (typeof e == "string" && e.trim()) r = e.trim();
				else try {
					r = (await _().call("settings.getOpenAiBaseUrl")).trim() || void 0;
				} catch {
					r = void 0;
				}
			}
			let o = await ge(t, e, {
				timeout: I,
				baseUrl: r,
				zaiRegion: t === "zai" ? i?.zaiRegion || "international" : void 0
			});
			return o.valid ? a.logEnv("INFO", `[API Key] Validation succeeded for ${t}`) : a.logEnv("WARN", `[API Key] Validation failed for ${t}`, { error: o.error }), o;
		}
		if (t === "azure-foundry") {
			let e = await c(await _().call("settings.getAzureFoundryConfig"), {
				apiKey: n,
				baseUrl: typeof i?.baseUrl == "string" ? i.baseUrl : void 0,
				deploymentName: i?.deploymentName,
				authType: i?.authType,
				timeout: I
			});
			return e.valid ? a.logEnv("INFO", `[API Key] Validation succeeded for ${t}`) : a.logEnv("WARN", `[API Key] Validation failed for ${t}`, { error: e.error }), e;
		}
		return a.logEnv("INFO", `[API Key] Skipping validation for ${t} (local/custom provider)`), { valid: !0 };
	}), R("api-key:clear", async (e) => {
		await je("anthropic");
	}), R("api-keys:all", async (e) => {
		let t = await Be(), n = {};
		for (let [e, r] of Object.entries(t)) n[e] = {
			exists: !!r,
			prefix: r ? r.substring(0, 8) + "..." : void 0
		};
		return n;
	}), R("api-keys:has-any", async (e) => {
		let { isMockTaskEventsEnabled: t } = await import("./mock-task-flow-D1_VrBOO.js");
		return t() || await Le() ? !0 : (await (await v()).call("auth.openai.status")).connected;
	});
}
//#endregion
//#region src/main/ipc/handlers/api-key-handlers/bedrock-handlers.ts
function Tn() {
	R("bedrock:validate", async (e, t) => (m().logEnv("INFO", "[Bedrock] Validation requested"), he(t))), R("bedrock:fetch-models", async (e, t) => {
		try {
			let e = await ye(JSON.parse(t));
			return !e.success && e.error ? {
				success: !1,
				error: F(e.error),
				models: []
			} : e;
		} catch (e) {
			return m().logEnv("ERROR", "[Bedrock] Failed to fetch models", { error: F(e) }), {
				success: !1,
				error: F(e),
				models: []
			};
		}
	}), R("bedrock:save", async (e, t) => {
		let n = JSON.parse(t);
		if (n.authType === "apiKey") {
			if (!(typeof n.apiKey == "string" && n.apiKey.length > 0)) throw Error("API Key is required");
		} else if (n.authType === "accessKeys") {
			if (!(typeof n.accessKeyId == "string" && n.accessKeyId.length > 0) || !(typeof n.secretAccessKey == "string" && n.secretAccessKey.length > 0)) throw Error("Access Key ID and Secret Access Key are required");
		} else if (n.authType === "profile") {
			if (!(typeof n.profileName == "string" && n.profileName.length > 0)) throw Error("Profile name is required");
		} else throw Error("Invalid authentication type");
		await h("bedrock", t);
		let r, i;
		return n.authType === "apiKey" ? (r = "Bedrock API Key", i = `${n.apiKey.substring(0, 8)}...`) : n.authType === "accessKeys" ? (r = "AWS Access Keys", i = `${n.accessKeyId.substring(0, 8)}...`) : (r = `AWS Profile: ${n.profileName}`, i = n.profileName), {
			id: "local-bedrock",
			provider: "bedrock",
			label: r,
			keyPrefix: i,
			isActive: !0,
			createdAt: (/* @__PURE__ */ new Date()).toISOString()
		};
	}), R("bedrock:get-credentials", async (e) => {
		let t = await g("bedrock");
		if (!t) return null;
		try {
			return JSON.parse(t);
		} catch {
			return null;
		}
	});
}
//#endregion
//#region src/main/ipc/handlers/api-key-handlers/model-discovery-handlers.ts
function En() {
	R("openrouter:fetch-models", async (e) => l(await g("openrouter") || "", I)), R("provider:fetch-models", async (e, t, n) => {
		let r = fe.find((e) => e.id === t);
		if (!r?.modelsEndpoint) return {
			success: !1,
			error: "No models endpoint configured for this provider"
		};
		let i = await g(t) || null;
		if (!i && t === "openai" && (i = await (await v()).call("auth.openai.getAccessToken")), !i) return {
			success: !1,
			error: "No API key found for this provider"
		};
		let a, o = r.modelsEndpoint;
		return t === "openai" && typeof n?.baseUrl == "string" && n.baseUrl && (a = `${n.baseUrl.replace(/\/+$/, "")}/models`, o = {
			...o,
			modelFilter: void 0
		}), t === "zai" && n?.zaiRegion && (a = `${oe[n.zaiRegion]}/models`), re({
			endpointConfig: o,
			apiKey: i,
			urlOverride: a,
			timeout: I
		});
	});
}
//#endregion
//#region src/main/ipc/handlers/api-key-handlers.ts
function Dn() {
	Sn(), wn(), Tn(), En();
}
//#endregion
//#region src/main/ipc/handlers/provider-config-handlers/ollama-handlers.ts
function On(e) {
	e("ollama:test-connection", async (e, t) => o(t)), e("ollama:get-config", async (e) => _().call("settings.getOllamaConfig")), e("ollama:set-config", async (e, t) => {
		if (t !== null) {
			if (typeof t.baseUrl != "string" || typeof t.enabled != "boolean" || (f(t.baseUrl, "Ollama base URL"), t.lastValidated !== void 0 && typeof t.lastValidated != "number")) throw Error("Invalid Ollama configuration");
			if (t.models !== void 0) {
				if (!Array.isArray(t.models)) throw Error("Invalid Ollama configuration: models must be an array");
				for (let e of t.models) if (typeof e.id != "string" || typeof e.displayName != "string" || typeof e.size != "number") throw Error("Invalid Ollama configuration: invalid model format");
			}
		}
		await _().call("settings.setOllamaConfig", { config: t });
	});
}
//#endregion
//#region src/main/ipc/handlers/provider-config-handlers/azure-foundry-handlers.ts
function kn(e) {
	e("azure-foundry:get-config", async (e) => _().call("settings.getAzureFoundryConfig")), e("azure-foundry:set-config", async (e, t) => {
		if (t !== null) {
			if (typeof t.baseUrl != "string" || !t.baseUrl.trim()) throw Error("Invalid Azure Foundry configuration: baseUrl is required");
			if (typeof t.deploymentName != "string" || !t.deploymentName.trim()) throw Error("Invalid Azure Foundry configuration: deploymentName is required");
			if (t.authType !== "api-key" && t.authType !== "entra-id") throw Error("Invalid Azure Foundry configuration: authType must be api-key or entra-id");
			if (typeof t.enabled != "boolean") throw Error("Invalid Azure Foundry configuration: enabled must be a boolean");
			try {
				f(t.baseUrl, "Azure Foundry base URL");
			} catch {
				throw Error("Invalid Azure Foundry configuration: Invalid base URL format");
			}
		}
		await _().call("settings.setAzureFoundryConfig", { config: t });
	}), e("azure-foundry:test-connection", async (e, t) => ve({
		endpoint: t.endpoint,
		deploymentName: t.deploymentName,
		authType: t.authType,
		apiKey: t.apiKey,
		timeout: I
	})), e("azure-foundry:save-config", async (e, t) => {
		let { endpoint: n, deploymentName: r, authType: i, apiKey: a } = t;
		if (typeof n != "string" || !n.trim()) throw Error("Invalid Azure Foundry configuration: endpoint is required");
		if (typeof r != "string" || !r.trim()) throw Error("Invalid Azure Foundry configuration: deploymentName is required");
		if (i !== "api-key" && i !== "entra-id") throw Error("Invalid Azure Foundry configuration: authType must be api-key or entra-id");
		try {
			f(n, "Azure Foundry endpoint");
		} catch {
			throw Error("Invalid Azure Foundry configuration: Invalid endpoint URL format");
		}
		i === "api-key" && a && await h("azure-foundry", a);
		let o = {
			baseUrl: n,
			deploymentName: r,
			authType: i,
			enabled: !0,
			lastValidated: Date.now()
		};
		await _().call("settings.setAzureFoundryConfig", { config: o });
	});
}
//#endregion
//#region src/main/ipc/handlers/provider-config-handlers/litellm-handlers.ts
function An(e) {
	e("litellm:test-connection", async (e, t, n) => u(t, n)), e("litellm:fetch-models", async (e) => s({
		config: await _().call("settings.getLiteLLMConfig"),
		apiKey: await g("litellm") || void 0
	})), e("litellm:get-config", async (e) => _().call("settings.getLiteLLMConfig")), e("litellm:set-config", async (e, t) => {
		if (t !== null) {
			if (typeof t.baseUrl != "string" || typeof t.enabled != "boolean" || (f(t.baseUrl, "LiteLLM base URL"), t.lastValidated !== void 0 && typeof t.lastValidated != "number")) throw Error("Invalid LiteLLM configuration");
			if (t.models !== void 0) {
				if (!Array.isArray(t.models)) throw Error("Invalid LiteLLM configuration: models must be an array");
				for (let e of t.models) if (typeof e.id != "string" || typeof e.name != "string" || typeof e.provider != "string") throw Error("Invalid LiteLLM configuration: invalid model format");
			}
		}
		await _().call("settings.setLiteLLMConfig", { config: t });
	});
}
//#endregion
//#region src/main/ipc/handlers/provider-config-handlers/lmstudio-handlers.ts
function jn(e) {
	e("lmstudio:test-connection", async (e, t) => ee({ url: t })), e("lmstudio:fetch-models", async (e) => {
		let t = await _().call("settings.getLMStudioConfig");
		return !t || !t.baseUrl ? {
			success: !1,
			error: "No LM Studio configured"
		} : i({ baseUrl: t.baseUrl });
	}), e("lmstudio:get-config", async (e) => _().call("settings.getLMStudioConfig")), e("lmstudio:set-config", async (e, t) => {
		t !== null && ne(t), await _().call("settings.setLMStudioConfig", { config: t });
	}), e("custom:test-connection", async (e, t, n) => {
		try {
			return d(p(t, "baseUrl", 256), n ? p(n, "apiKey", 512) : void 0);
		} catch (e) {
			return {
				success: !1,
				error: e instanceof Error ? e.message : "Connection test failed"
			};
		}
	});
}
//#endregion
//#region src/main/providers/vertex.ts
function Mn(e, t, n = 5e3) {
	return new Promise((r, i) => {
		cn(e, t, {
			timeout: n,
			encoding: "utf-8"
		}, (e, t) => {
			e ? i(e) : r(t.trim());
		});
	});
}
function Nn(e) {
	e("vertex:validate", async (e, t) => {
		try {
			let e = m();
			e?.log && e.log("INFO", "main", "[Vertex] Validation requested");
		} catch {}
		return be(t);
	}), e("vertex:fetch-models", async (e, t) => {
		try {
			let e = await se(JSON.parse(t));
			return !e.success && e.error ? {
				success: !1,
				error: F(e.error),
				models: []
			} : e;
		} catch (e) {
			try {
				let t = m();
				t?.log && t.log("ERROR", "main", "[Vertex] Failed to fetch models", { error: String(e) });
			} catch {}
			return {
				success: !1,
				error: F(e),
				models: []
			};
		}
	}), e("vertex:save", async (e, t) => {
		let n = JSON.parse(t);
		if (!n.projectId?.trim()) throw Error("Project ID is required");
		if (!n.location?.trim()) throw Error("Location is required");
		if (n.authType === "serviceAccount" && !n.serviceAccountJson?.trim()) throw Error("Service account JSON key is required");
		return await h("vertex", t), {
			id: "local-vertex",
			provider: "vertex",
			label: n.authType === "serviceAccount" ? "Service Account" : "Application Default Credentials",
			keyPrefix: `${n.projectId} (${n.location})`,
			isActive: !0,
			createdAt: (/* @__PURE__ */ new Date()).toISOString()
		};
	}), e("vertex:get-credentials", async (e) => {
		let t = await g("vertex");
		if (!t) return null;
		try {
			return JSON.parse(t);
		} catch {
			return null;
		}
	}), e("vertex:detect-project", async (e) => {
		let t = process.env.GOOGLE_CLOUD_PROJECT || process.env.CLOUDSDK_CORE_PROJECT || process.env.GCLOUD_PROJECT;
		if (t) return {
			success: !0,
			projectId: t
		};
		try {
			let e = await Mn("gcloud", [
				"config",
				"get-value",
				"project"
			]);
			if (e) return {
				success: !0,
				projectId: e
			};
		} catch {}
		return {
			success: !1,
			projectId: null
		};
	}), e("vertex:list-projects", async (e) => {
		try {
			let e = await Mn("gcloud", [
				"auth",
				"application-default",
				"print-access-token"
			], 2e4);
			if (!e) return {
				success: !1,
				projects: [],
				error: "No ADC token available"
			};
			let t = [], n;
			for (let r = 0; r < 3; r++) {
				let r = new URL("https://cloudresourcemanager.googleapis.com/v1/projects");
				r.searchParams.set("filter", "lifecycleState:ACTIVE"), r.searchParams.set("pageSize", "100"), n && r.searchParams.set("pageToken", n);
				let i = await fetch(r.toString(), {
					headers: { Authorization: `Bearer ${e}` },
					signal: AbortSignal.timeout(15e3)
				});
				if (!i.ok) {
					let e = await i.text().catch(() => "");
					return {
						success: !1,
						projects: [],
						error: `Failed to list projects (${i.status}): ${e}`
					};
				}
				let a = await i.json();
				if (a.projects) for (let e of a.projects) t.push({
					projectId: e.projectId,
					name: e.name || e.projectId
				});
				if (!a.nextPageToken) break;
				n = a.nextPageToken;
			}
			return t.sort((e, t) => e.projectId.localeCompare(t.projectId)), {
				success: !0,
				projects: t
			};
		} catch (e) {
			return {
				success: !1,
				projects: [],
				error: e instanceof Error ? e.message : "Unknown error"
			};
		}
	});
}
//#endregion
//#region src/main/ipc/handlers/provider-config-handlers/provider-settings-handlers.ts
function Pn(e) {
	e("model:get", async (e) => _().call("settings.getSelectedModel")), e("model:set", async (e, t) => {
		if (!t || typeof t.provider != "string" || typeof t.model != "string") throw Error("Invalid model configuration");
		await _().call("settings.setSelectedModel", { model: t });
	}), e("provider-settings:get", async () => _().call("provider.getSettings")), e("provider-settings:set-active", async (e, t) => {
		await _().call("provider.setActive", { providerId: t });
	}), e("provider-settings:get-connected", async (e, t) => (await _().call("provider.getSettings")).connectedProviders[t] ?? null), e("provider-settings:set-connected", async (e, t, n) => {
		await _().call("provider.setConnected", {
			providerId: t,
			provider: n
		});
	}), e("provider-settings:remove-connected", async (e, t) => {
		await _().call("provider.removeConnected", { providerId: t }), t === "vertex" && It();
	}), e("provider-settings:update-model", async (e, t, n) => {
		await _().call("provider.updateModel", {
			providerId: t,
			modelId: n
		});
	}), e("provider-settings:set-debug", async (e, t) => {
		await _().call("provider.setDebugMode", { enabled: t });
	}), e("provider-settings:get-debug", async () => _().call("provider.getDebugMode")), Nn(e);
}
//#endregion
//#region src/main/ipc/handlers/provider-config-handlers/nim-handlers.ts
function Fn(e) {
	e("nim:test-connection", async (e, t, n) => a(t, n)), e("nim:fetch-models", async (e) => ie({
		config: await _().call("settings.getNimConfig"),
		apiKey: await g("nim") || void 0
	})), e("nim:get-config", async (e) => _().call("settings.getNimConfig")), e("nim:set-config", async (e, t) => {
		await _().call("settings.setNimConfig", { config: t });
	});
}
//#endregion
//#region src/main/ipc/handlers/provider-config-handlers/accomplish-ai-handlers.ts
var In = "Free tier is not available in this build. Please use the official Accomplish release or connect your own API key.";
function Ln(e) {
	throw (e instanceof Error ? e.message : String(e)).includes("accomplish_runtime_unavailable") ? Error(In) : e;
}
function Rn(e, t) {
	try {
		m()?.log(e, "main", `[accomplish-ai] ${t}`);
	} catch {}
}
function zn(e) {
	return Object.values(e.connectedProviders).some((e) => e?.connectionStatus === "connected" && !!e.selectedModelId);
}
function Bn(e) {
	e("accomplish-ai:connect", async () => {
		let e;
		try {
			e = await _().call("accomplish-ai.connect");
		} catch (e) {
			Ln(e);
		}
		let t = _(), n = {
			type: "accomplish-ai",
			deviceFingerprint: e.deviceFingerprint
		};
		return await t.call("provider.setConnected", {
			providerId: "accomplish-ai",
			provider: {
				providerId: "accomplish-ai",
				connectionStatus: "connected",
				selectedModelId: "accomplish-ai/accomplish-free",
				credentials: n,
				lastConnectedAt: (/* @__PURE__ */ new Date()).toISOString()
			}
		}), e.usage && await t.call("provider.saveAccomplishAiCredits", { usage: e.usage }), Rn("INFO", `Connected with fingerprint ${e.deviceFingerprint.substring(0, 8)}...`), {
			deviceFingerprint: e.deviceFingerprint,
			...e.usage ?? {
				spentCredits: 0,
				remainingCredits: 0,
				totalCredits: 0,
				resetsAt: ""
			}
		};
	}), e("accomplish-ai:ensure-ready", async () => {
		let e = _(), t = await e.call("provider.getSettings"), n = t.connectedProviders["accomplish-ai"];
		if (n?.connectionStatus === "connected") return { deviceFingerprint: n.credentials.deviceFingerprint };
		let r;
		try {
			r = await e.call("accomplish-ai.connect");
		} catch (e) {
			Ln(e);
		}
		let i = {
			type: "accomplish-ai",
			deviceFingerprint: r.deviceFingerprint
		};
		return await e.call("provider.setConnected", {
			providerId: "accomplish-ai",
			provider: {
				providerId: "accomplish-ai",
				connectionStatus: "connected",
				selectedModelId: "accomplish-ai/accomplish-free",
				credentials: i,
				lastConnectedAt: (/* @__PURE__ */ new Date()).toISOString()
			}
		}), zn(t) || await e.call("provider.setActive", { providerId: "accomplish-ai" }), r.usage && await e.call("provider.saveAccomplishAiCredits", { usage: r.usage }), { deviceFingerprint: r.deviceFingerprint };
	}), e("accomplish-ai:disconnect", async () => {
		let e = _();
		try {
			await e.call("accomplish-ai.disconnect");
		} catch (e) {
			Rn("WARN", `Daemon disconnect failed: ${String(e)}`);
		}
		await e.call("provider.removeConnected", { providerId: "accomplish-ai" });
	}), e("accomplish-ai:get-usage", async () => {
		let e = _();
		async function t() {
			return e.call("accomplish-ai.get-usage");
		}
		async function n() {
			if ((await e.call("provider.getSettings")).connectedProviders["accomplish-ai"]?.connectionStatus !== "connected") return null;
			try {
				Rn("INFO", "Daemon identity lost — reconnecting");
				let n = await e.call("accomplish-ai.connect");
				return n.usage ? n.usage : await t();
			} catch {
				return null;
			}
		}
		try {
			let n = await t();
			return n.totalCredits === 0 ? await e.call("provider.getAccomplishAiCredits") ?? n : (await e.call("provider.saveAccomplishAiCredits", { usage: n }), n);
		} catch {
			let t = await n();
			return t ? (t.totalCredits > 0 && await e.call("provider.saveAccomplishAiCredits", { usage: t }), t) : await e.call("provider.getAccomplishAiCredits") ?? {
				spentCredits: 0,
				remainingCredits: 0,
				totalCredits: 0,
				resetsAt: ""
			};
		}
	}), e("accomplish-ai:get-status", async () => ({ connected: (await _().call("provider.getSettings")).connectedProviders["accomplish-ai"]?.connectionStatus === "connected" }));
}
//#endregion
//#region src/main/ipc/handlers/provider-config-handlers.ts
function Vn() {
	On(R), kn(R), An(R), jn(R), Fn(R), Bn(R), Pn(R);
}
//#endregion
//#region src/main/ipc/handlers/settings-handlers/cloud-browser-handlers.ts
var Hn = new Set([
	"aws-agentcore",
	"browserbase",
	"steel"
]);
function Un(e) {
	e("settings:cloud-browser-config:get", async (e) => _().call("settings.getCloudBrowserConfig")), e("settings:cloud-browser-config:set", async (e, t) => {
		if (t === null) {
			await _().call("settings.setCloudBrowserConfig", { config: null });
			return;
		}
		if (typeof t != "string") throw Error("Invalid cloud browser config");
		let n;
		try {
			n = JSON.parse(t);
		} catch {
			throw Error("Invalid cloud browser config: malformed JSON");
		}
		if (typeof n != "object" || !n) throw Error("Invalid cloud browser config: expected object");
		let r = n;
		if (r.activeProvider !== null && (typeof r.activeProvider != "string" || !Hn.has(r.activeProvider))) throw Error("Invalid cloud browser config: activeProvider must be a valid provider or null");
		if (r.providers !== void 0) {
			if (typeof r.providers != "object" || r.providers === null || Array.isArray(r.providers)) throw Error("Invalid cloud browser config: providers must be a plain object");
			if (r.activeProvider !== null && typeof r.activeProvider == "string" && !r.providers[r.activeProvider]) throw Error("Invalid cloud browser config: activeProvider has no corresponding entry in providers");
		}
		await _().call("settings.setCloudBrowserConfig", { config: r });
	});
}
//#endregion
//#region src/main/ipc/handlers/settings-handlers/sandbox-handlers.ts
function Wn(e) {
	e("sandbox:get-config", async (e) => _().call("settings.getSandboxConfig")), e("sandbox:set-config", async (e, t) => {
		if (!t || typeof t != "object") throw Error("Invalid sandbox configuration");
		if (![
			"disabled",
			"native",
			"docker"
		].includes(t.mode)) throw Error("Invalid sandbox mode. Must be \"disabled\", \"native\", or \"docker\".");
		if (!Array.isArray(t.allowedPaths)) throw Error("allowedPaths must be an array");
		if (typeof t.networkRestricted != "boolean") throw Error("networkRestricted must be a boolean");
		if (!Array.isArray(t.allowedHosts)) throw Error("allowedHosts must be an array");
		let n = {
			mode: t.mode,
			allowedPaths: t.allowedPaths.map((e) => p(e, "allowedPath", 512)),
			networkRestricted: t.networkRestricted,
			allowedHosts: t.allowedHosts.map((e) => p(e, "allowedHost", 256)),
			...t.dockerImage !== void 0 && { dockerImage: p(t.dockerImage, "dockerImage", 256) },
			...typeof t.networkPolicy == "object" && t.networkPolicy !== null && !Array.isArray(t.networkPolicy) && { networkPolicy: {
				allowOutbound: t.networkPolicy.allowOutbound === !0,
				...Array.isArray(t.networkPolicy.allowedHosts) && { allowedHosts: t.networkPolicy.allowedHosts.map((e) => p(e, "networkPolicy.allowedHost", 256)) }
			} }
		};
		await _().call("settings.setSandboxConfig", { config: n });
	});
}
//#endregion
//#region src/main/opencode/copilot-auth.ts
var z = null;
async function Gn() {
	z &&= (z.abort(), null);
	let t = new AbortController();
	z = t;
	let n = m();
	try {
		n.log?.("INFO", "opencode", "[CopilotAuth] Starting device code flow");
		let i = await de();
		n.log?.("INFO", "opencode", "[CopilotAuth] Device code received");
		try {
			await O.openExternal(i.verification_uri);
		} catch (e) {
			let t = e instanceof Error ? e.message : String(e);
			n.log?.("WARN", "opencode", `[CopilotAuth] Failed to open browser: ${t}`);
		}
		return (async () => {
			try {
				let r = await e({
					deviceCode: i.device_code,
					interval: i.interval,
					expiresIn: i.expires_in,
					onPoll: () => {
						if (t.signal.aborted) throw Error("Login cancelled");
						n.log?.("INFO", "opencode", "[CopilotAuth] Polling for token...");
					}
				});
				if (!r.access_token) throw Error("No access token received from GitHub");
				te({
					accessToken: r.access_token,
					expiresAt: Date.now() + 480 * 60 * 1e3
				}), n.log?.("INFO", "opencode", "[CopilotAuth] Login successful, tokens saved");
			} catch (e) {
				let t = e instanceof Error ? e.message : String(e);
				n.log?.("WARN", "opencode", `[CopilotAuth] Background poll failed: ${t}`);
				try {
					r();
					let e = await import("fs"), n = await import("os"), i = await import("path"), a = process.env.XDG_DATA_HOME || i.join(n.homedir(), ".local", "share"), o = i.join(a, "opencode", "auth.json"), s = {};
					try {
						s = JSON.parse(e.readFileSync(o, "utf8"));
					} catch {}
					s["github-copilot-error"] = {
						message: t,
						timestamp: Date.now()
					}, e.mkdirSync(i.dirname(o), { recursive: !0 }), e.writeFileSync(o, JSON.stringify(s, null, 2), "utf8");
				} catch {}
			} finally {
				z === t && (z = null);
			}
		})(), {
			ok: !0,
			userCode: i.user_code,
			verificationUri: i.verification_uri,
			expiresIn: i.expires_in
		};
	} catch (e) {
		z === t && (z = null);
		let r = e instanceof Error ? e.message : String(e);
		throw n.log?.("WARN", "opencode", `[CopilotAuth] Login failed: ${r}`), e;
	}
}
function Kn() {
	r();
}
//#endregion
//#region src/main/ipc/handlers/settings-handlers/auth-handlers.ts
function qn(e) {
	e("settings:openai-base-url:get", async (e) => _().call("settings.getOpenAiBaseUrl")), e("settings:openai-base-url:set", async (e, t) => {
		if (typeof t != "string") throw Error("Invalid base URL");
		let n = t.trim();
		if (!n) {
			await _().call("settings.setOpenAiBaseUrl", { baseUrl: "" });
			return;
		}
		f(n, "OpenAI base URL"), await _().call("settings.setOpenAiBaseUrl", { baseUrl: n.replace(/\/+$/, "") });
	}), e("opencode:auth:openai:status", async (e) => await (await v()).call("auth.openai.status")), e("opencode:auth:openai:login", async (e) => {
		let t = await v(), { sessionId: n, authorizeUrl: r } = await t.call("auth.openai.startLogin");
		await O.openExternal(r);
		let i = await t.call("auth.openai.awaitCompletion", {
			sessionId: n,
			timeoutMs: 2 * 6e4
		}, { timeoutMs: 125e3 });
		if (!i.ok) throw Error(i.error ?? "OpenAI authentication failed.");
		return {
			ok: !0,
			openedUrl: r
		};
	}), e("opencode:auth:slack:status", async (e) => t()), e("opencode:auth:slack:login", async (e) => (await Kt(), { ok: !0 })), e("opencode:auth:slack:logout", async (e) => {
		await Bt();
	}), e("opencode:auth:copilot:status", async (e) => n()), e("opencode:auth:copilot:login", async (e) => {
		try {
			return await Gn();
		} catch (e) {
			throw e instanceof Error ? e : Error(String(e));
		}
	}), e("opencode:auth:copilot:logout", async (e) => {
		Kn();
	});
}
//#endregion
//#region src/main/ipc/handlers/settings-handlers/onboarding-handlers.ts
function Jn(e) {
	e("onboarding:complete", async (e) => {
		if (hn()) return !0;
		let t = _();
		return (await t.call("settings.getAll")).app.onboardingComplete ? !0 : (await t.call("task.list", {})).length > 0 ? (await t.call("settings.setOnboardingComplete", { complete: !0 }), !0) : !1;
	}), e("onboarding:set-complete", async (e, t) => {
		if (typeof t != "boolean") throw Error("complete must be a boolean");
		await _().call("settings.setOnboardingComplete", { complete: t });
	});
}
//#endregion
//#region src/main/ipc/handlers/settings-handlers/opencode-handlers.ts
function Yn(e) {
	e("opencode:check", async (e) => {
		if (hn()) return {
			installed: !0,
			version: "1.0.0-test",
			installCommand: "npm install -g opencode-ai"
		};
		let t = !1, n = null;
		try {
			t = await qt(), n = t ? await Wt() : null;
		} catch (e) {
			let r = e instanceof Error ? e.message : String(e);
			m().logEnv("WARN", "[opencode:check] CLI check failed", {
				message: r,
				stack: e instanceof Error ? e.stack : void 0
			}), t = !1, n = null;
		}
		return {
			installed: t,
			version: n,
			installCommand: "npm install -g opencode-ai"
		};
	}), e("opencode:version", async (e) => Wt());
}
//#endregion
//#region src/main/ipc/handlers/whatsapp-handlers.ts
function Xn(e) {
	e("integrations:whatsapp:get-config", async (e) => _().call("whatsapp.getConfig")), e("integrations:whatsapp:connect", async (e) => {
		await _().call("whatsapp.connect");
	}), e("integrations:whatsapp:disconnect", async (e) => {
		await _().call("whatsapp.disconnect");
	}), e("integrations:whatsapp:set-enabled", async (e, t) => {
		await _().call("whatsapp.setEnabled", { enabled: t });
	});
}
//#endregion
//#region src/main/ipc/handlers/settings-handlers.ts
var Zn = [
	"auto",
	"en",
	"zh-CN",
	"ru",
	"fr"
];
function Qn() {
	R("settings:notifications-enabled", async (e) => (await _().call("settings.getAll")).notificationsEnabled), R("settings:set-notifications-enabled", async (e, t) => {
		if (typeof t != "boolean") throw Error("Invalid notifications-enabled flag");
		await _().call("settings.setNotificationsEnabled", { enabled: t });
	}), R("settings:debug-mode", async (e) => (await _().call("settings.getAll")).app.debugMode), R("settings:set-debug-mode", async (e, t) => {
		if (typeof t != "boolean") throw Error("Invalid debug mode flag");
		await _().call("settings.setDebugMode", { enabled: t });
		for (let e of C.getAllWindows()) e.webContents.send("settings:debug-mode-changed", { enabled: t });
	}), R("settings:theme", async (e) => (await _().call("settings.getAll")).app.theme), R("settings:set-theme", async (e, t) => {
		if (![
			"system",
			"light",
			"dark"
		].includes(t)) throw Error("Invalid theme value");
		await _().call("settings.setTheme", { theme: t }), D.themeSource = t;
		let n = t === "system" ? D.shouldUseDarkColors ? "dark" : "light" : t;
		for (let e of C.getAllWindows()) e.webContents.send("settings:theme-changed", {
			theme: t,
			resolved: n
		});
	}), R("settings:language", async (e) => (await _().call("settings.getAll")).app.language), R("settings:set-language", async (e, t) => {
		if (!Zn.includes(t)) throw Error("Invalid language value");
		await _().call("settings.setLanguage", { language: t });
		for (let e of C.getAllWindows()) e.webContents.send("settings:language-changed", { language: t });
	}), R("settings:app-settings", async (e) => (await _().call("settings.getAll")).app), R("daemon:get-socket-path", async () => {
		let { getSocketPath: e } = await import("./desktop-main-rBBKOr0V.js");
		return e(w.getPath("userData"));
	}), R("daemon:ping", async () => {
		let { getDaemonClient: e } = await import("./daemon-bootstrap-OCt2YnlL.js");
		try {
			return await e().ping();
		} catch {
			return {
				status: "disconnected",
				uptime: 0
			};
		}
	}), R("daemon:restart", async () => {
		let { getDaemonClient: e, shutdownDaemon: t, bootstrapDaemon: n } = await import("./daemon-bootstrap-OCt2YnlL.js"), { suppressReconnect: r, enableReconnect: i } = await import("./daemon-connector-BwteXUZY.js");
		r();
		try {
			try {
				e().call("daemon.shutdown").catch(() => {});
			} catch {}
			t();
			try {
				let { getPidFilePath: e } = await import("./desktop-main-rBBKOr0V.js"), { getDataDir: t } = await import("./daemon-connector-BwteXUZY.js"), n = await import("fs"), r = e(t()), i = Date.now() + 1e4;
				for (; Date.now() < i && n.existsSync(r);) try {
					let e = n.readFileSync(r, "utf8"), t = JSON.parse(e).pid;
					process.kill(t, 0), await new Promise((e) => setTimeout(e, 100));
				} catch {
					break;
				}
			} catch {}
			try {
				let { getSocketPath: e } = await import("./desktop-main-rBBKOr0V.js"), { getDataDir: t } = await import("./daemon-connector-BwteXUZY.js"), n = await import("fs"), r = e(t());
				n.existsSync(r) && n.unlinkSync(r);
			} catch {}
			return await n(), { success: !0 };
		} finally {
			i();
		}
	}), R("daemon:stop", async () => {
		let { getDaemonClient: e, shutdownDaemon: t } = await import("./daemon-bootstrap-OCt2YnlL.js"), { suppressReconnect: n } = await import("./daemon-connector-BwteXUZY.js");
		n();
		try {
			e().call("daemon.shutdown").catch(() => {});
		} catch {}
		t();
		try {
			let { getPidFilePath: e } = await import("./desktop-main-rBBKOr0V.js"), { getDataDir: t } = await import("./daemon-connector-BwteXUZY.js"), n = await import("fs"), r = e(t()), i = Date.now() + 1e4;
			for (; Date.now() < i && n.existsSync(r);) try {
				let e = n.readFileSync(r, "utf8"), t = JSON.parse(e).pid;
				process.kill(t, 0), await new Promise((e) => setTimeout(e, 100));
			} catch {
				break;
			}
		} catch {}
		return { success: !0 };
	}), R("daemon:start", async () => {
		let { bootstrapDaemon: e } = await import("./daemon-bootstrap-OCt2YnlL.js"), { enableReconnect: t } = await import("./daemon-connector-BwteXUZY.js");
		return await e(), t(), { success: !0 };
	}), R("scheduler:list", async (e, t) => _().call("task.listScheduled", { workspaceId: t })), R("scheduler:create", async (e, t, n, r) => _().call("task.schedule", {
		cron: t,
		prompt: n,
		workspaceId: r
	})), R("scheduler:delete", async (e, t) => _().call("task.cancelScheduled", { scheduleId: t })), R("scheduler:set-enabled", async (e, t, n) => _().call("task.setScheduleEnabled", {
		scheduleId: t,
		enabled: n
	})), R("daemon:is-auto-start-enabled", async () => {
		let { isAutoStartEnabled: e } = await import("./service-manager-CMsgz4n3.js");
		return e();
	}), R("daemon:get-close-behavior", async () => _().call("settings.getCloseBehavior")), R("daemon:set-close-behavior", async (e, t) => {
		if (t !== "keep-daemon" && t !== "stop-daemon") throw Error(`Invalid close behavior: ${t}`);
		await _().call("settings.setCloseBehavior", { behavior: t });
	}), Un(R), Wn(R), qn(R), Jn(R), Yn(R), Xn(R), R("app:get-build-capabilities", async () => {
		let { isFreeMode: e, isAnalyticsEnabled: t } = await import("./build-config-BqHR5x39.js");
		return {
			hasFreeMode: e(),
			hasAnalytics: t()
		};
	});
}
//#endregion
//#region src/main/services/speechToText.ts
async function $n() {
	let e = await g("elevenlabs");
	return Se({ storage: { getApiKey: (t) => t === "elevenlabs" ? e : null } });
}
function er() {
	return Se({ storage: { getApiKey: () => null } });
}
async function tr(e) {
	return e ? er().validateElevenLabsApiKey(e) : (await $n()).validateElevenLabsApiKey();
}
async function nr(e, t = "audio/webm") {
	return (await $n()).transcribeAudio(e, t);
}
//#endregion
//#region src/main/ipc/handlers/speech-handlers.ts
var rr = 25 * 1024 * 1024;
function ir() {
	R("speech:is-configured", async (e) => {
		let t = await g("elevenlabs");
		return !!(t && t.trim());
	}), R("speech:get-config", async (e) => {
		let t = await g("elevenlabs");
		return {
			enabled: !!(t && t.trim()),
			hasApiKey: !!t,
			apiKeyPrefix: t ? t.substring(0, 8) + "..." : void 0
		};
	}), R("speech:validate", async (e, t) => tr(t)), R("speech:transcribe", async (e, t, n) => {
		let r = m();
		if (r.logEnv("INFO", "[IPC] speech:transcribe received", {
			audioDataType: typeof t,
			audioDataByteLength: t?.byteLength,
			mimeType: n
		}), t?.byteLength > rr) throw Error(`Audio payload exceeds maximum allowed size of ${rr / 1024 / 1024} MB`);
		let i = Buffer.from(t);
		return r.logEnv("INFO", "[IPC] Converted to buffer", { bufferLength: i.length }), nr(i, n);
	});
}
//#endregion
//#region src/main/ipc/handlers/log-handlers.ts
function ar() {
	let e = async () => {
		if (!(await _().call("settings.getAll")).app.debugMode) throw Error("Debug mode is disabled");
	};
	R("logs:export", async (t) => {
		await e();
		let n = L(C.fromWebContents(t.sender)), r = m();
		r.flush();
		let i = r.getCurrentLogPath(), a = r.getLogDir(), o = `accomplish-logs-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19)}.txt`, s = await T.showSaveDialog(n, {
			title: "Export Application Logs",
			defaultPath: o,
			filters: [
				{
					name: "Text Files",
					extensions: ["txt"]
				},
				{
					name: "Log Files",
					extensions: ["log"]
				},
				{
					name: "All Files",
					extensions: ["*"]
				}
			]
		});
		if (s.canceled || !s.filePath) return {
			success: !1,
			reason: "cancelled"
		};
		try {
			if (A.existsSync(i)) A.copyFileSync(i, s.filePath);
			else {
				let e = `Accomplish Application Logs\nExported: ${(/* @__PURE__ */ new Date()).toISOString()}\nLog Directory: ${a}\n\nNo logs recorded yet.\n`;
				A.writeFileSync(s.filePath, e);
			}
			return {
				success: !0,
				path: s.filePath
			};
		} catch (e) {
			return {
				success: !1,
				error: e instanceof Error ? e.message : "Unknown error"
			};
		}
	}), R("log:event", async (e, t) => {
		let n = [
			"DEBUG",
			"INFO",
			"WARN",
			"ERROR"
		].includes(t?.level?.toUpperCase()) ? t.level.toUpperCase() : "INFO", r = typeof t?.message == "string" ? t.message : "", i = m();
		return typeof i.logBrowser == "function" && i.logBrowser(n, r, t?.context), { ok: !0 };
	});
}
//#endregion
//#region src/main/ipc/handlers/capture-handlers.ts
function or() {
	let e = async () => {
		if (!(await _().call("settings.getAll")).app.debugMode) throw Error("Debug mode is disabled");
	};
	R("debug:capture-screenshot", async (t) => {
		try {
			await e();
		} catch (e) {
			return {
				success: !1,
				error: e.message
			};
		}
		let n;
		try {
			n = L(C.fromWebContents(t.sender));
		} catch (e) {
			return {
				success: !1,
				error: e instanceof Error ? e.message : "Untrusted window"
			};
		}
		try {
			let e = await n.webContents.capturePage(), t = e.toPNG().toString("base64"), r = e.getSize();
			return {
				success: !0,
				data: t,
				width: r.width,
				height: r.height
			};
		} catch (e) {
			return {
				success: !1,
				error: e instanceof Error ? e.message : "Unknown error"
			};
		}
	}), R("debug:capture-axtree", async (t) => {
		try {
			await e();
		} catch (e) {
			return {
				success: !1,
				error: e.message
			};
		}
		let n;
		try {
			n = L(C.fromWebContents(t.sender));
		} catch (e) {
			return {
				success: !1,
				error: e instanceof Error ? e.message : "Untrusted window"
			};
		}
		try {
			return {
				success: !0,
				data: await n.webContents.executeJavaScript("\n        (function() {\n          var MAX_DEPTH = 15;\n          var MAX_TEXT = 200;\n          var MAX_NODES = 5000;\n          var nodeCount = 0;\n          function walk(el, depth) {\n            if (depth > MAX_DEPTH || nodeCount >= MAX_NODES) return null;\n            nodeCount++;\n            var tag = el.tagName ? el.tagName.toLowerCase() : '#text';\n            var node = { tag: tag };\n            var role = el.getAttribute ? el.getAttribute('role') : null;\n            if (role) node.role = role;\n            var ariaLabel = el.getAttribute ? el.getAttribute('aria-label') : null;\n            if (ariaLabel) node.ariaLabel = ariaLabel.substring(0, MAX_TEXT);\n            if (el.id) node.id = el.id;\n            var text = '';\n            for (var i = 0; i < el.childNodes.length; i++) {\n              if (el.childNodes[i].nodeType === 3) {\n                text += el.childNodes[i].textContent;\n              }\n            }\n            text = text.trim();\n            if (text) node.text = text.substring(0, MAX_TEXT);\n            var children = [];\n            for (var j = 0; j < el.children.length; j++) {\n              var child = walk(el.children[j], depth + 1);\n              if (child) children.push(child);\n            }\n            if (children.length > 0) node.children = children;\n            return node;\n          }\n          if (!document.body) return '{}';\n          return JSON.stringify(walk(document.body, 0));\n        })()\n      ")
			};
		} catch (e) {
			return {
				success: !1,
				error: e instanceof Error ? e.message : "Unknown error"
			};
		}
	});
}
//#endregion
//#region src/main/ipc/handlers/bug-report-handlers.ts
function sr() {
	let e = async () => {
		if (!(await _().call("settings.getAll")).app.debugMode) throw Error("Debug mode is disabled");
	};
	R("debug:generate-bug-report", async (t, n) => {
		try {
			await e();
		} catch (e) {
			return {
				success: !1,
				error: e.message
			};
		}
		let r;
		try {
			r = L(C.fromWebContents(t.sender));
		} catch (e) {
			return {
				success: !1,
				error: e instanceof Error ? e.message : "Untrusted window"
			};
		}
		try {
			let e = `bug-report-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`, t = await T.showSaveDialog(r, {
				title: "Save Bug Report",
				defaultPath: e,
				filters: [{
					name: "JSON Files",
					extensions: ["json"]
				}, {
					name: "All Files",
					extensions: ["*"]
				}]
			});
			if (t.canceled || !t.filePath) return {
				success: !1,
				reason: "cancelled"
			};
			let i;
			if (n.screenshot) {
				let e = k.parse(t.filePath), r = k.join(e.dir, `${e.name}.png`);
				try {
					await A.promises.access(r), i = k.join(e.dir, `${e.name}-${Date.now()}.png`);
				} catch {
					i = r;
				}
				await A.promises.writeFile(i, Buffer.from(n.screenshot, "base64"));
			}
			let a = {
				version: 1,
				generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
				app: {
					version: n.appVersion ?? w.getVersion(),
					platform: n.platform ?? process.platform
				},
				task: {
					id: n.taskId,
					prompt: n.taskPrompt,
					status: n.taskStatus,
					createdAt: n.taskCreatedAt,
					completedAt: n.taskCompletedAt,
					messageCount: Array.isArray(n.messages) ? n.messages.length : 0
				},
				messages: n.messages,
				debugLogs: n.debugLogs,
				axtree: n.axtree,
				screenshotFile: i ? k.basename(i) : null,
				hasScreenshot: !!i
			};
			return await A.promises.writeFile(t.filePath, JSON.stringify(a, null, 2), "utf-8"), {
				success: !0,
				path: t.filePath
			};
		} catch (e) {
			return {
				success: !1,
				error: e instanceof Error ? e.message : "Unknown error"
			};
		}
	});
}
//#endregion
//#region src/main/ipc/handlers/debug-handlers.ts
function cr() {
	ar(), or(), sr();
}
//#endregion
//#region src/main/ipc/handlers/file-handlers.ts
var lr = 5;
function ur(e) {
	let t = k.resolve(e);
	if (t !== k.normalize(e) && !k.isAbsolute(e)) throw Error(`Invalid file path: ${k.basename(e)}`);
	let n = w.getPath("home"), r = w.getPath("userData");
	if (!t.startsWith(n) && !t.startsWith(r)) throw Error(`File path is outside allowed directories: ${k.basename(e)}`);
}
var dr = [
	"txt",
	"md",
	"json",
	"yaml",
	"yml",
	"toml",
	"csv",
	"xml",
	"html",
	"css"
], fr = [
	"ts",
	"tsx",
	"js",
	"jsx",
	"py",
	"rb",
	"go",
	"rs",
	"java",
	"c",
	"cpp",
	"h",
	"cs",
	"swift",
	"kt",
	"sh",
	"bash",
	"zsh",
	"fish"
], pr = [
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"svg",
	"bmp",
	"ico"
], mr = ["pdf"];
function hr(e) {
	return pr.includes(e) ? "image" : mr.includes(e) ? "pdf" : fr.includes(e) ? "code" : dr.includes(e) ? "text" : "other";
}
function gr(e) {
	let t = A.statSync(e), n = hr(k.extname(e).toLowerCase().slice(1)), r = {
		id: j.randomUUID(),
		name: k.basename(e),
		path: e,
		type: n,
		size: t.size
	};
	if (n === "text" || n === "code") try {
		r.content = A.readFileSync(e, "utf-8");
	} catch {}
	return r;
}
function _r() {
	R("files:pick-folder", async (e) => {
		let t = L(C.fromWebContents(e.sender)), n = await T.showOpenDialog(t, { properties: ["openDirectory", "createDirectory"] });
		return n.canceled || n.filePaths.length === 0 ? null : n.filePaths[0];
	}), R("files:pick", async (e) => {
		let t = L(C.fromWebContents(e.sender)), n = await T.showOpenDialog(t, { properties: ["openFile", "multiSelections"] });
		if (n.canceled) return [];
		if (n.filePaths.length > 5) throw Error("You can only select a maximum of 5 files.");
		for (let e of n.filePaths) if (A.statSync(e).size > 10485760) throw Error(`File ${k.basename(e)} exceeds the 10 MB size limit.`);
		return n.filePaths.map(gr);
	}), R("files:process-dropped", async (e, t) => {
		if (!Array.isArray(t)) throw Error("filePaths must be an array");
		if (t.length > lr) throw Error(`You can only drop a maximum of ${lr} files.`);
		for (let e of t) if (ur(e), A.statSync(e).size > 10485760) throw Error(`File ${k.basename(e)} exceeds the 10 MB size limit.`);
		return t.map(gr);
	}), R("shell:open-external", async (e, t) => {
		try {
			let { validateHttpUrl: e } = await import("./src-X9YwlMwq.js");
			e(t, "External URL"), await O.openExternal(t);
		} catch (e) {
			try {
				let t = m();
				t?.log && t.log("ERROR", "ipc", "Failed to open external URL", { error: String(e) });
			} catch {}
			throw e;
		}
	});
}
//#endregion
//#region src/main/ipc/handlers/skills-handlers.ts
function vr() {
	R("skills:list", async () => P.getAll()), R("skills:list-enabled", async () => P.getEnabled()), R("skills:set-enabled", async (e, t, n) => {
		await P.setEnabled(t, n);
	}), R("skills:get-content", async (e, t) => P.getContent(t)), R("skills:get-user-skills-path", async () => await P.getUserSkillsPath()), R("skills:pick-folder", async (e) => {
		let t = C.fromWebContents(e.sender) ?? C.getAllWindows()[0], n = await T.showOpenDialog(t, {
			title: "Select a skill folder",
			properties: ["openDirectory"]
		});
		return n.canceled || n.filePaths.length === 0 ? null : n.filePaths[0];
	}), R("skills:add-from-folder", async (e, t) => P.addFromFolder(t)), R("skills:add-from-github", async (e, t) => P.addFromGitHub(t)), R("skills:delete", async (e, t) => {
		await P.delete(t);
	}), R("skills:resync", async () => (await P.resync(), P.getAll())), R("skills:open-in-editor", async (e, t) => {
		let n = await O.openPath(t);
		if (n) throw Error(`Failed to open path in editor: ${n}`);
	}), R("skills:show-in-folder", async (e, t) => {
		O.showItemInFolder(t);
	});
}
//#endregion
//#region src/main/ipc/handlers/favorites-handlers.ts
function yr() {
	R("favorites:list", async () => _().call("favorites.list")), R("favorites:add", async (e, t) => {
		let n = _(), r = await n.call("task.get", { taskId: t });
		if (!r) throw Error(`Favorite failed: task not found (taskId: ${t})`);
		if (!["completed", "interrupted"].includes(r.status)) throw Error(`Favorite failed: invalid status (taskId: ${t}, status: ${r.status})`);
		await n.call("favorites.add", {
			taskId: t,
			prompt: r.prompt,
			summary: r.summary
		});
	}), R("favorites:remove", async (e, t) => {
		await _().call("favorites.remove", { taskId: t });
	}), R("favorites:has", async (e, t) => _().call("favorites.isFavorite", { taskId: t }));
}
//#endregion
//#region src/main/ipc/handlers/connector-handlers.ts
var br = 600 * 1e3, B = /* @__PURE__ */ new Map();
function xr() {
	let e = Date.now();
	for (let [t, n] of B) e - n.createdAt > br && B.delete(t);
}
function Sr() {
	R("connectors:list", async () => _().call("connectors.list")), R("connectors:add", async (e, t, n) => {
		let r = p(t, "connectorName", 128), i = p(n, "connectorUrl", 512);
		try {
			let e = new URL(i);
			if (e.protocol !== "http:" && e.protocol !== "https:") throw Error("Connector URL must use http:// or https://");
		} catch (e) {
			throw Error(e instanceof Error && e.message.includes("http") ? e.message : `Invalid connector URL: ${i}`);
		}
		let a = `mcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, o = (/* @__PURE__ */ new Date()).toISOString(), s = {
			id: a,
			name: r,
			url: i,
			status: "disconnected",
			isEnabled: !0,
			createdAt: o,
			updatedAt: o
		};
		return await _().call("connectors.upsert", { connector: s }), s;
	}), R("connectors:delete", async (e, t) => {
		let n = _();
		await n.call("connectors.deleteTokens", { connectorId: t }), await n.call("connectors.delete", { id: t });
	}), R("connectors:set-enabled", async (e, t, n) => {
		await _().call("connectors.setEnabled", {
			id: t,
			enabled: n
		});
	}), R("connectors:start-oauth", async (e, t) => {
		let n = _(), r = await n.call("connectors.getById", { id: t });
		if (!r) throw Error("Connector not found");
		let i = await le(r.url), a = r.clientRegistration;
		a ||= await pe(i, "accomplish://callback/mcp", "Accomplish Desktop"), await n.call("connectors.upsert", { connector: {
			...r,
			oauthMetadata: i,
			clientRegistration: a,
			status: "connecting",
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		} });
		let o = _e(), s = j.randomUUID();
		xr(), B.set(s, {
			connectorId: t,
			codeVerifier: o.codeVerifier,
			metadata: i,
			clientRegistration: a,
			createdAt: Date.now()
		});
		let c = ce({
			authorizationEndpoint: i.authorizationEndpoint,
			clientId: a.clientId,
			redirectUri: "accomplish://callback/mcp",
			codeChallenge: o.codeChallenge,
			state: s,
			scope: i.scopesSupported?.join(" ")
		});
		return await O.openExternal(c), {
			state: s,
			authUrl: c
		};
	}), R("connectors:complete-oauth", async (e, t, n) => {
		xr();
		let r = B.get(t);
		if (!r) throw Error("No pending OAuth flow for this state");
		B.delete(t);
		let i = await ue({
			tokenEndpoint: r.metadata.tokenEndpoint,
			code: n,
			codeVerifier: r.codeVerifier,
			clientId: r.clientRegistration.clientId,
			clientSecret: r.clientRegistration.clientSecret,
			redirectUri: "accomplish://callback/mcp"
		}), a = _();
		await a.call("connectors.storeTokens", {
			connectorId: r.connectorId,
			tokens: i
		});
		let o = await a.call("connectors.getById", { id: r.connectorId });
		return o && await a.call("connectors.upsert", { connector: {
			...o,
			status: "connected",
			lastConnectedAt: (/* @__PURE__ */ new Date()).toISOString(),
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		} }), a.call("connectors.getById", { id: r.connectorId });
	}), R("connectors:disconnect", async (e, t) => {
		let n = _();
		await n.call("connectors.deleteTokens", { connectorId: t }), await n.call("connectors.setStatus", {
			id: t,
			status: "disconnected"
		});
	});
}
//#endregion
//#region ../../packages/agent-core/src/common/types/connector-registry.ts
var V = {
	slack: 3118,
	google: 3119,
	jira: 3120,
	github: 3121,
	lightdash: 3122,
	notion: 3123,
	monday: 3124,
	datadog: 3125
}, Cr = [
	{
		id: S.Slack,
		displayName: "Slack",
		referencePrompt: "The user explicitly mentioned @Slack in their prompt. Prioritize using the Slack MCP tools for this task.",
		desktopOAuth: {
			kind: "mcp-fixed-client",
			clientId: "1601185624273.8899143856786",
			store: {
				key: "slack",
				serverUrl: "https://mcp.slack.com/mcp",
				usesDcr: !1,
				storesServerUrl: !1,
				callback: {
					host: "127.0.0.1",
					port: V.slack,
					path: "/callback"
				}
			},
			discoveryError: "Slack authentication failed during OAuth discovery — could not reach mcp.slack.com. Check your internet connection.",
			tokenExchangeError: "Slack authentication failed during token exchange — the server rejected the authorization code. Try again in a few minutes."
		}
	},
	{
		id: S.Google,
		displayName: "Google Drive",
		referencePrompt: "The user explicitly mentioned @Google Drive in their prompt. Prioritize using Google Workspace MCP tools for this task.",
		desktopOAuth: { kind: "desktop-google" }
	},
	{
		id: S.Jira,
		displayName: "Jira",
		referencePrompt: "The user explicitly mentioned @Jira in their prompt. Prioritize using the Jira MCP tools for this task.",
		desktopOAuth: {
			kind: "mcp-dcr",
			store: {
				key: "jira",
				serverUrl: "https://mcp.atlassian.com/v1/mcp",
				usesDcr: !0,
				storesServerUrl: !1,
				callback: {
					host: "127.0.0.1",
					port: V.jira,
					path: "/callback"
				}
			},
			discoveryError: "Jira authentication failed during OAuth discovery — could not reach mcp.atlassian.com. Check your internet connection.",
			registrationError: "Jira authentication failed during client registration — the Atlassian server rejected the registration request. Ask your Atlassian admin to check Settings > Security > AI settings > Rovo MCP server.",
			tokenExchangeError: "Jira authentication failed during token exchange — the server rejected the authorization code. Try again in a few minutes."
		}
	},
	{
		id: S.GitHub,
		displayName: "GitHub",
		referencePrompt: "The user explicitly mentioned @GitHub in their prompt. Use the `gh` CLI via bash for GitHub operations.",
		desktopOAuth: { kind: "desktop-github" }
	},
	{
		id: S.Monday,
		displayName: "monday.com",
		referencePrompt: "The user explicitly mentioned @monday.com in their prompt. Prioritize using the monday.com MCP tools for this task.",
		desktopOAuth: {
			kind: "mcp-dcr",
			store: {
				key: "monday",
				serverUrl: "https://mcp.monday.com/mcp",
				usesDcr: !0,
				storesServerUrl: !1,
				callback: {
					host: "127.0.0.1",
					port: V.monday,
					path: "/callback"
				}
			},
			discoveryError: "monday.com authentication failed during OAuth discovery — could not reach mcp.monday.com. Check your internet connection.",
			registrationError: "monday.com authentication failed during client registration — the monday.com server rejected the request.",
			tokenExchangeError: "monday.com authentication failed during token exchange — the server rejected the authorization code. Try again in a few minutes.",
			extraAuthParams: { force_install_if_needed: "true" }
		}
	},
	{
		id: S.Notion,
		displayName: "Notion",
		referencePrompt: "The user explicitly mentioned @Notion in their prompt. Prioritize using the Notion MCP tools for this task.",
		desktopOAuth: {
			kind: "mcp-dcr",
			store: {
				key: "notion",
				serverUrl: "https://mcp.notion.com/mcp",
				usesDcr: !0,
				storesServerUrl: !1,
				callback: {
					host: "127.0.0.1",
					port: V.notion,
					path: "/callback"
				}
			},
			discoveryError: "Notion authentication failed during OAuth discovery — could not reach mcp.notion.com. Check your internet connection.",
			registrationError: "Notion authentication failed during client registration — check that your Notion account has API access enabled.",
			tokenExchangeError: "Notion authentication failed during token exchange — the server rejected the authorization code. Try again in a few minutes."
		}
	},
	{
		id: S.Lightdash,
		displayName: "Lightdash",
		referencePrompt: "The user explicitly mentioned @Lightdash in their prompt. Prioritize using the Lightdash MCP tools for data exploration and metric queries.",
		desktopOAuth: {
			kind: "mcp-dcr",
			store: {
				key: "lightdash",
				usesDcr: !0,
				storesServerUrl: !0,
				callback: {
					host: "127.0.0.1",
					port: V.lightdash,
					path: "/callback"
				}
			},
			discoveryError: "Lightdash authentication failed during OAuth discovery — could not reach your Lightdash instance. Check your internet connection and verify the instance URL.",
			registrationError: "Lightdash authentication failed during client registration — check that your Lightdash instance supports MCP OAuth.",
			tokenExchangeError: "Lightdash authentication failed during token exchange — the server rejected the authorization code. Try again in a few minutes."
		}
	},
	{
		id: S.Datadog,
		displayName: "Datadog",
		referencePrompt: "The user explicitly mentioned @Datadog in their prompt. Prioritize using the Datadog MCP tools for observability — logs, monitors, metrics, dashboards, SLOs, incidents, and traces.",
		desktopOAuth: {
			kind: "mcp-dcr",
			store: {
				key: "datadog",
				usesDcr: !0,
				storesServerUrl: !0,
				callback: {
					host: "127.0.0.1",
					port: V.datadog,
					path: "/callback"
				}
			},
			discoveryError: "Datadog authentication failed during OAuth discovery — could not reach your Datadog MCP endpoint. Check your internet connection and verify the Datadog site is correct.",
			registrationError: "Datadog authentication failed during client registration — check that your Datadog site supports MCP OAuth.",
			tokenExchangeError: "Datadog authentication failed during token exchange — the server rejected the authorization code. Try again in a few minutes."
		}
	}
];
function wr() {
	return Cr;
}
function Tr(e) {
	return Cr.find((t) => t.id === e);
}
//#endregion
//#region src/main/connectors/connector-auth-entry.ts
async function H(e) {
	return await _().call("connectors.authEntry.read", { connectorKey: e.key }) ?? void 0;
}
async function U(e, t) {
	await _().call("connectors.authEntry.write", {
		connectorKey: e.key,
		entry: t
	});
}
async function Er(e) {
	await _().call("connectors.authEntry.delete", { connectorKey: e.key });
}
function Dr(e, t) {
	if (e.serverUrl) return e.serverUrl;
	if (e.storesServerUrl && t.serverUrl) return t.serverUrl;
}
//#endregion
//#region src/main/connectors/connector-auth-store.ts
var Or = class {
	constructor(e) {
		this.config = e;
	}
	get callbackUrl() {
		let { host: e, port: t, path: n } = this.config.callback;
		return `http://${e}:${t}${n}`;
	}
	async getOAuthStatus() {
		let e = await H(this.config);
		if (!e) return {
			connected: !1,
			pendingAuthorization: !1
		};
		let t = !!(e.accessToken?.trim() || e.refreshToken?.trim());
		return {
			connected: t,
			pendingAuthorization: !t && typeof e.oauthState == "string" && e.oauthState.trim().length > 0 && typeof e.codeVerifier == "string" && e.codeVerifier.trim().length > 0,
			lastValidatedAt: e.lastOAuthValidatedAt
		};
	}
	async getAccessToken() {
		return (await H(this.config))?.accessToken?.trim() || void 0;
	}
	async getServerUrl() {
		if (this.config.serverUrl) return this.config.serverUrl;
		if (this.config.storesServerUrl) return (await H(this.config))?.serverUrl?.trim() || void 0;
	}
	async setServerUrl(e) {
		if (!this.config.storesServerUrl) return;
		let t = e.trim(), n = await H(this.config) ?? {}, r = n.serverUrl?.trim() === t ? {
			...n,
			serverUrl: t
		} : { serverUrl: t };
		await U(this.config, r);
	}
	async getClientRegistration() {
		if (!this.config.usesDcr) return;
		let e = (await H(this.config))?.clientRegistration;
		return e?.clientId ? e : void 0;
	}
	async setClientRegistration(e) {
		if (!this.config.usesDcr) return;
		let t = await H(this.config) ?? {};
		await U(this.config, {
			...t,
			clientRegistration: e
		});
	}
	async setPendingAuth(e) {
		let t = await H(this.config) ?? {}, n = {
			codeVerifier: e.codeVerifier,
			oauthState: e.oauthState,
			serverUrl: Dr(this.config, t)
		};
		this.config.usesDcr && t.clientRegistration && (n.clientRegistration = t.clientRegistration), await U(this.config, n);
	}
	async setTokens(e, t) {
		let n = await H(this.config) ?? {}, r = {
			accessToken: e.accessToken,
			refreshToken: e.refreshToken,
			expiresAt: e.expiresAt,
			lastOAuthValidatedAt: t ?? Date.now(),
			serverUrl: Dr(this.config, n)
		};
		this.config.usesDcr && n.clientRegistration && (r.clientRegistration = n.clientRegistration), await U(this.config, r);
	}
	async setLastValidatedAt(e) {
		let t = await H(this.config) ?? {};
		await U(this.config, {
			...t,
			lastOAuthValidatedAt: e
		});
	}
	async clearTokens() {
		let e = await H(this.config);
		if (!e) return;
		let t = {};
		this.config.usesDcr && e.clientRegistration && (t.clientRegistration = e.clientRegistration), this.config.storesServerUrl && e.serverUrl && (t.serverUrl = e.serverUrl), Object.keys(t).length === 0 ? await Er(this.config) : await U(this.config, t);
	}
	async clearAuth() {
		await Er(this.config);
	}
	async getRefreshToken() {
		return (await H(this.config))?.refreshToken;
	}
	async getTokenExpiry() {
		return (await H(this.config))?.expiresAt;
	}
};
//#endregion
//#region src/main/connectors/connector-auth-registry.ts
function kr(e) {
	return e.kind === "mcp-dcr" || e.kind === "mcp-fixed-client";
}
var Ar = /* @__PURE__ */ new Map();
for (let e of wr()) kr(e.desktopOAuth) && Ar.set(e.id, new Or(e.desktopOAuth.store));
Ar.set(S.GitHub, new Or({
	key: "github",
	usesDcr: !1,
	storesServerUrl: !1,
	callback: {
		host: "127.0.0.1",
		port: 0,
		path: "/"
	}
}));
function W(e) {
	return Ar.get(e);
}
//#endregion
//#region src/main/connectors/mcp-oauth-strategies.ts
async function jr(e, t) {
	let n = t.desktopOAuth;
	if (n.kind !== "mcp-dcr") return {
		ok: !1,
		error: "not-configured"
	};
	let r = W(e);
	if (!r) return {
		ok: !1,
		error: "not-configured"
	};
	let i = await r.getServerUrl();
	if (!i) return {
		ok: !1,
		error: "no-server-url",
		message: "Server URL not configured"
	};
	try {
		let e = await le(i).catch(() => {
			throw Error(n.discoveryError);
		}), a = await r.getClientRegistration();
		a || (a = await pe(e, r.callbackUrl, t.displayName).catch(() => {
			throw Error(n.registrationError);
		}), await r.setClientRegistration(a));
		let o = _e(), s = j.randomUUID(), c = n.extraAuthParams ?? {}, l = ce({
			authorizationEndpoint: e.authorizationEndpoint,
			clientId: a.clientId,
			redirectUri: r.callbackUrl,
			codeChallenge: o.codeChallenge,
			state: s,
			scope: e.scopesSupported?.join(" "),
			...c
		}), u = await Pt({
			host: n.store.callback.host,
			port: n.store.callback.port,
			callbackPath: n.store.callback.path
		}), d = !1;
		try {
			await r.setPendingAuth({
				codeVerifier: o.codeVerifier,
				oauthState: s
			}), await O.openExternal(l);
			let { code: t, state: i } = await u.waitForCallback().catch(() => {
				throw Error(n.tokenExchangeError);
			});
			if (i !== s) throw Error(n.tokenExchangeError);
			let c = await ue({
				tokenEndpoint: e.tokenEndpoint,
				code: t,
				codeVerifier: o.codeVerifier,
				clientId: a.clientId,
				clientSecret: a.clientSecret,
				redirectUri: r.callbackUrl
			}).catch(() => {
				throw Error(n.tokenExchangeError);
			});
			return await r.setTokens(c, Date.now()), d = !0, {
				ok: !0,
				accessToken: c.accessToken
			};
		} finally {
			d || await r.clearTokens(), u.shutdown();
		}
	} catch (e) {
		return {
			ok: !1,
			error: "oauth-failed",
			message: e instanceof Error ? e.message : String(e)
		};
	}
}
async function Mr(e) {
	let t = Tr(e).desktopOAuth;
	if (t.kind !== "mcp-fixed-client") return {
		ok: !1,
		error: "not-configured"
	};
	let n = W(e);
	if (!n) return {
		ok: !1,
		error: "not-configured"
	};
	let r = await n.getServerUrl();
	if (!r) return {
		ok: !1,
		error: "no-server-url"
	};
	try {
		let e = await le(r).catch(() => {
			throw Error(t.discoveryError);
		}), i = _e(), a = j.randomUUID(), o = t.clientId, s = ce({
			authorizationEndpoint: e.authorizationEndpoint,
			clientId: o,
			redirectUri: n.callbackUrl,
			codeChallenge: i.codeChallenge,
			state: a,
			scope: e.scopesSupported?.join(" ")
		}), c = await Pt({
			host: t.store.callback.host,
			port: t.store.callback.port,
			callbackPath: t.store.callback.path
		}), l = !1;
		try {
			await n.setPendingAuth({
				codeVerifier: i.codeVerifier,
				oauthState: a
			}), await O.openExternal(s);
			let { code: r, state: u } = await c.waitForCallback().catch(() => {
				throw Error(t.tokenExchangeError);
			});
			if (u !== a) throw Error(t.tokenExchangeError);
			let d = await ue({
				tokenEndpoint: e.tokenEndpoint,
				code: r,
				codeVerifier: i.codeVerifier,
				clientId: o,
				redirectUri: n.callbackUrl
			}).catch(() => {
				throw Error(t.tokenExchangeError);
			});
			return await n.setTokens(d, Date.now()), l = !0, {
				ok: !0,
				accessToken: d.accessToken
			};
		} finally {
			l || await n.clearTokens(), c.shutdown();
		}
	} catch (e) {
		return {
			ok: !1,
			error: "oauth-failed",
			message: e instanceof Error ? e.message : String(e)
		};
	}
}
//#endregion
//#region src/main/connectors/desktop-connector-state.ts
var Nr = [
	"gh",
	"/opt/homebrew/bin/gh",
	"/usr/local/bin/gh",
	"/usr/bin/gh",
	"/home/linuxbrew/.linuxbrew/bin/gh",
	"C:\\Program Files\\GitHub CLI\\gh.exe",
	"C:\\Program Files (x86)\\GitHub CLI\\gh.exe"
];
function Pr() {
	return [process.env.PATH ?? process.env.Path ?? "", ...process.platform === "win32" ? [
		"C:\\Program Files\\GitHub CLI",
		"C:\\Program Files (x86)\\GitHub CLI",
		"C:\\Program Files\\Git\\bin"
	] : [
		"/opt/homebrew/bin",
		"/usr/local/bin",
		"/usr/bin",
		"/bin"
	]].join(k.delimiter);
}
var Fr = /* @__PURE__ */ new Set();
function G(e, t) {
	t ? Fr.add(e) : Fr.delete(e);
}
function Ir(e) {
	return Fr.has(e);
}
//#endregion
//#region src/main/connectors/github-oauth-flow.ts
var K = ln(cn);
async function Lr(e) {
	return {
		ok: !0,
		accessToken: "google-managed"
	};
}
async function Rr(e) {
	let t = await zr();
	if (!t) return {
		ok: !1,
		error: "gh-not-found",
		message: "GitHub CLI (gh) not found on PATH. Install it from https://cli.github.com"
	};
	let n = W(e), r = {
		...process.env,
		PATH: Pr()
	};
	try {
		let { stdout: i } = await K(t, ["auth", "token"], {
			timeout: 1e4,
			env: r
		}), a = i.trim();
		if (a) return await n.setTokens({
			accessToken: a,
			tokenType: "bearer"
		}, Date.now()), G(e, !0), {
			ok: !0,
			accessToken: a
		};
	} catch {}
	try {
		await K(t, [
			"auth",
			"login",
			"--git-protocol",
			"https",
			"--web"
		], {
			timeout: 12e4,
			env: r
		});
		let { stdout: i } = await K(t, ["auth", "token"], {
			timeout: 1e4,
			env: r
		}), a = i.trim();
		return a ? (await n.setTokens({
			accessToken: a,
			tokenType: "bearer"
		}, Date.now()), G(e, !0), {
			ok: !0,
			accessToken: a
		}) : (G(e, !1), {
			ok: !1,
			error: "oauth-failed",
			message: "GitHub login succeeded but no token was retrieved"
		});
	} catch (t) {
		return G(e, !1), {
			ok: !1,
			error: "oauth-failed",
			message: t instanceof Error ? t.message : "GitHub authentication failed"
		};
	}
}
async function zr() {
	let e = {
		...process.env,
		PATH: Pr()
	};
	for (let t of Nr) try {
		return await K(t, ["--version"], {
			timeout: 5e3,
			env: e
		}), t;
	} catch {}
	return null;
}
//#endregion
//#region src/main/connectors/connector-token-resolver.ts
async function Br(e) {
	let t = Tr(e);
	if (!t) return {
		ok: !1,
		error: "not-configured",
		message: `No connector definition for ${e}`
	};
	let n = t.desktopOAuth.kind;
	switch (n) {
		case "mcp-dcr": return jr(e, t);
		case "mcp-fixed-client": return Mr(e);
		case "desktop-google": return Lr(e);
		case "desktop-github": return Rr(e);
		default: return Vr(n);
	}
}
function Vr(e) {
	throw Error(`Unhandled OAuth kind: ${String(e)}`);
}
//#endregion
//#region src/main/ipc/handlers/built-in-connector-handlers.ts
var Hr = ln(cn);
function Ur(e, t) {
	let n = typeof e == "string" ? e.trim() : "";
	if (!n) throw Error(`Invalid ${t} server URL`);
	try {
		let e = new URL(n);
		if (e.protocol !== "http:" && e.protocol !== "https:") throw Error("URL must use http or https");
	} catch {
		throw Error(`Invalid ${t} server URL`);
	}
	return n;
}
async function Wr() {
	let e = {
		...process.env,
		PATH: Pr()
	};
	for (let t of Nr) try {
		let { stdout: n } = await Hr(t, ["auth", "token"], {
			timeout: 1e4,
			env: e
		}), r = n.trim();
		if (r) {
			let e = W(S.GitHub);
			e && await e.setTokens({
				accessToken: r,
				tokenType: "bearer"
			}, Date.now()), G(S.GitHub, !0);
			return;
		}
	} catch {}
}
function Gr() {
	Wr(), R("lightdash:get-server-url", async (e) => await W(S.Lightdash)?.getServerUrl() ?? null), R("lightdash:set-server-url", async (e, t) => {
		let n = W(S.Lightdash);
		if (!n) throw Error("Lightdash connector not configured");
		await n.setServerUrl(Ur(t, "Lightdash"));
	}), R("datadog:get-server-url", async (e) => await W(S.Datadog)?.getServerUrl() ?? null), R("datadog:set-server-url", async (e, t) => {
		let n = W(S.Datadog);
		if (!n) throw Error("Datadog connector not configured");
		await n.setServerUrl(Ur(t, "Datadog"));
	}), R("connectors:get-built-in-auth-status", async (e) => {
		let t = wr();
		return await Promise.all(t.map(async (e) => {
			let t = W(e.id);
			if (!t) return {
				providerId: e.id,
				connected: Ir(e.id),
				pendingAuthorization: !1
			};
			let n = await t.getOAuthStatus();
			return {
				providerId: e.id,
				connected: n.connected,
				pendingAuthorization: n.pendingAuthorization,
				lastValidatedAt: n.lastValidatedAt
			};
		}));
	}), R("connectors:built-in-login", async (e, t) => {
		if (!tn(t)) throw Error(`Unknown provider ID: ${String(t)}`);
		let n = await Br(t);
		if (!n.ok) throw Error(n.message ?? `Authentication failed for ${t}: ${n.error}`);
		return { ok: !0 };
	}), R("connectors:built-in-logout", async (e, t) => {
		if (!tn(t)) throw Error(`Unknown provider ID: ${String(t)}`);
		let n = W(t);
		n ? await n.clearTokens() : G(t, !1);
	});
}
//#endregion
//#region src/main/ipc/handlers/workspace-handlers.ts
async function Kr() {
	try {
		return await _().call("task.getActiveCount") > 0;
	} catch {
		return !St();
	}
}
function qr() {
	R("workspace:list", async () => Et()), R("workspace:get-active", async () => y()), R("workspace:switch", async (e, t) => {
		let n = C.fromWebContents(e.sender);
		if (await Kr()) return {
			success: !1,
			reason: "Cannot switch workspace while tasks are running"
		};
		let r;
		try {
			r = await Dt(t);
		} catch (e) {
			return {
				success: !1,
				reason: e instanceof Error ? e.message : String(e)
			};
		}
		return r ? (n && !n.isDestroyed() && n.webContents.send("workspace:changed", { workspaceId: t }), { success: !0 }) : {
			success: !1,
			reason: "Switch did not complete (same workspace)"
		};
	}), R("workspace:create", async (e, t) => Ot(t)), R("workspace:update", async (e, t, n) => jt(t, n)), R("workspace:delete", async (e, t) => {
		let n = C.fromWebContents(e.sender);
		if (y() === t && await Kr()) return !1;
		let r = await At(t);
		return r.deleted && n && !n.isDestroyed() && n.webContents.send("workspace:deleted", { workspaceId: t }), r.deleted;
	}), R("knowledge-notes:list", async (e, t) => _().call("knowledgeNote.list", { workspaceId: t })), R("knowledge-notes:create", async (e, t) => _().call("knowledgeNote.create", { input: t })), R("knowledge-notes:update", async (e, t, n, r) => _().call("knowledgeNote.update", {
		noteId: t,
		workspaceId: n,
		input: r
	})), R("knowledge-notes:delete", async (e, t, n) => {
		await _().call("knowledgeNote.delete", {
			noteId: t,
			workspaceId: n
		});
	});
}
//#endregion
//#region src/main/ipc/handlers/huggingface-handlers.ts
function Jr() {
	R("huggingface-local:start-server", async (e, t) => typeof t != "string" || !t.trim() ? {
		success: !1,
		error: "Invalid model ID"
	} : Ft(t.trim())), R("huggingface-local:stop-server", async () => (await Xt(), { success: !0 })), R("huggingface-local:server-status", async () => Zt()), R("huggingface-local:test-connection", async () => Mt()), R("huggingface-local:download-model", async (e, t) => typeof t != "string" || !t.trim() ? {
		success: !1,
		error: "Invalid model ID"
	} : Yt(t.trim(), (t) => {
		try {
			e.sender.send("huggingface-local:download-progress", t);
		} catch {}
	}, Rt())), R("huggingface-local:list-models", async () => ({
		cached: await Nt(),
		suggested: Ht
	})), R("huggingface-local:delete-model", async (e, t) => typeof t != "string" || !t.trim() ? {
		success: !1,
		error: "Invalid model ID"
	} : (await Xt().catch(() => {}), zt(t.trim()))), R("huggingface-local:get-config", async () => _().call("provider.getHuggingFaceLocalConfig"));
	let e = ["q4", "fp32"], t = [
		"auto",
		"cpu",
		"cuda",
		"webgpu"
	];
	R("huggingface-local:set-config", async (n, r) => {
		if (r !== null && (typeof r != "object" || r.selectedModelId !== null && typeof r.selectedModelId != "string" || r.serverPort !== null && !(Number.isInteger(r.serverPort) && isFinite(r.serverPort) && r.serverPort >= 1 && r.serverPort <= 65535) || typeof r.enabled != "boolean" || r.quantization !== null && !e.includes(r.quantization) || r.devicePreference !== null && !t.includes(r.devicePreference))) throw Error("Invalid HuggingFace config: unexpected field types");
		await _().call("provider.setHuggingFaceLocalConfig", { config: r });
	});
}
//#endregion
//#region src/main/ipc/handlers/analytics-handlers.ts
async function q() {
	try {
		let e = await _().call("provider.getSettings"), t = e.activeProviderId;
		return t ? {
			provider: t,
			model: e.connectedProviders[t]?.selectedModelId ?? void 0
		} : {};
	} catch {
		return {};
	}
}
function Yr() {
	let e = pt();
	function t(t, n) {
		R(t, e ? n : async () => {});
	}
	t("analytics:track", async (e, t, n) => {
		bt(t, n);
	}), t("analytics:page-view", async (e, t, n) => {
		Je(t, n);
	}), t("analytics:submit-task", async () => {
		let { model: e, provider: t } = await q();
		Ee(e, t);
	}), t("analytics:new-task", async () => {
		rt();
	}), t("analytics:open-settings", async () => {
		et();
	}), t("analytics:save-api-key", async (e, t, n, r) => {
		ut(t, n, r);
	}), t("analytics:select-provider", async (e, t) => {
		lt(t);
	}), t("analytics:select-model", async (e, t, n) => {
		Te(t, n);
	}), t("analytics:toggle-debug-mode", async (e, t) => {
		Ae(t);
	}), t("analytics:task-start", async (e, t, n, r) => {
		let { model: i, provider: a } = await q();
		Ie({
			taskId: t,
			sessionId: n,
			taskType: r
		}, i, a);
	}), t("analytics:task-complete", async (e, t, n, r, i, a, o) => {
		let { model: s, provider: c } = await q();
		Fe({
			taskId: t,
			sessionId: n,
			taskType: r
		}, i, a, o, s, void 0, void 0, c);
	}), t("analytics:task-error", async (e, t, n, r, i, a, o) => {
		let { model: s, provider: c } = await q();
		we({
			taskId: t,
			sessionId: n,
			taskType: r
		}, i, a, o, s, void 0, void 0, c);
	}), t("analytics:permission-requested", async (e, t, n, r, i) => {
		He({
			taskId: t,
			sessionId: n,
			taskType: r
		}, i);
	}), t("analytics:permission-response", async (e, t, n, r, i, a) => {
		ct({
			taskId: t,
			sessionId: n,
			taskType: r
		}, i, a);
	}), t("analytics:tool-used", async (e, t, n, r, i) => {
		Me({
			taskId: t,
			sessionId: n,
			taskType: r
		}, i);
	}), t("analytics:user-interaction", async (e, t, n, r, i, a) => {
		ke({
			taskId: t,
			sessionId: n,
			taskType: r
		}, i, a);
	}), t("analytics:app-close", async () => {
		await tt();
	}), t("analytics:app-backgrounded", async () => {
		ot();
	}), t("analytics:app-foregrounded", async () => {
		Xe();
	}), t("analytics:model-selection-step", async (e, t, n, r, i) => {
		qe(t, n, r, i);
	}), t("analytics:model-selection-complete", async (e, t, n, r) => {
		Ke(t, n, r);
	}), t("analytics:model-selection-abandoned", async (e, t, n) => {
		st(t, n);
	}), t("analytics:history-viewed", async () => {
		$e();
	}), t("analytics:task-from-history", async () => {
		Ne();
	}), t("analytics:history-cleared", async () => {
		Ge();
	}), t("analytics:task-details-expanded", async () => {
		Qe();
	}), t("analytics:output-copied", async () => {
		Ye();
	}), t("analytics:provider-disconnected", async (e, t) => {
		We(t);
	}), t("analytics:help-link-clicked", async (e, t) => {
		at(t);
	}), t("analytics:skill-action", async (e, t) => {
		ze(t);
	}), t("analytics:save-voice-api-key", async (e, t) => {
		Re(t);
	}), t("analytics:export-logs", async () => {
		nt();
	}), t("analytics:thread-exported", async () => {
		Oe();
	}), t("analytics:task-launcher-action", async (e, t) => {
		Pe(t);
	}), t("analytics:task-feedback", async (e, t, n, r, i, a, o, s) => {
		Ze(t, n, r, i, a, void 0, void 0, o, s);
	}), t("analytics:stop-agent", async (e, t, n) => {
		De(t, n);
	}), t("analytics:provider-box-clicked", async (e, t) => {
		dt(t);
	});
}
//#endregion
//#region src/main/ipc/handlers/google-account-handlers.ts
function Xr(e) {
	try {
		m()?.log("WARN", "main", "[GoogleAccounts] OAuth error surfaced to renderer", { message: e });
	} catch {}
	for (let t of C.getAllWindows()) if (!(t.isDestroyed() || t.webContents.isDestroyed())) try {
		t.webContents.send("gws:account:auth-error", { message: e });
	} catch {}
}
function Zr(e, t) {
	R("gws:accounts:list", async () => _().call("gwsAccount.list")), R("gws:accounts:start-auth", async (t, n) => {
		let { state: r, authUrl: i, waitForCallback: a } = await e(n);
		return a().then(async (e) => {
			let t = (/* @__PURE__ */ new Date()).toISOString(), r = _();
			try {
				await r.call("gwsAccount.add", { input: {
					googleAccountId: e.googleAccountId,
					email: e.email,
					displayName: e.displayName,
					pictureUrl: e.pictureUrl,
					label: n,
					connectedAt: t,
					token: e.token
				} });
			} catch (n) {
				let i = n instanceof Error ? n.message : String(n);
				if (i.includes("Account already connected")) {
					try {
						await r.call("gwsAccount.updateToken", {
							googleAccountId: e.googleAccountId,
							token: e.token,
							connectedAt: t
						});
					} catch (e) {
						Xr(`Failed to update Google account token: ${e instanceof Error ? e.message : String(e)}`);
					}
					return;
				}
				Xr(`Google account connection failed: ${i}`);
			}
		}).catch((e) => {
			let t = e instanceof Error ? e.message : String(e);
			t !== "Google OAuth timed out" && Xr(t);
		}), {
			state: r,
			authUrl: i
		};
	}), R("gws:accounts:complete-auth", async (e, t, n) => {
		throw Error("This flow is handled automatically by the start-auth callback. No action needed.");
	}), R("gws:accounts:remove", async (e, t) => {
		await _().call("gwsAccount.remove", { googleAccountId: t });
	}), R("gws:accounts:update-label", async (e, t, n) => {
		await _().call("gwsAccount.updateLabel", {
			googleAccountId: t,
			label: n
		});
	}), R("gws:accounts:cancel-auth", async (e, n) => {
		t(n);
	});
}
//#endregion
//#region src/main/ipc/handlers/index.ts
function Qr(e, t) {
	bn(), Dn(), Vn(), Qn(), ir(), cr(), _r(), vr(), yr(), Sr(), Gr(), qr(), Jr(), Yr(), e && t && Zr(e, t);
}
//#endregion
//#region src/main/protocol-handlers.ts
var $r = [];
function ei(e, t) {
	t.startsWith("accomplish://callback/mcp") ? e.webContents.send("auth:mcp-callback", t) : t.startsWith("accomplish://callback") && e.webContents.send("auth:callback", t);
}
function ti(e) {
	return !e.webContents.isLoadingMainFrame() && !e.isDestroyed();
}
function J(e) {
	if (!ti(e)) {
		e.webContents.once("did-finish-load", () => J(e));
		return;
	}
	for (; $r.length > 0;) {
		let t = $r.shift();
		t && ei(e, t);
	}
}
function ni(e, t) {
	$r.push(e);
	let n = t();
	n && !n.isDestroyed() && (ti(n) ? J(n) : n.webContents.once("did-finish-load", () => J(n)));
}
function ri(e) {
	if (process.platform !== "win32") return;
	let t = process.argv.find((e) => e.startsWith("accomplish://"));
	t && w.whenReady().then(() => {
		ni(t, e);
	});
}
function ii(e) {
	w.on("open-url", (t, n) => {
		t.preventDefault(), ni(n, e);
	});
}
function ai(e, t, n) {
	if (process.platform !== "win32") return;
	let r = t.find((e) => e.startsWith("accomplish://"));
	r && ni(r, n);
}
function oi() {
	E.handle("app:version", () => w.getVersion()), E.handle("app:platform", () => process.platform), E.handle("app:is-e2e-mode", () => global.E2E_MOCK_TASK_EVENTS === !0 || process.env.E2E_MOCK_TASK_EVENTS === "1");
}
//#endregion
//#region src/main/app-startup.ts
function Y(e, t, n) {
	try {
		let r = m();
		r?.log && r.log(e, "main", t, n);
	} catch {}
}
async function si() {
	for (;;) try {
		return await wt(), Y("INFO", "[Main] Daemon connected"), "connected";
	} catch (e) {
		let { DaemonRestartError: t } = await import("./daemon-connector-BwteXUZY.js");
		if (e instanceof t) return Y("ERROR", "[Main] Failed to restart daemon after upgrade", { error: String(e) }), await T.showMessageBox({
			type: "warning",
			title: "Background Service Update",
			message: "The background service from a previous version could not be stopped.",
			detail: "Please fully quit the application (check the system tray), wait a few seconds, and reopen it. If the issue persists, restart your computer.",
			buttons: ["Quit"]
		}), "quit";
		for (Y("ERROR", "[Main] Daemon bootstrap failed", { error: String(e) });;) {
			let t = await T.showMessageBox({
				type: "error",
				title: "Accomplish cannot start",
				message: "The background service failed to start.",
				detail: `Accomplish stores your settings, conversations, and credentials in a background process. Without it the app cannot load.

Error: ${e instanceof Error ? e.message : String(e)}`,
				buttons: [
					"Retry",
					"Open Logs",
					"Quit"
				],
				defaultId: 0,
				cancelId: 2
			});
			if (t.response === 0) break;
			if (t.response === 2) return "quit";
			try {
				let e = k.join(w.getPath("userData"), "logs"), t = await O.openPath(e);
				t && (Y("WARN", "[Main] shell.openPath(logs) returned error", { openErr: t }), await O.openPath(w.getPath("userData")));
			} catch (e) {
				Y("WARN", "[Main] Could not open log directory", { err: String(e) });
			}
		}
	}
}
async function ci(e, t, n) {
	if (Y("INFO", `[Main] Electron app ready, version: ${w.getVersion()}`), process.env.ACCOMPLISH_BUILD_ID = ht(), process.env.CLEAN_START !== "1") try {
		pn() && Y("INFO", "[Main] Migrated data from legacy userData path");
	} catch (e) {
		Y("ERROR", "[Main] Legacy data migration failed", { err: String(e) });
	}
	let r = !1;
	try {
		pt() && (r = xt().isFirstLaunch, vt()), mt().mixpanelToken && nn();
	} catch (e) {
		Y("WARN", "[Main] Analytics initialization failed", { err: String(e) });
	}
	if (await P.initialize(), process.platform === "darwin" && w.dock) {
		let e = w.isPackaged ? k.join(process.resourcesPath, "icon.png") : k.join(process.env.APP_ROOT, "resources", "icon.png"), t = on.createFromPath(e);
		t.isEmpty() || w.dock.setIcon(t);
	}
	if (await si() === "quit") {
		Y("INFO", "[Main] User chose to quit from daemon-failure modal"), w.quit();
		return;
	}
	let i = !1;
	try {
		let e = mn(), t = await _().call("legacy.importElectronStoreIfNeeded", e);
		Y("INFO", "[Main] Legacy electron-store import", t), i = t.imported;
	} catch (e) {
		Y("WARN", "[Main] Legacy electron-store import RPC failed", { err: String(e) });
	}
	try {
		await kt();
	} catch (e) {
		Y("ERROR", "[Main] Workspace initialization failed", { err: String(e) });
	}
	try {
		let e = await _().call("settings.getAll");
		try {
			D.themeSource = e.app.theme;
		} catch {}
		let t = e.huggingFaceLocalConfig;
		t?.enabled && t.selectedModelId && (Y("INFO", `[Main] Auto-starting HuggingFace server for model: ${t.selectedModelId}`), Ft(t.selectedModelId).then((e) => {
			e.success || Y("ERROR", "[Main] Failed to auto-start HuggingFace local server", { error: e.error });
		}).catch((e) => {
			Y("ERROR", "[Main] Failed to auto-start HuggingFace local server (thrown)", { err: String(e) });
		}));
		try {
			let { isFreeMode: t } = await import("./build-config-BqHR5x39.js");
			if (!t() && e.providers.connectedProviders["accomplish-ai"]) {
				let t = _();
				await t.call("provider.removeConnected", { providerId: "accomplish-ai" }), e.providers.activeProviderId === "accomplish-ai" && await t.call("provider.setActive", { providerId: null }), Y("INFO", "[Main] Removed stale accomplish-ai provider (free mode not available)");
			}
		} catch {}
	} catch (e) {
		Y("WARN", "[Main] Post-bootstrap settings snapshot read failed", { err: String(e) });
	}
	if (i) try {
		D.themeSource = (await _().call("settings.getAll")).app.theme;
	} catch {}
	try {
		let e = _(), t = await e.call("provider.getSettings");
		for (let [n, r] of Object.entries(t.connectedProviders)) {
			let t = n, i = r?.credentials?.type;
			(!i || i === "api_key") && (await g(t) || (Y("WARN", `[Main] Provider ${t} has api_key auth but key not found in secure storage`), await e.call("provider.removeConnected", { providerId: t }), Y("INFO", `[Main] Removed provider ${t} due to missing API key`)));
		}
	} catch (e) {
		Y("ERROR", "[Main] Provider validation failed", { err: String(e) });
	}
	pt() && Ue(r).catch((e) => Y("WARN", "[Main] trackAppLaunched failed", { err: String(e) }));
	let a, o;
	try {
		let { startGoogleOAuth: e, cancelGoogleOAuth: t } = await import("./google-accounts-DNHwI8o6.js");
		a = e, o = t;
	} catch (e) {
		Y("WARN", "[Main] Google OAuth helpers unavailable", { err: String(e) });
	}
	Qr(a, o), Y("INFO", "[Main] IPC handlers registered"), e();
	let s = t();
	if (s && (Ct(() => t()), Y("INFO", "[Main] Daemon notification forwarding registered"), s.on("close", (e) => {
		if (n.value || process.env.E2E_MOCK_TASK_EVENTS === "1") return;
		e.preventDefault(), s.webContents.send("app:close-requested");
		let t = async (e, r) => {
			if (E.removeListener("app:close-response", t), r === "keep-daemon") Y("INFO", "[Main] Closing app (daemon keeps running)"), n.value = !0, w.quit();
			else if (r === "stop-daemon") {
				Y("INFO", "[Main] Closing app and stopping daemon");
				try {
					let { suppressReconnect: e } = await import("./daemon-connector-BwteXUZY.js");
					e();
				} catch {}
				let { requestStopDaemonOnQuit: e } = await import("./app-shutdown-DSLmgTL0.js");
				e(), n.value = !0, w.quit();
			}
		};
		E.on("app:close-response", t);
	}), Gt(s), Y("INFO", "[Main] System tray created"), J(s), ft())) try {
		let { initUpdater: e, autoCheckForUpdates: t } = await import("./updater-CoRJUnlW.js");
		await e(s);
		let { initMenu: n } = await import("./menu-CA0U-PKN.js");
		n(), setTimeout(() => t(), 5e3), Y("INFO", "[Main] Auto-updater initialized");
	} catch (e) {
		Y("WARN", "[Main] Auto-updater init failed", { err: String(e) });
	}
	w.on("activate", () => {
		let t = C.getAllWindows();
		if (t.length === 0) {
			e();
			try {
				m()?.logEnv?.("INFO", "[Main] Application reactivated; recreated window");
			} catch {}
		} else {
			t[0].show(), t[0].focus();
			try {
				m()?.logEnv?.("INFO", "[Main] Application reactivated; showed existing window");
			} catch {}
		}
	});
}
//#endregion
//#region src/main/app-window.ts
var li = k.dirname(sn(import.meta.url));
function X(e, t) {
	try {
		let n = m();
		n?.log && n.log(e, "main", t);
	} catch {}
}
function ui() {
	return k.join(li, "../preload/index.cjs");
}
function di(e) {
	X("INFO", "[Main] Creating main application window");
	let t = process.platform === "win32" ? "icon.ico" : "icon.png", n = w.isPackaged ? k.join(process.resourcesPath, t) : k.join(process.env.APP_ROOT, "resources", t), r = on.createFromPath(n);
	process.platform === "darwin" && w.dock && !r.isEmpty() && w.dock.setIcon(r);
	let i = ui();
	X("INFO", `[Main] Using preload script: ${i}`);
	let a = new C({
		width: 1280,
		height: 800,
		minWidth: 900,
		minHeight: 600,
		title: "Accomplish",
		icon: r.isEmpty() ? void 0 : r,
		backgroundColor: D.shouldUseDarkColors ? "#171717" : "#f9f9f9",
		titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
		trafficLightPosition: {
			x: 16,
			y: 16
		},
		webPreferences: {
			preload: i,
			nodeIntegration: !1,
			contextIsolation: !0,
			spellcheck: !0
		}
	});
	a.webContents.on("context-menu", (e, t) => {
		if (!t.misspelledWord) return;
		let n = [
			...t.dictionarySuggestions.map((e) => ({
				label: e,
				click: () => a.webContents.replaceMisspelling(e)
			})),
			...t.dictionarySuggestions.length > 0 ? [{ type: "separator" }] : [],
			{
				label: "Add to Dictionary",
				click: () => a.webContents.session.addWordToSpellCheckerDictionary(t.misspelledWord)
			}
		];
		an.buildFromTemplate(n).popup();
	}), a.webContents.setWindowOpenHandler(({ url: e }) => ((e.startsWith("https:") || e.startsWith("http:")) && O.openExternal(e), { action: "deny" })), a.maximize();
	let o = global.E2E_SKIP_AUTH === !0;
	if (!w.isPackaged && !o && process.env.NODE_ENV !== "test" && a.webContents.openDevTools({ mode: "right" }), a.webContents.session.webRequest.onHeadersReceived((e, t) => {
		let n = `default-src 'self' https:; script-src ${w.isPackaged ? "'self'" : "'self' 'unsafe-inline'"}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: ws: wss:; font-src 'self' https: data:; worker-src 'self' blob:`;
		t({ responseHeaders: {
			...e.responseHeaders,
			"Content-Security-Policy": [n]
		} });
	}), e.ROUTER_URL) X("INFO", `[Main] Loading from router URL: ${e.ROUTER_URL}`), a.loadURL(e.ROUTER_URL);
	else {
		let t = k.join(e.WEB_DIST, "index.html");
		X("INFO", `[Main] Loading from file: ${t}`), a.loadFile(t);
	}
	return a;
}
//#endregion
//#region src/main/sentry-scrub.ts
var fi = [
	/\bsk-[a-zA-Z0-9_-]{20,}\b/g,
	/\bAIza[a-zA-Z0-9_-]{30,}\b/g,
	/\bkey-[a-zA-Z0-9_-]{20,}\b/g,
	/Bearer\s+[a-zA-Z0-9._\-/+=]{10,}/gi,
	/(?<=authorization['":\s]+)[a-zA-Z0-9._\-/+=]{20,}/gi,
	/"d"\s*:\s*"[A-Za-z0-9_-]{20,}"/g,
	/dpop[_-]nonce["'\s:=]+[A-Za-z0-9_-]{10,}/gi
], pi = "[REDACTED]", mi = [
	/quota/i,
	/billing/i,
	/insufficient[\s_]*(funds|quota)/i,
	/rate[\s_-]*limit/i,
	/throttl/i,
	/too[\s_]*many[\s_]*requests/i,
	/\b429\b/,
	/invalid[\s_-]*api[\s_-]*key/i,
	/n_keep.*n_ctx/i,
	/context window is too small/i,
	/context size has been exceeded/i,
	/exceeds the available context size/i,
	/inference.profile/i,
	/skill not found at url/i,
	/failed to fetch skill/i,
	/invalid github url/i,
	/url must use https/i,
	/url must be from github/i,
	/invalid url format/i,
	/skill\.md must have a name/i,
	/does not support dynamic client registration/i,
	/unable to connect/i,
	/ECONNREFUSED/,
	/ECONNRESET/,
	/ETIMEDOUT/,
	/ENOTFOUND/,
	/fetch failed/i,
	/network error/i,
	/model did not produce any response/i,
	/must call start_task_start_task before any other tool/i,
	/couldn't reach the ai model/i
];
function hi(e) {
	return mi.some((t) => t.test(e));
}
function gi(e) {
	let t = [];
	if (e.message && t.push(e.message), e.exception?.values) for (let n of e.exception.values) n.value && t.push(n.value), n.type && t.push(n.type);
	return t.some((e) => hi(e));
}
function Z(e) {
	let t = e;
	for (let e of fi) e.lastIndex = 0, t = t.replace(e, pi);
	return t;
}
function _i(e) {
	let t = {};
	for (let [n, r] of Object.entries(e)) typeof r == "string" ? t[n] = Z(r) : t[n] = r;
	return t;
}
function vi(e) {
	if (gi(e) && (e.level = "warning", e.tags = {
		...e.tags,
		operational: "true"
	}), e.message &&= Z(e.message), e.exception?.values) for (let t of e.exception.values) t.value &&= Z(t.value);
	if (e.breadcrumbs) for (let t of e.breadcrumbs) t.message &&= Z(t.message), t.data && typeof t.data == "object" && (t.data = _i(t.data));
	return e;
}
function yi(e) {
	return e.category === "console" ? null : (e.message &&= Z(e.message), e.data && typeof e.data == "object" && (e.data = _i(e.data)), e);
}
//#endregion
//#region src/main/sentry.ts
function bi() {
	let e = mt().sentryDsn;
	if (e) try {
		let t = _t();
		M.init({
			dsn: e,
			release: w.getVersion(),
			dist: `desktop-main-${t}`,
			environment: w.isPackaged ? "production" : "development",
			beforeSend: (e) => vi(e),
			beforeBreadcrumb: yi
		}), M.setTag("appTier", t), M.setTag("arch", process.arch), M.setTag("platform", process.platform), M.setTag("electronVersion", process.versions.electron);
		let n = yt();
		n && (M.setTag("deviceId", n), M.setUser({ id: n }));
	} catch (e) {
		console.error("Sentry initialization failed, continuing without error tracking:", e);
	}
}
w.setPath("userData", k.join(w.getPath("appData"), "Accomplish")), process.platform === "win32" && w.setAppUserModelId("ai.accomplish.desktop");
function Q(e, t, n) {
	try {
		let r = m();
		r?.log && r.log(e, "main", t, n);
	} catch {}
}
process.argv.includes("--e2e-skip-auth") && (global.E2E_SKIP_AUTH = !0), (process.argv.includes("--e2e-mock-tasks") || process.env.E2E_MOCK_TASK_EVENTS === "1") && (global.E2E_MOCK_TASK_EVENTS = !0);
var xi = 2e3, Si = 45e3;
async function Ci(e) {
	let t = k.join(e, "daemon.pid");
	if (!A.existsSync(t)) return "no-daemon";
	let n, r;
	try {
		let e = await import("./desktop-main-rBBKOr0V.js");
		n = e.DaemonClient, r = e.createSocketTransport;
	} catch (e) {
		return Q("WARN", "[Clean Mode] Could not load daemon-client transport; treating as no-daemon", { err: String(e) }), "no-daemon";
	}
	let i;
	try {
		i = await r({
			dataDir: e,
			connectTimeout: xi
		});
	} catch (e) {
		return Q("INFO", `[Clean Mode] Could not connect to daemon socket; leaving any stale pid alone. ${String(e)}`), "no-daemon";
	}
	let a = new n({ transport: i }), o = !1;
	try {
		let e = new Promise((e) => {
			i.onDisconnect(() => {
				o = !0, e();
			});
		});
		Q("INFO", "[Clean Mode] Connected to detached daemon; sending shutdown RPC");
		try {
			await a.call("daemon.shutdown");
		} catch (e) {
			Q("INFO", `[Clean Mode] daemon.shutdown RPC returned: ${String(e)}`);
		}
		let t = new Promise((e) => setTimeout(e, Si));
		return await Promise.race([e, t]), o ? (Q("INFO", "[Clean Mode] Detached daemon closed its socket; safe to rmSync"), "exited") : (Q("ERROR", `[Clean Mode] Confirmed-live daemon did not close within ${Si}ms; refusing to rmSync under a live owner.`), "still-alive");
	} finally {
		try {
			a.close();
		} catch {}
		try {
			i.close();
		} catch {}
	}
}
if (process.env.CLEAN_START === "1") {
	let e = w.getPath("userData");
	if (Q("INFO", `[Clean Mode] Clearing userData directory: ${e}`), await Ci(e) === "still-alive") {
		let e = `[CLEAN_START] Aborted: an Accomplish daemon is still active on this profile and did not exit within ${Si / 1e3}s. Deleting userData under a live owner would corrupt SQLite and secure-storage state.

Fully quit the app (check the system tray for a running daemon) and retry CLEAN_START, or wait for active tasks to finish and let the daemon exit naturally.`;
		Q("ERROR", e), console.error(`\n${e}\n`), process.exit(1);
	}
	try {
		A.existsSync(e) && (A.rmSync(e, {
			recursive: !0,
			force: !0
		}), Q("INFO", "[Clean Mode] Successfully cleared userData"));
	} catch (e) {
		Q("ERROR", "[Clean Mode] Failed to clear userData", { err: String(e) });
	}
	Q("INFO", "[Clean Mode] userData wiped; daemon will reinitialize on spawn");
}
w.setName("Accomplish");
var wi = k.dirname(sn(import.meta.url));
rn({ path: w.isPackaged ? k.join(process.resourcesPath, ".env") : k.join(wi, "../../.env") }), process.env.APP_ROOT = k.join(wi, "../..");
var Ti = k.join(process.env.APP_ROOT, "dist-electron");
gt(), bi();
var Ei = process.env.ACCOMPLISH_ROUTER_URL, Di = w.isPackaged ? k.join(process.resourcesPath, "web-ui") : k.join(process.env.APP_ROOT, "../web/dist/client"), $ = null, Oi = !1, ki = !1, Ai = {
	get value() {
		return Oi;
	},
	set value(e) {
		Oi = e;
	}
};
function ji() {
	$ = di({
		ROUTER_URL: Ei,
		WEB_DIST: Di
	});
}
process.on("uncaughtException", (e) => {
	try {
		m()?.log?.("ERROR", "main", `Uncaught exception: ${e.message}`, {
			name: e.name,
			stack: e.stack
		}), it(e.name || "uncaughtException", e.message || "Unknown error");
	} catch {}
}), process.on("unhandledRejection", (e) => {
	try {
		m()?.log?.("ERROR", "main", "Unhandled promise rejection", { reason: e }), it("unhandledRejection", String(e).substring(0, 500));
	} catch {}
}), w.requestSingleInstanceLock() ? (Ce(), m().logEnv("INFO", "App starting", {
	version: w.getVersion(),
	platform: process.platform,
	arch: process.arch,
	nodeVersion: process.version
}), w.on("second-instance", (e, t) => {
	$ && ($.isMinimized() && $.restore(), $.focus(), Q("INFO", "[Main] Focused existing instance after second-instance event"), ai($, t, () => $));
}), w.whenReady().then(async () => {
	await ci(ji, () => $, Ai);
})) : (Q("INFO", "[Main] Second instance attempted; quitting"), w.quit()), w.on("window-all-closed", () => {
	Q("INFO", "[Main] All windows closed — app continues in system tray");
}), w.on("before-quit", (e) => {
	if (ki) return;
	ki = !0, Oi = !0, e.preventDefault();
	let t = null;
	try {
		t = m();
	} catch {}
	Ut(t);
}), process.platform === "win32" && !w.isPackaged ? w.setAsDefaultProtocolClient("accomplish", process.execPath, [k.resolve(process.argv[1])]) : w.setAsDefaultProtocolClient("accomplish"), ri(() => $), ii(() => $), oi();
//#endregion
export { Ti as MAIN_DIST };

//# sourceMappingURL=index.js.map