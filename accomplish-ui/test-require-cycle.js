// Simulate require in ESM context
// When tsx/esm is used, require() gets wrapped
// Let's trace what actually happens

console.log('Issue: apps/daemon/src/index.ts imports from @accomplish_ai/agent-core');
console.log('@accomplish_ai/agent-core exports DaemonRpcServer from daemon/index.js');
console.log('');
console.log('When tsx runs index.ts in ESM mode:');
console.log('1. index.ts is loaded as ESM by tsx');
console.log('2. Line 155: require("@accomplish/llm-gateway-client")');
console.log('3. tsx wraps require() to handle ESM modules');
console.log('4. It tries to dynamically import the package');
console.log('5. If that package is ESM with exports, it can trigger cycles');
console.log('');
console.log('BUT the actual cycle says: "Cannot require() ES Module ... index.ts"');
console.log('This means something is trying to require() index.ts itself');
console.log('');
console.log('Hypothesis: DaemonRpcServer or another agent-core export');
console.log('might somehow reference back to index.ts through a transitive import');
