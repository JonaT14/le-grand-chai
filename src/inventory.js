import { getVolumeMl } from './bottle-properties.js';
// Older cellars stored one bottle per reference and had no quantity field.
export function getQuantity(wine) {
  return Number.isSafeInteger(wine?.quantity) && wine.quantity >= 0 ? wine.quantity : 1;
}

export function parseQuantity(value, minimum = 0) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') throw new Error('Indiquez un nombre entier de bouteilles.');
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity < minimum) throw new Error(`La quantité doit être un nombre entier supérieur ou égal à ${minimum}.`);
  return quantity;
}

export function totalQuantity(wines) {
  return wines.reduce((total, wine) => total + getQuantity(wine), 0);
}

export function normalizeInventory(cellar) {
  return Array.isArray(cellar?.wines) ? { ...cellar, wines: cellar.wines.map(wine => ({ ...wine, quantity: getQuantity(wine) })) } : cellar;
}

export function consumeBottle(wines, history, id, date = new Date()) {
  const wine = wines.find(w => w.id === id);
  if (!wine || getQuantity(wine) === 0) throw new Error('Cette référence est épuisée. Ajoutez des bouteilles au stock avant d’en boire une.');
  const quantity = getQuantity(wine) - 1;
  const entry = {
    id: `h_${crypto.randomUUID()}`, sourceWineId: wine.id, quantity: 1,
    name: wine.name, appellation: wine.appellation, region: wine.region, vintage: wine.vintage, type: wine.type,
    consumedAt: date.toISOString(), unitValueCents: wine.unitValueCents ?? null,
    volumeMl: getVolumeMl(wine), closure: wine.closure || 'unknown',
    drunkDate: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    userRating: wine.userRating ?? null, tastingNotes: wine.userNotes || '', guest: 'Cave personnelle'
  };
  return {
    wines: wines.map(w => w.id === id ? { ...w, quantity } : w),
    history: [entry, ...history]
  };
}

export function removeEmptyReference(wines, id) {
  const wine = wines.find(w => w.id === id);
  if (!wine || getQuantity(wine) !== 0) throw new Error('Seule une fiche dont le stock est à zéro peut être retirée du casier.');
  return wines.filter(w => w.id !== id);
}
