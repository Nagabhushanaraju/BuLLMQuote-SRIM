import * as path$1 from "path";
import path from "path";
import * as fs$1 from "fs";
import fs from "fs";
import crypto from "crypto";
import { ProxyAgent } from "undici";
import { getProxyForUrl } from "proxy-from-env";
import { BedrockClient, ListFoundationModelsCommand } from "@aws-sdk/client-bedrock";
import { execFile, execFileSync, spawnSync } from "child_process";
import * as os from "os";
//#region ../../packages/agent-core/src/common/types/daemon.ts
var JSON_RPC_ERRORS = {
	PARSE_ERROR: -32700,
	INVALID_REQUEST: -32600,
	METHOD_NOT_FOUND: -32601,
	INVALID_PARAMS: -32602,
	INTERNAL_ERROR: -32603,
	TASK_NOT_FOUND: -32e3,
	NO_PROVIDER: -32001,
	NOT_READY: -32002
};
//#endregion
//#region ../../packages/agent-core/src/connectors/oauth-metadata.ts
var OAUTH_FETCH_TIMEOUT_MS = 3e4;
function fetchWithTimeout$1(url, options = {}) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), OAUTH_FETCH_TIMEOUT_MS);
	return fetch(url, {
		...options,
		signal: controller.signal
	}).catch((err) => {
		if (err instanceof Error && err.name === "AbortError") throw new Error(`Request to ${url} timed out after ${OAUTH_FETCH_TIMEOUT_MS}ms`);
		throw err;
	}).finally(() => clearTimeout(timeoutId));
}
/**
* Discover OAuth 2.0 authorization server metadata from an MCP server URL.
* Fetches from {serverUrl}/.well-known/oauth-authorization-server
*/
async function discoverOAuthMetadata(serverUrl) {
	const url = new URL("/.well-known/oauth-authorization-server", serverUrl);
	const response = await fetchWithTimeout$1(url.toString(), {
		method: "GET",
		headers: { Accept: "application/json" }
	});
	if (!response.ok) throw new Error(`Failed to discover OAuth metadata from ${url.toString()}: ${response.status} ${response.statusText}`);
	const data = await response.json();
	const authorizationEndpoint = data.authorization_endpoint;
	const tokenEndpoint = data.token_endpoint;
	if (!authorizationEndpoint || !tokenEndpoint) throw new Error("Invalid OAuth metadata: missing authorization_endpoint or token_endpoint");
	return {
		issuer: data.issuer,
		authorizationEndpoint,
		tokenEndpoint,
		registrationEndpoint: data.registration_endpoint,
		scopesSupported: data.scopes_supported
	};
}
/**
* Discover OAuth protected resource metadata from an MCP server's 401 challenge.
* Fetches the URL advertised in the WWW-Authenticate `resource_metadata` parameter.
*/
async function discoverOAuthProtectedResourceMetadata(serverUrl) {
	const response = await fetchWithTimeout$1(serverUrl, {
		method: "GET",
		headers: { Accept: "application/json" }
	});
	if (response.status !== 401) throw new Error(`Expected ${serverUrl} to return 401 with OAuth metadata, got ${response.status} ${response.statusText}`);
	const metadataUrl = (response.headers.get("www-authenticate")?.match(/\bresource_metadata\s*=\s*"([^"]+)"/i))?.[1];
	let lastError;
	let parsedData;
	/**
	* Fetch a metadata URL, validate content-type, parse JSON, and check the
	* required `resource` field.  Returns the parsed object on success, or sets
	* `lastError` and returns `undefined` so the caller can fall through to the
	* next candidate URL.
	*/
	const tryFetchMetadata = async (url, label) => {
		try {
			const res = await fetchWithTimeout$1(url, {
				method: "GET",
				headers: { Accept: "application/json" }
			});
			if (!res.ok) {
				lastError = /* @__PURE__ */ new Error(`HTTP ${res.status} ${res.statusText} from ${label}`);
				return;
			}
			const ct = res.headers.get("content-type") ?? "";
			if (!ct.toLowerCase().includes("application/json")) {
				lastError = /* @__PURE__ */ new Error(`Non-JSON response from ${label} (Content-Type: ${ct || "none"})`);
				return;
			}
			const body = await res.json();
			if (!body.resource) {
				lastError = /* @__PURE__ */ new Error(`Missing required 'resource' field in response from ${label}`);
				return;
			}
			return body;
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));
			return;
		}
	};
	if (metadataUrl) parsedData = await tryFetchMetadata(metadataUrl, "header url");
	if (!parsedData) {
		const resourceUrl = new URL(serverUrl);
		const resourcePath = resourceUrl.pathname === "/" ? "" : resourceUrl.pathname;
		parsedData = await tryFetchMetadata(new URL(`/.well-known/oauth-protected-resource${resourcePath}`, resourceUrl.origin).toString(), "well-known url");
	}
	if (!parsedData) throw new Error(`Failed to discover protected resource metadata for ${serverUrl}: ${lastError?.message || "Unknown error"}`);
	const data = parsedData;
	return {
		resource: data.resource,
		authorizationServers: data.authorization_servers,
		bearerMethodsSupported: data.bearer_methods_supported,
		scopesSupported: data.scopes_supported,
		resourceName: data.resource_name,
		resourceDocumentation: data.resource_documentation
	};
}
//#endregion
//#region ../../packages/agent-core/src/connectors/oauth-tokens.ts
/**
* Exchange an authorization code for access and refresh tokens.
*/
async function exchangeCodeForTokens(params) {
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		code: params.code,
		code_verifier: params.codeVerifier,
		client_id: params.clientId,
		redirect_uri: params.redirectUri
	});
	if (params.clientSecret) body.set("client_secret", params.clientSecret);
	if (params.resource) body.set("resource", params.resource);
	const response = await fetchWithTimeout$1(params.tokenEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString()
	});
	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorBody}`);
	}
	const data = await response.json();
	const accessToken = data.access_token;
	if (!accessToken) throw new Error("Token response missing access_token");
	const expiresIn = data.expires_in;
	return {
		accessToken,
		refreshToken: data.refresh_token,
		tokenType: data.token_type || "Bearer",
		expiresAt: expiresIn ? Date.now() + expiresIn * 1e3 : void 0,
		scope: data.scope
	};
}
//#endregion
//#region ../../packages/agent-core/src/connectors/mcp-oauth.ts
/**
* Register an OAuth client dynamically with the authorization server.
*/
async function registerOAuthClient(metadata, redirectUri, clientName) {
	if (!metadata.registrationEndpoint) throw new Error("OAuth server does not support dynamic client registration");
	const response = await fetchWithTimeout$1(metadata.registrationEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			client_name: clientName,
			redirect_uris: [redirectUri],
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			token_endpoint_auth_method: "none"
		})
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`OAuth client registration failed: ${response.status} ${response.statusText} - ${body}`);
	}
	const data = await response.json();
	const clientId = data.client_id;
	if (!clientId) throw new Error("OAuth client registration response missing client_id");
	return {
		clientId,
		clientSecret: data.client_secret
	};
}
/**
* Generate a PKCE code verifier and code challenge (S256).
*/
function generatePkceChallenge() {
	const codeVerifier = crypto.randomBytes(32).toString("base64url");
	return {
		codeVerifier,
		codeChallenge: crypto.createHash("sha256").update(codeVerifier).digest().toString("base64url")
	};
}
/**
* Build the OAuth 2.0 authorization URL.
*/
function buildAuthorizationUrl(params) {
	const url = new URL(params.authorizationEndpoint);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("client_id", params.clientId);
	url.searchParams.set("redirect_uri", params.redirectUri);
	url.searchParams.set("code_challenge", params.codeChallenge);
	url.searchParams.set("code_challenge_method", "S256");
	url.searchParams.set("state", params.state);
	if (params.scope) url.searchParams.set("scope", params.scope);
	if (params.extraParams) for (const [key, value] of Object.entries(params.extraParams)) url.searchParams.set(key, value);
	return url.toString();
}
//#endregion
//#region ../../packages/agent-core/src/common/types/provider.ts
var MINIMAX_DEFAULT_BASE_URL = "https://api.minimax.io/v1";
var ZAI_ENDPOINTS = {
	china: "https://open.bigmodel.cn/api/paas/v4",
	international: "https://api.z.ai/api/coding/paas/v4"
};
/**
* Providers that accept API key storage via the setApiKey IPC handler.
* This is the allowlist of providers that can have their API keys stored.
* Uses Set<string> to allow runtime checking of untrusted input strings.
*/
var ALLOWED_API_KEY_PROVIDERS = new Set([
	"anthropic",
	"openai",
	"openrouter",
	"google",
	"xai",
	"deepseek",
	"moonshot",
	"zai",
	"azure-foundry",
	"custom",
	"bedrock",
	"litellm",
	"minimax",
	"lmstudio",
	"vertex",
	"nebius",
	"together",
	"fireworks",
	"groq",
	"venice",
	"nim",
	"elevenlabs",
	"aws-agentcore",
	"browserbase",
	"steel"
]);
/**
* Providers that use standard OpenAI-compatible API key validation.
* These providers can be validated using a simple test request to their API.
* Uses Set<string> to allow runtime checking of untrusted input strings.
*/
var STANDARD_VALIDATION_PROVIDERS = new Set([
	"anthropic",
	"openai",
	"google",
	"xai",
	"deepseek",
	"openrouter",
	"moonshot",
	"zai",
	"minimax",
	"nebius",
	"together",
	"fireworks",
	"groq",
	"venice"
]);
var DEFAULT_PROVIDERS = [
	{
		id: "anthropic",
		name: "Anthropic",
		requiresApiKey: true,
		apiKeyEnvVar: "ANTHROPIC_API_KEY",
		defaultModelId: "anthropic/claude-opus-4-5",
		modelsEndpoint: {
			url: "https://api.anthropic.com/v1/models",
			authStyle: "x-api-key",
			extraHeaders: { "anthropic-version": "2023-06-01" },
			responseFormat: "anthropic",
			modelIdPrefix: "anthropic/",
			modelFilter: /^claude-/
		},
		models: []
	},
	{
		id: "openai",
		name: "OpenAI",
		requiresApiKey: true,
		apiKeyEnvVar: "OPENAI_API_KEY",
		defaultModelId: "openai/gpt-5.2",
		modelsEndpoint: {
			url: "https://api.openai.com/v1/models",
			authStyle: "bearer",
			responseFormat: "openai",
			modelIdPrefix: "openai/",
			modelFilter: /^gpt-|^o[134]|^chatgpt-/
		},
		models: []
	},
	{
		id: "google",
		name: "Google AI",
		requiresApiKey: true,
		apiKeyEnvVar: "GOOGLE_GENERATIVE_AI_API_KEY",
		defaultModelId: "google/gemini-3-pro-preview",
		modelsEndpoint: {
			url: "https://generativelanguage.googleapis.com/v1beta/models",
			authStyle: "query-param",
			responseFormat: "google",
			modelIdPrefix: "google/"
		},
		models: []
	},
	{
		id: "xai",
		name: "xAI",
		requiresApiKey: true,
		apiKeyEnvVar: "XAI_API_KEY",
		baseUrl: "https://api.x.ai",
		defaultModelId: "xai/grok-4",
		modelsEndpoint: {
			url: "https://api.x.ai/v1/models",
			authStyle: "bearer",
			responseFormat: "openai",
			modelIdPrefix: "xai/"
		},
		models: []
	},
	{
		id: "deepseek",
		name: "DeepSeek",
		requiresApiKey: true,
		apiKeyEnvVar: "DEEPSEEK_API_KEY",
		baseUrl: "https://api.deepseek.com",
		defaultModelId: "deepseek/deepseek-chat",
		modelsEndpoint: {
			url: "https://api.deepseek.com/models",
			authStyle: "bearer",
			responseFormat: "openai",
			modelIdPrefix: "deepseek/"
		},
		models: []
	},
	{
		id: "moonshot",
		name: "Moonshot AI",
		requiresApiKey: true,
		apiKeyEnvVar: "MOONSHOT_API_KEY",
		baseUrl: "https://api.moonshot.ai/v1",
		defaultModelId: "moonshot/kimi-k2.5",
		modelsEndpoint: {
			url: "https://api.moonshot.ai/v1/models",
			authStyle: "bearer",
			responseFormat: "openai",
			modelIdPrefix: "moonshot/"
		},
		models: []
	},
	{
		id: "zai",
		name: "Z.AI Coding Plan",
		requiresApiKey: true,
		apiKeyEnvVar: "ZAI_API_KEY",
		baseUrl: "https://open.bigmodel.cn",
		defaultModelId: "zai/glm-4.7-flashx",
		modelsEndpoint: {
			url: "https://open.bigmodel.cn/api/paas/v4/models",
			authStyle: "bearer",
			responseFormat: "openai",
			modelIdPrefix: "zai/"
		},
		models: [{
			id: "glm-5",
			displayName: "GLM-5",
			provider: "zai",
			fullId: "zai/glm-5",
			contextWindow: 128e3,
			supportsVision: false
		}]
	},
	{
		id: "bedrock",
		name: "Amazon Bedrock",
		requiresApiKey: false,
		models: []
	},
	{
		id: "vertex",
		name: "Google Vertex AI",
		requiresApiKey: false,
		models: []
	},
	{
		id: "minimax",
		name: "MiniMax",
		requiresApiKey: true,
		apiKeyEnvVar: "MINIMAX_API_KEY",
		baseUrl: MINIMAX_DEFAULT_BASE_URL,
		editableBaseUrl: true,
		defaultModelId: "minimax/MiniMax-M2.5",
		models: [
			{
				id: "MiniMax-M2",
				displayName: "MiniMax M2",
				provider: "minimax",
				fullId: "minimax/MiniMax-M2",
				contextWindow: 196608,
				supportsVision: false
			},
			{
				id: "MiniMax-M2.1",
				displayName: "MiniMax M2.1",
				provider: "minimax",
				fullId: "minimax/MiniMax-M2.1",
				contextWindow: 204800,
				supportsVision: false
			},
			{
				id: "MiniMax-M2.1-highspeed",
				displayName: "MiniMax M2.1 Highspeed",
				provider: "minimax",
				fullId: "minimax/MiniMax-M2.1-highspeed",
				contextWindow: 204800,
				supportsVision: false
			},
			{
				id: "MiniMax-M2.5",
				displayName: "MiniMax M2.5",
				provider: "minimax",
				fullId: "minimax/MiniMax-M2.5",
				contextWindow: 204800,
				supportsVision: false
			},
			{
				id: "MiniMax-M2.5-highspeed",
				displayName: "MiniMax M2.5 Highspeed",
				provider: "minimax",
				fullId: "minimax/MiniMax-M2.5-highspeed",
				contextWindow: 204800,
				supportsVision: false
			}
		]
	},
	{
		id: "nebius",
		name: "Nebius AI",
		requiresApiKey: true,
		apiKeyEnvVar: "NEBIUS_API_KEY",
		baseUrl: "https://api.studio.nebius.ai/v1",
		modelsEndpoint: {
			url: "https://api.studio.nebius.ai/v1/models",
			authStyle: "bearer",
			responseFormat: "openai",
			modelIdPrefix: "nebius/"
		},
		models: [],
		defaultModelId: "nebius/meta-llama/Meta-Llama-3.1-70B-Instruct"
	},
	{
		id: "together",
		name: "Together AI",
		requiresApiKey: true,
		apiKeyEnvVar: "TOGETHER_API_KEY",
		baseUrl: "https://api.together.xyz/v1",
		modelsEndpoint: {
			url: "https://api.together.xyz/v1/models",
			authStyle: "bearer",
			responseFormat: "openai",
			modelIdPrefix: "together/"
		},
		models: [],
		defaultModelId: "together/meta-llama/Llama-3-70b-chat-hf"
	},
	{
		id: "fireworks",
		name: "Fireworks AI",
		requiresApiKey: true,
		apiKeyEnvVar: "FIREWORKS_API_KEY",
		baseUrl: "https://api.fireworks.ai/inference/v1",
		modelsEndpoint: {
			url: "https://api.fireworks.ai/inference/v1/models",
			authStyle: "bearer",
			responseFormat: "openai",
			modelIdPrefix: "fireworks/"
		},
		models: [],
		defaultModelId: "fireworks/accounts/fireworks/models/llama-v3-70b-instruct"
	},
	{
		id: "groq",
		name: "Groq",
		requiresApiKey: true,
		apiKeyEnvVar: "GROQ_API_KEY",
		baseUrl: "https://api.groq.com/openai/v1",
		modelsEndpoint: {
			url: "https://api.groq.com/openai/v1/models",
			authStyle: "bearer",
			responseFormat: "openai",
			modelIdPrefix: "groq/"
		},
		models: [],
		defaultModelId: "groq/llama3-70b-8192"
	},
	{
		id: "venice",
		name: "Venice AI",
		requiresApiKey: true,
		apiKeyEnvVar: "VENICE_API_KEY",
		baseUrl: "https://api.venice.ai/api/v1",
		defaultModelId: "venice/llama-3.3-70b",
		modelsEndpoint: {
			url: "https://api.venice.ai/api/v1/models",
			authStyle: "bearer",
			responseFormat: "openai",
			modelIdPrefix: "venice/"
		},
		models: []
	},
	{
		id: "copilot",
		name: "GitHub Copilot",
		requiresApiKey: false,
		defaultModelId: "copilot/gpt-4o",
		models: []
	},
	{
		id: "accomplish-ai",
		name: "Accomplish AI",
		requiresApiKey: false,
		defaultModelId: "accomplish-ai/accomplish-free",
		models: [{
			id: "accomplish-free",
			displayName: "Accomplish",
			provider: "accomplish-ai",
			fullId: "accomplish-ai/accomplish-free",
			contextWindow: 128e3,
			maxOutputTokens: 32e3,
			supportsVision: true
		}]
	}
];
//#endregion
//#region ../../packages/agent-core/src/utils/fetch.ts
var proxyDispatcherCache = /* @__PURE__ */ new Map();
/**
* Returns an undici ProxyAgent for the given URL when a proxy is configured
* via environment variables (HTTP_PROXY, HTTPS_PROXY, ALL_PROXY, NO_PROXY, …).
* Proxy selection and NO_PROXY exclusion logic is delegated to proxy-from-env.
* Results are cached by proxy URL so a single dispatcher is reused per proxy.
*/
function getProxyDispatcher(url) {
	const proxyUrl = getProxyForUrl(url);
	if (!proxyUrl) return;
	let dispatcher = proxyDispatcherCache.get(proxyUrl);
	if (!dispatcher) {
		dispatcher = new ProxyAgent(proxyUrl);
		proxyDispatcherCache.set(proxyUrl, dispatcher);
	}
	return dispatcher;
}
async function fetchWithTimeout(url, options, timeoutMs) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const proxyDispatcher = getProxyDispatcher(url);
		return await fetch(url, {
			...options,
			signal: controller.signal,
			...proxyDispatcher ? { dispatcher: proxyDispatcher } : {}
		});
	} finally {
		clearTimeout(timeoutId);
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/validation-providers.ts
/**
* Perform the provider-specific HTTP request for API key validation.
* Returns a Response, or null if the provider skips validation (always valid).
*/
async function fetchValidationResponse(provider, apiKey, options, timeout) {
	switch (provider) {
		case "anthropic": return fetchWithTimeout("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
				"anthropic-version": "2023-06-01"
			},
			body: JSON.stringify({
				model: "claude-3-haiku-20240307",
				max_tokens: 1,
				messages: [{
					role: "user",
					content: "test"
				}]
			})
		}, timeout);
		case "openai": return fetchWithTimeout(`${(options.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "")}/models`, {
			method: "GET",
			headers: { Authorization: `Bearer ${apiKey}` }
		}, timeout);
		case "google": return fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, { method: "GET" }, timeout);
		case "xai": return fetchWithTimeout("https://api.x.ai/v1/models", {
			method: "GET",
			headers: { Authorization: `Bearer ${apiKey}` }
		}, timeout);
		case "deepseek": return fetchWithTimeout("https://api.deepseek.com/models", {
			method: "GET",
			headers: { Authorization: `Bearer ${apiKey}` }
		}, timeout);
		case "openrouter": return fetchWithTimeout("https://openrouter.ai/api/v1/auth/key", {
			method: "GET",
			headers: { Authorization: `Bearer ${apiKey}` }
		}, timeout);
		case "moonshot": return fetchWithTimeout("https://api.moonshot.ai/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: "kimi-latest",
				max_tokens: 1,
				messages: [{
					role: "user",
					content: "test"
				}]
			})
		}, timeout);
		case "zai": {
			const zaiEndpoint = ZAI_ENDPOINTS[options.zaiRegion ?? "international"];
			return fetchWithTimeout(`${zaiEndpoint}/models`, {
				method: "GET",
				headers: { Authorization: `Bearer ${apiKey}` }
			}, timeout);
		}
		case "minimax": return fetchWithTimeout("https://api.minimax.io/anthropic/v1/messages", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
				"anthropic-version": "2023-06-01"
			},
			body: JSON.stringify({
				model: "MiniMax-M2.5",
				max_tokens: 1,
				messages: [{
					role: "user",
					content: "test"
				}]
			})
		}, timeout);
		case "ollama":
		case "bedrock":
		case "vertex":
		case "azure-foundry":
		case "litellm":
		case "lmstudio":
		case "custom": return null;
		default: {
			const providerConfig = DEFAULT_PROVIDERS.find((p) => p.id === provider);
			if (providerConfig?.modelsEndpoint) {
				const { url, authStyle } = providerConfig.modelsEndpoint;
				const headers = {};
				let fetchUrl = url;
				if (authStyle === "bearer") headers["Authorization"] = `Bearer ${apiKey}`;
				else if (authStyle === "query-param") fetchUrl = `${url}?key=${apiKey}`;
				else if (authStyle === "x-api-key") headers["x-api-key"] = apiKey;
				if (providerConfig.modelsEndpoint.extraHeaders) Object.assign(headers, providerConfig.modelsEndpoint.extraHeaders);
				return fetchWithTimeout(fetchUrl, {
					method: "GET",
					headers
				}, timeout);
			}
			return null;
		}
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/validation.ts
var DEFAULT_TIMEOUT_MS$5 = 1e4;
async function validateApiKey(provider, apiKey, options) {
	const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS$5;
	try {
		const response = await fetchValidationResponse(provider, apiKey, options ?? {}, timeout);
		if (response === null) return { valid: true };
		if (response.ok) return { valid: true };
		const errorMessage = (await response.json().catch(() => ({})))?.error?.message || `API returned status ${response.status}`;
		if (response.status === 401) return {
			valid: false,
			error: "Invalid API key"
		};
		return {
			valid: false,
			error: errorMessage
		};
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") return {
			valid: false,
			error: "Request timed out. Please check your internet connection and try again."
		};
		return {
			valid: false,
			error: "Failed to validate API key. Check your internet connection."
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/utils/json.ts
function safeParseJson(json) {
	if (!json) return {
		success: false,
		error: "Input is null or empty"
	};
	try {
		return {
			success: true,
			data: JSON.parse(json)
		};
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : "Unknown error"
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/bedrock-credential-resolver.ts
async function resolveFromIni() {
	const credentialProvidersModule = await import("@aws-sdk/credential-providers");
	const fromIni = credentialProvidersModule.fromIni ?? credentialProvidersModule.default?.fromIni;
	if (!fromIni) throw new Error("AWS credential providers package does not expose fromIni");
	return fromIni;
}
//#endregion
//#region ../../packages/agent-core/src/utils/logging.ts
var LOG_LEVEL_PRIORITY = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3
};
function createConsoleLogger(options = {}) {
	const { prefix = "", minLevel = "debug", includeTimestamp = true } = options;
	const formatMessage = (level, message) => {
		const parts = [];
		if (includeTimestamp) parts.push((/* @__PURE__ */ new Date()).toISOString());
		parts.push(`[${level.toUpperCase()}]`);
		if (prefix) parts.push(`[${prefix}]`);
		parts.push(message);
		return parts.join(" ");
	};
	const shouldLog = (level) => {
		return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
	};
	const log = (level, message, context) => {
		if (!shouldLog(level)) return;
		const formattedMessage = formatMessage(level, message);
		const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
		if (context && Object.keys(context).length > 0) consoleFn(formattedMessage, context);
		else consoleFn(formattedMessage);
	};
	return {
		debug: (message, context) => log("debug", message, context),
		info: (message, context) => log("info", message, context),
		warn: (message, context) => log("warn", message, context),
		error: (message, context) => log("error", message, context),
		child: (childPrefix) => createConsoleLogger({
			...options,
			prefix: prefix ? `${prefix}:${childPrefix}` : childPrefix
		})
	};
}
//#endregion
//#region ../../packages/agent-core/src/providers/bedrock-models.ts
var log$16 = createConsoleLogger({ prefix: "Bedrock" });
/**
* Fetches available foundation models from AWS Bedrock.
*
* Creates a BedrockClient based on the authentication type (apiKey, accessKeys, or profile),
* fetches models, filters for TEXT output modality, and returns a formatted list.
*
* @param credentials - The Bedrock credentials (apiKey, accessKeys, or profile based)
* @returns Object with success status, models array, and optional error message
*/
async function fetchBedrockModels(credentials) {
	let originalToken;
	const setEnvVar = credentials.authType === "apiKey";
	if (setEnvVar) {
		originalToken = process.env.AWS_BEARER_TOKEN_BEDROCK;
		process.env.AWS_BEARER_TOKEN_BEDROCK = credentials.apiKey;
	}
	try {
		let bedrockClient;
		if (credentials.authType === "apiKey") bedrockClient = new BedrockClient({ region: credentials.region || "us-east-1" });
		else if (credentials.authType === "accessKeys") bedrockClient = new BedrockClient({
			region: credentials.region || "us-east-1",
			credentials: {
				accessKeyId: credentials.accessKeyId,
				secretAccessKey: credentials.secretAccessKey,
				sessionToken: credentials.sessionToken
			}
		});
		else {
			const fromIni = await resolveFromIni();
			bedrockClient = new BedrockClient({
				region: credentials.region || "us-east-1",
				credentials: fromIni({ profile: credentials.profileName })
			});
		}
		const command = new ListFoundationModelsCommand({});
		return {
			success: true,
			models: ((await bedrockClient.send(command)).modelSummaries || []).filter((m) => m.outputModalities?.includes("TEXT")).map((m) => ({
				id: `amazon-bedrock/${m.modelId}`,
				name: m.modelId || "Unknown",
				provider: m.providerName || "Unknown"
			})).sort((a, b) => a.name.localeCompare(b.name))
		};
	} catch (error) {
		log$16.error(`[Bedrock] Failed to fetch models: ${error}`);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
			models: []
		};
	} finally {
		if (setEnvVar) if (originalToken !== void 0) process.env.AWS_BEARER_TOKEN_BEDROCK = originalToken;
		else delete process.env.AWS_BEARER_TOKEN_BEDROCK;
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/bedrock.ts
/**
* Validates AWS Bedrock credentials by making a test API call.
* Supports three authentication types:
* - API Key (bearer token)
* - Access Keys (accessKeyId + secretAccessKey)
* - IAM Profile (uses fromIni)
*
* @param credentialsJson - JSON string containing BedrockCredentials
* @returns ValidationResult indicating if credentials are valid
*/
async function validateBedrockCredentials(credentialsJson) {
	const parseResult = safeParseJson(credentialsJson);
	if (!parseResult.success) return {
		valid: false,
		error: "Failed to parse credentials"
	};
	const parsed = parseResult.data;
	let client;
	let cleanupEnv = null;
	try {
		if (parsed.authType === "apiKey") {
			const originalToken = process.env.AWS_BEARER_TOKEN_BEDROCK;
			process.env.AWS_BEARER_TOKEN_BEDROCK = parsed.apiKey;
			cleanupEnv = () => {
				if (originalToken !== void 0) process.env.AWS_BEARER_TOKEN_BEDROCK = originalToken;
				else delete process.env.AWS_BEARER_TOKEN_BEDROCK;
			};
			client = new BedrockClient({ region: parsed.region || "us-east-1" });
		} else if (parsed.authType === "accessKeys") {
			if (!parsed.accessKeyId || !parsed.secretAccessKey) return {
				valid: false,
				error: "Access Key ID and Secret Access Key are required"
			};
			const awsCredentials = {
				accessKeyId: parsed.accessKeyId,
				secretAccessKey: parsed.secretAccessKey
			};
			if (parsed.sessionToken) awsCredentials.sessionToken = parsed.sessionToken;
			client = new BedrockClient({
				region: parsed.region || "us-east-1",
				credentials: awsCredentials
			});
		} else if (parsed.authType === "profile") {
			const fromIni = await resolveFromIni();
			client = new BedrockClient({
				region: parsed.region || "us-east-1",
				credentials: fromIni({ profile: parsed.profileName || "default" })
			});
		} else return {
			valid: false,
			error: "Invalid authentication type"
		};
		const command = new ListFoundationModelsCommand({});
		await client.send(command);
		return { valid: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Validation failed";
		if (message.includes("UnrecognizedClientException") || message.includes("InvalidSignatureException")) return {
			valid: false,
			error: "Invalid AWS credentials. Please check your Access Key ID and Secret Access Key."
		};
		if (message.includes("AccessDeniedException")) return {
			valid: false,
			error: "Access denied. Ensure your AWS credentials have Bedrock permissions."
		};
		if (message.includes("could not be found")) return {
			valid: false,
			error: "AWS profile not found. Check your ~/.aws/credentials file."
		};
		if (message.includes("InvalidBearerTokenException") || message.includes("bearer token")) return {
			valid: false,
			error: "Invalid Bedrock API key. Please check your API key and try again."
		};
		return {
			valid: false,
			error: message
		};
	} finally {
		cleanupEnv?.();
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/vertex-auth.ts
/**
* Vertex AI authentication helpers
*
* Handles access token acquisition for Google Cloud Vertex AI via:
* - Service account key (JWT → OAuth2 token exchange)
* - Application Default Credentials (gcloud CLI)
*/
var VERTEX_TOKEN_TIMEOUT_MS$1 = 15e3;
/**
* Generates a signed JWT from a GCP service account key and exchanges it
* for an access token via Google's OAuth2 token endpoint.
*/
async function getServiceAccountAccessToken(key) {
	const now = Math.floor(Date.now() / 1e3);
	const header = {
		alg: "RS256",
		typ: "JWT"
	};
	const payload = {
		iss: key.client_email,
		scope: "https://www.googleapis.com/auth/cloud-platform",
		aud: "https://oauth2.googleapis.com/token",
		iat: now,
		exp: now + 3600
	};
	const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
	const unsigned = `${encode(header)}.${encode(payload)}`;
	const signer = crypto.createSign("RSA-SHA256");
	signer.update(unsigned);
	const jwt = `${unsigned}.${signer.sign(key.private_key, "base64url")}`;
	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
		signal: AbortSignal.timeout(VERTEX_TOKEN_TIMEOUT_MS$1)
	});
	if (!response.ok) {
		const errorText = await response.text().catch(() => "");
		throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
	}
	const data = await response.json();
	if (!data.access_token) throw new Error("No access token in response");
	return data.access_token;
}
/**
* Gets an access token using Application Default Credentials (gcloud CLI).
*/
async function getAdcAccessToken() {
	try {
		const token = await new Promise((resolve, reject) => {
			execFile("gcloud", [
				"auth",
				"application-default",
				"print-access-token"
			], {
				timeout: VERTEX_TOKEN_TIMEOUT_MS$1,
				encoding: "utf-8"
			}, (error, stdout) => {
				if (error) reject(error);
				else resolve(stdout.trim());
			});
		});
		if (!token) throw new Error("Empty token returned from gcloud");
		return token;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		if (message.includes("ENOENT") || message.includes("not found") || message.includes("not recognized")) throw new Error("gcloud CLI not found. Install the Google Cloud SDK and run \"gcloud auth application-default login\".");
		throw new Error(`Failed to get ADC token: ${message}`);
	}
}
/**
* Obtains an access token based on the credential type.
*/
async function getVertexAccessToken(credentials) {
	switch (credentials.authType) {
		case "serviceAccount": {
			const parseResult = safeParseJson(credentials.serviceAccountJson);
			if (!parseResult.success) throw new Error("Invalid service account JSON");
			return getServiceAccountAccessToken(parseResult.data);
		}
		case "adc": return await getAdcAccessToken();
		default: throw new Error(`Unknown authType: ${credentials.authType}`);
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/vertex.ts
/** Curated list of Google models available through Vertex AI.
*  Source: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models
*/
var VERTEX_CURATED_MODELS = [
	{
		publisher: "google",
		modelId: "gemini-3-pro-preview",
		displayName: "Gemini 3 Pro (Preview)"
	},
	{
		publisher: "google",
		modelId: "gemini-3-flash-preview",
		displayName: "Gemini 3 Flash (Preview)"
	},
	{
		publisher: "google",
		modelId: "gemini-2.5-pro",
		displayName: "Gemini 2.5 Pro"
	},
	{
		publisher: "google",
		modelId: "gemini-2.5-flash",
		displayName: "Gemini 2.5 Flash"
	},
	{
		publisher: "google",
		modelId: "gemini-2.5-flash-lite",
		displayName: "Gemini 2.5 Flash Lite"
	}
];
var VERTEX_TOKEN_TIMEOUT_MS = 15e3;
/**
* Client for Vertex AI API calls. Encapsulates base URL, auth token,
* and project/location.
*/
var VertexClient = class VertexClient {
	baseUrl;
	headers;
	constructor(projectId, location, accessToken) {
		this.projectId = projectId;
		this.location = location;
		this.accessToken = accessToken;
		this.baseUrl = location === "global" ? "https://aiplatform.googleapis.com" : `https://${location}-aiplatform.googleapis.com`;
		this.headers = {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json"
		};
	}
	/** Factory: acquires token from credentials, returns ready client */
	static async create(credentials) {
		const token = await getVertexAccessToken(credentials);
		return new VertexClient(credentials.projectId, credentials.location, token);
	}
	/** Quick connectivity + auth test via a lightweight generateContent call */
	async testAccess() {
		const url = `${this.baseUrl}/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/gemini-2.5-flash:generateContent`;
		const response = await fetch(url, {
			method: "POST",
			headers: this.headers,
			body: JSON.stringify({ contents: [{
				role: "user",
				parts: [{ text: "Say hi" }]
			}] }),
			signal: AbortSignal.timeout(VERTEX_TOKEN_TIMEOUT_MS)
		});
		if (!response.ok) {
			if (response.status === 429) return;
			const errorText = await response.text().catch(() => "");
			if (response.status === 401 || response.status === 403) throw new Error("Authentication failed. Check your credentials and ensure the Vertex AI API is enabled.");
			if (response.status === 404) throw new Error(`Project "${this.projectId}" or location "${this.location}" not found. Verify your project ID and location.`);
			throw new Error(`Vertex AI API error (${response.status}): ${errorText}`);
		}
	}
};
/**
* Validates Vertex AI credentials by obtaining an access token and making a test API call.
*/
async function validateVertexCredentials(credentialsJson) {
	const parseResult = safeParseJson(credentialsJson);
	if (!parseResult.success) return {
		valid: false,
		error: "Failed to parse credentials"
	};
	const credentials = parseResult.data;
	if (!credentials.projectId?.trim()) return {
		valid: false,
		error: "Project ID is required"
	};
	if (!credentials.location?.trim()) return {
		valid: false,
		error: "Location is required"
	};
	if (credentials.authType === "serviceAccount") {
		if (!credentials.serviceAccountJson?.trim()) return {
			valid: false,
			error: "Service account JSON key is required"
		};
		const keyResult = safeParseJson(credentials.serviceAccountJson);
		if (!keyResult.success) return {
			valid: false,
			error: "Invalid service account JSON format"
		};
		const key = keyResult.data;
		if (!key.type || !key.project_id || !key.private_key || !key.client_email) return {
			valid: false,
			error: "Service account key missing required fields (type, project_id, private_key, client_email)"
		};
	}
	try {
		await (await VertexClient.create(credentials)).testAccess();
		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			error: error instanceof Error ? error.message : "Validation failed"
		};
	}
}
/**
* Returns the curated list of models available on Vertex AI.
* No API call needed — the list is hardcoded from Google's documentation.
*/
function fetchVertexModels(_credentials) {
	return {
		success: true,
		models: VERTEX_CURATED_MODELS.map((m) => ({
			id: `vertex/${m.publisher}/${m.modelId}`,
			name: m.displayName,
			provider: m.publisher
		}))
	};
}
//#endregion
//#region ../../packages/agent-core/src/utils/url.ts
function validateHttpUrl(urlString, fieldName = "URL") {
	try {
		const parsed = new URL(urlString);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error(`${fieldName} must use http or https protocol`);
		return parsed;
	} catch (error) {
		if (error instanceof Error && error.message.includes("protocol")) throw error;
		throw new Error(`${fieldName} is not a valid URL`);
	}
}
//#endregion
//#region ../../packages/agent-core/src/opencode/proxies/azure-token-manager.ts
var log$15 = createConsoleLogger({ prefix: "AzureTokenManager" });
var tokenCache = null;
var REFRESH_BUFFER_MS = 300 * 1e3;
var DEFAULT_TOKEN_LIFETIME_MS = 3600 * 1e3;
async function getAzureEntraToken() {
	const now = /* @__PURE__ */ new Date();
	if (tokenCache && tokenCache.expiresAt > new Date(now.getTime() + REFRESH_BUFFER_MS)) return {
		success: true,
		token: tokenCache.token
	};
	try {
		const { DefaultAzureCredential } = await import("@azure/identity");
		const tokenResponse = await new DefaultAzureCredential().getToken("https://cognitiveservices.azure.com/.default");
		let expiresAt;
		if (tokenResponse.expiresOnTimestamp) expiresAt = new Date(tokenResponse.expiresOnTimestamp);
		else expiresAt = new Date(now.getTime() + DEFAULT_TOKEN_LIFETIME_MS);
		tokenCache = {
			token: tokenResponse.token,
			expiresAt
		};
		log$15.info(`[Azure Token Manager] Acquired new token, expires at ${expiresAt.toISOString()}`);
		return {
			success: true,
			token: tokenResponse.token
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		let hint = "";
		if (message.includes("AADSTS")) hint = " Check your Azure AD configuration.";
		else if (message.includes("DefaultAzureCredential")) hint = " Ensure you're logged in with 'az login' or have valid Azure credentials configured.";
		else if (message.includes("network") || message.includes("ENOTFOUND")) hint = " Check your network connectivity.";
		return {
			success: false,
			error: `Failed to acquire Azure Entra ID token: ${message}.${hint}`
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/utils/sanitize.ts
var PROMPT_DEFAULT_MAX_LENGTH = 6e4;
function sanitizeString(input, fieldName, maxLength = PROMPT_DEFAULT_MAX_LENGTH) {
	if (typeof input !== "string") throw new Error(`${fieldName} must be a string`);
	const trimmed = input.trim();
	if (!trimmed) throw new Error(`${fieldName} is required`);
	if (trimmed.length > maxLength) throw new Error(`${fieldName} exceeds maximum length of ${maxLength}`);
	return trimmed;
}
//#endregion
//#region ../../packages/agent-core/src/providers/azure-foundry-auth.ts
/**
* Azure Foundry authentication helpers
*
* Utilities for acquiring auth headers and tokens for Azure Foundry
* (Azure OpenAI) API requests. Supports api-key and Entra ID auth types.
* Also provides a retry helper for the max_tokens/max_completion_tokens
* compatibility issue across Azure OpenAI deployment versions.
*/
var DEFAULT_AZURE_TIMEOUT_MS = 15e3;
/**
* POST a minimal chat completion to Azure OpenAI.
* Automatically retries with `max_tokens` if the deployment rejects `max_completion_tokens`.
* Returns the final Response (ok or not) or throws on network error.
*/
async function postAzureChatCompletionWithRetry(testUrl, headers, content, timeout) {
	const baseBody = { messages: [{
		role: "user",
		content
	}] };
	const response = await fetchWithTimeout(testUrl, {
		method: "POST",
		headers,
		body: JSON.stringify({
			...baseBody,
			max_completion_tokens: 5
		})
	}, timeout);
	if (response.ok) return response;
	if (((await response.clone().json().catch(() => ({})))?.error?.message || "").includes("max_completion_tokens")) return fetchWithTimeout(testUrl, {
		method: "POST",
		headers,
		body: JSON.stringify({
			...baseBody,
			max_tokens: 5
		})
	}, timeout);
	return response;
}
/** Shared helper: fetch an Entra ID token and build the Authorization header. */
async function getEntraAuthHeader() {
	const tokenResult = await getAzureEntraToken();
	if (!tokenResult.success) return {
		success: false,
		error: tokenResult.error
	};
	return {
		success: true,
		authValue: `Bearer ${tokenResult.token}`
	};
}
/**
* Build Authorization headers for an Azure Foundry API request.
* Returns the headers dict and the raw auth value for reuse.
*/
async function buildAzureAuthHeaders(authType, apiKey) {
	const headers = { "Content-Type": "application/json" };
	if (authType === "entra-id") {
		const entraResult = await getEntraAuthHeader();
		if (!entraResult.success) return {
			success: false,
			error: entraResult.error
		};
		headers["Authorization"] = entraResult.authValue;
		return {
			success: true,
			headers,
			authValue: entraResult.authValue
		};
	}
	if (!apiKey) return {
		success: false,
		error: "API key is required for api-key authentication"
	};
	let sanitizedKey;
	try {
		sanitizedKey = sanitizeString(apiKey, "apiKey", 256);
	} catch (e) {
		return {
			success: false,
			error: e instanceof Error ? e.message : "Invalid API key"
		};
	}
	headers["api-key"] = sanitizedKey;
	return {
		success: true,
		headers,
		authValue: sanitizedKey
	};
}
/**
* Build auth headers for a connection test (raw api-key, no sanitization).
* Used in testAzureFoundryConnection where the key comes directly from user input.
*/
async function buildTestAuthHeaders(authType, apiKey) {
	const headers = { "Content-Type": "application/json" };
	if (authType === "api-key") {
		const trimmedKey = apiKey?.trim();
		if (!trimmedKey) return {
			success: false,
			error: "API key is required for API key authentication"
		};
		headers["api-key"] = trimmedKey;
		return {
			success: true,
			headers
		};
	}
	const entraResult = await getEntraAuthHeader();
	if (!entraResult.success) return {
		success: false,
		error: entraResult.error
	};
	headers["Authorization"] = entraResult.authValue;
	return {
		success: true,
		headers
	};
}
//#endregion
//#region ../../packages/agent-core/src/providers/azure-foundry.ts
var log$14 = createConsoleLogger({ prefix: "AzureFoundry" });
/**
* Tests connection to an Azure Foundry (Azure OpenAI) endpoint.
*/
async function testAzureFoundryConnection(options) {
	const { endpoint, deploymentName, authType, apiKey, timeout = DEFAULT_AZURE_TIMEOUT_MS } = options;
	let baseUrl;
	try {
		validateHttpUrl(endpoint, "Azure Foundry endpoint");
		baseUrl = endpoint.replace(/\/$/, "");
	} catch (e) {
		return {
			success: false,
			error: e instanceof Error ? e.message : "Invalid endpoint URL format"
		};
	}
	const authResult = await buildTestAuthHeaders(authType, apiKey);
	if (!authResult.success) return {
		success: false,
		error: authResult.error
	};
	const testUrl = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`;
	try {
		const response = await postAzureChatCompletionWithRetry(testUrl, authResult.headers, "Hi", timeout);
		if (!response.ok) return {
			success: false,
			error: (await response.json().catch(() => ({})))?.error?.message || `API returned status ${response.status}`
		};
		log$14.info(`[Azure Foundry] Connection test successful for deployment: ${deploymentName}`);
		return { success: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Connection failed";
		log$14.warn(`[Azure Foundry] Connection test failed: ${message}`);
		if (error instanceof Error && error.name === "AbortError") return {
			success: false,
			error: "Request timed out. Check your endpoint URL and network connection."
		};
		return {
			success: false,
			error: message
		};
	}
}
/**
* Validates Azure Foundry (Azure OpenAI) credentials by making a test API call.
*/
async function validateAzureFoundry(config, options) {
	const baseUrl = options.baseUrl || config?.baseUrl;
	const deploymentName = options.deploymentName || config?.deploymentName;
	const authType = options.authType || config?.authType || "api-key";
	const timeout = options.timeout ?? 15e3;
	if (authType === "entra-id" && (!options.baseUrl || !options.deploymentName)) return { valid: true };
	const authResult = await buildAzureAuthHeaders(authType, options.apiKey);
	if (!authResult.success) return {
		valid: false,
		error: authResult.error
	};
	if (!baseUrl || !deploymentName) {
		log$14.info("[Azure Foundry] Skipping validation (missing config or options)");
		return { valid: true };
	}
	if (authType === "entra-id" && !authResult.authValue) return {
		valid: false,
		error: "Missing Entra ID access token for Azure Foundry validation request"
	};
	const testUrl = `${baseUrl.replace(/\/+$/, "")}/openai/deployments/${deploymentName}/chat/completions?api-version=2023-05-15`;
	try {
		const response = await postAzureChatCompletionWithRetry(testUrl, authResult.headers, "test", timeout);
		if (response.ok) {
			log$14.info("[Azure Foundry] Validation succeeded");
			return { valid: true };
		}
		const errorMessage = (await response.json().catch(() => ({})))?.error?.message || `API returned status ${response.status}`;
		log$14.warn("[Azure Foundry] Validation failed", { error: errorMessage });
		return {
			valid: false,
			error: errorMessage
		};
	} catch (error) {
		log$14.error("[Azure Foundry] Validation error", { error: error instanceof Error ? error.message : String(error) });
		if (error instanceof Error && error.name === "AbortError") return {
			valid: false,
			error: "Request timed out. Please check your internet connection and try again."
		};
		return {
			valid: false,
			error: "Failed to validate API key. Check your internet connection."
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/openrouter.ts
var log$13 = createConsoleLogger({ prefix: "OpenRouter" });
var DEFAULT_TIMEOUT_MS$4 = 1e4;
/**
* Fetches available models from the OpenRouter API.
*
* @param apiKey - The OpenRouter API key
* @param timeout - Request timeout in milliseconds (default: 10000)
* @returns Result object with success status and models array or error message
*/
async function fetchOpenRouterModels(apiKey, timeout = DEFAULT_TIMEOUT_MS$4) {
	if (!apiKey) return {
		success: false,
		error: "No OpenRouter API key configured"
	};
	try {
		const response = await fetchWithTimeout("https://openrouter.ai/api/v1/models", {
			method: "GET",
			headers: { Authorization: `Bearer ${apiKey}` }
		}, timeout);
		if (!response.ok) return {
			success: false,
			error: (await response.json().catch(() => ({})))?.error?.message || `API returned status ${response.status}`
		};
		const models = ((await response.json()).data || []).map((m) => {
			const provider = m.id.split("/")[0] || "unknown";
			return {
				id: m.id,
				name: m.name || m.id,
				provider,
				contextLength: m.context_length || 0
			};
		});
		log$13.info(`[OpenRouter] Fetched ${models.length} models`);
		return {
			success: true,
			models
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to fetch models";
		log$13.warn(`[OpenRouter] Fetch failed: ${message}`);
		if (error instanceof Error && error.name === "AbortError") return {
			success: false,
			error: "Request timed out. Check your internet connection."
		};
		return {
			success: false,
			error: `Failed to fetch models: ${message}`
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/nim.ts
var log$12 = createConsoleLogger({ prefix: "NIM" });
var DEFAULT_TIMEOUT_MS$3 = 1e4;
function mapNimModels(rawModels) {
	const results = [];
	for (const m of rawModels || []) {
		if (!m || typeof m.id !== "string" || !m.id.trim()) continue;
		const parts = m.id.split("/");
		const provider = (parts.length > 1 ? parts[0] : m.owned_by || "nvidia") || m.owned_by || "nvidia";
		const modelPart = parts.length > 1 ? parts.slice(1).join("/") : m.id;
		const providerDisplay = provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "";
		const modelDisplay = modelPart ? modelPart.split(/[-_]/).map((word) => word ? word.charAt(0).toUpperCase() + word.slice(1) : "").join(" ") : m.id;
		const displayName = parts.length > 1 && providerDisplay ? `${providerDisplay}: ${modelDisplay}` : modelDisplay;
		results.push({
			id: m.id,
			name: displayName || m.id,
			provider,
			contextLength: 0
		});
	}
	return results;
}
async function requestNimModels(normalizedUrl, sanitizedApiKey, timeoutErrorMessage, genericErrorPrefix) {
	try {
		const headers = { Authorization: `Bearer ${sanitizedApiKey}` };
		const response = await fetchWithTimeout(`${normalizedUrl}/models`, {
			method: "GET",
			headers
		}, DEFAULT_TIMEOUT_MS$3);
		if (!response.ok) return {
			success: false,
			error: (await response.json().catch(() => ({})))?.error?.message || `API returned status ${response.status}`
		};
		return {
			success: true,
			models: mapNimModels((await response.json()).data)
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		if (error instanceof Error && error.name === "AbortError") return {
			success: false,
			error: timeoutErrorMessage
		};
		return {
			success: false,
			error: `${genericErrorPrefix}: ${message}`
		};
	}
}
/**
* Tests connection to an NVIDIA NIM endpoint and retrieves available models.
* Makes an HTTP request to the OpenAI-compatible /models endpoint.
*
* @param url - The NIM base URL (default: https://integrate.api.nvidia.com/v1)
* @param apiKey - NVIDIA API key (NGC)
* @returns Connection result with available models on success
*/
async function testNimConnection(url, apiKey) {
	const sanitizedUrl = sanitizeString(url, "nimUrl", 256);
	const sanitizedApiKey = sanitizeString(apiKey, "apiKey", 256);
	try {
		validateHttpUrl(sanitizedUrl, "NIM URL");
	} catch (e) {
		return {
			success: false,
			error: e instanceof Error ? e.message : "Invalid URL format"
		};
	}
	if (!sanitizedApiKey) return {
		success: false,
		error: "API key is required for NVIDIA NIM"
	};
	const result = await requestNimModels(sanitizedUrl.replace(/\/+$/, ""), sanitizedApiKey, "Connection timed out. Check your NVIDIA NIM endpoint.", "Cannot connect to NVIDIA NIM");
	if (result.success) log$12.info(`Connection successful, found ${result.models?.length ?? 0} models`);
	else log$12.warn(`Connection failed: ${result.error}`);
	return result;
}
/**
* Fetches available models from a configured NVIDIA NIM endpoint.
*
* @param options - Configuration and API key
* @returns Result with formatted models on success
*/
async function fetchNimModels(options) {
	const { config, apiKey } = options;
	if (!config || !config.baseUrl) return {
		success: false,
		error: "No NVIDIA NIM endpoint configured"
	};
	const sanitizedApiKey = sanitizeString(apiKey || "", "apiKey", 256);
	if (!sanitizedApiKey) return {
		success: false,
		error: "API key is required for NVIDIA NIM"
	};
	const sanitizedUrl = sanitizeString(config.baseUrl, "nimUrl", 256).replace(/\/+$/, "");
	try {
		validateHttpUrl(sanitizedUrl, "NIM URL");
	} catch (_e) {
		return {
			success: false,
			error: "Invalid NVIDIA NIM endpoint URL"
		};
	}
	const result = await requestNimModels(sanitizedUrl, sanitizedApiKey, "Request timed out. Check your NVIDIA NIM endpoint.", "Failed to fetch models");
	if (result.success) log$12.info(`Fetched ${result.models?.length ?? 0} models`);
	else log$12.warn(`Fetch failed: ${result.error}`);
	return result;
}
//#endregion
//#region ../../packages/agent-core/src/providers/tool-support-testing.ts
var log$11 = createConsoleLogger({ prefix: "ToolSupportTesting" });
/**
* Tests whether a local LLM model supports tool calling.
*
* Makes a test API request to the OpenAI-compatible /v1/chat/completions endpoint
* with a simple tool definition and tool_choice: 'required' to determine if the
* model can make tool calls.
*
* @param options - Test configuration options
* @returns The tool support status: 'supported', 'unsupported', or 'unknown'
*/
async function testModelToolSupport(options) {
	const { baseUrl, modelId, providerName, timeoutMs = 1e4 } = options;
	const testPayload = {
		model: modelId,
		messages: [{
			role: "user",
			content: "What is the current time? You must use the get_current_time tool."
		}],
		tools: [{
			type: "function",
			function: {
				name: "get_current_time",
				description: "Gets the current time. Must be called to know what time it is.",
				parameters: {
					type: "object",
					properties: { timezone: {
						type: "string",
						description: "Timezone (e.g., UTC, America/New_York)"
					} },
					required: []
				}
			}
		}],
		tool_choice: "required",
		max_tokens: 100
	};
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
		const response = await fetch(`${baseUrl}/v1/chat/completions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(testPayload),
			signal: controller.signal
		});
		clearTimeout(timeoutId);
		if (!response.ok) {
			const errorText = await response.text();
			if (errorText.includes("tool") || errorText.includes("function") || errorText.includes("does not support")) {
				log$11.info(`[${providerName}] Model ${modelId} does not support tools (error response)`);
				return "unsupported";
			}
			log$11.warn(`[${providerName}] Tool test failed for ${modelId}: ${response.status}`);
			return "unknown";
		}
		const choice = (await response.json()).choices?.[0];
		if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
			log$11.info(`[${providerName}] Model ${modelId} supports tools (made tool call)`);
			return "supported";
		}
		if (choice?.finish_reason === "tool_calls") {
			log$11.info(`[${providerName}] Model ${modelId} supports tools (finish_reason)`);
			return "supported";
		}
		return "unknown";
	} catch (error) {
		if (error instanceof Error) {
			if (error.name === "AbortError") {
				log$11.warn(`[${providerName}] Tool test timed out for ${modelId}`);
				return "unknown";
			}
			if (error.message.includes("tool") || error.message.includes("function")) {
				log$11.info(`[${providerName}] Model ${modelId} does not support tools (exception)`);
				return "unsupported";
			}
		}
		log$11.warn(`[${providerName}] Tool test error for ${modelId}: ${error}`);
		return "unknown";
	}
}
/**
* Check tool support for an Ollama model using the /api/show endpoint.
* Returns the capabilities from model metadata instead of making inference calls.
*
* @param baseUrl - Ollama server base URL
* @param modelId - Model ID to test
* @returns The tool support status
*/
async function testOllamaModelToolSupport(baseUrl, modelId) {
	try {
		const response = await fetchWithTimeout(`${baseUrl}/api/show`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model: modelId })
		}, 5e3);
		if (!response.ok) {
			log$11.warn(`[Ollama] /api/show failed for ${modelId}: ${response.status}`);
			return "unknown";
		}
		const data = await response.json();
		if (data.capabilities?.includes("tools")) {
			log$11.info(`[Ollama] Model ${modelId} supports tools (capabilities)`);
			return "supported";
		}
		if (Array.isArray(data.capabilities)) {
			log$11.info(`[Ollama] Model ${modelId} does not support tools (capabilities: ${data.capabilities.join(", ")})`);
			return "unsupported";
		}
		log$11.info(`[Ollama] Model ${modelId} has no capabilities field`);
		return "unknown";
	} catch (error) {
		log$11.warn(`[Ollama] Tool check error for ${modelId}: ${error}`);
		return "unknown";
	}
}
/**
* Tests whether an LM Studio model supports tool calling.
*
* @param baseUrl - LM Studio server base URL
* @param modelId - Model ID to test
* @returns The tool support status
*/
async function testLMStudioModelToolSupport(baseUrl, modelId) {
	return testModelToolSupport({
		baseUrl,
		modelId,
		providerName: "LM Studio"
	});
}
//#endregion
//#region ../../packages/agent-core/src/providers/ollama.ts
/** Default timeout for Ollama API requests in milliseconds */
var OLLAMA_API_TIMEOUT_MS = 15e3;
/**
* Tests connection to an Ollama server and retrieves available models.
*
* This function:
* 1. Validates and sanitizes the provided URL
* 2. Calls the Ollama /api/tags endpoint to list available models
* 3. For each model, tests whether it supports tool calling
*
* @param url - The Ollama server URL (e.g., 'http://localhost:11434')
* @returns Connection result with success status and available models
*/
async function testOllamaConnection(url) {
	const sanitizedUrl = sanitizeString(url, "ollamaUrl", 256);
	try {
		validateHttpUrl(sanitizedUrl, "Ollama URL");
	} catch (e) {
		return {
			success: false,
			error: e instanceof Error ? e.message : "Invalid URL format"
		};
	}
	try {
		const response = await fetchWithTimeout(`${sanitizedUrl}/api/tags`, { method: "GET" }, OLLAMA_API_TIMEOUT_MS);
		if (!response.ok) throw new Error(`Ollama returned status ${response.status}`);
		const rawModels = (await response.json()).models || [];
		if (rawModels.length === 0) return {
			success: true,
			models: []
		};
		const BATCH_SIZE = 5;
		const models = [];
		for (let i = 0; i < rawModels.length; i += BATCH_SIZE) {
			const batch = rawModels.slice(i, i + BATCH_SIZE);
			const results = await Promise.all(batch.map(async (m) => {
				const toolSupport = await testOllamaModelToolSupport(sanitizedUrl, m.name);
				return {
					id: m.name,
					displayName: m.name,
					size: m.size,
					toolSupport
				};
			}));
			models.push(...results);
		}
		return {
			success: true,
			models
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Connection failed";
		if (error instanceof Error && error.name === "AbortError") return {
			success: false,
			error: "Connection timed out. Make sure Ollama is running."
		};
		return {
			success: false,
			error: `Cannot connect to Ollama: ${message}`
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/common/constants/model-display.ts
var MODEL_DISPLAY_NAMES = {
	"claude-opus-4-6": "Claude Opus 4.6",
	"claude-opus-4-5": "Claude Opus 4.5",
	"claude-sonnet-4-5": "Claude Sonnet 4.5",
	"claude-haiku-4-5": "Claude Haiku 4.5",
	"claude-opus-4": "Claude Opus 4",
	"claude-sonnet-4": "Claude Sonnet 4",
	"claude-haiku-3-5": "Claude Haiku 3.5",
	"gpt-5.2": "GPT 5.2",
	"gpt-5.2-codex": "GPT 5.2 Codex",
	"gpt-5.1-codex-max": "GPT 5.1 Codex Max",
	"gpt-5.1-codex-mini": "GPT 5.1 Codex Mini",
	"gpt-4o": "GPT-4o",
	"gpt-4o-mini": "GPT-4o Mini",
	"gpt-4-turbo": "GPT-4 Turbo",
	o1: "o1",
	"o1-mini": "o1 Mini",
	"o1-preview": "o1 Preview",
	"o3-mini": "o3 Mini",
	"gemini-3-pro-preview": "Gemini 3 Pro",
	"gemini-3-flash-preview": "Gemini 3 Flash",
	"gemini-2.0-flash": "Gemini 2.0 Flash",
	"gemini-2.0-flash-thinking": "Gemini 2.0 Flash Thinking",
	"gemini-1.5-pro": "Gemini 1.5 Pro",
	"grok-4": "Grok 4",
	"grok-3": "Grok 3",
	"grok-2": "Grok 2",
	"grok-beta": "Grok Beta",
	"deepseek-chat": "DeepSeek Chat",
	"deepseek-reasoner": "DeepSeek Reasoner",
	"kimi-k2.5": "Kimi K2.5",
	"kimi-k2-turbo-preview": "Kimi K2 Turbo",
	"kimi-latest": "Kimi Latest",
	"glm-5": "GLM-5",
	"glm-4.7-flashx": "GLM-4.7 FlashX",
	"glm-4.7": "GLM-4.7",
	"glm-4.7-flash": "GLM-4.7 Flash",
	"glm-4.6": "GLM-4.6",
	"glm-4.5-flash": "GLM-4.5 Flash",
	"MiniMax-M2": "MiniMax M2",
	"MiniMax-M2.1": "MiniMax M2.1",
	"MiniMax-M2.1-highspeed": "MiniMax M2.1 Highspeed",
	"MiniMax-M2.5": "MiniMax M2.5",
	"MiniMax-M2.5-highspeed": "MiniMax M2.5 Highspeed",
	"accomplish-free": "Accomplish"
};
var PROVIDER_PREFIXES = [
	"anthropic/",
	"openai/",
	"google/",
	"xai/",
	"deepseek/",
	"moonshot/",
	"ollama/",
	"openrouter/",
	"litellm/",
	"bedrock/",
	"zai/",
	"zai-coding-plan/",
	"minimax/",
	"lmstudio/",
	"huggingface-local/",
	"azure-foundry/",
	"vertex/",
	"nebius/",
	"together/",
	"fireworks/",
	"groq/",
	"venice/",
	"custom/",
	"accomplish-ai/"
];
/**
* Convert a model ID to a human-readable display name
*/
function getModelDisplayName(modelId) {
	if (!modelId) return "AI";
	let cleanId = modelId;
	for (const prefix of PROVIDER_PREFIXES) if (cleanId.startsWith(prefix)) {
		cleanId = cleanId.slice(prefix.length);
		break;
	}
	if (cleanId.includes("/")) cleanId = cleanId.split("/").pop() || cleanId;
	cleanId = cleanId.replace(/-\d{8}$/, "");
	if (MODEL_DISPLAY_NAMES[cleanId]) return MODEL_DISPLAY_NAMES[cleanId];
	return cleanId.split("-").map((part) => {
		if (/^\d/.test(part)) return part;
		return part.charAt(0).toUpperCase() + part.slice(1);
	}).join(" ").replace(/\s+/g, " ").trim() || "AI";
}
//#endregion
//#region ../../packages/agent-core/src/providers/fetch-models.ts
var log$10 = createConsoleLogger({ prefix: "FetchModels" });
var DEFAULT_TIMEOUT_MS$2 = 15e3;
/**
* Build request URL and headers based on endpoint config.
*/
function buildRequest(config, apiKey, urlOverride) {
	let url = urlOverride || config.url;
	const headers = {};
	if (config.authStyle === "bearer") headers["Authorization"] = `Bearer ${apiKey}`;
	else if (config.authStyle === "x-api-key") headers["x-api-key"] = apiKey;
	else if (config.authStyle === "query-param") {
		const separator = url.includes("?") ? "&" : "?";
		url = `${url}${separator}key=${encodeURIComponent(apiKey)}`;
	}
	if (config.extraHeaders) Object.assign(headers, config.extraHeaders);
	return {
		url,
		headers
	};
}
/**
* Parse models from an OpenAI-compatible response format.
* Shape: { data: Array<{ id: string; ... }> }
*/
function parseOpenAIResponse(data, prefix, filter) {
	const response = data;
	if (!response.data || !Array.isArray(response.data)) return [];
	let models = response.data;
	if (filter) models = models.filter((m) => filter.test(m.id));
	return models.map((m) => ({
		id: `${prefix}${m.id}`,
		name: getModelDisplayName(m.id)
	}));
}
/**
* Parse models from an Anthropic response format.
* Shape: { data: Array<{ id: string; display_name: string; type: string }> }
*/
function parseAnthropicResponse(data, prefix, filter) {
	const response = data;
	if (!response.data || !Array.isArray(response.data)) return [];
	let models = response.data;
	if (filter) models = models.filter((m) => filter.test(m.id));
	return models.map((m) => ({
		id: `${prefix}${m.id}`,
		name: m.display_name || getModelDisplayName(m.id)
	}));
}
/**
* Parse models from a Google Generative AI response format.
* Shape: { models: Array<{ name: string; displayName: string; supportedGenerationMethods: string[] }> }
*/
function parseGoogleResponse(data, prefix, filter) {
	const response = data;
	if (!response.models || !Array.isArray(response.models)) return [];
	const mapped = response.models.filter((m) => m.supportedGenerationMethods?.includes("generateContent")).map((m) => {
		const id = m.name.replace(/^models\//, "");
		return {
			id,
			displayName: m.displayName || id
		};
	});
	let filtered = mapped;
	if (filter) filtered = mapped.filter((m) => filter.test(m.id));
	return filtered.map((m) => ({
		id: `${prefix}${m.id}`,
		name: m.displayName || getModelDisplayName(m.id)
	}));
}
var PARSERS = {
	openai: parseOpenAIResponse,
	anthropic: parseAnthropicResponse,
	google: parseGoogleResponse
};
/**
* Generic config-driven function to fetch models from any provider API.
*
* The behavior is entirely determined by the ModelsEndpointConfig:
* - `authStyle` controls how the API key is sent
* - `responseFormat` selects the appropriate response parser
* - `modelIdPrefix` is prepended to each model ID
* - `modelFilter` optionally filters model IDs by regex
*/
async function fetchProviderModels(options) {
	const { endpointConfig, apiKey, urlOverride } = options;
	const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS$2;
	const prefix = endpointConfig.modelIdPrefix || "";
	if (!apiKey) return {
		success: false,
		error: "No API key provided"
	};
	try {
		const { url, headers } = buildRequest(endpointConfig, apiKey, urlOverride);
		const response = await fetchWithTimeout(url, {
			method: "GET",
			headers
		}, timeout);
		if (!response.ok) return {
			success: false,
			error: (await response.json().catch(() => ({})))?.error?.message || `API returned status ${response.status}`
		};
		const data = await response.json();
		const parser = PARSERS[endpointConfig.responseFormat];
		const models = parser(data, prefix, endpointConfig.modelFilter);
		log$10.info(`Fetched ${models.length} models from ${url}`);
		return {
			success: true,
			models
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to fetch models";
		log$10.warn(`Fetch failed: ${message}`);
		if (error instanceof Error && error.name === "AbortError") return {
			success: false,
			error: "Request timed out. Check your internet connection."
		};
		return {
			success: false,
			error: `Failed to fetch models: ${message}`
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/litellm.ts
var log$9 = createConsoleLogger({ prefix: "LiteLLM" });
var DEFAULT_TIMEOUT_MS$1 = 1e4;
/**
* Tests connection to a LiteLLM proxy server and retrieves available models.
* Makes an HTTP request to the OpenAI-compatible /v1/models endpoint.
*
* @param url - The LiteLLM proxy base URL
* @param apiKey - Optional API key for authentication
* @returns Connection result with available models on success
*/
async function testLiteLLMConnection(url, apiKey) {
	const sanitizedUrl = sanitizeString(url, "litellmUrl", 256);
	const sanitizedApiKey = apiKey ? sanitizeString(apiKey, "apiKey", 256) : void 0;
	try {
		validateHttpUrl(sanitizedUrl, "LiteLLM URL");
	} catch (e) {
		return {
			success: false,
			error: e instanceof Error ? e.message : "Invalid URL format"
		};
	}
	try {
		const headers = {};
		if (sanitizedApiKey) headers["Authorization"] = `Bearer ${sanitizedApiKey}`;
		const response = await fetchWithTimeout(`${sanitizedUrl}/v1/models`, {
			method: "GET",
			headers
		}, DEFAULT_TIMEOUT_MS$1);
		if (!response.ok) return {
			success: false,
			error: (await response.json().catch(() => ({})))?.error?.message || `API returned status ${response.status}`
		};
		const models = ((await response.json()).data || []).map((m) => {
			const provider = m.id.split("/")[0] || m.owned_by || "unknown";
			return {
				id: m.id,
				name: m.id,
				provider,
				contextLength: 0
			};
		});
		log$9.info(`[LiteLLM] Connection successful, found ${models.length} models`);
		return {
			success: true,
			models
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Connection failed";
		log$9.warn(`[LiteLLM] Connection failed: ${message}`);
		if (error instanceof Error && error.name === "AbortError") return {
			success: false,
			error: "Connection timed out. Make sure LiteLLM proxy is running."
		};
		return {
			success: false,
			error: `Cannot connect to LiteLLM: ${message}`
		};
	}
}
/**
* Fetches available models from a configured LiteLLM proxy.
* Formats model names for display with provider prefixes.
*
* @param options - Configuration and optional API key
* @returns Result with formatted models on success
*/
async function fetchLiteLLMModels(options) {
	const { config, apiKey } = options;
	if (!config || !config.baseUrl) return {
		success: false,
		error: "No LiteLLM proxy configured"
	};
	try {
		const headers = {};
		if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
		const response = await fetchWithTimeout(`${config.baseUrl}/v1/models`, {
			method: "GET",
			headers
		}, DEFAULT_TIMEOUT_MS$1);
		if (!response.ok) return {
			success: false,
			error: (await response.json().catch(() => ({})))?.error?.message || `API returned status ${response.status}`
		};
		const models = ((await response.json()).data || []).map((m) => {
			const parts = m.id.split("/");
			const provider = parts.length > 1 ? parts[0] : (m.owned_by !== "openai" ? m.owned_by : "unknown") || "unknown";
			const modelPart = parts.length > 1 ? parts.slice(1).join("/") : m.id;
			const providerDisplay = provider.charAt(0).toUpperCase() + provider.slice(1);
			const modelDisplay = modelPart.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
			const displayName = parts.length > 1 ? `${providerDisplay}: ${modelDisplay}` : modelDisplay;
			return {
				id: m.id,
				name: displayName,
				provider,
				contextLength: 0
			};
		});
		log$9.info(`[LiteLLM] Fetched ${models.length} models`);
		return {
			success: true,
			models
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to fetch models";
		log$9.warn(`[LiteLLM] Fetch failed: ${message}`);
		if (error instanceof Error && error.name === "AbortError") return {
			success: false,
			error: "Request timed out. Check your LiteLLM proxy."
		};
		return {
			success: false,
			error: `Failed to fetch models: ${message}`
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/lmstudio-models.ts
/**
* LM Studio model discovery helpers.
* Fetches available models from the LM Studio server and tests tool support.
*/
var log$8 = createConsoleLogger({ prefix: "LMStudio" });
/** Default timeout for LM Studio API requests in milliseconds */
var LMSTUDIO_REQUEST_TIMEOUT_MS = 15e3;
/**
* Converts a model ID to a human-readable display name.
* Replaces hyphens with spaces and capitalizes words.
*/
function formatModelDisplayName(modelId) {
	return modelId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
/**
* Fetch raw model list from LM Studio /v1/models endpoint and enrich with tool support.
* Shared by both testLMStudioConnection and fetchLMStudioModels.
*/
async function fetchAndEnrichModels(baseUrl, timeoutMs) {
	const response = await fetchWithTimeout(`${baseUrl}/v1/models`, { method: "GET" }, timeoutMs);
	if (!response.ok) return {
		success: false,
		error: (await response.json().catch(() => ({})))?.error?.message || `API returned status ${response.status}`
	};
	const rawModels = (await response.json()).data || [];
	const models = [];
	for (const m of rawModels) {
		const displayName = formatModelDisplayName(m.id);
		const toolSupport = await testLMStudioModelToolSupport(baseUrl, m.id);
		models.push({
			id: m.id,
			name: displayName,
			toolSupport
		});
		log$8.info(`[LM Studio] Model ${m.id}: toolSupport=${toolSupport}`);
	}
	return {
		success: true,
		models
	};
}
/**
* Fetches available models from an LM Studio server.
*
* Intended for refreshing the model list when LM Studio is already configured.
*
* @param options - Options including base URL and optional timeout
* @returns Result with models if successful
*/
async function fetchLMStudioModels(options) {
	const { baseUrl, timeoutMs = LMSTUDIO_REQUEST_TIMEOUT_MS } = options;
	try {
		return await fetchAndEnrichModels(baseUrl, timeoutMs);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to fetch models";
		log$8.warn(`[LM Studio] Fetch failed: ${message}`);
		if (error instanceof Error && error.name === "AbortError") return {
			success: false,
			error: "Request timed out. Check your LM Studio server."
		};
		return {
			success: false,
			error: `Failed to fetch models: ${message}`
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/lmstudio.ts
var log$7 = createConsoleLogger({ prefix: "LMStudio" });
/**
* Tests connection to an LM Studio server and fetches available models.
*
* Makes a GET request to /v1/models to verify connectivity and retrieve
* the list of loaded models. For each model, tests tool support capability.
*
* @param options - Connection test options
* @returns Connection result with models if successful
*/
async function testLMStudioConnection(options) {
	const { url, timeoutMs = LMSTUDIO_REQUEST_TIMEOUT_MS } = options;
	const sanitizedUrl = sanitizeString(url, "lmstudioUrl", 256);
	try {
		validateHttpUrl(sanitizedUrl, "LM Studio URL");
	} catch (e) {
		return {
			success: false,
			error: e instanceof Error ? e.message : "Invalid URL format"
		};
	}
	try {
		const result = await fetchAndEnrichModels(sanitizedUrl, timeoutMs);
		if (!result.success) return result;
		if (!result.models || result.models.length === 0) return {
			success: false,
			error: "No models loaded in LM Studio. Please load a model first."
		};
		log$7.info(`[LM Studio] Connection successful, found ${result.models.length} models`);
		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Connection failed";
		log$7.warn(`[LM Studio] Connection failed: ${message}`);
		if (error instanceof Error && error.name === "AbortError") return {
			success: false,
			error: "Connection timed out. Make sure LM Studio is running."
		};
		return {
			success: false,
			error: `Cannot connect to LM Studio: ${message}`
		};
	}
}
/**
* Validates LM Studio configuration object structure.
*
* @param config - Configuration to validate
* @throws Error if configuration is invalid
*/
function validateLMStudioConfig(config) {
	if (typeof config.baseUrl !== "string" || typeof config.enabled !== "boolean") throw new Error("Invalid LM Studio configuration");
	validateHttpUrl(config.baseUrl, "LM Studio base URL");
	if (config.lastValidated !== void 0 && typeof config.lastValidated !== "number") throw new Error("Invalid LM Studio configuration");
	if (config.models !== void 0) {
		if (!Array.isArray(config.models)) throw new Error("Invalid LM Studio configuration: models must be an array");
		for (const model of config.models) if (typeof model.id !== "string" || typeof model.name !== "string") throw new Error("Invalid LM Studio configuration: invalid model format");
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/custom.ts
var log$6 = createConsoleLogger({ prefix: "CustomProvider" });
var DEFAULT_TIMEOUT_MS = 1e4;
/**
* Tests connection to a custom OpenAI-compatible endpoint.
*
* Attempts to reach the /models endpoint to verify connectivity.
* The connection is considered successful if we can reach the server,
* even if /models returns an error (many endpoints don't implement it).
*
* @param baseUrl - The base URL of the OpenAI-compatible endpoint (e.g., https://api.example.com/v1)
* @param apiKey - Optional API key for authentication
* @returns Connection result indicating success or failure
*/
async function testCustomConnection(baseUrl, apiKey) {
	const sanitizedUrl = sanitizeString(baseUrl, "customUrl", 256);
	const sanitizedApiKey = apiKey ? sanitizeString(apiKey, "apiKey", 256) : void 0;
	try {
		validateHttpUrl(sanitizedUrl, "Custom endpoint URL");
	} catch (e) {
		return {
			success: false,
			error: e instanceof Error ? e.message : "Invalid URL format"
		};
	}
	const normalizedUrl = sanitizedUrl.replace(/\/+$/, "");
	try {
		const headers = { "Content-Type": "application/json" };
		if (sanitizedApiKey) headers["Authorization"] = `Bearer ${sanitizedApiKey}`;
		const pathname = new URL(normalizedUrl).pathname;
		let modelsUrl;
		if (pathname === "/" || pathname === "" || pathname.endsWith("/v1")) modelsUrl = normalizedUrl.endsWith("/v1") ? `${normalizedUrl}/models` : `${normalizedUrl}/v1/models`;
		else {
			log$6.warn("[Custom] URL path appears to be a specific endpoint rather than a base URL. For best results, provide a base URL ending in /v1 (e.g., https://api.example.com/v1).");
			modelsUrl = normalizedUrl;
		}
		const response = await fetchWithTimeout(modelsUrl, {
			method: "GET",
			headers
		}, DEFAULT_TIMEOUT_MS);
		if (response.ok) {
			log$6.info("[Custom] Connection successful, /models endpoint responded");
			return { success: true };
		}
		const status = response.status;
		if (status === 401 || status === 403) {
			if (!sanitizedApiKey) return {
				success: false,
				error: "Authentication required. Please provide an API key."
			};
			log$6.info("[Custom] Connection successful (server reachable, /models may not be supported)");
			return { success: true };
		}
		if (status === 404) {
			log$6.info("[Custom] Connection successful (server reachable, /models not implemented)");
			return { success: true };
		}
		const errorMessage = (await response.json().catch(() => ({})))?.error?.message || `Server returned status ${status}`;
		log$6.info(`[Custom] ${errorMessage}, but connection is reachable`);
		return { success: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Connection failed";
		log$6.warn(`[Custom] Connection failed: ${message}`);
		if (error instanceof Error && error.name === "AbortError") return {
			success: false,
			error: "Connection timed out. Make sure the endpoint is accessible."
		};
		return {
			success: false,
			error: `Cannot connect to endpoint: ${message}`
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/copilot-auth.ts
/**
* GitHub Copilot device OAuth flow helpers.
*
* Implements the device authorization flow:
*   1. Request a device code from GitHub
*   2. Poll GitHub's token endpoint until authorized
*/
var GITHUB_COPILOT_OAUTH_CLIENT_ID = "Iv1.b507a08c87ecfe98";
var GITHUB_COPILOT_DEVICE_CODE_URL = "https://github.com/login/device/code";
var GITHUB_COPILOT_TOKEN_URL = "https://github.com/login/oauth/access_token";
/** Scope required for Copilot access */
var GITHUB_COPILOT_SCOPE = "read:user";
/**
* Step 1 of device flow: request a device code from GitHub.
* Returns device_code, user_code, verification_uri, interval, expires_in.
*/
async function requestCopilotDeviceCode() {
	const params = new URLSearchParams({
		client_id: GITHUB_COPILOT_OAUTH_CLIENT_ID,
		scope: GITHUB_COPILOT_SCOPE
	});
	const res = await fetch(GITHUB_COPILOT_DEVICE_CODE_URL, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded"
		},
		body: params.toString()
	});
	if (!res.ok) throw new Error(`GitHub device code request failed: ${res.status} ${res.statusText}`);
	const data = await res.json();
	if (!data.device_code || !data.user_code) throw new Error("Invalid device code response from GitHub");
	return data;
}
/**
* Step 2: Poll GitHub's token endpoint until the user completes authorization.
* Returns the access token when authorized.
* Throws if the device code expires or an unrecoverable error occurs.
*/
async function pollCopilotDeviceToken(params) {
	const { deviceCode, interval, expiresIn, onPoll } = params;
	const deadline = Date.now() + expiresIn * 1e3;
	const pollIntervalMs = Math.max(interval, 5) * 1e3;
	while (Date.now() < deadline) {
		if (onPoll) onPoll();
		await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
		const body = new URLSearchParams({
			client_id: GITHUB_COPILOT_OAUTH_CLIENT_ID,
			device_code: deviceCode,
			grant_type: "urn:ietf:params:oauth:grant-type:device_code"
		});
		const data = await (await fetch(GITHUB_COPILOT_TOKEN_URL, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/x-www-form-urlencoded"
			},
			body: body.toString()
		})).json();
		if (data.access_token) return data;
		if (data.error === "authorization_pending" || data.error === "slow_down") continue;
		if (data.error === "expired_token") throw new Error("Device code expired. Please try connecting again.");
		if (data.error === "access_denied") throw new Error("Access was denied. Please authorize the GitHub Copilot connection.");
		if (data.error) throw new Error(`GitHub OAuth error: ${data.error} — ${data.error_description ?? ""}`);
	}
	throw new Error("Timed out waiting for GitHub authorization. Please try again.");
}
//#endregion
//#region ../../packages/agent-core/src/providers/copilot.ts
/**
* GitHub Copilot provider support.
*
* GitHub Copilot uses a device OAuth flow (similar to GitHub CLI's `gh auth login`).
* Credentials are stored in OpenCode-compatible auth.json format under the key
* "github-copilot", which is the provider id that OpenCode's @opencode/github-copilot
* package expects.
*
* Auth flow:
*   1. Request a device code from GitHub OAuth (client_id: Iv1.b507a08c87ecfe98)
*   2. Show the user-code and ask the user to visit verification_uri in their browser
*   3. Poll GitHub's token endpoint until the user completes authorization
*   4. Exchange the device token for a Copilot-specific token via the Copilot API
*   5. Write access_token + refresh_token to auth.json as type "copilot-oauth"
*/
var log$5 = createConsoleLogger({ prefix: "CopilotProvider" });
function getOpenCodeAuthJsonPath() {
	const dataHome = process.env.XDG_DATA_HOME || path$1.join(os.homedir(), ".local", "share");
	return path$1.join(dataHome, "opencode", "auth.json");
}
function readAuthJson() {
	const authPath = getOpenCodeAuthJsonPath();
	try {
		if (!fs$1.existsSync(authPath)) return {};
		const raw = fs$1.readFileSync(authPath, "utf8");
		return JSON.parse(raw);
	} catch {
		return {};
	}
}
function writeAuthJson(data) {
	const authPath = getOpenCodeAuthJsonPath();
	fs$1.mkdirSync(path$1.dirname(authPath), { recursive: true });
	fs$1.writeFileSync(authPath, JSON.stringify(data, null, 2), "utf8");
	log$5.info("[CopilotProvider] auth.json updated");
}
/**
* Get current Copilot OAuth connection status by reading auth.json.
*/
function getCopilotOAuthStatus() {
	const entry = readAuthJson()["github-copilot"];
	if (!entry || typeof entry !== "object") return { connected: false };
	const e = entry;
	if (e.type !== "copilot-oauth") return { connected: false };
	return {
		connected: typeof e.access === "string" && e.access.trim().length > 0 || typeof e.refresh === "string" && e.refresh.trim().length > 0,
		username: e.username,
		expiresAt: e.expires
	};
}
/**
* Write Copilot OAuth tokens to auth.json in OpenCode-compatible format.
*/
function setCopilotOAuthTokens(params) {
	const auth = readAuthJson();
	auth["github-copilot"] = {
		type: "copilot-oauth",
		access: params.accessToken,
		...params.refreshToken ? { refresh: params.refreshToken } : {},
		...params.expiresAt ? { expires: params.expiresAt } : {},
		...params.username ? { username: params.username } : {}
	};
	writeAuthJson(auth);
}
/**
* Remove Copilot credentials from auth.json.
*/
function clearCopilotOAuth() {
	const auth = readAuthJson();
	delete auth["github-copilot"];
	writeAuthJson(auth);
	log$5.info("[CopilotProvider] Copilot credentials cleared");
}
//#endregion
//#region ../../packages/agent-core/src/opencode/auth-slack-mcp.ts
/**
* Slack MCP OAuth helpers — extracted from auth.ts to keep file sizes under 200 lines.
*/
var OPENCODE_SLACK_MCP_SERVER_URL = "https://mcp.slack.com/mcp";
var OPENCODE_SLACK_MCP_CLIENT_ID = "1601185624273.8899143856786";
var OPENCODE_SLACK_MCP_CALLBACK_HOST = "localhost";
var OPENCODE_SLACK_MCP_CALLBACK_PORT = 3118;
var OPENCODE_SLACK_MCP_CALLBACK_PATH = "/callback";
function getSlackMcpCallbackUrl() {
	return `http://${OPENCODE_SLACK_MCP_CALLBACK_HOST}:${OPENCODE_SLACK_MCP_CALLBACK_PORT}${OPENCODE_SLACK_MCP_CALLBACK_PATH}`;
}
function getOpenCodeMcpAuthJsonPath() {
	return path$1.join(getOpenCodeDataHome(), "opencode", "mcp-auth.json");
}
function readOpenCodeMcpAuthJson() {
	try {
		const filePath = getOpenCodeMcpAuthJsonPath();
		if (!fs$1.existsSync(filePath)) return null;
		const raw = fs$1.readFileSync(filePath, "utf8");
		return JSON.parse(raw);
	} catch {
		return null;
	}
}
function writeOpenCodeMcpAuthJson(data) {
	const filePath = getOpenCodeMcpAuthJsonPath();
	fs$1.mkdirSync(path$1.dirname(filePath), { recursive: true });
	fs$1.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
function getSlackMcpOauthStatus() {
	const authJson = readOpenCodeMcpAuthJson();
	if (!authJson) return {
		connected: false,
		pendingAuthorization: false
	};
	const entry = authJson.slack;
	if (!entry || typeof entry !== "object") return {
		connected: false,
		pendingAuthorization: false
	};
	const oauth = entry;
	const connected = [
		oauth.tokens?.accessToken,
		oauth.tokens?.refreshToken,
		oauth.refreshToken,
		oauth.accessToken,
		oauth.refresh,
		oauth.access
	].some((value) => typeof value === "string" && value.trim().length > 0);
	return {
		connected,
		pendingAuthorization: !connected && typeof oauth.oauthState === "string" && oauth.oauthState.trim().length > 0 && typeof oauth.codeVerifier === "string" && oauth.codeVerifier.trim().length > 0
	};
}
function setSlackMcpPendingAuth(params) {
	const authJson = readOpenCodeMcpAuthJson() ?? {};
	authJson.slack = {
		codeVerifier: params.codeVerifier,
		oauthState: params.oauthState,
		serverUrl: OPENCODE_SLACK_MCP_SERVER_URL
	};
	writeOpenCodeMcpAuthJson(authJson);
}
function setSlackMcpTokens(tokens) {
	const authJson = readOpenCodeMcpAuthJson() ?? {};
	authJson.slack = {
		tokens: {
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			expiresAt: tokens.expiresAt ? Math.floor(tokens.expiresAt / 1e3) : void 0,
			scope: tokens.scope
		},
		serverUrl: OPENCODE_SLACK_MCP_SERVER_URL
	};
	writeOpenCodeMcpAuthJson(authJson);
}
function clearSlackMcpAuth() {
	const authJson = readOpenCodeMcpAuthJson();
	if (!authJson) return;
	delete authJson.slack;
	writeOpenCodeMcpAuthJson(authJson);
}
createConsoleLogger({ prefix: "OpenCodeAuth" });
function getOpenCodeDataHome() {
	return process.env.XDG_DATA_HOME || path$1.join(os.homedir(), ".local", "share");
}
//#endregion
//#region ../../packages/agent-core/src/opencode/cli-path-utils.ts
/**
* CLI path resolution utilities
*
* Platform detection and path helpers for locating the OpenCode CLI binary.
* Extracted from cli-resolver.ts to keep file sizes under 200 lines.
*/
var log$3 = createConsoleLogger({ prefix: "CLIResolver" });
var WINDOWS_OPENCODE_X64_PACKAGE = "opencode-windows-x64";
var WINDOWS_OPENCODE_X64_BASELINE_PACKAGE = "opencode-windows-x64-baseline";
var LINUX_OPENCODE_X64_PACKAGE = "opencode-linux-x64";
var LINUX_OPENCODE_X64_BASELINE_PACKAGE = "opencode-linux-x64-baseline";
var LINUX_OPENCODE_X64_MUSL_PACKAGE = "opencode-linux-x64-musl";
var LINUX_OPENCODE_X64_BASELINE_MUSL_PACKAGE = "opencode-linux-x64-baseline-musl";
var LINUX_OPENCODE_ARM64_PACKAGE = "opencode-linux-arm64";
var LINUX_OPENCODE_ARM64_MUSL_PACKAGE = "opencode-linux-arm64-musl";
var OPENCODE_LAUNCHER_PACKAGE = "opencode-ai";
var cachedWindowsPackageNames = null;
function detectWindowsAvx2Support() {
	const checkCommand = "(Add-Type -MemberDefinition \"[DllImport(\"\"kernel32.dll\"\")] public static extern bool IsProcessorFeaturePresent(int ProcessorFeature);\" -Name Kernel32 -Namespace Win32 -PassThru)::IsProcessorFeaturePresent(40)";
	for (const shell of [
		"powershell.exe",
		"pwsh.exe",
		"pwsh",
		"powershell"
	]) try {
		const result = spawnSync(shell, [
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			checkCommand
		], {
			encoding: "utf-8",
			timeout: 3e3,
			stdio: [
				"ignore",
				"pipe",
				"ignore"
			],
			windowsHide: true
		});
		if (result.status !== 0) continue;
		const output = (result.stdout ?? "").trim().toLowerCase();
		if (output === "true" || output === "1") return true;
		if (output === "false" || output === "0") return false;
	} catch {
		continue;
	}
	return false;
}
function getWindowsPackageNames() {
	if (cachedWindowsPackageNames) return cachedWindowsPackageNames;
	cachedWindowsPackageNames = detectWindowsAvx2Support() ? [WINDOWS_OPENCODE_X64_PACKAGE, WINDOWS_OPENCODE_X64_BASELINE_PACKAGE] : [WINDOWS_OPENCODE_X64_BASELINE_PACKAGE, WINDOWS_OPENCODE_X64_PACKAGE];
	return cachedWindowsPackageNames;
}
function getLinuxPackageNames() {
	if (process.arch === "arm64") return [LINUX_OPENCODE_ARM64_PACKAGE, LINUX_OPENCODE_ARM64_MUSL_PACKAGE];
	return [
		LINUX_OPENCODE_X64_PACKAGE,
		LINUX_OPENCODE_X64_BASELINE_PACKAGE,
		LINUX_OPENCODE_X64_MUSL_PACKAGE,
		LINUX_OPENCODE_X64_BASELINE_MUSL_PACKAGE
	];
}
function getOpenCodePlatformInfo() {
	if (process.platform === "win32") return {
		packageNames: getWindowsPackageNames(),
		binaryName: "opencode.exe"
	};
	if (process.platform === "linux") return {
		packageNames: getLinuxPackageNames(),
		binaryName: "opencode"
	};
	return {
		packageNames: ["opencode-ai"],
		binaryName: "opencode"
	};
}
function getCandidateAppRoots(appPath) {
	const roots = [];
	if (process.env.APP_ROOT) roots.push(path.resolve(process.env.APP_ROOT));
	if (appPath) {
		const resolvedAppPath = path.resolve(appPath);
		roots.push(resolvedAppPath);
		roots.push(path.resolve(resolvedAppPath, ".."));
		roots.push(path.resolve(resolvedAppPath, "..", ".."));
	}
	return [...new Set(roots)];
}
function resolveWindowsCliFromLauncher(nodeModulesRoot, packageNames) {
	const launcherPackagePath = path.join(nodeModulesRoot, OPENCODE_LAUNCHER_PACKAGE);
	if (!fs.existsSync(launcherPackagePath)) return null;
	const candidateModuleRoots = new Set([nodeModulesRoot]);
	try {
		const realLauncherPackagePath = fs.realpathSync(launcherPackagePath);
		candidateModuleRoots.add(path.dirname(realLauncherPackagePath));
	} catch {}
	for (const moduleRoot of candidateModuleRoots) for (const packageName of packageNames) {
		const cliPath = path.join(moduleRoot, packageName, "bin", "opencode.exe");
		if (fs.existsSync(cliPath)) {
			log$3.info(`[CLI Resolver] Using OpenCode CLI executable via launcher package: ${cliPath}`);
			return {
				cliPath,
				cliDir: path.dirname(cliPath),
				source: "local"
			};
		}
	}
	return null;
}
//#endregion
//#region ../../packages/agent-core/src/opencode/cli-resolver.ts
var log$2 = createConsoleLogger({ prefix: "CLIResolver" });
function resolveBundledCliPath(resourcesPath) {
	const { packageNames, binaryName } = getOpenCodePlatformInfo();
	const unpackedNodeModulesRoot = path.join(resourcesPath, "app.asar.unpacked", "node_modules");
	for (const packageName of packageNames) {
		const cliPath = path.join(unpackedNodeModulesRoot, packageName, "bin", binaryName);
		if (fs.existsSync(cliPath)) return {
			cliPath,
			cliDir: path.dirname(cliPath),
			source: "bundled"
		};
	}
	if (process.platform === "win32") {
		const resolvedFromLauncher = resolveWindowsCliFromLauncher(unpackedNodeModulesRoot, packageNames);
		if (resolvedFromLauncher) return resolvedFromLauncher;
	}
	return null;
}
function resolveLocalCliPath(appPath) {
	const appRoots = getCandidateAppRoots(appPath);
	const { packageNames, binaryName } = getOpenCodePlatformInfo();
	for (const root of appRoots) {
		if (process.platform === "win32") {
			for (const packageName of packageNames) {
				const cliPath = path.join(root, "node_modules", packageName, "bin", binaryName);
				if (fs.existsSync(cliPath)) {
					log$2.info(`[CLI Resolver] Using local OpenCode CLI executable: ${cliPath}`);
					return {
						cliPath,
						cliDir: path.dirname(cliPath),
						source: "local"
					};
				}
			}
			const resolvedFromLauncher = resolveWindowsCliFromLauncher(path.join(root, "node_modules"), packageNames);
			if (resolvedFromLauncher) return resolvedFromLauncher;
			continue;
		}
		const cliPath = path.join(root, "node_modules", ".bin", binaryName);
		if (fs.existsSync(cliPath)) {
			log$2.info(`[CLI Resolver] Using local OpenCode CLI executable: ${cliPath}`);
			return {
				cliPath,
				cliDir: path.dirname(cliPath),
				source: "local"
			};
		}
	}
	return null;
}
function resolveCliPath(config) {
	const { isPackaged, resourcesPath, appPath } = config;
	if (isPackaged && resourcesPath) return resolveBundledCliPath(resourcesPath);
	if (isPackaged) return null;
	return resolveLocalCliPath(appPath);
}
function isCliAvailable(config) {
	return resolveCliPath(config) !== null;
}
//#endregion
//#region ../../packages/agent-core/src/utils/redact.ts
var REDACTION_PATTERNS = [
	/sk-[a-zA-Z0-9]{20,}/g,
	/xai-[a-zA-Z0-9]{20,}/g,
	/AIza[a-zA-Z0-9_-]{35}/g,
	/AKIA[A-Z0-9]{16}/g,
	/(?:api[_-]?key|apikey|secret|token|password|credential)['":\s]*[=:]\s*['"]?([a-zA-Z0-9_-]{16,})['"]?/gi,
	/Bearer\s+[a-zA-Z0-9._-]+/gi,
	/(?:secret|password|key)['":\s]*[=:]\s*['"]?([A-Za-z0-9+/=]{32,})['"]?/gi
];
function redact(text) {
	let result = text;
	for (const pattern of REDACTION_PATTERNS) result = result.replace(pattern, (match) => {
		return `${match.slice(0, 4)}[REDACTED]`;
	});
	return result;
}
createConsoleLogger({ prefix: "BundledNode" });
function resolveDevNodeDir(config) {
	if (!config.appPath) return null;
	const platformArch = `${config.platform}-${config.arch}`;
	const appPath = path$1.resolve(config.appPath);
	const candidates = [
		process.env.APP_ROOT ? path$1.join(process.env.APP_ROOT, "resources", "nodejs", platformArch) : null,
		path$1.join(appPath, "resources", "nodejs", platformArch),
		path$1.join(appPath, "..", "resources", "nodejs", platformArch),
		path$1.join(appPath, "..", "..", "resources", "nodejs", platformArch)
	].filter((candidate) => Boolean(candidate));
	const nodeBinary = config.platform === "win32" ? "node.exe" : path$1.join("bin", "node");
	for (const candidate of candidates) {
		if (!fs$1.existsSync(candidate)) continue;
		const directNodePath = path$1.join(candidate, nodeBinary);
		if (fs$1.existsSync(directNodePath)) return candidate;
		try {
			const children = fs$1.readdirSync(candidate, { withFileTypes: true });
			for (const child of children) {
				if (!child.isDirectory()) continue;
				const nestedNodeDir = path$1.join(candidate, child.name);
				const nestedNodePath = path$1.join(nestedNodeDir, nodeBinary);
				if (fs$1.existsSync(nestedNodePath)) return nestedNodeDir;
			}
		} catch {}
	}
	return null;
}
function getBundledNodePaths(config) {
	const isWindows = config.platform === "win32";
	const ext = isWindows ? ".exe" : "";
	const scriptExt = isWindows ? ".cmd" : "";
	let nodeDir = null;
	if (config.isPackaged) {
		if (!config.resourcesPath) return null;
		const platformArch = `${config.platform}-${config.arch}`;
		const nodejsBase = path$1.join(config.resourcesPath, "nodejs", platformArch);
		const nodeBinary = isWindows ? "node.exe" : path$1.join("bin", "node");
		if (fs$1.existsSync(path$1.join(nodejsBase, nodeBinary))) nodeDir = nodejsBase;
		else try {
			const children = fs$1.readdirSync(nodejsBase, { withFileTypes: true });
			for (const child of children) {
				if (!child.isDirectory()) continue;
				const nested = path$1.join(nodejsBase, child.name);
				if (fs$1.existsSync(path$1.join(nested, nodeBinary))) {
					nodeDir = nested;
					break;
				}
			}
		} catch {}
	} else nodeDir = resolveDevNodeDir(config);
	if (!nodeDir) return null;
	const binDir = isWindows ? nodeDir : path$1.join(nodeDir, "bin");
	return {
		nodePath: path$1.join(binDir, `node${ext}`),
		npmPath: path$1.join(binDir, `npm${scriptExt}`),
		npxPath: path$1.join(binDir, `npx${scriptExt}`),
		binDir,
		nodeDir
	};
}
function getNodePath(config) {
	const bundled = getBundledNodePaths(config);
	if (bundled && fs$1.existsSync(bundled.nodePath)) return bundled.nodePath;
	throw new Error(`[Bundled Node] Bundled Node.js not found at ${bundled?.nodePath ?? "(unknown path)"}. Run "pnpm -F @accomplish/desktop download:nodejs" and rebuild required artifacts.`);
}
createConsoleLogger({ prefix: "Browser" });
/**
* Finds and terminates the process(es) listening on a TCP port.
* Used as a fallback when the HTTP /shutdown endpoint is unavailable.
*/
function killProcessOnPort(port) {
	try {
		if (process.platform === "win32") {
			const out = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
			for (const line of out.split("\n")) if (line.includes(`:${port} `) && line.includes("LISTENING")) {
				const pid = line.trim().split(/\s+/).pop();
				if (pid && /^\d+$/.test(pid)) execFileSync("taskkill", [
					"/PID",
					pid,
					"/F"
				], { stdio: "ignore" });
			}
		} else {
			const pids = execFileSync("lsof", [
				"-t",
				"-i",
				`tcp:${port}`,
				"-sTCP:LISTEN"
			], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
			for (const pid of pids) process.kill(parseInt(pid, 10), "SIGTERM");
		}
	} catch {}
}
/**
* Asks the running dev-browser server to shut down gracefully via its HTTP API,
* then falls back to killing the process by port if the endpoint is unavailable
* (e.g. server.mjs built before /shutdown was added).
*/
async function shutdownDevBrowserServer(config) {
	const { devBrowserPort, devBrowserCdpPort } = config;
	let responded = false;
	try {
		responded = (await fetch(`http://127.0.0.1:${devBrowserPort}/shutdown`, {
			method: "POST",
			signal: AbortSignal.timeout(3e3)
		})).ok;
	} catch {}
	if (responded) await new Promise((resolve) => setTimeout(resolve, 2e3));
	killProcessOnPort(devBrowserPort);
	if (devBrowserCdpPort) killProcessOnPort(devBrowserCdpPort);
}
//#endregion
//#region ../../packages/agent-core/src/common/constants.ts
var DEV_BROWSER_PORT = 9224;
var DEV_BROWSER_CDP_PORT = 9225;
var LOG_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
var LOG_BUFFER_FLUSH_INTERVAL_MS = 5e3;
//#endregion
//#region ../../packages/agent-core/src/common/utils/log-source-detector.ts
/** Patterns used to detect log source from message prefixes */
var LOG_SOURCE_PATTERNS = {
	opencode: [/^\[TaskManager\]/, /^\[OpenCode/],
	browser: [/^\[DevBrowser/, /^\[Playwright/],
	mcp: [/^\[MCP\]/, /MCP server/],
	ipc: [/^\[IPC\]/],
	main: [],
	env: [],
	daemon: []
};
/**
* Detects the log source from a message based on common prefixes.
* Falls back to 'main' if no pattern matches.
*/
function detectLogSource(message) {
	for (const [source, patterns] of Object.entries(LOG_SOURCE_PATTERNS)) if (patterns.some((p) => p.test(message))) return source;
	return "main";
}
//#endregion
//#region ../../packages/agent-core/src/common/utils/id.ts
function createTaskId() {
	return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
function createMessageId() {
	return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
//#endregion
export { VertexClient as $, pollCopilotDeviceToken as A, PROVIDER_PREFIXES as B, getSlackMcpOauthStatus as C, getCopilotOAuthStatus as D, clearCopilotOAuth as E, fetchLMStudioModels as F, testNimConnection as G, testOllamaConnection as H, fetchLiteLLMModels as I, validateAzureFoundry as J, fetchOpenRouterModels as K, testLiteLLMConnection as L, testCustomConnection as M, testLMStudioConnection as N, setCopilotOAuthTokens as O, validateLMStudioConfig as P, validateHttpUrl as Q, fetchProviderModels as R, getSlackMcpCallbackUrl as S, setSlackMcpTokens as T, testOllamaModelToolSupport as U, getModelDisplayName as V, fetchNimModels as W, sanitizeString as X, PROMPT_DEFAULT_MAX_LENGTH as Y, getAzureEntraToken as Z, OPENCODE_SLACK_MCP_CALLBACK_PORT as _, discoverOAuthProtectedResourceMetadata as _t, DEV_BROWSER_CDP_PORT as a, safeParseJson as at, clearSlackMcpAuth as b, LOG_MAX_FILE_SIZE_BYTES as c, ALLOWED_API_KEY_PROVIDERS as ct, getNodePath as d, ZAI_ENDPOINTS as dt, fetchVertexModels as et, redact as f, buildAuthorizationUrl as ft, OPENCODE_SLACK_MCP_CALLBACK_PATH as g, discoverOAuthMetadata as gt, OPENCODE_SLACK_MCP_CALLBACK_HOST as h, exchangeCodeForTokens as ht, detectLogSource as i, createConsoleLogger as it, requestCopilotDeviceCode as j, GITHUB_COPILOT_OAUTH_CLIENT_ID as k, shutdownDevBrowserServer as l, DEFAULT_PROVIDERS as lt, resolveCliPath as m, registerOAuthClient as mt, createTaskId as n, validateBedrockCredentials as nt, DEV_BROWSER_PORT as o, validateApiKey as ot, isCliAvailable as p, generatePkceChallenge as pt, testAzureFoundryConnection as q, LOG_SOURCE_PATTERNS as r, fetchBedrockModels as rt, LOG_BUFFER_FLUSH_INTERVAL_MS as s, fetchWithTimeout as st, createMessageId as t, validateVertexCredentials as tt, getBundledNodePaths as u, STANDARD_VALIDATION_PROVIDERS as ut, OPENCODE_SLACK_MCP_CLIENT_ID as v, JSON_RPC_ERRORS as vt, setSlackMcpPendingAuth as w, getOpenCodeMcpAuthJsonPath as x, OPENCODE_SLACK_MCP_SERVER_URL as y, MODEL_DISPLAY_NAMES as z };

//# sourceMappingURL=id-BkuVT4wi.js.map