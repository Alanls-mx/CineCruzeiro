const { defineConfig } = require("@playwright/test");
const frontendPort = Number(process.env.E2E_FRONTEND_PORT || 3000);

module.exports = defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "node scripts/e2e-dev-server.js",
    url: `http://127.0.0.1:${frontendPort}/filmes`,
    reuseExistingServer: false,
    timeout: 120000
  }
});
