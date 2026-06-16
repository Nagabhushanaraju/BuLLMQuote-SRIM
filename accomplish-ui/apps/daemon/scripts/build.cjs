'use strict';

// Cross-platform build wrapper: runs tsup then writes dist/package.json.
// The "&&" operator in npm scripts does not work in PowerShell 5.1 on Windows.

const { execSync } = require('child_process');
const path = require('path');

execSync('tsup', { stdio: 'inherit', cwd: path.join(__dirname, '..'), shell: true });
require('./write-dist-package-type.cjs');
