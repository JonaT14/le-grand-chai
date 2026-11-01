import React,{useEffect,useRef} from 'react';
import {X,Sun,Moon,Undo2} from 'lucide-react';
export default function AppearancePanel({value,onChange,onClose,onRestore}) {
 const panel=useRef(null);
 useEffect(()=>{const previous=document.activeElement;panel.current?.querySelector('button')?.focus();return()=>previous?.focus?.();},[]);
 return <div className="appearance-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={panel} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();onClose();}if(e.key==='Tab'){const items=[...panel.current.querySelectorAll('button,input,select')].filter(el=>!el.disabled),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}} role="dialog" aria-modal="true" aria-label="Apparence et accueil" className="appearance-panel">
 <header><div><p className="dash-eyebrow">À votre goût</p><h2>Apparence & accueil</h2></div><button className="dash-icon-button" aria-label="Fermer l’apparence" onClick={onClose}><X size={20}/></button></header>
 <fieldset><legend>Ambiance</legend><div className="appearance-choices">{[['dark','Sombre',Moon],['light','Clair',Sun]].map(([id,label,Icon])=><button key={id} type="button" aria-pressed={value.theme===id} onClick={()=>onChange({...value,theme:id,presentation:'premium'})}><Icon size={20}/>{label}</button>)}</div></fieldset>
 <label className="appearance-select">Page à l’ouverture<select aria-label="Page à l’ouverture" value={value.landing} onChange={e=>onChange({...value,landing:e.target.value})}><option value="dashboard">Accueil et tableau de bord</option><option value="cellar">Plan de cave</option></select></label>
 <div className="appearance-return"><Undo2 size={20}/><div><h3>Vous préférez l’ancienne présentation ?</h3><p>Retrouvez le plan de cave et son style sombre précédent. Vos bouteilles et vos modifications restent conservées.</p><button className="dash-secondary" onClick={onRestore}>{value.presentation==='classic'?'Activer la nouvelle présentation':'Revenir à la présentation classique'}</button></div></div>
 <p className="dash-muted">Ces préférences sont conservées sur cet appareil. L’ancienne version complète du site est également sauvegardée pour permettre un retour en arrière.</p>
 </section></div>;
}
