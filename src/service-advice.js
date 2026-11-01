import { getVolumeMl, isWine } from './bottle-properties.js';
export const serviceFingerprint = (w, year = new Date().getFullYear()) => JSON.stringify([1,year,w.name,w.type,w.appellation,w.grapes,w.vintage,getVolumeMl(w),w.closure || 'unknown']);
export function automaticService(w, year = new Date().getFullYear()) {
  const age = Number(w.vintage) >= 1800 ? year - Number(w.vintage) : null;
  const mature = age !== null && age >= 10;
  const tannic = /cabernet|syrah|tannat|malbec|bordeaux|margaux|pauillac|madiran|cahors/i.test(`${w.grapes} ${w.appellation}`);
  let temperatureMin = 16, temperatureMax = 18, aerationMinutes = 0, uprightHours = 0;
  let aeration = 'Goûter à l’ouverture. Une aération dans le verre suffit souvent ; la carafe n’est pas systématique.';
  let sediment = 'Décanter doucement uniquement si un dépôt est visible ; ne pas confondre décantation et aération.';
  if (!isWine(w)) {
    const cider = /cidre|poiré/i.test(w.type);
    temperatureMin = cider ? 6 : 16; temperatureMax = cider ? 10 : 20;
    aeration = 'Pas de carafage habituel. Servir progressivement et adapter au style du producteur.';
    sediment = 'Un dépôt naturel peut exister : vérifier le flacon et suivre les indications du producteur.';
  } else if (w.type === 'Effervescent') { temperatureMin = 8; temperatureMax = 10; aeration = 'Pas de carafage habituel afin de préserver les bulles.'; sediment = 'Pas de décantation habituelle ; vérifier les indications du producteur.'; }
  else if (w.type === 'Liquoreux') { temperatureMin = 6; temperatureMax = 8; }
  else if (['Blanc','Rosé'].includes(w.type)) { temperatureMin = 8; temperatureMax = 10; if (w.type === 'Blanc' && /chardonnay|meursault|montrachet|boisé|fût/i.test(`${w.grapes} ${w.appellation}`)) { temperatureMin = 10; temperatureMax = 13; } }
  else if (mature) { aerationMinutes = 10; uprightHours = 12; aeration = 'Vin évolué : goûter immédiatement, éviter une longue aération. Si nécessaire, ouvrir 10 minutes avant et surveiller son évolution.'; sediment = 'Vérifier la présence de dépôt. Si présent ou suspecté, redresser la bouteille 12 heures avant, puis décanter doucement juste avant le service.'; }
  else if (tannic && age !== null && age <= 8) { aerationMinutes = 30; aeration = 'Vin jeune potentiellement tannique : goûter, puis envisager 30 minutes d’aération si le vin semble fermé. Prolonger seulement après dégustation.'; }
  else if (/pinot|gamay|beaujolais/i.test(`${w.grapes} ${w.appellation}`)) { temperatureMin = 13; temperatureMax = 15; }
  return { temperatureMin,temperatureMax,aerationMinutes,uprightHours,aeration,sediment,source:'automatic' };
}
export const SERVICE_SCHEMA = { type:'OBJECT', required:['temperatureMin','temperatureMax','aerationMinutes','uprightHours','aeration','sediment'], properties:{ ...Object.fromEntries(['temperatureMin','temperatureMax','aerationMinutes','uprightHours'].map(k=>[k,{type:'INTEGER'}])), aeration:{type:'STRING'}, sediment:{type:'STRING'} } };
export function validateService(value) {
  const v = {};
  for (const [key,min,max] of [['temperatureMin',4,25],['temperatureMax',4,25],['aerationMinutes',0,240],['uprightHours',0,48]]) { if (!Number.isInteger(value?.[key]) || value[key] < min || value[key] > max) throw new Error('Conseils IA incomplets ou incohérents. Les repères automatiques restent disponibles.'); v[key] = value[key]; }
  if (v.temperatureMax < v.temperatureMin) throw new Error('Température IA incohérente.');
  for (const key of ['aeration','sediment']) { if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 2000) throw new Error('Conseils IA incomplets.'); v[key] = value[key].trim(); }
  return v;
}
export function currentService(w) { if (w.serviceAdvice?.fingerprint === serviceFingerprint(w)) { try { return { ...validateService(w.serviceAdvice), source:'ai' }; } catch { /* fallback for old or corrupt backups */ } } return automaticService(w); }
export function serviceSchedule(guide, meal) {
  if (!meal) return null;
  const time = new Date(meal).getTime(); if (!Number.isFinite(time)) return null;
  return { opening: new Date(time - guide.aerationMinutes * 60000), upright: guide.uprightHours ? new Date(time - guide.uprightHours * 3600000) : null };
}
