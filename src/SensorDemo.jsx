import React from 'react';
import { Thermometer, Droplets } from 'lucide-react';
import { demoSensor } from './sensors.js';
export default function SensorDemo({ accountId, wallId, wallName, caveName }) {
  const value = demoSensor(accountId, wallId);
  return <section aria-label={`Conditions simulées de ${wallName}`} className="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h3 className="font-semibold text-cyan-200">Conditions du mur · Démo</h3>
      <p className="text-stone-200 mt-1">{caveName} · {wallName}</p>
      <p className="text-stone-400 mt-1">Données simulées · aucun capteur connecté.</p>
    </div>
    <dl className="flex flex-wrap gap-6 text-cyan-100">
      <div><dt className="flex items-center gap-1.5 text-stone-400"><Thermometer className="w-4 h-4" />Température</dt><dd className="text-xl font-semibold mt-1">{value.temperature.toLocaleString('fr-FR')} °C</dd></div>
      <div><dt className="flex items-center gap-1.5 text-stone-400"><Droplets className="w-4 h-4" />Hygrométrie</dt><dd className="text-xl font-semibold mt-1">{value.humidity} %</dd></div>
    </dl>
  </section>;
}
