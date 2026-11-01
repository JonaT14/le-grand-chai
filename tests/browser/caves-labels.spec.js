import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const account = 'MA-CAVE-PRINCIPALE';
const api = '**/generativelanguage.googleapis.com/**';
const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const reply = value => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });
async function settings(page) { await page.getByRole('button', { name: 'Comptes, Drive Kava 20 & Clé IA', exact: true }).click(); }
async function create(page, name) {
  await page.getByLabel('Nom de la nouvelle cave').fill(name);
  await page.getByLabel('Propriétaire de la nouvelle cave').fill('Famille');
  await page.getByRole('button', { name: 'Créer la cave', exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lgc_appearance', JSON.stringify({ theme:'dark', presentation:'premium', landing:'cellar' })));
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
});
test('create several empty cellars, export and import into another browser without overwriting existing cellars', async ({ page, browser }) => {
  await page.goto('/'); await settings(page);
  await create(page, 'Cave de Marie');
  await expect(page.getByRole('status')).toContainText('sans bouteille');
  await create(page, 'Maison de campagne');
  await create(page, 'Cave des amis');
  await expect(page.getByRole('button', { name: 'Cave de Marie Famille', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fermer les paramètres' }).click();
  await expect(page.getByRole('button', { name: 'Premier mur (0/20)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.getByLabel('Nom du domaine', { exact: true }).fill('Vin des amis');
  await page.getByLabel('Ma note', { exact: true }).selectOption('0');
  await page.getByRole('button', { name: 'Déposer la bouteille dans la cave' }).click();
  await settings(page);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger sauvegarde (.json)', exact: true }).click();
  const download = await downloadEvent;
  const backup = await readFile(await download.path());
  const exported = JSON.parse(backup.toString());
  expect(exported.name).toBe('Cave des amis'); expect(exported.cellar.wines).toHaveLength(1);
  const context = await browser.newContext(); const other = await context.newPage();
  await other.goto('/'); await settings(other);
  await other.getByLabel('Importer une cave', { exact: true }).setInputFiles({ name: 'cave-partagee.json', mimeType: 'application/json', buffer: backup });
  await expect(other.getByRole('status')).toContainText('importée');
  await expect(other.getByRole('button', { name: 'Ma Cave Principale Propriétaire', exact: true })).toBeVisible();
  await other.getByRole('button', { name: 'Fermer les paramètres' }).click();
  await other.getByRole('button', { name:'Plan de Cave & Casiers', exact:true }).click();
  await other.getByLabel('Vin des amis, rangée 1, casier 1', { exact: true }).click();
  await expect(other.getByLabel('Ma note', { exact: true })).toHaveValue('0');
  await other.getByLabel('Ma note', { exact: true }).selectOption('4');
  const sourceRating = await page.evaluate(() => {
    const id = localStorage.getItem('lgc_active_account');return JSON.parse(localStorage.getItem(`lgc_cellar_data_${id}`)).wines[0].userRating;
  });
  expect(sourceRating).toBe(0);
  await page.reload(); await settings(page);
  await expect(page.getByRole('button', { name: 'Maison de campagne Famille', exact: true })).toBeVisible();
  await context.close();
});

test('blank or duplicate cellar names and invalid import do not change existing cellars', async ({ page }) => {
  await page.goto('/'); await settings(page);
  await create(page, 'Ma Cave Principale');
  await expect(page.getByRole('alert')).toContainText('déjà ce nom');
  await page.getByLabel('Importer une cave', { exact: true }).setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.getByRole('alert')).toContainText('doit contenir');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lgc_accounts_list') || '[]').length)).toBe(0);
});

test('Google image search uses original image metadata and verifies and crops before applying', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lgc_gemini_api_key', 'test-key'));
  await page.route('https://example.com/**', r => r.fulfill({ contentType: 'image/png', body: photo }));
  let imageSearchCalls = 0, visionCalls = 0;
  await page.route(api, async route => {
    const request = route.request().postDataJSON();
    if (request.tools) {
      imageSearchCalls++;
      expect(request.tools[0].googleSearch.searchTypes.imageSearch).toEqual({});
      await route.fulfill({ json: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"images":[{"url":"https://invented.com/photo.jpg","source":"https://invented.com"}]}' }] }, groundingMetadata: { groundingChunks: [{ image: { imageUri: 'https://example.com/photo.jpg', sourceUri: 'https://example.com/wine', title: 'Vacheron Les Romains 2020' } }] } }] } });
    } else {
      visionCalls++;
      expect(request.contents[0].parts[1].inlineData.mimeType).toBe('image/jpeg');
      await route.fulfill({ json: reply({ matches: false, reason: 'Le millésime visible est différent : vérification nécessaire.', labelBox: [250, 150, 750, 850] }) });
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mur de Droite (2/20)', exact: true }).click();
  await page.getByLabel('Domaine Vacheron - Les Romains, rangée 2, casier 3', { exact: true }).click();
  await page.getByRole('button', { name: 'Chercher une vraie photo', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Vacheron Les Romains 2020 — Source', exact: true })).toHaveAttribute('href', 'https://example.com/wine');
  await expect(page.locator('img[src*="invented.com"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Vérifier et recadrer Vacheron Les Romains 2020', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Vérifier et recadrer l’étiquette' });
  await expect(dialog.getByRole('status')).toContainText('différent');
  await expect(dialog.getByLabel('Décalage vertical', { exact: true })).toHaveValue('25');
  const before = await page.evaluate(() => localStorage.getItem(`lgc_cellar_data_MA-CAVE-PRINCIPALE`));
  expect(before).toBeNull();
  await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem(`lgc_cellar_data_MA-CAVE-PRINCIPALE`))).toBeNull();
  expect(imageSearchCalls).toBe(1); expect(visionCalls).toBe(1);
});

test('cider, perry and spirits expose only manual label photos', async ({ page }) => {
  await page.addInitScript(account => {
    localStorage.setItem(`lgc_cellar_data_${account}`, JSON.stringify({ walls: [{ id: 'a', name: 'Mur', rows: 1, cols: 3 }], history: [], wines: ['Cidre Brut', 'Poiré', 'Whisky'].map((type, i) => ({ id: `w${i}`, name: type, type, vintage: 2024, wallId: 'a', row: 1, col: i + 1 })) }));
  }, account);
  let googleCalls = 0;
  await page.route(api, () => { googleCalls++; });
  await page.goto('/');
  for (const [i, name] of ['Cidre Brut', 'Poiré', 'Whisky'].entries()) {
    await page.getByLabel(`${name}, rangée 1, casier ${i + 1}`, { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Recréer avec Google IA', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Chercher une vraie photo', exact: true })).toHaveCount(0);
    await expect(page.getByText('📷 Photo étiquette', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Fermer la bouteille' }).click();
  }
  expect(googleCalls).toBe(0);
});

test('provided logo is displayed at 88 pixels on desktop and phone', async ({ page }) => {
  await page.goto('/');
  let logo = page.getByAltText('Cave voûtée du Grand Chai', { exact: true }).first();
  await expect(logo).toBeVisible();
  expect((await logo.boundingBox()).width).toBe(88);
  expect(await logo.evaluate(img => img.naturalWidth)).toBe(554);
  await page.screenshot({ path: 'test-results/nouveau-logo-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  logo = page.getByAltText('Cave voûtée du Grand Chai', { exact: true }).last();
  await expect(logo).toBeVisible();
  expect((await logo.boundingBox()).width).toBe(88);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: 'test-results/nouveau-logo-mobile.png', fullPage: true });
});
