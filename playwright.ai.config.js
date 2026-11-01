import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/centralized',
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4176', viewport: { width: 390, height: 844 }, screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4176 --strictPort',
    url: 'http://127.0.0.1:4176', reuseExistingServer: false,
    env: { VITE_AI_PROXY_URL: 'https://script.google.com/macros/s/AI_TEST_SERVICE/exec' }
  }
});
