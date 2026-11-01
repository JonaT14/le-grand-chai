import React, { useState } from 'react';
import { demoSensor } from './sensors.js';
export default function SensorDemo({ accountId,wallId,row,col }) {
  const [expanded,setExpanded] = useState(false), value = demoSensor(accountId,wallId,row,col);
  return <div className="w-full z-10 text-center" onClick={e=>e.stopPropagation()}>
    <button type="button" aria-expanded={expanded} aria-label={`Capteur démo rangée ${row} colonne ${col} : température fictive ${value.temperature} degrés, humidité fictive ${value.humidity} pour cent`} onClick={()=>setExpanded(!expanded)} className="w-full rounded-md border border-cyan-900/60 bg-stone-950/90 text-[10px] text-cyan-200 py-1">Démo · {value.temperature.toLocaleString('fr-FR')} °C · {value.humidity} %</button>
    {expanded && <div role="status" className="absolute inset-x-1 bottom-9 p-2 bg-stone-950 border border-cyan-800 rounded-lg text-xs text-cyan-100 shadow-xl">Données simulées · aucun capteur connecté. Emplacement R{row} / C{col}. Le matériel sera associé à ce casier ultérieurement.</div>}
  </div>;
}
