import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'dist/test/integration/**/*.test.js',
  version: 'stable',
  mocha: {
    ui: 'bdd',
    timeout: 30000,
  },
  workspaceFolder: 'src/test/fixtures',
});
