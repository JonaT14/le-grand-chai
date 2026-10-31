import React, { useEffect, useState } from 'react';
import { cropLabelImage } from './label-images.js';
export default function LabelCropEditor({ draft, onApply, onClose }) {
  const [crop, setCrop] = useState(draft.crop || { x: 0, y: 0, width: 100, height: 100 });
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [wholeBottle, setWholeBottle] = useState(Boolean(draft.useWholeBottle));
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    let current = true;
    setPreview(''); setError('');
    cropLabelImage(draft.dataUrl, crop).then(value => { if (current) setPreview(value); }).catch(error => { if (current) setError(error.message); });
    return () => { current = false; };
  }, [crop, draft.dataUrl]);
  const change = (field, value) => setCrop(previous => {
    const next = { ...previous, [field]: Number(value) };
    next.x = Math.min(next.x, 99); next.y = Math.min(next.y, 99);
    next.width = Math.max(1, Math.min(next.width, 100 - next.x)); next.height = Math.max(1, Math.min(next.height, 100 - next.y));
    return next;
  });
  return <div role="dialog" aria-modal="true" aria-label="Vérifier et recadrer l’étiquette" className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#18100C] border border-amber-700/50 rounded-3xl p-5 space-y-4">
      <div className="flex justify-between gap-3 items-start"><h3 className="font-serif text-xl text-amber-100">Vérifier et recadrer l’étiquette</h3><button aria-label="Fermer le recadrage" onClick={onClose} className="text-stone-300 text-xl">×</button></div>
      <p className="text-sm text-stone-300">Gardez seulement l’étiquette dans le cadre doré. Vérifiez le domaine, la cuvée et le millésime avant de l’appliquer.</p>
      {draft.verification && <p role="status" className={`text-xs p-3 rounded-xl ${draft.matches === false ? 'text-orange-200 bg-orange-950/50' : 'text-amber-200 bg-stone-900'}`}>{draft.verification}</p>}
      <label className="flex gap-2 text-sm text-amber-200"><input type="checkbox" checked={wholeBottle} onChange={e => setWholeBottle(e.target.checked)} />Afficher la photo de la bouteille entière (utile pour une sérigraphie)</label>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-stone-950 rounded-xl overflow-hidden flex items-start justify-center"><div className="relative w-fit max-w-full"><img src={draft.dataUrl} alt="Photo originale de la bouteille" className="block max-h-80 max-w-full w-auto h-auto" />
          {!wholeBottle && <div className="absolute inset-0"><div className="absolute border-2 border-amber-400 bg-amber-400/10" style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%` }} /></div>}
        </div></div>
        <div className="bg-stone-950 rounded-xl p-3 flex flex-col items-center justify-center gap-2"><span className="text-xs text-stone-400">Étiquette qui sera affichée</span>{preview && <img src={wholeBottle ? draft.dataUrl : preview} alt="Aperçu de l’étiquette recadrée" className="max-h-64 max-w-full object-contain" />}</div>
      </div>
      {!wholeBottle && <div className="grid grid-cols-2 gap-3">{[['x', 'Décalage horizontal'], ['y', 'Décalage vertical'], ['width', 'Largeur du cadre'], ['height', 'Hauteur du cadre']].map(([field, label]) => <label key={field} className="text-xs text-stone-400">{label} : {Math.round(crop[field])} %<input aria-label={label} type="range" min={field === 'x' || field === 'y' ? 0 : 1} max={field === 'x' || field === 'y' ? 99 : 100} step="0.5" value={crop[field]} onChange={e => change(field, e.target.value)} className="block w-full mt-2 accent-amber-500" /></label>)}</div>}
      {draft.source && <a href={draft.source} target="_blank" rel="noreferrer" className="block text-xs text-amber-300 underline">Voir la photo sur son site d’origine</a>}
      <label className="flex gap-2 text-xs text-stone-300"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />J’ai vérifié que cette étiquette correspond à ma bouteille.</label>
      {error && <p role="alert" className="text-red-300 text-xs">{error}</p>}
      <div className="flex gap-3"><button disabled={!preview || !confirmed} onClick={() => onApply({ dataUrl: wholeBottle ? draft.dataUrl : preview, wholeBottle })} className="px-4 py-2 rounded-xl bg-amber-600 text-stone-950 text-sm font-bold disabled:opacity-40">Appliquer cette étiquette</button><button onClick={onClose} className="text-sm text-stone-300">Annuler</button></div>
    </div>
  </div>;
}
