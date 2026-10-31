import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findFreeSlot, resizeWall, removeWall, loadCellar, scanFields } from '../src/cellar.js';
const walls = [{ id: 'a', name: 'Gauche', rows: 2, cols: 2 }, { id: 'b', name: 'Fond', rows: 1, cols: 2 }];
const wines = [{ id: '1', wallId: 'a', row: 2, col: 2, userRating: 0 }, { id: '2', wallId: 'b', row: 1, col: 1 }];
test('shrinking a wall cannot hide a bottle; invalid dimensions are rejected', () => {
  for (const v of [0, -1, 13, 1.5, NaN]) assert.throws(() => resizeWall(walls, wines, 'a', 'rows', v));
  assert.throws(() => resizeWall(walls, wines, 'a', 'rows', 1), /bouteilles/);
  assert.equal(resizeWall(walls, wines, 'a', 'rows', 3)[0].rows, 3);
  assert.equal(walls[0].rows, 2);
});
test('deleting an occupied wall transfers bottles to free positions and preserves personal data', () => {
  const next = removeWall(walls, wines, 'a', 'b');
  assert.equal(next.walls.length, 1);
  assert.equal(next.wines.length, wines.length);
  assert.deepEqual(next.wines.find(w => w.id === '1'), { ...wines[0], wallId: 'b', row: 1, col: 2 });
  assert.equal(wines[0].wallId, 'a');
});
test('insufficient destination capacity aborts deletion atomically', () => {
  assert.throws(() => removeWall(walls, [...wines, { id: '3', wallId: 'a', row: 1, col: 1 }], 'a', 'b'), /place/);
  assert.equal(walls.length, 2);
  assert.equal(wines[0].wallId, 'a');
});
test('last wall cannot be deleted', () => assert.throws(() => removeWall([walls[0]], [], 'a'), /au moins un/));
test('full preferred wall uses another wall, and full cellar returns no position', () => {
  const small = walls.map(w => ({ ...w, rows: 1, cols: 1 }));
  assert.deepEqual(findFreeSlot(small, [{ wallId: 'a', row: 1, col: 1 }], 'a'), { wallId: 'b', row: 1, col: 1 });
  assert.equal(findFreeSlot(small, [{ wallId: 'a', row: 1, col: 1 }, { wallId: 'b', row: 1, col: 1 }], 'a'), null);
});
test('legacy cellar migrates per account without replacing current data', () => {
  const values = new Map([['kava20_walls_A', JSON.stringify(walls)], ['kava20_wines_A', JSON.stringify(wines)], ['kava20_history_A', '[]']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(loadCellar(storage, 'A').wines[0].userRating, 0);
  assert.ok(values.has('lgc_cellar_data_A'));
  assert.equal(loadCellar(storage, 'B'), null);
  values.set('lgc_cellar_data_A', JSON.stringify({ walls, wines: [], history: [] }));
  assert.equal(loadCellar(storage, 'A').wines.length, 0);
});
test('unreadable scan is rejected; missing year is left blank and arbitrary fields never enter the form', () => {
  const categories = { Cidre: { types: ['Cidre Brut'], defaultShape: 'cider' } };
  assert.throws(() => scanFields({ name: '', category: 'Cidre', type: 'Cidre Brut' }, categories), /lisible/);
  const fields = scanFields({ name: 'Ferme du Verger', category: 'Cidre', type: 'Cidre Brut', vintage: null, userRating: 5, webRating: 4.9, wallId: 'injected' }, categories);
  assert.equal(fields.vintage, '');
  assert.equal(fields.bottleShape, 'cider');
  assert.equal(fields.webRating, undefined);
  assert.equal(fields.wallId, undefined);
});
