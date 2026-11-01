import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBarcode, barcodeProduct, lookupBarcode, planScanImport, sameScanReference, waitScanTurn } from '../src/scanner.js';
import { askGemini } from '../src/ai.js';
const categories = { Vin: { types: ['Rouge','Blanc','Rosé','Effervescent','Liquoreux'], defaultShape: 'bordeaux' }, Cidre: { types: ['Cidre Brut','Cidre Doux','Cidre Demi-Sec','Poiré','Pommeau'], defaultShape: 'cider' }, Alcool: { types: ['Whisky','Rhum','Calvados','Cognac','Armagnac','Chartreuse & Liqueur','Gin & Eau-de-vie'], defaultShape: 'spirit' } };
const code = '1234567890128';
const draft = changes => ({ name: 'Château Exemple', category: 'Vin', type: 'Rouge', appellation: 'Bordeaux', vintage: '2020', quantity: '2', customLabelUrl: 'data:image/jpeg;base64,AA==', ...changes });
const options = { categories, defaults: { peakStart: 2026, peakEnd: 2034, drinkLimit: 2038, userNotes: '', webRating: null }, preferredWallId: 'mur' };
const cellar = () => ({ walls: [{ id: 'mur', rows: 1, cols: 3 }], wines: [{ id: 'old', name: 'Château Exemple', type: 'Rouge', vintage: 2020, quantity: 1, wallId: 'mur', row: 1, col: 1, userRating: 0, userNotes: 'Personnel', customLabelUrl: 'photo originale' }], history: [{ id: 'h1', name: 'Archive' }] });

test('EAN / UPC check digits preserve leading zeros and reject malformed or injected identifiers', async () => {
  for (const valid of ['96385074','036000291452','4006381333931',code,'10012345000017']) assert.equal(normalizeBarcode(valid), valid);
  assert.equal(normalizeBarcode(' 4006 3813-33931 '), '4006381333931');
  for (const invalid of ['', '123', '4006381333932', 'https://example.com', '1234567890128?x=secret']) {
    await assert.rejects(lookupBarcode(invalid, { fetchImpl: () => assert.fail('invalid code must never fetch') }));
  }
});
test('barcode catalogue maps drinks, attributes the source and never assumes the vintage from a shared code', () => {
  const fields = barcodeProduct({ product: { product_name: 'Réserve 2015', brands: 'Château Exemple', categories_tags: ['en:red-wines'], origins: 'France', vintage: 2015 } }, code);
  assert.equal(fields.name, 'Château Exemple — Réserve 2015');
  assert.equal(fields.type, 'Rouge'); assert.equal(fields.vintage, '');
  assert.equal(fields.barcodeSource, `https://world.openfoodfacts.org/product/${code}`);
  assert.equal(barcodeProduct({ product: { product_name: 'Poire', categories: 'Poirés' } }, code).type, 'Poiré');
  assert.equal(barcodeProduct({ product: { product_name: 'XO', categories: 'Calvados' } }, code).type, 'Calvados');
  assert.throws(() => barcodeProduct({ status: 0 }, code), /catalogue/);
  assert.throws(() => barcodeProduct({ product: { product_name: 'Chocolat', categories: 'Chocolates' } }, code), /boisson|vin/);
  assert.throws(() => barcodeProduct({ product: { product_name: 'Autre', categories: 'Wine', code: '4006381333931' } }, code), /autre référence/);
});
test('catalogue failures and absent products produce actionable errors without AI requests', async () => {
  for (const status of [404,429,503]) await assert.rejects(lookupBarcode(code,{useCache:false,fetchImpl:async()=>({ok:false,status})}),/catalogue/);
  let calls=0;
  const fetchImpl=async url=>{calls++; assert.ok(url.includes(`/api/v3/product/${code}?fields=`)); return {ok:true,json:async()=>({product:{product_name:'Vin test',categories:'Vin rouge'}})};};
  assert.equal((await lookupBarcode(code,{useCache:false,fetchImpl})).name,'Vin test');
  await lookupBarcode(code,{fetchImpl}); assert.equal(calls,1);
});
test('bulk import plans unique slots, quantities and photos without mutating the original cellar', () => {
  const before=cellar(), snapshot=structuredClone(before);
  const next=planScanImport(before,[{draft:draft()},{draft:draft({name:'Cidre du verger',category:'Cidre',type:'Cidre Brut',vintage:'',quantity:30,barcode:code})}],options);
  assert.deepEqual(before,snapshot); assert.equal(next.wines.length,3);
  assert.equal(new Set(next.wines.map(w=>`${w.wallId}/${w.row}/${w.col}`)).size,3);
  assert.equal(next.wines[1].customLabelUrl,draft().customLabelUrl); assert.equal(next.wines[2].quantity,30);
  assert.equal(next.wines[2].vintage,null); assert.equal(next.wines[2].bottleShape,'cider');
  assert.equal(next.wines[2].barcode,code); assert.equal(next.wines[2].userRating,null); assert.equal(next.bottles,32);
});
test('stock merging is explicit and preserves the existing photo, personal notes, zero rating and location', () => {
  const before=cellar();
  const next=planScanImport(before,[{draft:draft({quantity:'30'}),targetId:'old'}],options);
  assert.deepEqual(next.wines[0],{...before.wines[0],quantity:31});
  assert.equal(next.added,0); assert.equal(next.restocked,1);
  assert.equal(sameScanReference(before.wines[0],draft({vintage:2021})),false);
  assert.throws(()=>planScanImport(before,[{draft:draft({vintage:2021}),targetId:'old'}],options),/correspond/);
});
test('a full cellar, invalid selected row or overflowing restock aborts the entire batch', () => {
  const before=cellar(),snapshot=structuredClone(before);
  assert.throws(()=>planScanImport(before,Array.from({length:3},()=>({draft:draft()})),options),/casiers libres/);
  for(const changes of [{name:''},{vintage:String(new Date().getFullYear()+1)},{vintage:'2019.5'},{quantity:-1},{quantity:'1.5'},{type:'inventé'}]) assert.throws(()=>planScanImport(before,[{draft:draft()},{draft:draft(changes)}],options));
  assert.throws(()=>planScanImport(before,[{draft:draft({quantity:Number.MAX_SAFE_INTEGER}),targetId:'old'}],options),/entier/);
  assert.deepEqual(before,snapshot);
});
test('spacing between scans can be cancelled immediately', async () => {
  const controller=new AbortController();
  const promise=waitScanTurn(Date.now(),{signal:controller.signal}); controller.abort();
  await assert.rejects(promise,/annulée/);
});
test('cancelling a scanner request aborts Google and does not masquerade as a timeout', async () => {
  const controller=new AbortController();
  const promise=askGemini({key:'test',prompt:'Scanner',signal:controller.signal,fetchImpl:async(_, {signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error(),{name:'AbortError'}))))});
  controller.abort(); await assert.rejects(promise,/annulée/);
});
