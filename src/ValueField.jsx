import React, {useEffect,useState} from 'react';
import {parseValue,validValue} from './dashboard.js';
export default function ValueField({value,onChange,onValidityChange}) {
 const [raw,setRaw]=useState(validValue(value)&&value!==null?String(value/100):''),[error,setError]=useState('');
 useEffect(()=>{setRaw(validValue(value)&&value!==null?String(value/100):'');setError('');onValidityChange?.(true);},[value]);
 return <label className="value-field block p-3 rounded-xl bg-stone-900/70 border border-amber-900/40 text-xs space-y-2"><span className="text-amber-300 font-semibold">Valeur estimée par bouteille (€)</span>
 <input aria-label="Valeur estimée par bouteille (€)" inputMode="decimal" value={raw} placeholder="Non renseignée" onChange={e=>{setRaw(e.target.value);try{const cents=parseValue(e.target.value);setError('');onValidityChange?.(true);onChange(cents);}catch(err){setError(err.message);onValidityChange?.(false);}}} className="block w-full bg-stone-950 border border-amber-900/40 rounded-lg p-2" />
 <span className="block text-stone-400">Prix d’achat ou estimation personnelle, multiplié par le stock. Aucun cours de marché automatique.</span>{error&&<span role="alert" className="block text-red-300">{error}</span>}</label>;
}
