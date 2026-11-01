import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const account = 'MA-CAVE-PRINCIPALE';
const walls = [{ id: 'a', name: 'Mur', rows: 1, cols: 3 }];
const legacy = { id: 'old', name: 'Ancien cidre', type: 'Cidre Brut', vintage: 2025, wallId: 'a', row: 1, col: 1, userNotes: 'Photo et notes à conserver', userRating: 0 };
async function seed(page, wines) {
  await page.addInitScript(({ account, walls, wines }) => localStorage.setItem(`lgc_cellar_data_${account}`, JSON.stringify({ walls, wines, history: [] })), { account, walls, wines });
}
async function data(page) { return page.evaluate(account => JSON.parse(localStorage.getItem(`lgc_cellar_data_${account}`)), account); }
async function settings(page) { await page.getByRole('button', { name: 'Comptes, Drive Kava 20 & Clé IA', exact: true }).click(); }
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lgc_appearance', JSON.stringify({ theme:'dark', presentation:'premium', landing:'cellar' })));
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
});
for (const [category, button] of [['Vin', '🍷 Vin'], ['Cidre', '🍏 Cidre & Poiré'], ['Alcool', '🥃 Spiritueux & Alcool']]) {
  test(`adding ${category} records thirty bottles and shows the stock on the rack`, async ({ page }) => {
    await seed(page, []); await page.goto('/');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await page.getByRole('button', { name: button, exact: true }).click();
    await page.getByLabel('Nom du domaine', { exact: true }).fill(`Lot de ${category}`);
    await expect(page.getByLabel('Nombre de bouteilles à ajouter', { exact: true })).toHaveValue('1');
    await page.getByLabel('Nombre de bouteilles à ajouter', { exact: true }).fill('30');
    await page.getByRole('button', { name: 'Déposer la bouteille dans la cave' }).click();
    const saved = await data(page);
    expect(saved.wines).toHaveLength(1); expect(saved.wines[0].quantity).toBe(30);
    await expect(page.getByLabel('Stock total de la cave')).toContainText('30 bouteilles');
    await expect(page.getByLabel(`Lot de ${category}, rangée 1, casier 1`, { exact: true })).toContainText('30 bouteilles');
    await page.getByLabel(`Lot de ${category}, rangée 1, casier 1`, { exact: true }).click();
    await expect(page.getByLabel('Quantité en stock', { exact: true })).toHaveValue('30');
  });
}

test('legacy stock starts at one, can be corrected without a tasting entry, and persists across reload', async ({ page }) => {
  // Only seed the first page load, so a reload exercises the real saved quantity.
  await page.addInitScript(({ account, walls, legacy }) => {
    const key = `lgc_cellar_data_${account}`;
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ walls, wines: [legacy], history: [] }));
  }, { account, walls, legacy });
  await page.goto('/'); await page.getByLabel('Ancien cidre, rangée 1, casier 1', { exact: true }).click();
  const quantity = page.getByLabel('Quantité en stock', { exact: true });
  await expect(quantity).toHaveValue('1');
  await quantity.fill('30');
  await page.getByRole('button', { name: 'Retirer une bouteille du stock', exact: true }).click();
  await expect(quantity).toHaveValue('29');
  await page.getByRole('button', { name: 'Ajouter une bouteille au stock', exact: true }).click();
  await expect(quantity).toHaveValue('30');
  expect((await data(page)).history).toHaveLength(0);
  expect((await data(page)).wines[0].userRating).toBe(0);
  await page.reload();
  await expect(page.getByLabel('Ancien cidre, rangée 1, casier 1', { exact: true })).toContainText('30 bouteilles');
  await page.getByLabel('Ancien cidre, rangée 1, casier 1', { exact: true }).click();
  await expect(quantity).toHaveValue('30');
  await page.screenshot({ path: 'test-results/quantite-30-cidres.png', fullPage: true });
});

test('drinking consumes one unit, retains an exhausted record and allows restocking', async ({ page }) => {
  await seed(page, [{ ...legacy, quantity: 2 }]); await page.goto('/');
  await page.getByLabel('Ancien cidre, rangée 1, casier 1', { exact: true }).click();
  const drink = page.getByRole('button', { name: 'Boire une bouteille (Retirer 1 et archiver)', exact: true });
  await drink.click();
  await expect(page.getByLabel('Quantité en stock', { exact: true })).toHaveValue('1');
  expect((await data(page)).history).toHaveLength(1);
  await drink.click();
  await expect(page.getByLabel('Quantité en stock', { exact: true })).toHaveValue('0');
  await expect(drink).toBeDisabled();
  const saved = await data(page);
  expect(saved.wines).toHaveLength(1); expect(saved.wines[0].quantity).toBe(0);
  expect(saved.history).toHaveLength(2); expect(saved.history.every(h => h.quantity === 1)).toBe(true);
  await page.getByRole('button', { name: 'Fermer la bouteille' }).click();
  await expect(page.getByLabel('Ancien cidre, rangée 1, casier 1', { exact: true })).toContainText('Stock épuisé');
  await expect(page.getByLabel('Stock total de la cave')).toContainText('0 bouteilles');
  await page.getByLabel('Ancien cidre, rangée 1, casier 1', { exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter une bouteille au stock', exact: true }).click();
  await expect(drink).toBeEnabled();
  expect((await data(page)).wines[0].quantity).toBe(1);
  expect((await data(page)).history).toHaveLength(2);
  await page.getByLabel('Quantité en stock', { exact: true }).fill('0');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Retirer la fiche épuisée du casier', exact: true }).click();
  expect((await data(page)).wines).toHaveLength(0);
  expect((await data(page)).history).toHaveLength(2);
  await expect(page.getByLabel('Casier libre, rangée 1, colonne 1', { exact: true })).toBeVisible();
});

test('invalid fractional or negative stock never replaces the saved quantity', async ({ page }) => {
  await seed(page, [{ ...legacy, quantity: 30 }]); await page.goto('/');
  await page.getByLabel('Ancien cidre, rangée 1, casier 1', { exact: true }).click();
  for (const value of ['-1', '1.5']) {
    await page.getByLabel('Quantité en stock', { exact: true }).fill(value);
    await expect(page.getByRole('alert')).toContainText('nombre entier');
    expect((await data(page)).wines[0].quantity).toBe(30);
  }
});

test('export and import preserve quantities, including exhausted references', async ({ page, browser }) => {
  await seed(page, [{ ...legacy, quantity: 30 }, { ...legacy, id: 'empty', name: 'Whisky épuisé', type: 'Whisky', col: 2, quantity: 0 }]);
  await page.goto('/'); await settings(page);
  const waitForDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger sauvegarde (.json)', exact: true }).click();
  const download = await waitForDownload; const backup = await readFile(await download.path());
  expect(JSON.parse(backup.toString()).cellar.wines.map(w => w.quantity)).toEqual([30, 0]);
  const context = await browser.newContext(); const receiver = await context.newPage();
  await receiver.goto('/'); await settings(receiver);
  await receiver.getByLabel('Importer une cave', { exact: true }).setInputFiles({ name: 'quantites.json', mimeType: 'application/json', buffer: backup });
  await expect(receiver.getByRole('status')).toContainText('importée');
  const imported = await receiver.evaluate(() => JSON.parse(localStorage.getItem(`lgc_cellar_data_${localStorage.getItem('lgc_active_account')}`)));
  expect(imported.wines.map(w => w.quantity)).toEqual([30, 0]);
  await context.close();
});

test('sommelier only receives available stocks and their quantities', async ({ page }) => {
  await seed(page, [{ ...legacy, quantity: 30 }, { ...legacy, id: 'empty', name: 'Référence épuisée', col: 2, quantity: 0 }]);
  await page.addInitScript(() => localStorage.setItem('lgc_gemini_api_key', 'test-key'));
  await page.route('**/generativelanguage.googleapis.com/**', async route => {
    const prompt = route.request().postDataJSON().contents[0].parts[0].text;
    expect(prompt).toContain('"quantity":30'); expect(prompt).not.toContain('Référence épuisée');
    await route.fulfill({ json: { candidates: [{ content: { parts: [{ text: JSON.stringify({ bestWineId: 'old', secondWineId: 'empty', reason: 'Accord au cidre', serviceTip: 'Servir frais.' }) }] } }] } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Sommelier IA (Accords)', exact: true }).click();
  await page.getByRole('button', { name: 'Galette bretonne', exact: true }).click();
  await expect(page.getByText('Accord au cidre', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Autre accord possible/ })).toHaveCount(0);
});
