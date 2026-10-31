import { safeHttpsUrl } from './ai.js';
export function normalizeLabelBox(box) {
  if (!Array.isArray(box) || box.length !== 4 || box.some(v => !Number.isFinite(v) || v < 0 || v > 1000)) return null;
  const [top, left, bottom, right] = box;
  if (bottom <= top || right <= left) return null;
  return { x: left / 10, y: top / 10, width: (right - left) / 10, height: (bottom - top) / 10 };
}
export function loadLabelImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Cette image ne peut pas être affichée. Essayez une autre photo.'));
    img.src = source;
  });
}
export async function loadRemoteLabel(url) {
  if (!safeHttpsUrl(url) && !/^data:image\/(jpeg|png|webp);base64,/.test(url)) throw new Error('Choisissez une adresse directe d’image HTTPS.');
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8000), referrerPolicy: 'no-referrer' });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Photo directe inaccessible');
  } catch (error) {
    if (url.startsWith('data:')) throw error;
    response = await fetch(`https://wsrv.nl/?url=${encodeURIComponent(url)}&w=1600&fit=inside&output=jpg`, { signal: AbortSignal.timeout(20000) });
  }
  if (!response.ok) throw new Error('Le site de cette photo refuse le chargement. Essayez une autre image ou importez votre photo.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/') || blob.size > 10 * 1024 * 1024) throw new Error('Le fichier reçu n’est pas une photo utilisable.');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Impossible de lire cette photo.')); reader.readAsDataURL(blob);
  });
  const img = await loadLabelImage(dataUrl);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
}
export async function cropLabelImage(source, crop) {
  if (!crop || Object.values(crop).some(v => !Number.isFinite(v)) || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > 100.001 || crop.y + crop.height > 100.001) throw new Error('Le cadre doit rester à l’intérieur de la photo.');
  const img = await loadLabelImage(source);
  const sx = img.width * crop.x / 100, sy = img.height * crop.y / 100;
  const sw = img.width * crop.width / 100, sh = img.height * crop.height / 100;
  const scale = Math.min(1, 900 / Math.max(sw, sh));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(sw * scale)); canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

const words = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe').match(/[a-z0-9]+/g) || [];
const stopWords = new Set(['chateau', 'domaine', 'maison', 'cidre', 'bouteille', 'wine', 'vin', 'grand', 'cru', 'classe', 'rouge', 'blanc', 'rose', 'champagne', 'des', 'les', 'aux', 'une', 'pour', 'avec', 'reserve']);
export function rankLabelCandidates(candidates, wine) {
  const target = words(wine.name).filter(w => w.length > 2 && !stopWords.has(w));
  const seen = new Set();
  return candidates.flatMap(item => {
    const nameWords = words(item.title);
    const years = nameWords.filter(w => /^(19|20)\d{2}$/.test(w));
    if (wine.vintage && years.length && !years.includes(String(wine.vintage))) return [];
    const score = target.filter(word => nameWords.includes(word)).length;
    if (item.provider !== 'google' && item.provider !== 'verified') {
      if (target.length && score < Math.min(2, target.length)) return [];
      if (target.length === 1 && /ch[aâ]teau/i.test(wine.name) && !nameWords.includes('chateau')) return [];
    }
    if (seen.has(item.url)) return [];
    seen.add(item.url);
    return [{ ...item, score, vintageStatus: wine.vintage && years.includes(String(wine.vintage)) ? 'Millésime indiqué dans la source' : 'Millésime à vérifier sur la photo' }];
  }).sort((a, b) => b.score - a.score).slice(0, 8);
}
