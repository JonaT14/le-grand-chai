import { test, expect } from '@playwright/test';
const account = 'MA-CAVE-PRINCIPALE';
const api = '**/generativelanguage.googleapis.com/**';
const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const jsonReply = value => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });
async function seed(page, data = {}, key = true) {
  await page.addInitScript(({ data, key, account }) => {
    if (key && !localStorage.getItem('kava20_gemini_key')) localStorage.setItem('kava20_gemini_key', 'test-key-not-real');
    for (const [name, value] of Object.entries(data)) if (localStorage.getItem(name) === null) localStorage.setItem(name, JSON.stringify(value));
  }, { data, key, account });
}
async function stored(page) { return page.evaluate(account => JSON.parse(localStorage.getItem(`lgc_cellar_data_${account}`)), account); }
async function openMargaux(page) { await page.getByLabel('Château Margaux, rangée 1, casier 2', { exact: true }).click(); }
test.beforeEach(async ({ page }) => {
  // Isolate external services; only app behavior is under test.
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
});

test('walls: add, rename, resize, safely transfer occupied wall, persist', async ({ page }) => {
  await seed(page); await page.goto('/');
  await page.getByRole('button', { name: 'Configurer murs' }).click();
  await page.getByLabel('Lignes de Mur de Gauche', { exact: true }).fill('1');
  await expect(page.getByRole('alert')).toContainText('Déplacez-les');
  await expect(page.getByLabel('Lignes de Mur de Gauche', { exact: true })).toHaveValue('4');
  await page.getByRole('button', { name: 'Ajouter un mur', exact: true }).click();
  await page.getByLabel('Nom du mur Nouveau mur 4', { exact: true }).fill('Extension');
  await page.getByLabel('Colonnes de Extension', { exact: true }).fill('8');
  await page.getByRole('button', { name: 'Supprimer Mur de Gauche', exact: true }).click();
  const before = await stored(page);
  const destination = before.walls.find(w => w.name === 'Extension');
  await page.getByLabel('Mur de destination').selectOption(destination.id);
  await page.getByRole('button', { name: 'Confirmer la suppression' }).click();
  const after = await stored(page);
  expect(after.wines).toHaveLength(6);
  expect(after.wines.filter(w => w.wallId === destination.id)).toHaveLength(2);
  expect(new Set(after.wines.map(w => `${w.wallId}/${w.row}/${w.col}`)).size).toBe(6);
  await page.getByRole('button', { name: 'Fermer la configuration' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Extension (2/32)', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mur de Gauche \(/ })).toHaveCount(0);
});

test('personal rating including zero persists and remains editable in tasting history', async ({ page }) => {
  await seed(page); await page.goto('/'); await openMargaux(page);
  await page.getByLabel('Ma note', { exact: true }).selectOption('0');
  expect((await stored(page)).wines.find(w => w.id === 'w1').userRating).toBe(0);
  await page.getByRole('button', { name: 'Boire une bouteille (Retirer 1 et archiver)', exact: true }).click();
  await expect(page.getByLabel('Quantité en stock', { exact: true })).toHaveValue('0');
  await page.getByRole('button', { name: 'Fermer la bouteille' }).click();
  await page.getByRole('button', { name: 'Carnet de Dégustation', exact: true }).click();
  const note = page.getByLabel('Note de dégustation de Château Margaux', { exact: true });
  await expect(note).toHaveValue('0');
  await note.selectOption('3.5');
  await page.getByLabel('Notes de dégustation de Château Margaux', { exact: true }).fill('À redéguster, finale courte.');
  await page.reload(); await page.getByRole('button', { name: 'Carnet de Dégustation', exact: true }).click();
  await expect(note).toHaveValue('3.5');
  await expect(page.getByLabel('Notes de dégustation de Château Margaux', { exact: true })).toHaveValue('À redéguster, finale courte.');
});

test('sommelier really requests Google with the migrated key, returns clickable choices and accepts free text', async ({ page }) => {
  await seed(page); let calls = 0;
  await page.route(api, async route => {
    calls++;
    const request = route.request();
    expect(request.headers()['x-goog-api-key']).toBe('test-key-not-real');
    const body = request.postDataJSON();
    expect(body.contents[0].parts[0].text).toContain(calls === 1 ? 'Saint-Jacques' : 'Curry de légumes au lait de coco');
    expect(body.contents[0].parts[0].text).toContain('w6');
    await route.fulfill({ json: jsonReply({ bestWineId: 'w6', secondWineId: 'w4', reason: 'La fraîcheur du Sauvignon équilibre la sauce.', serviceTip: 'Servir à 11 °C.' }) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Sommelier IA (Accords)', exact: true }).click();
  await page.getByRole('button', { name: 'Saint-Jacques', exact: true }).click();
  await expect(page.getByText('La fraîcheur du Sauvignon équilibre la sauce.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Autre accord possible/ }).click();
  await expect(page.getByRole('heading', { name: 'Champagne Bollinger La Grande Année (2014)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fermer la bouteille' }).click();
  await page.getByLabel('Plat ou occasion').fill('Curry de légumes au lait de coco');
  await page.getByRole('button', { name: 'Trouver l’accord', exact: true }).click();
  await expect(page.getByText('La fraîcheur du Sauvignon équilibre la sauce.', { exact: true })).toBeVisible();
  expect(calls).toBe(2);
});

test('scanner prefills fields from the actual image without inventing year or ratings', async ({ page }) => {
  await seed(page);
  await page.route(api, async route => {
    const parts = route.request().postDataJSON().contents[0].parts;
    expect(parts[1].inlineData.mimeType).toBe('image/jpeg');
    expect(parts[1].inlineData.data.length).toBeGreaterThan(10);
    await route.fulfill({ json: jsonReply({ name: 'Ferme du Verger', category: 'Cidre', type: 'Cidre Brut', region: 'Normandie', appellation: 'Pays d’Auge', vintage: null, grapes: 'Pommes douces-amères' }) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Scanner', exact: true }).click();
  await page.getByLabel('Photo à analyser').setInputFiles({ name: 'etiquette.png', mimeType: 'image/png', buffer: photo });
  await expect(page.getByLabel('Nom du domaine', { exact: true })).toHaveValue('Ferme du Verger');
  await expect(page.getByLabel('Appellation', { exact: true })).toHaveValue('Pays d’Auge');
  await expect(page.getByLabel('Millésime', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Forme du flacon')).toHaveValue('cider');
  await expect(page.getByLabel('Ma note', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Déposer la bouteille dans la cave' }).click();
  const created = (await stored(page)).wines.find(w => w.name === 'Ferme du Verger');
  expect(created.vintage).toBe(null); expect(created.webRating).toBe(null);
  expect(created.customLabelUrl).toContain('data:image/jpeg;base64,');
});

test('scanner quota error is visible and allows manual recovery with the photo', async ({ page }) => {
  await seed(page);
  await page.route(api, route => route.fulfill({ status: 429, json: { error: { message: 'quota' } } }));
  await page.goto('/'); await page.getByRole('button', { name: 'Scanner', exact: true }).click();
  await page.getByLabel('Photo à analyser').setInputFiles({ name: 'etiquette.png', mimeType: 'image/png', buffer: photo });
  await expect(page.getByRole('alert')).toContainText('quota');
  await expect(page.getByLabel('Nom du domaine')).toHaveCount(0);
  await expect(page.getByLabel('Photo à analyser')).toBeEnabled();
  await page.getByRole('button', { name: 'Garder cette photo et remplir la fiche manuellement' }).click();
  await expect(page.getByLabel('Nom du domaine')).toHaveValue('');
  await expect(page.getByAltText('Photo à vérifier')).toBeVisible();
});

test('labels: verified Margaux photo requires preview and confirmation, generated art stays distinct', async ({ page }) => {
  await seed(page); let searches = 0;
  await page.route(api, async route => {
    const body = route.request().postDataJSON();
    if (body.tools) searches++;
    if (body.generationConfig?.responseSchema?.properties?.matches) {
      await route.fulfill({ json: jsonReply({ matches: true, reason: 'Château Margaux et 2015 sont lisibles.', labelBox: [400, 200, 700, 800] }) });
    } else await route.fulfill({ json: jsonReply({ bg: '#FCF8F0', border: '#9A7B3E', motto: 'PREMIER GRAND CRU CLASSÉ', footer: 'MIS EN BOUTEILLE AU CHÂTEAU' }) });
  });
  await page.route('https://assets.wine.com/**', route => route.fulfill({ contentType: 'image/png', body: photo }));
  await page.goto('/'); await openMargaux(page);
  await page.getByRole('button', { name: 'Recréer avec Google IA', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Reconstitution créée');
  const before = (await stored(page)).wines.find(w => w.id === 'w1').customLabelUrl;
  await page.getByRole('button', { name: 'Chercher une vraie photo', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Château Margaux 2015 — bouteille sérigraphiée — Source', exact: true })).toHaveAttribute('href', 'https://www.wine.com/product/chateau-margaux-2015/153459');
  expect((await stored(page)).wines.find(w => w.id === 'w1').customLabelUrl).toBe(before);
  await page.getByRole('button', { name: 'Vérifier et recadrer Château Margaux 2015 — bouteille sérigraphiée', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Vérifier et recadrer l’étiquette' });
  await expect(dialog).toBeVisible();
  const apply = dialog.getByRole('button', { name: 'Appliquer cette étiquette' });
  await expect(apply).toBeDisabled();
  await dialog.getByRole('checkbox', { name: 'J’ai vérifié que cette étiquette correspond à ma bouteille.' }).check();
  await apply.click();
  await expect(page.getByRole('status')).toContainText('Photo réelle enregistrée');
  expect((await stored(page)).wines.find(w => w.id === 'w1').customBottleUrl).toContain('data:image/jpeg;base64,');
  expect(searches).toBe(0);
});

test('full cellar refuses new bottles instead of stacking them in an occupied slot', async ({ page }) => {
  await seed(page, { [`lgc_cellar_data_${account}`]: { walls: [{ id: 'a', name: 'Petit mur', rows: 1, cols: 1 }], wines: [{ id: 'only', name: 'Seule bouteille', type: 'Rouge', wallId: 'a', row: 1, col: 1 }], history: [] } });
  await page.goto('/'); await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.getByLabel('Nom du domaine').fill('Deuxième bouteille');
  await page.getByRole('button', { name: 'Déposer la bouteille dans la cave' }).click();
  await expect(page.getByRole('alert')).toContainText('pleine');
  expect((await stored(page)).wines).toHaveLength(1);
});

test('no key reports configuration requirement instead of faking a sommelier recommendation', async ({ page }) => {
  await seed(page, {}, false);
  await page.route(api, () => { throw new Error('Google must not be invoked'); });
  await page.goto('/'); await page.getByRole('button', { name: 'Sommelier IA (Accords)', exact: true }).click();
  await page.getByRole('button', { name: 'Galette bretonne', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('clé Google AI Studio');
  await expect(page.getByRole('button', { name: 'Ouvrir la vitrine de la bouteille' })).toHaveCount(0);
});

test('label generation preserves edits made while Google is responding', async ({ page }) => {
  await seed(page);
  let pending;
  await page.route(api, route => { pending = route; });
  await page.goto('/'); await openMargaux(page);
  await page.getByRole('button', { name: 'Recréer avec Google IA', exact: true }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.getByLabel('Ma note', { exact: true }).selectOption('2.5');
  await page.getByPlaceholder('Ajouter vos impressions de dégustation...').fill('Note modifiée pendant la recherche.');
  await pending.fulfill({ json: jsonReply({ bg: '#FCF8F0', border: '#9A7B3E', motto: 'GRAND VIN' }) });
  await expect(page.getByRole('status')).toContainText('Reconstitution créée');
  const wine = (await stored(page)).wines.find(w => w.id === 'w1');
  expect(wine.userRating).toBe(2.5);
  expect(wine.userNotes).toBe('Note modifiée pendant la recherche.');
});

test('mobile cider uses a cork and muselet; old labels survive reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { [`lgc_cellar_data_${account}`]: {
    walls: [{ id: 'a', name: 'Verger', rows: 1, cols: 2 }],
    wines: [{ id: 'cidre', name: 'Cidre fermier brut', type: 'Cidre Brut', bottleShape: 'champagne', vintage: 2025, region: 'Normandie', appellation: 'Pays d’Auge', peakStart: 2026, peakEnd: 2027, drinkLimit: 2028, wallId: 'a', row: 1, col: 1, customLabelUrl: `data:image/png;base64,${photo.toString('base64')}` }], history: []
  } });
  await page.goto('/');
  const previousLabel = await page.evaluate(account => {
    const canvas = document.createElement('canvas'); canvas.width = 520; canvas.height = 720;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#F6EDCE'; ctx.fillRect(0, 0, 520, 720);
    ctx.strokeStyle = '#536937'; ctx.lineWidth = 10; ctx.strokeRect(20, 20, 480, 680);
    ctx.fillStyle = '#364B28'; ctx.textAlign = 'center'; ctx.font = 'bold 46px Georgia';
    ctx.fillText('CIDRE FERMIER', 260, 230); ctx.font = '36px Georgia'; ctx.fillText('Pays d’Auge', 260, 310); ctx.fillText('BRUT', 260, 430);
    const label = canvas.toDataURL('image/png');
    const data = JSON.parse(localStorage.getItem(`lgc_cellar_data_${account}`));
    data.wines[0].customLabelUrl = label;
    localStorage.setItem(`lgc_cellar_data_${account}`, JSON.stringify(data));
    return label;
  }, account);
  await page.reload();
  await page.getByLabel('Cidre fermier brut, rangée 1, casier 1', { exact: true }).click();
  expect((await stored(page)).wines[0].customLabelUrl).toBe(previousLabel);
  await expect(page.locator('svg image').last()).toHaveAttribute('href', previousLabel);
  const bottle = page.locator('svg').filter({ has: page.locator('rect[fill="#BD8C4F"]') });
  await expect(bottle).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Cidre fermier brut (2025)', exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: 'test-results/cidre-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Fermer la bouteille' }).click();
  await page.getByRole('button', { name: 'Configurer murs', exact: true }).click();
  await page.screenshot({ path: 'test-results/murs-mobile.png', fullPage: true });
});

test('a delayed label response cannot overwrite another family cellar', async ({ page }) => {
  await seed(page); let pending;
  await page.route(api, route => { pending = route; });
  await page.goto('/'); await openMargaux(page);
  await page.getByRole('button', { name: 'Recréer avec Google IA', exact: true }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.getByRole('button', { name: 'Fermer la bouteille' }).click();
  await page.getByRole('button', { name: 'Comptes, Drive Kava 20 & Clé IA', exact: true }).click();
  await page.getByRole('button', { name: /Cave de Papa Papa/ }).click();
  await page.getByRole('button', { name: 'Fermer les paramètres' }).click();
  await pending.fulfill({ json: jsonReply({ bg: '#FCF8F0', border: '#9A7B3E', motto: 'GRAND VIN' }) });
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Configurer murs' }).click();
  await page.getByLabel('Nom du mur Mur de Gauche', { exact: true }).fill('Mur de Papa');
  const papa = await page.evaluate(() => JSON.parse(localStorage.getItem('lgc_cellar_data_CAVE-DE-PAPA')));
  expect(papa.wines).toHaveLength(2);
  expect(papa.wines.some(w => w.id === 'w1')).toBe(false);
});
