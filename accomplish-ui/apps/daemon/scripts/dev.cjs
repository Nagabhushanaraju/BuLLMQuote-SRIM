'use strict';
// Dev launcher: build the daemon with tsup (same as production), then run
// the CJS bundle with ACCOMPLISH_DAEMON_DEV=1.
//
// WHY NOT tsx/esm:
//   Running `node --import tsx/esm src/index.ts` loads index.ts as ESM.
//   Several dependencies (@opencode-ai/sdk, @accomplish_ai/agent-core) are
//   ESM-only. Node 24's strict cycle detection throws
//   ERR_REQUIRE_CYCLE_MODULE if any CJS code in the transitive closure
//   tries to require() a module that is already mid-load as ESM.
//   tsup avoids this entirely by bundling all ESM deps into the CJS output
//   (see the `noExternal` list in tsup.config.ts).

const { execSync, spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

// Point the CLI resolver at apps/desktop where opencode-windows-x64 is installed.
// Without this, the resolver has no appPath to search and throws
// "OpenCode runtime is not available" when task:start is called.
const env = {
  ...process.env,
  ACCOMPLISH_DAEMON_DEV: '1',
  ACCOMPLISH_APP_PATH: path.join(__dirname, '..', '..', 'desktop'),
};

// Step 1: build once
console.log('[dev] Building daemon...');
execSync('node scripts/build.cjs', { stdio: 'inherit', cwd: root, shell: true });
console.log('[dev] Build complete. Starting daemon...\n');

// Step 2: run the CJS bundle — stays alive until Ctrl+C
const child = spawn('node', ['dist/index.js'], { stdio: 'inherit', cwd: root, env });

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
process.on('SIGINT', () => {
  child.kill('SIGINT');
});
process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});
