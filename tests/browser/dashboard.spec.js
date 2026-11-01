import {test,expect} from '@playwright/test';
const key='lgc_cellar_data_MA-CAVE-PRINCIPALE';
const red={id:'red',name:'Château Accueil',type:'Rouge',category:'Vin',region:'Bordeaux',appellation:'Margaux',vintage:2020,peakEnd:2027,drinkLimit:2030,quantity:3,unitValueCents:1000,wallId:'mur',row:1,col:1,userRating:0,userNotes:'Mes notes',foodPairing:[]};
const cider={...red,id:'cider',name:'Cidre du Verger',type:'Cidre Brut',category:'Cidre',region:'Normandie',quantity:30,unitValueCents:null,peakEnd:null,drinkLimit:null,col:2};
const empty={...red,id:'empty',name:'Ancienne Réserve',quantity:0,unitValueCents:99900,col:3};
const cellar={walls:[{id:'mur',name:'Mur de test',rows:1,cols:4}],wines:[red,cider,empty],history:[],movements:[]};
async function seed(page,data=cellar){await page.addInitScript(({key,data})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(data));},{key,data});}
async function stored(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);}
async function home(page){await page.getByRole('button',{name:'Accueil',exact:true}).click();}
async function appearance(page){await page.getByRole('button',{name:'Apparence et accueil',exact:true}).click();}
async function openRed(page){await page.getByRole('region',{name:'Fiches de la collection',exact:true}).getByRole('button',{name:/Château Accueil/}).click();}
test.beforeEach(async({page})=>{await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.route('https://fonts.gstatic.com/**',r=>r.abort());});
test('home uses actual stock, partial values and maturity dates and its distributions open the matching cellar',async({page})=>{
 await seed(page);await page.goto('/');await expect(page.getByRole('heading',{name:'Votre cave, à son meilleur.',exact:true})).toBeVisible();
 const stats=page.getByRole('region',{name:'Chiffres de la cave'});await expect(stats).toContainText('33');await expect(stats).toContainText('30 €');
 await expect(page.getByRole('region',{name:'Valeur estimée',exact:true})).toContainText('30 bouteille(s) sans valeur');
 const due=page.getByRole('region',{name:'À ouvrir prochainement',exact:true});await expect(due).toContainText('Château Accueil');await expect(due).not.toContainText('Ancienne Réserve');await expect(due).not.toContainText('Cidre du Verger');
 const colours=page.getByRole('region',{name:'Répartition par couleur',exact:true});await colours.getByRole('button',{name:/Cidres & poirés/}).click();
 await expect(page.getByRole('button',{name:'Cidre du Verger, rangée 1, casier 2',exact:true})).toHaveCSS('opacity','1');await expect(page.getByRole('button',{name:'Château Accueil, rangée 1, casier 1',exact:true})).toHaveCSS('opacity','0.25');
 await home(page);expect((await stored(page)).movements).toHaveLength(0);
});
test('editing a value updates the dashboard; drinking and corrections create distinct lasting movements',async({page})=>{
 await seed(page);await page.goto('/');await openRed(page);await page.getByLabel('Valeur estimée par bouteille (€)',{exact:true}).fill('12,50');
 await page.getByLabel('Quantité en stock',{exact:true}).fill('4');await page.getByLabel('Quantité en stock',{exact:true}).blur();
 await page.getByRole('button',{name:'Boire une bouteille (Retirer 1 et archiver)',exact:true}).click();
 await expect(page.getByRole('region',{name:'Valeur estimée',exact:true})).toContainText('37,5');
 const data=await stored(page);expect(data.wines[0]).toMatchObject({quantity:3,unitValueCents:1250,userRating:0,userNotes:'Mes notes'});expect(data.movements.map(m=>m.reason)).toEqual(['Dégustation','Correction de stock']);expect(data.history).toHaveLength(1);
 await page.reload();await expect(page.getByRole('region',{name:'Dernières entrées et sorties',exact:true})).toContainText('Dégustation');expect((await stored(page)).movements).toHaveLength(2);
});
test('adding on the home page records one real entry with the chosen stock and price',async({page})=>{
 await seed(page);await page.goto('/');await page.getByRole('button',{name:'Ajouter',exact:true}).click();await page.getByLabel('Nom du domaine',{exact:true}).fill('Nouveau lot');await page.getByLabel('Nombre de bouteilles à ajouter',{exact:true}).fill('6');await page.getByLabel('Valeur estimée par bouteille (€)',{exact:true}).fill('-1');await page.getByRole('button',{name:'Déposer la bouteille dans la cave',exact:true}).click();expect((await stored(page)).wines).toHaveLength(3);
 await page.getByLabel('Valeur estimée par bouteille (€)',{exact:true}).fill('20');await page.getByRole('button',{name:'Déposer la bouteille dans la cave',exact:true}).click();await expect(page.getByRole('region',{name:'Chiffres de la cave'})).toContainText('39');
 const data=await stored(page);expect(data.movements).toHaveLength(1);expect(data.movements[0]).toMatchObject({quantity:6,reason:'Ajout à la cave',direction:'in'});await expect(page.getByRole('region',{name:'Valeur estimée',exact:true})).toContainText('150');
});
test('light and dark themes persist and apply to home, bottle fields and the cellar without changing data',async({page})=>{
 await seed(page);await page.goto('/');await appearance(page);await page.getByRole('button',{name:'Clair',exact:true}).click();await page.getByRole('button',{name:'Fermer l’apparence',exact:true}).click();
 await expect(page.locator('.chai-app')).toHaveAttribute('data-theme','light');await expect(page.locator('.chai-app')).toHaveCSS('background-color','rgb(244, 240, 232)');await page.screenshot({path:'test-results/accueil-premium-clair.png',fullPage:true});
 await openRed(page);await expect(page.getByLabel('Valeur estimée par bouteille (€)',{exact:true})).toBeVisible();await page.getByLabel('Fermer la bouteille',{exact:true}).click();
 await page.reload();await expect(page.locator('.chai-app')).toHaveAttribute('data-theme','light');await appearance(page);await page.getByRole('button',{name:'Sombre',exact:true}).click();await page.getByRole('button',{name:'Fermer l’apparence',exact:true}).click();expect((await stored(page)).wines).toEqual(cellar.wines);
});
test('classic presentation is reversible directly in the app and retains all inventory and notes',async({page})=>{
 await seed(page);await page.goto('/');await openRed(page);await page.getByLabel('Valeur estimée par bouteille (€)',{exact:true}).fill('15');await page.getByRole('button',{name:'Ajouter une bouteille au stock',exact:true}).click();await page.getByLabel('Fermer la bouteille',{exact:true}).click();const before=await stored(page);await appearance(page);await page.getByRole('button',{name:'Revenir à la présentation classique',exact:true}).click();
 await expect(page.getByRole('region',{name:'Meuble de cave en bois — Mur de test',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Accueil',exact:true})).toHaveCount(0);
 await page.reload();await expect(page.getByRole('region',{name:'Meuble de cave en bois — Mur de test',exact:true})).toBeVisible();await appearance(page);await page.getByRole('button',{name:'Activer la nouvelle présentation',exact:true}).click();await expect(page.getByRole('heading',{name:'Votre cave, à son meilleur.',exact:true})).toBeVisible();expect((await stored(page)).wines).toEqual(before.wines);expect((await stored(page)).movements).toEqual(before.movements);
});
test('widget visibility and order survive reload and stay independent between cellars',async({page})=>{
 await seed(page);await page.goto('/');await page.getByText('Personnaliser l’accueil',{exact:true}).click();await page.getByRole('checkbox',{name:'Répartition par couleur',exact:true}).uncheck();await page.getByRole('button',{name:'Monter Dernières entrées et sorties',exact:true}).click();
 await page.reload();await expect(page.getByRole('region',{name:'Répartition par couleur',exact:true})).toHaveCount(0);
 const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('lgc_dashboard_MA-CAVE-PRINCIPALE')));expect(prefs.order.indexOf('activity')).toBeLessThan(prefs.order.indexOf('value'));
 await page.getByRole('button',{name:'Comptes, Drive Kava 20 & Clé IA',exact:true}).click();await page.getByLabel('Nom de la nouvelle cave').fill('Cave indépendante');await page.getByRole('button',{name:'Créer la cave',exact:true}).click();await page.getByLabel('Fermer les paramètres',{exact:true}).click();
 await expect(page.getByRole('region',{name:'Répartition par couleur',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'Chiffres de la cave'})).toContainText('0 référence');await expect(page.getByRole('region',{name:'Valeur estimée',exact:true})).toContainText('À renseigner');await expect(page.getByText('Chaque collection commence par une bouteille.',{exact:true})).toBeVisible();
});
test('phone home, customization and light-mode cellar fit the screen and all pages remain accessible',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page);await page.goto('/');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:'test-results/accueil-premium-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Plus',exact:true}).click();await page.getByRole('button',{name:'Carte des terroirs',exact:true}).click();await expect(page.getByRole('heading',{name:'Carte Géographique des Vins & Terroirs de France',exact:true})).toBeVisible();
 await appearance(page);await page.getByRole('button',{name:'Clair',exact:true}).click();await page.getByRole('button',{name:'Fermer l’apparence',exact:true}).click();await page.getByRole('button',{name:'Cave',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:'test-results/cave-premium-mobile-clair.png',fullPage:false});
 await home(page);await page.getByText('Personnaliser l’accueil',{exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
test('exports preserve prices and movement timestamps, and importing makes an independent copy without new entries',async({page})=>{
 await seed(page);await page.goto('/');await openRed(page);await page.getByLabel('Quantité en stock',{exact:true}).fill('4');await page.getByLabel('Quantité en stock',{exact:true}).blur();await page.getByLabel('Fermer la bouteille',{exact:true}).click();
 await page.getByRole('button',{name:'Comptes, Drive Kava 20 & Clé IA',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Télécharger sauvegarde (.json)',exact:true}).click();const {readFile}=await import('node:fs/promises');const exported=JSON.parse(await readFile(await(await download).path(),'utf8'));expect(exported.cellar.movements).toHaveLength(1);expect(exported.cellar.wines[0].unitValueCents).toBe(1000);
 await page.getByLabel('Importer une cave',{exact:true}).setInputFiles({name:'copie.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.getByLabel('Fermer les paramètres',{exact:true}).click();const active=await page.evaluate(()=>localStorage.getItem('lgc_active_account'));expect(active).not.toBe('MA-CAVE-PRINCIPALE');const copy=await page.evaluate(id=>JSON.parse(localStorage.getItem(`lgc_cellar_data_${id}`)),active);expect(copy.movements).toEqual(exported.cellar.movements);await expect(page.getByRole('region',{name:'Dernières entrées et sorties',exact:true})).toContainText('Correction de stock');
});
