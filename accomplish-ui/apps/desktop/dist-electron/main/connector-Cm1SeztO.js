//#region ../../packages/agent-core/src/common/types/connector.ts
var OAuthProviderId = /* @__PURE__ */ function(OAuthProviderId) {
	OAuthProviderId["Slack"] = "slack";
	OAuthProviderId["Google"] = "google";
	OAuthProviderId["Jira"] = "jira";
	OAuthProviderId["GitHub"] = "github";
	OAuthProviderId["Monday"] = "monday";
	OAuthProviderId["Notion"] = "notion";
	OAuthProviderId["Lightdash"] = "lightdash";
	OAuthProviderId["Datadog"] = "datadog";
	return OAuthProviderId;
}({});
function isOAuthProviderId(value) {
	return Object.values(OAuthProviderId).includes(value);
}
//#endregion
export { isOAuthProviderId as n, OAuthProviderId as t };

//# sourceMappingURL=connector-Cm1SeztO.js.map