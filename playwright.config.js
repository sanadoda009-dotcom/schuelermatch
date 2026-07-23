// Playwright-Konfiguration für die SchülerMatch-E2E-Tests.
// Startet automatisch den lokalen Python-Server (gleicher wie in .claude/launch.json)
// und führt alle Tests gegen http://localhost:5500 aus.
const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // Großzügig, weil die Dashboard-Seiten unter Parallel-Last mehrere externe
  // CDN-Skripte laden (jsPDF, pdf.js, supabase-js, Fonts).
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:5500',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'python -m http.server 5500',
    port: 5500,
    reuseExistingServer: true,
    timeout: 20_000,
    stdout: 'ignore',
    stderr: 'ignore',
  },

  projects: [
    // Desktop: alles außer den Mobil-Checks (dort ist der Hamburger per CSS versteckt)
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobil\.spec\.js/ },
    // Mobil-Viewport für die wichtigsten responsiven Checks
    { name: 'mobil', use: { ...devices['Pixel 7'] }, testMatch: /mobil\.spec\.js/ },
  ],
})
