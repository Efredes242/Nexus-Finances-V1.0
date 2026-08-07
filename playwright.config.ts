import { defineConfig, devices } from '@playwright/test';

/**
 * E2E de Nexus Finance.
 *
 * La URL objetivo se decide con E2E_BASE_URL, NO se hardcodea:
 *   - sin variable  -> producción (nexusfinance.ezequielfredes.com.ar)
 *   - en CI         -> la URL del preview deploy de Pages de ese push
 *
 * ⚠️ Contra producción los tests son SOLO LECTURA: el frontend de cualquier
 * *.pages.dev apunta al Worker de producción, y ese Worker escribe en la D1
 * real (nexus-db). Cualquier test que cree o borre datos va contra un preview
 * con su propia base — ver e2e/README.md.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'https://nexusfinance.ezequielfredes.com.ar';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  /* Que un test.only olvidado no pase el CI en silencio. */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    /* La app tiene UX mobile y PWA — vale la pena cubrir el viewport chico. */
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
});
