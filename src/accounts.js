export const DEFAULT_ACCOUNTS = [
  { id: 'MA-CAVE-PRINCIPALE', name: 'Ma Cave Principale', owner: 'Propriétaire' },
  { id: 'CAVE-DE-PAPA', name: 'Cave de Papa', owner: 'Papa' }
];

export function loadAccounts(storage) {
  try {
    const saved = JSON.parse(storage.getItem('lgc_accounts_list'));
    const accounts = Array.isArray(saved) ? saved.filter(a => a && typeof a.id === 'string' && typeof a.name === 'string' && a.name.trim()) : [];
    return accounts.length ? accounts : DEFAULT_ACCOUNTS;
  } catch { return DEFAULT_ACCOUNTS; }
}

export function createLocalCellar(storage, accounts, name, owner = '', data = null) {
  const title = String(name || '').trim();
  if (!title || title.length > 80) throw new Error('Donnez à la cave un nom de 1 à 80 caractères.');
  if (accounts.some(a => a.name.toLocaleLowerCase('fr') === title.toLocaleLowerCase('fr'))) throw new Error('Une cave porte déjà ce nom. Choisissez un autre nom.');
  const account = { id: `CAVE-${crypto.randomUUID()}`, name: title, owner: String(owner).trim().slice(0, 80) };
  const cellar = data || { walls: [{ id: `mur-${crypto.randomUUID()}`, name: 'Premier mur', rows: 4, cols: 5 }], wines: [], history: [] };
  const key = `lgc_cellar_data_${account.id}`;
  try {
    storage.setItem(key, JSON.stringify({ ...cellar, accountId: account.id, updatedAt: new Date().toISOString() }));
    storage.setItem('lgc_accounts_list', JSON.stringify([...accounts, account]));
  } catch {
    storage.removeItem(key);
    throw new Error('La mémoire du navigateur est pleine. Exportez vos caves avant de continuer.');
  }
  return { account, accounts: [...accounts, account], cellar };
}

export function importCellarData(raw) {
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('Ce fichier n’est pas une sauvegarde de cave valide.'); }
  const data = value?.cellar || value;
  if (!data || !Array.isArray(data.walls) || !data.walls.length || !Array.isArray(data.wines) || !Array.isArray(data.history)) throw new Error('La sauvegarde doit contenir les murs, les bouteilles et le carnet.');
  if (data.walls.some(w => !w || typeof w.id !== 'string' || typeof w.name !== 'string' || !Number.isInteger(w.rows) || !Number.isInteger(w.cols) || w.rows < 1 || w.rows > 12 || w.cols < 1 || w.cols > 12)) throw new Error('La configuration des murs est invalide.');
  if (new Set(data.walls.map(w => w.id)).size !== data.walls.length) throw new Error('Des murs ont le même identifiant.');
  const positions = new Set();
  const ids = new Set();
  for (const wine of data.wines) {
    const wall = data.walls.find(w => w.id === wine?.wallId);
    const position = `${wine?.wallId}/${wine?.row}/${wine?.col}`;
    if (!wall || typeof wine.id !== 'string' || typeof wine.name !== 'string' || typeof wine.type !== 'string' || !Number.isInteger(wine.row) || !Number.isInteger(wine.col) || wine.row < 1 || wine.row > wall.rows || wine.col < 1 || wine.col > wall.cols || positions.has(position) || ids.has(wine.id)) throw new Error('La sauvegarde contient une bouteille sans emplacement valide ou des casiers en double.');
    positions.add(position); ids.add(wine.id);
  }
  if (data.history.some(h => !h || typeof h.id !== 'string' || typeof h.name !== 'string')) throw new Error('Le carnet de dégustation est invalide.');
  return { name: typeof value.name === 'string' ? value.name : '', owner: typeof value.owner === 'string' ? value.owner.slice(0, 80) : '', cellar: { walls: data.walls, wines: data.wines, history: data.history } };
}
