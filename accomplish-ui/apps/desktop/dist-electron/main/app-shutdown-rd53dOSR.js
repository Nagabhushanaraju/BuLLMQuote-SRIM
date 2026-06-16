import { S as e, T as t, _ as n, _t as r, a as i, b as a, ft as o, g as s, gt as c, h as l, ht as u, l as d, m as f, o as p, p as m, pt as ee, v as te, w as ne, y as h } from "./id-BEgm5sXn.js";
import { r as re, t as g } from "./logging-C6nctklm.js";
import { et as _, n as ie, rt as ae } from "./events-Ba_VD2iP.js";
import { t as oe } from "./analytics-service-UJ3ooobv.js";
import "./daemon-bootstrap-BVFr6gBf.js";
import { t as se } from "./workspaceManager-BR6DH0WM.js";
import { n as ce, r as le, t as ue } from "./service-manager-CKmRCHum.js";
import "./mixpanel-service-CJ4ayGNJ.js";
import { BrowserWindow as de, Menu as fe, Tray as pe, app as v, nativeImage as me, shell as he } from "electron";
import y from "path";
import b from "fs";
import { randomUUID as ge } from "node:crypto";
import { execFileSync as _e } from "child_process";
import x from "http";
//#region src/main/providers/huggingface-local/server-state.ts
var S = {
	server: null,
	port: null,
	loadedModelId: null,
	pipeline: null,
	tokenizer: null,
	model: null,
	isLoading: !1,
	isStopping: !1
}, C = null;
function w(e) {
	C = e;
}
var T = null;
function E(e) {
	T = e;
}
var D = 0;
function O() {
	D++;
}
function k() {
	D--;
}
//#endregion
//#region src/main/providers/huggingface-local/model-loader.ts
async function A(e) {
	if (!S.isStopping && S.loadedModelId === e && S.tokenizer && S.model) {
		g().logEnv("INFO", `[HF Server] Model ${e} already loaded`);
		return;
	}
	if (C) {
		try {
			await C;
		} catch {}
		if (!S.isStopping && S.loadedModelId === e && S.tokenizer && S.model) return;
	}
	let t = (async () => {
		S.isLoading = !0;
		let t = S.isStopping;
		g().logEnv("INFO", `[HF Server] Loading model: ${e}`);
		try {
			let { env: n, AutoTokenizer: r, AutoModelForCausalLM: i } = await import("@huggingface/transformers");
			n.localModelPath = y.join(v.getPath("userData"), "hf-models"), n.allowRemoteModels = !1;
			let a = await r.from_pretrained(e), o = null, s = null;
			try {
				let e = await _().call("settings.getAll");
				o = e.huggingFaceLocalConfig?.quantization ?? null, s = e.huggingFaceLocalConfig?.devicePreference ?? null;
			} catch {}
			let c = n;
			c.backends ??= {}, c.backends.onnx ??= {}, s && s !== "auto" ? c.backends.onnx.device = s : delete c.backends.onnx.device;
			let l = o ? [o] : ["q4"], u;
			for (let t of l) try {
				u = await i.from_pretrained(e, { dtype: t });
				break;
			} catch (n) {
				if (t === l[l.length - 1] && t !== "fp32") g().logEnv("WARN", `[HF Server] Failed to load ${t} model, trying fp32: ${n}`), u = await i.from_pretrained(e, { dtype: "fp32" });
				else throw n;
			}
			if (S.isStopping || t) {
				g().logEnv("INFO", `[HF Server] Stop requested during load of ${e}; discarding.`);
				try {
					await u?.dispose?.();
				} catch {}
				throw new DOMException("Load cancelled by stopServer()", "AbortError");
			}
			if (S.model) {
				let e = Date.now();
				for (; D > 0 && Date.now() - e < 1e4;) await new Promise((e) => setTimeout(e, 100));
				try {
					await S.model.dispose?.();
				} catch {}
			}
			S.tokenizer = a, S.model = u, S.loadedModelId = e, g().logEnv("INFO", `[HF Server] Model loaded: ${e}`);
		} catch (t) {
			let n = t instanceof DOMException && t.name === "AbortError";
			throw g().logEnv(n ? "INFO" : "ERROR", `[HF Server] ${n ? "Load cancelled" : "Failed to load model"}: ${e}`, n ? void 0 : { error: String(t) }), t;
		} finally {
			S.isLoading = !1, w(null);
		}
	})();
	return w(t), t;
}
function j(e, t) {
	try {
		if (t.apply_chat_template) return t.apply_chat_template(e, {
			tokenize: !1,
			add_generation_prompt: !0
		});
	} catch {}
	return e.map((e) => e.role === "system" ? `System: ${e.content}` : e.role === "user" ? `User: ${e.content}` : `Assistant: ${e.content}`).join("\n") + "\nAssistant:";
}
//#endregion
//#region src/main/providers/huggingface-local/request-helpers.ts
function ve(e, t = 10 * 1024 * 1024) {
	return new Promise((n, r) => {
		let i = 0, a = [], o = !1;
		e.on("data", (e) => {
			if (!o) {
				if (i += e.length, i > t) {
					o = !0, r(/* @__PURE__ */ Error("PayloadTooLarge"));
					return;
				}
				a.push(e);
			}
		}), e.on("end", () => {
			o || n(Buffer.concat(a).toString("utf-8"));
		}), e.on("error", r);
	});
}
function M(e, t, n, r = "invalid_request_error") {
	e.writeHead(t, { "Content-Type": "application/json" }), e.end(JSON.stringify({ error: {
		message: n,
		type: r
	} }));
}
function ye(e, t) {
	let n = e.max_tokens ?? 512, r = e.temperature ?? .7, i = e.top_p ?? .9;
	return !Number.isFinite(n) || n < 1 || n > 32768 ? (M(t, 400, "max_tokens must be between 1 and 32768"), !1) : !Number.isFinite(r) || r < 0 || r > 2 ? (M(t, 400, "temperature must be between 0 and 2"), !1) : !Number.isFinite(i) || i <= 0 || i > 1 ? (M(t, 400, "top_p must be between 0 and 1"), !1) : !0;
}
function be(e, t) {
	let n = e.headers.origin;
	n && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(n) ? (t.setHeader("Access-Control-Allow-Origin", n), t.setHeader("Vary", "Origin")) : t.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1"), t.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS"), t.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
//#endregion
//#region src/main/providers/huggingface-local/chat-completions.ts
async function xe(e, t) {
	if (!S.tokenizer || !S.model) {
		M(t, 503, "No model loaded", "server_error");
		return;
	}
	if (!ye(e, t)) return;
	let n = e.max_tokens ?? 512, r = e.temperature ?? .7, i = e.top_p ?? .9, a = j(e.messages, S.tokenizer), o = S.tokenizer(a, { return_tensor: !0 });
	O();
	try {
		let e = await S.model.generate({
			...o,
			max_new_tokens: n,
			temperature: r,
			top_p: i,
			do_sample: r > 0
		}), a = o.input_ids.dims?.[1] || 0, s = e.slice(null, a), c = S.tokenizer.decode(s[0], { skip_special_tokens: !0 }), l = s.dims?.[1] || 0, u = a + l, d = {
			id: `chatcmpl-hf-${Date.now()}`,
			object: "chat.completion",
			created: Math.floor(Date.now() / 1e3),
			model: S.loadedModelId,
			choices: [{
				index: 0,
				message: {
					role: "assistant",
					content: c.trim()
				},
				finish_reason: "stop"
			}],
			usage: {
				prompt_tokens: a,
				completion_tokens: l,
				total_tokens: u
			}
		};
		t.writeHead(200, { "Content-Type": "application/json" }), t.end(JSON.stringify(d));
	} finally {
		k();
	}
}
async function Se(e, t) {
	if (!S.tokenizer || !S.model) {
		M(t, 503, "No model loaded", "server_error");
		return;
	}
	if (!ye(e, t)) return;
	t.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive"
	});
	let n = j(e.messages, S.tokenizer), r = S.tokenizer(n, { return_tensor: !0 }), i = e.max_tokens ?? 512, a = e.temperature ?? .7, o = e.top_p ?? .9, s = `chatcmpl-hf-${Date.now()}`;
	O();
	try {
		await S.model.generate({
			...r,
			max_new_tokens: i,
			temperature: a,
			top_p: o,
			do_sample: a > 0,
			callback_function: (e) => {
				let n = e.slice(null, -1), r = S.tokenizer;
				if (!r) return;
				let i = r.decode(n[0], { skip_special_tokens: !0 });
				if (i) {
					let e = {
						id: s,
						object: "chat.completion.chunk",
						created: Math.floor(Date.now() / 1e3),
						model: S.loadedModelId,
						choices: [{
							index: 0,
							delta: { content: i },
							finish_reason: null
						}]
					};
					t.write(`data: ${JSON.stringify(e)}\n\n`);
				}
			}
		});
		let e = {
			id: s,
			object: "chat.completion.chunk",
			created: Math.floor(Date.now() / 1e3),
			model: S.loadedModelId,
			choices: [{
				index: 0,
				delta: {},
				finish_reason: "stop"
			}]
		};
		t.write(`data: ${JSON.stringify(e)}\n\n`), t.write("data: [DONE]\n\n");
	} catch (e) {
		let n = { error: {
			message: e instanceof Error ? e.message : "Generation failed",
			type: "server_error"
		} };
		t.write(`data: ${JSON.stringify(n)}\n\n`), g().logEnv("ERROR", "[HF Server] Streaming generation error:", { error: String(e) });
	} finally {
		k(), t.writableEnded || t.end();
	}
}
//#endregion
//#region src/main/providers/huggingface-local/http-handler.ts
function Ce() {
	return async (e, t) => {
		if (be(e, t), e.method === "OPTIONS") {
			t.writeHead(204), t.end();
			return;
		}
		let n = e.url || "";
		try {
			if (e.method === "GET" && n === "/v1/models") {
				t.writeHead(200, { "Content-Type": "application/json" }), t.end(JSON.stringify({
					object: "list",
					data: S.loadedModelId ? [{
						id: S.loadedModelId,
						object: "model",
						created: Math.floor(Date.now() / 1e3),
						owned_by: "huggingface-local"
					}] : []
				}));
				return;
			}
			if (e.method === "POST" && n === "/v1/chat/completions") {
				if (S.isLoading) {
					M(t, 503, "Model is loading, please wait", "server_error");
					return;
				}
				if (!S.model || !S.tokenizer) {
					M(t, 503, "No model loaded", "server_error");
					return;
				}
				let n = await ve(e), r;
				try {
					r = JSON.parse(n);
				} catch {
					M(t, 400, "Invalid JSON in request body");
					return;
				}
				if (!Array.isArray(r.messages) || r.messages.length === 0) {
					M(t, 400, "messages must be a non-empty array");
					return;
				}
				for (let e of r.messages) if (!e || e.role === void 0 || e.content === void 0 || typeof e.content != "string" || ![
					"system",
					"user",
					"assistant"
				].includes(e.role)) {
					M(t, 400, "Invalid message format");
					return;
				}
				r.stream ? await Se(r, t) : await xe(r, t);
				return;
			}
			if (e.method === "GET" && (n === "/health" || n === "/")) {
				t.writeHead(200, { "Content-Type": "application/json" }), t.end(JSON.stringify({
					status: "ok",
					model: S.loadedModelId,
					isLoading: S.isLoading
				}));
				return;
			}
			M(t, 404, "Not found", "invalid_request");
		} catch (e) {
			if (g().logEnv("ERROR", "[HF Server] Request error:", { error: String(e) }), e.message === "PayloadTooLarge") {
				t.headersSent || M(t, 413, "Request entity too large");
				return;
			}
			t.writableEnded || (t.headersSent || t.writeHead(500, { "Content-Type": "application/json" }), t.end(JSON.stringify({ error: {
				message: e instanceof Error ? e.message : "Internal server error",
				type: "server_error"
			} })));
		}
	};
}
//#endregion
//#region src/main/providers/huggingface-local/server-lifecycle.ts
async function we(e) {
	if (T) return await T, S.loadedModelId === e && S.port !== null ? {
		success: !0,
		port: S.port
	} : we(e);
	let t = Te(e).finally(() => {
		E(null);
	});
	return E(t), t;
}
async function Te(e) {
	if (S.server) try {
		return await A(e), {
			success: !0,
			port: S.port
		};
	} catch (e) {
		return e instanceof DOMException && e.name === "AbortError" ? {
			success: !1,
			error: "Server stopped during model load"
		} : {
			success: !1,
			error: e instanceof Error ? e.message : "Failed to load model"
		};
	}
	try {
		await A(e);
	} catch (e) {
		return e instanceof DOMException && e.name === "AbortError" ? {
			success: !1,
			error: "Server stopped during model load"
		} : {
			success: !1,
			error: e instanceof Error ? e.message : "Failed to load model"
		};
	}
	return new Promise((e) => {
		let t = x.createServer(Ce());
		t.listen(0, "127.0.0.1", () => {
			let n = t.address();
			n && typeof n != "string" ? (S.server = t, S.port = n.port, g().logEnv("INFO", `[HF Server] Listening on http://127.0.0.1:${n.port}`), (async () => {
				try {
					let e = _(), t = await e.call("provider.getHuggingFaceLocalConfig");
					t && await e.call("provider.setHuggingFaceLocalConfig", { config: {
						...t,
						serverPort: n.port
					} });
				} catch (e) {
					g().logEnv("WARN", "[HF Server] Failed to persist port to config:", { error: String(e) });
				}
			})(), e({
				success: !0,
				port: n.port
			})) : e({
				success: !1,
				error: "Failed to get server address"
			});
		}), t.on("error", (t) => {
			g().logEnv("ERROR", "[HF Server] Server error:", { error: String(t) }), e({
				success: !1,
				error: t.message
			});
		});
	});
}
async function Ee() {
	S.isStopping = !0;
	let e = C;
	S.server && await new Promise((e) => {
		let t = S.server;
		"closeAllConnections" in t && typeof t.closeAllConnections == "function" && t.closeAllConnections(), t.close(() => {
			g().logEnv("INFO", "[HF Server] Server stopped"), e();
		});
	});
	let t = Date.now();
	for (; D > 0 && Date.now() - t < 1e4;) await new Promise((e) => setTimeout(e, 100));
	if (S.model) try {
		await S.model.dispose?.();
	} catch {}
	S.server = null, S.port = null, S.loadedModelId = null, S.pipeline = null, S.tokenizer = null, S.model = null, S.isLoading = !1, e && await e.catch(() => {}), S.isStopping = !1;
}
function De() {
	return {
		running: S.server !== null,
		port: S.port,
		loadedModel: S.loadedModelId,
		isLoading: S.isLoading
	};
}
async function Oe() {
	if (!S.server || !S.port) return {
		success: !1,
		error: "Server is not running"
	};
	try {
		let e = await fetch(`http://127.0.0.1:${S.port}/health`);
		return e.ok ? { success: !0 } : {
			success: !1,
			error: `Health check failed with status ${e.status}`
		};
	} catch (e) {
		return {
			success: !1,
			error: e instanceof Error ? e.message : "Connection failed"
		};
	}
}
//#endregion
//#region src/main/providers/huggingface-local/model-downloader.ts
var N = /* @__PURE__ */ new Map();
async function ke(e, t, n) {
	let r = n || "";
	r && !b.existsSync(r) && b.mkdirSync(r, { recursive: !0 });
	let i = new AbortController();
	N.set(e, { abort: i });
	try {
		t?.({
			modelId: e,
			status: "downloading",
			progress: 0
		});
		let { env: n, AutoTokenizer: i, AutoModelForCausalLM: a } = await import("@huggingface/transformers");
		r && (n.cacheDir = r), n.allowRemoteModels = !0, t?.({
			modelId: e,
			status: "downloading",
			progress: 10
		}), await i.from_pretrained(e), t?.({
			modelId: e,
			status: "downloading",
			progress: 30
		});
		try {
			await a.from_pretrained(e, { dtype: "q4" });
		} catch (n) {
			console.warn(`[HF Manager] Failed to download q4 model, trying fp32: ${n}`), t?.({
				modelId: e,
				status: "downloading",
				progress: 50
			}), await a.from_pretrained(e, { dtype: "fp32" });
		}
		return t?.({
			modelId: e,
			status: "complete",
			progress: 100
		}), { success: !0 };
	} catch (n) {
		let r = n instanceof Error ? n.message : "Unknown download error";
		return t?.({
			modelId: e,
			status: "error",
			progress: 0,
			error: r
		}), {
			success: !1,
			error: r
		};
	} finally {
		N.delete(e);
	}
}
//#endregion
//#region src/main/providers/huggingface-local/model-manager.ts
var Ae = [
	{
		id: "onnx-community/Llama-3.2-1B-Instruct-ONNX",
		displayName: "Llama 3.2 1B Instruct (ONNX)",
		downloaded: !1
	},
	{
		id: "onnx-community/Phi-3.5-mini-instruct-onnx",
		displayName: "Phi-3.5 Mini Instruct (ONNX)",
		downloaded: !1
	},
	{
		id: "onnx-community/Qwen2.5-0.5B-Instruct",
		displayName: "Qwen2.5 0.5B Instruct (ONNX)",
		downloaded: !1
	},
	{
		id: "Xenova/distilgpt2",
		displayName: "DistilGPT-2 (Tiny, for testing)",
		downloaded: !1
	}
];
function P() {
	return y.join(v.getPath("userData"), "hf-models");
}
function je(e) {
	let t = e || P();
	return b.existsSync(t) || b.mkdirSync(t, { recursive: !0 }), t;
}
function Me(e) {
	let t = e || P();
	if (!b.existsSync(t)) return [];
	let n = [];
	try {
		let e = b.readdirSync(t, { withFileTypes: !0 });
		for (let r of e) {
			if (!r.isDirectory()) continue;
			let e = y.join(t, r.name), i = b.readdirSync(e, { withFileTypes: !0 });
			for (let t of i) {
				if (!t.isDirectory()) continue;
				let i = y.join(e, t.name), a = `${r.name}/${t.name}`, o = F(i);
				n.push({
					id: a,
					displayName: t.name,
					sizeBytes: o,
					downloaded: !0
				});
			}
		}
	} catch (e) {
		console.warn("[HF Local] Error listing cached models:", e);
	}
	return n;
}
function Ne(e, t) {
	let n = je(t), r = y.resolve(n), i = y.normalize(e);
	if (!i || i.includes("\0") || y.isAbsolute(i) || i.split(y.sep).includes("..")) return {
		success: !1,
		error: "Invalid model ID"
	};
	let a = y.resolve(r, i), o = y.relative(r, a);
	if (!o || o.startsWith("..") || y.isAbsolute(o)) return {
		success: !1,
		error: "Invalid model ID"
	};
	if (!b.existsSync(a)) return {
		success: !1,
		error: "Model not found in cache"
	};
	try {
		b.rmSync(a, {
			recursive: !0,
			force: !0
		});
		let e = y.dirname(a);
		return b.readdirSync(e).length === 0 && b.rmdirSync(e), { success: !0 };
	} catch (e) {
		return {
			success: !1,
			error: e instanceof Error ? e.message : "Unknown error"
		};
	}
}
function F(e) {
	let t = 0;
	try {
		let n = b.readdirSync(e, { withFileTypes: !0 });
		for (let r of n) {
			let n = y.join(e, r.name);
			r.isFile() ? t += b.statSync(n).size : r.isDirectory() && (t += F(n));
		}
	} catch {}
	return t;
}
function Pe() {
	return P();
}
//#endregion
//#region src/main/tray.ts
var I = null, L = 0;
function Fe() {
	let e = process.platform === "win32" ? "icon.ico" : "icon.png";
	return v.isPackaged ? y.join(process.resourcesPath, e) : y.join(process.env.APP_ROOT, "resources", e);
}
function Ie(e) {
	let t = L > 0 ? `Active Tasks: ${L}` : "No Active Tasks", n = le();
	return fe.buildFromTemplate([
		{
			label: "Show Accomplish",
			click: () => {
				e && !e.isDestroyed() && (e.show(), e.focus());
			}
		},
		{ type: "separator" },
		{
			label: t,
			enabled: !1
		},
		{ type: "separator" },
		{
			label: "Start at Login",
			type: "checkbox",
			checked: n,
			click: (e) => {
				e.checked ? ce() : ue();
			}
		},
		{ type: "separator" },
		{
			label: "Quit",
			click: () => {
				v.quit();
			}
		}
	]);
}
function Le(e) {
	let t = Fe(), n = me.createFromPath(t);
	return I = new pe(process.platform === "linux" ? n.resize({
		width: 22,
		height: 22
	}) : n.resize({
		width: 16,
		height: 16
	})), I.setToolTip("Accomplish"), I.setContextMenu(Ie(e)), I.on("click", () => {
		e && !e.isDestroyed() && (e.isVisible() ? e.hide() : (e.show(), e.focus()));
	}), I;
}
function Re() {
	I && !I.isDestroyed() && (I.destroy(), I = null);
}
//#endregion
//#region src/main/services/cdp-client.ts
var ze = 1e4, Be = class {
	ws = null;
	nextId = 1;
	pending = /* @__PURE__ */ new Map();
	listeners = /* @__PURE__ */ new Set();
	async connect(e) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
		let t = new WebSocket(e);
		await new Promise((n, r) => {
			let i = () => {
				o(), n();
			}, a = () => {
				o(), r(/* @__PURE__ */ Error(`Failed to connect to CDP endpoint: ${e}`));
			}, o = () => {
				t.removeEventListener("open", i), t.removeEventListener("error", a);
			};
			t.addEventListener("open", i), t.addEventListener("error", a);
		}), t.addEventListener("message", (e) => {
			this.handleMessage(e.data);
		}), t.addEventListener("close", () => {
			this.rejectAllPending(/* @__PURE__ */ Error("CDP websocket closed"));
		}), t.addEventListener("error", () => {
			this.rejectAllPending(/* @__PURE__ */ Error("CDP websocket error"));
		}), this.ws = t;
	}
	onEvent(e) {
		return this.listeners.add(e), () => {
			this.listeners.delete(e);
		};
	}
	async sendCommand(e, t, n) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw Error("CDP websocket is not connected");
		let r = this.nextId++, i = {
			id: r,
			method: e
		};
		return t && (i.params = t), n && (i.sessionId = n), new Promise((t, n) => {
			let a = setTimeout(() => {
				this.pending.delete(r), n(/* @__PURE__ */ Error(`CDP command timed out: ${e}`));
			}, ze);
			this.pending.set(r, {
				resolve: t,
				reject: n,
				timeout: a
			}), this.ws?.send(JSON.stringify(i));
		});
	}
	async disconnect() {
		this.rejectAllPending(/* @__PURE__ */ Error("CDP disconnected")), this.ws && this.ws.readyState < WebSocket.CLOSING && this.ws.close(), this.ws = null;
	}
	async handleMessage(e) {
		let t = await this.toText(e);
		if (!t) return;
		let n;
		try {
			n = JSON.parse(t);
		} catch {
			return;
		}
		if (typeof n.id == "number") {
			let e = this.pending.get(n.id);
			if (!e) return;
			clearTimeout(e.timeout), this.pending.delete(n.id), n.error?.message ? e.reject(Error(n.error.message)) : e.resolve(n.result ?? {});
			return;
		}
		for (let e of this.listeners) e(n);
	}
	rejectAllPending(e) {
		for (let t of this.pending.values()) clearTimeout(t.timeout), t.reject(e);
		this.pending.clear();
	}
	async toText(e) {
		return typeof e == "string" ? e : e instanceof ArrayBuffer ? Buffer.from(e).toString("utf8") : ArrayBuffer.isView(e) ? Buffer.from(e.buffer, e.byteOffset, e.byteLength).toString("utf8") : typeof Blob < "u" && e instanceof Blob ? e.text() : null;
	}
}, R = "127.0.0.1", Ve = {
	width: 1280,
	height: 720
}, He = 1e4;
function z(e, t) {
	for (let n of de.getAllWindows()) n.isDestroyed() || n.webContents.send(e, t);
}
function B(e, t, n, r) {
	z("browser:status", {
		taskId: e,
		pageName: t,
		status: n,
		message: r,
		timestamp: Date.now()
	});
}
function Ue(e, t, n, r, i) {
	z("browser:frame", {
		taskId: e,
		pageName: t,
		frame: n,
		width: r,
		height: i,
		timestamp: Date.now()
	});
}
function We(e, t, n) {
	z("browser:navigate", {
		taskId: e,
		pageName: t,
		url: n,
		timestamp: Date.now()
	});
}
async function V(e, t) {
	let n = new AbortController(), r = setTimeout(() => n.abort(), He);
	try {
		let r = await fetch(e, {
			...t,
			signal: n.signal
		});
		if (!r.ok) throw Error(`HTTP ${r.status} from ${e}`);
		return await r.json();
	} finally {
		clearTimeout(r);
	}
}
async function Ge(e, t) {
	let n = `${e}-${t}`, r = await V(`http://${R}:${p}/pages`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			name: n,
			viewport: Ve
		})
	});
	if (!r.targetId) throw Error(`No targetId for page ${n}`);
	return r.targetId;
}
async function Ke() {
	let e = await V(`http://${R}:${i}/json/version`);
	if (!e.webSocketDebuggerUrl) throw Error("CDP endpoint missing webSocketDebuggerUrl");
	return e.webSocketDebuggerUrl;
}
//#endregion
//#region src/main/services/browserPreview.ts
var H = "main", qe = 50, Je = 3, Ye = 960, Xe = 640, U = /* @__PURE__ */ new Map(), W = !1;
async function Ze(e, t = H) {
	let n = typeof t == "string" && t.trim() ? t.trim() : H;
	await G(e), B(e, n, "starting");
	let r = new Be();
	try {
		let [t, i] = await Promise.all([Ke(), Ge(e, n)]);
		await r.connect(t);
		let a = (await r.sendCommand("Target.attachToTarget", {
			targetId: i,
			flatten: !0
		})).sessionId, o = r.onEvent((t) => {
			if (!(t.sessionId !== a || !t.method)) if (t.method === "Page.screencastFrame") {
				let i = t.params;
				Ue(e, n, i.data, i.metadata?.deviceWidth, i.metadata?.deviceHeight), r.sendCommand("Page.screencastFrameAck", { sessionId: i.sessionId }, a).catch(() => {});
			} else if (t.method === "Page.frameNavigated") {
				let r = t.params;
				r.frame?.url && We(e, n, r.frame.url);
			} else t.method === "Page.loadEventFired" && B(e, n, "streaming");
		});
		await r.sendCommand("Page.startScreencast", {
			format: "jpeg",
			quality: qe,
			everyNthFrame: Je,
			maxWidth: Ye,
			maxHeight: Xe
		}, a), U.set(e, {
			pageName: n,
			cdp: r,
			cdpSessionId: a,
			unsubscribe: o
		}), W = !0, B(e, n, "streaming"), g().logBrowser("INFO", `[BrowserPreview] Stream started for task ${e}, page ${n}`);
	} catch (t) {
		let i = t instanceof Error ? t.message : String(t);
		g().logBrowser("ERROR", `[BrowserPreview] Failed to start stream for task ${e}: ${i}`), B(e, n, "error", i), await r.disconnect().catch(() => {});
	}
}
async function G(e) {
	let t = U.get(e);
	if (t) {
		U.delete(e), W = U.size > 0;
		try {
			t.unsubscribe(), await t.cdp.sendCommand("Page.stopScreencast", {}, t.cdpSessionId).catch(() => {}), await t.cdp.disconnect(), B(e, t.pageName, "stopped"), g().logBrowser("INFO", `[BrowserPreview] Stream stopped for task ${e}`);
		} catch (t) {
			g().logBrowser("WARN", `[BrowserPreview] Error stopping stream for task ${e}: ${String(t)}`);
		}
	}
}
async function K() {
	let e = Array.from(U.keys());
	await Promise.all(e.map((e) => G(e)));
}
function Qe() {
	return W;
}
//#endregion
//#region src/main/opencode/vertex-cleanup.ts
var $e = "vertex-sa-key.json";
function q(e, t, n) {
	try {
		let r = g();
		r?.log && r.log(e, "opencode", t, n);
	} catch {}
}
function J() {
	try {
		let e = y.join(v.getPath("userData"), $e);
		b.existsSync(e) && (b.unlinkSync(e), q("INFO", "[Vertex] Cleaned up service account key file"));
	} catch (e) {
		q("WARN", "[Vertex] Failed to clean up service account key file", { error: String(e) });
	}
}
//#endregion
//#region src/main/opencode/dev-browser-shutdown.ts
function et(e, t, n) {
	try {
		let r = g();
		r?.log && r.log(e, "opencode", t, n);
	} catch {}
}
async function tt() {
	et("INFO", "[Browser] Sending shutdown request to dev-browser server..."), await d({
		devBrowserPort: p,
		devBrowserCdpPort: i
	});
}
//#endregion
//#region src/main/opencode/cli-resolver.ts
function Y() {
	return {
		isPackaged: v.isPackaged,
		resourcesPath: process.resourcesPath,
		appPath: v.getAppPath()
	};
}
function X() {
	let e = f(Y());
	if (e) return {
		command: e.cliPath,
		args: []
	};
	throw Error("OpenCode CLI executable not found");
}
function nt() {
	return m(Y());
}
function rt() {
	try {
		X();
	} catch {
		return null;
	}
	if (v.isPackaged) try {
		let e = process.platform === "win32" ? "opencode-windows-x64" : "opencode-ai", t = y.join(process.resourcesPath, "app.asar.unpacked", "node_modules", e, "package.json");
		if (b.existsSync(t)) return JSON.parse(b.readFileSync(t, "utf-8")).version;
	} catch {}
	try {
		let { command: e } = X(), t = _e(e, ["--version"], {
			encoding: "utf-8",
			timeout: 5e3,
			windowsHide: !0
		}).trim(), n = t.match(/(\d+\.\d+\.\d+)/);
		return n ? n[1] : t;
	} catch {
		return null;
	}
}
//#endregion
//#region src/main/opencode/index.ts
async function it() {
	return nt();
}
async function at() {
	return rt();
}
//#endregion
//#region src/main/oauth-callback-server.ts
var ot = 6e4, st = "<!DOCTYPE html>\n<html><head><title>Authentication Successful</title></head>\n<body style=\"font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0\">\n<div style=\"text-align:center\"><h1>Authentication successful</h1><p>You can close this tab.</p></div>\n</body></html>", ct = "<!DOCTYPE html>\n<html><head><title>Authentication Failed</title></head>\n<body style=\"font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0\">\n<div style=\"text-align:center\"><h1>Authentication failed</h1><p>Missing code or state parameter.</p></div>\n</body></html>";
function lt(e) {
	return ct.replace("Missing code or state parameter.", e);
}
function Z(e) {
	e.closeAllConnections(), e.close();
}
async function ut(e = {}) {
	let t = e.host ?? "127.0.0.1", n = e.port ?? 0, r = e.callbackPath ?? "/callback", i = e.timeoutMs ?? ot, a, o, s = !1, c = new Promise((e, t) => {
		a = e, o = t;
	}), l = x.createServer((e, n) => {
		if (!e.url?.startsWith(r)) {
			n.writeHead(404), n.end();
			return;
		}
		let i = new URL(e.url, `http://${t}`), c = i.searchParams.get("code"), f = i.searchParams.get("state"), p = i.searchParams.get("error"), m = i.searchParams.get("error_description");
		if (p) {
			let e = m ?? p;
			n.writeHead(400, { "Content-Type": "text/html" }), n.end(lt(e), () => {
				s || (s = !0, clearTimeout(d), Z(l), o(Error(e)));
			});
			return;
		}
		if (!c || !f) {
			n.writeHead(400, { "Content-Type": "text/html" }), n.end(ct);
			return;
		}
		n.writeHead(200, { "Content-Type": "text/html" }), n.end(st, () => {
			s || (s = !0, clearTimeout(d), Z(l), a({
				code: c,
				state: f,
				redirectUri: u
			}));
		});
	});
	await new Promise((e, r) => {
		l.listen(n, t, () => e()), l.on("error", r);
	});
	let u = `http://${t}:${l.address().port}${r}`, d = setTimeout(() => {
		s || (s = !0, Z(l), o(/* @__PURE__ */ Error("OAuth callback timed out")));
	}, i);
	return {
		redirectUri: u,
		waitForCallback: () => c,
		shutdown: () => {
			s || (s = !0, clearTimeout(d), Z(l), o(/* @__PURE__ */ Error("OAuth callback server shut down")));
		}
	};
}
//#endregion
//#region src/main/opencode/auth-login-error.ts
var Q = class extends Error {
	constructor(e, t) {
		super(e, t), this.name = "AuthLoginError";
	}
}, dt = new class {
	activeCallbackServer = null;
	isDisposed = !1;
	isInProgress() {
		return this.activeCallbackServer !== null && !this.isDisposed;
	}
	async start() {
		if (this.isInProgress()) throw new Q("A Slack MCP OAuth flow is already running.");
		let e = null;
		try {
			let n = await c(h), i = await r(h), a = i.scopesSupported ?? n.scopesSupported;
			if (!a || a.length === 0) throw new Q("Slack MCP did not advertise any OAuth scopes.");
			e = await this.startCallbackServer();
			let s = e.redirectUri, l = ee(), d = ge();
			ne({
				codeVerifier: l.codeVerifier,
				oauthState: d
			});
			let f = new URL("/", i.resource).toString(), p = o({
				authorizationEndpoint: n.authorizationEndpoint,
				clientId: te,
				redirectUri: s,
				codeChallenge: l.codeChallenge,
				state: d,
				scope: a.join(" "),
				extraParams: { resource: f }
			});
			await he.openExternal(p);
			let m = await e.waitForCallback();
			if (m.state !== d) throw new Q("Slack authentication failed because the OAuth state did not match.");
			t(await u({
				tokenEndpoint: n.tokenEndpoint,
				code: m.code,
				codeVerifier: l.codeVerifier,
				clientId: te,
				redirectUri: s
			}));
		} catch (e) {
			throw a(), mt(e);
		} finally {
			this.activeCallbackServer = null, e?.shutdown();
		}
	}
	async cancel() {
		if (!this.activeCallbackServer) return;
		let e = this.activeCallbackServer;
		this.activeCallbackServer = null, e.shutdown(), a();
	}
	dispose() {
		this.isDisposed || (this.isDisposed = !0, this.activeCallbackServer && (this.activeCallbackServer.shutdown(), this.activeCallbackServer = null, a()));
	}
	async startCallbackServer() {
		try {
			let t = await ut({
				host: l,
				port: n,
				callbackPath: s,
				timeoutMs: 5 * 6e4
			});
			if (t.redirectUri !== e()) throw t.shutdown(), new Q(`Slack callback server started with unexpected redirect URI: ${t.redirectUri}`);
			return this.activeCallbackServer = t, t;
		} catch (e) {
			throw mt(e);
		}
	}
}();
async function ft() {
	await dt.start();
}
async function pt() {
	a();
}
function mt(t) {
	return t instanceof Q ? t : t instanceof Error && t.code === "EADDRINUSE" ? new Q(`Slack authentication could not start because ${e()} is already in use.`, { cause: t }) : t instanceof Error ? new Q(`Slack authentication failed: ${t.message}`, { cause: t }) : new Q(`Slack authentication failed: ${String(t)}`);
}
//#endregion
//#region src/main/app-shutdown.ts
var ht = !1;
function gt() {
	ht = !0;
}
async function $(e, t, n) {
	return Promise.race([e, new Promise((e, r) => setTimeout(() => r(/* @__PURE__ */ Error(`${n} timed out after ${t}ms`)), t))]);
}
async function _t(e) {
	Re();
	try {
		await $(tt(), 5e3, "Dev-browser shutdown");
	} catch (t) {
		e?.logEnv("ERROR", `[Main] Failed to stop dev-browser server: ${String(t)}`);
	}
	try {
		await $(K(), 5e3, "Stopping browser preview streams");
	} catch (t) {
		e?.logEnv("ERROR", `[Main] Failed to stop browser preview streams: ${String(t)}`);
	}
	try {
		await $(Ee(), 5e3, "HuggingFace server stop");
	} catch (t) {
		e?.logEnv("ERROR", `[Main] Failed to stop HuggingFace server: ${String(t)}`);
	}
	try {
		J();
	} catch (t) {
		e?.logEnv("ERROR", `[Main] Error during cleanupVertexServiceAccountKey: ${String(t)}`);
	}
	try {
		dt.dispose();
	} catch (t) {
		e?.logEnv("ERROR", `[Main] Error during slackMcpOAuthFlow.dispose: ${String(t)}`);
	}
	try {
		se();
	} catch (t) {
		e?.logEnv("ERROR", `[Main] Error during workspaceManager.close: ${String(t)}`);
	}
	try {
		await ie(), oe();
	} catch (t) {
		e?.logEnv("ERROR", `[Main] Error during analytics flush: ${String(t)}`);
	}
	if (ht) try {
		await _().call("daemon.shutdown").catch(() => {});
	} catch (t) {
		e?.logEnv("INFO", `[Main] daemon.shutdown skipped: ${String(t)}`);
	}
	ae();
	try {
		re();
	} finally {
		v.quit();
	}
}
//#endregion
export { Oe as S, Me as _, ut as a, we as b, J as c, K as d, G as f, Pe as g, Ne as h, pt as i, Qe as l, Ae as m, _t as n, at as o, Le as p, ft as r, it as s, gt as t, Ze as u, ke as v, Ee as x, De as y };

//# sourceMappingURL=app-shutdown-rd53dOSR.js.map