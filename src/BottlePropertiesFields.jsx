import React, { useEffect, useState } from 'react';
import { CLOSURES, getVolumeMl, parseCl, formatNote } from './bottle-properties.js';
const field = 'min-w-0 w-full rounded-lg bg-stone-950 border border-amber-900/50 px-3 py-2 text-stone-100';
export default function BottlePropertiesFields({ wine, onChange, onValidityChange }) {
  const ml = getVolumeMl(wine);
  const [raw, setRaw] = useState(ml === null ? '' : String(ml / 10));
  const [error, setError] = useState('');
  useEffect(() => { setRaw(ml === null ? '' : String(ml / 10)); setError(''); onValidityChange?.(true); }, [ml]);
  const change = value => {
    setRaw(value);
    try { const volumeMl = parseCl(value); onValidityChange?.(true); setError(''); onChange({ volumeMl, volumeSource: 'manual' }); }
    catch (e) { setError(e.message); onValidityChange?.(false); }
  };
  return <fieldset className="min-w-0 p-3 rounded-xl bg-stone-900/70 border border-amber-900/40 space-y-3 text-xs">
    <legend className="text-amber-300 px-1 font-semibold">Format & bouchage</legend>
    <div className="grid sm:grid-cols-2 gap-3">
      <label>Format<select aria-label="Format du contenant" className={field} value={[375,750,1500,3000,4500].includes(ml) ? ml : 'custom'} onChange={e => e.target.value === 'custom' ? change('') : change(String(Number(e.target.value) / 10))}>
        <option value="custom">Personnalisé / inconnu</option><option value="375">Demi-bouteille · 37,5 cl</option><option value="750">Bouteille · 75 cl</option><option value="1500">Magnum · 150 cl</option><option value="3000">Grand format · 300 cl (jéroboam selon région)</option><option value="4500">Grand format · 450 cl (jéroboam selon région)</option>
      </select></label>
      <label>Contenance (cl)<input aria-label="Contenance (cl)" inputMode="decimal" className={field} value={raw} onChange={e => change(e.target.value)} placeholder="Inconnue" /></label>
    </div>
    <label className="block">Bouchage<select aria-label="Bouchage" className={field} value={wine.closure || 'unknown'} onChange={e => onChange({ closure: e.target.value })}>{Object.entries(CLOSURES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <p className="text-stone-400">{wine.volumeSource === 'scan' ? 'Contenance lue sur la photo : à vérifier.' : wine.volumeSource === 'catalogue' ? 'Contenance du catalogue : à vérifier.' : wine.volumeSource === 'default' || wine.volumeMl === undefined && ml === 750 ? '75 cl par défaut pour le vin : à vérifier.' : ''}</p>
    <p className="text-stone-400">{formatNote(wine)}</p>
  </fieldset>;
}
