import { test, expect } from '@playwright/test';

/**
 * Smoke tests de SOLO LECTURA — seguros de correr contra producción.
 * No hacen login, no crean datos, no tocan la D1.
 */
test.describe('smoke (solo lectura)', () => {
  test('la app responde y sirve el HTML', async ({ page }) => {
    const response = await page.goto('/');
    expect(response, 'no hubo respuesta del servidor').not.toBeNull();
    expect(response!.status(), 'la home no devolvió 2xx/3xx').toBeLessThan(400);
    await expect(page).toHaveTitle(/Nexus Finance/i);
  });

  test('el bundle de JS monta la app sin errores de runtime', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    /* Vite monta React en #root; si el bundle explota, queda vacío. */
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15_000 });

    expect(pageErrors, `errores de JS en la página:\n${pageErrors.join('\n')}`).toEqual([]);
  });

  test('los assets estáticos del PWA están publicados', async ({ request }) => {
    for (const asset of ['/manifest.webmanifest', '/favicon.ico']) {
      const res = await request.get(asset);
      expect(res.status(), `${asset} no está disponible`).toBe(200);
    }
  });
});
