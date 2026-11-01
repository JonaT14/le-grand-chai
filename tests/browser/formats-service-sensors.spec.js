import { test, expect } from '@playwright/test';
const key='lgc_cellar_data_MA-CAVE-PRINCIPALE';
const wine={id:'w',name:'Château Démonstration',appellation:'Margaux',type:'Rouge',grapes:'Cabernet Sauvignon',vintage:2015,wallId:'mur',row:1,col:1,quantity:2,peakStart:2020,peakEnd:2035,drinkLimit:2040,userRating:0,userNotes:'Mes notes',tastingAdvice:'Note initiale',foodPairing:[]};
async function seed(page,wines=[wine]) {await page.addInitScript(({key,wines})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({walls:[{id:'mur',name:'Mur test',rows:1,cols:3}],wines,history:[]}));localStorage.setItem('lgc_gemini_api_key','test-key');},{key,wines});}
const stored=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const open=page=>page.getByLabel('Château Démonstration, rangée 1, casier 1',{exact:true}).click();
test.beforeEach(async({page})=>{await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.route('https://fonts.gstatic.com/**',r=>r.abort());});
test('legacy format can be edited and retained after reload without changing maturity, notes or rating',async({page})=>{
 await seed(page);await page.goto('/');await page.getByRole('button',{name:'Château Démonstration, rangée 1, casier 1',exact:true}).press('Enter');
 await expect(page.getByLabel('Contenance (cl)',{exact:true})).toHaveValue('75');
 await page.getByLabel('Format du contenant',{exact:true}).selectOption('1500');await page.getByLabel('Bouchage',{exact:true}).selectOption('natural_cork');
 expect((await stored(page)).wines[0]).toMatchObject({volumeMl:1500,closure:'natural_cork',peakEnd:2035,userRating:0,userNotes:'Mes notes'});
 await page.reload();await open(page);await expect(page.getByLabel('Contenance (cl)',{exact:true})).toHaveValue('150');await expect(page.getByLabel('Bouchage',{exact:true})).toHaveValue('natural_cork');
 await expect(page.getByText('Note initiale',{exact:true})).toBeVisible();
});
for(const [button,size] of [['🍷 Vin','37,5'],['🍏 Cidre & Poiré','33'],['🥃 Spiritueux & Alcool','70']]) test(`custom container for ${button} persists and invalid capacity blocks adding`,async({page})=>{
 await seed(page,[]);await page.goto('/');await page.getByRole('button',{name:'Ajouter',exact:true}).click();await page.getByRole('button',{name:button,exact:true}).click();
 await expect(page.getByLabel('Contenance (cl)',{exact:true})).toHaveValue(button==='🍷 Vin'?'75':'');
 await page.getByLabel('Nom du domaine',{exact:true}).fill('Format test');await page.getByLabel('Contenance (cl)',{exact:true}).fill('-3');await page.getByRole('button',{name:'Déposer la bouteille dans la cave',exact:true}).click();expect((await stored(page)).wines).toHaveLength(0);
 await page.getByLabel('Contenance (cl)',{exact:true}).fill(size);await page.getByLabel('Bouchage',{exact:true}).selectOption('screw_cap');await page.getByRole('button',{name:'Déposer la bouteille dans la cave',exact:true}).click();
 expect((await stored(page)).wines[0]).toMatchObject({volumeMl:Number(size.replace(',','.'))*10,closure:'screw_cap'});
});
test('capacity filters use the actual stock and selected serving amount',async({page})=>{
 await seed(page,[{...wine,volumeMl:1500}]);await page.goto('/');const tile=page.getByLabel('Château Démonstration, rangée 1, casier 1',{exact:true});
 await page.getByLabel('Nombre de convives',{exact:true}).fill('20');await expect(tile).toHaveCSS('opacity','1');await page.getByLabel('Nombre de convives',{exact:true}).fill('25');await expect(tile).toHaveCSS('opacity','0.25');
 await page.getByLabel('Nombre de convives',{exact:true}).fill('');await page.getByLabel('Filtrer par contenance').selectOption('750');await expect(tile).toHaveCSS('opacity','0.25');await page.getByLabel('Filtrer par contenance').selectOption('1500');await expect(tile).toHaveCSS('opacity','1');
});
test('one wall sensor appears above the rack, follows wall selection and never enters bottle data',async({page})=>{
 await seed(page);await page.goto('/');
 const sensor=page.getByRole('region',{name:'Conditions simulées de Mur test',exact:true});
 await expect(sensor).toBeVisible();await expect(page.getByText('Conditions du mur · Démo',{exact:true})).toHaveCount(1);
 await expect(page.getByRole('button',{name:/Capteur démo rangée/})).toHaveCount(0);
 const tile=page.getByLabel('Château Démonstration, rangée 1, casier 1',{exact:true});
 await expect(tile).not.toContainText('°C');await expect(tile).not.toContainText('%');
 expect((await sensor.boundingBox()).y).toBeLessThan((await tile.boundingBox()).y);
 const reading=await sensor.innerText();await page.reload();await expect(sensor).toHaveText(reading,{useInnerText:true});
 await page.getByRole('button',{name:'Configurer murs',exact:true}).click();
 await page.getByRole('button',{name:/Ajouter un mur/}).click();await page.getByLabel('Fermer la configuration').click();
 await page.getByRole('button',{name:/Nouveau mur.*0\//}).click();
 await expect(page.getByRole('region',{name:/Conditions simulées de Nouveau mur/})).toBeVisible();await expect(sensor).toHaveCount(0);
 await page.getByRole('button',{name:/Mur test \(1\/3\)/}).click();await expect(sensor).toHaveText(reading,{useInnerText:true});
 await open(page);await page.getByLabel('Bouchage',{exact:true}).selectOption('wax');expect(JSON.stringify(await stored(page))).not.toMatch(/temperature|humidity|measuredAt/);
 await page.getByLabel('Fermer la bouteille',{exact:true}).click();await page.getByLabel('Afficher la démo des capteurs',{exact:true}).uncheck();await expect(sensor).toHaveCount(0);
});
test('service guide plans a meal, AI refinement is cached, and format edits invalidate it',async({page})=>{
 await seed(page);let calls=0;await page.route('**/generativelanguage.googleapis.com/**',r=>{calls++;return r.fulfill({json:{candidates:[{content:{parts:[{text:JSON.stringify({temperatureMin:16,temperatureMax:17,aerationMinutes:5,uprightHours:12,aeration:'Goûter et surveiller cinq minutes.',sediment:'Si un dépôt est visible, décanter doucement.'})}]}}]}});});
 await page.goto('/');await open(page);expect(calls).toBe(0);await page.getByLabel('Date et heure du repas').fill('2026-11-02T20:00');await expect(page.getByText(/Ouvrir \/ goûter vers/)).toContainText('19:50');
 await page.getByRole('button',{name:'Affiner avec Google IA',exact:true}).click();await expect(page.getByText('Goûter et surveiller cinq minutes.',{exact:false})).toBeVisible();expect(calls).toBe(1);
 await page.reload();await open(page);await expect(page.getByText(/Suggestions Google IA/)).toBeVisible();expect(calls).toBe(1);
 await page.getByLabel('Format du contenant').selectOption('1500');await expect(page.getByText(/Repères automatiques par style/)).toBeVisible();
});
test('scanning reads capacity and closure, then preserves manual corrections before import',async({page})=>{
 await seed(page,[]);await page.route('**/generativelanguage.googleapis.com/**',r=>r.fulfill({json:{candidates:[{content:{parts:[{text:JSON.stringify({name:'Magnum Scanné',category:'Vin',type:'Rouge',vintage:2020,volumeMl:1500,closure:'wax'})}]}}]}}));
 await page.goto('/');await page.getByRole('button',{name:'Scanner',exact:true}).click();await page.getByRole('button',{name:'Import en masse',exact:true}).click();
 await page.getByLabel('Photos à importer').setInputFiles({name:'magnum.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')});
 await page.getByRole('button',{name:'Analyser les photos restantes',exact:true}).click();await expect(page.getByLabel('Contenance (cl)',{exact:true})).toHaveValue('150');await expect(page.getByLabel('Bouchage',{exact:true})).toHaveValue('wax');
 await page.getByLabel('Contenance (cl)',{exact:true}).fill('0');await page.getByRole('button',{name:'Ajouter la sélection à la cave',exact:true}).click();expect((await stored(page)).wines).toHaveLength(0);
 await page.getByLabel('Contenance (cl)',{exact:true}).fill('300');await page.getByRole('button',{name:'Ajouter la sélection à la cave',exact:true}).click();await expect(page.getByRole('status')).toContainText('1 bouteille');expect((await stored(page)).wines[0]).toMatchObject({volumeMl:3000,closure:'wax'});
});

test('phone layout keeps format controls and service guidance inside the screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page,[{...wine,volumeMl:700}]);await page.goto('/');
 await expect(page.getByLabel('Filtrer par contenance').getByRole('option',{name:'70 cl',exact:true})).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.locator('.wood-cabinet').scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/cave-bois-mobile.png',fullPage:false});
 await open(page);await page.getByLabel('Format du contenant').selectOption('4500');await page.getByLabel('Bouchage',{exact:true}).selectOption('wax');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.getByLabel('Date et heure du repas').fill('2026-11-02T20:00');
 await expect(page.getByText(/Ouvrir \/ goûter vers/)).toBeVisible();
 await page.screenshot({path:'test-results/formats-service-mobile.png',fullPage:true});
});
