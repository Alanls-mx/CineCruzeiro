const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "node scripts/e2e-dev-server.js",
    url: "http://127.0.0.1:3000/filmes",
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
