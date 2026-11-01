import React, { useEffect, useId, useState } from 'react';
import { parseQuantity } from './inventory.js';

export default function QuantityControl({ value, onChange, minimum = 0, label = 'Quantité en stock' }) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState('');
  const id = useId();
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = next => {
    try {
      const quantity = parseQuantity(next, minimum);
      setDraft(String(quantity)); setError(''); onChange(quantity);
    } catch (error) { setError(error.message); }
  };
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-xs text-amber-300 font-semibold">{label}</label>
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Retirer une bouteille du stock" disabled={value <= minimum} onClick={() => commit(value - 1)} className="w-10 h-10 rounded-xl bg-stone-800 text-amber-200 text-lg disabled:opacity-40">−</button>
      <input id={id} type="number" inputMode="numeric" min={minimum} max={Number.MAX_SAFE_INTEGER} step="1" required aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} value={draft}
        onChange={e => {
          setDraft(e.target.value);
          try { const next = parseQuantity(e.target.value, minimum); setError(''); onChange(next); }
          catch (error) { setError(e.target.value === '' ? '' : error.message); }
        }}
        onBlur={() => { try { parseQuantity(draft, minimum); } catch { setDraft(String(value)); } }}
        className="w-28 min-w-0 h-10 px-3 rounded-xl bg-stone-950 border border-amber-800/50 text-stone-100 text-center font-bold" />
      <button type="button" aria-label="Ajouter une bouteille au stock" disabled={value >= Number.MAX_SAFE_INTEGER} onClick={() => commit(value + 1)} className="w-10 h-10 rounded-xl bg-stone-800 text-amber-200 text-lg disabled:opacity-40">+</button>
      <span className="text-xs text-stone-400">bouteille{value === 1 ? '' : 's'}</span>
    </div>
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-red-300">{error}</p>}
  </div>;
}
