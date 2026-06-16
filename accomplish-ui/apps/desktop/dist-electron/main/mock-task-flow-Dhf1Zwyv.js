import { t as e } from "./id-CqFLcoJO.js";
import { t } from "./logging-CWK-J2W5.js";
//#region src/main/test-utils/mock-task-flow.ts
var n = {
	saveTask: () => {},
	addTaskMessage: () => {},
	updateTaskStatus: () => {}
};
function r() {
	return global.E2E_MOCK_TASK_EVENTS === !0 || process.env.E2E_MOCK_TASK_EVENTS === "1";
}
var i = {
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
function a(e) {
	let t = e.toLowerCase();
	for (let e of [
		"error",
		"interrupted",
		"question",
		"permission-required",
		"code-block",
		"with-tool",
		"success"
	]) if (i[e].some((e) => t.includes(e.toLowerCase()))) return e;
	return "success";
}
function o(e) {
	return new Promise((t) => setTimeout(t, e));
}
async function s(r, i) {
	let { taskId: a, prompt: s, scenario: l, delayMs: u = 100 } = i;
	if (r.isDestroyed()) {
		try {
			let e = t();
			e?.log && e.log("WARN", "main", "[MockTaskFlow] Window destroyed, skipping mock flow");
		} catch {}
		return;
	}
	let d = n, f = (e, t) => {
		r.isDestroyed() || r.webContents.send(e, t);
	}, p = (e) => {
		d.addTaskMessage(a, e), f("task:update", {
			taskId: a,
			type: "message",
			message: e
		});
	};
	f("task:progress", {
		taskId: a,
		stage: "init"
	}), await o(u), p({
		id: e(),
		type: "assistant",
		content: `I'll help you with: ${s}`,
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	}), await o(u), await c(f, p, d, a, l, u);
}
async function c(e, t, n, r, i, a) {
	switch (i) {
		case "success":
			await l(e, t, n, r, a);
			break;
		case "with-tool":
			await u(e, t, n, r, a);
			break;
		case "permission-required":
			d(e, r);
			break;
		case "question":
			f(e, r);
			break;
		case "error":
			p(e, n, r);
			break;
		case "interrupted":
			await m(e, t, n, r, a);
			break;
		case "code-block":
			await h(e, t, n, r, a);
			break;
	}
}
async function l(t, n, r, i, a) {
	n({
		id: e(),
		type: "assistant",
		content: "Task completed successfully.",
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	}), await o(a), r.updateTaskStatus(i, "completed", (/* @__PURE__ */ new Date()).toISOString()), t("task:update", {
		taskId: i,
		type: "complete",
		result: {
			status: "success",
			sessionId: `session_${i}`
		}
	});
}
async function u(t, n, r, i, a) {
	t("task:update:batch", {
		taskId: i,
		messages: [{
			id: e(),
			type: "tool",
			content: "Reading files",
			toolName: "Read",
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		}, {
			id: e(),
			type: "tool",
			content: "Searching code",
			toolName: "Grep",
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		}]
	}), await o(a * 2), n({
		id: e(),
		type: "assistant",
		content: "Found the information using available tools.",
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	}), await o(a), r.updateTaskStatus(i, "completed", (/* @__PURE__ */ new Date()).toISOString()), t("task:update", {
		taskId: i,
		type: "complete",
		result: {
			status: "success",
			sessionId: `session_${i}`
		}
	});
}
function d(e, t) {
	e("permission:request", {
		id: `perm_${Date.now()}`,
		taskId: t,
		type: "file",
		question: "Allow file write?",
		toolName: "Write",
		fileOperation: "create",
		filePath: "/test/output.txt",
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	});
}
function f(e, t) {
	e("permission:request", {
		id: `perm_${Date.now()}`,
		taskId: t,
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
		multiSelect: !1,
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	});
}
function p(e, t, n) {
	t.updateTaskStatus(n, "failed", (/* @__PURE__ */ new Date()).toISOString()), e("task:update", {
		taskId: n,
		type: "error",
		error: "Command execution failed: File not found"
	});
}
async function m(t, n, r, i, a) {
	n({
		id: e(),
		type: "assistant",
		content: "Task was interrupted by user.",
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	}), await o(a), r.updateTaskStatus(i, "interrupted", (/* @__PURE__ */ new Date()).toISOString()), t("task:update", {
		taskId: i,
		type: "complete",
		result: {
			status: "interrupted",
			sessionId: `session_${i}`
		}
	});
}
async function h(t, n, r, i, a) {
	n({
		id: e(),
		type: "assistant",
		content: "Here's an example function:\n\n```typescript\nfunction greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n\nconst message = greet(\"World\");\nconsole.log(message);\n```\n\nAnd here's another example in Python:\n\n```python\ndef calculate_sum(numbers):\n    return sum(numbers)\n\nresult = calculate_sum([1, 2, 3, 4, 5])\nprint(f\"Sum: {result}\")\n```\n\nThe code blocks above demonstrate syntax highlighting.",
		timestamp: (/* @__PURE__ */ new Date()).toISOString()
	}), await o(a), r.updateTaskStatus(i, "completed", (/* @__PURE__ */ new Date()).toISOString()), t("task:update", {
		taskId: i,
		type: "complete",
		result: {
			status: "success",
			sessionId: `session_${i}`
		}
	});
}
function g(t, n) {
	return {
		id: t,
		prompt: n,
		status: "running",
		messages: [{
			id: e(),
			type: "user",
			content: n,
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		}],
		createdAt: (/* @__PURE__ */ new Date()).toISOString(),
		startedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
//#endregion
export { r as i, a as n, s as r, g as t };

//# sourceMappingURL=mock-task-flow-Dhf1Zwyv.js.map