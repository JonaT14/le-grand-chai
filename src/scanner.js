import { catalogueVolume, getVolumeMl } from './bottle-properties.js';
import { findFreeSlot, scanFields } from './cellar.js';
import { parseQuantity } from './inventory.js';

export const MAX_SCAN_FILES = 20;
export const SCAN_INTERVAL_MS = 6500;

export function normalizeBarcode(value) {
  const code = String(value ?? '').replace(/[\s-]/g, '');
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) throw new Error('Indiquez un code-barres EAN / UPC de 8, 12, 13 ou 14 chiffres.');
  let sum = 0;
  for (let i = code.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) sum += Number(code[i]) * weight;
  if ((10 - sum % 10) % 10 !== Number(code.at(-1))) throw new Error('Le code-barres est invalide. Vérifiez les chiffres ou reprenez la photo.');
  return code;
}

// Keep the entire photographed label, without a decorative frame or shading.
export async function saveScanPhoto(source) {
  if (!/^data:image\/(?:jpeg|png|webp);base64,/.test(source)) throw new Error('Photo non prise en charge.');
  const image = new Image();
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Impossible de conserver la photo.')); image.src = source; });
  const scale = Math.min(1, 720 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossible de préparer la photo.');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

export async function decodeBarcode(photo) {
  const image = new Image();
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Cette photo ne peut pas être lue.')); image.src = photo; });
  if (globalThis.BarcodeDetector) {
    let nativeTimer;
    try {
      const results = await Promise.race([
        (async () => {
          const supported = await BarcodeDetector.getSupportedFormats();
          const formats = ['ean_13', 'ean_8', 'upc_a', 'itf'].filter(format => supported.includes(format));
          return formats.length ? new BarcodeDetector({ formats }).detect(image) : [];
        })(),
        new Promise((_, reject) => { nativeTimer = setTimeout(() => reject(new Error('Lecteur natif indisponible')), 1500); })
      ]);
      if (results.length) {
        const codes = [...new Set(results.flatMap(result => { try { return [normalizeBarcode(result.rawValue)]; } catch { return []; } }))];
        if (codes.length > 1) throw new Error('Plusieurs codes-barres sont visibles. Photographiez un seul code.');
        if (codes.length) return codes[0];
      }
    } catch (error) { if (error.message.startsWith('Plusieurs codes')) throw error; }
    finally { clearTimeout(nativeTimer); }
  }
  // Loaded only for barcode photos, including browsers without BarcodeDetector.
  const [{ BrowserMultiFormatOneDReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.ITF]], [DecodeHintType.TRY_HARDER, true]]);
  try { return normalizeBarcode((await new BrowserMultiFormatOneDReader(hints).decodeFromImageElement(image)).getText()); }
  catch { throw new Error('Aucun code-barres lisible. Photographiez le code de près, bien droit, ou saisissez ses chiffres.'); }
}

const productCache = new Map();
const text = value => typeof value === 'string' ? value.trim().slice(0, 240) : '';
export function barcodeProduct(data, code) {
  const product = data?.product;
  const name = text(product?.product_name_fr) || text(product?.product_name);
  if (data?.status === 0 || !name) throw new Error('Ce code-barres n’est pas renseigné dans le catalogue. Photographiez l’étiquette ou remplissez la fiche manuellement.');
  const returnedCode = product.code || data.code;
  if (returnedCode && normalizeBarcode(returnedCode).padStart(14, '0') !== code.padStart(14, '0')) throw new Error('Le catalogue a renvoyé une autre référence. Photographiez l’étiquette pour la vérifier.');
  const categories = `${text(product.categories)} ${(Array.isArray(product.categories_tags) ? product.categories_tags : []).join(' ')}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let category = 'Vin', type = 'Rouge';
  if (/cider|cidre|poir[eé]|perr(y|ies)|pommeau/.test(categories)) {
    category = 'Cidre'; type = /poir|perr/.test(categories) ? 'Poiré' : /doux|sweet/.test(categories) ? 'Cidre Doux' : /demi.sec/.test(categories) ? 'Cidre Demi-Sec' : /pommeau/.test(categories) ? 'Pommeau' : 'Cidre Brut';
  } else if (/spirit|whisk|rhum|\brum\b|cognac|armagnac|calvados|liqueur|eau.de.vie|\bgin\b|vodka/.test(categories)) {
    category = 'Alcool'; type = /whisk/.test(categories) ? 'Whisky' : /rhum|\brum\b/.test(categories) ? 'Rhum' : /cognac/.test(categories) ? 'Cognac' : /armagnac/.test(categories) ? 'Armagnac' : /calvados/.test(categories) ? 'Calvados' : /liqueur|chartreuse/.test(categories) ? 'Chartreuse & Liqueur' : 'Gin & Eau-de-vie';
  } else if (/wine|\bvins?\b|champagne/.test(categories)) {
    type = /sparkling|effervescent|champagne/.test(categories) ? 'Effervescent' : /white|blanc/.test(categories) ? 'Blanc' : /rose/.test(categories) ? 'Rosé' : /dessert|liquoreux/.test(categories) ? 'Liquoreux' : 'Rouge';
  } else throw new Error('Le catalogue n’identifie pas ce produit comme un vin, un cidre ou un spiritueux. Vérifiez l’étiquette.');
  const brand = text(product.brands);
  return {
    name: brand && !name.toLocaleLowerCase('fr').includes(brand.toLocaleLowerCase('fr')) ? `${brand} — ${name}` : name,
    appellation: text(product.appellation), region: text(product.origins), grapes: '', vintage: '', category, type,
    volumeMl: catalogueVolume(product) ?? (category === 'Vin' ? 750 : null), volumeSource: catalogueVolume(product) === null ? (category === 'Vin' ? 'default' : 'unknown') : 'catalogue', closure: 'unknown',
    barcode: code, barcodeSource: `https://world.openfoodfacts.org/product/${code}`
  };
}
export async function lookupBarcode(raw, { signal, fetchImpl = fetch, useCache = true } = {}) {
  const code = normalizeBarcode(raw);
  const cached = useCache && productCache.get(code);
  if (cached && Date.now() - cached.time < 300000) return { ...cached.value };
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 15000);
  try {
    const response = await fetchImpl(`https://world.openfoodfacts.org/api/v3/product/${code}?fields=code,product_name,product_name_fr,brands,categories,categories_tags,origins,appellation,quantity,product_quantity,product_quantity_unit`, { signal: controller.signal, referrerPolicy: 'no-referrer' });
    if (response.status === 404) throw new Error('Ce code-barres n’est pas renseigné dans le catalogue. Photographiez l’étiquette ou complétez la fiche manuellement.');
    if (!response.ok) throw new Error('Le catalogue est momentanément indisponible. Réessayez plus tard ou photographiez l’étiquette.');
    const result = barcodeProduct(await response.json(), code);
    productCache.set(code, { time: Date.now(), value: result });
    if (productCache.size > 100) productCache.delete(productCache.keys().next().value);
    return { ...result };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(signal?.aborted ? 'Analyse annulée.' : 'Le catalogue met trop de temps à répondre. Réessayez.');
    if (error instanceof TypeError) throw new Error('Impossible de joindre le catalogue. Vérifiez votre connexion.');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

const normalizeName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('fr').replace(/\s+/g, ' ');
export const sameScanReference = (a, b) => normalizeName(a.name) === normalizeName(b.name) && a.type === b.type && String(a.vintage ?? '') === String(b.vintage ?? '') && getVolumeMl(a) === getVolumeMl(b) && (!(a.closure && b.closure && a.closure !== 'unknown' && b.closure !== 'unknown') || a.closure === b.closure) && (!a.appellation || !b.appellation || normalizeName(a.appellation) === normalizeName(b.appellation));
export function matchingScanWines(wines, draft) { return draft?.name?.trim() ? wines.filter(wine => sameScanReference(wine, draft)) : []; }

export function validateScanDraft(draft, categories) {
  if (!draft || !text(draft.name)) throw new Error('Renseignez le nom de chaque fiche sélectionnée.');
  const rawYear = draft.vintage;
  const vintage = rawYear === '' || rawYear == null ? '' : Number(rawYear);
  if (vintage !== '' && (!Number.isInteger(vintage) || vintage < 1800 || vintage > new Date().getFullYear())) throw new Error('Vérifiez le millésime de chaque fiche sélectionnée (ou laissez-le vide).');
  const fields = scanFields({ ...draft, vintage }, categories);
  return { ...fields, quantity: parseQuantity(draft.quantity, 1) };
}

export function planScanImport(cellar, selections, { categories, defaults, preferredWallId, createId = () => `w_${crypto.randomUUID()}` }) {
  if (!selections.length) throw new Error('Sélectionnez au moins une fiche à ajouter.');
  if (selections.length > MAX_SCAN_FILES) throw new Error(`Importez au maximum ${MAX_SCAN_FILES} photos à la fois.`);
  const checked = selections.map(item => ({ ...item, fields: validateScanDraft(item.draft, categories) }));
  let next = [...cellar.wines], added = 0, restocked = 0;
  for (const { draft, fields, targetId } of checked) {
    if (targetId) {
      const target = next.find(wine => wine.id === targetId);
      if (!target || !sameScanReference(target, fields)) throw new Error('La fiche à réapprovisionner ne correspond plus à la bouteille. Vérifiez la destination.');
      const quantity = parseQuantity((target.quantity ?? 1) + fields.quantity, 1);
      next = next.map(wine => wine.id === targetId ? { ...wine, quantity } : wine);
      restocked++;
    } else {
      const slot = findFreeSlot(cellar.walls, next, preferredWallId);
      if (!slot) throw new Error('La cave manque de casiers libres pour cet import. Ajoutez un mur, réduisez la sélection ou choisissez de réapprovisionner une fiche existante.');
      const barcode = draft.barcode ? normalizeBarcode(draft.barcode) : '';
      const photo = typeof draft.customLabelUrl === 'string' && /^data:image\/(?:jpeg|png|webp);base64,/.test(draft.customLabelUrl) ? draft.customLabelUrl : null;
      next.push({ ...defaults, ...fields, vintage: fields.vintage === '' ? null : fields.vintage,
        id: createId(), ...slot, customLabelUrl: photo,
        foodPairing: [], webRating: null, userRating: null,
        ...(barcode ? { barcode, barcodeSource: `https://world.openfoodfacts.org/product/${barcode}` } : {}) });
      added++;
    }
  }
  return { wines: next, added, restocked, bottles: checked.reduce((sum, item) => sum + item.fields.quantity, 0) };
}

export function waitScanTurn(lastStart, { signal, interval = SCAN_INTERVAL_MS } = {}) {
  const delay = Math.max(0, interval - (Date.now() - lastStart));
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(Object.assign(new Error('Analyse annulée.'), { name: 'AbortError' })); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, delay);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { signal.removeEventListener('abort', abort); abort(); }
  });
}
