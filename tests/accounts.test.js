import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalCellar, importCellarData, loadAccounts } from '../src/accounts.js';
const memory = () => { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };
test('create many independent empty cellars and persist their catalogue', () => {
  const storage = memory(); let accounts = loadAccounts(storage);
  for (let i = 1; i <= 15; i++) {
    const result = createLocalCellar(storage, accounts, `Cave ${i}`, 'Famille'); accounts = result.accounts;
    assert.equal(result.cellar.wines.length, 0); assert.equal(result.cellar.history.length, 0);
    assert.equal(result.cellar.walls.length, 1);
    assert.equal(JSON.parse(storage.getItem(`lgc_cellar_data_${result.account.id}`)).wines.length, 0);
  }
  assert.equal(loadAccounts(storage).length, 17);
  assert.equal(new Set(accounts.map(a => a.id)).size, 17);
});
test('reject blank, too long or duplicate names without modifying existing data', () => {
  const storage = memory(); const accounts = loadAccounts(storage);
  for (const name of [' ', 'x'.repeat(81), ' ma cave principale ']) assert.throws(() => createLocalCellar(storage, accounts, name));
  assert.equal(storage.values.size, 0);
});
test('storage failure rolls back the new cellar instead of losing existing cellars', () => {
  const storage = memory(); const accounts = loadAccounts(storage);
  const original = storage.setItem;
  storage.setItem = (key, value) => { if (key === 'lgc_accounts_list') throw Error('Quota'); original(key, value); };
  assert.throws(() => createLocalCellar(storage, accounts, 'Nouvelle cave'), /mémoire/);
  assert.equal(storage.values.size, 0);
});
test('exports can be imported into an independent copy including images, wall IDs and zero ratings', () => {
  const cellar = { walls: [{ id: 'a', name: 'Mur', rows: 1, cols: 1 }], wines: [{ id: 'w', name: 'Vin', type: 'Rouge', quantity: 1, wallId: 'a', row: 1, col: 1, userRating: 0, customLabelUrl: 'data:image/jpeg;base64,AA==' }], history: [] };
  const imported = importCellarData(JSON.stringify({ format: 'le-grand-chai', version: 1, name: 'Chez Marie', cellar }));
  assert.deepEqual(imported.cellar, cellar);
  const storage = memory(); const created = createLocalCellar(storage, loadAccounts(storage), imported.name, '', imported.cellar);
  assert.notEqual(created.account.id, 'MA-CAVE-PRINCIPALE');
  assert.equal(created.cellar.wines[0].userRating, 0);
  assert.deepEqual(importCellarData(JSON.stringify(cellar)).cellar, cellar);
});
test('malformed or overlapping imported positions cannot corrupt an existing cellar', () => {
  for (const data of ['bad json', '{}', JSON.stringify({ walls: [{ id: 'a', name: 'Mur', rows: 0, cols: 1 }], wines: [], history: [] }), JSON.stringify({ walls: [{ id: 'a', name: 'Mur', rows: 1, cols: 1 }], wines: [{ id: 'w', name: 'Vin', type: 'Rouge', quantity: 1, wallId: 'missing', row: 1, col: 1 }], history: [] })]) assert.throws(() => importCellarData(data));
});
