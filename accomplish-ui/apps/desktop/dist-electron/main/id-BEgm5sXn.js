import * as e from "path";
import t from "path";
import * as n from "fs";
import r from "fs";
import i from "crypto";
import { ProxyAgent as a } from "undici";
import { getProxyForUrl as o } from "proxy-from-env";
import { BedrockClient as s, ListFoundationModelsCommand as c } from "@aws-sdk/client-bedrock";
import { execFile as l, execFileSync as u, spawnSync as ee } from "child_process";
import * as te from "os";
//#region ../../packages/agent-core/src/common/types/daemon.ts
var ne = {
	PARSE_ERROR: -32700,
	INVALID_REQUEST: -32600,
	METHOD_NOT_FOUND: -32601,
	INVALID_PARAMS: -32602,
	INTERNAL_ERROR: -32603,
	TASK_NOT_FOUND: -32e3,
	NO_PROVIDER: -32001,
	NOT_READY: -32002
}, d = 3e4;
function f(e, t = {}) {
	let n = new AbortController(), r = setTimeout(() => n.abort(), d);
	return fetch(e, {
		...t,
		signal: n.signal
	}).catch((t) => {
		throw t instanceof Error && t.name === "AbortError" ? Error(`Request to ${e} timed out after ${d}ms`) : t;
	}).finally(() => clearTimeout(r));
}
async function re(e) {
	let t = new URL("/.well-known/oauth-authorization-server", e), n = await f(t.toString(), {
		method: "GET",
		headers: { Accept: "application/json" }
	});
	if (!n.ok) throw Error(`Failed to discover OAuth metadata from ${t.toString()}: ${n.status} ${n.statusText}`);
	let r = await n.json(), i = r.authorization_endpoint, a = r.token_endpoint;
	if (!i || !a) throw Error("Invalid OAuth metadata: missing authorization_endpoint or token_endpoint");
	return {
		issuer: r.issuer,
		authorizationEndpoint: i,
		tokenEndpoint: a,
		registrationEndpoint: r.registration_endpoint,
		scopesSupported: r.scopes_supported
	};
}
async function ie(e) {
	let t = await f(e, {
		method: "GET",
		headers: { Accept: "application/json" }
	});
	if (t.status !== 401) throw Error(`Expected ${e} to return 401 with OAuth metadata, got ${t.status} ${t.statusText}`);
	let n = t.headers.get("www-authenticate")?.match(/\bresource_metadata\s*=\s*"([^"]+)"/i)?.[1], r, i, a = async (e, t) => {
		try {
			let n = await f(e, {
				method: "GET",
				headers: { Accept: "application/json" }
			});
			if (!n.ok) {
				r = /* @__PURE__ */ Error(`HTTP ${n.status} ${n.statusText} from ${t}`);
				return;
			}
			let i = n.headers.get("content-type") ?? "";
			if (!i.toLowerCase().includes("application/json")) {
				r = /* @__PURE__ */ Error(`Non-JSON response from ${t} (Content-Type: ${i || "none"})`);
				return;
			}
			let a = await n.json();
			if (!a.resource) {
				r = /* @__PURE__ */ Error(`Missing required 'resource' field in response from ${t}`);
				return;
			}
			return a;
		} catch (e) {
			r = e instanceof Error ? e : Error(String(e));
			return;
		}
	};
	if (n && (i = await a(n, "header url")), !i) {
		let t = new URL(e), n = t.pathname === "/" ? "" : t.pathname;
		i = await a(new URL(`/.well-known/oauth-protected-resource${n}`, t.origin).toString(), "well-known url");
	}
	if (!i) throw Error(`Failed to discover protected resource metadata for ${e}: ${r?.message || "Unknown error"}`);
	let o = i;
	return {
		resource: o.resource,
		authorizationServers: o.authorization_servers,
		bearerMethodsSupported: o.bearer_methods_supported,
		scopesSupported: o.scopes_supported,
		resourceName: o.resource_name,
		resourceDocumentation: o.resource_documentation
	};
}
//#endregion
//#region ../../packages/agent-core/src/connectors/oauth-tokens.ts
async function ae(e) {
	let t = new URLSearchParams({
		grant_type: "authorization_code",
		code: e.code,
		code_verifier: e.codeVerifier,
		client_id: e.clientId,
		redirect_uri: e.redirectUri
	});
	e.clientSecret && t.set("client_secret", e.clientSecret), e.resource && t.set("resource", e.resource);
	let n = await f(e.tokenEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: t.toString()
	});
	if (!n.ok) {
		let e = await n.text();
		throw Error(`Token exchange failed: ${n.status} ${n.statusText} - ${e}`);
	}
	let r = await n.json(), i = r.access_token;
	if (!i) throw Error("Token response missing access_token");
	let a = r.expires_in;
	return {
		accessToken: i,
		refreshToken: r.refresh_token,
		tokenType: r.token_type || "Bearer",
		expiresAt: a ? Date.now() + a * 1e3 : void 0,
		scope: r.scope
	};
}
//#endregion
//#region ../../packages/agent-core/src/connectors/mcp-oauth.ts
async function oe(e, t, n) {
	if (!e.registrationEndpoint) throw Error("OAuth server does not support dynamic client registration");
	let r = await f(e.registrationEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			client_name: n,
			redirect_uris: [t],
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			token_endpoint_auth_method: "none"
		})
	});
	if (!r.ok) {
		let e = await r.text();
		throw Error(`OAuth client registration failed: ${r.status} ${r.statusText} - ${e}`);
	}
	let i = await r.json(), a = i.client_id;
	if (!a) throw Error("OAuth client registration response missing client_id");
	return {
		clientId: a,
		clientSecret: i.client_secret
	};
}
function se() {
	let e = i.randomBytes(32).toString("base64url");
	return {
		codeVerifier: e,
		codeChallenge: i.createHash("sha256").update(e).digest().toString("base64url")
	};
}
function ce(e) {
	let t = new URL(e.authorizationEndpoint);
	if (t.searchParams.set("response_type", "code"), t.searchParams.set("client_id", e.clientId), t.searchParams.set("redirect_uri", e.redirectUri), t.searchParams.set("code_challenge", e.codeChallenge), t.searchParams.set("code_challenge_method", "S256"), t.searchParams.set("state", e.state), e.scope && t.searchParams.set("scope", e.scope), e.extraParams) for (let [n, r] of Object.entries(e.extraParams)) t.searchParams.set(n, r);
	return t.toString();
}
//#endregion
//#region ../../packages/agent-core/src/common/types/provider.ts
var le = "https://api.minimax.io/v1", p = {
	china: "https://open.bigmodel.cn/api/paas/v4",
	international: "https://api.z.ai/api/coding/paas/v4"
}, ue = new Set([
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
]), de = new Set([
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
]), m = [
	{
		id: "anthropic",
		name: "Anthropic",
		requiresApiKey: !0,
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
		requiresApiKey: !0,
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
		requiresApiKey: !0,
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
		requiresApiKey: !0,
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
		requiresApiKey: !0,
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
		requiresApiKey: !0,
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
		requiresApiKey: !0,
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
			supportsVision: !1
		}]
	},
	{
		id: "bedrock",
		name: "Amazon Bedrock",
		requiresApiKey: !1,
		models: []
	},
	{
		id: "vertex",
		name: "Google Vertex AI",
		requiresApiKey: !1,
		models: []
	},
	{
		id: "minimax",
		name: "MiniMax",
		requiresApiKey: !0,
		apiKeyEnvVar: "MINIMAX_API_KEY",
		baseUrl: le,
		editableBaseUrl: !0,
		defaultModelId: "minimax/MiniMax-M2.5",
		models: [
			{
				id: "MiniMax-M2",
				displayName: "MiniMax M2",
				provider: "minimax",
				fullId: "minimax/MiniMax-M2",
				contextWindow: 196608,
				supportsVision: !1
			},
			{
				id: "MiniMax-M2.1",
				displayName: "MiniMax M2.1",
				provider: "minimax",
				fullId: "minimax/MiniMax-M2.1",
				contextWindow: 204800,
				supportsVision: !1
			},
			{
				id: "MiniMax-M2.1-highspeed",
				displayName: "MiniMax M2.1 Highspeed",
				provider: "minimax",
				fullId: "minimax/MiniMax-M2.1-highspeed",
				contextWindow: 204800,
				supportsVision: !1
			},
			{
				id: "MiniMax-M2.5",
				displayName: "MiniMax M2.5",
				provider: "minimax",
				fullId: "minimax/MiniMax-M2.5",
				contextWindow: 204800,
				supportsVision: !1
			},
			{
				id: "MiniMax-M2.5-highspeed",
				displayName: "MiniMax M2.5 Highspeed",
				provider: "minimax",
				fullId: "minimax/MiniMax-M2.5-highspeed",
				contextWindow: 204800,
				supportsVision: !1
			}
		]
	},
	{
		id: "nebius",
		name: "Nebius AI",
		requiresApiKey: !0,
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
		requiresApiKey: !0,
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
		requiresApiKey: !0,
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
		requiresApiKey: !0,
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
		requiresApiKey: !0,
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
		requiresApiKey: !1,
		defaultModelId: "copilot/gpt-4o",
		models: []
	},
	{
		id: "accomplish-ai",
		name: "Accomplish AI",
		requiresApiKey: !1,
		defaultModelId: "accomplish-ai/accomplish-free",
		models: [{
			id: "accomplish-free",
			displayName: "Accomplish",
			provider: "accomplish-ai",
			fullId: "accomplish-ai/accomplish-free",
			contextWindow: 128e3,
			maxOutputTokens: 32e3,
			supportsVision: !0
		}]
	}
], fe = /* @__PURE__ */ new Map();
function pe(e) {
	let t = o(e);
	if (!t) return;
	let n = fe.get(t);
	return n || (n = new a(t), fe.set(t, n)), n;
}
async function h(e, t, n) {
	let r = new AbortController(), i = setTimeout(() => r.abort(), n);
	try {
		let n = pe(e);
		return await fetch(e, {
			...t,
			signal: r.signal,
			...n ? { dispatcher: n } : {}
		});
	} finally {
		clearTimeout(i);
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/validation-providers.ts
async function me(e, t, n, r) {
	switch (e) {
		case "anthropic": return h("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": t,
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
		}, r);
		case "openai": return h(`${(n.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "")}/models`, {
			method: "GET",
			headers: { Authorization: `Bearer ${t}` }
		}, r);
		case "google": return h(`https://generativelanguage.googleapis.com/v1beta/models?key=${t}`, { method: "GET" }, r);
		case "xai": return h("https://api.x.ai/v1/models", {
			method: "GET",
			headers: { Authorization: `Bearer ${t}` }
		}, r);
		case "deepseek": return h("https://api.deepseek.com/models", {
			method: "GET",
			headers: { Authorization: `Bearer ${t}` }
		}, r);
		case "openrouter": return h("https://openrouter.ai/api/v1/auth/key", {
			method: "GET",
			headers: { Authorization: `Bearer ${t}` }
		}, r);
		case "moonshot": return h("https://api.moonshot.ai/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${t}`
			},
			body: JSON.stringify({
				model: "kimi-latest",
				max_tokens: 1,
				messages: [{
					role: "user",
					content: "test"
				}]
			})
		}, r);
		case "zai": {
			let e = p[n.zaiRegion ?? "international"];
			return h(`${e}/models`, {
				method: "GET",
				headers: { Authorization: `Bearer ${t}` }
			}, r);
		}
		case "minimax": return h("https://api.minimax.io/anthropic/v1/messages", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${t}`,
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
		}, r);
		case "ollama":
		case "bedrock":
		case "vertex":
		case "azure-foundry":
		case "litellm":
		case "lmstudio":
		case "custom": return null;
		default: {
			let n = m.find((t) => t.id === e);
			if (n?.modelsEndpoint) {
				let { url: e, authStyle: i } = n.modelsEndpoint, a = {}, o = e;
				return i === "bearer" ? a.Authorization = `Bearer ${t}` : i === "query-param" ? o = `${e}?key=${t}` : i === "x-api-key" && (a["x-api-key"] = t), n.modelsEndpoint.extraHeaders && Object.assign(a, n.modelsEndpoint.extraHeaders), h(o, {
					method: "GET",
					headers: a
				}, r);
			}
			return null;
		}
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/validation.ts
var he = 1e4;
async function ge(e, t, n) {
	let r = n?.timeout ?? he;
	try {
		let i = await me(e, t, n ?? {}, r);
		return i === null || i.ok ? { valid: !0 } : i.status === 401 || i.status === 403 ? {
			valid: !1,
			error: "Invalid API key"
		} : { valid: !0 };
	} catch (e) {
		return e instanceof Error && e.name === "AbortError" ? {
			valid: !1,
			error: "Request timed out. Please check your internet connection and try again."
		} : {
			valid: !1,
			error: "Failed to validate API key. Check your internet connection."
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/utils/json.ts
function g(e) {
	if (!e) return {
		success: !1,
		error: "Input is null or empty"
	};
	try {
		return {
			success: !0,
			data: JSON.parse(e)
		};
	} catch (e) {
		return {
			success: !1,
			error: e instanceof Error ? e.message : "Unknown error"
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/bedrock-credential-resolver.ts
async function _() {
	let e = await import("@aws-sdk/credential-providers"), t = e.fromIni ?? e.default?.fromIni;
	if (!t) throw Error("AWS credential providers package does not expose fromIni");
	return t;
}
//#endregion
//#region ../../packages/agent-core/src/utils/logging.ts
var v = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3
};
function y(e = {}) {
	let { prefix: t = "", minLevel: n = "debug", includeTimestamp: r = !0 } = e, i = (e, n) => {
		let i = [];
		return r && i.push((/* @__PURE__ */ new Date()).toISOString()), i.push(`[${e.toUpperCase()}]`), t && i.push(`[${t}]`), i.push(n), i.join(" ");
	}, a = (e) => v[e] >= v[n], o = (e, t, n) => {
		if (!a(e)) return;
		let r = i(e, t), o = e === "error" ? console.error : e === "warn" ? console.warn : console.log;
		n && Object.keys(n).length > 0 ? o(r, n) : o(r);
	};
	return {
		debug: (e, t) => o("debug", e, t),
		info: (e, t) => o("info", e, t),
		warn: (e, t) => o("warn", e, t),
		error: (e, t) => o("error", e, t),
		child: (n) => y({
			...e,
			prefix: t ? `${t}:${n}` : n
		})
	};
}
//#endregion
//#region ../../packages/agent-core/src/providers/bedrock-models.ts
var _e = y({ prefix: "Bedrock" });
async function ve(e) {
	let t, n = e.authType === "apiKey";
	n && (t = process.env.AWS_BEARER_TOKEN_BEDROCK, process.env.AWS_BEARER_TOKEN_BEDROCK = e.apiKey);
	try {
		let t;
		if (e.authType === "apiKey") t = new s({ region: e.region || "us-east-1" });
		else if (e.authType === "accessKeys") t = new s({
			region: e.region || "us-east-1",
			credentials: {
				accessKeyId: e.accessKeyId,
				secretAccessKey: e.secretAccessKey,
				sessionToken: e.sessionToken
			}
		});
		else {
			let n = await _();
			t = new s({
				region: e.region || "us-east-1",
				credentials: n({ profile: e.profileName })
			});
		}
		let n = new c({});
		return {
			success: !0,
			models: ((await t.send(n)).modelSummaries || []).filter((e) => e.outputModalities?.includes("TEXT")).map((e) => ({
				id: `amazon-bedrock/${e.modelId}`,
				name: e.modelId || "Unknown",
				provider: e.providerName || "Unknown"
			})).sort((e, t) => e.name.localeCompare(t.name))
		};
	} catch (e) {
		return _e.error(`[Bedrock] Failed to fetch models: ${e}`), {
			success: !1,
			error: e instanceof Error ? e.message : "Unknown error",
			models: []
		};
	} finally {
		n && (t === void 0 ? delete process.env.AWS_BEARER_TOKEN_BEDROCK : process.env.AWS_BEARER_TOKEN_BEDROCK = t);
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/bedrock.ts
async function ye(e) {
	let t = g(e);
	if (!t.success) return {
		valid: !1,
		error: "Failed to parse credentials"
	};
	let n = t.data, r, i = null;
	try {
		if (n.authType === "apiKey") {
			let e = process.env.AWS_BEARER_TOKEN_BEDROCK;
			process.env.AWS_BEARER_TOKEN_BEDROCK = n.apiKey, i = () => {
				e === void 0 ? delete process.env.AWS_BEARER_TOKEN_BEDROCK : process.env.AWS_BEARER_TOKEN_BEDROCK = e;
			}, r = new s({ region: n.region || "us-east-1" });
		} else if (n.authType === "accessKeys") {
			if (!n.accessKeyId || !n.secretAccessKey) return {
				valid: !1,
				error: "Access Key ID and Secret Access Key are required"
			};
			let e = {
				accessKeyId: n.accessKeyId,
				secretAccessKey: n.secretAccessKey
			};
			n.sessionToken && (e.sessionToken = n.sessionToken), r = new s({
				region: n.region || "us-east-1",
				credentials: e
			});
		} else if (n.authType === "profile") {
			let e = await _();
			r = new s({
				region: n.region || "us-east-1",
				credentials: e({ profile: n.profileName || "default" })
			});
		} else return {
			valid: !1,
			error: "Invalid authentication type"
		};
		let e = new c({});
		return await r.send(e), { valid: !0 };
	} catch (e) {
		let t = e instanceof Error ? e.message : "Validation failed";
		return t.includes("UnrecognizedClientException") || t.includes("InvalidSignatureException") ? {
			valid: !1,
			error: "Invalid AWS credentials. Please check your Access Key ID and Secret Access Key."
		} : t.includes("AccessDeniedException") ? {
			valid: !1,
			error: "Access denied. Ensure your AWS credentials have Bedrock permissions."
		} : t.includes("could not be found") ? {
			valid: !1,
			error: "AWS profile not found. Check your ~/.aws/credentials file."
		} : t.includes("InvalidBearerTokenException") || t.includes("bearer token") ? {
			valid: !1,
			error: "Invalid Bedrock API key. Please check your API key and try again."
		} : {
			valid: !1,
			error: t
		};
	} finally {
		i?.();
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/vertex-auth.ts
var b = 15e3;
async function be(e) {
	let t = Math.floor(Date.now() / 1e3), n = {
		alg: "RS256",
		typ: "JWT"
	}, r = {
		iss: e.client_email,
		scope: "https://www.googleapis.com/auth/cloud-platform",
		aud: "https://oauth2.googleapis.com/token",
		iat: t,
		exp: t + 3600
	}, a = (e) => Buffer.from(JSON.stringify(e)).toString("base64url"), o = `${a(n)}.${a(r)}`, s = i.createSign("RSA-SHA256");
	s.update(o);
	let c = `${o}.${s.sign(e.private_key, "base64url")}`, l = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${c}`,
		signal: AbortSignal.timeout(b)
	});
	if (!l.ok) {
		let e = await l.text().catch(() => "");
		throw Error(`Token exchange failed (${l.status}): ${e}`);
	}
	let u = await l.json();
	if (!u.access_token) throw Error("No access token in response");
	return u.access_token;
}
async function xe() {
	try {
		let e = await new Promise((e, t) => {
			l("gcloud", [
				"auth",
				"application-default",
				"print-access-token"
			], {
				timeout: b,
				encoding: "utf-8"
			}, (n, r) => {
				n ? t(n) : e(r.trim());
			});
		});
		if (!e) throw Error("Empty token returned from gcloud");
		return e;
	} catch (e) {
		let t = e instanceof Error ? e.message : "Unknown error";
		throw t.includes("ENOENT") || t.includes("not found") || t.includes("not recognized") ? Error("gcloud CLI not found. Install the Google Cloud SDK and run \"gcloud auth application-default login\".") : Error(`Failed to get ADC token: ${t}`);
	}
}
async function Se(e) {
	switch (e.authType) {
		case "serviceAccount": {
			let t = g(e.serviceAccountJson);
			if (!t.success) throw Error("Invalid service account JSON");
			return be(t.data);
		}
		case "adc": return await xe();
		default: throw Error(`Unknown authType: ${e.authType}`);
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/vertex.ts
var Ce = [
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
], we = 15e3, x = class e {
	baseUrl;
	headers;
	constructor(e, t, n) {
		this.projectId = e, this.location = t, this.accessToken = n, this.baseUrl = t === "global" ? "https://aiplatform.googleapis.com" : `https://${t}-aiplatform.googleapis.com`, this.headers = {
			Authorization: `Bearer ${n}`,
			"Content-Type": "application/json"
		};
	}
	static async create(t) {
		let n = await Se(t);
		return new e(t.projectId, t.location, n);
	}
	async testAccess() {
		let e = `${this.baseUrl}/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/gemini-2.5-flash:generateContent`, t = await fetch(e, {
			method: "POST",
			headers: this.headers,
			body: JSON.stringify({ contents: [{
				role: "user",
				parts: [{ text: "Say hi" }]
			}] }),
			signal: AbortSignal.timeout(we)
		});
		if (!t.ok) {
			if (t.status === 429) return;
			let e = await t.text().catch(() => "");
			throw t.status === 401 || t.status === 403 ? Error("Authentication failed. Check your credentials and ensure the Vertex AI API is enabled.") : t.status === 404 ? Error(`Project "${this.projectId}" or location "${this.location}" not found. Verify your project ID and location.`) : Error(`Vertex AI API error (${t.status}): ${e}`);
		}
	}
};
async function Te(e) {
	let t = g(e);
	if (!t.success) return {
		valid: !1,
		error: "Failed to parse credentials"
	};
	let n = t.data;
	if (!n.projectId?.trim()) return {
		valid: !1,
		error: "Project ID is required"
	};
	if (!n.location?.trim()) return {
		valid: !1,
		error: "Location is required"
	};
	if (n.authType === "serviceAccount") {
		if (!n.serviceAccountJson?.trim()) return {
			valid: !1,
			error: "Service account JSON key is required"
		};
		let e = g(n.serviceAccountJson);
		if (!e.success) return {
			valid: !1,
			error: "Invalid service account JSON format"
		};
		let t = e.data;
		if (!t.type || !t.project_id || !t.private_key || !t.client_email) return {
			valid: !1,
			error: "Service account key missing required fields (type, project_id, private_key, client_email)"
		};
	}
	try {
		return await (await x.create(n)).testAccess(), { valid: !0 };
	} catch (e) {
		return {
			valid: !1,
			error: e instanceof Error ? e.message : "Validation failed"
		};
	}
}
function Ee(e) {
	return {
		success: !0,
		models: Ce.map((e) => ({
			id: `vertex/${e.publisher}/${e.modelId}`,
			name: e.displayName,
			provider: e.publisher
		}))
	};
}
//#endregion
//#region ../../packages/agent-core/src/utils/url.ts
function S(e, t = "URL") {
	try {
		let n = new URL(e);
		if (n.protocol !== "http:" && n.protocol !== "https:") throw Error(`${t} must use http or https protocol`);
		return n;
	} catch (e) {
		throw e instanceof Error && e.message.includes("protocol") ? e : Error(`${t} is not a valid URL`);
	}
}
//#endregion
//#region ../../packages/agent-core/src/opencode/proxies/azure-token-manager.ts
var De = y({ prefix: "AzureTokenManager" }), C = null, Oe = 300 * 1e3, ke = 3600 * 1e3;
async function w() {
	let e = /* @__PURE__ */ new Date();
	if (C && C.expiresAt > new Date(e.getTime() + Oe)) return {
		success: !0,
		token: C.token
	};
	try {
		let { DefaultAzureCredential: t } = await import("@azure/identity"), n = await new t().getToken("https://cognitiveservices.azure.com/.default"), r;
		return r = n.expiresOnTimestamp ? new Date(n.expiresOnTimestamp) : new Date(e.getTime() + ke), C = {
			token: n.token,
			expiresAt: r
		}, De.info(`[Azure Token Manager] Acquired new token, expires at ${r.toISOString()}`), {
			success: !0,
			token: n.token
		};
	} catch (e) {
		let t = e instanceof Error ? e.message : "Unknown error", n = "";
		return t.includes("AADSTS") ? n = " Check your Azure AD configuration." : t.includes("DefaultAzureCredential") ? n = " Ensure you're logged in with 'az login' or have valid Azure credentials configured." : (t.includes("network") || t.includes("ENOTFOUND")) && (n = " Check your network connectivity."), {
			success: !1,
			error: `Failed to acquire Azure Entra ID token: ${t}.${n}`
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/utils/sanitize.ts
var T = 6e4;
function E(e, t, n = T) {
	if (typeof e != "string") throw Error(`${t} must be a string`);
	let r = e.trim();
	if (!r) throw Error(`${t} is required`);
	if (r.length > n) throw Error(`${t} exceeds maximum length of ${n}`);
	return r;
}
//#endregion
//#region ../../packages/agent-core/src/providers/azure-foundry-auth.ts
var Ae = 15e3;
async function D(e, t, n, r) {
	let i = { messages: [{
		role: "user",
		content: n
	}] }, a = await h(e, {
		method: "POST",
		headers: t,
		body: JSON.stringify({
			...i,
			max_completion_tokens: 5
		})
	}, r);
	return a.ok ? a : ((await a.clone().json().catch(() => ({})))?.error?.message || "").includes("max_completion_tokens") ? h(e, {
		method: "POST",
		headers: t,
		body: JSON.stringify({
			...i,
			max_tokens: 5
		})
	}, r) : a;
}
async function O() {
	let e = await w();
	return e.success ? {
		success: !0,
		authValue: `Bearer ${e.token}`
	} : {
		success: !1,
		error: e.error
	};
}
async function je(e, t) {
	let n = { "Content-Type": "application/json" };
	if (e === "entra-id") {
		let e = await O();
		return e.success ? (n.Authorization = e.authValue, {
			success: !0,
			headers: n,
			authValue: e.authValue
		}) : {
			success: !1,
			error: e.error
		};
	}
	if (!t) return {
		success: !1,
		error: "API key is required for api-key authentication"
	};
	let r;
	try {
		r = E(t, "apiKey", 256);
	} catch (e) {
		return {
			success: !1,
			error: e instanceof Error ? e.message : "Invalid API key"
		};
	}
	return n["api-key"] = r, {
		success: !0,
		headers: n,
		authValue: r
	};
}
async function Me(e, t) {
	let n = { "Content-Type": "application/json" };
	if (e === "api-key") {
		let e = t?.trim();
		return e ? (n["api-key"] = e, {
			success: !0,
			headers: n
		}) : {
			success: !1,
			error: "API key is required for API key authentication"
		};
	}
	let r = await O();
	return r.success ? (n.Authorization = r.authValue, {
		success: !0,
		headers: n
	}) : {
		success: !1,
		error: r.error
	};
}
//#endregion
//#region ../../packages/agent-core/src/providers/azure-foundry.ts
var k = y({ prefix: "AzureFoundry" });
async function Ne(e) {
	let { endpoint: t, deploymentName: n, authType: r, apiKey: i, timeout: a = Ae } = e, o;
	try {
		S(t, "Azure Foundry endpoint"), o = t.replace(/\/$/, "");
	} catch (e) {
		return {
			success: !1,
			error: e instanceof Error ? e.message : "Invalid endpoint URL format"
		};
	}
	let s = await Me(r, i);
	if (!s.success) return {
		success: !1,
		error: s.error
	};
	let c = `${o}/openai/deployments/${n}/chat/completions?api-version=2024-02-15-preview`;
	try {
		let e = await D(c, s.headers, "Hi", a);
		return e.ok ? (k.info(`[Azure Foundry] Connection test successful for deployment: ${n}`), { success: !0 }) : {
			success: !1,
			error: (await e.json().catch(() => ({})))?.error?.message || `API returned status ${e.status}`
		};
	} catch (e) {
		let t = e instanceof Error ? e.message : "Connection failed";
		return k.warn(`[Azure Foundry] Connection test failed: ${t}`), e instanceof Error && e.name === "AbortError" ? {
			success: !1,
			error: "Request timed out. Check your endpoint URL and network connection."
		} : {
			success: !1,
			error: t
		};
	}
}
async function Pe(e, t) {
	let n = t.baseUrl || e?.baseUrl, r = t.deploymentName || e?.deploymentName, i = t.authType || e?.authType || "api-key", a = t.timeout ?? 15e3;
	if (i === "entra-id" && (!t.baseUrl || !t.deploymentName)) return { valid: !0 };
	let o = await je(i, t.apiKey);
	if (!o.success) return {
		valid: !1,
		error: o.error
	};
	if (!n || !r) return k.info("[Azure Foundry] Skipping validation (missing config or options)"), { valid: !0 };
	if (i === "entra-id" && !o.authValue) return {
		valid: !1,
		error: "Missing Entra ID access token for Azure Foundry validation request"
	};
	let s = `${n.replace(/\/+$/, "")}/openai/deployments/${r}/chat/completions?api-version=2023-05-15`;
	try {
		let e = await D(s, o.headers, "test", a);
		if (e.ok) return k.info("[Azure Foundry] Validation succeeded"), { valid: !0 };
		let t = (await e.json().catch(() => ({})))?.error?.message || `API returned status ${e.status}`;
		return k.warn("[Azure Foundry] Validation failed", { error: t }), {
			valid: !1,
			error: t
		};
	} catch (e) {
		return k.error("[Azure Foundry] Validation error", { error: e instanceof Error ? e.message : String(e) }), e instanceof Error && e.name === "AbortError" ? {
			valid: !1,
			error: "Request timed out. Please check your internet connection and try again."
		} : {
			valid: !1,
			error: "Failed to validate API key. Check your internet connection."
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/openrouter.ts
var A = y({ prefix: "OpenRouter" }), Fe = 1e4;
async function Ie(e, t = Fe) {
	if (!e) return {
		success: !1,
		error: "No OpenRouter API key configured"
	};
	try {
		let n = await h("https://openrouter.ai/api/v1/models", {
			method: "GET",
			headers: { Authorization: `Bearer ${e}` }
		}, t);
		if (!n.ok) return {
			success: !1,
			error: (await n.json().catch(() => ({})))?.error?.message || `API returned status ${n.status}`
		};
		let r = ((await n.json()).data || []).map((e) => {
			let t = e.id.split("/")[0] || "unknown";
			return {
				id: e.id,
				name: e.name || e.id,
				provider: t,
				contextLength: e.context_length || 0
			};
		});
		return A.info(`[OpenRouter] Fetched ${r.length} models`), {
			success: !0,
			models: r
		};
	} catch (e) {
		let t = e instanceof Error ? e.message : "Failed to fetch models";
		return A.warn(`[OpenRouter] Fetch failed: ${t}`), e instanceof Error && e.name === "AbortError" ? {
			success: !1,
			error: "Request timed out. Check your internet connection."
		} : {
			success: !1,
			error: `Failed to fetch models: ${t}`
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/nim.ts
var j = y({ prefix: "NIM" }), Le = 1e4;
function Re(e) {
	let t = [];
	for (let n of e || []) {
		if (!n || typeof n.id != "string" || !n.id.trim()) continue;
		let e = n.id.split("/"), r = (e.length > 1 ? e[0] : n.owned_by || "nvidia") || n.owned_by || "nvidia", i = e.length > 1 ? e.slice(1).join("/") : n.id, a = r ? r.charAt(0).toUpperCase() + r.slice(1) : "", o = i ? i.split(/[-_]/).map((e) => e ? e.charAt(0).toUpperCase() + e.slice(1) : "").join(" ") : n.id, s = e.length > 1 && a ? `${a}: ${o}` : o;
		t.push({
			id: n.id,
			name: s || n.id,
			provider: r,
			contextLength: 0
		});
	}
	return t;
}
async function M(e, t, n, r) {
	try {
		let n = { Authorization: `Bearer ${t}` }, r = await h(`${e}/models`, {
			method: "GET",
			headers: n
		}, Le);
		return r.ok ? {
			success: !0,
			models: Re((await r.json()).data)
		} : {
			success: !1,
			error: (await r.json().catch(() => ({})))?.error?.message || `API returned status ${r.status}`
		};
	} catch (e) {
		let t = e instanceof Error ? e.message : "Unknown error";
		return e instanceof Error && e.name === "AbortError" ? {
			success: !1,
			error: n
		} : {
			success: !1,
			error: `${r}: ${t}`
		};
	}
}
async function ze(e, t) {
	let n = E(e, "nimUrl", 256), r = E(t, "apiKey", 256);
	try {
		S(n, "NIM URL");
	} catch (e) {
		return {
			success: !1,
			error: e instanceof Error ? e.message : "Invalid URL format"
		};
	}
	if (!r) return {
		success: !1,
		error: "API key is required for NVIDIA NIM"
	};
	let i = await M(n.replace(/\/+$/, ""), r, "Connection timed out. Check your NVIDIA NIM endpoint.", "Cannot connect to NVIDIA NIM");
	return i.success ? j.info(`Connection successful, found ${i.models?.length ?? 0} models`) : j.warn(`Connection failed: ${i.error}`), i;
}
async function Be(e) {
	let { config: t, apiKey: n } = e;
	if (!t || !t.baseUrl) return {
		success: !1,
		error: "No NVIDIA NIM endpoint configured"
	};
	let r = E(n || "", "apiKey", 256);
	if (!r) return {
		success: !1,
		error: "API key is required for NVIDIA NIM"
	};
	let i = E(t.baseUrl, "nimUrl", 256).replace(/\/+$/, "");
	try {
		S(i, "NIM URL");
	} catch {
		return {
			success: !1,
			error: "Invalid NVIDIA NIM endpoint URL"
		};
	}
	let a = await M(i, r, "Request timed out. Check your NVIDIA NIM endpoint.", "Failed to fetch models");
	return a.success ? j.info(`Fetched ${a.models?.length ?? 0} models`) : j.warn(`Fetch failed: ${a.error}`), a;
}
//#endregion
//#region ../../packages/agent-core/src/providers/tool-support-testing.ts
var N = y({ prefix: "ToolSupportTesting" });
async function Ve(e) {
	let { baseUrl: t, modelId: n, providerName: r, timeoutMs: i = 1e4 } = e, a = {
		model: n,
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
		let e = new AbortController(), o = setTimeout(() => e.abort(), i), s = await fetch(`${t}/v1/chat/completions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(a),
			signal: e.signal
		});
		if (clearTimeout(o), !s.ok) {
			let e = await s.text();
			return e.includes("tool") || e.includes("function") || e.includes("does not support") ? (N.info(`[${r}] Model ${n} does not support tools (error response)`), "unsupported") : (N.warn(`[${r}] Tool test failed for ${n}: ${s.status}`), "unknown");
		}
		let c = (await s.json()).choices?.[0];
		return c?.message?.tool_calls && c.message.tool_calls.length > 0 ? (N.info(`[${r}] Model ${n} supports tools (made tool call)`), "supported") : c?.finish_reason === "tool_calls" ? (N.info(`[${r}] Model ${n} supports tools (finish_reason)`), "supported") : "unknown";
	} catch (e) {
		if (e instanceof Error) {
			if (e.name === "AbortError") return N.warn(`[${r}] Tool test timed out for ${n}`), "unknown";
			if (e.message.includes("tool") || e.message.includes("function")) return N.info(`[${r}] Model ${n} does not support tools (exception)`), "unsupported";
		}
		return N.warn(`[${r}] Tool test error for ${n}: ${e}`), "unknown";
	}
}
async function P(e, t) {
	try {
		let n = await h(`${e}/api/show`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model: t })
		}, 5e3);
		if (!n.ok) return N.warn(`[Ollama] /api/show failed for ${t}: ${n.status}`), "unknown";
		let r = await n.json();
		return r.capabilities?.includes("tools") ? (N.info(`[Ollama] Model ${t} supports tools (capabilities)`), "supported") : Array.isArray(r.capabilities) ? (N.info(`[Ollama] Model ${t} does not support tools (capabilities: ${r.capabilities.join(", ")})`), "unsupported") : (N.info(`[Ollama] Model ${t} has no capabilities field`), "unknown");
	} catch (e) {
		return N.warn(`[Ollama] Tool check error for ${t}: ${e}`), "unknown";
	}
}
async function He(e, t) {
	return Ve({
		baseUrl: e,
		modelId: t,
		providerName: "LM Studio"
	});
}
//#endregion
//#region ../../packages/agent-core/src/providers/ollama.ts
var Ue = 15e3;
async function We(e) {
	let t = E(e, "ollamaUrl", 256);
	try {
		S(t, "Ollama URL");
	} catch (e) {
		return {
			success: !1,
			error: e instanceof Error ? e.message : "Invalid URL format"
		};
	}
	try {
		let e = await h(`${t}/api/tags`, { method: "GET" }, Ue);
		if (!e.ok) throw Error(`Ollama returned status ${e.status}`);
		let n = (await e.json()).models || [];
		if (n.length === 0) return {
			success: !0,
			models: []
		};
		let r = [];
		for (let e = 0; e < n.length; e += 5) {
			let i = n.slice(e, e + 5), a = await Promise.all(i.map(async (e) => {
				let n = await P(t, e.name);
				return {
					id: e.name,
					displayName: e.name,
					size: e.size,
					toolSupport: n
				};
			}));
			r.push(...a);
		}
		return {
			success: !0,
			models: r
		};
	} catch (e) {
		let t = e instanceof Error ? e.message : "Connection failed";
		return e instanceof Error && e.name === "AbortError" ? {
			success: !1,
			error: "Connection timed out. Make sure Ollama is running."
		} : {
			success: !1,
			error: `Cannot connect to Ollama: ${t}`
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/common/constants/model-display.ts
var F = {
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
}, I = [
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
function L(e) {
	if (!e) return "AI";
	let t = e;
	for (let e of I) if (t.startsWith(e)) {
		t = t.slice(e.length);
		break;
	}
	return t.includes("/") && (t = t.split("/").pop() || t), t = t.replace(/-\d{8}$/, ""), F[t] ? F[t] : t.split("-").map((e) => /^\d/.test(e) ? e : e.charAt(0).toUpperCase() + e.slice(1)).join(" ").replace(/\s+/g, " ").trim() || "AI";
}
//#endregion
//#region ../../packages/agent-core/src/providers/fetch-models.ts
var R = y({ prefix: "FetchModels" }), Ge = 15e3;
function Ke(e, t, n) {
	let r = n || e.url, i = {};
	if (e.authStyle === "bearer") i.Authorization = `Bearer ${t}`;
	else if (e.authStyle === "x-api-key") i["x-api-key"] = t;
	else if (e.authStyle === "query-param") {
		let e = r.includes("?") ? "&" : "?";
		r = `${r}${e}key=${encodeURIComponent(t)}`;
	}
	return e.extraHeaders && Object.assign(i, e.extraHeaders), {
		url: r,
		headers: i
	};
}
function qe(e, t, n) {
	let r = e;
	if (!r.data || !Array.isArray(r.data)) return [];
	let i = r.data;
	return n && (i = i.filter((e) => n.test(e.id))), i.map((e) => ({
		id: `${t}${e.id}`,
		name: L(e.id)
	}));
}
function Je(e, t, n) {
	let r = e;
	if (!r.data || !Array.isArray(r.data)) return [];
	let i = r.data;
	return n && (i = i.filter((e) => n.test(e.id))), i.map((e) => ({
		id: `${t}${e.id}`,
		name: e.display_name || L(e.id)
	}));
}
function Ye(e, t, n) {
	let r = e;
	if (!r.models || !Array.isArray(r.models)) return [];
	let i = r.models.filter((e) => e.supportedGenerationMethods?.includes("generateContent")).map((e) => {
		let t = e.name.replace(/^models\//, "");
		return {
			id: t,
			displayName: e.displayName || t
		};
	}), a = i;
	return n && (a = i.filter((e) => n.test(e.id))), a.map((e) => ({
		id: `${t}${e.id}`,
		name: e.displayName || L(e.id)
	}));
}
var Xe = {
	openai: qe,
	anthropic: Je,
	google: Ye
};
async function Ze(e) {
	let { endpointConfig: t, apiKey: n, urlOverride: r } = e, i = e.timeout ?? Ge, a = t.modelIdPrefix || "";
	if (!n) return {
		success: !1,
		error: "No API key provided"
	};
	try {
		let { url: e, headers: o } = Ke(t, n, r), s = await h(e, {
			method: "GET",
			headers: o
		}, i);
		if (!s.ok) return {
			success: !1,
			error: (await s.json().catch(() => ({})))?.error?.message || `API returned status ${s.status}`
		};
		let c = await s.json(), l = Xe[t.responseFormat], u = l(c, a, t.modelFilter);
		return R.info(`Fetched ${u.length} models from ${e}`), {
			success: !0,
			models: u
		};
	} catch (e) {
		let t = e instanceof Error ? e.message : "Failed to fetch models";
		return R.warn(`Fetch failed: ${t}`), e instanceof Error && e.name === "AbortError" ? {
			success: !1,
			error: "Request timed out. Check your internet connection."
		} : {
			success: !1,
			error: `Failed to fetch models: ${t}`
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/litellm.ts
var z = y({ prefix: "LiteLLM" }), B = 1e4;
async function Qe(e, t) {
	let n = E(e, "litellmUrl", 256), r = t ? E(t, "apiKey", 256) : void 0;
	try {
		S(n, "LiteLLM URL");
	} catch (e) {
		return {
			success: !1,
			error: e instanceof Error ? e.message : "Invalid URL format"
		};
	}
	try {
		let e = {};
		r && (e.Authorization = `Bearer ${r}`);
		let t = await h(`${n}/v1/models`, {
			method: "GET",
			headers: e
		}, B);
		if (!t.ok) return {
			success: !1,
			error: (await t.json().catch(() => ({})))?.error?.message || `API returned status ${t.status}`
		};
		let i = ((await t.json()).data || []).map((e) => {
			let t = e.id.split("/")[0] || e.owned_by || "unknown";
			return {
				id: e.id,
				name: e.id,
				provider: t,
				contextLength: 0
			};
		});
		return z.info(`[LiteLLM] Connection successful, found ${i.length} models`), {
			success: !0,
			models: i
		};
	} catch (e) {
		let t = e instanceof Error ? e.message : "Connection failed";
		return z.warn(`[LiteLLM] Connection failed: ${t}`), e instanceof Error && e.name === "AbortError" ? {
			success: !1,
			error: "Connection timed out. Make sure LiteLLM proxy is running."
		} : {
			success: !1,
			error: `Cannot connect to LiteLLM: ${t}`
		};
	}
}
async function $e(e) {
	let { config: t, apiKey: n } = e;
	if (!t || !t.baseUrl) return {
		success: !1,
		error: "No LiteLLM proxy configured"
	};
	try {
		let e = {};
		n && (e.Authorization = `Bearer ${n}`);
		let r = await h(`${t.baseUrl}/v1/models`, {
			method: "GET",
			headers: e
		}, B);
		if (!r.ok) return {
			success: !1,
			error: (await r.json().catch(() => ({})))?.error?.message || `API returned status ${r.status}`
		};
		let i = ((await r.json()).data || []).map((e) => {
			let t = e.id.split("/"), n = t.length > 1 ? t[0] : (e.owned_by === "openai" ? "unknown" : e.owned_by) || "unknown", r = t.length > 1 ? t.slice(1).join("/") : e.id, i = n.charAt(0).toUpperCase() + n.slice(1), a = r.split("-").map((e) => e.charAt(0).toUpperCase() + e.slice(1)).join(" "), o = t.length > 1 ? `${i}: ${a}` : a;
			return {
				id: e.id,
				name: o,
				provider: n,
				contextLength: 0
			};
		});
		return z.info(`[LiteLLM] Fetched ${i.length} models`), {
			success: !0,
			models: i
		};
	} catch (e) {
		let t = e instanceof Error ? e.message : "Failed to fetch models";
		return z.warn(`[LiteLLM] Fetch failed: ${t}`), e instanceof Error && e.name === "AbortError" ? {
			success: !1,
			error: "Request timed out. Check your LiteLLM proxy."
		} : {
			success: !1,
			error: `Failed to fetch models: ${t}`
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/lmstudio-models.ts
var V = y({ prefix: "LMStudio" }), et = 15e3;
function tt(e) {
	return e.replace(/-/g, " ").replace(/\b\w/g, (e) => e.toUpperCase());
}
async function H(e, t) {
	let n = await h(`${e}/v1/models`, { method: "GET" }, t);
	if (!n.ok) return {
		success: !1,
		error: (await n.json().catch(() => ({})))?.error?.message || `API returned status ${n.status}`
	};
	let r = (await n.json()).data || [], i = [];
	for (let t of r) {
		let n = tt(t.id), r = await He(e, t.id);
		i.push({
			id: t.id,
			name: n,
			toolSupport: r
		}), V.info(`[LM Studio] Model ${t.id}: toolSupport=${r}`);
	}
	return {
		success: !0,
		models: i
	};
}
async function nt(e) {
	let { baseUrl: t, timeoutMs: n = et } = e;
	try {
		return await H(t, n);
	} catch (e) {
		let t = e instanceof Error ? e.message : "Failed to fetch models";
		return V.warn(`[LM Studio] Fetch failed: ${t}`), e instanceof Error && e.name === "AbortError" ? {
			success: !1,
			error: "Request timed out. Check your LM Studio server."
		} : {
			success: !1,
			error: `Failed to fetch models: ${t}`
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/lmstudio.ts
var U = y({ prefix: "LMStudio" });
async function rt(e) {
	let { url: t, timeoutMs: n = et } = e, r = E(t, "lmstudioUrl", 256);
	try {
		S(r, "LM Studio URL");
	} catch (e) {
		return {
			success: !1,
			error: e instanceof Error ? e.message : "Invalid URL format"
		};
	}
	try {
		let e = await H(r, n);
		return e.success ? !e.models || e.models.length === 0 ? {
			success: !1,
			error: "No models loaded in LM Studio. Please load a model first."
		} : (U.info(`[LM Studio] Connection successful, found ${e.models.length} models`), e) : e;
	} catch (e) {
		let t = e instanceof Error ? e.message : "Connection failed";
		return U.warn(`[LM Studio] Connection failed: ${t}`), e instanceof Error && e.name === "AbortError" ? {
			success: !1,
			error: "Connection timed out. Make sure LM Studio is running."
		} : {
			success: !1,
			error: `Cannot connect to LM Studio: ${t}`
		};
	}
}
function it(e) {
	if (typeof e.baseUrl != "string" || typeof e.enabled != "boolean" || (S(e.baseUrl, "LM Studio base URL"), e.lastValidated !== void 0 && typeof e.lastValidated != "number")) throw Error("Invalid LM Studio configuration");
	if (e.models !== void 0) {
		if (!Array.isArray(e.models)) throw Error("Invalid LM Studio configuration: models must be an array");
		for (let t of e.models) if (typeof t.id != "string" || typeof t.name != "string") throw Error("Invalid LM Studio configuration: invalid model format");
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/custom.ts
var W = y({ prefix: "CustomProvider" }), at = 1e4;
async function ot(e, t) {
	let n = E(e, "customUrl", 256), r = t ? E(t, "apiKey", 256) : void 0;
	try {
		S(n, "Custom endpoint URL");
	} catch (e) {
		return {
			success: !1,
			error: e instanceof Error ? e.message : "Invalid URL format"
		};
	}
	let i = n.replace(/\/+$/, "");
	try {
		let e = { "Content-Type": "application/json" };
		r && (e.Authorization = `Bearer ${r}`);
		let t = new URL(i).pathname, n;
		t === "/" || t === "" || t.endsWith("/v1") ? n = i.endsWith("/v1") ? `${i}/models` : `${i}/v1/models` : (W.warn("[Custom] URL path appears to be a specific endpoint rather than a base URL. For best results, provide a base URL ending in /v1 (e.g., https://api.example.com/v1)."), n = i);
		let a = await h(n, {
			method: "GET",
			headers: e
		}, at);
		if (a.ok) return W.info("[Custom] Connection successful, /models endpoint responded"), { success: !0 };
		let o = a.status;
		if (o === 401 || o === 403) return r ? (W.info("[Custom] Connection successful (server reachable, /models may not be supported)"), { success: !0 }) : {
			success: !1,
			error: "Authentication required. Please provide an API key."
		};
		if (o === 404) return W.info("[Custom] Connection successful (server reachable, /models not implemented)"), { success: !0 };
		let s = (await a.json().catch(() => ({})))?.error?.message || `Server returned status ${o}`;
		return W.info(`[Custom] ${s}, but connection is reachable`), { success: !0 };
	} catch (e) {
		let t = e instanceof Error ? e.message : "Connection failed";
		return W.warn(`[Custom] Connection failed: ${t}`), e instanceof Error && e.name === "AbortError" ? {
			success: !1,
			error: "Connection timed out. Make sure the endpoint is accessible."
		} : {
			success: !1,
			error: `Cannot connect to endpoint: ${t}`
		};
	}
}
//#endregion
//#region ../../packages/agent-core/src/providers/copilot-auth.ts
var G = "Iv1.b507a08c87ecfe98", st = "https://github.com/login/device/code", ct = "https://github.com/login/oauth/access_token", lt = "read:user";
async function ut() {
	let e = new URLSearchParams({
		client_id: G,
		scope: lt
	}), t = await fetch(st, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded"
		},
		body: e.toString()
	});
	if (!t.ok) throw Error(`GitHub device code request failed: ${t.status} ${t.statusText}`);
	let n = await t.json();
	if (!n.device_code || !n.user_code) throw Error("Invalid device code response from GitHub");
	return n;
}
async function dt(e) {
	let { deviceCode: t, interval: n, expiresIn: r, onPoll: i } = e, a = Date.now() + r * 1e3, o = Math.max(n, 5) * 1e3;
	for (; Date.now() < a;) {
		i && i(), await new Promise((e) => setTimeout(e, o));
		let e = new URLSearchParams({
			client_id: G,
			device_code: t,
			grant_type: "urn:ietf:params:oauth:grant-type:device_code"
		}), n = await (await fetch(ct, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/x-www-form-urlencoded"
			},
			body: e.toString()
		})).json();
		if (n.access_token) return n;
		if (!(n.error === "authorization_pending" || n.error === "slow_down")) {
			if (n.error === "expired_token") throw Error("Device code expired. Please try connecting again.");
			if (n.error === "access_denied") throw Error("Access was denied. Please authorize the GitHub Copilot connection.");
			if (n.error) throw Error(`GitHub OAuth error: ${n.error} — ${n.error_description ?? ""}`);
		}
	}
	throw Error("Timed out waiting for GitHub authorization. Please try again.");
}
//#endregion
//#region ../../packages/agent-core/src/providers/copilot.ts
var K = y({ prefix: "CopilotProvider" });
function q() {
	let t = process.env.XDG_DATA_HOME || e.join(te.homedir(), ".local", "share");
	return e.join(t, "opencode", "auth.json");
}
function J() {
	let e = q();
	try {
		if (!n.existsSync(e)) return {};
		let t = n.readFileSync(e, "utf8");
		return JSON.parse(t);
	} catch {
		return {};
	}
}
function ft(t) {
	let r = q();
	n.mkdirSync(e.dirname(r), { recursive: !0 }), n.writeFileSync(r, JSON.stringify(t, null, 2), "utf8"), K.info("[CopilotProvider] auth.json updated");
}
function pt() {
	let e = J()["github-copilot"];
	if (!e || typeof e != "object") return { connected: !1 };
	let t = e;
	return t.type === "copilot-oauth" ? {
		connected: typeof t.access == "string" && t.access.trim().length > 0 || typeof t.refresh == "string" && t.refresh.trim().length > 0,
		username: t.username,
		expiresAt: t.expires
	} : { connected: !1 };
}
function mt(e) {
	let t = J();
	t["github-copilot"] = {
		type: "copilot-oauth",
		access: e.accessToken,
		...e.refreshToken ? { refresh: e.refreshToken } : {},
		...e.expiresAt ? { expires: e.expiresAt } : {},
		...e.username ? { username: e.username } : {}
	}, ft(t);
}
function ht() {
	let e = J();
	delete e["github-copilot"], ft(e), K.info("[CopilotProvider] Copilot credentials cleared");
}
//#endregion
//#region ../../packages/agent-core/src/opencode/auth-slack-mcp.ts
var Y = "https://mcp.slack.com/mcp", gt = "1601185624273.8899143856786", _t = "localhost", vt = 3118, yt = "/callback";
function bt() {
	return `http://${_t}:${vt}${yt}`;
}
function X() {
	return e.join(Tt(), "opencode", "mcp-auth.json");
}
function Z() {
	try {
		let e = X();
		if (!n.existsSync(e)) return null;
		let t = n.readFileSync(e, "utf8");
		return JSON.parse(t);
	} catch {
		return null;
	}
}
function Q(t) {
	let r = X();
	n.mkdirSync(e.dirname(r), { recursive: !0 }), n.writeFileSync(r, JSON.stringify(t, null, 2));
}
function xt() {
	let e = Z();
	if (!e) return {
		connected: !1,
		pendingAuthorization: !1
	};
	let t = e.slack;
	if (!t || typeof t != "object") return {
		connected: !1,
		pendingAuthorization: !1
	};
	let n = t, r = [
		n.tokens?.accessToken,
		n.tokens?.refreshToken,
		n.refreshToken,
		n.accessToken,
		n.refresh,
		n.access
	].some((e) => typeof e == "string" && e.trim().length > 0);
	return {
		connected: r,
		pendingAuthorization: !r && typeof n.oauthState == "string" && n.oauthState.trim().length > 0 && typeof n.codeVerifier == "string" && n.codeVerifier.trim().length > 0
	};
}
function St(e) {
	let t = Z() ?? {};
	t.slack = {
		codeVerifier: e.codeVerifier,
		oauthState: e.oauthState,
		serverUrl: Y
	}, Q(t);
}
function Ct(e) {
	let t = Z() ?? {};
	t.slack = {
		tokens: {
			accessToken: e.accessToken,
			refreshToken: e.refreshToken,
			expiresAt: e.expiresAt ? Math.floor(e.expiresAt / 1e3) : void 0,
			scope: e.scope
		},
		serverUrl: Y
	}, Q(t);
}
function wt() {
	let e = Z();
	e && (delete e.slack, Q(e));
}
y({ prefix: "OpenCodeAuth" });
function Tt() {
	return process.env.XDG_DATA_HOME || e.join(te.homedir(), ".local", "share");
}
//#endregion
//#region ../../packages/agent-core/src/opencode/cli-path-utils.ts
var Et = y({ prefix: "CLIResolver" }), Dt = "opencode-windows-x64", Ot = "opencode-windows-x64-baseline", kt = "opencode-linux-x64", At = "opencode-linux-x64-baseline", jt = "opencode-linux-x64-musl", Mt = "opencode-linux-x64-baseline-musl", Nt = "opencode-linux-arm64", Pt = "opencode-linux-arm64-musl", Ft = "opencode-ai", $ = null;
function It() {
	for (let e of [
		"powershell.exe",
		"pwsh.exe",
		"pwsh",
		"powershell"
	]) try {
		let t = ee(e, [
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			"(Add-Type -MemberDefinition \"[DllImport(\"\"kernel32.dll\"\")] public static extern bool IsProcessorFeaturePresent(int ProcessorFeature);\" -Name Kernel32 -Namespace Win32 -PassThru)::IsProcessorFeaturePresent(40)"
		], {
			encoding: "utf-8",
			timeout: 3e3,
			stdio: [
				"ignore",
				"pipe",
				"ignore"
			],
			windowsHide: !0
		});
		if (t.status !== 0) continue;
		let n = (t.stdout ?? "").trim().toLowerCase();
		if (n === "true" || n === "1") return !0;
		if (n === "false" || n === "0") return !1;
	} catch {
		continue;
	}
	return !1;
}
function Lt() {
	return $ || ($ = It() ? [Dt, Ot] : [Ot, Dt], $);
}
function Rt() {
	return process.arch === "arm64" ? [Nt, Pt] : [
		kt,
		At,
		jt,
		Mt
	];
}
function zt() {
	return process.platform === "win32" ? {
		packageNames: Lt(),
		binaryName: "opencode.exe"
	} : process.platform === "linux" ? {
		packageNames: Rt(),
		binaryName: "opencode"
	} : {
		packageNames: ["opencode-ai"],
		binaryName: "opencode"
	};
}
function Bt(e) {
	let n = [];
	if (process.env.APP_ROOT && n.push(t.resolve(process.env.APP_ROOT)), e) {
		let r = t.resolve(e);
		n.push(r), n.push(t.resolve(r, "..")), n.push(t.resolve(r, "..", ".."));
	}
	return [...new Set(n)];
}
function Vt(e, n) {
	let i = t.join(e, Ft);
	if (!r.existsSync(i)) return null;
	let a = new Set([e]);
	try {
		let e = r.realpathSync(i);
		a.add(t.dirname(e));
	} catch {}
	for (let e of a) for (let i of n) {
		let n = t.join(e, i, "bin", "opencode.exe");
		if (r.existsSync(n)) return Et.info(`[CLI Resolver] Using OpenCode CLI executable via launcher package: ${n}`), {
			cliPath: n,
			cliDir: t.dirname(n),
			source: "local"
		};
	}
	return null;
}
//#endregion
//#region ../../packages/agent-core/src/opencode/cli-resolver.ts
var Ht = y({ prefix: "CLIResolver" });
function Ut(e) {
	let { packageNames: n, binaryName: i } = zt(), a = t.join(e, "app.asar.unpacked", "node_modules");
	for (let e of n) {
		let n = t.join(a, e, "bin", i);
		if (r.existsSync(n)) return {
			cliPath: n,
			cliDir: t.dirname(n),
			source: "bundled"
		};
	}
	if (process.platform === "win32") {
		let e = Vt(a, n);
		if (e) return e;
	}
	return null;
}
function Wt(e) {
	let n = Bt(e), { packageNames: i, binaryName: a } = zt();
	for (let e of n) {
		if (process.platform === "win32") {
			for (let n of i) {
				let i = t.join(e, "node_modules", n, "bin", a);
				if (r.existsSync(i)) return Ht.info(`[CLI Resolver] Using local OpenCode CLI executable: ${i}`), {
					cliPath: i,
					cliDir: t.dirname(i),
					source: "local"
				};
			}
			let n = Vt(t.join(e, "node_modules"), i);
			if (n) return n;
			continue;
		}
		let n = t.join(e, "node_modules", ".bin", a);
		if (r.existsSync(n)) return Ht.info(`[CLI Resolver] Using local OpenCode CLI executable: ${n}`), {
			cliPath: n,
			cliDir: t.dirname(n),
			source: "local"
		};
	}
	return null;
}
function Gt(e) {
	let { isPackaged: t, resourcesPath: n, appPath: r } = e;
	return t && n ? Ut(n) : t ? null : Wt(r);
}
function Kt(e) {
	return Gt(e) !== null;
}
//#endregion
//#region ../../packages/agent-core/src/utils/redact.ts
var qt = [
	/sk-[a-zA-Z0-9]{20,}/g,
	/xai-[a-zA-Z0-9]{20,}/g,
	/AIza[a-zA-Z0-9_-]{35}/g,
	/AKIA[A-Z0-9]{16}/g,
	/(?:api[_-]?key|apikey|secret|token|password|credential)['":\s]*[=:]\s*['"]?([a-zA-Z0-9_-]{16,})['"]?/gi,
	/Bearer\s+[a-zA-Z0-9._-]+/gi,
	/(?:secret|password|key)['":\s]*[=:]\s*['"]?([A-Za-z0-9+/=]{32,})['"]?/gi
];
function Jt(e) {
	let t = e;
	for (let e of qt) t = t.replace(e, (e) => `${e.slice(0, 4)}[REDACTED]`);
	return t;
}
y({ prefix: "BundledNode" });
function Yt(t) {
	if (!t.appPath) return null;
	let r = `${t.platform}-${t.arch}`, i = e.resolve(t.appPath), a = [
		process.env.APP_ROOT ? e.join(process.env.APP_ROOT, "resources", "nodejs", r) : null,
		e.join(i, "resources", "nodejs", r),
		e.join(i, "..", "resources", "nodejs", r),
		e.join(i, "..", "..", "resources", "nodejs", r)
	].filter((e) => !!e), o = t.platform === "win32" ? "node.exe" : e.join("bin", "node");
	for (let t of a) {
		if (!n.existsSync(t)) continue;
		let r = e.join(t, o);
		if (n.existsSync(r)) return t;
		try {
			let r = n.readdirSync(t, { withFileTypes: !0 });
			for (let i of r) {
				if (!i.isDirectory()) continue;
				let r = e.join(t, i.name), a = e.join(r, o);
				if (n.existsSync(a)) return r;
			}
		} catch {}
	}
	return null;
}
function Xt(t) {
	let r = t.platform === "win32", i = r ? ".exe" : "", a = r ? ".cmd" : "", o = null;
	if (t.isPackaged) {
		if (!t.resourcesPath) return null;
		let i = `${t.platform}-${t.arch}`, a = e.join(t.resourcesPath, "nodejs", i), s = r ? "node.exe" : e.join("bin", "node");
		if (n.existsSync(e.join(a, s))) o = a;
		else try {
			let t = n.readdirSync(a, { withFileTypes: !0 });
			for (let r of t) {
				if (!r.isDirectory()) continue;
				let t = e.join(a, r.name);
				if (n.existsSync(e.join(t, s))) {
					o = t;
					break;
				}
			}
		} catch {}
	} else o = Yt(t);
	if (!o) return null;
	let s = r ? o : e.join(o, "bin");
	return {
		nodePath: e.join(s, `node${i}`),
		npmPath: e.join(s, `npm${a}`),
		npxPath: e.join(s, `npx${a}`),
		binDir: s,
		nodeDir: o
	};
}
function Zt(e) {
	let t = Xt(e);
	if (t && n.existsSync(t.nodePath)) return t.nodePath;
	throw Error(`[Bundled Node] Bundled Node.js not found at ${t?.nodePath ?? "(unknown path)"}. Run "pnpm -F @accomplish/desktop download:nodejs" and rebuild required artifacts.`);
}
y({ prefix: "Browser" });
function Qt(e) {
	try {
		if (process.platform === "win32") {
			let t = u("netstat", ["-ano"], { encoding: "utf8" });
			for (let n of t.split("\n")) if (n.includes(`:${e} `) && n.includes("LISTENING")) {
				let e = n.trim().split(/\s+/).pop();
				e && /^\d+$/.test(e) && u("taskkill", [
					"/PID",
					e,
					"/F"
				], { stdio: "ignore" });
			}
		} else {
			let t = u("lsof", [
				"-t",
				"-i",
				`tcp:${e}`,
				"-sTCP:LISTEN"
			], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
			for (let e of t) process.kill(parseInt(e, 10), "SIGTERM");
		}
	} catch {}
}
async function $t(e) {
	let { devBrowserPort: t, devBrowserCdpPort: n } = e, r = !1;
	try {
		r = (await fetch(`http://127.0.0.1:${t}/shutdown`, {
			method: "POST",
			signal: AbortSignal.timeout(3e3)
		})).ok;
	} catch {}
	r && await new Promise((e) => setTimeout(e, 2e3)), Qt(t), n && Qt(n);
}
//#endregion
//#region ../../packages/agent-core/src/common/constants.ts
var en = 9224, tn = 9225, nn = 50 * 1024 * 1024, rn = 5e3, an = {
	opencode: [/^\[TaskManager\]/, /^\[OpenCode/],
	browser: [/^\[DevBrowser/, /^\[Playwright/],
	mcp: [/^\[MCP\]/, /MCP server/],
	ipc: [/^\[IPC\]/],
	main: [],
	env: [],
	daemon: []
};
function on(e) {
	for (let [t, n] of Object.entries(an)) if (n.some((t) => t.test(e))) return t;
	return "main";
}
//#endregion
//#region ../../packages/agent-core/src/common/utils/id.ts
function sn() {
	return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
function cn() {
	return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
//#endregion
export { x as $, dt as A, I as B, xt as C, pt as D, ht as E, nt as F, ze as G, We as H, $e as I, Pe as J, Ie as K, Qe as L, ot as M, rt as N, mt as O, it as P, S as Q, Ze as R, bt as S, Ct as T, P as U, L as V, Be as W, E as X, T as Y, w as Z, vt as _, ie as _t, tn as a, g as at, wt as b, nn as c, ue as ct, Zt as d, p as dt, Ee as et, Jt as f, ce as ft, yt as g, re as gt, _t as h, ae as ht, on as i, y as it, ut as j, G as k, $t as l, m as lt, Gt as m, oe as mt, sn as n, ye as nt, en as o, ge as ot, Kt as p, se as pt, Ne as q, an as r, ve as rt, rn as s, h as st, cn as t, Te as tt, Xt as u, de as ut, gt as v, ne as vt, St as w, X as x, Y as y, F as z };

//# sourceMappingURL=id-BEgm5sXn.js.map