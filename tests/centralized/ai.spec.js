import { test, expect } from '@playwright/test';
const proxy = 'https://script.google.com/macros/s/AI_TEST_SERVICE/exec';
const service = 'le-grand-chai-ai';
const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const answer = value => ({ service, status: 200, data: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] } });
test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('https://generativelanguage.googleapis.com/**', () => { throw new Error('The browser must never call Gemini directly'); });
});
async function mockService(page, respond, configured = true) {
  await page.route(proxy, route => route.request().method() === 'GET'
    ? route.fulfill({ json: { service, version: 1, configured } })
    : respond(route));
}
test('a fresh phone can check the shared AI connection without entering or storing a key', async ({ page }) => {
  await mockService(page, () => { throw new Error('Status check must be GET only'); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Comptes & Drive Kava 20', exact: true }).click();
  await page.getByRole('button', { name: '3. Google IA', exact: true }).click();
  await expect(page.getByText('IA configurée pour tous vos appareils', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Clé Google AI Studio', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Vérifier la connexion IA', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Service IA prêt');
  expect(await page.evaluate(() => localStorage.getItem('lgc_gemini_api_key'))).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: 'test-results/ia-centralisee-mobile.png', fullPage: true });
});
test('sommelier on a new device sends the cellar to the proxy and returns a clickable available wine', async ({ page }) => {
  let posts = 0;
  await mockService(page, async route => {
    posts++;
    const request = route.request();
    expect(request.headers()['x-goog-api-key']).toBeUndefined();
    const body = request.postDataJSON();
    expect(body.request.contents[0].parts[0].text).toContain('Saint-Jacques');
    expect(body.key).toBeUndefined();
    await route.fulfill({ json: answer({ bestWineId: 'w6', secondWineId: 'w4', reason: 'La fraîcheur équilibre ce plat.', serviceTip: 'Servir à 11 °C.' }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Accords', exact: true }).click();
  await page.getByRole('button', { name: 'Saint-Jacques', exact: true }).click();
  await expect(page.getByText('La fraîcheur équilibre ce plat.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Autre accord possible/ }).click();
  await expect(page.getByRole('heading', { name: 'Champagne Bollinger La Grande Année (2014)', exact: true })).toBeVisible();
  expect(posts).toBe(1);
});
test('the scanner uses the shared key for cider and prefills its form on a fresh phone', async ({ page }) => {
  await mockService(page, async route => {
    const body = route.request().postDataJSON();
    expect(body.request.contents[0].parts[1].inlineData.mimeType).toBe('image/jpeg');
    await route.fulfill({ json: answer({ name: 'Cidre du verger', category: 'Cidre', type: 'Cidre Brut', region: 'Normandie', vintage: null }) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Scanner', exact: true }).click();
  await page.getByLabel('Photo à analyser').setInputFiles({ name: 'cidre.png', mimeType: 'image/png', buffer: photo });
  await expect(page.getByLabel('Nom du domaine', { exact: true })).toHaveValue('Cidre du verger');
  await expect(page.getByLabel('Millésime', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Forme du flacon')).toHaveValue('cider');
});
test('a misconfigured service refuses requests and cannot overwrite Drive backups', async ({ page }) => {
  await page.route(proxy, route => {
    expect(route.request().method()).toBe('GET');
    return route.fulfill({ json: { wines: [] } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Accords', exact: true }).click();
  await page.getByRole('button', { name: 'Saint-Jacques', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Aucune donnée');
});
test('service quota errors remain recoverable without displaying a fake recommendation', async ({ page }) => {
  await mockService(page, route => route.fulfill({ json: { service, status: 429 } }));
  await page.goto('/'); await page.getByRole('button', { name: 'Accords', exact: true }).click();
  await page.getByRole('button', { name: 'Saint-Jacques', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('quota');
  await expect(page.getByRole('button', { name: 'Trouver l’accord', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Ouvrir la vitrine de la bouteille' })).toHaveCount(0);
});
