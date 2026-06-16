import { t as createMessageId } from "./id-BkuVT4wi.js";
import { t as getLogCollector } from "./logging-ZKSN6tdj.js";
//#region src/main/test-utils/mock-task-flow.ts
var mockTaskStorage = {
	saveTask: () => {},
	addTaskMessage: () => {},
	updateTaskStatus: () => {}
};
function isMockTaskEventsEnabled() {
	return global.E2E_MOCK_TASK_EVENTS === true || process.env.E2E_MOCK_TASK_EVENTS === "1";
}
var SCENARIO_KEYWORDS = {
	success: ["__e2e_success__", "test success"],
	"with-tool": [
		"__e2e_tool__",
		"use tool",
		"search files"
	],
	"permission-required": [
		"__e2e_permission__",
		"write file",
		"create file"
	],
	question: ["__e2e_question__"],
	error: [
		"__e2e_error__",
		"cause error",
		"trigger failure"
	],
	interrupted: [
		"__e2e_interrupt__",
		"stop task",
		"cancel task"
	],
	"code-block": ["__e2e_code__"]
};
function detectScenarioFromPrompt(prompt) {
	const promptLower = prompt.toLowerCase();
	for (const scenario of [
		"error",
		"interrupted",
		"question",
		"permission-required",
		"code-block",
		"with-tool",
		"success"
	]) if (SCENARIO_KEYWORDS[scenario].some((keyword) => promptLower.includes(keyword.toLowerCase()))) return scenario;
	return "success";
}
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
async function executeMockTaskFlow(window, config) {
	const { taskId, prompt, scenario, delayMs = 100 } = config;
	if (window.isDestroyed()) {
		try {
			const l = getLogCollector();
			if (l?.log) l.log("WARN", "main", "[MockTaskFlow] Window destroyed, skipping mock flow");
		} catch (_e) {}
		return;
	}
	const storage = mockTaskStorage;
	const sendEvent = (channel, data) => {
		if (!window.isDestroyed()) window.webContents.send(channel, data);
	};
	const sendMessage = (message) => {
		storage.addTaskMessage(taskId, message);
		sendEvent("task:update", {
			taskId,
			type: "message",
			message
		});
	};
	sendEvent("task:progress", {
		taskId,
		stage: "init"
	});
	await sleep(delayMs);
	sendMessage({
		id: createMessageId(),
		type: "assistant",
		content: `I'll help you with: ${prompt}`,
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	});
	await sleep(delayMs);
	await executeScenario(sendEvent, sendMessage, storage, taskId, scenario, delayMs);
}
async function executeScenario(sendEvent, sendMessage, storage, taskId, scenario, delayMs) {
	switch (scenario) {
		case "success":
			await executeSuccessScenario(sendEvent, sendMessage, storage, taskId, delayMs);
			break;
		case "with-tool":
			await executeToolScenario(sendEvent, sendMessage, storage, taskId, delayMs);
			break;
		case "permission-required":
			executePermissionScenario(sendEvent, taskId);
			break;
		case "question":
			executeQuestionScenario(sendEvent, taskId);
			break;
		case "error":
			executeErrorScenario(sendEvent, storage, taskId);
			break;
		case "interrupted":
			await executeInterruptedScenario(sendEvent, sendMessage, storage, taskId, delayMs);
			break;
		case "code-block":
			await executeCodeBlockScenario(sendEvent, sendMessage, storage, taskId, delayMs);
			break;
	}
}
async function executeSuccessScenario(sendEvent, sendMessage, storage, taskId, delayMs) {
	sendMessage({
		id: createMessageId(),
		type: "assistant",
		content: "Task completed successfully.",
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	});
	await sleep(delayMs);
	storage.updateTaskStatus(taskId, "completed", (/* @__PURE__ */ new Date()).toISOString());
	sendEvent("task:update", {
		taskId,
		type: "complete",
		result: {
			status: "success",
			sessionId: `session_${taskId}`
		}
	});
}
async function executeToolScenario(sendEvent, sendMessage, storage, taskId, delayMs) {
	sendEvent("task:update:batch", {
		taskId,
		messages: [{
			id: createMessageId(),
			type: "tool",
			content: "Reading files",
			toolName: "Read",
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		}, {
			id: createMessageId(),
			type: "tool",
			content: "Searching code",
			toolName: "Grep",
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		}]
	});
	await sleep(delayMs * 2);
	sendMessage({
		id: createMessageId(),
		type: "assistant",
		content: "Found the information using available tools.",
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	});
	await sleep(delayMs);
	storage.updateTaskStatus(taskId, "completed", (/* @__PURE__ */ new Date()).toISOString());
	sendEvent("task:update", {
		taskId,
		type: "complete",
		result: {
			status: "success",
			sessionId: `session_${taskId}`
		}
	});
}
function executePermissionScenario(sendEvent, taskId) {
	sendEvent("permission:request", {
		id: `perm_${Date.now()}`,
		taskId,
		type: "file",
		question: "Allow file write?",
		toolName: "Write",
		fileOperation: "create",
		filePath: "/test/output.txt",
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	});
}
function executeQuestionScenario(sendEvent, taskId) {
	sendEvent("permission:request", {
		id: `perm_${Date.now()}`,
		taskId,
		type: "question",
		header: "Test Question",
		question: "Which option do you prefer?",
		options: [
			{
				label: "Option A",
				description: "First option for testing"
			},
			{
				label: "Option B",
				description: "Second option for testing"
			},
			{
				label: "Other",
				description: "Enter a custom response"
			}
		],
		multiSelect: false,
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	});
}
function executeErrorScenario(sendEvent, storage, taskId) {
	storage.updateTaskStatus(taskId, "failed", (/* @__PURE__ */ new Date()).toISOString());
	sendEvent("task:update", {
		taskId,
		type: "error",
		error: "Command execution failed: File not found"
	});
}
async function executeInterruptedScenario(sendEvent, sendMessage, storage, taskId, delayMs) {
	sendMessage({
		id: createMessageId(),
		type: "assistant",
		content: "Task was interrupted by user.",
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	});
	await sleep(delayMs);
	storage.updateTaskStatus(taskId, "interrupted", (/* @__PURE__ */ new Date()).toISOString());
	sendEvent("task:update", {
		taskId,
		type: "complete",
		result: {
			status: "interrupted",
			sessionId: `session_${taskId}`
		}
	});
}
async function executeCodeBlockScenario(sendEvent, sendMessage, storage, taskId, delayMs) {
	sendMessage({
		id: createMessageId(),
		type: "assistant",
		content: `Here's an example function:

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const message = greet("World");
console.log(message);
\`\`\`

And here's another example in Python:

\`\`\`python
def calculate_sum(numbers):
    return sum(numbers)

result = calculate_sum([1, 2, 3, 4, 5])
print(f"Sum: {result}")
\`\`\`

The code blocks above demonstrate syntax highlighting.`,
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	});
	await sleep(delayMs);
	storage.updateTaskStatus(taskId, "completed", (/* @__PURE__ */ new Date()).toISOString());
	sendEvent("task:update", {
		taskId,
		type: "complete",
		result: {
			status: "success",
			sessionId: `session_${taskId}`
		}
	});
}
function createMockTask(taskId, prompt) {
	return {
		id: taskId,
		prompt,
		status: "running",
		messages: [{
			id: createMessageId(),
			type: "user",
			content: prompt,
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		}],
		createdAt: (/* @__PURE__ */ new Date()).toISOString(),
		startedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
//#endregion
export { isMockTaskEventsEnabled as i, detectScenarioFromPrompt as n, executeMockTaskFlow as r, createMockTask as t };

//# sourceMappingURL=mock-task-flow-4HeKoQIE.js.map