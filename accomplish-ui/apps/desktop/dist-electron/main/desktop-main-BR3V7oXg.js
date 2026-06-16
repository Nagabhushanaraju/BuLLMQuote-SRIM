import { c as e, f as t, i as n, it as r, s as i, st as a, vt as o } from "./id-CqFLcoJO.js";
import s from "path";
import c from "fs";
import { connect as l } from "node:net";
import { createHash as u } from "node:crypto";
import { homedir as d, platform as f } from "node:os";
import { join as p } from "node:path";
//#region ../../packages/agent-core/src/daemon/client.ts
var m = 3e4, h = class {
	transport;
	timeout;
	nextId = 1;
	pending = /* @__PURE__ */ new Map();
	notificationHandlers = /* @__PURE__ */ new Map();
	constructor(e) {
		this.transport = e.transport, this.timeout = e.timeout ?? m, this.transport.onMessage((e) => {
			this.handleMessage(e);
		});
	}
	async call(e, t, n) {
		let r = this.nextId++, i = n?.timeoutMs ?? this.timeout, a = {
			jsonrpc: "2.0",
			id: r,
			method: e,
			params: t
		};
		return new Promise((t, n) => {
			let o = setTimeout(() => {
				this.pending.delete(r), n(/* @__PURE__ */ Error(`RPC timeout: ${e} (${i}ms)`));
			}, i);
			this.pending.set(r, {
				resolve: t,
				reject: n,
				timer: o
			}), this.transport.send(a);
		});
	}
	onNotification(e, t) {
		let n = this.notificationHandlers.get(e) ?? [];
		n.push(t), this.notificationHandlers.set(e, n);
	}
	offNotification(e, t) {
		let n = this.notificationHandlers.get(e);
		if (!n) return;
		let r = n.indexOf(t);
		r !== -1 && n.splice(r, 1);
	}
	async ping() {
		return this.call("daemon.ping");
	}
	close() {
		for (let [e, t] of this.pending) clearTimeout(t.timer), t.reject(/* @__PURE__ */ Error("Client closed")), this.pending.delete(e);
		this.notificationHandlers.clear(), this.transport.close();
	}
	handleMessage(e) {
		if ("id" in e && !("method" in e)) {
			let t = e, n = this.pending.get(t.id);
			if (!n) return;
			if (this.pending.delete(t.id), clearTimeout(n.timer), t.error) {
				let e = Error(t.error.message);
				e.code = t.error.code ?? o.INTERNAL_ERROR, n.reject(e);
			} else n.resolve(t.result);
			return;
		}
		if ("method" in e && !("id" in e)) {
			let t = e, n = this.notificationHandlers.get(t.method);
			if (n) for (let e of n) e(t.params);
		}
	}
}, g = ".accomplish", _ = "daemon.sock", v = "daemon.pid", y = "accomplish-daemon";
function b() {
	return p(d(), g);
}
function x(e) {
	let t = e ?? b();
	return f() === "win32" ? `\\\\.\\pipe\\${y}-${u("sha256").update(t).digest("hex").slice(0, 12)}` : p(t, _);
}
function S(e) {
	return p(e ?? b(), v);
}
//#endregion
//#region ../../packages/agent-core/src/daemon/socket-transport.ts
var C = 1 * 1024 * 1024;
async function w(e = {}) {
	return E(await T(e.socketPath ?? x(e.dataDir), e.connectTimeout ?? 5e3));
}
function T(e, t) {
	return new Promise((n, r) => {
		let i = setTimeout(() => {
			a.destroy(), r(/* @__PURE__ */ Error(`Socket connection timeout after ${t}ms: ${e}`));
		}, t), a = l({ path: e }, () => {
			clearTimeout(i), n(a);
		});
		a.on("error", (e) => {
			clearTimeout(i), r(e);
		});
	});
}
function E(e) {
	let t = [], n = [], r = "", i = !1;
	return e.setEncoding("utf8"), e.on("data", (n) => {
		if (i) return;
		if (r += n, r.length > C) {
			console.error("[SocketTransport] Buffer overflow — closing connection"), e.destroy();
			return;
		}
		let a = r.split("\n");
		r = a.pop() ?? "";
		for (let e of a) {
			let n = e.trim();
			if (n) try {
				let e = JSON.parse(n);
				for (let n of t) n(e);
			} catch {
				console.warn("[SocketTransport] Failed to parse message:", n.slice(0, 100));
			}
		}
	}), e.on("close", () => {
		if (!i) {
			i = !0;
			for (let e of n) e();
		}
	}), e.on("error", (t) => {
		if (console.error("[SocketTransport] Socket error:", t.message), !i) {
			i = !0, e.destroy();
			for (let e of n) e();
		}
	}), {
		send(t) {
			if (i || e.destroyed) return;
			let n = JSON.stringify(t) + "\n";
			e.write(n);
		},
		onMessage(e) {
			t.push(e);
		},
		onDisconnect(e) {
			n.push(e);
		},
		close() {
			i || (i = !0, t.length = 0, n.length = 0, e.destroyed || e.destroy());
		}
	};
}
//#endregion
//#region ../../packages/agent-core/src/internal/classes/speech-api.ts
var D = r({ prefix: "SpeechAPI" }), O = 3e4;
async function k(e) {
	if (!e || !e.trim()) return {
		valid: !1,
		error: "API key is required"
	};
	try {
		let t = await a("https://api.elevenlabs.io/v1/models", {
			method: "GET",
			headers: { "xi-api-key": e.trim() }
		}, O);
		return t.ok ? { valid: !0 } : t.status === 401 || t.status === 403 ? {
			valid: !1,
			error: "Invalid API key. Please check your ElevenLabs API key."
		} : {
			valid: !1,
			error: `API error: ${(await t.json().catch(() => ({})))?.error?.message || `API returned status ${t.status}`}`
		};
	} catch (e) {
		return e instanceof Error && e.name === "AbortError" ? {
			valid: !1,
			error: "Request timed out. Please check your internet connection."
		} : {
			valid: !1,
			error: `Network error: ${e instanceof Error ? e.message : "Unknown error"}`
		};
	}
}
function A(e) {
	if (typeof e == "string") return e;
	if (e && typeof e == "object") {
		let t = e, n = t.message ?? t.status;
		return typeof n == "string" ? n : JSON.stringify(n === void 0 ? e : n);
	}
	return "";
}
function j(e, t, n) {
	let r = e?.detail;
	if (r !== void 0) {
		let e = A(r);
		if (e) return e;
	}
	let i = e?.error?.message;
	if (i !== void 0) return typeof i == "string" ? i : JSON.stringify(i);
	let a = e?.message;
	return a === void 0 ? t ? t.substring(0, 200) : n || "Unknown API error" : typeof a == "string" ? a : JSON.stringify(a);
}
async function M(e) {
	let t = await e.text().catch(() => ""), n = {};
	try {
		n = JSON.parse(t);
	} catch {}
	return D.error("[ElevenLabs] API error:", {
		status: e.status,
		statusText: e.statusText,
		errorText: t.substring(0, 500)
	}), e.status === 401 || e.status === 403 ? {
		success: !1,
		error: {
			code: "INVALID_API_KEY",
			message: "Invalid or expired ElevenLabs API key. Please check your settings."
		}
	} : e.status === 429 ? {
		success: !1,
		error: {
			code: "RATE_LIMIT",
			message: "Rate limit exceeded. Please wait a moment and try again."
		}
	} : {
		success: !1,
		error: {
			code: "TRANSCRIPTION_FAILED",
			message: `Transcription failed: ${j(n, t, e.statusText)}`
		}
	};
}
async function N(e, t, n, r) {
	let i = Date.now();
	D.info("[ElevenLabs] Starting transcription:", {
		audioSize: t.length,
		mimeType: n,
		modelId: r
	});
	try {
		let o = new Blob([new Uint8Array(t)], { type: n });
		D.info("[ElevenLabs] Created blob:", {
			blobSize: o.size,
			blobType: o.type
		});
		let s = new FormData();
		s.append("file", o, "audio.webm"), s.append("model_id", r);
		let c = await a("https://api.elevenlabs.io/v1/speech-to-text", {
			method: "POST",
			headers: { "xi-api-key": e },
			body: s
		}, O);
		if (!c.ok) return M(c);
		let l = Date.now() - i, u = await c.json();
		return u.text ? {
			success: !0,
			result: {
				text: u.text.trim(),
				confidence: u.confidence,
				duration: l,
				timestamp: Date.now()
			}
		} : {
			success: !1,
			error: {
				code: "EMPTY_RESULT",
				message: "No speech was recognized. Please try again."
			}
		};
	} catch (e) {
		return e instanceof Error && e.name === "AbortError" ? {
			success: !1,
			error: {
				code: "TIMEOUT",
				message: "Transcription request timed out. Please try again."
			}
		} : {
			success: !1,
			error: {
				code: "NETWORK_ERROR",
				message: `Network error during transcription: ${e instanceof Error ? e.message : "Unknown error"}`
			}
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/internal/classes/SpeechService.ts
var P = class {
	storage;
	constructor(e) {
		this.storage = e;
	}
	getElevenLabsApiKey() {
		let e = this.storage.getApiKey("elevenlabs");
		return e && e.trim() ? e : null;
	}
	isElevenLabsConfigured() {
		return this.getElevenLabsApiKey() !== null;
	}
	async validateElevenLabsApiKey(e) {
		let t = e || this.getElevenLabsApiKey();
		return !t || !t.trim() ? {
			valid: !1,
			error: "API key is required"
		} : k(t);
	}
	async transcribeAudio(e, t = "audio/webm") {
		let n = this.getElevenLabsApiKey(), r = process.env.ELEVENLABS_STT_MODEL_ID?.trim() || "scribe_v2";
		return n ? N(n, e, t, r) : {
			success: !1,
			error: {
				code: "MISSING_API_KEY",
				message: "ElevenLabs API key is not configured. Please add it in settings."
			}
		};
	}
};
//#endregion
//#region ../../packages/agent-core/src/factories/speech.ts
function F(e) {
	return new P(e.storage);
}
//#endregion
//#region ../../packages/agent-core/src/internal/classes/LogFileWriter.ts
var I = class {
	currentDate = "";
	currentFilePath = "";
	buffer = [];
	flushTimer = null;
	fileSizeExceeded = !1;
	constructor(e) {
		this.logDir = e;
	}
	initialize() {
		c.existsSync(this.logDir) || c.mkdirSync(this.logDir, { recursive: !0 }), this.cleanupOldLogs(), this.updateCurrentFile(), this.flushTimer = setInterval(() => this.flush(), i);
	}
	write(e, n, r) {
		if (this.fileSizeExceeded) {
			let e = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
			if (e !== this.currentDate) this.currentDate = e, this.currentFilePath = s.join(this.logDir, `app-${e}.log`), this.fileSizeExceeded = !1;
			else return;
		}
		let i = {
			timestamp: (/* @__PURE__ */ new Date()).toISOString(),
			level: e,
			source: n,
			message: t(r)
		};
		this.buffer.push(i), this.buffer.length >= 100 && this.flush();
	}
	flush() {
		if (this.buffer.length === 0) return;
		if (this.updateCurrentFile(), this.checkFileSize()) {
			this.fileSizeExceeded = !0, console.error("[LogFileWriter] Max file size exceeded, stopping writes");
			return;
		}
		let e = this.buffer.map((e) => `[${e.timestamp}] [${e.level}] [${e.source}] ${e.message}`);
		try {
			c.appendFileSync(this.currentFilePath, e.join("\n") + "\n"), this.buffer = [];
		} catch (e) {
			console.error("[LogFileWriter] Failed to write logs:", e), this.buffer.length > 1e3 && (console.error("[LogFileWriter] Buffer overflow - dropping oldest entries"), this.buffer = this.buffer.slice(-100));
		}
	}
	getCurrentLogPath() {
		return this.updateCurrentFile(), this.currentFilePath;
	}
	getLogDir() {
		return this.logDir;
	}
	shutdown() {
		this.flushTimer &&= (clearInterval(this.flushTimer), null), this.flush();
	}
	updateCurrentFile() {
		let e = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
		if (e !== this.currentDate) {
			if (this.currentDate && this.buffer.length > 0 && this.currentFilePath) {
				let e = this.buffer.map((e) => `[${e.timestamp}] [${e.level}] [${e.source}] ${e.message}`);
				try {
					c.appendFileSync(this.currentFilePath, e.join("\n") + "\n"), this.buffer = [];
				} catch (e) {
					console.error("[LogFileWriter] Failed to write logs on date change:", e);
				}
			}
			this.currentDate = e, this.currentFilePath = s.join(this.logDir, `app-${e}.log`), this.fileSizeExceeded = !1;
		}
	}
	checkFileSize() {
		try {
			return c.existsSync(this.currentFilePath) ? c.statSync(this.currentFilePath).size >= e : !1;
		} catch {
			return !1;
		}
	}
	cleanupOldLogs() {
		try {
			let e = c.readdirSync(this.logDir), t = /* @__PURE__ */ new Date();
			t.setDate(t.getDate() - 7);
			for (let n of e) {
				if (!n.startsWith("app-") || !n.endsWith(".log")) continue;
				let e = n.match(/app-(\d{4}-\d{2}-\d{2})\.log/);
				if (e && new Date(e[1]) < t) {
					let e = s.join(this.logDir, n);
					c.unlinkSync(e), console.log(`[LogFileWriter] Deleted old log file: ${n}`);
				}
			}
		} catch (e) {
			console.error("[LogFileWriter] Failed to cleanup old logs:", e);
		}
	}
}, L = {
	log: console.log.bind(console),
	warn: console.warn.bind(console),
	error: console.error.bind(console),
	debug: console.debug.bind(console)
}, R = class {
	initialized = !1;
	constructor(e) {
		this.writer = e;
	}
	initialize() {
		this.initialized || (this.writer.initialize(), console.log = (...e) => {
			try {
				L.log(...e);
			} catch {}
			this.captureConsole("INFO", e);
		}, console.warn = (...e) => {
			try {
				L.warn(...e);
			} catch {}
			this.captureConsole("WARN", e);
		}, console.error = (...e) => {
			try {
				L.error(...e);
			} catch {}
			this.captureConsole("ERROR", e);
		}, console.debug = (...e) => {
			try {
				L.debug(...e);
			} catch {}
			this.captureConsole("DEBUG", e);
		}, this.initialized = !0, this.log("INFO", "main", "LogCollector initialized"));
	}
	log(e, t, n, r) {
		let i = n;
		if (r !== void 0) try {
			i += " " + JSON.stringify(r);
		} catch {
			i += " [unserializable data]";
		}
		this.writer.write(e, t, i);
	}
	logMcp(e, t, n) {
		this.log(e, "mcp", t, n);
	}
	logBrowser(e, t, n) {
		this.log(e, "browser", t, n);
	}
	logOpenCode(e, t, n) {
		this.log(e, "opencode", t, n);
	}
	logEnv(e, t, n) {
		this.log(e, "env", t, n);
	}
	logIpc(e, t, n) {
		this.log(e, "ipc", t, n);
	}
	getCurrentLogPath() {
		return this.writer.getCurrentLogPath();
	}
	getLogDir() {
		return this.writer.getLogDir();
	}
	flush() {
		this.writer.flush();
	}
	shutdown() {
		this.initialized &&= (this.log("INFO", "main", "LogCollector shutting down"), console.log = L.log, console.warn = L.warn, console.error = L.error, console.debug = L.debug, this.writer.shutdown(), !1);
	}
	captureConsole(e, t) {
		let r = t.map((e) => {
			if (typeof e == "string") return e;
			try {
				return JSON.stringify(e);
			} catch {
				return String(e);
			}
		}).join(" "), i = n(r);
		this.writer.write(e, i, r);
	}
};
//#endregion
//#region ../../packages/agent-core/src/factories/log-writer.ts
function z(e) {
	let t = new I(e.logDir), n = new R(t);
	return {
		initialize() {
			n.initialize();
		},
		write(e, n, r) {
			t.write(e, n, r);
		},
		log(e, t, r, i) {
			n.log(e, t, r, i);
		},
		logMcp(e, t, r) {
			n.logMcp(e, t, r);
		},
		logBrowser(e, t, r) {
			n.logBrowser(e, t, r);
		},
		logOpenCode(e, t, r) {
			n.logOpenCode(e, t, r);
		},
		logEnv(e, t, r) {
			n.logEnv(e, t, r);
		},
		logIpc(e, t, r) {
			n.logIpc(e, t, r);
		},
		flush() {
			n.flush();
		},
		getCurrentLogPath() {
			return n.getCurrentLogPath();
		},
		getLogDir() {
			return n.getLogDir();
		},
		shutdown() {
			n.shutdown();
		}
	};
}
//#endregion
export { S as a, b as i, F as n, x as o, w as r, h as s, z as t };

//# sourceMappingURL=desktop-main-BR3V7oXg.js.map