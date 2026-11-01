import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getQuantity, parseQuantity, totalQuantity, normalizeInventory, consumeBottle, removeEmptyReference } from '../src/inventory.js';
import { importCellarData } from '../src/accounts.js';
import { loadCellar, removeWall } from '../src/cellar.js';
import { resolveSommelier } from '../src/ai.js';
const walls = [{ id: 'a', name: 'Gauche', rows: 1, cols: 1 }, { id: 'b', name: 'Droite', rows: 1, cols: 1 }];
const wine = { id: 'wine', name: 'Domaine', type: 'Rouge', wallId: 'a', row: 1, col: 1, quantity: 30, userRating: 0, userNotes: 'Notes à conserver', customLabelUrl: 'data:image/jpeg;base64,AA==' };
test('legacy records default to one while zero and large stocks are preserved', () => {
  assert.equal(getQuantity({}), 1);
  assert.equal(getQuantity({ quantity: 0 }), 0);
  assert.equal(getQuantity({ quantity: 30 }), 30);
  assert.equal(totalQuantity([{}, { quantity: 30 }, { quantity: 0 }]), 31);
});
test('quantity must be a nonnegative safe integer, with one minimum when adding a reference', () => {
  for (const value of ['', ' ', null, false, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => parseQuantity(value));
  assert.equal(parseQuantity('30'), 30); assert.equal(parseQuantity(0), 0);
  assert.throws(() => parseQuantity(0, 1));
});
test('drinking consumes a single unit and archives that unit, preserving all other fields', () => {
  const wines = [wine]; const history = [];
  const next = consumeBottle(wines, history, wine.id, new Date('2026-11-01T12:00:00Z'));
  assert.equal(next.wines[0].quantity, 29);
  assert.equal(next.history.length, 1);
  assert.equal(next.history[0].quantity, 1);
  assert.equal(next.history[0].sourceWineId, wine.id);
  assert.equal(next.history[0].userRating, 0);
  assert.equal(next.wines[0].customLabelUrl, wine.customLabelUrl);
  assert.equal(wines[0].quantity, 30); assert.equal(history.length, 0);
});
test('last bottle leaves an exhausted reference; a second consumption cannot go below zero', () => {
  const next = consumeBottle([{ ...wine, quantity: 1 }], [], wine.id);
  assert.equal(next.wines.length, 1); assert.equal(next.wines[0].quantity, 0);
  assert.throws(() => consumeBottle(next.wines, next.history, wine.id), /épuisée/);
  assert.equal(next.history.length, 1);
});
test('each drinking action has a unique tasting entry, including repeated actions at the same time', () => {
  const date = new Date('2026-11-01T12:00:00Z');
  const first = consumeBottle([wine], [], wine.id, date);
  const second = consumeBottle(first.wines, first.history, wine.id, date);
  assert.equal(second.wines[0].quantity, 28);
  assert.notEqual(second.history[0].id, second.history[1].id);
});
test('current and legacy cellar loads migrate quantities without changing labels, positions or ratings', () => {
  const old = { walls, wines: [{ ...wine, quantity: undefined }], history: [] };
  const storage = { getItem: key => key === 'lgc_cellar_data_A' ? JSON.stringify(old) : null };
  const migrated = loadCellar(storage, 'A');
  assert.equal(migrated.wines[0].quantity, 1);
  assert.equal(migrated.wines[0].userRating, 0);
  assert.equal(migrated.wines[0].customLabelUrl, wine.customLabelUrl);
  assert.deepEqual(normalizeInventory({ walls, wines: [wine, { ...wine, id: 'zero', quantity: 0 }] }).wines.map(getQuantity), [30, 0]);
});
test('backup import preserves thirty and zero; legacy backups receive one and invalid quantities are rejected', () => {
  for (const quantity of [30, 0, undefined]) {
    const result = importCellarData(JSON.stringify({ walls, wines: [{ ...wine, quantity }], history: [] }));
    assert.equal(result.cellar.wines[0].quantity, quantity ?? 1);
  }
  for (const quantity of [-1, 1.5, '30', null]) assert.throws(() => importCellarData(JSON.stringify({ walls, wines: [{ ...wine, quantity }], history: [] })));
});
test('moving references between walls preserves stock and does not require thirty physical slots', () => {
  const result = removeWall(walls, [wine], 'a', 'b');
  assert.equal(result.wines[0].quantity, 30); assert.equal(result.wines[0].wallId, 'b');
});
test('sommelier rejects exhausted references and omits an exhausted alternative', () => {
  const wines = [wine, { ...wine, id: 'empty', quantity: 0 }];
  assert.throws(() => resolveSommelier({ bestWineId: 'empty', reason: 'Accord' }, wines), /disponible/);
  assert.equal(resolveSommelier({ bestWineId: 'wine', secondWineId: 'empty', reason: 'Accord' }, wines).alternative, null);
});

test('an exhausted reference can be removed to free a slot, while a stocked reference cannot', () => {
  assert.throws(() => removeEmptyReference([wine], wine.id), /zéro/);
  assert.deepEqual(removeEmptyReference([{ ...wine, quantity: 0 }], wine.id), []);
});
