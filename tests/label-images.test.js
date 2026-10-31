import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askGemini, groundedLabelCandidates } from '../src/ai.js';
import { normalizeLabelBox, rankLabelCandidates } from '../src/label-images.js';
import { verifiedLabelReferences } from '../src/label-catalogue.js';

test('image search reads Google grounding metadata, including answers without text', async () => {
  let body;
  const grounding = { groundingChunks: [{ image: { imageUri: 'https://example.com/real.jpg', sourceUri: 'https://example.com/wine', title: 'Vin 2015' } }] };
  const result = await askGemini({ key: 'test', prompt: 'photo', model: 'gemini-3.1-flash-image', imageSearch: true,
    fetchImpl: async (_, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { data: 'generated-image-never-used' } }] }, groundingMetadata: grounding }] }) }; } });
  assert.deepEqual(body.tools[0].googleSearch.searchTypes, { webSearch: {}, imageSearch: {} });
  assert.equal(body.generationConfig.responseMimeType, undefined);
  assert.equal(result.value, null);
  assert.equal(groundedLabelCandidates(result.grounding)[0].url, 'https://example.com/real.jpg');
});
test('URLs invented in text, absent image chunks or insecure sources never become candidates', () => {
  assert.deepEqual(groundedLabelCandidates({ groundingChunks: [{ web: { uri: 'https://example.com' } }], images: [{ url: 'https://invented.com/photo.jpg' }] }), []);
  assert.deepEqual(groundedLabelCandidates({ groundingChunks: [{ image: { imageUri: 'javascript:bad', sourceUri: 'https://example.com' } }] }), []);
});
test('crop coordinates identify the real label without stretching a complete bottle', () => {
  assert.deepEqual(normalizeLabelBox([400, 200, 700, 800]), { x: 20, y: 40, width: 60, height: 30 });
  for (const box of [null, [1, 2], [0, 0, 1100, 1000], [600, 0, 300, 1000], [0, NaN, 1, 2]]) assert.equal(normalizeLabelBox(box), null);
});
test('catalogue results from another vintage or unrelated name are excluded', () => {
  const wine = { name: 'Château Margaux', vintage: 2015 };
  const items = [{ url: 'a', title: 'Château Margaux 2015' }, { url: 'b', title: 'Château Margaux 2016' }, { url: 'c', title: 'Château Giscours 2015' }, { url: 'd', title: 'Anniversaire Margaux Augustin 2015' }];
  const result = rankLabelCandidates(items, wine);
  assert.ok(!result.some(i => i.url === 'b' || i.url === 'c' || i.url === 'd'));
  assert.equal(result[0].url, 'a');
});
test('Margaux 2015 reference is exact and never substitutes the third wine or another vintage', () => {
  assert.equal(verifiedLabelReferences({ name: 'Château Margaux', vintage: 2015 })[0].useWholeBottle, true);
  assert.deepEqual(verifiedLabelReferences({ name: 'Château Margaux', vintage: 2016 }), []);
  assert.deepEqual(verifiedLabelReferences({ name: 'Margaux du Château Margaux', vintage: 2015 }), []);
});
