import { t as getLogCollector } from "./logging-ZKSN6tdj.js";
import { shell } from "electron";
import crypto from "node:crypto";
import http from "node:http";
//#region src/main/google-accounts/constants.ts
var GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
var GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
var GOOGLE_USERINFO_EP = "https://www.googleapis.com/oauth2/v3/userinfo";
var GOOGLE_OAUTH_SCOPES = [
	"openid",
	"email",
	"profile",
	"https://www.googleapis.com/auth/drive.file",
	"https://www.googleapis.com/auth/gmail.modify",
	"https://www.googleapis.com/auth/gmail.send",
	"https://www.googleapis.com/auth/calendar.events"
];
var OAUTH_CALLBACK_PORT_PRIMARY = 4567;
var OAUTH_CALLBACK_PORT_FALLBACK = 4568;
//#endregion
//#region src/main/google-accounts/google-auth.ts
/**
* Google OAuth2 PKCE flow for connecting a Google account.
*
* Requires GOOGLE_CLIENT_ID env var — set this in your .env or CI/CD secrets.
* Without it, the OAuth redirect will fail at the Google consent screen.
*/
var OAUTH_FLOW_TTL_MS = 600 * 1e3;
var pendingFlows = /* @__PURE__ */ new Map();
function b64url(buf) {
	return buf.toString("base64url");
}
function startCallbackServer(port, _state) {
	return new Promise((resolve, reject) => {
		const server = http.createServer();
		server.listen(port, "127.0.0.1", () => resolve(server));
		server.on("error", reject);
	});
}
async function startGoogleOAuth(label) {
	const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
	if (!clientId) getLogCollector().log("WARN", "main", "GOOGLE_CLIENT_ID is not set — OAuth will fail");
	const codeVerifier = b64url(crypto.randomBytes(32));
	const codeChallenge = b64url(crypto.createHash("sha256").update(codeVerifier).digest());
	const state = crypto.randomUUID();
	let port = OAUTH_CALLBACK_PORT_PRIMARY;
	let server;
	try {
		server = await startCallbackServer(OAUTH_CALLBACK_PORT_PRIMARY, state);
	} catch {
		server = await startCallbackServer(OAUTH_CALLBACK_PORT_FALLBACK, state);
		port = OAUTH_CALLBACK_PORT_FALLBACK;
	}
	const redirectUri = `http://127.0.0.1:${port}/callback`;
	const authUrl = `${GOOGLE_AUTH_ENDPOINT}?${new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: "code",
		scope: GOOGLE_OAUTH_SCOPES.join(" "),
		state,
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
		access_type: "offline",
		prompt: "consent"
	}).toString()}`;
	const waitForCallback = () => new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			pendingFlows.delete(state);
			server.close();
			reject(/* @__PURE__ */ new Error("Google OAuth timed out"));
		}, OAUTH_FLOW_TTL_MS);
		server.on("request", async (req, res) => {
			try {
				const url = new URL(req.url ?? "", `http://127.0.0.1:${port}`);
				if (url.pathname !== "/callback") {
					res.writeHead(404).end();
					return;
				}
				const errorParam = url.searchParams.get("error");
				if (errorParam) {
					res.writeHead(400, { "Content-Type": "text/html" }).end("<html><body><h2>Authentication cancelled. You can close this tab.</h2></body></html>");
					clearTimeout(timeout);
					server.close();
					pendingFlows.delete(state);
					reject(/* @__PURE__ */ new Error(`OAuth error: ${errorParam}`));
					return;
				}
				const code = url.searchParams.get("code");
				const returnedState = url.searchParams.get("state");
				if (!code || returnedState !== state) {
					res.writeHead(400).end("Bad request");
					return;
				}
				res.writeHead(200, { "Content-Type": "text/html" }).end("<html><body><h2>Connected! You can close this tab.</h2></body></html>");
				clearTimeout(timeout);
				server.close();
				pendingFlows.delete(state);
				const result = await exchangeCodeForResult(code, codeVerifier, redirectUri, clientId, label);
				getLogCollector().log("INFO", "main", "Google account connected", { googleAccountId: result.googleAccountId });
				resolve(result);
			} catch (err) {
				clearTimeout(timeout);
				server.close();
				pendingFlows.delete(state);
				getLogCollector().log("ERROR", "main", "Google OAuth callback error", { error: String(err) });
				reject(err instanceof Error ? err : new Error(String(err)));
			}
		});
		pendingFlows.set(state, {
			resolve: () => {},
			reject,
			codeVerifier,
			server,
			createdAt: Date.now()
		});
	});
	try {
		await shell.openExternal(authUrl);
	} catch (err) {
		server.close();
		throw err;
	}
	return {
		state,
		authUrl,
		waitForCallback
	};
}
function cancelGoogleOAuth(state) {
	const flow = pendingFlows.get(state);
	if (!flow) return;
	pendingFlows.delete(state);
	flow.server.close();
	flow.reject(/* @__PURE__ */ new Error("OAuth cancelled by user"));
}
async function exchangeCodeForResult(code, codeVerifier, redirectUri, clientId, _label) {
	const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code,
			client_id: clientId,
			redirect_uri: redirectUri,
			code_verifier: codeVerifier,
			grant_type: "authorization_code"
		}).toString()
	});
	if (!tokenRes.ok) {
		const body = await tokenRes.text();
		throw new Error(`Token exchange failed (${tokenRes.status}): ${body}`);
	}
	const tokenData = await tokenRes.json();
	if (!tokenData.refresh_token || tokenData.refresh_token.trim() === "") throw new Error("Google did not return a refresh token. Please revoke access at https://myaccount.google.com/permissions and try connecting again.");
	const token = {
		accessToken: tokenData.access_token,
		refreshToken: tokenData.refresh_token,
		expiresAt: Date.now() + tokenData.expires_in * 1e3,
		scopes: tokenData.scope.split(" ")
	};
	const infoRes = await fetch(GOOGLE_USERINFO_EP, { headers: { Authorization: `Bearer ${token.accessToken}` } });
	if (!infoRes.ok) throw new Error(`Userinfo fetch failed (${infoRes.status})`);
	const info = await infoRes.json();
	return {
		googleAccountId: info.sub,
		email: info.email,
		displayName: info.name,
		pictureUrl: info.picture ?? null,
		token
	};
}
//#endregion
export { cancelGoogleOAuth, startGoogleOAuth };

//# sourceMappingURL=google-accounts-CfO8X_jJ.js.map