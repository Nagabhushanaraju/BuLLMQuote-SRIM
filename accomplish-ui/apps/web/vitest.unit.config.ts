import { defineConfig, Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Intercept static asset imports at resolve time so test environments don't
// try to open /assets/... as real filesystem paths (they don't exist in tests).
const staticAssetMock: Plugin = {
  name: 'static-asset-mock',
  enforce: 'pre',
  resolveId(id: string) {
    if (/\.(svg|png|jpg|jpeg|gif|ico|webp)(\?.*)?$/.test(id)) {
      return '\0virtual:static-asset';
    }
  },
  load(id: string) {
    if (id === '\0virtual:static-asset') {
      return 'export default ""';
    }
  },
};

export default defineConfig({
  plugins: [react(), staticAssetMock],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/client'),
      '@accomplish_ai/agent-core/common': path.resolve(
        __dirname,
        '../../packages/agent-core/src/common',
      ),
      '@accomplish_ai/agent-core': path.resolve(__dirname, '../../packages/agent-core/src'),
      '@locales': path.resolve(__dirname, 'locales'),
    },
  },
  test: {
    name: 'unit',
    globals: true,
    root: __dirname,
    include: ['__tests__/**/*.unit.test.{ts,tsx}'],
    setupFiles: ['__tests__/setup.ts'],
    environment: 'jsdom',
    testTimeout: 5000,
    hookTimeout: 10000,
  },
});
