import { t as e } from "./logging-CWK-J2W5.js";
import { shell as t } from "electron";
import n from "node:crypto";
import r from "node:http";
//#region src/main/google-accounts/constants.ts
var i = "https://accounts.google.com/o/oauth2/v2/auth", a = "https://oauth2.googleapis.com/token", o = "https://www.googleapis.com/oauth2/v3/userinfo", s = [
	"openid",
	"email",
	"profile",
	"https://www.googleapis.com/auth/drive.file",
	"https://www.googleapis.com/auth/gmail.modify",
	"https://www.googleapis.com/auth/gmail.send",
	"https://www.googleapis.com/auth/calendar.events"
], c = 4567, l = 4568, u = 600 * 1e3, d = /* @__PURE__ */ new Map();
function f(e) {
	return e.toString("base64url");
}
function p(e, t) {
	return new Promise((t, n) => {
		let i = r.createServer();
		i.listen(e, "127.0.0.1", () => t(i)), i.on("error", n);
	});
}
async function m(r) {
	let a = process.env.GOOGLE_CLIENT_ID ?? "";
	a || e().log("WARN", "main", "GOOGLE_CLIENT_ID is not set — OAuth will fail");
	let o = f(n.randomBytes(32)), m = f(n.createHash("sha256").update(o).digest()), h = n.randomUUID(), _ = c, v;
	try {
		v = await p(c, h);
	} catch {
		v = await p(l, h), _ = l;
	}
	let y = `http://127.0.0.1:${_}/callback`, b = `${i}?${new URLSearchParams({
		client_id: a,
		redirect_uri: y,
		response_type: "code",
		scope: s.join(" "),
		state: h,
		code_challenge: m,
		code_challenge_method: "S256",
		access_type: "offline",
		prompt: "consent"
	}).toString()}`, x = () => new Promise((t, n) => {
		let i = setTimeout(() => {
			d.delete(h), v.close(), n(/* @__PURE__ */ Error("Google OAuth timed out"));
		}, u);
		v.on("request", async (s, c) => {
			try {
				let l = new URL(s.url ?? "", `http://127.0.0.1:${_}`);
				if (l.pathname !== "/callback") {
					c.writeHead(404).end();
					return;
				}
				let u = l.searchParams.get("error");
				if (u) {
					c.writeHead(400, { "Content-Type": "text/html" }).end("<html><body><h2>Authentication cancelled. You can close this tab.</h2></body></html>"), clearTimeout(i), v.close(), d.delete(h), n(/* @__PURE__ */ Error(`OAuth error: ${u}`));
					return;
				}
				let f = l.searchParams.get("code"), p = l.searchParams.get("state");
				if (!f || p !== h) {
					c.writeHead(400).end("Bad request");
					return;
				}
				c.writeHead(200, { "Content-Type": "text/html" }).end("<html><body><h2>Connected! You can close this tab.</h2></body></html>"), clearTimeout(i), v.close(), d.delete(h);
				let m = await g(f, o, y, a, r);
				e().log("INFO", "main", "Google account connected", { googleAccountId: m.googleAccountId }), t(m);
			} catch (t) {
				clearTimeout(i), v.close(), d.delete(h), e().log("ERROR", "main", "Google OAuth callback error", { error: String(t) }), n(t instanceof Error ? t : Error(String(t)));
			}
		}), d.set(h, {
			resolve: () => {},
			reject: n,
			codeVerifier: o,
			server: v,
			createdAt: Date.now()
		});
	});
	try {
		await t.openExternal(b);
	} catch (e) {
		throw v.close(), e;
	}
	return {
		state: h,
		authUrl: b,
		waitForCallback: x
	};
}
function h(e) {
	let t = d.get(e);
	t && (d.delete(e), t.server.close(), t.reject(/* @__PURE__ */ Error("OAuth cancelled by user")));
}
async function g(e, t, n, r, i) {
	let s = await fetch(a, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code: e,
			client_id: r,
			redirect_uri: n,
			code_verifier: t,
			grant_type: "authorization_code"
		}).toString()
	});
	if (!s.ok) {
		let e = await s.text();
		throw Error(`Token exchange failed (${s.status}): ${e}`);
	}
	let c = await s.json();
	if (!c.refresh_token || c.refresh_token.trim() === "") throw Error("Google did not return a refresh token. Please revoke access at https://myaccount.google.com/permissions and try connecting again.");
	let l = {
		accessToken: c.access_token,
		refreshToken: c.refresh_token,
		expiresAt: Date.now() + c.expires_in * 1e3,
		scopes: c.scope.split(" ")
	}, u = await fetch(o, { headers: { Authorization: `Bearer ${l.accessToken}` } });
	if (!u.ok) throw Error(`Userinfo fetch failed (${u.status})`);
	let d = await u.json();
	return {
		googleAccountId: d.sub,
		email: d.email,
		displayName: d.name,
		pictureUrl: d.picture ?? null,
		token: l
	};
}
//#endregion
export { h as cancelGoogleOAuth, m as startGoogleOAuth };

//# sourceMappingURL=google-accounts-DNHwI8o6.js.map