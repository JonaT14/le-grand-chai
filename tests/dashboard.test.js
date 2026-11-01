import test from 'node:test';import assert from 'node:assert/strict';
import {regionName,appendMovements,valuation,parseValue,distribution,colourGroup,dueBottles,stockMovements,validMovements,widgetPreferences,readAppearance} from '../src/dashboard.js';
import {importCellarData} from '../src/accounts.js';
const wine={id:'a',name:'Cuvée Test',type:'Rouge',quantity:3,unitValueCents:1250,region:'Bordeaux',peakEnd:2027,drinkLimit:2030,wallId:'a',row:1,col:1};
test('valuation weights stock, preserves zero prices and excludes missing values and exhausted bottles',()=>{
 assert.deepEqual(valuation([wine,{...wine,id:'b',quantity:2,unitValueCents:null},{...wine,id:'c',quantity:1,unitValueCents:0},{...wine,id:'d',quantity:0,unitValueCents:50000}]),{cents:3750,priced:4,unknown:2});
 assert.deepEqual(valuation([{type:'Whisky'}]),{cents:0,priced:0,unknown:1});
});
test('money accepts cent precision and unknown but rejects negative or malformed prices',()=>{
 assert.equal(parseValue('12,50'),1250);assert.equal(parseValue('0'),0);assert.equal(parseValue(''),null);
 for(const raw of ['-1','12.999','NaN','1000001','1e3'])assert.throws(()=>parseValue(raw));
});
test('colour and region distributions count bottles and keep cider and spirits separate',()=>{
 assert.equal(regionName({region:42}),'');
 const wines=[wine,{...wine,id:'b',region:' bordeaux ',quantity:2,type:'Cidre Brut'},{...wine,id:'c',region:'',quantity:4,type:'Whisky'},{...wine,quantity:0,type:'Rosé'}];
 assert.deepEqual(distribution(wines,w=>w.region.trim()).map(r=>r.count),[5,4]);
 assert.deepEqual(distribution(wines,colourGroup).map(r=>r.label),['Spiritueux','Rouge','Cidres & poirés']);
});
test('near-term bottles require actual dates and available stock, and exclude spirits',()=>{
 const due=dueBottles([wine,{...wine,id:'old',drinkLimit:2025},{...wine,id:'empty',quantity:0},{...wine,id:'spirit',type:'Whisky'},{...wine,id:'missing',peakEnd:null,drinkLimit:null},{...wine,id:'later',peakEnd:2032}],2026);
 assert.deepEqual(due.map(d=>d.wine.id),['old','a']);assert.match(due[0].reason,/Limite/);
});
test('stock movements distinguish consumption from corrections and do not treat edits or moves as entries',()=>{
 const date=new Date('2026-11-01T16:00:00Z'),makeId=()=> 'event';
 assert.deepEqual(stockMovements([wine],[{...wine,row:2,userNotes:'Un changement',unitValueCents:2000}],[],[],date,makeId),[]);
 const consumed=stockMovements([wine],[{...wine,quantity:2}],[],[{id:'h',sourceWineId:'a'}],date,makeId);
 assert.equal(consumed[0].reason,'Dégustation');assert.equal(consumed[0].quantity,1);assert.equal(consumed[0].at,date.toISOString());
 const corrected=stockMovements([wine],[{...wine,quantity:2}],[{id:'h',sourceWineId:'a'}],[{id:'h',sourceWineId:'a'}],date,makeId);
 assert.equal(corrected[0].reason,'Correction de stock');
 assert.equal(stockMovements([], [wine],[],[],date,makeId)[0].quantity,3);
});
test('movement snapshots survive export/import and malformed journals or prices are rejected',()=>{
 const movements=stockMovements([], [wine]),cellar={walls:[{id:'a',name:'Mur',rows:1,cols:1}],wines:[wine],history:[],movements};
 assert.equal(validMovements(movements),true);assert.deepEqual(importCellarData(JSON.stringify(cellar)).cellar.movements,movements);
 assert.throws(()=>importCellarData(JSON.stringify({...cellar,movements:[{...movements[0],quantity:-1}]})),/journal/);
 assert.throws(()=>importCellarData(JSON.stringify({...cellar,wines:[{...wine,unitValueCents:12.5}]})),/valeur/);
});
test('widget order and appearance tolerate corrupt preferences and preserve only supported choices',()=>{
 const p=widgetPreferences({order:['regions','bad','regions'],hidden:['bad','value']});assert.equal(p.order[0],'regions');assert.equal(new Set(p.order).size,p.order.length);assert.deepEqual(p.hidden,['value']);
 assert.deepEqual(readAppearance({getItem:()=>'{bad'}),{theme:'dark',presentation:'premium',landing:'dashboard'});
 assert.equal(readAppearance({getItem:()=>JSON.stringify({presentation:'classic',theme:'light',landing:'cellar'})}).presentation,'classic');
});

test('successive correction keystrokes become a single net movement, while tastings remain separate',()=>{
 const event={id:'first',at:'2026-11-01T10:00:00Z',wineId:'a',name:'Vin',direction:'out',quantity:28,reason:'Correction de stock'};
 const final={...event,id:'second',at:'2026-11-01T10:00:01Z',direction:'in',quantity:23};
 const merged=appendMovements([event],[final]);assert.equal(merged.length,1);assert.equal(merged[0].quantity,5);assert.equal(merged[0].direction,'out');
 assert.equal(appendMovements([event],[{...final,quantity:28}]).length,0);
 assert.equal(appendMovements([event],[{...final,reason:'Dégustation'}]).length,2);
});
