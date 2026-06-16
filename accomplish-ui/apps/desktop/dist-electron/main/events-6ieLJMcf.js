import { t as getLogCollector } from "./logging-ZKSN6tdj.js";
import { c as getSessionTaskCount, f as isFirstTaskCompleted, l as incrementTaskCount, m as trackEvent, o as getFirstSeenAt, p as markFirstTaskCompleted, s as getSessionDuration } from "./analytics-service-BFn-2QoE.js";
import { nativeTheme } from "electron";
//#region src/main/daemon/daemon-lifecycle.ts
var client = null;
function setClient(c) {
	client = c;
}
function setMode(m) {}
/**
* Get the daemon client. Throws if not bootstrapped.
*/
function getDaemonClient() {
	if (!client) throw new Error("Daemon not bootstrapped. Call bootstrapDaemon() first.");
	return client;
}
/**
* Shut down the daemon client connection.
* IMPORTANT: This only closes the socket — it does NOT kill the daemon process.
* The daemon is designed to survive Electron exit.
*/
function shutdownDaemon() {
	if (client) {
		client.close();
		client = null;
	}
	try {
		const l = getLogCollector();
		if (l?.log) l.log("INFO", "daemon", "[DaemonLifecycle] Daemon client disconnected");
	} catch {}
}
//#endregion
//#region src/main/store/secureStorage.ts
/**
* SecureStorage RPC façade.
*
* Milestone 3 of the daemon-only-SQLite migration
* (plan: /Users/yanai/.claude/plans/squishy-exploring-hamster.md).
*
* Before M3: this module held a local `StorageAPI` singleton constructed
* via `createStorage()`, which wrote directly to `secure-storage.json`.
* Both Electron main and the daemon touched the same file, which caused
* the concurrent-writer hazard M2/M3 are meant to fix.
*
* After M3: every function here is a thin wrapper around a `secrets.*`
* daemon RPC. Main no longer opens or writes the secure-storage file —
* the daemon is the sole writer, and main talks to it over the socket.
*
* Signature changes vs. the pre-M3 module:
*
*   - `storeApiKey`, `getApiKey`, `deleteApiKey`, `getBedrockCredentials`,
*     and `storeBedrockCredentials` are now **async**. The wire format is
*     JSON-RPC over a Unix socket / named pipe; there is no synchronous
*     way to reach the daemon's storage. Existing sync callers must be
*     converted to `await`.
*   - `getAllApiKeys` and `hasAnyApiKey` were already async — unchanged.
*   - `clearSecureStorage` stays synchronous but is now a no-op: main
*     holds no local secret state, so there is nothing to clear here.
*     The CLEAN_START flow at app launch deletes userData before the
*     daemon is spawned, which wipes the secure-storage file on disk;
*     this function's sole historical purpose was in-memory singleton
*     reset, which the RPC façade made obsolete.
*
* Startup ordering constraint: every `secrets.*` call routes through
* `getDaemonClient()`, which throws until `bootstrapDaemon()` resolves.
* `app-startup.ts` defers every early secret-reader (provider validation,
* analytics launch-event enrichment) until after the bootstrap await.
*/
async function storeApiKey(provider, apiKey) {
	await getDaemonClient().call("secrets.storeApiKey", {
		provider,
		apiKey
	});
}
async function getApiKey(provider) {
	return getDaemonClient().call("secrets.getApiKey", { provider });
}
async function deleteApiKey(provider) {
	return getDaemonClient().call("secrets.deleteApiKey", { provider });
}
async function getAllApiKeys() {
	return getDaemonClient().call("secrets.getAllApiKeys");
}
async function getBedrockCredentials() {
	return getDaemonClient().call("secrets.getBedrockCredentials");
}
async function hasAnyApiKey() {
	return getDaemonClient().call("secrets.hasAnyApiKey");
}
/**
* No-op since M3. The pre-M3 implementation reset an in-memory `StorageAPI`
* singleton in main; main no longer owns that state. The only legitimate
* caller (CLEAN_START at `index.ts`) runs BEFORE daemon spawn anyway —
* reaching for the daemon here would fail. Keeping the export + sync
* signature so existing CLEAN_START code doesn't need changes.
*/
function clearSecureStorage() {}
//#endregion
//#region src/main/analytics/error-classifier.ts
/**
* Classify a raw error name/message into a standardized TaskErrorCategory.
* Maps log-watcher error names and common Error.name values.
*/
function classifyErrorCategory(errorName) {
	const name = String(errorName).toLowerCase();
	if (name.includes("auth") || name.includes("oauth") || name.includes("unauthorized") || name.includes("accessdenied") || name.includes("invalidsignature")) return "auth_error";
	if (name.includes("throttl") || name.includes("rate_limit") || name.includes("ratelimit") || name.includes("429")) return "rate_limit";
	if (name.includes("timeout") || name === "aborterror") return "timeout";
	if (name.includes("network") || name.includes("econnrefused") || name.includes("enotfound") || name.includes("503")) return "network_error";
	if (name.includes("contextoverflowerror") || name.includes("n_keep") || name.includes("n_ctx") || name.includes("context window is too small") || name.includes("context size has been exceeded") || name.includes("exceeds the available context size")) return "context_overflow";
	if (name.includes("interrupt") || name.includes("cancel") || name.includes("abort")) return "user_interrupted";
	if (name.includes("tool_error") || name.includes("validation")) return "tool_error";
	return "unknown";
}
//#endregion
//#region src/main/analytics/events.ts
/**
* Typed analytics event helpers — wraps trackEvent() with specific event names
* and typed parameters. Ported from commercial, with enterprise-only code removed.
*
* All events no-op when analytics is disabled (no build.env → isAnalyticsEnabled() = false).
*/
/**
* Track app launch — fires once per session, right after initAnalytics().
* @param isFirstLaunch true if this is the very first app launch (clientId was just created)
*/
async function trackAppLaunched(isFirstLaunch) {
	const firstSeen = getFirstSeenAt();
	const timeSinceInstallS = firstSeen ? Math.floor((Date.now() - new Date(firstSeen).getTime()) / 1e3) : 0;
	const keys = await getAllApiKeys();
	const connectedCount = Object.values(keys).filter((v) => v !== null).length;
	trackEvent("app_launched", {
		event_category: "app_lifecycle",
		launch_type: isFirstLaunch ? "cold" : "warm",
		time_since_install_s: timeSinceInstallS,
		connected_providers_count: connectedCount,
		theme: nativeTheme.shouldUseDarkColors ? "dark" : "light"
	});
}
/**
* Track app crash — best-effort, fires from uncaughtException / unhandledRejection handlers.
* Rate-limited to MAX_CRASH_EVENTS per CRASH_WINDOW_MS to prevent hotshard flooding
* from crash loops.
*/
var CRASH_WINDOW_MS = 6e4;
var MAX_CRASH_EVENTS = 5;
var crashTimestamps = [];
function trackAppCrash(errorType, errorMessage) {
	const now = Date.now();
	while (crashTimestamps.length > 0 && now - crashTimestamps[0] >= CRASH_WINDOW_MS) crashTimestamps.shift();
	if (crashTimestamps.length >= MAX_CRASH_EVENTS) return;
	crashTimestamps.push(now);
	trackEvent("app_crash", {
		event_category: "app_lifecycle",
		error_type: errorType,
		error_message: errorMessage.substring(0, 500)
	});
}
function trackPageView(pagePath, pageTitle) {
	trackEvent("page_view", {
		page_path: pagePath,
		page_title: pageTitle,
		event_category: "navigation"
	});
}
function trackSubmitTask(model, provider) {
	trackEvent("submit_task", {
		event_category: "engagement",
		model,
		provider
	});
}
function trackNewTask() {
	trackEvent("new_task", { event_category: "engagement" });
}
function trackOpenSettings() {
	trackEvent("open_settings", { event_category: "engagement" });
}
function trackSaveApiKey(provider, success, connectionMethod) {
	trackEvent("save_api_key", {
		event_category: "settings",
		provider,
		success,
		...connectionMethod && { connection_method: connectionMethod }
	});
}
function trackSelectProvider(provider) {
	trackEvent("select_provider", {
		event_category: "settings",
		provider
	});
}
function trackSelectModel(model, provider) {
	trackEvent("select_model", {
		event_category: "settings",
		model,
		provider
	});
}
function trackToggleDebugMode(enabled) {
	trackEvent("toggle_debug_mode", {
		event_category: "settings",
		enabled
	});
}
function trackUpdateCheck() {
	trackEvent("update_check", { event_category: "updates" });
}
function trackUpdateAvailable(currentVersion, newVersion) {
	trackEvent("update_available", {
		event_category: "updates",
		current_version: currentVersion,
		new_version: newVersion
	});
}
function trackUpdateNotAvailable() {
	trackEvent("update_not_available", { event_category: "updates" });
}
function trackUpdateDownloadStart(newVersion) {
	trackEvent("update_download_start", {
		event_category: "updates",
		new_version: newVersion
	});
}
function trackUpdateDownloadComplete(newVersion) {
	trackEvent("update_download_complete", {
		event_category: "updates",
		new_version: newVersion
	});
}
function trackUpdateInstallStart(newVersion) {
	trackEvent("update_install_start", {
		event_category: "updates",
		new_version: newVersion
	});
}
function trackUpdateFailed(errorType, errorMessage) {
	trackEvent("update_failed", {
		event_category: "updates",
		error_type: errorType,
		error_message: errorMessage
	});
}
function trackTaskStart(context, model, provider) {
	incrementTaskCount();
	trackEvent("task_start", {
		event_category: "task_lifecycle",
		task_id: context.taskId,
		opencode_session_id: context.sessionId,
		task_type: context.taskType,
		model,
		provider
	});
}
function trackTaskComplete(context, durationMs, totalSteps, hadErrors, model, totalTokens, totalCost, provider) {
	try {
		trackEvent("task_complete", {
			event_category: "task_lifecycle",
			task_id: context.taskId,
			opencode_session_id: context.sessionId,
			task_type: context.taskType,
			duration_ms: durationMs,
			total_steps: totalSteps,
			had_errors: hadErrors,
			model,
			provider,
			tokens_input: totalTokens?.input,
			tokens_output: totalTokens?.output,
			tokens_reasoning: totalTokens?.reasoning,
			tokens_cache_read: totalTokens?.cache_read,
			tokens_cache_write: totalTokens?.cache_write,
			cost_usd: totalCost
		});
		if (!isFirstTaskCompleted()) {
			const firstSeen = getFirstSeenAt();
			const daysSinceInstall = firstSeen ? Math.floor((Date.now() - new Date(firstSeen).getTime()) / 864e5) : 0;
			trackEvent("first_task_complete", {
				event_category: "activation",
				task_id: context.taskId,
				opencode_session_id: context.sessionId,
				task_type: context.taskType,
				days_since_install: daysSinceInstall,
				model,
				provider
			});
			markFirstTaskCompleted();
		}
	} catch (error) {
		console.error("[Analytics] Failed to track task complete:", error);
	}
}
function trackTaskError(context, durationMs, totalSteps, errorType, model, totalTokens, totalCost, provider, failureReason) {
	trackEvent("task_error", {
		event_category: "task_lifecycle",
		task_id: context.taskId,
		opencode_session_id: context.sessionId,
		task_type: context.taskType,
		duration_ms: durationMs,
		total_steps: totalSteps,
		error_type: errorType,
		model,
		provider,
		tokens_input: totalTokens?.input,
		tokens_output: totalTokens?.output,
		tokens_reasoning: totalTokens?.reasoning,
		tokens_cache_read: totalTokens?.cache_read,
		tokens_cache_write: totalTokens?.cache_write,
		cost_usd: totalCost,
		failure_reason: failureReason ? failureReason.slice(0, 500) : void 0
	});
}
function trackPermissionRequested(context, permissionType, model, provider) {
	trackEvent("permission_requested", {
		event_category: "task_lifecycle",
		task_id: context.taskId,
		opencode_session_id: context.sessionId,
		task_type: context.taskType,
		permission_type: permissionType,
		model,
		provider
	});
}
function trackPermissionResponse(context, permissionType, granted, model, provider) {
	trackEvent("permission_response", {
		event_category: "task_lifecycle",
		task_id: context.taskId,
		opencode_session_id: context.sessionId,
		task_type: context.taskType,
		permission_type: permissionType,
		granted,
		model,
		provider
	});
}
function trackToolUsed(context, toolName, model, provider) {
	trackEvent("tool_used", {
		event_category: "task_lifecycle",
		task_id: context.taskId,
		opencode_session_id: context.sessionId,
		task_type: context.taskType,
		tool_name: toolName,
		model,
		provider
	});
}
function trackUserInteraction(context, interactionType, usedSuggestion, model, provider) {
	trackEvent("user_interaction", {
		event_category: "task_lifecycle",
		task_id: context.taskId,
		opencode_session_id: context.sessionId,
		task_type: context.taskType,
		interaction_type: interactionType,
		used_suggestion: usedSuggestion,
		model,
		provider
	});
}
async function trackAppClose() {
	const keys = await getAllApiKeys();
	const connectedCount = Object.values(keys).filter((v) => v !== null).length;
	trackEvent("app_close", {
		event_category: "session",
		duration_seconds: getSessionDuration(),
		task_count: getSessionTaskCount(),
		connected_providers_count: connectedCount
	});
}
function trackAppBackgrounded() {
	trackEvent("app_backgrounded", { event_category: "session" });
}
function trackAppForegrounded() {
	trackEvent("app_foregrounded", { event_category: "session" });
}
function trackModelSelectionStep(step, isOnboarding, provider, model) {
	trackEvent("model_selection_step", {
		event_category: "model_selection",
		step,
		is_onboarding: isOnboarding,
		provider,
		model
	});
}
function trackModelSelectionComplete(provider, isOnboarding, model) {
	trackEvent("model_selection_complete", {
		event_category: "model_selection",
		provider,
		is_onboarding: isOnboarding,
		model
	});
}
function trackModelSelectionAbandoned(lastStep, isOnboarding) {
	trackEvent("model_selection_abandoned", {
		event_category: "model_selection",
		last_step: lastStep,
		is_onboarding: isOnboarding
	});
}
function trackHistoryViewed() {
	trackEvent("history_viewed", { event_category: "feature_usage" });
}
function trackTaskFromHistory() {
	trackEvent("task_from_history", { event_category: "feature_usage" });
}
function trackHistoryCleared() {
	trackEvent("history_cleared", { event_category: "feature_usage" });
}
function trackTaskDetailsExpanded() {
	trackEvent("task_details_expanded", { event_category: "feature_usage" });
}
function trackOutputCopied() {
	trackEvent("output_copied", { event_category: "feature_usage" });
}
function trackProviderDisconnected(provider) {
	trackEvent("provider_disconnected", {
		event_category: "settings",
		provider
	});
}
function trackHelpLinkClicked(provider) {
	trackEvent("help_link_clicked", {
		event_category: "settings",
		provider
	});
}
function trackSkillAction(params) {
	trackEvent("skill_action", {
		event_category: "feature_usage",
		...params
	});
}
function trackSaveVoiceApiKey(success) {
	trackEvent("save_voice_api_key", {
		event_category: "settings",
		success
	});
}
function trackExportLogs() {
	trackEvent("export_logs", { event_category: "feature_usage" });
}
function trackThreadExported() {
	trackEvent("thread_exported", { event_category: "feature_usage" });
}
function trackTaskLauncherAction(action) {
	trackEvent("task_launcher_action", {
		event_category: "feature_usage",
		action
	});
}
function trackTaskFeedback(taskId, sessionId, rating, taskStatus, feedbackStage, model, provider, feedbackReason, feedbackText) {
	trackEvent("task_feedback", {
		event_category: "task_lifecycle",
		task_id: taskId,
		opencode_session_id: sessionId,
		rating,
		task_status: taskStatus,
		feedback_stage: feedbackStage,
		model,
		provider,
		feedback_reason: feedbackReason,
		feedback_text: feedbackText?.substring(0, 500)
	});
}
function trackStopAgent(taskId, sessionId) {
	trackEvent("stop_agent", {
		event_category: "task_lifecycle",
		task_id: taskId,
		opencode_session_id: sessionId
	});
}
function trackProviderBoxClicked(params) {
	trackEvent("provider_box_clicked", {
		event_category: "model_selection",
		...params
	});
}
//#endregion
export { storeApiKey as $, trackTaskError as A, trackUpdateDownloadComplete as B, trackSelectModel as C, trackSubmitTask as D, trackStopAgent as E, trackThreadExported as F, trackUserInteraction as G, trackUpdateFailed as H, trackToggleDebugMode as I, deleteApiKey as J, classifyErrorCategory as K, trackToolUsed as L, trackTaskFromHistory as M, trackTaskLauncherAction as N, trackTaskComplete as O, trackTaskStart as P, hasAnyApiKey as Q, trackUpdateAvailable as R, trackSaveVoiceApiKey as S, trackSkillAction as T, trackUpdateInstallStart as U, trackUpdateDownloadStart as V, trackUpdateNotAvailable as W, getApiKey as X, getAllApiKeys as Y, getBedrockCredentials as Z, trackPermissionRequested as _, trackAppLaunched as a, trackProviderDisconnected as b, trackHistoryCleared as c, trackModelSelectionComplete as d, getDaemonClient as et, trackModelSelectionStep as f, trackPageView as g, trackOutputCopied as h, trackAppForegrounded as i, trackTaskFeedback as j, trackTaskDetailsExpanded as k, trackHistoryViewed as l, trackOpenSettings as m, trackAppClose as n, setMode as nt, trackExportLogs as o, trackNewTask as p, clearSecureStorage as q, trackAppCrash as r, shutdownDaemon as rt, trackHelpLinkClicked as s, trackAppBackgrounded as t, setClient as tt, trackModelSelectionAbandoned as u, trackPermissionResponse as v, trackSelectProvider as w, trackSaveApiKey as x, trackProviderBoxClicked as y, trackUpdateCheck as z };

//# sourceMappingURL=events-6ieLJMcf.js.map