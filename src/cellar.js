import { CLOSURES, validVolume } from './bottle-properties.js';
import { normalizeInventory } from './inventory.js';

export function findFreeSlot(walls, wines, preferredWallId) {
  const ordered = [...walls].sort((a, b) => Number(b.id === preferredWallId) - Number(a.id === preferredWallId));
  for (const wall of ordered) {
    for (let row = 1; row <= wall.rows; row++) {
      for (let col = 1; col <= wall.cols; col++) {
        if (!wines.some(w => w.wallId === wall.id && w.row === row && w.col === col)) return { wallId: wall.id, row, col };
      }
    }
  }
  return null;
}

export function resizeWall(walls, wines, id, field, value) {
  if (!['rows', 'cols'].includes(field) || !Number.isInteger(value) || value < 1 || value > 12) {
    throw new Error('Choisissez un nombre entier entre 1 et 12.');
  }
  const coordinate = field === 'rows' ? 'row' : 'col';
  if (wines.some(w => w.wallId === id && w[coordinate] > value)) {
    throw new Error('Des bouteilles occupent les casiers à retirer. Déplacez-les avant de réduire ce mur.');
  }
  return walls.map(w => w.id === id ? { ...w, [field]: value } : w);
}

export function removeWall(walls, wines, id, destinationId) {
  if (walls.length <= 1) throw new Error('Conservez au moins un mur dans votre cave.');
  const nextWalls = walls.filter(w => w.id !== id);
  const toMove = wines.filter(w => w.wallId === id);
  const destination = nextWalls.filter(w => w.id === destinationId);
  if (toMove.length && !destination.length) throw new Error('Choisissez le mur qui recevra les bouteilles.');
  let nextWines = wines.filter(w => w.wallId !== id);
  for (const wine of toMove) {
    const slot = findFreeSlot(destination, nextWines, destinationId);
    if (!slot) throw new Error('Le mur choisi manque de place. Agrandissez-le ou choisissez un autre mur.');
    nextWines.push({ ...wine, ...slot });
  }
  return { walls: nextWalls, wines: nextWines };
}

export function loadCellar(storage, accountId) {
  const current = storage.getItem(`lgc_cellar_data_${accountId}`);
  if (current) return normalizeInventory(JSON.parse(current));
  const legacy = ['walls', 'wines', 'history'].map(field => storage.getItem(`kava20_${field}_${accountId}`));
  if (!legacy.some(value => value !== null)) return null;
  const data = Object.fromEntries(['walls', 'wines', 'history'].map((field, i) => [field, legacy[i] ? JSON.parse(legacy[i]) : []]));
  storage.setItem(`lgc_cellar_data_${accountId}`, JSON.stringify(data));
  return normalizeInventory(data);
}

export function scanFields(value, categories) {
  if (typeof value.name !== 'string' || !value.name.trim()) throw new Error('Aucune étiquette lisible reconnue. Rapprochez-vous et reprenez la photo sans reflet.');
  const category = categories[value.category] ? value.category : Object.keys(categories).find(cat => categories[cat].types.includes(value.type));
  if (!category || !categories[category].types.includes(value.type)) throw new Error('Type de boisson non reconnu. Reprenez la photo ou complétez la fiche manuellement.');
  const fields = { name: value.name.trim(), category, type: value.type, bottleShape: categories[category].defaultShape };
  for (const key of ['appellation', 'region', 'grapes']) fields[key] = typeof value[key] === 'string' ? value[key] : '';
  fields.vintage = Number.isInteger(value.vintage) && value.vintage >= 1800 && value.vintage <= new Date().getFullYear() ? value.vintage : '';
  if (value.volumeMl !== undefined && !validVolume(value.volumeMl)) throw new Error('Contenance invalide. Corrigez la fiche.');
  fields.volumeMl = value.volumeMl === undefined || value.volumeMl === null && value.volumeSource !== 'manual' ? (category === 'Vin' ? 750 : null) : value.volumeMl;
  fields.volumeSource = value.volumeSource === 'manual' ? 'manual' : value.volumeMl == null ? (category === 'Vin' ? 'default' : 'unknown') : ['manual','scan','catalogue','default','unknown'].includes(value.volumeSource) ? value.volumeSource : 'scan';
  fields.closure = Object.hasOwn(CLOSURES, value.closure) ? value.closure : 'unknown';
  return fields;
}
