import { S as getSlackMcpCallbackUrl, T as setSlackMcpTokens, _ as OPENCODE_SLACK_MCP_CALLBACK_PORT, _t as discoverOAuthProtectedResourceMetadata, a as DEV_BROWSER_CDP_PORT, b as clearSlackMcpAuth, ft as buildAuthorizationUrl, g as OPENCODE_SLACK_MCP_CALLBACK_PATH, gt as discoverOAuthMetadata, h as OPENCODE_SLACK_MCP_CALLBACK_HOST, ht as exchangeCodeForTokens, l as shutdownDevBrowserServer, m as resolveCliPath, o as DEV_BROWSER_PORT, p as isCliAvailable, pt as generatePkceChallenge, v as OPENCODE_SLACK_MCP_CLIENT_ID, w as setSlackMcpPendingAuth, y as OPENCODE_SLACK_MCP_SERVER_URL } from "./id-BkuVT4wi.js";
import { r as shutdownLogCollector, t as getLogCollector } from "./logging-ZKSN6tdj.js";
import { et as getDaemonClient, n as trackAppClose, rt as shutdownDaemon } from "./events-6ieLJMcf.js";
import { t as flushAnalytics } from "./analytics-service-BFn-2QoE.js";
import "./daemon-bootstrap-fPqxRQhF.js";
import { t as close } from "./workspaceManager-DfKC3lQM.js";
import { n as enableAutoStart, r as isAutoStartEnabled, t as disableAutoStart } from "./service-manager-CQBzWGpd.js";
import "./mixpanel-service-BazkGrx9.js";
import { BrowserWindow, Menu, Tray, app, nativeImage, shell } from "electron";
import path from "path";
import fs from "fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "child_process";
import http from "http";
//#region src/main/providers/huggingface-local/server-state.ts
var state = {
	server: null,
	port: null,
	loadedModelId: null,
	pipeline: null,
	tokenizer: null,
	model: null,
	isLoading: false,
	isStopping: false
};
/** Mutex to prevent concurrent loadModel calls */
var loadModelPromise = null;
function setLoadModelPromise(p) {
	loadModelPromise = p;
}
/** Mutex to prevent concurrent startServer calls */
var startServerPromise = null;
function setStartServerPromise(p) {
	startServerPromise = p;
}
/** Counter tracking in-flight generation requests. Used by stopServer() to drain. */
var activeGenerations = 0;
function incrementGenerations() {
	activeGenerations++;
}
function decrementGenerations() {
	activeGenerations--;
}
//#endregion
//#region src/main/providers/huggingface-local/model-loader.ts
/**
* Model loader for the HuggingFace Local inference server.
* Handles loading/unloading Transformers.js models into shared state.
*/
/**
* Load a model into memory using Transformers.js.
*/
async function loadModel(modelId) {
	if (!state.isStopping && state.loadedModelId === modelId && state.tokenizer && state.model) {
		getLogCollector().logEnv("INFO", `[HF Server] Model ${modelId} already loaded`);
		return;
	}
	if (loadModelPromise) {
		try {
			await loadModelPromise;
		} catch {}
		if (!state.isStopping && state.loadedModelId === modelId && state.tokenizer && state.model) return;
	}
	const promise = (async () => {
		state.isLoading = true;
		const stoppedAtStart = state.isStopping;
		getLogCollector().logEnv("INFO", `[HF Server] Loading model: ${modelId}`);
		try {
			const { env, AutoTokenizer, AutoModelForCausalLM } = await import("@huggingface/transformers");
			env.localModelPath = path.join(app.getPath("userData"), "hf-models");
			env.allowRemoteModels = false;
			const tokenizer = await AutoTokenizer.from_pretrained(modelId);
			let quantization = null;
			let devicePreference = null;
			try {
				const snap = await getDaemonClient().call("settings.getAll");
				quantization = snap.huggingFaceLocalConfig?.quantization ?? null;
				devicePreference = snap.huggingFaceLocalConfig?.devicePreference ?? null;
			} catch {}
			const envAny = env;
			envAny.backends ??= {};
			envAny.backends.onnx ??= {};
			if (devicePreference && devicePreference !== "auto") envAny.backends.onnx.device = devicePreference;
			else delete envAny.backends.onnx.device;
			const dtypesToTry = quantization ? [quantization] : ["q4"];
			let model;
			for (const dtype of dtypesToTry) try {
				model = await AutoModelForCausalLM.from_pretrained(modelId, { dtype });
				break;
			} catch (err) {
				if (dtype === dtypesToTry[dtypesToTry.length - 1] && dtype !== "fp32") {
					getLogCollector().logEnv("WARN", `[HF Server] Failed to load ${dtype} model, trying fp32: ${err}`);
					model = await AutoModelForCausalLM.from_pretrained(modelId, { dtype: "fp32" });
				} else throw err;
			}
			if (state.isStopping || stoppedAtStart) {
				getLogCollector().logEnv("INFO", `[HF Server] Stop requested during load of ${modelId}; discarding.`);
				try {
					await model?.dispose?.();
				} catch {}
				throw new DOMException("Load cancelled by stopServer()", "AbortError");
			}
			if (state.model) {
				const start = Date.now();
				while (activeGenerations > 0 && Date.now() - start < 1e4) await new Promise((r) => setTimeout(r, 100));
				try {
					await state.model.dispose?.();
				} catch {}
			}
			state.tokenizer = tokenizer;
			state.model = model;
			state.loadedModelId = modelId;
			getLogCollector().logEnv("INFO", `[HF Server] Model loaded: ${modelId}`);
		} catch (error) {
			const isAbort = error instanceof DOMException && error.name === "AbortError";
			getLogCollector().logEnv(isAbort ? "INFO" : "ERROR", `[HF Server] ${isAbort ? "Load cancelled" : "Failed to load model"}: ${modelId}`, isAbort ? void 0 : { error: String(error) });
			throw error;
		} finally {
			state.isLoading = false;
			setLoadModelPromise(null);
		}
	})();
	setLoadModelPromise(promise);
	return promise;
}
/**
* Format chat messages into a prompt string.
* Uses the tokenizer's chat template if available.
*/
function formatChatPrompt(messages, tokenizer) {
	try {
		if (tokenizer.apply_chat_template) return tokenizer.apply_chat_template(messages, {
			tokenize: false,
			add_generation_prompt: true
		});
	} catch {}
	return messages.map((m) => {
		if (m.role === "system") return `System: ${m.content}`;
		if (m.role === "user") return `User: ${m.content}`;
		return `Assistant: ${m.content}`;
	}).join("\n") + "\nAssistant:";
}
//#endregion
//#region src/main/providers/huggingface-local/request-helpers.ts
/**
* Read the full request body as a string.
* Enforces a max size limit (default 10MB) to prevent OOM.
* Does NOT destroy the socket on overflow — the caller is responsible for
* sending a 413 response and ending the connection.
*/
function readBody(req, limitBytes = 10 * 1024 * 1024) {
	return new Promise((resolve, reject) => {
		let size = 0;
		const chunks = [];
		let overLimit = false;
		req.on("data", (chunk) => {
			if (overLimit) return;
			size += chunk.length;
			if (size > limitBytes) {
				overLimit = true;
				reject(/* @__PURE__ */ new Error("PayloadTooLarge"));
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			if (!overLimit) resolve(Buffer.concat(chunks).toString("utf-8"));
		});
		req.on("error", reject);
	});
}
/**
* Write a JSON error response.
*/
function writeJsonError(res, status, message, type = "invalid_request_error") {
	res.writeHead(status, { "Content-Type": "application/json" });
	res.end(JSON.stringify({ error: {
		message,
		type
	} }));
}
/**
* Validate sampling parameters and write a 400 error if invalid.
* Returns true if valid, false if an error was written.
*/
function validateSamplingParams(chatReq, res) {
	const maxTokens = chatReq.max_tokens ?? 512;
	const temperature = chatReq.temperature ?? .7;
	const topP = chatReq.top_p ?? .9;
	if (!Number.isFinite(maxTokens) || maxTokens < 1 || maxTokens > 32768) {
		writeJsonError(res, 400, "max_tokens must be between 1 and 32768");
		return false;
	}
	if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
		writeJsonError(res, 400, "temperature must be between 0 and 2");
		return false;
	}
	if (!Number.isFinite(topP) || topP <= 0 || topP > 1) {
		writeJsonError(res, 400, "top_p must be between 0 and 1");
		return false;
	}
	return true;
}
/**
* Set CORS headers on the response, restricted to localhost origins.
*/
function setCorsHeaders(req, res) {
	const origin = req.headers.origin;
	if (origin && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
		res.setHeader("Access-Control-Allow-Origin", origin);
		res.setHeader("Vary", "Origin");
	} else res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1");
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
//#endregion
//#region src/main/providers/huggingface-local/chat-completions.ts
/**
* Handle a chat completion request (non-streaming).
*/
async function handleChatCompletion(req, res) {
	if (!state.tokenizer || !state.model) {
		writeJsonError(res, 503, "No model loaded", "server_error");
		return;
	}
	if (!validateSamplingParams(req, res)) return;
	const maxNewTokens = req.max_tokens ?? 512;
	const temperature = req.temperature ?? .7;
	const topP = req.top_p ?? .9;
	const prompt = formatChatPrompt(req.messages, state.tokenizer);
	const inputs = state.tokenizer(prompt, { return_tensor: true });
	incrementGenerations();
	try {
		const outputs = await state.model.generate({
			...inputs,
			max_new_tokens: maxNewTokens,
			temperature,
			top_p: topP,
			do_sample: temperature > 0
		});
		const promptLength = inputs.input_ids.dims?.[1] || 0;
		const generatedTokens = outputs.slice(null, promptLength);
		const text = state.tokenizer.decode(generatedTokens[0], { skip_special_tokens: true });
		const completionTokens = generatedTokens.dims?.[1] || 0;
		const totalTokens = promptLength + completionTokens;
		const result = {
			id: `chatcmpl-hf-${Date.now()}`,
			object: "chat.completion",
			created: Math.floor(Date.now() / 1e3),
			model: state.loadedModelId,
			choices: [{
				index: 0,
				message: {
					role: "assistant",
					content: text.trim()
				},
				finish_reason: "stop"
			}],
			usage: {
				prompt_tokens: promptLength,
				completion_tokens: completionTokens,
				total_tokens: totalTokens
			}
		};
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify(result));
	} finally {
		decrementGenerations();
	}
}
/**
* Handle a streaming chat completion request via SSE.
*/
async function handleStreamingCompletion(req, res) {
	if (!state.tokenizer || !state.model) {
		writeJsonError(res, 503, "No model loaded", "server_error");
		return;
	}
	if (!validateSamplingParams(req, res)) return;
	res.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive"
	});
	const prompt = formatChatPrompt(req.messages, state.tokenizer);
	const inputs = state.tokenizer(prompt, { return_tensor: true });
	const maxNewTokens = req.max_tokens ?? 512;
	const temperature = req.temperature ?? .7;
	const topP = req.top_p ?? .9;
	const completionId = `chatcmpl-hf-${Date.now()}`;
	incrementGenerations();
	try {
		await state.model.generate({
			...inputs,
			max_new_tokens: maxNewTokens,
			temperature,
			top_p: topP,
			do_sample: temperature > 0,
			callback_function: (output) => {
				const lastToken = output.slice(null, -1);
				const tokenizer = state.tokenizer;
				if (!tokenizer) return;
				const tokenText = tokenizer.decode(lastToken[0], { skip_special_tokens: true });
				if (tokenText) {
					const chunk = {
						id: completionId,
						object: "chat.completion.chunk",
						created: Math.floor(Date.now() / 1e3),
						model: state.loadedModelId,
						choices: [{
							index: 0,
							delta: { content: tokenText },
							finish_reason: null
						}]
					};
					res.write(`data: ${JSON.stringify(chunk)}\n\n`);
				}
			}
		});
		const stopChunk = {
			id: completionId,
			object: "chat.completion.chunk",
			created: Math.floor(Date.now() / 1e3),
			model: state.loadedModelId,
			choices: [{
				index: 0,
				delta: {},
				finish_reason: "stop"
			}]
		};
		res.write(`data: ${JSON.stringify(stopChunk)}\n\n`);
		res.write("data: [DONE]\n\n");
	} catch (error) {
		const errorChunk = { error: {
			message: error instanceof Error ? error.message : "Generation failed",
			type: "server_error"
		} };
		res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
		getLogCollector().logEnv("ERROR", "[HF Server] Streaming generation error:", { error: String(error) });
	} finally {
		decrementGenerations();
		if (!res.writableEnded) res.end();
	}
}
//#endregion
//#region src/main/providers/huggingface-local/http-handler.ts
/**
* Create the HTTP request handler for the inference server.
*/
function createRequestHandler() {
	return async (req, res) => {
		setCorsHeaders(req, res);
		if (req.method === "OPTIONS") {
			res.writeHead(204);
			res.end();
			return;
		}
		const url = req.url || "";
		try {
			if (req.method === "GET" && url === "/v1/models") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({
					object: "list",
					data: state.loadedModelId ? [{
						id: state.loadedModelId,
						object: "model",
						created: Math.floor(Date.now() / 1e3),
						owned_by: "huggingface-local"
					}] : []
				}));
				return;
			}
			if (req.method === "POST" && url === "/v1/chat/completions") {
				if (state.isLoading) {
					writeJsonError(res, 503, "Model is loading, please wait", "server_error");
					return;
				}
				if (!state.model || !state.tokenizer) {
					writeJsonError(res, 503, "No model loaded", "server_error");
					return;
				}
				const body = await readBody(req);
				let chatReq;
				try {
					chatReq = JSON.parse(body);
				} catch {
					writeJsonError(res, 400, "Invalid JSON in request body");
					return;
				}
				if (!Array.isArray(chatReq.messages) || chatReq.messages.length === 0) {
					writeJsonError(res, 400, "messages must be a non-empty array");
					return;
				}
				for (const message of chatReq.messages) if (!message || message.role === void 0 || message.content === void 0 || typeof message.content !== "string" || ![
					"system",
					"user",
					"assistant"
				].includes(message.role)) {
					writeJsonError(res, 400, "Invalid message format");
					return;
				}
				if (chatReq.stream) await handleStreamingCompletion(chatReq, res);
				else await handleChatCompletion(chatReq, res);
				return;
			}
			if (req.method === "GET" && (url === "/health" || url === "/")) {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({
					status: "ok",
					model: state.loadedModelId,
					isLoading: state.isLoading
				}));
				return;
			}
			writeJsonError(res, 404, "Not found", "invalid_request");
		} catch (error) {
			getLogCollector().logEnv("ERROR", "[HF Server] Request error:", { error: String(error) });
			if (error.message === "PayloadTooLarge") {
				if (!res.headersSent) writeJsonError(res, 413, "Request entity too large");
				return;
			}
			if (!res.writableEnded) {
				if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: {
					message: error instanceof Error ? error.message : "Internal server error",
					type: "server_error"
				} }));
			}
		}
	};
}
//#endregion
//#region src/main/providers/huggingface-local/server-lifecycle.ts
/**
* Server lifecycle management for the HuggingFace Local inference server.
* Handles start, stop, status, and connection testing.
*/
/**
* Start the local inference HTTP server.
*/
async function startServer(modelId) {
	if (startServerPromise) {
		await startServerPromise;
		if (state.loadedModelId === modelId && state.port !== null) return {
			success: true,
			port: state.port
		};
		return startServer(modelId);
	}
	const promise = _startServerImpl(modelId).finally(() => {
		setStartServerPromise(null);
	});
	setStartServerPromise(promise);
	return promise;
}
async function _startServerImpl(modelId) {
	if (state.server) try {
		await loadModel(modelId);
		return {
			success: true,
			port: state.port
		};
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") return {
			success: false,
			error: "Server stopped during model load"
		};
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to load model"
		};
	}
	try {
		await loadModel(modelId);
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") return {
			success: false,
			error: "Server stopped during model load"
		};
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to load model"
		};
	}
	return new Promise((resolve) => {
		const server = http.createServer(createRequestHandler());
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (address && typeof address !== "string") {
				state.server = server;
				state.port = address.port;
				getLogCollector().logEnv("INFO", `[HF Server] Listening on http://127.0.0.1:${address.port}`);
				(async () => {
					try {
						const client = getDaemonClient();
						const existingConfig = await client.call("provider.getHuggingFaceLocalConfig");
						if (existingConfig) await client.call("provider.setHuggingFaceLocalConfig", { config: {
							...existingConfig,
							serverPort: address.port
						} });
					} catch (err) {
						getLogCollector().logEnv("WARN", "[HF Server] Failed to persist port to config:", { error: String(err) });
					}
				})();
				resolve({
					success: true,
					port: address.port
				});
			} else resolve({
				success: false,
				error: "Failed to get server address"
			});
		});
		server.on("error", (error) => {
			getLogCollector().logEnv("ERROR", "[HF Server] Server error:", { error: String(error) });
			resolve({
				success: false,
				error: error.message
			});
		});
	});
}
/**
* Stop the local inference server and unload the model.
*/
async function stopServer() {
	state.isStopping = true;
	const pendingLoad = loadModelPromise;
	if (state.server) await new Promise((resolve) => {
		const srv = state.server;
		if ("closeAllConnections" in srv && typeof srv.closeAllConnections === "function") srv.closeAllConnections();
		srv.close(() => {
			getLogCollector().logEnv("INFO", "[HF Server] Server stopped");
			resolve();
		});
	});
	const drainStart = Date.now();
	while (activeGenerations > 0 && Date.now() - drainStart < 1e4) await new Promise((r) => setTimeout(r, 100));
	if (state.model) try {
		await state.model.dispose?.();
	} catch {}
	state.server = null;
	state.port = null;
	state.loadedModelId = null;
	state.pipeline = null;
	state.tokenizer = null;
	state.model = null;
	state.isLoading = false;
	if (pendingLoad) await pendingLoad.catch(() => {});
	state.isStopping = false;
}
/**
* Get the current server status.
*/
function getServerStatus() {
	return {
		running: state.server !== null,
		port: state.port,
		loadedModel: state.loadedModelId,
		isLoading: state.isLoading
	};
}
/**
* Test that the server is running and responsive.
*/
async function testConnection() {
	if (!state.server || !state.port) return {
		success: false,
		error: "Server is not running"
	};
	try {
		const response = await fetch(`http://127.0.0.1:${state.port}/health`);
		if (response.ok) return { success: true };
		return {
			success: false,
			error: `Health check failed with status ${response.status}`
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Connection failed"
		};
	}
}
//#endregion
//#region src/main/providers/huggingface-local/model-downloader.ts
/**
* HuggingFace Model Downloader
*
* Handles downloading ONNX-format HuggingFace models via Transformers.js auto-download.
*/
var activeDownloads = /* @__PURE__ */ new Map();
/**
* Download a model from HuggingFace Hub using Transformers.js auto-download.
* Transformers.js handles model file resolution and caching internally.
*/
async function downloadModel(modelId, onProgress, cachePath) {
	const cacheDir = cachePath || "";
	if (cacheDir && !fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
	const abortController = new AbortController();
	activeDownloads.set(modelId, { abort: abortController });
	try {
		onProgress?.({
			modelId,
			status: "downloading",
			progress: 0
		});
		const { env, AutoTokenizer, AutoModelForCausalLM } = await import("@huggingface/transformers");
		if (cacheDir) env.cacheDir = cacheDir;
		env.allowRemoteModels = true;
		onProgress?.({
			modelId,
			status: "downloading",
			progress: 10
		});
		await AutoTokenizer.from_pretrained(modelId);
		onProgress?.({
			modelId,
			status: "downloading",
			progress: 30
		});
		try {
			await AutoModelForCausalLM.from_pretrained(modelId, { dtype: "q4" });
		} catch (err) {
			console.warn(`[HF Manager] Failed to download q4 model, trying fp32: ${err}`);
			onProgress?.({
				modelId,
				status: "downloading",
				progress: 50
			});
			await AutoModelForCausalLM.from_pretrained(modelId, { dtype: "fp32" });
		}
		onProgress?.({
			modelId,
			status: "complete",
			progress: 100
		});
		return { success: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown download error";
		onProgress?.({
			modelId,
			status: "error",
			progress: 0,
			error: message
		});
		return {
			success: false,
			error: message
		};
	} finally {
		activeDownloads.delete(modelId);
	}
}
//#endregion
//#region src/main/providers/huggingface-local/model-manager.ts
/**
* HuggingFace Local Model Manager
*
* Lists, caches, and manages ONNX-format HuggingFace models.
* Download logic is in model-downloader.ts.
*/
/**
* Suggested ONNX-compatible models for quick setup.
* These are small models known to work well with Transformers.js.
*/
var SUGGESTED_MODELS = [
	{
		id: "onnx-community/Llama-3.2-1B-Instruct-ONNX",
		displayName: "Llama 3.2 1B Instruct (ONNX)",
		downloaded: false
	},
	{
		id: "onnx-community/Phi-3.5-mini-instruct-onnx",
		displayName: "Phi-3.5 Mini Instruct (ONNX)",
		downloaded: false
	},
	{
		id: "onnx-community/Qwen2.5-0.5B-Instruct",
		displayName: "Qwen2.5 0.5B Instruct (ONNX)",
		downloaded: false
	},
	{
		id: "Xenova/distilgpt2",
		displayName: "DistilGPT-2 (Tiny, for testing)",
		downloaded: false
	}
];
/** Default cache directory for HuggingFace models */
function getDefaultCachePath() {
	return path.join(app.getPath("userData"), "hf-models");
}
/** Ensure cache directory exists */
function ensureCacheDir(cachePath) {
	const dir = cachePath || getDefaultCachePath();
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	return dir;
}
/**
* List all cached models in the cache directory.
*/
function listCachedModels(cachePath) {
	const cacheDir = cachePath || getDefaultCachePath();
	if (!fs.existsSync(cacheDir)) return [];
	const models = [];
	try {
		const entries = fs.readdirSync(cacheDir, { withFileTypes: true });
		for (const orgEntry of entries) {
			if (!orgEntry.isDirectory()) continue;
			const orgDir = path.join(cacheDir, orgEntry.name);
			const modelEntries = fs.readdirSync(orgDir, { withFileTypes: true });
			for (const modelEntry of modelEntries) {
				if (!modelEntry.isDirectory()) continue;
				const modelDir = path.join(orgDir, modelEntry.name);
				const modelId = `${orgEntry.name}/${modelEntry.name}`;
				const sizeBytes = getDirSize(modelDir);
				models.push({
					id: modelId,
					displayName: modelEntry.name,
					sizeBytes,
					downloaded: true
				});
			}
		}
	} catch (error) {
		console.warn("[HF Local] Error listing cached models:", error);
	}
	return models;
}
/**
* Delete a cached model.
*/
function deleteModel(modelId, cachePath) {
	const cacheDir = ensureCacheDir(cachePath);
	const resolvedCache = path.resolve(cacheDir);
	const normalizedId = path.normalize(modelId);
	if (!normalizedId || normalizedId.includes("\0") || path.isAbsolute(normalizedId) || normalizedId.split(path.sep).includes("..")) return {
		success: false,
		error: "Invalid model ID"
	};
	const modelDir = path.resolve(resolvedCache, normalizedId);
	const rel = path.relative(resolvedCache, modelDir);
	if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return {
		success: false,
		error: "Invalid model ID"
	};
	if (!fs.existsSync(modelDir)) return {
		success: false,
		error: "Model not found in cache"
	};
	try {
		fs.rmSync(modelDir, {
			recursive: true,
			force: true
		});
		const orgDir = path.dirname(modelDir);
		if (fs.readdirSync(orgDir).length === 0) fs.rmdirSync(orgDir);
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error"
		};
	}
}
/** Recursively compute directory size in bytes */
function getDirSize(dirPath) {
	let total = 0;
	try {
		const entries = fs.readdirSync(dirPath, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dirPath, entry.name);
			if (entry.isFile()) total += fs.statSync(fullPath).size;
			else if (entry.isDirectory()) total += getDirSize(fullPath);
		}
	} catch {}
	return total;
}
/**
* Get the absolute path to the local model cache directory.
*/
function getCachePath() {
	return getDefaultCachePath();
}
//#endregion
//#region src/main/tray.ts
var tray = null;
var activeTaskCount = 0;
function getIconPath() {
	const iconFile = process.platform === "win32" ? "icon.ico" : "icon.png";
	if (app.isPackaged) return path.join(process.resourcesPath, iconFile);
	return path.join(process.env.APP_ROOT, "resources", iconFile);
}
function buildContextMenu(mainWindow) {
	const taskLabel = activeTaskCount > 0 ? `Active Tasks: ${activeTaskCount}` : "No Active Tasks";
	const autoStartChecked = isAutoStartEnabled();
	return Menu.buildFromTemplate([
		{
			label: "Show Accomplish",
			click: () => {
				if (mainWindow && !mainWindow.isDestroyed()) {
					mainWindow.show();
					mainWindow.focus();
				}
			}
		},
		{ type: "separator" },
		{
			label: taskLabel,
			enabled: false
		},
		{ type: "separator" },
		{
			label: "Start at Login",
			type: "checkbox",
			checked: autoStartChecked,
			click: (menuItem) => {
				if (menuItem.checked) enableAutoStart();
				else disableAutoStart();
			}
		},
		{ type: "separator" },
		{
			label: "Quit",
			click: () => {
				app.quit();
			}
		}
	]);
}
function createTray(mainWindow) {
	const iconPath = getIconPath();
	const icon = nativeImage.createFromPath(iconPath);
	tray = new Tray(process.platform === "linux" ? icon.resize({
		width: 22,
		height: 22
	}) : icon.resize({
		width: 16,
		height: 16
	}));
	tray.setToolTip("Accomplish");
	tray.setContextMenu(buildContextMenu(mainWindow));
	tray.on("click", () => {
		if (mainWindow && !mainWindow.isDestroyed()) if (mainWindow.isVisible()) mainWindow.hide();
		else {
			mainWindow.show();
			mainWindow.focus();
		}
	});
	return tray;
}
function destroyTray() {
	if (tray && !tray.isDestroyed()) {
		tray.destroy();
		tray = null;
	}
}
//#endregion
//#region src/main/services/cdp-client.ts
/**
* CdpClient — lightweight WebSocket-based Chrome DevTools Protocol client.
* Contributed by Dev0907 (PR #480) for ENG-695.
*/
var COMMAND_TIMEOUT_MS$1 = 1e4;
var CdpClient = class {
	ws = null;
	nextId = 1;
	pending = /* @__PURE__ */ new Map();
	listeners = /* @__PURE__ */ new Set();
	async connect(endpoint) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
		const ws = new WebSocket(endpoint);
		await new Promise((resolve, reject) => {
			const handleOpen = () => {
				cleanup();
				resolve();
			};
			const handleError = () => {
				cleanup();
				reject(/* @__PURE__ */ new Error(`Failed to connect to CDP endpoint: ${endpoint}`));
			};
			const cleanup = () => {
				ws.removeEventListener("open", handleOpen);
				ws.removeEventListener("error", handleError);
			};
			ws.addEventListener("open", handleOpen);
			ws.addEventListener("error", handleError);
		});
		ws.addEventListener("message", (event) => {
			this.handleMessage(event.data);
		});
		ws.addEventListener("close", () => {
			this.rejectAllPending(/* @__PURE__ */ new Error("CDP websocket closed"));
		});
		ws.addEventListener("error", () => {
			this.rejectAllPending(/* @__PURE__ */ new Error("CDP websocket error"));
		});
		this.ws = ws;
	}
	onEvent(listener) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
	async sendCommand(method, params, sessionId) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error("CDP websocket is not connected");
		const id = this.nextId++;
		const payload = {
			id,
			method
		};
		if (params) payload.params = params;
		if (sessionId) payload.sessionId = sessionId;
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pending.delete(id);
				reject(/* @__PURE__ */ new Error(`CDP command timed out: ${method}`));
			}, COMMAND_TIMEOUT_MS$1);
			this.pending.set(id, {
				resolve,
				reject,
				timeout
			});
			this.ws?.send(JSON.stringify(payload));
		});
	}
	async disconnect() {
		this.rejectAllPending(/* @__PURE__ */ new Error("CDP disconnected"));
		if (this.ws && this.ws.readyState < WebSocket.CLOSING) this.ws.close();
		this.ws = null;
	}
	async handleMessage(rawData) {
		const raw = await this.toText(rawData);
		if (!raw) return;
		let message;
		try {
			message = JSON.parse(raw);
		} catch {
			return;
		}
		if (typeof message.id === "number") {
			const pending = this.pending.get(message.id);
			if (!pending) return;
			clearTimeout(pending.timeout);
			this.pending.delete(message.id);
			if (message.error?.message) pending.reject(new Error(message.error.message));
			else pending.resolve(message.result ?? {});
			return;
		}
		for (const listener of this.listeners) listener(message);
	}
	rejectAllPending(error) {
		for (const pending of this.pending.values()) {
			clearTimeout(pending.timeout);
			pending.reject(error);
		}
		this.pending.clear();
	}
	async toText(rawData) {
		if (typeof rawData === "string") return rawData;
		if (rawData instanceof ArrayBuffer) return Buffer.from(rawData).toString("utf8");
		if (ArrayBuffer.isView(rawData)) return Buffer.from(rawData.buffer, rawData.byteOffset, rawData.byteLength).toString("utf8");
		if (typeof Blob !== "undefined" && rawData instanceof Blob) return rawData.text();
		return null;
	}
};
//#endregion
//#region src/main/services/browser-preview-utils.ts
/**
* Browser Preview utility functions — IPC helpers and HTTP/CDP resolution helpers.
* Extracted from browserPreview.ts for ENG-695.
*/
var DEV_BROWSER_HOST = "127.0.0.1";
var DEFAULT_VIEWPORT = {
	width: 1280,
	height: 720
};
var COMMAND_TIMEOUT_MS = 1e4;
function sendToRenderer(channel, payload) {
	for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send(channel, payload);
}
function emitStatusUpdate(taskId, pageName, status, message) {
	sendToRenderer("browser:status", {
		taskId,
		pageName,
		status,
		message,
		timestamp: Date.now()
	});
}
function emitFrameCapture(taskId, pageName, data, width, height) {
	sendToRenderer("browser:frame", {
		taskId,
		pageName,
		frame: data,
		width,
		height,
		timestamp: Date.now()
	});
}
function emitNavigationEvent(taskId, pageName, url) {
	sendToRenderer("browser:navigate", {
		taskId,
		pageName,
		url,
		timestamp: Date.now()
	});
}
async function fetchJson(url, init) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), COMMAND_TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			...init,
			signal: controller.signal
		});
		if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}
async function resolveTargetId(taskId, pageName) {
	const fullPageName = `${taskId}-${pageName}`;
	const result = await fetchJson(`http://${DEV_BROWSER_HOST}:${DEV_BROWSER_PORT}/pages`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			name: fullPageName,
			viewport: DEFAULT_VIEWPORT
		})
	});
	if (!result.targetId) throw new Error(`No targetId for page ${fullPageName}`);
	return result.targetId;
}
async function resolveBrowserWsEndpoint() {
	const info = await fetchJson(`http://${DEV_BROWSER_HOST}:${DEV_BROWSER_CDP_PORT}/json/version`);
	if (!info.webSocketDebuggerUrl) throw new Error("CDP endpoint missing webSocketDebuggerUrl");
	return info.webSocketDebuggerUrl;
}
//#endregion
//#region src/main/services/browserPreview.ts
/**
* Browser Preview Service — Embedded Live Browser View (ENG-695)
*
* Streams live CDP screencast frames from the dev-browser server to the Electron
* renderer via IPC.  Uses per-task CDP sessions (Dev0907, PR #480) and
* auto-reconnect via HTTP polling (dhruvawani17, PR #489).
*
* Architecture: dev-browser (CDP :9223) ── WebSocket ──► this service ── IPC ──► renderer
*/
var DEFAULT_PAGE_NAME = "main";
var SCREENCAST_QUALITY = 50;
var SCREENCAST_EVERY_NTH_FRAME = 3;
var SCREENCAST_MAX_WIDTH = 960;
var SCREENCAST_MAX_HEIGHT = 640;
/** Active preview sessions keyed by taskId */
var sessions = /* @__PURE__ */ new Map();
/** Used by autoStartScreencast (PR #489 / dhruvawani17) to check liveness */
var anySessionActive = false;
/**
* Start a live browser preview stream for the given task / page.
* Contributed by Dev0907 (PR #480) for ENG-695.
*/
async function startBrowserPreviewStream(taskId, pageName = DEFAULT_PAGE_NAME) {
	const normalizedPageName = typeof pageName === "string" && pageName.trim() ? pageName.trim() : DEFAULT_PAGE_NAME;
	await stopBrowserPreviewStream(taskId);
	emitStatusUpdate(taskId, normalizedPageName, "starting");
	const cdp = new CdpClient();
	try {
		const [wsEndpoint, targetId] = await Promise.all([resolveBrowserWsEndpoint(), resolveTargetId(taskId, normalizedPageName)]);
		await cdp.connect(wsEndpoint);
		const cdpSessionId = (await cdp.sendCommand("Target.attachToTarget", {
			targetId,
			flatten: true
		})).sessionId;
		const unsubscribe = cdp.onEvent((event) => {
			if (event.sessionId !== cdpSessionId || !event.method) return;
			if (event.method === "Page.screencastFrame") {
				const params = event.params;
				emitFrameCapture(taskId, normalizedPageName, params.data, params.metadata?.deviceWidth, params.metadata?.deviceHeight);
				cdp.sendCommand("Page.screencastFrameAck", { sessionId: params.sessionId }, cdpSessionId).catch(() => {});
			} else if (event.method === "Page.frameNavigated") {
				const params = event.params;
				if (params.frame?.url) emitNavigationEvent(taskId, normalizedPageName, params.frame.url);
			} else if (event.method === "Page.loadEventFired") emitStatusUpdate(taskId, normalizedPageName, "streaming");
		});
		await cdp.sendCommand("Page.startScreencast", {
			format: "jpeg",
			quality: SCREENCAST_QUALITY,
			everyNthFrame: SCREENCAST_EVERY_NTH_FRAME,
			maxWidth: SCREENCAST_MAX_WIDTH,
			maxHeight: SCREENCAST_MAX_HEIGHT
		}, cdpSessionId);
		sessions.set(taskId, {
			pageName: normalizedPageName,
			cdp,
			cdpSessionId,
			unsubscribe
		});
		anySessionActive = true;
		emitStatusUpdate(taskId, normalizedPageName, "streaming");
		getLogCollector().logBrowser("INFO", `[BrowserPreview] Stream started for task ${taskId}, page ${normalizedPageName}`);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		getLogCollector().logBrowser("ERROR", `[BrowserPreview] Failed to start stream for task ${taskId}: ${msg}`);
		emitStatusUpdate(taskId, normalizedPageName, "error", msg);
		await cdp.disconnect().catch(() => {});
	}
}
/**
* Stop the preview stream for a specific task.
* Safe to call even if no stream is active for this task.
* Contributed by Dev0907 (PR #480) for ENG-695.
*/
async function stopBrowserPreviewStream(taskId) {
	const session = sessions.get(taskId);
	if (!session) return;
	sessions.delete(taskId);
	anySessionActive = sessions.size > 0;
	try {
		session.unsubscribe();
		await session.cdp.sendCommand("Page.stopScreencast", {}, session.cdpSessionId).catch(() => {});
		await session.cdp.disconnect();
		emitStatusUpdate(taskId, session.pageName, "stopped");
		getLogCollector().logBrowser("INFO", `[BrowserPreview] Stream stopped for task ${taskId}`);
	} catch (err) {
		getLogCollector().logBrowser("WARN", `[BrowserPreview] Error stopping stream for task ${taskId}: ${String(err)}`);
	}
}
/**
* Stop all active preview streams (e.g. on app shutdown or clear history).
* Contributed by Dev0907 (PR #480) for ENG-695.
*/
async function stopAllBrowserPreviewStreams() {
	const taskIds = Array.from(sessions.keys());
	await Promise.all(taskIds.map((id) => stopBrowserPreviewStream(id)));
}
/**
* Check whether any screencast relay is currently active.
* Contributed by dhruvawani17 (PR #489) for ENG-695.
*/
function isScreencastActive() {
	return anySessionActive;
}
//#endregion
//#region src/main/opencode/vertex-cleanup.ts
var VERTEX_SA_KEY_FILENAME = "vertex-sa-key.json";
function logOC$1(level, msg, data) {
	try {
		const l = getLogCollector();
		if (l?.log) l.log(level, "opencode", msg, data);
	} catch (_e) {}
}
/**
* Removes the Vertex AI service account key file from disk if it exists.
* Called when the Vertex provider is disconnected or the app quits.
*
* Phase 4b of the OpenCode SDK cutover port: extracted from the deleted
* `environment-builder.ts` (which only existed to feed the dead PTY-era
* desktop-side `buildEnvironment`). The key file itself is still written
* by the daemon's environment builder when Vertex is configured.
*/
function cleanupVertexServiceAccountKey() {
	try {
		const keyPath = path.join(app.getPath("userData"), VERTEX_SA_KEY_FILENAME);
		if (fs.existsSync(keyPath)) {
			fs.unlinkSync(keyPath);
			logOC$1("INFO", "[Vertex] Cleaned up service account key file");
		}
	} catch (error) {
		logOC$1("WARN", "[Vertex] Failed to clean up service account key file", { error: String(error) });
	}
}
//#endregion
//#region src/main/opencode/dev-browser-shutdown.ts
function logOC(level, msg, data) {
	try {
		const l = getLogCollector();
		if (l?.log) l.log(level, "opencode", msg, data);
	} catch (_e) {}
}
/**
* Sends a shutdown request to the local dev-browser MCP server.
*
* Phase 4b of the OpenCode SDK cutover port: extracted from the deleted
* `electron-options.ts`. The dev-browser MCP server itself is now spawned
* by the daemon when a task that uses it starts; this shutdown helper is
* called from `app-shutdown.ts` so quitting the desktop also releases the
* port the MCP server holds.
*/
async function stopDevBrowserServer() {
	logOC("INFO", "[Browser] Sending shutdown request to dev-browser server...");
	await shutdownDevBrowserServer({
		devBrowserPort: DEV_BROWSER_PORT,
		devBrowserCdpPort: DEV_BROWSER_CDP_PORT
	});
}
//#endregion
//#region src/main/opencode/cli-resolver.ts
function getCliResolverConfig() {
	return {
		isPackaged: app.isPackaged,
		resourcesPath: process.resourcesPath,
		appPath: app.getAppPath()
	};
}
function getOpenCodeCliPath() {
	const resolved = resolveCliPath(getCliResolverConfig());
	if (resolved) return {
		command: resolved.cliPath,
		args: []
	};
	throw new Error("OpenCode CLI executable not found");
}
function isOpenCodeCliAvailable() {
	return isCliAvailable(getCliResolverConfig());
}
function getBundledOpenCodeVersion() {
	try {
		getOpenCodeCliPath();
	} catch {
		return null;
	}
	if (app.isPackaged) try {
		const packageName = process.platform === "win32" ? "opencode-windows-x64" : "opencode-ai";
		const packageJsonPath = path.join(process.resourcesPath, "app.asar.unpacked", "node_modules", packageName, "package.json");
		if (fs.existsSync(packageJsonPath)) return JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")).version;
	} catch {}
	try {
		const { command } = getOpenCodeCliPath();
		const output = execFileSync(command, ["--version"], {
			encoding: "utf-8",
			timeout: 5e3,
			windowsHide: true
		}).trim();
		const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
		return versionMatch ? versionMatch[1] : output;
	} catch {
		return null;
	}
}
//#endregion
//#region src/main/opencode/index.ts
async function isOpenCodeCliInstalled() {
	return isOpenCodeCliAvailable();
}
async function getOpenCodeCliVersion() {
	return getBundledOpenCodeVersion();
}
//#endregion
//#region src/main/oauth-callback-server.ts
var CALLBACK_TIMEOUT_MS = 6e4;
var SUCCESS_HTML = `<!DOCTYPE html>
<html><head><title>Authentication Successful</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
<div style="text-align:center"><h1>Authentication successful</h1><p>You can close this tab.</p></div>
</body></html>`;
var ERROR_HTML = `<!DOCTYPE html>
<html><head><title>Authentication Failed</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
<div style="text-align:center"><h1>Authentication failed</h1><p>Missing code or state parameter.</p></div>
</body></html>`;
function renderErrorHtml(message) {
	return ERROR_HTML.replace("Missing code or state parameter.", message);
}
function closeServer(server) {
	server.closeAllConnections();
	server.close();
}
async function createOAuthCallbackServer(options = {}) {
	const host = options.host ?? "127.0.0.1";
	const port = options.port ?? 0;
	const callbackPath = options.callbackPath ?? "/callback";
	const timeoutMs = options.timeoutMs ?? CALLBACK_TIMEOUT_MS;
	let resolveCallback;
	let rejectCallback;
	let settled = false;
	const callbackPromise = new Promise((resolve, reject) => {
		resolveCallback = resolve;
		rejectCallback = reject;
	});
	const server = http.createServer((req, res) => {
		if (!req.url?.startsWith(callbackPath)) {
			res.writeHead(404);
			res.end();
			return;
		}
		const url = new URL(req.url, `http://${host}`);
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");
		const error = url.searchParams.get("error");
		const errorDescription = url.searchParams.get("error_description");
		if (error) {
			const message = errorDescription ?? error;
			res.writeHead(400, { "Content-Type": "text/html" });
			res.end(renderErrorHtml(message), () => {
				if (!settled) {
					settled = true;
					clearTimeout(timeout);
					closeServer(server);
					rejectCallback(new Error(message));
				}
			});
			return;
		}
		if (!code || !state) {
			res.writeHead(400, { "Content-Type": "text/html" });
			res.end(ERROR_HTML);
			return;
		}
		res.writeHead(200, { "Content-Type": "text/html" });
		res.end(SUCCESS_HTML, () => {
			if (!settled) {
				settled = true;
				clearTimeout(timeout);
				closeServer(server);
				resolveCallback({
					code,
					state,
					redirectUri
				});
			}
		});
	});
	await new Promise((resolve, reject) => {
		server.listen(port, host, () => resolve());
		server.on("error", reject);
	});
	const redirectUri = `http://${host}:${server.address().port}${callbackPath}`;
	const timeout = setTimeout(() => {
		if (!settled) {
			settled = true;
			closeServer(server);
			rejectCallback(/* @__PURE__ */ new Error("OAuth callback timed out"));
		}
	}, timeoutMs);
	return {
		redirectUri,
		waitForCallback: () => callbackPromise,
		shutdown: () => {
			if (!settled) {
				settled = true;
				clearTimeout(timeout);
				closeServer(server);
				rejectCallback(/* @__PURE__ */ new Error("OAuth callback server shut down"));
			}
		}
	};
}
//#endregion
//#region src/main/opencode/auth-login-error.ts
var AuthLoginError = class extends Error {
	constructor(message, options) {
		super(message, options);
		this.name = "AuthLoginError";
	}
};
//#endregion
//#region src/main/opencode/slack-auth/index.ts
var SlackMcpOAuthFlow = class {
	activeCallbackServer = null;
	isDisposed = false;
	isInProgress() {
		return this.activeCallbackServer !== null && !this.isDisposed;
	}
	async start() {
		if (this.isInProgress()) throw new AuthLoginError("A Slack MCP OAuth flow is already running.");
		let callbackServer = null;
		try {
			const metadata = await discoverOAuthMetadata(OPENCODE_SLACK_MCP_SERVER_URL);
			const resourceMetadata = await discoverOAuthProtectedResourceMetadata(OPENCODE_SLACK_MCP_SERVER_URL);
			const scopeList = resourceMetadata.scopesSupported ?? metadata.scopesSupported;
			if (!scopeList || scopeList.length === 0) throw new AuthLoginError("Slack MCP did not advertise any OAuth scopes.");
			callbackServer = await this.startCallbackServer();
			const redirectUri = callbackServer.redirectUri;
			const pkce = generatePkceChallenge();
			const state = randomUUID();
			setSlackMcpPendingAuth({
				codeVerifier: pkce.codeVerifier,
				oauthState: state
			});
			const resource = new URL("/", resourceMetadata.resource).toString();
			const authorizationUrl = buildAuthorizationUrl({
				authorizationEndpoint: metadata.authorizationEndpoint,
				clientId: OPENCODE_SLACK_MCP_CLIENT_ID,
				redirectUri,
				codeChallenge: pkce.codeChallenge,
				state,
				scope: scopeList.join(" "),
				extraParams: { resource }
			});
			await shell.openExternal(authorizationUrl);
			const callback = await callbackServer.waitForCallback();
			if (callback.state !== state) throw new AuthLoginError("Slack authentication failed because the OAuth state did not match.");
			setSlackMcpTokens(await exchangeCodeForTokens({
				tokenEndpoint: metadata.tokenEndpoint,
				code: callback.code,
				codeVerifier: pkce.codeVerifier,
				clientId: OPENCODE_SLACK_MCP_CLIENT_ID,
				redirectUri
			}));
		} catch (error) {
			clearSlackMcpAuth();
			throw toSlackAuthError(error);
		} finally {
			this.activeCallbackServer = null;
			callbackServer?.shutdown();
		}
	}
	async cancel() {
		if (!this.activeCallbackServer) return;
		const callbackServer = this.activeCallbackServer;
		this.activeCallbackServer = null;
		callbackServer.shutdown();
		clearSlackMcpAuth();
	}
	dispose() {
		if (this.isDisposed) return;
		this.isDisposed = true;
		if (this.activeCallbackServer) {
			this.activeCallbackServer.shutdown();
			this.activeCallbackServer = null;
			clearSlackMcpAuth();
		}
	}
	async startCallbackServer() {
		try {
			const callbackServer = await createOAuthCallbackServer({
				host: OPENCODE_SLACK_MCP_CALLBACK_HOST,
				port: OPENCODE_SLACK_MCP_CALLBACK_PORT,
				callbackPath: OPENCODE_SLACK_MCP_CALLBACK_PATH,
				timeoutMs: 5 * 6e4
			});
			if (callbackServer.redirectUri !== getSlackMcpCallbackUrl()) {
				callbackServer.shutdown();
				throw new AuthLoginError(`Slack callback server started with unexpected redirect URI: ${callbackServer.redirectUri}`);
			}
			this.activeCallbackServer = callbackServer;
			return callbackServer;
		} catch (error) {
			throw toSlackAuthError(error);
		}
	}
};
var slackMcpOAuthFlow = new SlackMcpOAuthFlow();
async function loginSlackMcp() {
	await slackMcpOAuthFlow.start();
}
async function logoutSlackMcp() {
	clearSlackMcpAuth();
}
function toSlackAuthError(error) {
	if (error instanceof AuthLoginError) return error;
	if (error instanceof Error && error.code === "EADDRINUSE") return new AuthLoginError(`Slack authentication could not start because ${getSlackMcpCallbackUrl()} is already in use.`, { cause: error });
	if (error instanceof Error) return new AuthLoginError(`Slack authentication failed: ${error.message}`, { cause: error });
	return new AuthLoginError(`Slack authentication failed: ${String(error)}`);
}
//#endregion
//#region src/main/app-shutdown.ts
/**
* app-shutdown.ts — graceful async teardown for `before-quit`.
* Extracted from main/index.ts for ENG-695 file-split refactor.
*/
/**
* Module-level flag set by the "Close and stop daemon" branch of the
* close-confirmation flow. Consumed by `shutdownApp` to send the
* `daemon.shutdown` RPC AFTER the analytics flush, not before.
*
* Before this split, the close handler fired `daemon.shutdown` directly and
* then called `app.quit()`; the daemon scheduled its own exit 100ms after
* replying, which raced `shutdownApp`'s several-seconds browser/HF teardown
* before the flush block ran. Result: `trackAppClose` → `getAllApiKeys` hit
* a closed socket (or the RPC-ready window had closed) and the flush was
* silently skipped on every "stop daemon" quit. Deferring the RPC until
* after the flush closes that race.
*/
var stopDaemonOnQuit = false;
function requestStopDaemonOnQuit() {
	stopDaemonOnQuit = true;
}
async function raceTimeout(promise, ms, label) {
	return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(/* @__PURE__ */ new Error(`${label} timed out after ${ms}ms`)), ms))]);
}
async function shutdownApp(logger) {
	destroyTray();
	try {
		await raceTimeout(stopDevBrowserServer(), 5e3, "Dev-browser shutdown");
	} catch (error) {
		logger?.logEnv("ERROR", `[Main] Failed to stop dev-browser server: ${String(error)}`);
	}
	try {
		await raceTimeout(stopAllBrowserPreviewStreams(), 5e3, "Stopping browser preview streams");
	} catch (error) {
		logger?.logEnv("ERROR", `[Main] Failed to stop browser preview streams: ${String(error)}`);
	}
	try {
		await raceTimeout(stopServer(), 5e3, "HuggingFace server stop");
	} catch (error) {
		logger?.logEnv("ERROR", `[Main] Failed to stop HuggingFace server: ${String(error)}`);
	}
	try {
		cleanupVertexServiceAccountKey();
	} catch (error) {
		logger?.logEnv("ERROR", `[Main] Error during cleanupVertexServiceAccountKey: ${String(error)}`);
	}
	try {
		slackMcpOAuthFlow.dispose();
	} catch (error) {
		logger?.logEnv("ERROR", `[Main] Error during slackMcpOAuthFlow.dispose: ${String(error)}`);
	}
	try {
		close();
	} catch (error) {
		logger?.logEnv("ERROR", `[Main] Error during workspaceManager.close: ${String(error)}`);
	}
	try {
		await trackAppClose();
		flushAnalytics();
	} catch (error) {
		logger?.logEnv("ERROR", `[Main] Error during analytics flush: ${String(error)}`);
	}
	if (stopDaemonOnQuit) try {
		await getDaemonClient().call("daemon.shutdown").catch(() => {});
	} catch (error) {
		logger?.logEnv("INFO", `[Main] daemon.shutdown skipped: ${String(error)}`);
	}
	shutdownDaemon();
	try {
		shutdownLogCollector();
	} finally {
		app.quit();
	}
}
//#endregion
export { testConnection as S, listCachedModels as _, createOAuthCallbackServer as a, startServer as b, cleanupVertexServiceAccountKey as c, stopAllBrowserPreviewStreams as d, stopBrowserPreviewStream as f, getCachePath as g, deleteModel as h, logoutSlackMcp as i, isScreencastActive as l, SUGGESTED_MODELS as m, shutdownApp as n, getOpenCodeCliVersion as o, createTray as p, loginSlackMcp as r, isOpenCodeCliInstalled as s, requestStopDaemonOnQuit as t, startBrowserPreviewStream as u, downloadModel as v, stopServer as x, getServerStatus as y };

//# sourceMappingURL=app-shutdown-CTRIbh0V.js.map