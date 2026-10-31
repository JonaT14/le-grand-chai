import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askGemini, readGeminiKey, parseAIJson, resolveSommelier, labelCandidates, SCAN_SCHEMA } from '../src/ai.js';
const response = value => ({ ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] }) });

test('migrates the former Google key without overriding a deliberately cleared key', () => {
  const values = new Map([['kava20_gemini_key', 'previous-key']]);
  const storage = { getItem: key => values.get(key) ?? null };
  assert.equal(readGeminiKey(storage), 'previous-key');
  values.set('lgc_gemini_api_key', '');
  assert.equal(readGeminiKey(storage), '');
});
test('scanner sends normalized photo, structured schema and key in a header', async () => {
  let request;
  await askGemini({ key: 'test-key', prompt: 'Lire', image: 'data:image/jpeg;base64,AA==', schema: SCAN_SCHEMA,
    fetchImpl: async (url, options) => { request = { url, ...options, body: JSON.parse(options.body) }; return response({ name: 'Cidre' }); } });
  assert.ok(request.url.includes('gemini-3.8-flash'));
  assert.ok(!request.url.includes('test-key'));
  assert.equal(request.headers['x-goog-api-key'], 'test-key');
  assert.equal(request.body.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
  assert.deepEqual(request.body.generationConfig.responseSchema, SCAN_SCHEMA);
});
test('all answer parts are read and thinking text is ignored', async () => {
  const result = await askGemini({ key: 'key', prompt: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ thought: true, text: 'secret' }, { text: '{"name":' }, { text: '"Cidre"}' }] } }] }) }) });
  assert.equal(result.value.name, 'Cidre');
});
test('Google search uses grounding and does not combine incompatible structured modes', async () => {
  let body;
  await askGemini({ key: 'key', prompt: 'étiquette', search: true, fetchImpl: async (_, request) => { body = JSON.parse(request.body); return response({ images: [] }); } });
  assert.deepEqual(body.tools, [{ googleSearch: {} }]);
  assert.equal(body.generationConfig.responseMimeType, undefined);
});
for (const [status, message] of [[400, /refusé/], [403, /refusé/], [404, /modèle/], [429, /quota/], [503, /indisponible/]]) {
  test(`HTTP ${status} is surfaced to the user`, async () => {
    await assert.rejects(askGemini({ key: 'key', prompt: 'test', fetchImpl: async () => ({ ok: false, status, json: async () => ({ error: {} }) }) }), message);
  });
}
test('missing key never invokes Google', async () => {
  await assert.rejects(askGemini({ key: '', fetchImpl: () => assert.fail('unexpected call') }), /clé/);
});
test('timeout restores control with an actionable error', async () => {
  await assert.rejects(askGemini({ key: 'key', prompt: 'test', timeoutMs: 5, fetchImpl: async (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error(), { name: 'AbortError' })))) }), /trop de temps/);
});
test('malformed, blocked, truncated and empty replies fail instead of fabricating results', async () => {
  for (const data of [{ candidates: [] }, { promptFeedback: { blockReason: 'SAFETY' } }, { candidates: [{ finishReason: 'MAX_TOKENS' }] }]) {
    await assert.rejects(askGemini({ key: 'key', prompt: 'test', fetchImpl: async () => ({ ok: true, json: async () => data }) }));
  }
  assert.throws(() => parseAIJson('not JSON'), /illisible/);
  assert.deepEqual(parseAIJson('```json\n{"name":"Cidre"}\n```'), { name: 'Cidre' });
});
test('sommelier cannot silently replace hallucinated bottle IDs with the first bottle', () => {
  const wines = [{ id: 'a' }, { id: 'b' }];
  assert.throws(() => resolveSommelier({ bestWineId: 'invented', reason: 'Accord' }, wines), /disponible/);
  assert.equal(resolveSommelier({ bestWineId: 'a', secondWineId: 'a', reason: 'Accord' }, wines).alternative, null);
  assert.equal(resolveSommelier({ bestWineId: 'a', secondWineId: 'b', reason: 'Accord' }, wines).alternative.id, 'b');
});
test('image candidates require an HTTPS photo and source', () => {
  const result = labelCandidates({ images: [{ url: 'javascript:alert(1)', source: 'https://example.com' }, { url: 'https://example.com/photo.jpg', source: 'https://example.com/wine', title: 'Domaine' }] });
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Domaine');
});
