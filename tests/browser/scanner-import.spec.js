import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { ean13Svg } from '../fixtures/barcode.js';
const account='MA-CAVE-PRINCIPALE', dataKey=`lgc_cellar_data_${account}`;
const api='**/generativelanguage.googleapis.com/**';
const code='1234567890128';
const photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
const file=name=>({name,mimeType:'image/png',buffer:photo});
const reply=value=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]});
const wine=(name='Château Importé',changes={})=>({name,category:'Vin',type:'Rouge',appellation:'Bordeaux',region:'Bordeaux',vintage:2020,...changes});
const empty=cols=>({walls:[{id:'mur',name:'Mur test',rows:1,cols}],wines:[],history:[]});
async function seed(page,cellar, key=true){await page.addInitScript(({cellar,key,dataKey})=>{if(key)localStorage.setItem('lgc_gemini_api_key','test-key'); if(cellar&&!localStorage.getItem(dataKey))localStorage.setItem(dataKey,JSON.stringify(cellar));},{cellar,key,dataKey});}
async function stored(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),dataKey);}
async function scanner(page){await page.goto('/');await page.getByRole('button',{name:'Scanner',exact:true}).click();}
async function batch(page,files=[file('premiere.png'),file('deuxieme.png')]){await scanner(page);await page.getByRole('button',{name:'Import en masse',exact:true}).click();await page.getByLabel('Photos à importer').setInputFiles(files);await page.getByRole('button',{name:'Analyser les photos restantes',exact:true}).click();}
test.beforeEach(async({page})=>{
  await page.addInitScript(() => localStorage.setItem('lgc_appearance', JSON.stringify({ theme:'dark', presentation:'premium', landing:'cellar' })));await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.route('https://fonts.gstatic.com/**',r=>r.abort());});

test('barcode photo decodes with the real cross-browser reader and saves the photo, source and code',async({page})=>{
 await seed(page,null,false);
 await page.addInitScript(()=>{Object.defineProperty(window,'BarcodeDetector',{value:undefined,configurable:true});});
 await page.route(api,()=>{throw new Error('Barcode lookup must not call Gemini');});
 await page.route('https://world.openfoodfacts.org/api/v3/product/**',route=>route.fulfill({json:{product:{code,product_name:'Château Catalogue',categories:'Vins rouges',appellation:'Bordeaux',vintage:2015}}}));
 await scanner(page);await page.getByRole('button',{name:'Code-barres',exact:true}).click();
 await page.getByLabel('Photo du code-barres').setInputFiles({name:'ean13.svg',mimeType:'image/svg+xml',buffer:Buffer.from(ean13Svg())});
 await expect(page.getByLabel('Nom du domaine',{exact:true})).toHaveValue('Château Catalogue');
 await expect(page.getByLabel('Code-barres de la bouteille')).toHaveValue(code);
 await expect(page.getByLabel('Millésime',{exact:true})).toHaveValue('');
 await expect(page.getByAltText('Photo à vérifier')).toBeVisible();
 await page.getByRole('button',{name:'Déposer la bouteille dans la cave',exact:true}).click();
 const added=(await stored(page)).wines.find(w=>w.barcode===code);
 expect(added.vintage).toBeNull();expect(added.customLabelUrl).toContain('data:image/jpeg;base64,');
 expect(added.barcodeSource).toBe(`https://world.openfoodfacts.org/product/${code}`);
 await page.reload(); await page.getByLabel(`Château Catalogue, rangée ${added.row}, casier ${added.col}`,{exact:true}).click();
 await expect(page.getByRole('link',{name:'Source Open Food Facts',exact:true})).toHaveAttribute('href',added.barcodeSource);
});

test('typed barcode validates checksum and handles an unknown catalogue reference without inventing a wine',async({page})=>{
 await seed(page,null,false);let calls=0;
 await page.route('https://world.openfoodfacts.org/api/v3/product/**',r=>{calls++;return r.fulfill({status:404,json:{status:0}});});
 await scanner(page);await page.getByRole('button',{name:'Code-barres',exact:true}).click();
 await page.getByLabel('Numéro du code-barres').fill('1234567890129');await page.getByRole('button',{name:'Rechercher le code-barres',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('invalide');expect(calls).toBe(0);
 await page.getByLabel('Numéro du code-barres').fill(code);await page.getByRole('button',{name:'Rechercher le code-barres',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('catalogue');expect(calls).toBe(1);
 await expect(page.getByLabel('Nom du domaine',{exact:true})).toHaveCount(0);
});

test('bulk photos are reviewed, edited and committed once with quantities and retained images',async({page})=>{
 await seed(page,empty(4));let calls=0;
 await page.route(api,route=>route.fulfill({json:reply(++calls===1?wine():wine('Cidre Importé',{category:'Cidre',type:'Cidre Brut',vintage:null}))}));
 await batch(page);
 await expect(page.getByLabel('Nom de la fiche 2')).toHaveValue('Cidre Importé',{timeout:15000});
 expect((await stored(page)).wines).toHaveLength(0);
 await page.getByLabel('Nom de la fiche 1').fill('Château Corrigé');
 await page.getByLabel('Quantité de la fiche 1').fill('3');await page.getByLabel('Quantité de la fiche 2').fill('30');
 await page.getByRole('button',{name:'Ajouter la sélection à la cave',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('33 bouteille');
 const data=await stored(page); expect(data.wines).toHaveLength(2);expect(data.history).toHaveLength(0);
 expect(data.wines[0].name).toBe('Château Corrigé');expect(data.wines[1].quantity).toBe(30);expect(data.wines[1].bottleShape).toBe('cider');
 expect(data.wines.every(w=>w.customLabelUrl?.startsWith('data:image/jpeg;base64,'))).toBe(true);
 expect(new Set(data.wines.map(w=>`${w.row}/${w.col}`)).size).toBe(2);
 await page.reload();await expect(page.getByLabel('Stock total de la cave')).toContainText('33 bouteilles');
});

test('restocking a duplicate is explicit and keeps its label, personal notes and zero rating',async({page})=>{
 const old={...wine(),id:'old',wallId:'mur',row:1,col:1,quantity:0,userRating:0,userNotes:'Ne pas remplacer',customLabelUrl:'data:image/png;base64,'+photo.toString('base64')};
 await seed(page,{...empty(1),wines:[old]});await page.route(api,r=>r.fulfill({json:reply(wine())}));
 await batch(page,[file('reassort.png')]);await expect(page.getByLabel('Nom de la fiche 1')).toHaveValue(old.name);
 await page.getByLabel('Destination de la fiche 1').selectOption('old');
 await page.getByLabel('Quantité de la fiche 1').fill('30');
 await expect(page.getByLabel('Destination de la fiche 1')).toHaveValue('old');
 await page.getByRole('button',{name:'Ajouter la sélection à la cave',exact:true}).click();
 expect((await stored(page)).wines).toEqual([{...old,quantity:30}]);
});

test('a full cellar rejects the whole batch and allows excluding an item before retry',async({page})=>{
 const before=empty(1); await seed(page,before);let calls=0;
 await page.route(api,r=>r.fulfill({json:reply(wine('Vin '+(++calls)))}));
 await batch(page);await expect(page.getByLabel('Nom de la fiche 2')).toHaveValue('Vin 2',{timeout:15000});
 await page.getByRole('button',{name:'Ajouter la sélection à la cave',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('casiers libres');expect(await stored(page)).toEqual(before);
 await page.getByLabel('Inclure la fiche 2').uncheck();await page.getByRole('button',{name:'Ajouter la sélection à la cave',exact:true}).click();
 expect((await stored(page)).wines).toHaveLength(1);
});

test('storage failure does not change the cellar or discard reviewed drafts',async({page})=>{
 const before=empty(2);await seed(page,before);
 await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(window.failScanStorage&&key.startsWith('lgc_cellar_data_'))throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};});
 await page.route(api,r=>r.fulfill({json:reply(wine())}));await batch(page,[file('photo.png')]);
 await expect(page.getByLabel('Nom de la fiche 1')).toHaveValue('Château Importé');
 await page.evaluate(()=>{window.failScanStorage=true;});await page.getByRole('button',{name:'Ajouter la sélection à la cave',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Rien n’a été ajouté');expect(await stored(page)).toEqual(before);
 await expect(page.getByLabel('Nom de la fiche 1')).toHaveValue('Château Importé');
 await page.evaluate(()=>{window.failScanStorage=false;});await page.getByRole('button',{name:'Ajouter la sélection à la cave',exact:true}).click();
 expect((await stored(page)).wines).toHaveLength(1);
});

test('an unreadable item can be corrected manually while other photos are excluded',async({page})=>{
 await seed(page,empty(3));let calls=0;
 await page.route(api,r=>{calls++;return r.fulfill({json:reply(wine('',{}))});});
 await batch(page);await expect(page.getByRole('button',{name:'Remplir manuellement la fiche 1',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Arrêter l’analyse',exact:true}).click();
 await page.getByRole('button',{name:'Remplir manuellement la fiche 1',exact:true}).click();
 await page.getByLabel('Nom de la fiche 1').fill('Domaine saisi');await page.getByLabel('Inclure la fiche 2').uncheck();
 await page.getByRole('button',{name:'Ajouter la sélection à la cave',exact:true}).click();
 expect((await stored(page)).wines[0].name).toBe('Domaine saisi');expect(calls).toBe(1);
});

test('cancelling a batch preserves finished drafts and resuming does not analyze them twice',async({page})=>{
 await seed(page,empty(3));let calls=0,pending;
 await page.route(api,r=>{calls++;if(calls===2){pending=r;return;}return r.fulfill({json:reply(wine('Vin '+calls))});});
 await batch(page);await expect.poll(()=>Boolean(pending),{timeout:15000}).toBe(true);
 await page.getByRole('button',{name:'Arrêter l’analyse',exact:true}).click();await pending.abort().catch(()=>{});
 await expect(page.getByLabel('Nom de la fiche 1')).toHaveValue('Vin 1');
 await page.getByRole('button',{name:'Analyser les photos restantes',exact:true}).click();
 await expect(page.getByLabel('Nom de la fiche 2')).toHaveValue('Vin 3',{timeout:15000});expect(calls).toBe(3);
 await page.getByRole('button',{name:'Ajouter la sélection à la cave',exact:true}).click();expect((await stored(page)).wines).toHaveLength(2);
});

test('mobile bulk review fits the screen and rejects more than twenty photos',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page,empty(4));await page.route(api,r=>r.fulfill({json:reply(wine())}));
 await scanner(page);await page.getByRole('button',{name:'Import en masse',exact:true}).click();
 await page.getByLabel('Photos à importer').setInputFiles(Array.from({length:21},(_,i)=>file(`photo-${i}.png`)));
 await expect(page.getByRole('alert')).toContainText('20 photos');
 await page.getByLabel('Photos à importer').setInputFiles(file('une-photo.png'));await page.getByRole('button',{name:'Analyser les photos restantes',exact:true}).click();
 await expect(page.getByLabel('Nom de la fiche 1')).toHaveValue('Château Importé');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.screenshot({path:'test-results/import-masse-mobile.png',fullPage:true});
});

test('an unknown photographed barcode remains available when creating a manual record',async({page})=>{
 await seed(page,null,false);await page.route('https://world.openfoodfacts.org/api/v3/product/**',r=>r.fulfill({status:404,json:{status:0}}));
 await scanner(page);await page.getByRole('button',{name:'Code-barres',exact:true}).click();
 await page.getByLabel('Photo du code-barres').setInputFiles({name:'inconnu.svg',mimeType:'image/svg+xml',buffer:Buffer.from(ean13Svg())});
 await expect(page.getByRole('alert')).toContainText('catalogue');await expect(page.getByLabel('Numéro du code-barres')).toHaveValue(code);
 await page.getByRole('button',{name:'Garder cette photo et remplir la fiche manuellement',exact:true}).click();
 await expect(page.getByLabel('Nom du domaine',{exact:true})).toHaveValue('');await expect(page.getByLabel('Code-barres de la bouteille')).toHaveValue(code);
 await expect(page.getByAltText('Photo à vérifier')).toBeVisible();
});

test('barcode photos can be imported in bulk without any AI key',async({page})=>{
 await seed(page,empty(2),false);await page.route(api,()=>{throw new Error('Barcode batch must not call Gemini');});
 await page.route('https://world.openfoodfacts.org/api/v3/product/**',r=>r.fulfill({json:{product:{code,product_name:'Domaine Catalogue',categories_tags:['en:white-wines'],appellation:'Sancerre'}}}));
 await scanner(page);await page.getByRole('button',{name:'Import en masse',exact:true}).click();await page.getByLabel('Contenu des photos').selectOption('barcode');
 await page.getByLabel('Photos à importer').setInputFiles({name:'code.svg',mimeType:'image/svg+xml',buffer:Buffer.from(ean13Svg())});
 await page.getByRole('button',{name:'Analyser les photos restantes',exact:true}).click();
 await expect(page.getByLabel('Nom de la fiche 1')).toHaveValue('Domaine Catalogue');await expect(page.getByLabel('Type de la fiche 1')).toHaveValue('Blanc');
 await expect(page.getByLabel('Millésime de la fiche 1')).toHaveValue('');await page.getByRole('button',{name:'Ajouter la sélection à la cave',exact:true}).click();
 const added=(await stored(page)).wines[0];expect(added.barcode).toBe(code);expect(added.type).toBe('Blanc');expect(added.customLabelUrl).toContain('data:image/jpeg;base64,');
});

test('removing or choosing the same photo does not discard the other drafts',async({page},testInfo)=>{
 await seed(page,empty(3));await scanner(page);await page.getByRole('button',{name:'Import en masse',exact:true}).click();
 const selected=[testInfo.outputPath('garder.png'),testInfo.outputPath('retirer.png')];for(const path of selected)await writeFile(path,photo);await page.getByLabel('Photos à importer').setInputFiles(selected);
 await page.getByLabel('Photos à importer').setInputFiles(selected);await expect(page.getByRole('alert')).toContainText('déjà dans la liste');
 await page.getByRole('button',{name:'Retirer la photo 2',exact:true}).click();await expect(page.getByText('Photo 1 : garder.png',{exact:true})).toBeVisible();await expect(page.getByText('Photo 2 : retirer.png',{exact:true})).toHaveCount(0);
});

test('closing a pending scan and switching cellars cannot populate or change the other cellar',async({page})=>{
 const before=empty(3);await seed(page,before);await page.addInitScript(data=>{localStorage.setItem('lgc_cellar_data_CAVE-DE-PAPA',JSON.stringify(data));},empty(4));
 let pending;await page.route(api,r=>{pending=r;});await scanner(page);await page.getByLabel('Photo à analyser').setInputFiles(file('attente.png'));
 await expect.poll(()=>Boolean(pending)).toBe(true);await page.getByRole('button',{name:'Fermer le scanner',exact:true}).click();
 await page.getByRole('button',{name:'Comptes, Drive Kava 20 & Clé IA',exact:true}).click();await page.getByRole('button',{name:'Cave de Papa Papa',exact:true}).click();await page.getByRole('button',{name:'Fermer les paramètres',exact:true}).click();
 await pending.abort().catch(()=>{});await expect(page.getByLabel('Nom du domaine',{exact:true})).toHaveCount(0);
 expect(await stored(page)).toEqual(before);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('lgc_cellar_data_CAVE-DE-PAPA')).wines)).toHaveLength(0);
});
