export const CLOSURES = { unknown: 'Non renseigné', natural_cork: 'Liège naturel', screw_cap: 'Capsule à vis', technical_cork: 'Bouchon technique', wax: 'Cire (bouchon à préciser)', synthetic: 'Bouchon synthétique', crown_cap: 'Capsule couronne', swing_top: 'Bouchon mécanique', other: 'Autre' };
export const isWine = wine => !/cidre|poiré|pommeau|calvados|whisky|rhum|cognac|armagnac|liqueur|chartreuse|gin|alcool|spirit/i.test(wine.type || '') && (!wine.category || wine.category === 'Vin');
export function validVolume(value) { return value === null || (Number.isInteger(value) && value >= 1 && value <= 50000); }
export function getVolumeMl(wine) { return wine.volumeMl === undefined ? (isWine(wine) ? 750 : null) : validVolume(wine.volumeMl) ? wine.volumeMl : null; }
export function parseCl(raw) {
  if (String(raw).trim() === '') return null;
  const ml = Number(String(raw).replace(',', '.')) * 10;
  if (!Number.isFinite(ml) || Math.abs(ml - Math.round(ml)) > 1e-7 || !validVolume(Math.round(ml))) throw new Error('Indiquez une contenance entre 0,1 et 5 000 cl.');
  return Math.round(ml);
}
export const volumeText = wine => getVolumeMl(wine) === null ? 'Contenance inconnue' : `${(getVolumeMl(wine) / 10).toLocaleString('fr-FR')} cl`;
export function formatNote(wine) {
  const ml = getVolumeMl(wine);
  if (!isWine(wine)) return 'Le bouchage et les conditions de conservation restent à prendre en compte, notamment après ouverture.';
  return `${ml > 750 ? 'Un grand format peut évoluer plus lentement qu’un 75 cl.' : ml && ml < 750 ? 'Un petit format peut évoluer plus vite qu’un 75 cl.' : 'Le format seul ne détermine pas le potentiel de garde.'} Vos dates de garde restent inchangées. La cire ne permet pas d’identifier le bouchon placé dessous.`;
}
export function eventCapacity(wine, portionMl = 125) {
  const volume = getVolumeMl(wine), stock = Number.isSafeInteger(wine.quantity) && wine.quantity >= 0 ? wine.quantity : 1;
  return volume === null || !Number.isFinite(portionMl) || portionMl <= 0 ? 0 : Math.floor(volume / portionMl) * stock;
}
// Prefer a labelled per-container quantity; never infer bottle size from a pack's total.
export function catalogueVolume(product) {
  const raw = typeof product.quantity === 'string' ? product.quantity : '';
  const match = raw.match(/^\s*(?:\d+\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\s*℮?\s*$/i);
  if (match) { const ml = Number(match[1].replace(',', '.')) * ({ ml: 1, cl: 10, l: 1000 }[match[2].toLowerCase()]); return validVolume(ml) ? ml : null; }
  if (/pack|lot|bouteilles|[x×]/i.test(raw)) return null;
  const unit = String(product.product_quantity_unit || '').toLowerCase();
  const ml = Number(product.product_quantity) * ({ ml: 1, cl: 10, l: 1000 }[unit] || 0);
  return ml > 0 && validVolume(ml) ? ml : null;
}
