import { getQuantity } from './inventory.js';
export const WIDGETS = { priority:'À ouvrir prochainement', collection:'Fiches de la collection', colours:'Répartition par couleur', regions:'Répartition par région', value:'Valeur estimée', activity:'Dernières entrées et sorties' };
export const APPEARANCE_DEFAULTS = { theme:'dark', presentation:'premium', landing:'dashboard' };
export function readAppearance(storage) {
  try { const v=JSON.parse(storage.getItem('lgc_appearance'));return {theme:v?.theme==='light'?'light':'dark',presentation:v?.presentation==='classic'?'classic':'premium',landing:v?.landing==='cellar'?'cellar':'dashboard'}; } catch { return {...APPEARANCE_DEFAULTS}; }
}
export function widgetPreferences(raw) {
  const order=Array.isArray(raw?.order)?[...new Set(raw.order.filter(id=>Object.hasOwn(WIDGETS,id)))]:[];
  return {order:[...order,...Object.keys(WIDGETS).filter(id=>!order.includes(id))],hidden:Array.isArray(raw?.hidden)?[...new Set(raw.hidden.filter(id=>Object.hasOwn(WIDGETS,id)))]:[]};
}
export function parseValue(raw) {
  const str=String(raw).trim().replace(',','.'); if(!str)return null;
  if(!/^\d+(?:\.\d{0,2})?$/.test(str))throw new Error('Saisissez un montant positif avec au maximum deux décimales.');
  const cents=Math.round(Number(str)*100); if(!Number.isSafeInteger(cents)||cents>100000000)throw new Error('Le montant doit être compris entre 0 et 1 000 000 €.');return cents;
}
export const validValue = v=>v===null || Number.isSafeInteger(v)&&v>=0&&v<=100000000;
export function valuation(wines) {
  let cents=0,priced=0,unknown=0;
  for(const w of wines){const q=getQuantity(w);if(Number.isSafeInteger(w.unitValueCents)&&validValue(w.unitValueCents)){cents+=q*w.unitValueCents;priced+=q;}else unknown+=q;}
  return {cents,priced,unknown};
}
export function colourGroup(w) {
  if(/cidre|poiré|pommeau/i.test(w.type)||w.category==='Cidre')return 'Cidres & poirés';
  if(/calvados|whisky|rhum|cognac|armagnac|liqueur|chartreuse|gin|spirit|alcool/i.test(w.type)||w.category==='Alcool')return 'Spiritueux';
  return ['Rouge','Blanc','Rosé','Effervescent','Liquoreux'].includes(w.type)?w.type:'Autres';
}
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('fr');
export const regionName = w => typeof w.region === 'string' ? w.region.trim() : '';
export function distribution(wines,group) {
  const groups=new Map();
  for(const w of wines){const count=getQuantity(w);if(!count)continue;const label=group(w)||'Non renseignée',key=normalize(label);const current=groups.get(key)||{label,count:0};current.count+=count;groups.set(key,current);}
  return [...groups.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'fr'));
}
export function dueBottles(wines,year=new Date().getFullYear()) {
  const validYear=v=>Number.isInteger(Number(v))&&Number(v)>=1800&&Number(v)<=2500;
  return wines.flatMap(w=>{
    if(!getQuantity(w)||colourGroup(w)==='Spiritueux')return [];
    const end=validYear(w.peakEnd)?Number(w.peakEnd):null,limit=validYear(w.drinkLimit)?Number(w.drinkLimit):null;
    let reason='',rank=0;
    if(limit!==null&&limit<=year){reason=`Limite de garde atteinte · ${limit}`;rank=0;}
    else if(end!==null&&end<=year+2){reason=end<year?`Apogée dépassée · ${end}`:`Fin d’apogée · ${end}`;rank=1;}
    else return [];
    return [{wine:w,reason,rank,deadline:rank===0?limit:end}];
  }).sort((a,b)=>a.rank-b.rank||a.deadline-b.deadline);
}
export function stockMovements(previous,next,oldHistory=[],nextHistory=[],date=new Date(),createId=()=>crypto.randomUUID()) {
  const old=new Map(previous.map(w=>[w.id,w])),after=new Map(next.map(w=>[w.id,w]));
  const oldEntries=new Set(oldHistory.map(e=>e.id)),consumed=new Set(nextHistory.filter(e=>!oldEntries.has(e.id)).map(e=>e.sourceWineId));
  const result=[];
  for(const id of new Set([...old.keys(),...after.keys()])){
    const before=old.get(id),now=after.get(id),delta=(now?getQuantity(now):0)-(before?getQuantity(before):0);if(!delta)continue;const w=now||before;
    result.push({id:createId(),at:date.toISOString(),direction:delta>0?'in':'out',quantity:Math.abs(delta),wineId:id,name:w.name,vintage:w.vintage??null,reason:!before?'Ajout à la cave':!now?'Retrait de référence':delta<0&&consumed.has(id)?'Dégustation':'Correction de stock'});
  }
  return result;
}
export function validMovements(value) {
  return Array.isArray(value)&&value.length<=500&&value.every(e=>e&&typeof e.id==='string'&&typeof e.at==='string'&&Number.isFinite(Date.parse(e.at))&&['in','out'].includes(e.direction)&&Number.isSafeInteger(e.quantity)&&e.quantity>0&&typeof e.name==='string'&&typeof e.wineId==='string'&&typeof e.reason==='string');
}
// Collapse successive keystrokes in a stock correction into its final net change.
export function appendMovements(previous, added) {
 const result=[...previous];
 for(const event of added){
  const recent=result[0],elapsed=recent?Date.parse(event.at)-Date.parse(recent.at):Infinity;
  if(event.reason==='Correction de stock'&&recent?.reason===event.reason&&event.wineId===recent.wineId&&elapsed>=0&&elapsed<=3000){
   const net=(event.direction==='in'?event.quantity:-event.quantity)+(recent.direction==='in'?recent.quantity:-recent.quantity);
   result.shift();if(net)result.unshift({...event,id:recent.id,direction:net>0?'in':'out',quantity:Math.abs(net)});
  }else result.unshift(event);
 }
 return result.slice(0,500);
}
