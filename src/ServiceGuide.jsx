import React, { useEffect, useRef, useState } from 'react';
import { currentService, SERVICE_SCHEMA, serviceFingerprint, serviceSchedule, validateService } from './service-advice.js';
import { getVolumeMl } from './bottle-properties.js';
export default function ServiceGuide({ wine, gemini, onSave }) {
  const [meal,setMeal] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const alive = useRef(true), controller = useRef(null), latest = useRef(wine); latest.current = wine;
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  const guide = currentService(wine), schedule = serviceSchedule(guide,meal);
  const refine = async () => {
    setBusy(true); setError(''); const fingerprint = serviceFingerprint(wine); controller.current = new AbortController();
    try {
      const {value} = await gemini({schema:SERVICE_SCHEMA,signal:controller.current.signal,prompt:`Propose des conseils de service prudents en français pour cette référence : ${JSON.stringify({name:wine.name,type:wine.type,appellation:wine.appellation,grapes:wine.grapes,vintage:wine.vintage,volumeMl:getVolumeMl(wine),closure:wine.closure,year:new Date().getFullYear()})}. Températures en °C, aerationMinutes = délai suggéré avant le repas (0 si inutile), uprightHours = redressement préalable seulement si dépôt suspecté. Distingue aération et séparation du dépôt. Ne prétends pas observer le dépôt ni avoir vérifié les consignes du domaine. Tiens compte des vins âgés fragiles, des bulles et des spiritueux, sans carafage systématique. Conseils indicatifs à confirmer à l'ouverture.`});
      if (alive.current && fingerprint === serviceFingerprint(latest.current)) onSave({serviceAdvice:{...validateService(value),fingerprint}});
    } catch(e) { if(alive.current) setError(e.message); } finally { if(alive.current) setBusy(false); }
  };
  const date = value => value.toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  return <section className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 space-y-2 text-xs">
    <h3 className="font-semibold text-amber-300">Préparer cette cuvée</h3>
    <p className="text-stone-400">{guide.source === 'ai' ? 'Suggestions Google IA' : 'Repères automatiques par style et millésime'} · à adapter après dégustation, sans vérification des consignes du domaine.</p>
    <p className="text-lg text-amber-100">{guide.temperatureMin}–{guide.temperatureMax} °C</p>
    <p><strong>Aération / carafe : </strong>{guide.aeration}</p><p><strong>Dépôt / décantation : </strong>{guide.sediment}</p>
    <label className="block">Date et heure du repas<input aria-label="Date et heure du repas" type="datetime-local" value={meal} onChange={e=>setMeal(e.target.value)} className="block bg-stone-950 border border-amber-900 rounded-lg p-2 mt-1 max-w-full" /></label>
    {schedule && <div role="status" className="text-amber-200"><p>Ouvrir / goûter vers {date(schedule.opening)}.</p>{schedule.upright && <p>Si un dépôt est suspecté : redresser vers {date(schedule.upright)}.</p>}<p className="text-stone-400">Vérifier la température avant de servir ; le temps de refroidissement dépend du contenant et de sa température de départ.</p></div>}
    <button type="button" disabled={busy} onClick={refine} className="rounded-lg border border-amber-700 px-3 py-2 disabled:opacity-50">{busy?'Préparation des conseils…':'Affiner avec Google IA'}</button>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <p className="text-stone-500">Repères : <a className="underline" href="https://www.wsetglobal.com/knowledge-centre/blog/2022/april/26/ideal-serving-temperatures-and-top-tips-for-wine-storage" target="_blank" rel="noreferrer">températures WSET</a> · <a className="underline" href="https://www.wsetglobal.com/knowledge-centre/blog/2024/july/21/frequently-asked-questions-about-serving-and-decanting-wine" target="_blank" rel="noreferrer">service et décantation</a>.</p>
  </section>;
}
