import test from 'node:test';
import assert from 'node:assert/strict';
import { getVolumeMl, parseCl, catalogueVolume, eventCapacity, formatNote } from '../src/bottle-properties.js';
import { automaticService, serviceFingerprint, currentService, validateService, serviceSchedule } from '../src/service-advice.js';
import { demoSensor } from '../src/sensors.js';
import { scanFields } from '../src/cellar.js';
import { sameScanReference, planScanImport } from '../src/scanner.js';
import { consumeBottle } from '../src/inventory.js';
import { importCellarData } from '../src/accounts.js';
const categories = { Vin:{ types:['Rouge'],defaultShape:'bordeaux'}, Cidre:{types:['Cidre Brut'],defaultShape:'cider'} };
const wine = { id:'w', name:'Château Test', appellation:'Margaux', type:'Rouge', vintage:2015, quantity:2, wallId:'a',row:1,col:1, userNotes:'À garder', peakEnd:2035 };
const cellar = {walls:[{id:'a',name:'Mur',rows:1,cols:2}],wines:[wine],history:[]};
test('legacy wine defaults to 75cl; non-wine and explicitly unknown containers remain unknown',()=>{
 assert.equal(getVolumeMl(wine),750); assert.equal(getVolumeMl({type:'Whisky'}),null); assert.equal(getVolumeMl({...wine,volumeMl:null}),null);
 assert.equal(getVolumeMl({...wine,volumeMl:1500}),1500); assert.match(formatNote({...wine,volumeMl:1500}),/plus lentement/); assert.equal(wine.peakEnd,2035);
});
test('capacity input supports fractional cl and rejects unsafe or implausible capacities',()=>{
 assert.equal(parseCl('37,5'),375);assert.equal(parseCl('150'),1500);assert.equal(parseCl(''),null);
 for(const value of ['-75','0','NaN','5001','0.01']) assert.throws(()=>parseCl(value));
});
test('catalogue capacities use per-bottle amounts, not pack total or guessed units',()=>{
 for(const [quantity,ml] of [['75 cl',750],['0.75 L',750],['6x75cl',750],['6 × 37,5 cl',375],['750 ml ℮',750]]) assert.equal(catalogueVolume({quantity}),ml);
 assert.equal(catalogueVolume({quantity:'lot de 6 bouteilles total 4.5L',product_quantity:4500,product_quantity_unit:'ml'}),null);
 assert.equal(catalogueVolume({product_quantity:700,product_quantity_unit:'ml'}),700);assert.equal(catalogueVolume({product_quantity:750}),null);
});
test('scanned capacities and closures are retained; absent and manually unknown wine sizes differ',()=>{
 const detected = scanFields({...wine,category:'Vin',volumeMl:1500,closure:'wax'},categories);
 assert.equal(detected.volumeMl,1500);assert.equal(detected.volumeSource,'scan');assert.equal(detected.closure,'wax');
 assert.equal(scanFields({...wine,category:'Vin',volumeMl:null},categories).volumeMl,750);
 assert.equal(scanFields({...wine,category:'Vin',volumeMl:null,volumeSource:'manual'},categories).volumeMl,null);
 assert.throws(()=>scanFields({...wine,category:'Vin',volumeMl:-1},categories));
});
test('restocking distinguishes formats and known closures and aborts without mutation',()=>{
 assert.equal(sameScanReference(wine,{...wine,volumeMl:1500}),false);
 assert.equal(sameScanReference({...wine,closure:'natural_cork'},{...wine,closure:'screw_cap'}),false);
 assert.throws(()=>planScanImport(cellar,[{draft:{...wine,category:'Vin',volumeMl:1500},targetId:'w'}],{categories,defaults:{}}),/correspond/);
 assert.equal(cellar.wines[0].quantity,2);
});
test('event capacity reflects stock, format, custom portions and unknown or empty inventory',()=>{
 assert.equal(eventCapacity({...wine,volumeMl:1500}),24);assert.equal(eventCapacity({...wine,volumeMl:700},50),28);
 assert.equal(eventCapacity({...wine,volumeMl:null}),0);assert.equal(eventCapacity({...wine,quantity:0}),0);assert.equal(eventCapacity(wine,0),0);
});
test('backup round-trip and tasting history preserve formats and closures without sensor readings',()=>{
 const bottle={...wine,volumeMl:1500,closure:'natural_cork'};
 const restored=importCellarData(JSON.stringify({...cellar,wines:[bottle]})).cellar;
 const result=consumeBottle(restored.wines,[],bottle.id);
 assert.equal(result.history[0].volumeMl,1500);assert.equal(result.history[0].closure,'natural_cork');assert.equal(result.wines[0].peakEnd,2035);
 assert.equal(result.history[0].temperature,undefined);
 assert.throws(()=>importCellarData(JSON.stringify({...cellar,wines:[{...wine,volumeMl:0}]})),/contenance/);
});
test('service guidance is conservative for mature wines, no year, bubbles, cider and spirits',()=>{
 const mature=automaticService(wine,2026);assert.ok(mature.aerationMinutes<=15);assert.match(mature.sediment,/Si présent ou suspecté/);
 assert.equal(automaticService({...wine,vintage:null},2026).aerationMinutes,0);
 for(const type of ['Effervescent','Cidre Brut','Whisky']) assert.equal(automaticService({...wine,type}).aerationMinutes,0);
 const young=automaticService({...wine,vintage:2025,grapes:'Cabernet'},2026); assert.equal(young.aerationMinutes,30);
});
test('AI cache expires on format, closure, vintage or year changes; malformed advice falls back',()=>{
 const guide=automaticService(wine),fingerprint=serviceFingerprint(wine);
 const stored={...wine,serviceAdvice:{...guide,fingerprint}};assert.equal(currentService(stored).source,'ai');
 for(const changes of [{volumeMl:1500},{closure:'screw_cap'},{vintage:2024}]) assert.equal(currentService({...stored,...changes}).source,'automatic');
 assert.notEqual(serviceFingerprint(wine,2026),serviceFingerprint(wine,2027));
 assert.throws(()=>validateService({...guide,aerationMinutes:999}));
 assert.equal(currentService({...stored,serviceAdvice:{fingerprint}}).source,'automatic');
});
test('meal preparation subtracts aeration and conditional upright time across dates',()=>{
 const schedule=serviceSchedule({aerationMinutes:30,uprightHours:12},'2026-11-02T00:15:00Z');
 assert.equal(schedule.opening.toISOString(),'2026-11-01T23:45:00.000Z');assert.equal(schedule.upright.toISOString(),'2026-11-01T12:15:00.000Z');
 assert.equal(serviceSchedule({},''),null);
});
test('simulated sensors are deterministic, tied to location and never have a measurement timestamp',()=>{
 const a=demoSensor('cave','a',1,1);assert.deepEqual(a,demoSensor('cave','a',1,1));assert.equal(a.isSimulated,true);assert.equal(a.measuredAt,null);
 assert.notDeepEqual(a,demoSensor('cave','a',1,2));assert.notDeepEqual(a,demoSensor('other','a',1,1));
});
