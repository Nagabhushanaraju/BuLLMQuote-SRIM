// Simulate what happens: index.ts is ESM (due to tsx/esm)
// It tries to require('@accomplish/llm-gateway-client')
// But that package doesn't exist, so Node tries to resolve it
// If it exists and is ESM, tsx tries to sync-require an ESM module
// Let's see what's actually happening with a trace

const path = require('path');
console.log('If require() is used in ESM mode, it becomes a dynamic call');
console.log('The cycle error suggests: src/index.ts imports something');
console.log('That something eventually tries to require() back to src/index.ts');
