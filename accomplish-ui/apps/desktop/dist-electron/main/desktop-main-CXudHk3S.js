import { c as LOG_MAX_FILE_SIZE_BYTES, f as redact, i as detectLogSource, it as createConsoleLogger, s as LOG_BUFFER_FLUSH_INTERVAL_MS, st as fetchWithTimeout, vt as JSON_RPC_ERRORS } from "./id-BkuVT4wi.js";
import path from "path";
import fs from "fs";
import { connect } from "node:net";
import { createHash } from "node:crypto";
import { homedir, platform } from "node:os";
import { join } from "node:path";
//#region ../../packages/agent-core/src/daemon/client.ts
var DEFAULT_TIMEOUT_MS = 3e4;
var DaemonClient = class {
	transport;
	timeout;
	nextId = 1;
	pending = /* @__PURE__ */ new Map();
	notificationHandlers = /* @__PURE__ */ new Map();
	constructor(options) {
		this.transport = options.transport;
		this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
		this.transport.onMessage((msg) => {
			this.handleMessage(msg);
		});
	}
	/**
	* Send a typed RPC request to the daemon and await the result.
	*
	* `options.timeoutMs` lets a single call override the client-wide default
	* (typically 30s). Required for long-blocking RPCs like
	* `auth.openai.awaitCompletion`, which the daemon may legitimately hold
	* open for up to two minutes while the user completes the OAuth flow in
	* a browser. Without this override, OAuth always failed at the 30s mark
	* with `RPC timeout: auth.openai.awaitCompletion (30000ms)` even though
	* the daemon-side flow had succeeded.
	*/
	async call(method, params, options) {
		const id = this.nextId++;
		const timeoutMs = options?.timeoutMs ?? this.timeout;
		const request = {
			jsonrpc: "2.0",
			id,
			method,
			params
		};
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(/* @__PURE__ */ new Error(`RPC timeout: ${method} (${timeoutMs}ms)`));
			}, timeoutMs);
			this.pending.set(id, {
				resolve,
				reject,
				timer
			});
			this.transport.send(request);
		});
	}
	/**
	* Register a handler for server-pushed notifications.
	*/
	onNotification(method, handler) {
		const handlers = this.notificationHandlers.get(method) ?? [];
		handlers.push(handler);
		this.notificationHandlers.set(method, handlers);
	}
	/**
	* Remove a previously registered notification handler.
	*/
	offNotification(method, handler) {
		const handlers = this.notificationHandlers.get(method);
		if (!handlers) return;
		const idx = handlers.indexOf(handler);
		if (idx !== -1) handlers.splice(idx, 1);
	}
	/**
	* Health check — ping the daemon.
	*/
	async ping() {
		return this.call("daemon.ping");
	}
	/**
	* Close the client and reject all pending requests.
	*/
	close() {
		for (const [id, pending] of this.pending) {
			clearTimeout(pending.timer);
			pending.reject(/* @__PURE__ */ new Error("Client closed"));
			this.pending.delete(id);
		}
		this.notificationHandlers.clear();
		this.transport.close();
	}
	handleMessage(message) {
		if ("id" in message && !("method" in message)) {
			const response = message;
			const pending = this.pending.get(response.id);
			if (!pending) return;
			this.pending.delete(response.id);
			clearTimeout(pending.timer);
			if (response.error) {
				const err = new Error(response.error.message);
				err.code = response.error.code ?? JSON_RPC_ERRORS.INTERNAL_ERROR;
				pending.reject(err);
			} else pending.resolve(response.result);
			return;
		}
		if ("method" in message && !("id" in message)) {
			const notification = message;
			const handlers = this.notificationHandlers.get(notification.method);
			if (handlers) for (const handler of handlers) handler(notification.params);
		}
	}
};
//#endregion
//#region ../../packages/agent-core/src/daemon/socket-path.ts
var DAEMON_DIR_NAME = ".accomplish";
var SOCKET_FILE_NAME = "daemon.sock";
var PID_FILE_NAME = "daemon.pid";
var WINDOWS_PIPE_BASE = "accomplish-daemon";
/**
* Default daemon directory when no dataDir is provided.
* Used for dev/standalone mode only.
*/
function getDaemonDir() {
	return join(homedir(), DAEMON_DIR_NAME);
}
/**
* Get the socket path for daemon IPC.
*
* When `dataDir` is provided, the socket is scoped to that directory so
* multiple profiles (dev/prod, different users) never collide.
* On Windows, named pipes are kernel-level objects, so we hash the dataDir
* to create a unique pipe name.
*
* @param dataDir — Explicit data directory. Falls back to `~/.accomplish`.
*/
function getSocketPath(dataDir) {
	const dir = dataDir ?? getDaemonDir();
	if (platform() === "win32") return `\\\\.\\pipe\\${WINDOWS_PIPE_BASE}-${createHash("sha256").update(dir).digest("hex").slice(0, 12)}`;
	return join(dir, SOCKET_FILE_NAME);
}
/**
* Get the PID lock file path.
*
* @param dataDir — Explicit data directory. Falls back to `~/.accomplish`.
*/
function getPidFilePath(dataDir) {
	return join(dataDir ?? getDaemonDir(), PID_FILE_NAME);
}
//#endregion
//#region ../../packages/agent-core/src/daemon/socket-transport.ts
/**
* Socket Transport
*
* A DaemonTransport implementation that communicates over a Unix socket
* (macOS/Linux) or Windows named pipe. Connects to a DaemonRpcServer
* using the same newline-delimited JSON protocol.
*
* ESM module — use .js extensions on imports.
*/
var MAX_BUFFER_BYTES = 1 * 1024 * 1024;
/**
* Create a DaemonTransport backed by a socket connection.
*
* Resolves when the socket is connected and ready. Rejects on connection
* error or timeout.
*
* The returned transport has an additional `onDisconnect` method for
* reconnection logic.
*/
async function createSocketTransport(options = {}) {
	return createTransportFromSocket(await connectToSocket(options.socketPath ?? getSocketPath(options.dataDir), options.connectTimeout ?? 5e3));
}
function connectToSocket(socketPath, timeoutMs) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			socket.destroy();
			reject(/* @__PURE__ */ new Error(`Socket connection timeout after ${timeoutMs}ms: ${socketPath}`));
		}, timeoutMs);
		const socket = connect({ path: socketPath }, () => {
			clearTimeout(timer);
			resolve(socket);
		});
		socket.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}
function createTransportFromSocket(socket) {
	const messageHandlers = [];
	const disconnectHandlers = [];
	let buffer = "";
	let closed = false;
	socket.setEncoding("utf8");
	socket.on("data", (chunk) => {
		if (closed) return;
		buffer += chunk;
		if (buffer.length > MAX_BUFFER_BYTES) {
			console.error("[SocketTransport] Buffer overflow — closing connection");
			socket.destroy();
			return;
		}
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			try {
				const message = JSON.parse(trimmed);
				for (const handler of messageHandlers) handler(message);
			} catch {
				console.warn("[SocketTransport] Failed to parse message:", trimmed.slice(0, 100));
			}
		}
	});
	socket.on("close", () => {
		if (!closed) {
			closed = true;
			for (const handler of disconnectHandlers) handler();
		}
	});
	socket.on("error", (err) => {
		console.error("[SocketTransport] Socket error:", err.message);
		if (!closed) {
			closed = true;
			socket.destroy();
			for (const handler of disconnectHandlers) handler();
		}
	});
	return {
		send(message) {
			if (closed || socket.destroyed) return;
			const data = JSON.stringify(message) + "\n";
			socket.write(data);
		},
		onMessage(handler) {
			messageHandlers.push(handler);
		},
		onDisconnect(handler) {
			disconnectHandlers.push(handler);
		},
		close() {
			if (closed) return;
			closed = true;
			messageHandlers.length = 0;
			disconnectHandlers.length = 0;
			if (!socket.destroyed) socket.destroy();
		}
	};
}
//#endregion
//#region ../../packages/agent-core/src/internal/classes/speech-api.ts
/**
* ElevenLabs Speech API helpers
*
* Handles HTTP interactions with the ElevenLabs Speech-to-Text and validation
* APIs, including error parsing and response normalization.
*/
var log = createConsoleLogger({ prefix: "SpeechAPI" });
var ELEVENLABS_API_TIMEOUT_MS = 3e4;
/**
* Validate an ElevenLabs API key by calling the models endpoint.
*/
async function validateElevenLabsApiKey(key) {
	if (!key || !key.trim()) return {
		valid: false,
		error: "API key is required"
	};
	try {
		const response = await fetchWithTimeout("https://api.elevenlabs.io/v1/models", {
			method: "GET",
			headers: { "xi-api-key": key.trim() }
		}, ELEVENLABS_API_TIMEOUT_MS);
		if (response.ok) return { valid: true };
		if (response.status === 401 || response.status === 403) return {
			valid: false,
			error: "Invalid API key. Please check your ElevenLabs API key."
		};
		return {
			valid: false,
			error: `API error: ${(await response.json().catch(() => ({})))?.error?.message || `API returned status ${response.status}`}`
		};
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") return {
			valid: false,
			error: "Request timed out. Please check your internet connection."
		};
		return {
			valid: false,
			error: `Network error: ${error instanceof Error ? error.message : "Unknown error"}`
		};
	}
}
function parseDetailField(detail) {
	if (typeof detail === "string") return detail;
	if (detail && typeof detail === "object") {
		const detailObj = detail;
		const msg = detailObj.message ?? detailObj.status;
		if (typeof msg === "string") return msg;
		if (msg !== void 0) return JSON.stringify(msg);
		return JSON.stringify(detail);
	}
	return "";
}
function parseErrorMessage(errorData, errorText, statusText) {
	const detail = errorData?.detail;
	if (detail !== void 0) {
		const msg = parseDetailField(detail);
		if (msg) return msg;
	}
	const nestedMsg = errorData?.error?.message;
	if (nestedMsg !== void 0) return typeof nestedMsg === "string" ? nestedMsg : JSON.stringify(nestedMsg);
	const rootMsg = errorData?.message;
	if (rootMsg !== void 0) return typeof rootMsg === "string" ? rootMsg : JSON.stringify(rootMsg);
	return errorText ? errorText.substring(0, 200) : statusText || "Unknown API error";
}
async function handleTranscribeErrorResponse(response) {
	const errorText = await response.text().catch(() => "");
	let errorData = {};
	try {
		errorData = JSON.parse(errorText);
	} catch {}
	log.error("[ElevenLabs] API error:", {
		status: response.status,
		statusText: response.statusText,
		errorText: errorText.substring(0, 500)
	});
	if (response.status === 401 || response.status === 403) return {
		success: false,
		error: {
			code: "INVALID_API_KEY",
			message: "Invalid or expired ElevenLabs API key. Please check your settings."
		}
	};
	if (response.status === 429) return {
		success: false,
		error: {
			code: "RATE_LIMIT",
			message: "Rate limit exceeded. Please wait a moment and try again."
		}
	};
	return {
		success: false,
		error: {
			code: "TRANSCRIPTION_FAILED",
			message: `Transcription failed: ${parseErrorMessage(errorData, errorText, response.statusText)}`
		}
	};
}
/**
* Call ElevenLabs Speech-to-Text API.
*/
async function callElevenLabsTranscribe(apiKey, audioData, mimeType, modelId) {
	const startTime = Date.now();
	log.info("[ElevenLabs] Starting transcription:", {
		audioSize: audioData.length,
		mimeType,
		modelId
	});
	try {
		const blob = new Blob([new Uint8Array(audioData)], { type: mimeType });
		log.info("[ElevenLabs] Created blob:", {
			blobSize: blob.size,
			blobType: blob.type
		});
		const formData = new FormData();
		formData.append("file", blob, "audio.webm");
		formData.append("model_id", modelId);
		const response = await fetchWithTimeout("https://api.elevenlabs.io/v1/speech-to-text", {
			method: "POST",
			headers: { "xi-api-key": apiKey },
			body: formData
		}, ELEVENLABS_API_TIMEOUT_MS);
		if (!response.ok) return handleTranscribeErrorResponse(response);
		const duration = Date.now() - startTime;
		const result = await response.json();
		if (!result.text) return {
			success: false,
			error: {
				code: "EMPTY_RESULT",
				message: "No speech was recognized. Please try again."
			}
		};
		return {
			success: true,
			result: {
				text: result.text.trim(),
				confidence: result.confidence,
				duration,
				timestamp: Date.now()
			}
		};
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") return {
			success: false,
			error: {
				code: "TIMEOUT",
				message: "Transcription request timed out. Please try again."
			}
		};
		return {
			success: false,
			error: {
				code: "NETWORK_ERROR",
				message: `Network error during transcription: ${error instanceof Error ? error.message : "Unknown error"}`
			}
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/internal/classes/SpeechService.ts
/**
* Speech service that uses ElevenLabs API for transcription.
* Requires a SecureStorage instance for API key management.
*/
var SpeechService = class {
	storage;
	constructor(storage) {
		this.storage = storage;
	}
	/**
	* Get the configured ElevenLabs API key
	*/
	getElevenLabsApiKey() {
		const key = this.storage.getApiKey("elevenlabs");
		return key && key.trim() ? key : null;
	}
	/**
	* Check if ElevenLabs is configured
	*/
	isElevenLabsConfigured() {
		return this.getElevenLabsApiKey() !== null;
	}
	/**
	* Validate ElevenLabs API key by making a test request
	*/
	async validateElevenLabsApiKey(apiKey) {
		const key = apiKey || this.getElevenLabsApiKey();
		if (!key || !key.trim()) return {
			valid: false,
			error: "API key is required"
		};
		return validateElevenLabsApiKey(key);
	}
	/**
	* Transcribe audio using ElevenLabs Speech-to-Text API
	*
	* @param audioData - Audio data as Buffer (from renderer via IPC)
	* @param mimeType - MIME type of the audio (e.g., 'audio/webm')
	* @returns Transcription result or error
	*/
	async transcribeAudio(audioData, mimeType = "audio/webm") {
		const apiKey = this.getElevenLabsApiKey();
		const modelId = process.env.ELEVENLABS_STT_MODEL_ID?.trim() || "scribe_v2";
		if (!apiKey) return {
			success: false,
			error: {
				code: "MISSING_API_KEY",
				message: "ElevenLabs API key is not configured. Please add it in settings."
			}
		};
		return callElevenLabsTranscribe(apiKey, audioData, mimeType, modelId);
	}
};
//#endregion
//#region ../../packages/agent-core/src/factories/speech.ts
function createSpeechService(options) {
	return new SpeechService(options.storage);
}
//#endregion
//#region ../../packages/agent-core/src/internal/classes/LogFileWriter.ts
/**
* LogFileWriter - Writes log entries to rotating daily log files.
*
* This class is platform-agnostic and requires the log directory to be
* injected via constructor (dependency injection pattern).
*/
var LogFileWriter = class {
	currentDate = "";
	currentFilePath = "";
	buffer = [];
	flushTimer = null;
	fileSizeExceeded = false;
	constructor(logDir) {
		this.logDir = logDir;
	}
	initialize() {
		if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
		this.cleanupOldLogs();
		this.updateCurrentFile();
		this.flushTimer = setInterval(() => this.flush(), LOG_BUFFER_FLUSH_INTERVAL_MS);
	}
	write(level, source, message) {
		if (this.fileSizeExceeded) {
			const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
			if (today !== this.currentDate) {
				this.currentDate = today;
				this.currentFilePath = path.join(this.logDir, `app-${today}.log`);
				this.fileSizeExceeded = false;
			} else return;
		}
		const entry = {
			timestamp: (/* @__PURE__ */ new Date()).toISOString(),
			level,
			source,
			message: redact(message)
		};
		this.buffer.push(entry);
		if (this.buffer.length >= 100) this.flush();
	}
	flush() {
		if (this.buffer.length === 0) return;
		this.updateCurrentFile();
		if (this.checkFileSize()) {
			this.fileSizeExceeded = true;
			console.error("[LogFileWriter] Max file size exceeded, stopping writes");
			return;
		}
		const lines = this.buffer.map((entry) => `[${entry.timestamp}] [${entry.level}] [${entry.source}] ${entry.message}`);
		try {
			fs.appendFileSync(this.currentFilePath, lines.join("\n") + "\n");
			this.buffer = [];
		} catch (error) {
			console.error("[LogFileWriter] Failed to write logs:", error);
			if (this.buffer.length > 1e3) {
				console.error("[LogFileWriter] Buffer overflow - dropping oldest entries");
				this.buffer = this.buffer.slice(-100);
			}
		}
	}
	getCurrentLogPath() {
		this.updateCurrentFile();
		return this.currentFilePath;
	}
	getLogDir() {
		return this.logDir;
	}
	shutdown() {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}
		this.flush();
	}
	updateCurrentFile() {
		const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
		if (today !== this.currentDate) {
			if (this.currentDate && this.buffer.length > 0 && this.currentFilePath) {
				const lines = this.buffer.map((entry) => `[${entry.timestamp}] [${entry.level}] [${entry.source}] ${entry.message}`);
				try {
					fs.appendFileSync(this.currentFilePath, lines.join("\n") + "\n");
					this.buffer = [];
				} catch (error) {
					console.error("[LogFileWriter] Failed to write logs on date change:", error);
				}
			}
			this.currentDate = today;
			this.currentFilePath = path.join(this.logDir, `app-${today}.log`);
			this.fileSizeExceeded = false;
		}
	}
	checkFileSize() {
		try {
			if (!fs.existsSync(this.currentFilePath)) return false;
			return fs.statSync(this.currentFilePath).size >= LOG_MAX_FILE_SIZE_BYTES;
		} catch {
			return false;
		}
	}
	cleanupOldLogs() {
		try {
			const files = fs.readdirSync(this.logDir);
			const cutoffDate = /* @__PURE__ */ new Date();
			cutoffDate.setDate(cutoffDate.getDate() - 7);
			for (const file of files) {
				if (!file.startsWith("app-") || !file.endsWith(".log")) continue;
				const dateMatch = file.match(/app-(\d{4}-\d{2}-\d{2})\.log/);
				if (!dateMatch) continue;
				if (new Date(dateMatch[1]) < cutoffDate) {
					const filePath = path.join(this.logDir, file);
					fs.unlinkSync(filePath);
					console.log(`[LogFileWriter] Deleted old log file: ${file}`);
				}
			}
		} catch (error) {
			console.error("[LogFileWriter] Failed to cleanup old logs:", error);
		}
	}
};
//#endregion
//#region ../../packages/agent-core/src/internal/classes/LogCollector.ts
var originalConsole = {
	log: console.log.bind(console),
	warn: console.warn.bind(console),
	error: console.error.bind(console),
	debug: console.debug.bind(console)
};
var LogCollector = class {
	initialized = false;
	constructor(writer) {
		this.writer = writer;
	}
	/**
	* Initialize the log collector - must be called early in app startup
	*/
	initialize() {
		if (this.initialized) return;
		this.writer.initialize();
		console.log = (...args) => {
			try {
				originalConsole.log(...args);
			} catch {}
			this.captureConsole("INFO", args);
		};
		console.warn = (...args) => {
			try {
				originalConsole.warn(...args);
			} catch {}
			this.captureConsole("WARN", args);
		};
		console.error = (...args) => {
			try {
				originalConsole.error(...args);
			} catch {}
			this.captureConsole("ERROR", args);
		};
		console.debug = (...args) => {
			try {
				originalConsole.debug(...args);
			} catch {}
			this.captureConsole("DEBUG", args);
		};
		this.initialized = true;
		this.log("INFO", "main", "LogCollector initialized");
	}
	/**
	* Log a message with structured metadata
	*/
	log(level, source, message, data) {
		let fullMessage = message;
		if (data !== void 0) try {
			fullMessage += " " + JSON.stringify(data);
		} catch {
			fullMessage += " [unserializable data]";
		}
		this.writer.write(level, source, fullMessage);
	}
	/**
	* Log MCP server events
	*/
	logMcp(level, message, data) {
		this.log(level, "mcp", message, data);
	}
	/**
	* Log browser/Playwright events
	*/
	logBrowser(level, message, data) {
		this.log(level, "browser", message, data);
	}
	/**
	* Log OpenCode CLI events
	*/
	logOpenCode(level, message, data) {
		this.log(level, "opencode", message, data);
	}
	/**
	* Log environment/startup events
	*/
	logEnv(level, message, data) {
		this.log(level, "env", message, data);
	}
	/**
	* Log IPC events
	*/
	logIpc(level, message, data) {
		this.log(level, "ipc", message, data);
	}
	/**
	* Get the path to the current log file (for export)
	*/
	getCurrentLogPath() {
		return this.writer.getCurrentLogPath();
	}
	/**
	* Get the log directory
	*/
	getLogDir() {
		return this.writer.getLogDir();
	}
	/**
	* Flush all pending logs to disk
	*/
	flush() {
		this.writer.flush();
	}
	/**
	* Shutdown the collector
	*/
	shutdown() {
		if (!this.initialized) return;
		this.log("INFO", "main", "LogCollector shutting down");
		console.log = originalConsole.log;
		console.warn = originalConsole.warn;
		console.error = originalConsole.error;
		console.debug = originalConsole.debug;
		this.writer.shutdown();
		this.initialized = false;
	}
	/**
	* Capture console output and route to file writer
	*/
	captureConsole(level, args) {
		const message = args.map((arg) => {
			if (typeof arg === "string") return arg;
			try {
				return JSON.stringify(arg);
			} catch {
				return String(arg);
			}
		}).join(" ");
		const source = detectLogSource(message);
		this.writer.write(level, source, message);
	}
};
//#endregion
//#region ../../packages/agent-core/src/factories/log-writer.ts
/**
* Factory function for creating LogWriter instances
*
* The LogWriter combines both file writing (LogFileWriter) and log collection
* (LogCollector) functionality into a single unified API. This ensures that
* LogCollector remains internal and is not exposed as a separate factory.
*/
/**
* Create a new log writer instance
*
* Returns a unified API that provides both low-level write operations
* and higher-level log collection methods (log, logMcp, logBrowser, etc.)
*
* @param options - Configuration for the log writer
* @returns LogWriterAPI instance with full logging capabilities
*/
function createLogWriter(options) {
	const fileWriter = new LogFileWriter(options.logDir);
	const collector = new LogCollector(fileWriter);
	return {
		initialize() {
			collector.initialize();
		},
		write(level, source, message) {
			fileWriter.write(level, source, message);
		},
		log(level, source, message, data) {
			collector.log(level, source, message, data);
		},
		logMcp(level, message, data) {
			collector.logMcp(level, message, data);
		},
		logBrowser(level, message, data) {
			collector.logBrowser(level, message, data);
		},
		logOpenCode(level, message, data) {
			collector.logOpenCode(level, message, data);
		},
		logEnv(level, message, data) {
			collector.logEnv(level, message, data);
		},
		logIpc(level, message, data) {
			collector.logIpc(level, message, data);
		},
		flush() {
			collector.flush();
		},
		getCurrentLogPath() {
			return collector.getCurrentLogPath();
		},
		getLogDir() {
			return collector.getLogDir();
		},
		shutdown() {
			collector.shutdown();
		}
	};
}
//#endregion
export { getPidFilePath as a, getDaemonDir as i, createSpeechService as n, getSocketPath as o, createSocketTransport as r, DaemonClient as s, createLogWriter as t };

//# sourceMappingURL=desktop-main-CXudHk3S.js.map