// A verified reference for the reported regression. General searches still use
// Google Image Search metadata; this entry also works without an API key.
export function verifiedLabelReferences(wine) {
  const name = String(wine.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (Number(wine.vintage) !== 2015 || !['chateau margaux', 'grand vin du chateau margaux'].includes(name)) return [];
  return [{
    title: 'Château Margaux 2015 — bouteille sérigraphiée',
    url: 'https://assets.wine.com/winecom/image/upload/w_1000,c_fit,q_auto:good/x6qozlyoqd8qeewqjecj.jpg',
    source: 'https://www.wine.com/product/chateau-margaux-2015/153459',
    provider: 'verified', useWholeBottle: true,
    note: 'Le millésime 2015 porte une sérigraphie directement sur le verre, à la place de l’étiquette habituelle.'
  }];
}
