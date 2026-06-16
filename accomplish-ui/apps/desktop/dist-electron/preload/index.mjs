import { contextBridge as e, ipcRenderer as t, webUtils as n } from "electron";
//#region src/preload/index.ts
var r = (e, ...n) => t.invoke(e, ...n).catch(() => {});
e.exposeInMainWorld("accomplish", {
	getFilePath: (e) => n.getPathForFile(e),
	getVersion: () => t.invoke("app:version"),
	getPlatform: () => t.invoke("app:platform"),
	openExternal: (e) => t.invoke("shell:open-external", e),
	startTask: (e) => t.invoke("task:start", e),
	cancelTask: (e) => t.invoke("task:cancel", e),
	interruptTask: (e) => t.invoke("task:interrupt", e),
	getTask: (e) => t.invoke("task:get", e),
	listTasks: () => t.invoke("task:list"),
	deleteTask: (e) => t.invoke("task:delete", e),
	clearTaskHistory: () => t.invoke("task:clear-history"),
	getTodosForTask: (e) => t.invoke("task:get-todos", e),
	respondToPermission: (e) => t.invoke("permission:respond", e),
	resumeSession: (e, n, r, i) => t.invoke("session:resume", e, n, r, i),
	getApiKeys: () => t.invoke("settings:api-keys"),
	addApiKey: (e, n, r) => t.invoke("settings:add-api-key", e, n, r),
	removeApiKey: (e) => t.invoke("settings:remove-api-key", e),
	getNotificationsEnabled: () => t.invoke("settings:notifications-enabled"),
	setNotificationsEnabled: (e) => t.invoke("settings:set-notifications-enabled", e),
	getDebugMode: () => t.invoke("settings:debug-mode"),
	setDebugMode: (e) => t.invoke("settings:set-debug-mode", e),
	getTheme: () => t.invoke("settings:theme"),
	setTheme: (e) => t.invoke("settings:set-theme", e),
	getLanguage: () => t.invoke("settings:language"),
	setLanguage: (e) => t.invoke("settings:set-language", e),
	onThemeChange: (e) => {
		let n = (t, n) => e(n);
		return t.on("settings:theme-changed", n), () => t.removeListener("settings:theme-changed", n);
	},
	getAppSettings: () => t.invoke("settings:app-settings"),
	getCloudBrowserConfig: () => t.invoke("settings:cloud-browser-config:get"),
	setCloudBrowserConfig: (e) => t.invoke("settings:cloud-browser-config:set", e ? JSON.stringify(e) : null),
	getOpenAiBaseUrl: () => t.invoke("settings:openai-base-url:get"),
	setOpenAiBaseUrl: (e) => t.invoke("settings:openai-base-url:set", e),
	getOpenAiOauthStatus: () => t.invoke("opencode:auth:openai:status"),
	loginOpenAiWithChatGpt: () => t.invoke("opencode:auth:openai:login"),
	getSlackMcpOauthStatus: () => t.invoke("opencode:auth:slack:status"),
	loginSlackMcp: () => t.invoke("opencode:auth:slack:login"),
	logoutSlackMcp: () => t.invoke("opencode:auth:slack:logout"),
	getCopilotOAuthStatus: () => t.invoke("opencode:auth:copilot:status"),
	loginGithubCopilot: () => t.invoke("opencode:auth:copilot:login"),
	logoutGithubCopilot: () => t.invoke("opencode:auth:copilot:logout"),
	hasApiKey: () => t.invoke("api-key:exists"),
	setApiKey: (e) => t.invoke("api-key:set", e),
	getApiKey: () => t.invoke("api-key:get"),
	validateApiKey: (e) => t.invoke("api-key:validate", e),
	validateApiKeyForProvider: (e, n, r) => t.invoke("api-key:validate-provider", e, n, r),
	clearApiKey: () => t.invoke("api-key:clear"),
	getOnboardingComplete: () => t.invoke("onboarding:complete"),
	setOnboardingComplete: (e) => t.invoke("onboarding:set-complete", e),
	checkOpenCodeCli: () => t.invoke("opencode:check"),
	getOpenCodeVersion: () => t.invoke("opencode:version"),
	getSelectedModel: () => t.invoke("model:get"),
	setSelectedModel: (e) => t.invoke("model:set", e),
	getAllApiKeys: () => t.invoke("api-keys:all"),
	hasAnyApiKey: () => t.invoke("api-keys:has-any"),
	testOllamaConnection: (e) => t.invoke("ollama:test-connection", e),
	getOllamaConfig: () => t.invoke("ollama:get-config"),
	setOllamaConfig: (e) => t.invoke("ollama:set-config", e),
	getAzureFoundryConfig: () => t.invoke("azure-foundry:get-config"),
	setAzureFoundryConfig: (e) => t.invoke("azure-foundry:set-config", e),
	testAzureFoundryConnection: (e) => t.invoke("azure-foundry:test-connection", e),
	saveAzureFoundryConfig: (e) => t.invoke("azure-foundry:save-config", e),
	fetchProviderModels: (e, n) => t.invoke("provider:fetch-models", e, n),
	fetchOpenRouterModels: () => t.invoke("openrouter:fetch-models"),
	testLiteLLMConnection: (e, n) => t.invoke("litellm:test-connection", e, n),
	fetchLiteLLMModels: () => t.invoke("litellm:fetch-models"),
	getLiteLLMConfig: () => t.invoke("litellm:get-config"),
	setLiteLLMConfig: (e) => t.invoke("litellm:set-config", e),
	testLMStudioConnection: (e) => t.invoke("lmstudio:test-connection", e),
	fetchLMStudioModels: () => t.invoke("lmstudio:fetch-models"),
	getLMStudioConfig: () => t.invoke("lmstudio:get-config"),
	setLMStudioConfig: (e) => t.invoke("lmstudio:set-config", e),
	testNimConnection: (e, n) => t.invoke("nim:test-connection", e, n),
	fetchNimModels: () => t.invoke("nim:fetch-models"),
	testCustomConnection: (e, n) => t.invoke("custom:test-connection", e, n),
	validateBedrockCredentials: (e) => t.invoke("bedrock:validate", e),
	saveBedrockCredentials: (e) => t.invoke("bedrock:save", e),
	getBedrockCredentials: () => t.invoke("bedrock:get-credentials"),
	fetchBedrockModels: (e) => t.invoke("bedrock:fetch-models", e),
	validateVertexCredentials: (e) => t.invoke("vertex:validate", e),
	saveVertexCredentials: (e) => t.invoke("vertex:save", e),
	getVertexCredentials: () => t.invoke("vertex:get-credentials"),
	fetchVertexModels: (e) => t.invoke("vertex:fetch-models", e),
	detectVertexProject: () => t.invoke("vertex:detect-project"),
	listVertexProjects: () => t.invoke("vertex:list-projects"),
	isE2EMode: () => t.invoke("app:is-e2e-mode"),
	getProviderSettings: () => t.invoke("provider-settings:get"),
	setActiveProvider: (e) => t.invoke("provider-settings:set-active", e),
	getConnectedProvider: (e) => t.invoke("provider-settings:get-connected", e),
	setConnectedProvider: (e, n) => t.invoke("provider-settings:set-connected", e, n),
	removeConnectedProvider: (e) => t.invoke("provider-settings:remove-connected", e),
	updateProviderModel: (e, n) => t.invoke("provider-settings:update-model", e, n),
	setProviderDebugMode: (e) => t.invoke("provider-settings:set-debug", e),
	getProviderDebugMode: () => t.invoke("provider-settings:get-debug"),
	onTaskUpdate: (e) => {
		let n = (t, n) => e(n);
		return t.on("task:update", n), () => t.removeListener("task:update", n);
	},
	onTaskUpdateBatch: (e) => {
		let n = (t, n) => e(n);
		return t.on("task:update:batch", n), () => t.removeListener("task:update:batch", n);
	},
	onPermissionRequest: (e) => {
		let n = (t, n) => e(n);
		return t.on("permission:request", n), () => t.removeListener("permission:request", n);
	},
	onTaskProgress: (e) => {
		let n = (t, n) => e(n);
		return t.on("task:progress", n), () => t.removeListener("task:progress", n);
	},
	onDebugLog: (e) => {
		let n = (t, n) => e(n);
		return t.on("debug:log", n), () => t.removeListener("debug:log", n);
	},
	onDebugModeChange: (e) => {
		let n = (t, n) => e(n);
		return t.on("settings:debug-mode-changed", n), () => t.removeListener("settings:debug-mode-changed", n);
	},
	onTaskStatusChange: (e) => {
		let n = (t, n) => e(n);
		return t.on("task:status-change", n), () => t.removeListener("task:status-change", n);
	},
	onTaskSummary: (e) => {
		let n = (t, n) => e(n);
		return t.on("task:summary", n), () => t.removeListener("task:summary", n);
	},
	onTodoUpdate: (e) => {
		let n = (t, n) => e(n);
		return t.on("todo:update", n), () => t.removeListener("todo:update", n);
	},
	onAuthError: (e) => {
		let n = (t, n) => e(n);
		return t.on("auth:error", n), () => t.removeListener("auth:error", n);
	},
	onBrowserFrame: (e) => {
		let n = (t, n) => e(n);
		return t.on("browser:frame", n), () => t.removeListener("browser:frame", n);
	},
	onBrowserNavigate: (e) => {
		let n = (t, n) => e(n);
		return t.on("browser:navigate", n), () => t.removeListener("browser:navigate", n);
	},
	onBrowserStatus: (e) => {
		let n = (t, n) => e(n);
		return t.on("browser:status", n), () => t.removeListener("browser:status", n);
	},
	startBrowserPreview: (e, n) => t.invoke("browser-preview:start", e, n),
	stopBrowserPreview: (e) => t.invoke("browser-preview:stop", e),
	getBrowserPreviewStatus: () => t.invoke("browser-preview:status"),
	logEvent: (e) => t.invoke("log:event", e),
	exportLogs: () => t.invoke("logs:export"),
	speechIsConfigured: () => t.invoke("speech:is-configured"),
	speechGetConfig: () => t.invoke("speech:get-config"),
	speechValidate: (e) => t.invoke("speech:validate", e),
	speechTranscribe: (e, n) => t.invoke("speech:transcribe", e, n),
	getSkills: () => t.invoke("skills:list"),
	getEnabledSkills: () => t.invoke("skills:list-enabled"),
	setSkillEnabled: (e, n) => t.invoke("skills:set-enabled", e, n),
	getSkillContent: (e) => t.invoke("skills:get-content", e),
	getUserSkillsPath: () => t.invoke("skills:get-user-skills-path"),
	pickSkillFolder: () => t.invoke("skills:pick-folder"),
	addSkillFromFolder: (e) => t.invoke("skills:add-from-folder", e),
	addSkillFromGitHub: (e) => t.invoke("skills:add-from-github", e),
	deleteSkill: (e) => t.invoke("skills:delete", e),
	resyncSkills: () => t.invoke("skills:resync"),
	openSkillInEditor: (e) => t.invoke("skills:open-in-editor", e),
	showSkillInFolder: (e) => t.invoke("skills:show-in-folder", e),
	getDaemonSocketPath: () => t.invoke("daemon:get-socket-path"),
	daemonPing: () => t.invoke("daemon:ping"),
	daemonRestart: () => t.invoke("daemon:restart"),
	daemonStop: () => t.invoke("daemon:stop"),
	daemonStart: () => t.invoke("daemon:start"),
	getCloseBehavior: () => t.invoke("daemon:get-close-behavior"),
	setCloseBehavior: (e) => t.invoke("daemon:set-close-behavior", e),
	onDaemonDisconnected: (e) => {
		let n = () => e();
		return t.on("daemon:disconnected", n), () => t.removeListener("daemon:disconnected", n);
	},
	onDaemonReconnected: (e) => {
		let n = () => e();
		return t.on("daemon:reconnected", n), () => t.removeListener("daemon:reconnected", n);
	},
	onDaemonReconnectFailed: (e) => {
		let n = () => e();
		return t.on("daemon:reconnect-failed", n), () => t.removeListener("daemon:reconnect-failed", n);
	},
	addFavorite: (e) => t.invoke("favorites:add", e),
	removeFavorite: (e) => t.invoke("favorites:remove", e),
	listFavorites: () => t.invoke("favorites:list"),
	isFavorite: (e) => t.invoke("favorites:has", e),
	pickFolder: () => t.invoke("files:pick-folder"),
	pickFiles: () => t.invoke("files:pick"),
	processDroppedFiles: (e) => t.invoke("files:process-dropped", e),
	getSandboxConfig: () => t.invoke("sandbox:get-config"),
	setSandboxConfig: (e) => t.invoke("sandbox:set-config", e),
	getConnectors: () => t.invoke("connectors:list"),
	addConnector: (e, n) => t.invoke("connectors:add", e, n),
	deleteConnector: (e) => t.invoke("connectors:delete", e),
	setConnectorEnabled: (e, n) => t.invoke("connectors:set-enabled", e, n),
	startConnectorOAuth: (e) => t.invoke("connectors:start-oauth", e),
	completeConnectorOAuth: (e, n) => t.invoke("connectors:complete-oauth", e, n),
	disconnectConnector: (e) => t.invoke("connectors:disconnect", e),
	onMcpAuthCallback: (e) => {
		let n = (t, n) => e(n);
		return t.on("auth:mcp-callback", n), () => {
			t.removeListener("auth:mcp-callback", n);
		};
	},
	getBuiltInConnectorAuthStatus: () => t.invoke("connectors:get-built-in-auth-status"),
	loginBuiltInConnector: (e) => t.invoke("connectors:built-in-login", e),
	logoutBuiltInConnector: (e) => t.invoke("connectors:built-in-logout", e),
	lightdashGetServerUrl: () => t.invoke("lightdash:get-server-url"),
	lightdashSetServerUrl: (e) => t.invoke("lightdash:set-server-url", e),
	datadogGetServerUrl: () => t.invoke("datadog:get-server-url"),
	datadogSetServerUrl: (e) => t.invoke("datadog:set-server-url", e),
	startHuggingFaceServer: (e) => t.invoke("huggingface-local:start-server", e),
	stopHuggingFaceServer: () => t.invoke("huggingface-local:stop-server"),
	getHuggingFaceServerStatus: () => t.invoke("huggingface-local:server-status"),
	getHuggingFaceLocalConfig: () => t.invoke("huggingface-local:get-config"),
	setHuggingFaceLocalConfig: (e) => t.invoke("huggingface-local:set-config", e),
	testHuggingFaceConnection: () => t.invoke("huggingface-local:test-connection"),
	downloadHuggingFaceModel: (e) => t.invoke("huggingface-local:download-model", e),
	listHuggingFaceModels: () => t.invoke("huggingface-local:list-models"),
	deleteHuggingFaceModel: (e) => t.invoke("huggingface-local:delete-model", e),
	onHuggingFaceDownloadProgress: (e) => {
		let n = (t, n) => e(n);
		return t.on("huggingface-local:download-progress", n), () => {
			t.removeListener("huggingface-local:download-progress", n);
		};
	},
	captureScreenshot: () => t.invoke("debug:capture-screenshot"),
	captureAxtree: () => t.invoke("debug:capture-axtree"),
	generateBugReport: (e) => t.invoke("debug:generate-bug-report", e),
	listWorkspaces: () => t.invoke("workspace:list"),
	getActiveWorkspaceId: () => t.invoke("workspace:get-active"),
	switchWorkspace: (e) => t.invoke("workspace:switch", e),
	createWorkspace: (e) => t.invoke("workspace:create", e),
	updateWorkspace: (e, n) => t.invoke("workspace:update", e, n),
	deleteWorkspace: (e) => t.invoke("workspace:delete", e),
	listKnowledgeNotes: (e) => t.invoke("knowledge-notes:list", e),
	createKnowledgeNote: (e) => t.invoke("knowledge-notes:create", e),
	updateKnowledgeNote: (e, n, r) => t.invoke("knowledge-notes:update", e, n, r),
	deleteKnowledgeNote: (e, n) => t.invoke("knowledge-notes:delete", e, n),
	onWorkspaceChanged: (e) => {
		let n = (t, n) => e(n);
		return t.on("workspace:changed", n), () => t.removeListener("workspace:changed", n);
	},
	onWorkspaceDeleted: (e) => {
		let n = (t, n) => e(n);
		return t.on("workspace:deleted", n), () => t.removeListener("workspace:deleted", n);
	},
	getWhatsAppConfig: () => t.invoke("integrations:whatsapp:get-config"),
	connectWhatsApp: () => t.invoke("integrations:whatsapp:connect"),
	disconnectWhatsApp: () => t.invoke("integrations:whatsapp:disconnect"),
	setWhatsAppEnabled: (e) => t.invoke("integrations:whatsapp:set-enabled", e),
	onWhatsAppQR: (e) => {
		let n = (t, n) => e(n);
		return t.on("integrations:whatsapp:qr", n), () => t.removeListener("integrations:whatsapp:qr", n);
	},
	onWhatsAppStatus: (e) => {
		let n = (t, n) => e(n);
		return t.on("integrations:whatsapp:status", n), () => t.removeListener("integrations:whatsapp:status", n);
	},
	listSchedules: (e) => t.invoke("scheduler:list", e),
	createSchedule: (e, n, r) => t.invoke("scheduler:create", e, n, r),
	deleteSchedule: (e) => t.invoke("scheduler:delete", e),
	setScheduleEnabled: (e, n) => t.invoke("scheduler:set-enabled", e, n),
	isAutoStartEnabled: () => t.invoke("daemon:is-auto-start-enabled"),
	accomplishAiConnect: () => t.invoke("accomplish-ai:connect"),
	accomplishAiEnsureReady: () => t.invoke("accomplish-ai:ensure-ready"),
	accomplishAiDisconnect: () => t.invoke("accomplish-ai:disconnect"),
	accomplishAiGetUsage: () => t.invoke("accomplish-ai:get-usage"),
	accomplishAiGetStatus: () => t.invoke("accomplish-ai:get-status"),
	onAccomplishAiUsageUpdate: (e) => {
		let n = (t, n) => e(n);
		return t.on("accomplish-ai:usage-updated", n), () => t.removeListener("accomplish-ai:usage-updated", n);
	},
	getBuildCapabilities: () => t.invoke("app:get-build-capabilities"),
	onCloseRequested: (e) => {
		let n = () => e();
		return t.on("app:close-requested", n), () => t.removeListener("app:close-requested", n);
	},
	respondToClose: (e) => {
		t.send("app:close-response", e);
	},
	gws: {
		listAccounts: () => t.invoke("gws:accounts:list"),
		startAuth: (e) => t.invoke("gws:accounts:start-auth", e),
		completeAuth: (e, n) => t.invoke("gws:accounts:complete-auth", e, n),
		removeAccount: (e) => t.invoke("gws:accounts:remove", e),
		updateLabel: (e, n) => t.invoke("gws:accounts:update-label", e, n),
		cancelAuth: (e) => t.invoke("gws:accounts:cancel-auth", e),
		onStatusChanged: (e) => {
			let n = (t, n, r) => e(n, r);
			return t.on("gws:account:status-changed", n), () => t.removeListener("gws:account:status-changed", n);
		},
		onAuthError: (e) => {
			let n = (t, n) => e(n);
			return t.on("gws:account:auth-error", n), () => t.removeListener("gws:account:auth-error", n);
		}
	},
	analytics: {
		track: (e, t) => r("analytics:track", e, t),
		trackPageView: (e, t) => r("analytics:page-view", e, t),
		trackSubmitTask: () => r("analytics:submit-task"),
		trackNewTask: () => r("analytics:new-task"),
		trackOpenSettings: () => r("analytics:open-settings"),
		trackSaveApiKey: (e, t, n) => r("analytics:save-api-key", e, t, n),
		trackSelectProvider: (e) => r("analytics:select-provider", e),
		trackSelectModel: (e, t) => r("analytics:select-model", e, t),
		trackToggleDebugMode: (e) => r("analytics:toggle-debug-mode", e),
		trackTaskStart: (e, t, n) => r("analytics:task-start", e, t, n),
		trackTaskComplete: (e, n, r, i, a, o) => t.invoke("analytics:task-complete", e, n, r, i, a, o),
		trackTaskError: (e, n, r, i, a, o) => t.invoke("analytics:task-error", e, n, r, i, a, o),
		trackPermissionRequested: (e, n, r, i) => t.invoke("analytics:permission-requested", e, n, r, i),
		trackPermissionResponse: (e, n, r, i, a) => t.invoke("analytics:permission-response", e, n, r, i, a),
		trackToolUsed: (e, t, n, i) => r("analytics:tool-used", e, t, n, i),
		trackUserInteraction: (e, n, r, i, a) => t.invoke("analytics:user-interaction", e, n, r, i, a),
		trackAppClose: () => r("analytics:app-close"),
		trackAppBackgrounded: () => r("analytics:app-backgrounded"),
		trackAppForegrounded: () => r("analytics:app-foregrounded"),
		trackModelSelectionStep: (e, t, n, i) => r("analytics:model-selection-step", e, t, n, i),
		trackModelSelectionComplete: (e, t, n) => r("analytics:model-selection-complete", e, t, n),
		trackModelSelectionAbandoned: (e, t) => r("analytics:model-selection-abandoned", e, t),
		trackHistoryViewed: () => r("analytics:history-viewed"),
		trackTaskFromHistory: () => r("analytics:task-from-history"),
		trackHistoryCleared: () => r("analytics:history-cleared"),
		trackTaskDetailsExpanded: () => r("analytics:task-details-expanded"),
		trackOutputCopied: () => r("analytics:output-copied"),
		trackProviderDisconnected: (e) => r("analytics:provider-disconnected", e),
		trackHelpLinkClicked: (e) => r("analytics:help-link-clicked", e),
		trackSkillAction: (e) => r("analytics:skill-action", e),
		trackSaveVoiceApiKey: (e) => r("analytics:save-voice-api-key", e),
		trackExportLogs: () => r("analytics:export-logs"),
		trackThreadExported: () => r("analytics:thread-exported"),
		trackTaskLauncherAction: (e) => r("analytics:task-launcher-action", e),
		trackTaskFeedback: (e, n, r, i, a, o, s) => t.invoke("analytics:task-feedback", e, n, r, i, a, o, s),
		trackStopAgent: (e, t) => r("analytics:stop-agent", e, t),
		trackProviderBoxClicked: (e) => r("analytics:provider-box-clicked", e)
	}
}), e.exposeInMainWorld("accomplishShell", {
	version: "0.5.17",
	platform: process.platform,
	isElectron: !0
});
//#endregion
