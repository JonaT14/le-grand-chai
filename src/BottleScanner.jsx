import React, { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { decodeBarcode, lookupBarcode, normalizeBarcode, matchingScanWines, sameScanReference, MAX_SCAN_FILES, waitScanTurn } from './scanner.js';

const fieldClass = 'block w-full min-w-0 mt-1 p-2 rounded-lg bg-stone-950 border border-amber-900/50 text-stone-100';
const statusText = { pending: 'À analyser', processing: 'Analyse en cours…', ready: 'Fiche à vérifier', error: 'À corriger' };

export default function BottleScanner({ categories, wines, makeDraft, preparePhoto, savePhoto, analyzeLabel, onDraft, onImport, onClose, aiAvailable, onConfigureAI }) {
  const [mode, setMode] = useState('label');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [barcode, setBarcode] = useState('');
  const [rows, setRows] = useState([]);
  const [bulkType, setBulkType] = useState('label');
  const [committing, setCommitting] = useState(false);
  const alive = useRef(true), runId = useRef(0), controller = useRef(null), busyRef = useRef(false), commitLock = useRef(false), lastStart = useRef(0);
  const storedPhoto = useRef(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; runId.current++; controller.current?.abort(); }; }, []);
  const patchRow = (id, changes) => setRows(prev => prev.map(row => row.id === id ? { ...row, ...changes } : row));
  const current = id => alive.current && id === runId.current;
  const begin = () => {
    busyRef.current = true; setBusy(true); setError('');
    controller.current = new AbortController();
    return { id: ++runId.current, signal: controller.current.signal };
  };
  const finish = id => { if (current(id)) { busyRef.current = false; setBusy(false); controller.current = null; } };
  const stop = () => {
    runId.current++; controller.current?.abort(); controller.current = null;
    busyRef.current = false; setBusy(false);
    setRows(prev => prev.map(row => row.status === 'processing' ? { ...row, status: 'pending' } : row));
  };
  const close = () => { stop(); onClose(); };
  const analyze = async (photo, kind, signal, onCode) => {
    if (signal.aborted) throw new Error('Analyse annulée.');
    if (kind === 'label') return analyzeLabel(photo, signal);
    const code = await decodeBarcode(photo);
    onCode?.(code);
    if (signal.aborted) throw new Error('Analyse annulée.');
    return lookupBarcode(code, { signal });
  };
  const withShape = fields => ({ ...makeDraft(), ...fields, bottleShape: categories[fields.category]?.defaultShape || makeDraft().bottleShape });

  const scanSingle = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || busyRef.current) return;
    const { id, signal } = begin(); setPreview(null); storedPhoto.current = null;
    if (mode === 'barcode') setBarcode('');
    try {
      const photo = await preparePhoto(file);
      if (!current(id)) return;
      setPreview(photo);
      const saved = await savePhoto(photo);
      if (!current(id)) return;
      storedPhoto.current = saved;
      const fields = await analyze(photo, mode, signal, code => { if (current(id)) setBarcode(code); });
      if (!current(id)) return;
      onDraft({ ...withShape(fields), customLabelUrl: saved });
    } catch (failure) { if (current(id)) setError(failure.message); }
    finally { finish(id); }
  };
  const manualSingle = () => {
    try {
      const fields = mode === 'barcode' && barcode.trim() ? { barcode: normalizeBarcode(barcode) } : {};
      onDraft({ ...makeDraft(), ...fields, customLabelUrl: storedPhoto.current || preview });
    } catch (failure) { setError(failure.message); }
  };
  const findCode = async event => {
    event.preventDefault(); if (busyRef.current) return;
    const { id, signal } = begin();
    try {
      const fields = await lookupBarcode(barcode, { signal });
      if (current(id)) onDraft({ ...withShape(fields), customLabelUrl: storedPhoto.current || preview });
    } catch (failure) { if (current(id)) setError(failure.message); }
    finally { finish(id); }
  };

  const selectFiles = event => {
    const files = Array.from(event.target.files || []); event.target.value = ''; setError('');
    if (!files.length || busyRef.current) return;
    const fingerprints = new Set(rows.map(row => row.fingerprint));
    const fresh = files.filter(file => {
      const fingerprint = `${file.name}/${file.size}/${file.lastModified}`;
      if (fingerprints.has(fingerprint)) return false;
      fingerprints.add(fingerprint); return true;
    });
    if (rows.length + fresh.length > MAX_SCAN_FILES) { setError(`Choisissez au maximum ${MAX_SCAN_FILES} photos par import.`); return; }
    if (!fresh.length) { setError('Ces photos sont déjà dans la liste. Ajustez la quantité pour plusieurs bouteilles identiques.'); return; }
    setRows(prev => [...prev, ...fresh.map(file => ({ id: crypto.randomUUID(), file, fingerprint: `${file.name}/${file.size}/${file.lastModified}`, status: 'pending', included: true, photo: null, draft: null, targetId: '', error: '' }))]);
  };
  const runBatch = async () => {
    if (busyRef.current) return;
    const pending = rows.filter(row => row.included && row.status !== 'ready');
    if (!pending.length) return;
    const { id, signal } = begin();
    try {
      for (const row of pending) {
        if (!current(id)) break;
        patchRow(row.id, { status: 'processing', error: '' });
        try {
          const photo = await preparePhoto(row.file);
          const saved = row.photo || await savePhoto(photo);
          if (!current(id)) break;
          patchRow(row.id, { photo: saved });
          await waitScanTurn(lastStart.current, { signal });
          if (!current(id)) break;
          lastStart.current = Date.now();
          const fields = await analyze(photo, bulkType, signal, code => { if (current(id)) patchRow(row.id, { detectedBarcode: code }); });
          if (!current(id)) break;
          patchRow(row.id, { status: 'ready', draft: { ...withShape(fields), customLabelUrl: saved }, source: bulkType });
        } catch (failure) {
          if (!current(id)) break;
          patchRow(row.id, { status: 'error', error: failure.message });
          if (/quota|facturation|clé|indisponible|Impossible de joindre|service IA/i.test(failure.message)) {
            setError(`${failure.message} Les fiches déjà analysées sont conservées. Vous pouvez reprendre les photos restantes plus tard.`);
            break;
          }
        }
      }
    } finally { finish(id); }
  };
  const updateDraft = (id, change) => setRows(prev => prev.map(row => row.id === id ? { ...row, draft: { ...row.draft, ...change }, targetId: ['name', 'type', 'vintage', 'category', 'appellation'].some(key => key in change) ? '' : row.targetId } : row));
  const commit = async () => {
    if (busyRef.current || commitLock.current) return;
    setError('');
    const selected = rows.filter(row => row.included);
    if (!selected.length) { setError('Sélectionnez au moins une fiche.'); return; }
    if (selected.some(row => row.status !== 'ready')) { setError('Analysez, corrigez manuellement ou excluez les photos qui ne sont pas prêtes.'); return; }
    commitLock.current = true; setCommitting(true);
    try { await onImport(selected.map(({ draft, targetId }) => ({ draft, targetId }))); }
    catch (failure) { if (alive.current) setError(failure.message); }
    finally { commitLock.current = false; if (alive.current) setCommitting(false); }
  };
  const selected = rows.filter(row => row.included), ready = rows.filter(row => row.status === 'ready');

  return <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-4">
    <div role="dialog" aria-label="Scanner de bouteilles" className="bg-[#18100C] border-2 border-amber-700/50 rounded-3xl max-w-3xl w-full p-4 md:p-6 space-y-4 max-h-[92vh] overflow-y-auto text-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-serif font-bold text-amber-100">Scanner une bouteille (Vin, Cidre, Alcool)</h3>
        <button aria-label="Fermer le scanner" disabled={committing} onClick={close} className="text-stone-400 p-1"><X className="w-5 h-5" /></button>
      </div>
      <div className="grid grid-cols-3 gap-2" aria-label="Mode de scan">
        {[['label', 'Étiquette'], ['barcode', 'Code-barres'], ['batch', 'Import en masse']].map(([key, title]) => <button key={key} disabled={busy || committing} aria-pressed={mode === key} onClick={() => { setMode(key); setError(''); setPreview(null); setBarcode(''); storedPhoto.current = null; }} className={`p-2 rounded-xl text-xs font-bold ${mode === key ? 'bg-amber-600 text-stone-950' : 'bg-stone-900 text-stone-300'}`}>{title}</button>)}
      </div>
      {mode !== 'batch' ? <>
        <p className="text-xs text-stone-400">{mode === 'label' ? 'Photographiez l’étiquette de près, sans reflet. Google IA pré-remplit la fiche. La photo est conservée et vous vérifiez les informations avant l’ajout.' : 'Photographiez un seul code-barres, bien droit, ou saisissez ses chiffres. Le catalogue peut identifier la référence ; le millésime et le type restent à vérifier sur votre bouteille.'}</p>
        <label className="block p-6 rounded-2xl border-2 border-dashed border-amber-600/60 bg-stone-950/70 text-center cursor-pointer">
          <Camera className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <span className="text-sm font-bold text-amber-200">{busy ? 'Analyse en cours…' : 'Ouvrir l’appareil photo / Choisir une photo'}</span>
          <input type="file" accept="image/*" capture="environment" aria-label={mode === 'label' ? 'Photo à analyser' : 'Photo du code-barres'} className="hidden" disabled={busy} onChange={scanSingle} />
        </label>
        {mode === 'barcode' && <form onSubmit={findCode} className="space-y-2">
          <label className="block text-xs text-stone-400">Numéro du code-barres<input aria-label="Numéro du code-barres" inputMode="numeric" autoComplete="off" value={barcode} onChange={event => setBarcode(event.target.value)} className={fieldClass} placeholder="8, 12, 13 ou 14 chiffres" disabled={busy} /></label>
          <button disabled={busy || !barcode.trim()} className="w-full p-2 rounded-xl bg-amber-700 text-white font-semibold disabled:opacity-50">Rechercher le code-barres</button>
          <p className="text-xs text-stone-500">Source : <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer" className="underline">Open Food Facts</a> (ODbL). Certaines bouteilles ne figurent pas dans ce catalogue.</p>
        </form>}
        {preview && <img src={preview} alt="Étiquette photographiée" className="max-h-40 mx-auto rounded-xl" />}
        {preview && !busy && <button onClick={manualSingle} className="text-xs text-amber-300 underline">Garder cette photo et remplir la fiche manuellement</button>}
        {mode === 'barcode' && error && barcode.trim() && !preview && !busy && <button onClick={manualSingle} className="text-xs text-amber-300 underline">Remplir la fiche manuellement</button>}
      </> : <>
        <p className="text-xs text-stone-400">Choisissez jusqu’à {MAX_SCAN_FILES} photos, une par référence. Les analyses se font une par une. Corrigez les fiches et les quantités, puis validez la sélection pour l’ajouter à cette cave. Aucune bouteille n’est ajoutée pendant l’analyse.</p>
        <label className="block text-xs text-stone-400">Contenu des photos<select aria-label="Contenu des photos" value={bulkType} disabled={busy || committing} onChange={event => setBulkType(event.target.value)} className={fieldClass}><option value="label">Étiquettes à lire avec Google IA</option><option value="barcode">Codes-barres à identifier dans le catalogue</option></select></label>
        <label className="block p-3 rounded-xl border border-dashed border-amber-600 text-amber-200 text-center cursor-pointer">Choisir plusieurs photos<input aria-label="Photos à importer" type="file" accept="image/*" multiple className="hidden" onChange={selectFiles} disabled={busy || committing} /></label>
        {!!rows.length && <>
          <p role="status" className="text-xs text-amber-200">{ready.length} fiche(s) prête(s) sur {rows.length} photo(s) · {selected.length} sélectionnée(s){busy ? ' · Analyse en cours…' : ''}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={runBatch} disabled={busy || committing || !selected.some(row => row.status !== 'ready')} className="px-3 py-2 rounded-xl bg-amber-700 text-white disabled:opacity-50">Analyser les photos restantes</button>
            {busy && <button onClick={stop} className="px-3 py-2 rounded-xl border border-amber-700 text-amber-200">Arrêter l’analyse</button>}
          </div>
        </>}
        <div className="space-y-3">
          {rows.map((row, index) => {
            const number = index + 1;
            const matches = row.draft ? matchingScanWines(wines, row.draft) : [];
            const duplicate = row.draft && rows.some(other => other.id !== row.id && other.draft && other.included && sameScanReference(row.draft, other.draft));
            return <fieldset key={row.id} className={`min-w-0 p-3 rounded-xl border ${row.included ? 'border-amber-800/70' : 'border-stone-800 opacity-60'}`}>
              <legend className="text-xs text-stone-300 max-w-full break-all px-1">Photo {number} : {row.file.name}</legend>
              <div className="flex flex-wrap justify-between gap-2 mb-2 text-xs">
                <label className="flex items-center gap-2"><input type="checkbox" aria-label={`Inclure la fiche ${number}`} checked={row.included} disabled={busy || committing} onChange={event => patchRow(row.id, { included: event.target.checked })} />Inclure cette fiche</label>
                <span>{statusText[row.status]}</span>
                <button aria-label={`Retirer la photo ${number}`} disabled={busy || committing} onClick={() => setRows(prev => prev.filter(item => item.id !== row.id))} className="text-stone-400 underline">Retirer</button>
              </div>
              {row.photo && <img src={row.photo} alt={`Étiquette de la fiche ${number}`} className="w-16 h-20 object-contain rounded-lg mb-2" />}
              {row.error && <p className="text-xs text-amber-200 mb-2">{row.error}</p>}
              {row.status === 'error' && row.photo && <button disabled={busy} onClick={() => patchRow(row.id, { status: 'ready', draft: { ...makeDraft(), ...(row.detectedBarcode ? { barcode: row.detectedBarcode } : {}), customLabelUrl: row.photo }, error: '', source: 'manual' })} className="underline text-xs text-amber-300">Remplir manuellement la fiche {number}</button>}
              {row.draft && <div className="space-y-3 text-xs">
                {row.source === 'barcode' && <p className="text-stone-400">Code {row.draft.barcode} · <a href={row.draft.barcodeSource} target="_blank" rel="noreferrer" className="underline">Source Open Food Facts</a>. Millésime et type à vérifier.</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label>Nom du domaine / cuvée<input aria-label={`Nom de la fiche ${number}`} maxLength={240} value={row.draft.name} disabled={busy || committing} onChange={event => updateDraft(row.id, { name: event.target.value })} className={fieldClass} /></label>
                  <label>Appellation<input aria-label={`Appellation de la fiche ${number}`} maxLength={240} value={row.draft.appellation} disabled={busy || committing} onChange={event => updateDraft(row.id, { appellation: event.target.value })} className={fieldClass} /></label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label>Millésime (facultatif)<input aria-label={`Millésime de la fiche ${number}`} type="number" min="1800" max={new Date().getFullYear()} value={row.draft.vintage ?? ''} disabled={busy || committing} onChange={event => updateDraft(row.id, { vintage: event.target.value })} className={fieldClass} /></label>
                  <label>Quantité<input aria-label={`Quantité de la fiche ${number}`} type="number" min="1" step="1" value={row.draft.quantity} disabled={busy || committing} onChange={event => updateDraft(row.id, { quantity: event.target.value })} className={fieldClass} /></label>
                  <label>Catégorie<select aria-label={`Catégorie de la fiche ${number}`} value={row.draft.category} disabled={busy || committing} onChange={event => updateDraft(row.id, { category: event.target.value, type: categories[event.target.value].types[0], bottleShape: categories[event.target.value].defaultShape })} className={fieldClass}>{Object.entries(categories).map(([key, data]) => <option key={key} value={key}>{data.label}</option>)}</select></label>
                  <label>Type<select aria-label={`Type de la fiche ${number}`} value={row.draft.type} disabled={busy || committing} onChange={event => updateDraft(row.id, { type: event.target.value })} className={fieldClass}>{categories[row.draft.category].types.map(type => <option key={type}>{type}</option>)}</select></label>
                </div>
                <label className="block">Région<input aria-label={`Région de la fiche ${number}`} maxLength={240} value={row.draft.region} disabled={busy || committing} onChange={event => updateDraft(row.id, { region: event.target.value })} className={fieldClass} /></label>
                {duplicate && <p className="text-amber-300">Une autre photo sélectionnée semble représenter cette bouteille. Ajustez la quantité ou excluez le doublon si nécessaire.</p>}
                {!!matches.length && <label className="block text-amber-200">Cette référence existe dans la cave<select aria-label={`Destination de la fiche ${number}`} value={row.targetId} disabled={busy || committing} onChange={event => patchRow(row.id, { targetId: event.target.value })} className={fieldClass}><option value="">Créer une nouvelle fiche dans un autre casier</option>{matches.map(wine => <option key={wine.id} value={wine.id}>Ajouter au stock de {wine.name} ({wine.quantity ?? 1} en stock)</option>)}</select></label>}
              </div>}
            </fieldset>;
          })}
        </div>
        {!!rows.length && <button onClick={commit} disabled={busy || committing} className="w-full p-3 rounded-xl bg-amber-600 text-stone-950 font-bold disabled:opacity-50">{committing ? 'Enregistrement…' : 'Ajouter la sélection à la cave'}</button>}
      </>}
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      {!aiAvailable && (mode === 'label' || (mode === 'batch' && bulkType === 'label')) && <button onClick={onConfigureAI} className="text-amber-400 underline text-xs">Configurer Google IA</button>}
      {busy && mode !== 'batch' && <button onClick={stop} className="text-xs text-amber-300 underline">Annuler l’analyse</button>}
    </div>
  </div>;
}
