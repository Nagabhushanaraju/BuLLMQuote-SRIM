// Minimal reproduction of the cycle
import { DaemonRpcServer } from '@accomplish_ai/agent-core';

console.log('Loaded DaemonRpcServer:', DaemonRpcServer.name);

// This is the problematic line
const OPTIONAL_RUNTIME_MODULE = '@accomplish/llm-gateway-client';
if (typeof require !== 'function') {
  throw new Error('require not available (ESM mode)');
}
// try {
//   const runtimeMod = require(OPTIONAL_RUNTIME_MODULE);
//   console.log('Loaded optional module:', runtimeMod);
// } catch (err) {
//   console.log('Failed to load optional module:', (err as Error).message);
// }

console.log('Done');
