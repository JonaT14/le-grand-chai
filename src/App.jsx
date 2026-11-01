import React, { useState, useEffect, useMemo, useRef, useId } from 'react';
import {
  Wine, Grid, AlertTriangle, Map as MapIcon, BookOpen, Sparkles,
  Plus, Camera, X, Search, Sliders, ExternalLink, Star,
  Move, Cloud, Download, Upload, Users,
  ChevronRight, Utensils, Copy, Check, Key, Globe, RefreshCw
} from 'lucide-react';

import { askGemini, checkAIService, readGeminiKey, DEFAULT_GEMINI_MODEL, SCAN_SCHEMA, SOMMELIER_SCHEMA, LABEL_SCHEMA, resolveSommelier, groundedLabelCandidates, LABEL_CHECK_SCHEMA, safeHttpsUrl } from './ai.js';
import { AI_PROXY_URL } from './ai-config.js';
import { findFreeSlot, resizeWall, removeWall, loadCellar, scanFields } from './cellar.js';

import { loadAccounts, createLocalCellar, importCellarData } from './accounts.js';

import LabelCropEditor from './LabelCropEditor.jsx';
import { loadRemoteLabel, normalizeLabelBox, rankLabelCandidates } from './label-images.js';

import { verifiedLabelReferences } from './label-catalogue.js';

import { getQuantity, parseQuantity, totalQuantity, consumeBottle, removeEmptyReference } from './inventory.js';
import QuantityControl from './QuantityControl.jsx';

const CURRENT_YEAR = new Date().getFullYear();

// ============================================================================
// CATÉGORIES DE BOISSONS (VINS, CIDRES & SPIRITUEUX)
// ============================================================================
const DRINK_CATEGORIES = {
  Vin: {
    label: 'Vin',
    icon: '🍷',
    types: ['Rouge', 'Blanc', 'Rosé', 'Effervescent', 'Liquoreux'],
    defaultShape: 'bordeaux'
  },
  Cidre: {
    label: 'Cidre & Poiré',
    icon: '🍏',
    types: ['Cidre Brut', 'Cidre Demi-Sec', 'Cidre Doux', 'Poiré', 'Pommeau'],
    defaultShape: 'cider'
  },
  Alcool: {
    label: 'Spiritueux & Alcool',
    icon: '🥃',
    types: ['Calvados', 'Whisky', 'Rhum', 'Cognac', 'Armagnac', 'Chartreuse & Liqueur', 'Gin & Eau-de-vie'],
    defaultShape: 'spirit'
  }
};

function getCategoryFromType(type = 'Rouge') {
  if (DRINK_CATEGORIES.Cidre.types.includes(type) || /cidre|poir[eé]|pommeau/i.test(type)) return 'Cidre';
  if (DRINK_CATEGORIES.Alcool.types.includes(type) || /calvados|whisky|rhum|cognac|armagnac|liqueur|chartreuse|gin|vodka|spiritueux|alcool/i.test(type)) return 'Alcool';
  return 'Vin';
}

function readPhoto(file) {
  if (!file || file.size > 15 * 1024 * 1024) throw new Error('Choisissez une photo de moins de 15 Mo.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire cette photo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Photo non prise en charge. Utilisez une image JPEG, PNG ou WebP.'));
      img.onload = () => {
        try {
          const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        } catch { reject(new Error('Impossible de préparer cette photo.')); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function emptyWine() {
  return {
    category: 'Vin', quantity: 1, name: '', appellation: '', region: '', vintage: '', type: 'Rouge', bottleShape: 'bordeaux',
    grapes: '', peakStart: CURRENT_YEAR, peakEnd: CURRENT_YEAR + 8, drinkLimit: CURRENT_YEAR + 12,
    webRating: null, webReviewCount: 0, webUrl: '', userRating: null, userNotes: '',
    tastingAdvice: '', foodPairing: '', customLabelUrl: null
  };
}

function RatingInput({ value, onChange, label = 'Ma note' }) {
  return <label className="flex items-center gap-2 text-xs text-amber-300">
    {label}
    <select aria-label={label} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className="bg-stone-950 border border-amber-800/50 rounded-lg px-2 py-1.5">
      <option value="">Non noté</option>
      {Array.from({ length: 11 }, (_, i) => i / 2).map(note => <option key={note} value={note}>{note}/5</option>)}
    </select>
  </label>;
}

// ============================================================================
// CONVERTISSEUR D'IMAGE WEB / IA SANS BLOCAGE CORS (PROXY WSRV.NL -> BASE64)
// ============================================================================
async function fetchImageAsLabelDataUrl(imageUrl) {
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(imageUrl) && !safeHttpsUrl(imageUrl)) throw new Error('Lien d’image HTTPS invalide.');
  const proxiedUrl = imageUrl.startsWith('data:')
    ? imageUrl
    : `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&w=420&h=580&fit=contain&output=jpg&q=85`;

  const response = await fetch(proxiedUrl, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Image inaccessible');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Le lien ne contient pas d’image.');

  const rawDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = rawDataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 560;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FAF6EE';
  ctx.fillRect(0, 0, 400, 560);

  const scale = Math.min(400 / img.width, 560 / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (400 - w) / 2, (560 - h) / 2, w, h);

  // Ombrage cylindrique subtil pour épouser le flacon
  const grad = ctx.createLinearGradient(0, 0, 400, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.28)');
  grad.addColorStop(0.12, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  grad.addColorStop(0.88, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 400, 560);

  ctx.strokeStyle = 'rgba(180,145,70,0.65)';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 384, 544);

  return canvas.toDataURL('image/jpeg', 0.85);
}

// ============================================================================
// GÉNÉRATEUR HAUTE RÉSOLUTION D'ÉTIQUETTE IA & GRAVURE DE DOMAINE
// ============================================================================
async function generateAILabelDataUrl(wine, styleInfo = {}, aiArtworkImg = null) {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 560;
  const ctx = canvas.getContext('2d');

  const category = getCategoryFromType(wine.type);
  const isDark = styleInfo.bg === '#171412' || wine.type === 'Effervescent' || category === 'Alcool';
  const bgTop = styleInfo.bg || (isDark ? '#1A1612' : category === 'Cidre' ? '#F7F3E6' : '#FCF8F0');
  const bgBottom = isDark ? '#0E0B09' : '#EAE0C8';
  const border = styleInfo.border || (isDark ? '#D4AF37' : category === 'Cidre' ? '#5B7A38' : '#9A7B3E');
  const textMain = isDark ? '#F7E7C4' : '#1A130E';
  const subText = styleInfo.subText || (isDark ? '#D4AF37' : '#7A5828');
  const sealColor = styleInfo.sealColor || (category === 'Cidre' ? '#3B6E28' : wine.type === 'Blanc' ? '#B68F40' : '#7A1621');

  // Fond papier vergé
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 560);
  bgGrad.addColorStop(0, bgTop);
  bgGrad.addColorStop(1, bgBottom);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 400, 560);

  // Texture papier vergé fine
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(120,90,40,0.045)';
  ctx.lineWidth = 1;
  for (let y = 6; y < 560; y += 5) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(400, y);
    ctx.stroke();
  }

  // Double cadre doré d'orfèvrerie
  ctx.strokeStyle = border;
  ctx.lineWidth = 5;
  ctx.strokeRect(14, 14, 372, 532);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(24, 24, 352, 512);

  // Coins ornementaux
  const corners = [[24, 24, 1, 1], [376, 24, -1, 1], [24, 536, 1, -1], [376, 536, -1, -1]];
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  corners.forEach(([cx, cy, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(cx + dx * 18, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * 18);
    ctx.stroke();
  });

  // En-tête de terroir
  const topMotto = (styleInfo.motto || (
    category === 'Cidre' ? `PRODUCTION FERMIÈRE • ${(wine.region || 'NORMANDIE').toUpperCase()}` :
    category === 'Alcool' ? `DISTILLERIE D'EXCEPTION • ${(wine.region || 'FRANCE').toUpperCase()}` :
    `GRAND VIN DE ${(wine.region || 'FRANCE').toUpperCase()}`
  )).slice(0, 36);

  ctx.fillStyle = subText;
  ctx.font = 'bold 11px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(topMotto, 200, 52);

  // Vignette centrale : soit l'illustration IA générée, soit la gravure architecturale détaillée
  if (aiArtworkImg) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(48, 66, 304, 185);
    ctx.clip();
    const scale = Math.max(304 / aiArtworkImg.width, 185 / aiArtworkImg.height);
    const w = aiArtworkImg.width * scale;
    const h = aiArtworkImg.height * scale;
    ctx.drawImage(aiArtworkImg, 48 + (304 - w) / 2, 66 + (185 - h) / 2, w, h);
    ctx.restore();

    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 66, 304, 185);
  } else {
    // Gravure fine de Château / Verger / Alambic selon la boisson
    ctx.save();
    ctx.strokeStyle = border;
    ctx.fillStyle = border;
    ctx.lineWidth = 1.6;

    // Médaillon cadre
    ctx.strokeRect(52, 68, 296, 175);

    if (category === 'Cidre') {
      // Gravure verger normand & pommier
      ctx.beginPath();
      ctx.arc(200, 140, 42, 0, Math.PI * 2);
      ctx.stroke();
      // Pomme héraldique
      ctx.beginPath();
      ctx.arc(200, 148, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(200, 126);
      ctx.quadraticCurveTo(208, 112, 218, 118);
      ctx.stroke();
      // Colombages normands à gauche et droite
      ctx.strokeRect(85, 130, 50, 65);
      ctx.beginPath();
      ctx.moveTo(80, 130); ctx.lineTo(110, 102); ctx.lineTo(140, 130);
      ctx.moveTo(85, 130); ctx.lineTo(135, 195);
      ctx.moveTo(135, 130); ctx.lineTo(85, 195);
      ctx.stroke();
      ctx.strokeRect(265, 130, 50, 65);
      ctx.beginPath();
      ctx.moveTo(260, 130); ctx.lineTo(290, 102); ctx.lineTo(320, 130);
      ctx.moveTo(265, 130); ctx.lineTo(315, 195);
      ctx.stroke();
    } else if (category === 'Alcool') {
      // Alambic charentais / fût de chêne
      ctx.beginPath();
      ctx.arc(200, 150, 48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(200, 162, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(185, 140);
      ctx.quadraticCurveTo(200, 105, 235, 120);
      ctx.lineTo(245, 175);
      ctx.stroke();
    } else {
      // Grand Château classique avec colonnade, tours et vignes
      // Corps central
      ctx.strokeRect(125, 130, 150, 68);
      // Fronton triangulaire
      ctx.beginPath();
      ctx.moveTo(118, 130);
      ctx.lineTo(200, 92);
      ctx.lineTo(282, 130);
      ctx.closePath();
      ctx.stroke();
      // Tours latérales avec toits coniques
      ctx.strokeRect(90, 118, 35, 80);
      ctx.beginPath();
      ctx.moveTo(86, 118); ctx.lineTo(107, 78); ctx.lineTo(128, 118); ctx.closePath();
      ctx.stroke();
      ctx.strokeRect(275, 118, 35, 80);
      ctx.beginPath();
      ctx.moveTo(272, 118); ctx.lineTo(293, 78); ctx.lineTo(314, 118); ctx.closePath();
      ctx.stroke();
      // Colonnes et fenêtres
      for (let x = 142; x <= 258; x += 23) {
        ctx.beginPath();
        ctx.moveTo(x, 130);
        ctx.lineTo(x, 198);
        ctx.stroke();
      }
      // Rangées de vignes en perspective devant le château
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(200 + i * 12, 202);
        ctx.lineTo(200 + i * 32, 236);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Découpage intelligent du nom du cru sur 1 à 3 lignes
  ctx.fillStyle = textMain;
  ctx.font = 'bold 25px Georgia, serif';
  const words = (wine.name || 'Grand Cru').toUpperCase().split(' ');
  const lines = [];
  let current = '';
  words.forEach((w) => {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > 320 && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  });
  if (current) lines.push(current);

  let textY = 290;
  lines.slice(0, 3).forEach((line) => {
    ctx.fillText(line, 200, textY);
    textY += 30;
  });

  // Filet doré
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(95, textY - 10);
  ctx.lineTo(305, textY - 10);
  ctx.stroke();

  // Appellation
  ctx.fillStyle = subText;
  ctx.font = 'italic bold 16px Georgia, serif';
  ctx.fillText((wine.appellation || wine.region || 'Appellation d’Origine Protégée').slice(0, 36), 200, textY + 16);

  // Cépages / Variétés
  ctx.fillStyle = textMain;
  ctx.font = '12px Georgia, serif';
  ctx.fillText((wine.grapes || '').slice(0, 44), 200, textY + 40);

  // Cachet de cire & Millésime
  const sealY = 468;
  ctx.fillStyle = sealColor;
  ctx.beginPath();
  ctx.arc(200, sealY, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#FFF8E7';
  ctx.font = 'bold 17px Georgia, serif';
  ctx.fillText(String(wine.vintage || CURRENT_YEAR), 200, sealY + 6);

  // Mentions de pied d'étiquette
  ctx.fillStyle = subText;
  ctx.font = 'bold 10px Georgia, serif';
  const footerText = styleInfo.footer || (
    category === 'Cidre' ? 'RÉCOLTANT • ÉLABORÉ EN FRANCE • 750 ML' :
    category === 'Alcool' ? 'EMBOUTEILLÉ À LA PROPRIÉTÉ • 700 ML' :
    'MIS EN BOUTEILLE AU CHÂTEAU • PRODUIT DE FRANCE'
  );
  ctx.fillText(footerText.slice(0, 46), 200, 522);

  // Ombrage cylindrique 3D
  const cyl = ctx.createLinearGradient(0, 0, 400, 0);
  cyl.addColorStop(0, 'rgba(0,0,0,0.26)');
  cyl.addColorStop(0.14, 'rgba(0,0,0,0)');
  cyl.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  cyl.addColorStop(0.86, 'rgba(0,0,0,0)');
  cyl.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = cyl;
  ctx.fillRect(0, 0, 400, 560);

  return canvas.toDataURL('image/jpeg', 0.88);
}

// ============================================================================
// DONNÉES INITIALES PAR DÉFAUT
// ============================================================================
const DEFAULT_WALLS = [
  { id: 'mur-gauche', name: 'Mur de Gauche', rows: 4, cols: 5 },
  { id: 'mur-fond', name: 'Mur du Fond', rows: 4, cols: 6 },
  { id: 'mur-droit', name: 'Mur de Droite', rows: 4, cols: 5 }
];

const DEFAULT_WINES = [
  {
    id: 'w1',
    name: 'Château Margaux',
    appellation: 'Margaux 1er Grand Cru Classé',
    region: 'Bordeaux',
    vintage: 2015,
    category: 'Vin',
    type: 'Rouge',
    bottleShape: 'bordeaux',
    grapes: 'Cabernet Sauvignon (87%), Merlot (8%), Cabernet Franc (3%), Petit Verdot (2%)',
    wallId: 'mur-gauche',
    row: 1,
    col: 2,
    peakStart: 2023,
    peakEnd: 2038,
    drinkLimit: 2045,
    webRating: 4.8,
    webReviewCount: 3420,
    webUrl: 'https://www.vivino.com/search/wines?q=Chateau+Margaux+2015',
    userRating: 5,
    userNotes: 'Bouquet d’une finesse absolue, tanins de velours, finale interminable sur la violette et le cèdre.',
    tastingAdvice: 'Carafer 2h avant service. Servir à 17°C dans un grand verre bordelais.',
    foodPairing: ['Filet de bœuf Rossini', 'Agneau de Pauillac rôti', 'Pigeon aux truffes'],
    crestType: 'chateau',
    labelColor: '#FBF7EE',
    accentColor: '#9A7B3E',
    capsuleColor: '#58111A',
    customLabelUrl: null
  },
  {
    id: 'w2',
    name: 'Domaine de la Romanée-Conti - Échézeaux',
    appellation: 'Échézeaux Grand Cru',
    region: 'Bourgogne',
    vintage: 2018,
    category: 'Vin',
    type: 'Rouge',
    bottleShape: 'burgundy',
    grapes: 'Pinot Noir (100%)',
    wallId: 'mur-fond',
    row: 2,
    col: 3,
    peakStart: 2024,
    peakEnd: 2035,
    drinkLimit: 2040,
    webRating: 4.7,
    webReviewCount: 1280,
    webUrl: 'https://www.vivino.com/search/wines?q=Echezeaux+2018',
    userRating: 5,
    userNotes: 'Explosion de griotte, de rose fanée et d’épices douces. Texture soyeuse inimitable.',
    tastingAdvice: 'Ne pas carafer, ouvrir 1h avant au frais. Servir à 16°C.',
    foodPairing: ['Volaille de Bresse demi-deuil', 'Ris de veau braisés', 'Époisses affiné'],
    crestType: 'monogram',
    labelColor: '#F9F5EB',
    accentColor: '#1E1B18',
    capsuleColor: '#7A1621',
    customLabelUrl: null
  },
  {
    id: 'w3',
    name: 'Château de Beaucastel',
    appellation: 'Châteauneuf-du-Pape',
    region: 'Vallée du Rhône',
    vintage: 2016,
    category: 'Vin',
    type: 'Rouge',
    bottleShape: 'burgundy',
    grapes: 'Mourvèdre (30%), Grenache (30%), Syrah (10%), Counoise (10%)',
    wallId: 'mur-gauche',
    row: 2,
    col: 4,
    peakStart: 2021,
    peakEnd: 2027,
    drinkLimit: 2028,
    webRating: 4.5,
    webReviewCount: 4890,
    webUrl: 'https://www.vivino.com/search/wines?q=Chateau+de+Beaucastel+2016',
    userRating: 4.5,
    userNotes: 'Notes intenses de garrigue, cuir noble, mûre sauvage et poivre noir.',
    tastingAdvice: 'Carafer 1h30. Servir à 17°C.',
    foodPairing: ['Civet de sanglier', 'Carré d’agneau aux herbes de Provence', 'Daube provençale'],
    crestType: 'keys',
    labelColor: '#F3EAD8',
    accentColor: '#8B261D',
    capsuleColor: '#2A1810',
    customLabelUrl: null
  },
  {
    id: 'w4',
    name: 'Champagne Bollinger La Grande Année',
    appellation: 'Champagne Millésimé',
    region: 'Champagne',
    vintage: 2014,
    category: 'Vin',
    type: 'Effervescent',
    bottleShape: 'champagne',
    grapes: 'Pinot Noir (61%), Chardonnay (39%)',
    wallId: 'mur-fond',
    row: 1,
    col: 2,
    peakStart: 2021,
    peakEnd: 2030,
    drinkLimit: 2034,
    webRating: 4.6,
    webReviewCount: 2910,
    webUrl: 'https://www.vivino.com/search/wines?q=Bollinger+Grande+Annee+2014',
    userRating: 5,
    userNotes: 'Bulle ultra-crémeuse, arômes de brioche chaude, noisette torréfiée et agrumes confits.',
    tastingAdvice: 'Servir à 10°C dans un verre tulipe ample (surtout pas une flûte étroite).',
    foodPairing: ['Turbot rôti sauce hollandaise', 'Homard grillé au beurre demi-sel', 'Comté 36 mois'],
    crestType: 'oval',
    labelColor: '#1B1815',
    accentColor: '#D4AF37',
    capsuleColor: '#C59B27',
    customLabelUrl: null
  },
  {
    id: 'w5',
    name: 'Domaine Ott - Château de Selle',
    appellation: 'Côtes de Provence Cru Classé',
    region: 'Provence',
    vintage: 2023,
    category: 'Vin',
    type: 'Rosé',
    bottleShape: 'flute',
    grapes: 'Grenache (55%), Cinsault (35%), Syrah (6%), Mourvèdre (4%)',
    wallId: 'mur-droit',
    row: 1,
    col: 2,
    peakStart: 2024,
    peakEnd: 2026,
    drinkLimit: 2027,
    webRating: 4.3,
    webReviewCount: 5120,
    webUrl: 'https://www.vivino.com/search/wines?q=Domaine+Ott+Chateau+de+Selle+2023',
    userRating: 4.5,
    userNotes: 'Robe pétale de rose très pâle aux reflets saumonés, finale saline et pêche blanche.',
    tastingAdvice: 'Servir frais à 10-11°C.',
    foodPairing: ['Loup de mer grillé au fenouil', 'Tartare de daurade aux agrumes', 'Cuisine méditerranéenne'],
    crestType: 'amphora',
    labelColor: '#FAF6F0',
    accentColor: '#C89D7C',
    capsuleColor: '#D8B49B',
    customLabelUrl: null
  },
  {
    id: 'w6',
    name: 'Domaine Vacheron - Les Romains',
    appellation: 'Sancerre Blanc',
    region: 'Val de Loire',
    vintage: 2020,
    category: 'Vin',
    type: 'Blanc',
    bottleShape: 'burgundy',
    grapes: 'Sauvignon Blanc (100% sur silex)',
    wallId: 'mur-droit',
    row: 2,
    col: 3,
    peakStart: 2023,
    peakEnd: 2027,
    drinkLimit: 2028,
    webRating: 4.4,
    webReviewCount: 1640,
    webUrl: 'https://www.vivino.com/search/wines?q=Domaine+Vacheron+Les+Romains+2020',
    userRating: 4.5,
    userNotes: 'Tension minérale sur la pierre à fusil, pamplemousse rose et longueur saline remarquable.',
    tastingAdvice: 'Servir à 11°C après 20 minutes d’ouverture.',
    foodPairing: ['Crottin de Chavignol affiné', 'Saint-Jacques snackées', 'Bar de ligne en croûte de sel'],
    crestType: 'chateau',
    labelColor: '#F7F4EC',
    accentColor: '#7E6B3A',
    capsuleColor: '#C7A955',
    customLabelUrl: null
  }
];

const DEFAULT_HISTORY = [
  {
    id: 'h1',
    name: 'Pauillac - Château Lynch-Bages',
    appellation: 'Pauillac 5e Grand Cru Classé',
    region: 'Bordeaux',
    vintage: 2010,
    type: 'Rouge',
    drunkDate: '14 Octobre 2026',
    userRating: 5,
    tastingNotes: 'Ouvert pour l’anniversaire de Papa. Un monument d’équilibre sur le cassis, le graphite et le cigare.',
    guest: 'Dîner en famille avec Papa'
  }
];

// ============================================================================
// RÉGIONS VITICOLES & CIDRICOLES (AFFICHE HACHETTE VINS DE FRANCE)
// ============================================================================
const WINE_REGIONS_MAP = [
  {
    id: 'Champagne',
    label: 'CHAMPAGNE',
    sub: 'Montagne de Reims • Côte des Blancs • Vallée de la Marne',
    color: '#E5B94B',
    x: 315, y: 158,
    path: 'M 285,135 C 305,128 330,138 335,158 C 338,175 322,190 302,186 C 286,182 278,152 285,135 Z',
    bottleColor: '#C89E32'
  },
  {
    id: 'Alsace',
    label: 'ALSACE & LORRAINE',
    sub: 'Moselle • Strasbourg • Colmar • Grands Crus d’Alsace',
    color: '#D99B26',
    x: 432, y: 185,
    path: 'M 426,148 C 440,150 446,180 438,225 C 430,232 420,225 422,192 C 423,168 420,152 426,148 Z',
    bottleColor: '#5B7A38'
  },
  {
    id: 'Normandie',
    label: 'NORMANDIE',
    sub: 'Pays d’Auge • Cotentin • Cidre & Calvados AOC',
    color: '#769B4A',
    x: 192, y: 156,
    path: 'M 142,135 C 175,132 215,138 232,155 C 228,172 195,176 155,170 C 138,162 135,142 142,135 Z',
    bottleColor: '#4A6B28'
  },
  {
    id: 'Bretagne',
    label: 'BRETAGNE',
    sub: 'Cornouaille • Cidre Artisanal & Eau-de-vie',
    color: '#8EA858',
    x: 92, y: 205,
    path: 'M 55,188 C 85,180 122,188 135,205 C 128,222 92,226 60,214 Z',
    bottleColor: '#5C7A32'
  },
  {
    id: 'Val de Loire',
    label: 'VALLÉE DE LA LOIRE',
    sub: 'Muscadet • Anjou-Saumur • Touraine • Sancerre • Pouilly',
    color: '#6C8E4E',
    x: 198, y: 248,
    path: 'M 112,238 C 155,226 218,224 275,245 C 282,258 265,272 225,266 C 175,258 132,265 112,252 Z',
    bottleColor: '#3E6B36'
  },
  {
    id: 'Bourgogne',
    label: 'BOURGOGNE',
    sub: 'Chablis • Côte de Nuits • Côte de Beaune • Mâconnais',
    color: '#B8332A',
    x: 336, y: 268,
    path: 'M 318,222 C 338,224 352,255 348,302 C 338,312 322,306 320,275 C 318,248 312,230 318,222 Z',
    bottleColor: '#7A1621'
  },
  {
    id: 'Jura',
    label: 'JURA',
    sub: 'Arbois • Château-Chalon • Vin Jaune & Macvin',
    color: '#C96A32',
    x: 392, y: 282,
    path: 'M 382,258 C 398,258 405,278 396,305 C 385,308 376,295 382,258 Z',
    bottleColor: '#A85C22'
  },
  {
    id: 'Savoie',
    label: 'SAVOIE & BUGEY',
    sub: 'Apremont • Chignin-Bergeron • Seyssel • Chartreuse',
    color: '#B5503C',
    x: 405, y: 342,
    path: 'M 388,322 C 408,320 422,338 415,365 C 398,368 386,352 388,322 Z',
    bottleColor: '#7E281E'
  },
  {
    id: 'Beaujolais',
    label: 'BEAUJOLAIS',
    sub: 'Morgon • Moulin-à-Vent • Fleurie • Brouilly',
    color: '#D1493B',
    x: 338, y: 328,
    path: 'M 326,312 C 344,312 350,330 344,348 C 330,350 322,335 326,312 Z',
    bottleColor: '#911E26'
  },
  {
    id: 'Poitou-Charentes',
    label: 'POITOU-CHARENTES',
    sub: 'Cognac Grande Champagne • Pineau des Charentes',
    color: '#D88B38',
    x: 175, y: 332,
    path: 'M 148,308 C 178,305 202,322 196,352 C 176,358 148,346 148,308 Z',
    bottleColor: '#B5631E'
  },
  {
    id: 'Bordeaux',
    label: 'BORDELAIS',
    sub: 'Médoc • Margaux • Pauillac • Saint-Émilion • Pomerol • Sauternes',
    color: '#9E1B24',
    x: 158, y: 398,
    path: 'M 128,362 C 165,358 195,382 188,425 C 168,438 132,425 125,392 Z',
    bottleColor: '#58111A'
  },
  {
    id: 'Sud-Ouest',
    label: 'SUD-OUEST',
    sub: 'Cahors • Madiran • Jurançon • Bergerac • Armagnac',
    color: '#C86D3B',
    x: 215, y: 445,
    path: 'M 172,428 C 215,418 252,432 248,472 C 218,484 172,475 162,452 Z',
    bottleColor: '#8B3A1E'
  },
  {
    id: 'Vallée du Rhône',
    label: 'VALLÉE DU RHÔNE',
    sub: 'Côte-Rôtie • Hermitage • Condrieu • Châteauneuf-du-Pape',
    color: '#A62639',
    x: 348, y: 398,
    path: 'M 332,355 C 355,355 366,392 362,438 C 344,445 328,432 332,355 Z',
    bottleColor: '#6D1424'
  },
  {
    id: 'Languedoc-Roussillon',
    label: 'LANGUEDOC-ROUSSILLON',
    sub: 'Pic Saint-Loup • Corbières • Minervois • Collioure • Banyuls',
    color: '#C43B4B',
    x: 292, y: 468,
    path: 'M 255,448 C 295,435 328,448 322,495 C 292,508 262,492 255,448 Z',
    bottleColor: '#8C1D2E'
  },
  {
    id: 'Provence',
    label: 'PROVENCE',
    sub: 'Côtes de Provence • Bandol • Cassis • Palette',
    color: '#E27A68',
    x: 395, y: 458,
    path: 'M 362,438 C 402,432 438,445 435,475 C 405,485 368,478 362,438 Z',
    bottleColor: '#D67C6E'
  },
  {
    id: 'Corse',
    label: 'CORSE',
    sub: 'Patrimonio • Ajaccio • Figari • Porto-Vecchio',
    color: '#D86C4F',
    x: 468, y: 512,
    path: 'M 462,478 C 476,482 480,515 470,545 C 458,542 454,508 462,478 Z',
    bottleColor: '#9E3324'
  }
];

function normalizeRegionId(regionName = '') {
  const r = regionName.toLowerCase();
  if (r.includes('champagne')) return 'Champagne';
  if (r.includes('alsace') || r.includes('lorraine')) return 'Alsace';
  if (r.includes('normand') || r.includes('auge') || r.includes('calvados') || r.includes('cotentin')) return 'Normandie';
  if (r.includes('bretagn') || r.includes('cornouaille')) return 'Bretagne';
  if (r.includes('loire') || r.includes('sancerre') || r.includes('touraine') || r.includes('anjou')) return 'Val de Loire';
  if (r.includes('bourgogne') || r.includes('chablis') || r.includes('beaune') || r.includes('nuits')) return 'Bourgogne';
  if (r.includes('jura') || r.includes('arbois')) return 'Jura';
  if (r.includes('savoie') || r.includes('bugey') || r.includes('chartreuse')) return 'Savoie';
  if (r.includes('beaujolais') || r.includes('morgon')) return 'Beaujolais';
  if (r.includes('charente') || r.includes('cognac') || r.includes('pineau')) return 'Poitou-Charentes';
  if (r.includes('bordeaux') || r.includes('bordelais') || r.includes('margaux') || r.includes('pauillac') || r.includes('médoc')) return 'Bordeaux';
  if (r.includes('sud-ouest') || r.includes('armagnac') || r.includes('cahors') || r.includes('madiran')) return 'Sud-Ouest';
  if (r.includes('rhône') || r.includes('rhone') || r.includes('châteauneuf')) return 'Vallée du Rhône';
  if (r.includes('languedoc') || r.includes('roussillon') || r.includes('corbières')) return 'Languedoc-Roussillon';
  if (r.includes('provence') || r.includes('bandol')) return 'Provence';
  if (r.includes('corse') || r.includes('patrimonio')) return 'Corse';
  return regionName;
}

// ============================================================================
// COMPOSANT BOUTEILLE 3D VUE DE FACE (AVEC SUPPORT VIN, CIDRE & SPIRITUEUX)
// ============================================================================
function RealisticBottleSVG({ wine, size = 'rack' }) {
  const isLarge = size === 'showcase';
  const category = getCategoryFromType(wine.type);
  const shape = category === 'Cidre' && (!wine.bottleShape || wine.bottleShape === 'champagne') ? 'cider' : wine.bottleShape || DRINK_CATEGORIES[category].defaultShape;

  // Couleurs réalistes du verre et du liquide selon le type
  const palette = useMemo(() => {
    const t = (wine.type || '').toLowerCase();
    if (category === 'Cidre') {
      return {
        glassTop: '#3A2910',
        glassMid: '#4C3514',
        glassBot: '#211A0B',
        liquid: '#9D6B23',
        capsule: wine.capsuleColor || '#C89D32'
      };
    }
    if (category === 'Alcool') {
      const isClear = t.includes('gin') || t.includes('eau');
      const isGreen = t.includes('chartreuse');
      return {
        glassTop: isClear ? '#E8EEF0' : isGreen ? '#244A2C' : '#3E2210',
        glassMid: isClear ? '#D5E2E6' : isGreen ? '#387A44' : '#9E5418',
        glassBot: isClear ? '#B8CBD0' : isGreen ? '#1A3820' : '#582808',
        liquid: isClear ? '#E2EFF2' : isGreen ? '#429B46' : '#C86D1E',
        capsule: wine.capsuleColor || '#3D2314'
      };
    }
    if (t.includes('ros')) {
      return {
        glassTop: '#F7E5DC',
        glassMid: '#E8B8A2',
        glassBot: '#D6957C',
        liquid: '#E5A992',
        capsule: wine.capsuleColor || '#D8B49B'
      };
    }
    if (t.includes('blanc') || t.includes('liquoreux')) {
      return {
        glassTop: '#3E4E24',
        glassMid: '#6E8236',
        glassBot: '#2C3818',
        liquid: '#E6C35C',
        capsule: wine.capsuleColor || '#C7A955'
      };
    }
    if (t.includes('effervescent') || shape === 'champagne') {
      return {
        glassTop: '#1E3318',
        glassMid: '#2D4A22',
        glassBot: '#12200E',
        liquid: '#DFB950',
        capsule: wine.capsuleColor || '#D4AF37'
      };
    }
    return {
      glassTop: '#1E0D10',
      glassMid: '#3B1117',
      glassBot: '#120709',
      liquid: '#58111A',
      capsule: wine.capsuleColor || '#6B1520'
    };
  }, [wine.type, wine.capsuleColor, category, shape]);

  // Silhouettes SVG authentiques
  const paths = {
    bordeaux: {
      body: 'M 39,18 L 61,18 L 61,68 C 61,80 82,86 82,106 L 82,238 C 82,245 77,248 70,248 L 30,248 C 23,248 18,245 18,238 L 18,106 C 18,86 39,80 39,68 Z',
      capsule: 'M 38,16 L 62,16 L 62,50 L 38,50 Z',
      labelBox: { x: 20, y: 112, w: 60, h: 92 }
    },
    burgundy: {
      body: 'M 40,18 L 60,18 L 60,62 C 60,88 85,105 85,142 L 85,238 C 85,245 79,248 72,248 L 28,248 C 21,248 15,245 15,238 L 15,142 C 15,105 40,88 40,62 Z',
      capsule: 'M 39,16 L 61,16 L 61,48 L 39,48 Z',
      labelBox: { x: 18, y: 132, w: 64, h: 82 }
    },
    cider: {
      body: 'M 40,20 L 60,20 L 61,68 C 61,88 82,99 84,128 L 84,236 Q 84,248 72,248 L 28,248 Q 16,248 16,236 L 16,128 C 18,99 39,88 39,68 Z',
      capsule: 'M 39,20 L 61,20 L 61,42 L 39,42 Z',
      labelBox: { x: 19, y: 126, w: 62, h: 86 }
    },
    champagne: {
      body: 'M 38,18 L 62,18 L 63,65 C 64,92 86,112 86,148 L 86,238 C 86,245 80,248 72,248 L 28,248 C 20,248 14,245 14,238 L 14,148 C 14,112 36,92 37,65 Z',
      capsule: 'M 37,16 L 63,16 L 66,78 Q 50,85 34,78 Z',
      labelBox: { x: 17, y: 138, w: 66, h: 80 }
    },
    flute: {
      body: 'M 41,16 L 59,16 L 60,72 C 61,98 76,120 76,155 L 76,238 C 76,245 71,248 65,248 L 35,248 C 29,248 24,245 24,238 L 24,155 C 24,120 39,98 40,72 Z',
      capsule: 'M 40,15 L 60,15 L 60,46 L 40,46 Z',
      labelBox: { x: 25, y: 136, w: 50, h: 78 }
    },
    spirit: {
      body: 'M 38,22 L 62,22 L 62,56 C 62,72 86,76 86,96 L 86,236 C 86,245 80,248 72,248 L 28,248 C 20,248 14,245 14,236 L 14,96 C 14,76 38,72 38,56 Z',
      capsule: 'M 36,16 L 64,16 L 64,42 L 36,42 Z',
      labelBox: { x: 17, y: 108, w: 66, h: 96 }
    }
  };

  const currentShape = paths[shape] || paths.bordeaux;
  const instanceId = useId().replace(/:/g, '');
  const clipId = `bottle-clip-${instanceId}`;
  const labelClipId = `label-clip-${instanceId}`;
  const gradId = `bottle-grad-${instanceId}`;
  const lb = currentShape.labelBox;

  const hasValidCustomLabel = typeof wine.customLabelUrl === 'string' && (/^data:image\/(jpeg|png|webp);base64,/.test(wine.customLabelUrl) || safeHttpsUrl(wine.customLabelUrl));

  if (typeof wine.customBottleUrl === 'string' && (/^data:image\/(jpeg|png|webp);base64,/.test(wine.customBottleUrl) || safeHttpsUrl(wine.customBottleUrl))) {
    return <img src={wine.customBottleUrl} alt={`Photo réelle de ${wine.name}`} className={isLarge ? 'w-44 h-96 object-contain rounded-xl' : 'w-20 h-44 object-contain rounded-lg'} />;
  }

  return (
    <svg
      viewBox="0 0 100 260"
      className={isLarge ? 'w-44 h-96 drop-shadow-[0_20px_30px_rgba(0,0,0,0.85)]' : 'w-20 h-44 drop-shadow-[0_10px_14px_rgba(0,0,0,0.8)]'}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={currentShape.body} />
        </clipPath>
        <clipPath id={labelClipId}>
          <rect x={lb.x} y={lb.y} width={lb.w} height={lb.h} rx="2" />
        </clipPath>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={palette.glassBot} />
          <stop offset="28%" stopColor={palette.glassMid} />
          <stop offset="48%" stopColor={palette.liquid} />
          <stop offset="75%" stopColor={palette.glassMid} />
          <stop offset="100%" stopColor={palette.glassBot} />
        </linearGradient>
      </defs>

      {/* Ombre portée au sol */}
      <ellipse cx="50" cy="251" rx="34" ry="5" fill="rgba(0,0,0,0.65)" />

      {/* Corps en verre de la bouteille */}
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="100" height="260" fill={`url(#${gradId})`} />

        {/* Capsule / Coiffe */}
        <path d={currentShape.capsule} fill={palette.capsule} />
        {shape === 'cider' && <rect x="37" y="27" width="26" height="39" fill="#35280F" opacity="0.7" />}
        <rect x="36" y="16" width="28" height="4" fill="rgba(255,255,255,0.22)" />

        {/* Collerette millésime */}
        <path d="M 33,68 Q 50,74 67,68 L 69,80 Q 50,86 31,80 Z" fill="#F5ECD7" stroke="#B69146" strokeWidth="0.8" />
        <text x="50" y="77" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#2A1B12" fontFamily="Georgia, serif">
          {wine.vintage || 'S.M.'}
        </text>

        {/* ÉTIQUETTE : Soit image IA/Web/Scan haute définition, soit étiquette vectorielle */}
        {hasValidCustomLabel ? (
          <g clipPath={`url(#${labelClipId})`}>
            <image
              href={wine.customLabelUrl}
              x={lb.x}
              y={lb.y}
              width={lb.w}
              height={lb.h}
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        ) : (
          <g clipPath={`url(#${labelClipId})`}>
            <rect
              x={lb.x}
              y={lb.y}
              width={lb.w}
              height={lb.h}
              fill={wine.labelColor || '#FAF6EE'}
              stroke={wine.accentColor || '#9A7B3E'}
              strokeWidth="1.5"
            />
            <rect
              x={lb.x + 2.5}
              y={lb.y + 2.5}
              width={lb.w - 5}
              height={lb.h - 5}
              fill="none"
              stroke={wine.accentColor || '#9A7B3E'}
              strokeWidth="0.5"
            />
            <text
              x="50"
              y={lb.y + 11}
              textAnchor="middle"
              fontSize="3.8"
              letterSpacing="0.5"
              fill={wine.accentColor || '#8C6D32'}
              fontFamily="Georgia, serif"
            >
              {category === 'Cidre' ? (wine.type === 'Poiré' ? 'POIRÉ ARTISANAL' : wine.type === 'Pommeau' ? 'POMMEAU' : 'CIDRE DE TERROIR') : category === 'Alcool' ? 'SPIRITUEUX D’EXCEPTION' : `GRAND VIN DE ${(wine.region || 'FRANCE').toUpperCase()}`}
            </text>

            {/* Gravure miniature */}
            <g stroke={wine.accentColor || '#8C6D32'} fill="none" strokeWidth="0.6">
              <rect x="38" y={lb.y + 16} width="24" height="12" />
              <path d={`M 36,${lb.y + 16} L 50,${lb.y + 10} L 64,${lb.y + 16}`} />
              <line x1="44" y1={lb.y + 16} x2="44" y2={lb.y + 28} />
              <line x1="50" y1={lb.y + 16} x2="50" y2={lb.y + 28} />
              <line x1="56" y1={lb.y + 16} x2="56" y2={lb.y + 28} />
            </g>

            {/* Nom du cru */}
            <text
              x="50"
              y={lb.y + 40}
              textAnchor="middle"
              fontSize="5.5"
              fontWeight="bold"
              fill={wine.labelColor === '#1B1815' ? '#F5E6C8' : '#1E1610'}
              fontFamily="Georgia, serif"
            >
              {(wine.name || '').slice(0, 16)}
            </text>
            {wine.name && wine.name.length > 16 && (
              <text
                x="50"
                y={lb.y + 47}
                textAnchor="middle"
                fontSize="5"
                fontWeight="bold"
                fill={wine.labelColor === '#1B1815' ? '#F5E6C8' : '#1E1610'}
                fontFamily="Georgia, serif"
              >
                {wine.name.slice(16, 32)}
              </text>
            )}

            {/* Appellation */}
            <text
              x="50"
              y={lb.y + 57}
              textAnchor="middle"
              fontSize="4.2"
              fontStyle="italic"
              fill={wine.accentColor || '#7A5C28'}
              fontFamily="Georgia, serif"
            >
              {(wine.appellation || '').slice(0, 22)}
            </text>

            {/* Sceau de cire */}
            <circle cx="50" cy={lb.y + lb.h - 12} r="6" fill="#7A1621" stroke="#D4AF37" strokeWidth="0.6" />
            <text x="50" y={lb.y + lb.h - 10} textAnchor="middle" fontSize="4.5" fontWeight="bold" fill="#FFF" fontFamily="Georgia, serif">
              {wine.vintage}
            </text>
          </g>
        )}

        {/* Reflets cylindriques réalistes du verre */}
        <rect x="23" y="20" width="5" height="225" fill="rgba(255,255,255,0.16)" rx="2" />
        <rect x="30" y="95" width="2" height="145" fill="rgba(255,255,255,0.08)" />
        <rect x="74" y="90" width="6" height="155" fill="rgba(0,0,0,0.32)" />
        {/* Culot de la bouteille */}
        <path d="M 22,248 Q 50,234 78,248 Z" fill="rgba(0,0,0,0.45)" />
      </g>

      {shape === 'cider' && <g>
        <rect x="40" y="12" width="20" height="14" rx="4" fill="#BD8C4F" stroke="#6D4927" />
        <path d="M 39,24 L 61,24 M 41,23 Q 36,48 40,57 M 59,23 Q 64,48 60,57 M 39,45 Q 50,49 61,45" fill="none" stroke="#C9C4AF" strokeWidth="1.3" />
        <ellipse cx="50" cy="240" rx="25" ry="3" fill="#D29A33" opacity="0.25" />
      </g>}
      {/* Contour extérieur du flacon */}
      <path d={currentShape.body} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
    </svg>
  );
}

// ============================================================================
// APPLICATION PRINCIPALE : LE GRAND CHAI
// ============================================================================
export default function App() {
  const [activeTab, setActiveTab] = useState('cellar');
  const [accountId, setAccountId] = useState(() => localStorage.getItem('lgc_active_account') || 'MA-CAVE-PRINCIPALE');
  const [accounts, setAccounts] = useState(() => loadAccounts(localStorage));
  const [newCellarName, setNewCellarName] = useState('');
  const [newCellarOwner, setNewCellarOwner] = useState('');
  const [accountError, setAccountError] = useState('');
  const [accountMessage, setAccountMessage] = useState('');


  const [walls, setWalls] = useState(DEFAULT_WALLS);
  const [wines, setWines] = useState(DEFAULT_WINES);
  const [history, setHistory] = useState(DEFAULT_HISTORY);
  const [selectedWallId, setSelectedWallId] = useState('mur-gauche');
  const [selectedWine, setSelectedWine] = useState(null);
  const selectedWineRef = useRef(selectedWine);
  selectedWineRef.current = selectedWine;
  const [movingWine, setMovingWine] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('Tous');

  // Modales
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSlotTarget, setAddSlotTarget] = useState(null);
  const [showWallConfig, setShowWallConfig] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [cloudTab, setCloudTab] = useState('accounts');

  // Paramètres Cloud & IA
  const [driveWebhookUrl, setDriveWebhookUrl] = useState(() => localStorage.getItem('lgc_drive_webhook_kava20') ?? localStorage.getItem('kava20_drive_url') ?? '');
  const [userGeminiKey, setUserGeminiKey] = useState(() => readGeminiKey(localStorage));
  const [geminiModel, setGeminiModel] = useState(() => localStorage.getItem('lgc_gemini_model') || DEFAULT_GEMINI_MODEL);
  const [syncStatus, setSyncStatus] = useState('Prêt');

  // États du Studio d'Étiquette IA / Web
  const [isFetchingLabel, setIsFetchingLabel] = useState(false);
  const [labelStatusMsg, setLabelStatusMsg] = useState('');
  const [customImageUrlInput, setCustomImageUrlInput] = useState('');
  const [webSearchCandidates, setWebSearchCandidates] = useState([]);
  const [webSearchGrounding, setWebSearchGrounding] = useState(null);
  const [labelDraft, setLabelDraft] = useState(null);

  // États du Scanner IA
  const [isScanning, setIsScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState(null);
  const [scanError, setScanError] = useState('');
  const [sommelierError, setSommelierError] = useState('');
  const [wallError, setWallError] = useState('');
  const [deletingWallId, setDeletingWallId] = useState(null);
  const [destinationWallId, setDestinationWallId] = useState('');
  const [addError, setAddError] = useState('');
  const cellarRef = useRef({ walls, wines, history });
  cellarRef.current = { walls, wines, history };
  const accountEpoch = useRef(0);

  // États du Sommelier IA
  const [dishInput, setDishInput] = useState('');
  const [sommelierResult, setSommelierResult] = useState(null);
  const [isAskingSommelier, setIsAskingSommelier] = useState(false);

  // États Carte de France
  const [selectedMapRegion, setSelectedMapRegion] = useState(null);
  const [mapFilterType, setMapFilterType] = useState('Tous');

  // Formulaire nouvelle bouteille (Vin, Cidre ou Alcool)
  const [newWine, setNewWine] = useState(emptyWine);

  // Chargement des données du compte actif et migration des sauvegardes précédentes
  useEffect(() => {
    accountEpoch.current += 1;
    setSelectedWine(null);
    setMovingWine(null);
    setSommelierResult(null);
    setSommelierError('');
    setShowAddModal(false);
    setShowScannerModal(false);
    setShowWallConfig(false);
    setWebSearchGrounding(null);
    setLabelDraft(null);
    setAddSlotTarget(null);
    setIsScanning(false);
    setIsFetchingLabel(false);
    setIsAskingSommelier(false);
    localStorage.setItem('lgc_active_account', accountId);
    try {
      const parsed = loadCellar(localStorage, accountId);
      if (parsed) {
        setWalls(parsed.walls?.length ? parsed.walls : DEFAULT_WALLS);
        setSelectedWallId(parsed.walls?.[0]?.id || DEFAULT_WALLS[0].id);
        if (Array.isArray(parsed.wines)) setWines(parsed.wines);
        if (parsed.history) setHistory(parsed.history);
      } else if (accountId === 'CAVE-DE-PAPA') {
        setWalls(DEFAULT_WALLS);
        setWines([DEFAULT_WINES[2], DEFAULT_WINES[3]]);
        setHistory([]);
      } else {
        setWalls(DEFAULT_WALLS);
        setWines(DEFAULT_WINES);
        setHistory(DEFAULT_HISTORY);
      }
    } catch (e) {
      console.error(e);
    }
  }, [accountId]);

  // Sauvegarde locale + Google Drive Kava 20
  const saveCellarData = async (nextWalls = walls, nextWines = wines, nextHistory = history) => {
    const payload = {
      folderName: 'Kava 20',
      accountId,
      updatedAt: new Date().toISOString(),
      walls: nextWalls,
      wines: nextWines,
      history: nextHistory
    };
    try {
      localStorage.setItem(`lgc_cellar_data_${accountId}`, JSON.stringify(payload));
    } catch {
      setSyncStatus('Mémoire locale pleine : exportez votre cave avant de fermer cette page.');
      return;
    }

    if (driveWebhookUrl && driveWebhookUrl.startsWith('https://script.google.com')) {
      try {
        setSyncStatus('Sauvegarde Drive Kava 20...');
        await fetch(driveWebhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        setSyncStatus('Synchronisé sur Drive (Kava 20)');
      } catch {
        setSyncStatus('Sauvegardé en local');
      }
    }
  };

  const updateCellar = (nextWalls, nextWines, nextHistory) => {
    cellarRef.current = { walls: nextWalls, wines: nextWines, history: nextHistory };
    setWalls(nextWalls);
    setWines(nextWines);
    setHistory(nextHistory);
    saveCellarData(nextWalls, nextWines, nextHistory);
  };

  const patchWine = (id, changes, epoch = accountEpoch.current) => {
    if (epoch !== accountEpoch.current) return;
    const current = cellarRef.current;
    const wine = current.wines.find(w => w.id === id);
    if (!wine) return;
    const updated = { ...wine, ...changes };
    updateCellar(current.walls, current.wines.map(w => w.id === id ? updated : w), current.history);
    setSelectedWine(prev => prev?.id === id ? updated : prev);
  };

  const configureWall = (id, field, value) => {
    try {
      const next = field === 'name' ? walls.map(w => w.id === id ? { ...w, name: value } : w) : resizeWall(walls, wines, id, field, Number(value));
      updateCellar(next, wines, history);
      setWallError('');
    } catch (error) { setWallError(error.message); }
  };

  const confirmRemoveWall = () => {
    try {
      const next = removeWall(walls, wines, deletingWallId, destinationWallId);
      updateCellar(next.walls, next.wines, history);
      if (selectedWallId === deletingWallId) setSelectedWallId(destinationWallId || next.walls[0].id);
      setAddSlotTarget(null);
      setMovingWine(null);
      setDeletingWallId(null);
      setWallError('');
    } catch (error) { setWallError(error.message); }
  };

  const handleCreateCellar = (e) => {
    e.preventDefault();
    try {
      const created = createLocalCellar(localStorage, accounts, newCellarName, newCellarOwner);
      setAccounts(created.accounts); setAccountId(created.account.id);
      setNewCellarName(''); setNewCellarOwner(''); setAccountError('');
      setAccountMessage(`La cave « ${created.account.name} » a été créée, sans bouteille de démonstration.`);
    } catch (error) { setAccountError(error.message); }
  };

  const handleImportCellar = async e => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Choisissez une sauvegarde de moins de 20 Mo.');
      const imported = importCellarData(await file.text());
      const baseName = imported.name || file.name.replace(/\.json$/i, '') || 'Cave importée';
      let name = baseName; let index = 2;
      while (accounts.some(a => a.name.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'))) name = `${baseName} (${index++})`;
      const created = createLocalCellar(localStorage, accounts, name.slice(0, 80), imported.owner, imported.cellar);
      setAccounts(created.accounts); setAccountId(created.account.id); setAccountError('');
      setAccountMessage(`La cave « ${created.account.name} » a été importée. Vos autres caves sont conservées.`);
    } catch (error) { setAccountError(error.message); }
  };

  const aiAvailable = Boolean(AI_PROXY_URL || userGeminiKey.trim());
  const [aiServiceStatus, setAIServiceStatus] = useState('');
  const [checkingAIService, setCheckingAIService] = useState(false);
  const verifyAIService = async () => {
    setCheckingAIService(true);
    setAIServiceStatus('Vérification en cours…');
    try {
      await checkAIService(AI_PROXY_URL, { signal: AbortSignal.timeout(15000) });
      setAIServiceStatus('Service IA prêt. Aucune clé à saisir sur cet appareil.');
    } catch (error) {
      setAIServiceStatus(error.name === 'TimeoutError' ? 'Le service met trop de temps à répondre. Réessayez.' : error.message);
    } finally { setCheckingAIService(false); }
  };
  const gemini = (options) => askGemini({ key: userGeminiKey, proxyUrl: AI_PROXY_URL, model: geminiModel, ...options });

  // Statut d'apogée (adapté aux spiritueux)
  const getApogeeInfo = (wine) => {
    const cat = getCategoryFromType(wine.type);
    if (getQuantity(wine) === 0) return { status: 'empty', label: 'Stock épuisé', badgeClass: 'bg-stone-900 text-stone-400 border-stone-600', dotColor: '#78716C' };
    if (cat === 'Alcool') {
      return {
        status: 'spirit',
        label: 'Spiritueux • Garde illimitée',
        badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-600/50',
        dotColor: '#F59E0B'
      };
    }
    if (CURRENT_YEAR >= wine.drinkLimit) {
      return {
        status: 'urgent',
        label: `À boire d’urgence (limite ${wine.drinkLimit})`,
        badgeClass: 'bg-red-950/90 text-red-200 border-red-500',
        dotColor: '#EF4444'
      };
    }
    if (CURRENT_YEAR >= wine.peakEnd - 1) {
      return {
        status: 'soon',
        label: `Fin d’apogée proche (${wine.peakEnd})`,
        badgeClass: 'bg-orange-950/90 text-orange-200 border-orange-500',
        dotColor: '#F97316'
      };
    }
    if (CURRENT_YEAR >= wine.peakStart && CURRENT_YEAR <= wine.peakEnd) {
      return {
        status: 'peak',
        label: `À son apogée (${wine.peakStart}-${wine.peakEnd})`,
        badgeClass: 'bg-emerald-950/90 text-emerald-200 border-emerald-500',
        dotColor: '#10B981'
      };
    }
    return {
      status: 'aging',
      label: `À garder (apogée dès ${wine.peakStart})`,
      badgeClass: 'bg-sky-950/90 text-sky-200 border-sky-500',
      dotColor: '#38BDF8'
    };
  };

  // ============================================================================
  // 1. RECONSTITUTION D’ÉTIQUETTE D’APRÈS LE STYLE DÉCRIT PAR GOOGLE IA
  // ============================================================================
  const handleGenerateAILabel = async (wine) => {
    if (!wine || isFetchingLabel || getCategoryFromType(wine.type) !== 'Vin') return;
    const epoch = accountEpoch.current;
    setIsFetchingLabel(true);
    setLabelStatusMsg('Google analyse le style de cette étiquette...');
    try {
      const { value } = await gemini({
        prompt: `Décris le style connu de l'étiquette de cette bouteille : ${JSON.stringify({ name: wine.name, appellation: wine.appellation, vintage: wine.vintage, region: wine.region, type: wine.type })}. Donne des couleurs hexadécimales bg, border, subText, sealColor et les textes motto et footer. Reste sobre si tu ne connais pas cette étiquette. Cette illustration sera une reconstitution, pas une photo officielle.`,
        schema: LABEL_SCHEMA
      });
      const style = {};
      for (const field of ['bg', 'border', 'subText', 'sealColor']) {
        if (/^#[0-9a-f]{6}$/i.test(value[field])) style[field] = value[field];
      }
      for (const field of ['motto', 'footer']) if (typeof value[field] === 'string') style[field] = value[field];
      const dataUrl = await generateAILabelDataUrl(wine, style);
      if (epoch !== accountEpoch.current) return;
      patchWine(wine.id, { customLabelUrl: dataUrl, customBottleUrl: null }, epoch);
      setLabelStatusMsg('Reconstitution créée avec Google IA. Pour une étiquette exacte, choisissez une vraie photo.');
    } catch (error) {
      if (epoch === accountEpoch.current) setLabelStatusMsg(error.message);
    } finally {
      if (epoch === accountEpoch.current) setIsFetchingLabel(false);
    }
  };

  // ============================================================================
  // 2. RECHERCHE AUTOMATIQUE DE VRAIES PHOTOS D'ÉTIQUETTES SUR LE WEB
  // ============================================================================
  const handleSearchWebLabels = async (wine) => {
    if (!wine || isFetchingLabel || getCategoryFromType(wine.type) !== 'Vin') return;
    const epoch = accountEpoch.current;
    setIsFetchingLabel(true);
    setLabelStatusMsg('Recherche de photos réelles de cette bouteille...');
    setWebSearchCandidates([]);
    setWebSearchGrounding(null);
    const found = [...verifiedLabelReferences(wine)];
    let googleError = '';
    try {
      if (aiAvailable && !found.length) {
        try {
          const { grounding } = await gemini({ imageSearch: true, model: 'gemini-3.1-flash-image',
            prompt: `Utilise Google Image Search pour trouver des photographies de cette bouteille et de son étiquette exacte : ${JSON.stringify({ name: wine.name, appellation: wine.appellation, vintage: wine.vintage, type: wine.type })}. Le domaine, la cuvée et le millésime doivent correspondre. Privilégie le producteur et ses revendeurs. Les sources de photographies originales sont nécessaires, aucune reconstitution ne sera utilisée.`
          });
          if (epoch === accountEpoch.current && selectedWineRef.current?.id === wine.id) setWebSearchGrounding(grounding);
          found.push(...groundedLabelCandidates(grounding));
        } catch (error) { googleError = error.message; }
      }
      // Free catalogue: candidates must be checked by the user before applying.
      if (!found.length) {
        const q = encodeURIComponent(`${wine.name} ${wine.vintage || ''}`.trim());
        const results = await Promise.allSettled([
          fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=6`, { signal: AbortSignal.timeout(12000) }).then(r => r.ok ? r.json() : {}),
          fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${q}&gsrlimit=6&prop=imageinfo&iiprop=url&format=json&origin=*`, { signal: AbortSignal.timeout(12000) }).then(r => r.ok ? r.json() : {})
        ]);
        const off = results[0].status === 'fulfilled' ? results[0].value : {};
        (off.products || []).forEach(p => {
          if (safeHttpsUrl(p.image_front_url)) found.push({ title: p.product_name || wine.name, url: p.image_front_url, source: `https://world.openfoodfacts.org/product/${encodeURIComponent(p.code || '')}` });
        });
        const wiki = results[1].status === 'fulfilled' ? results[1].value : {};
        Object.values(wiki.query?.pages || {}).forEach(p => {
          const info = p.imageinfo?.[0];
          if (safeHttpsUrl(info?.url)) found.push({ title: p.title.replace('File:', ''), url: info.url, source: safeHttpsUrl(info.descriptionurl) || 'https://commons.wikimedia.org/' });
        });
      }
      if (epoch !== accountEpoch.current || selectedWineRef.current?.id !== wine.id) return;
      const ranked = rankLabelCandidates(found, wine);
      setWebSearchCandidates(ranked);
      setLabelStatusMsg(ranked.length ? 'Photos trouvées dans les sources : ouvrez le site d’origine ou choisissez « Vérifier et recadrer ».' : `${googleError ? googleError + ' ' : ''}Aucune photo correspondante trouvée. Utilisez Google Images ci-dessous, puis collez l’adresse directe d’une photo ou importez votre étiquette.`);
    } catch (error) {
      if (epoch === accountEpoch.current) setLabelStatusMsg(error.message);
    } finally {
      if (epoch === accountEpoch.current) setIsFetchingLabel(false);
    }
  };

  // Appliquer une URL d'image Web (avec conversion proxy anti-CORS automatique)
  const handleApplyExternalImageUrl = async (urlToApply, source = '', useWholeBottle = false) => {
    if (!urlToApply || !selectedWine || isFetchingLabel) return;
    const target = selectedWine;
    const epoch = accountEpoch.current;
    setIsFetchingLabel(true);
    setLabelStatusMsg('Chargement et vérification de la photo réelle...');
    try {
      const dataUrl = await loadRemoteLabel(urlToApply.trim());
      let crop = null, verification = '', matches = null;
      if (aiAvailable && getCategoryFromType(target.type) === 'Vin') {
        try {
          const { value } = await gemini({ image: dataUrl, schema: LABEL_CHECK_SCHEMA,
            prompt: `Cette image doit représenter l'étiquette de ${JSON.stringify({ name: target.name, appellation: target.appellation, vintage: target.vintage })}. Lis le domaine, la cuvée et le millésime visibles. Retourne matches (true seulement si le domaine et la cuvée correspondent, et aucun millésime différent n'est visible), reason (ce qui est lu et toute incertitude, en français), labelBox ([ymin,xmin,ymax,xmax] de l'étiquette principale, coordonnées de 0 à 1000). Si la photo montre une bouteille entière, cadre uniquement son étiquette de face, pas le col ni le fond. Si aucune étiquette n'est lisible, matches=false et cadre l'image entière. N'invente pas les caractères illisibles.`
          });
          crop = normalizeLabelBox(value.labelBox);
          matches = typeof value.matches === 'boolean' ? value.matches : null;
          verification = typeof value.reason === 'string' ? value.reason : '';
        } catch (error) { verification = `La vérification Google n’a pas abouti : ${error.message} Vous pouvez contrôler et recadrer la photo manuellement.`; }
      } else verification = 'Vérification manuelle : contrôlez le domaine, la cuvée et le millésime sur cette photo.';
      if (epoch !== accountEpoch.current || selectedWineRef.current?.id !== target.id) return;
      setLabelDraft({ wineId: target.id, dataUrl, source, crop, verification, matches, useWholeBottle });
      setLabelStatusMsg('Vérifiez l’aperçu et le recadrage avant de remplacer votre étiquette.');
    } catch (error) {
      if (epoch === accountEpoch.current) setLabelStatusMsg(error.message);
    } finally {
      if (epoch === accountEpoch.current) setIsFetchingLabel(false);
    }
  };

  // ============================================================================
  // 3. SCAN PHOTO D'ÉTIQUETTE (CAMÉRA TÉLÉPHONE)
  // ============================================================================
  const handleDirectLabelPhotoUpload = async (e, targetWine) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !targetWine || isFetchingLabel) return;
    const epoch = accountEpoch.current;
    setIsFetchingLabel(true);
    setLabelStatusMsg('Préparation de votre photo...');
    try {
      const photo = await readPhoto(file);
      if (epoch !== accountEpoch.current || selectedWineRef.current?.id !== targetWine.id) return;
      setLabelDraft({ wineId: targetWine.id, dataUrl: photo, source: '', verification: 'Photo personnelle : ajustez le cadre autour de l’étiquette, ou choisissez la bouteille entière.', matches: null });
      setLabelStatusMsg('Vérifiez le recadrage de votre photo.');
    } catch (error) {
      if (epoch === accountEpoch.current) setLabelStatusMsg(error.message);
    } finally {
      if (epoch === accountEpoch.current) setIsFetchingLabel(false);
    }
  };

  const handleScannerFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isScanning) return;
    const epoch = accountEpoch.current;
    setIsScanning(true);
    setScanError('');
    setScanPreview(null);
    try {
      const photo = await readPhoto(file);
      if (epoch !== accountEpoch.current) return;
      setScanPreview(photo);
      const { value } = await gemini({ image: photo, schema: SCAN_SCHEMA,
        prompt: `Lis cette étiquette de bouteille. Extrais uniquement les informations lisibles : name (domaine, marque et cuvée), appellation, region, vintage (année, ou null si absente), grapes (cépages ou variétés). Classe la boisson avec category et type parmi : ${JSON.stringify(Object.fromEntries(Object.entries(DRINK_CATEGORIES).map(([cat, data]) => [cat, data.types])))}. Pour une image sans étiquette lisible, renvoie name vide. N'invente ni notes, ni millésime, ni dates de garde.`
      });
      const fields = scanFields(value, DRINK_CATEGORIES);
      const label = await fetchImageAsLabelDataUrl(photo);
      if (epoch !== accountEpoch.current) return;
      setNewWine({ ...emptyWine(), ...fields, customLabelUrl: label });
      setAddError('');
      setShowScannerModal(false);
      setShowAddModal(true);
    } catch (error) {
      if (epoch === accountEpoch.current) setScanError(error.message);
    } finally {
      if (epoch === accountEpoch.current) setIsScanning(false);
    }
  };

  // Ajouter la bouteille dans la cave
  const handleAddWineSubmit = async (e) => {
    e.preventDefault();
    setAddError('');
    const epoch = accountEpoch.current;
    let quantity;
    try { quantity = parseQuantity(newWine.quantity, 1); } catch (error) { setAddError(error.message); return; }
    let slot = addSlotTarget;
    if (slot) {
      const wall = walls.find(w => w.id === slot.wallId);
      if (!wall || slot.row > wall.rows || slot.col > wall.cols || wines.some(w => w.wallId === slot.wallId && w.row === slot.row && w.col === slot.col)) slot = null;
    }
    slot ||= findFreeSlot(walls, wines, selectedWallId);
    if (!slot) { setAddError('Votre cave est pleine. Ajoutez un mur ou agrandissez un mur existant.'); return; }

    const created = {
      id: `w_${crypto.randomUUID()}`,
      ...newWine,
      quantity,
      vintage: newWine.vintage === '' ? null : Number(newWine.vintage),
      peakStart: Number(newWine.peakStart) || CURRENT_YEAR,
      peakEnd: Number(newWine.peakEnd) || CURRENT_YEAR + 5,
      drinkLimit: Number(newWine.drinkLimit) || CURRENT_YEAR + 8,
      webRating: newWine.webRating,
      webUrl: newWine.webUrl || `https://www.vivino.com/search/wines?q=${encodeURIComponent(newWine.name + ' ' + newWine.vintage)}`,
      foodPairing: typeof newWine.foodPairing === 'string'
        ? newWine.foodPairing.split(',').map((s) => s.trim()).filter(Boolean)
        : newWine.foodPairing || ['Gastronomie française'],
      ...slot
    };

    // Génère automatiquement une belle étiquette si aucune photo n'a été fournie
    if (!created.customLabelUrl) {
      created.customLabelUrl = await generateAILabelDataUrl(created, {});
    }

    if (epoch !== accountEpoch.current) return;
    const current = cellarRef.current;
    const freeSlot = findFreeSlot(current.walls, current.wines, slot.wallId);
    if (!freeSlot) { setAddError('Votre cave est pleine. Ajoutez un mur.'); return; }
    const occupied = current.wines.some(w => w.wallId === slot.wallId && w.row === slot.row && w.col === slot.col);
    if (occupied) Object.assign(created, freeSlot);
    updateCellar(current.walls, [...current.wines, created], current.history);
    setNewWine(emptyWine());
    setShowAddModal(false);
    setAddSlotTarget(null);
  };

  // Marquer une bouteille comme bue
  const handleDrinkBottle = (wine) => {
    const current = cellarRef.current;
    try {
      const next = consumeBottle(current.wines, current.history, wine.id);
      updateCellar(current.walls, next.wines, next.history);
      setSelectedWine(next.wines.find(w => w.id === wine.id));
    } catch (error) { setLabelStatusMsg(error.message); }
  };

  const handleRemoveEmptyReference = wine => {
    if (!window.confirm(`Retirer la fiche « ${wine.name} » de ce casier ? Le carnet de dégustation sera conservé.`)) return;
    const current = cellarRef.current;
    try {
      updateCellar(current.walls, removeEmptyReference(current.wines, wine.id), current.history);
      setSelectedWine(null);
    } catch (error) { setLabelStatusMsg(error.message); }
  };

  // Sommelier IA
  const handleAskSommelier = async (e, suggestion) => {
    e?.preventDefault();
    const dish = (suggestion || dishInput).trim();
    if (!dish || isAskingSommelier) return;
    setDishInput(dish);
    setSommelierResult(null);
    setSommelierError('');
    if (!wines.some(w => getQuantity(w) > 0)) { setSommelierError('Ajoutez une bouteille à votre cave pour obtenir un accord.'); return; }
    const epoch = accountEpoch.current;
    setIsAskingSommelier(true);
    try {
      const inventory = wines.filter(w => getQuantity(w) > 0).map(w => ({ id: w.id, quantity: getQuantity(w), name: w.name, vintage: w.vintage, type: w.type, appellation: w.appellation, region: w.region, grapes: w.grapes, foodPairing: w.foodPairing, maturity: getApogeeInfo(w).label }));
      const { value } = await gemini({ schema: SOMMELIER_SCHEMA,
        prompt: `Tu es sommelier. Pour cette demande ${JSON.stringify(dish)}, propose la meilleure bouteille de cet inventaire et une alternative pertinente si possible : ${JSON.stringify(inventory)}. Retourne bestWineId et secondWineId (identifiants exacts, jamais inventés), reason (explication précise de l'accord, en tenant compte des ingrédients et de la cuisson) et serviceTip (température, carafage). Si aucun accord n'est idéal, explique la limite honnêtement. Ne recommande aucune bouteille hors de cet inventaire.`
      });
      if (epoch !== accountEpoch.current) return;
      setSommelierResult({ dish, ...resolveSommelier(value, cellarRef.current.wines) });
    } catch (error) {
      if (epoch === accountEpoch.current) setSommelierError(error.message);
    } finally {
      if (epoch === accountEpoch.current) setIsAskingSommelier(false);
    }
  };

  const liveSommelierResult = sommelierResult && wines.some(w => w.id === sommelierResult.best.id && getQuantity(w) > 0) ? {
    ...sommelierResult,
    best: wines.find(w => w.id === sommelierResult.best.id),
    alternative: wines.find(w => w.id === sommelierResult.alternative?.id && getQuantity(w) > 0) || null
  } : null;

  const activeWall = walls.find((w) => w.id === selectedWallId) || walls[0];
  const filteredWines = useMemo(() => {
    return wines.filter((w) => {
      const matchSearch = `${w.name} ${w.appellation} ${w.region} ${w.vintage} ${w.type}`.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      if (filterType === 'Tous') return true;
      if (filterType === 'Cidre') return getCategoryFromType(w.type) === 'Cidre';
      if (filterType === 'Alcool') return getCategoryFromType(w.type) === 'Alcool';
      return w.type === filterType;
    });
  }, [wines, searchQuery, filterType]);

  return (
    <div className="min-h-screen bg-[#0F0A08] text-stone-100 flex flex-col md:flex-row pb-20 md:pb-0">
      {/* BARRE LATÉRALE SUR ORDINATEUR */}
      <aside className="hidden md:flex md:w-80 bg-[#160F0B] border-r border-amber-900/30 flex-col justify-between p-6 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <img src="/images/cave-grand-chai.jpeg" alt="Cave voûtée du Grand Chai" width="88" height="88" className="w-[88px] h-[88px] shrink-0 rounded-2xl object-cover border border-amber-700/50 shadow-lg" />
            <div>
              <h1 className="text-2xl font-serif font-bold text-amber-100 tracking-wide">Le Grand Chai</h1>
              <p className="text-xs text-amber-500/80">Cave à Vin, Cidre & Spiritueux</p>
            </div>
          </div>

          <nav className="space-y-2">
            {[
              { id: 'cellar', label: 'Plan de Cave & Casiers', icon: Grid },
              { id: 'apogee', label: 'Suivi Apogée & Alertes', icon: AlertTriangle },
              { id: 'sommelier', label: 'Sommelier IA (Accords)', icon: Utensils },
              { id: 'map', label: 'Carte des Vins de France', icon: MapIcon },
              { id: 'history', label: 'Carnet de Dégustation', icon: BookOpen }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === item.id
                      ? 'bg-gradient-to-r from-amber-800/60 to-red-950/60 text-amber-200 border border-amber-600/40 shadow-md'
                      : 'text-stone-400 hover:bg-stone-900/60 hover:text-stone-200'
                  }`}
                >
                  <Icon className="w-4 h-4 text-amber-400" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Espace Comptes & Google Drive Kava 20 */}
        <div className="space-y-3 pt-6 border-t border-amber-900/30">
          <div className="p-3 rounded-xl bg-stone-900/80 border border-amber-900/30">
            <div className="text-[11px] uppercase tracking-wider text-amber-500 font-semibold">Cave Active</div>
            <div className="text-sm font-bold text-amber-100 truncate mt-0.5">{accounts.find(a => a.id === accountId)?.name || accountId}</div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              {syncStatus}
            </div>
          </div>
          <button
            onClick={() => setShowCloudModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/40 text-amber-200 text-xs font-semibold transition"
          >
            <Cloud className="w-4 h-4" />
            Comptes, Drive Kava 20 & Clé IA
          </button>
        </div>
      </aside>

      {/* CONTENU PRINCIPAL */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* EN-TÊTE SUPÉRIEUR */}
        <header className="bg-[#160F0B]/95 border-b border-amber-900/30 px-4 md:px-8 py-4 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/images/cave-grand-chai.jpeg" alt="Cave voûtée du Grand Chai" width="88" height="88" className="md:hidden w-[88px] h-[88px] shrink-0 rounded-2xl object-cover border border-amber-700/50 shadow-lg" />
            <h2 className="text-xl md:text-2xl font-serif font-bold text-amber-100">
              {activeTab === 'cellar' && 'Vos Casiers en Chêne Massif'}
              {activeTab === 'apogee' && 'Suivi de l’Apogée & Limites de Buvabilité'}
              {activeTab === 'sommelier' && 'Sommelier IA : Accords Mets, Vins & Cidres'}
              {activeTab === 'map' && 'Carte Géographique des Vins & Terroirs de France'}
              {activeTab === 'history' && 'Carnet des Bouteilles Dégustées'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCloudModal(true)}
              className="md:hidden p-2.5 rounded-xl bg-stone-900 border border-amber-800/40 text-amber-300"
              title="Comptes & Drive Kava 20"
            >
              <Cloud className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setScanError(''); setScanPreview(null); setShowScannerModal(true); }}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs md:text-sm shadow-lg transition"
            >
              <Camera className="w-4 h-4" />
              <span>Scanner</span>
            </button>
            <button
              onClick={() => {
                setAddSlotTarget(null);
                setNewWine(emptyWine());
                setAddError('');
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-900/90 hover:bg-red-800 border border-amber-600/40 text-amber-100 font-semibold text-xs md:text-sm shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter</span>
            </button>
          </div>
        </header>

        {/* ONGLET 1 : PLAN DE CAVE & CASIERS */}
        {activeTab === 'cellar' && (
          <div className="p-4 md:p-8 space-y-6">
            {/* Barre de sélection des murs & filtres */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#18110D] p-4 rounded-2xl border border-amber-900/30">
              <div className="flex flex-wrap items-center gap-2">
                {walls.map((wall) => {
                  const count = wines.filter((w) => w.wallId === wall.id).length;
                  return (
                    <button
                      key={wall.id}
                      onClick={() => setSelectedWallId(wall.id)}
                      className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition ${
                        selectedWallId === wall.id
                          ? 'bg-amber-600 text-stone-950 shadow-md'
                          : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-amber-900/30'
                      }`}
                    >
                      {wall.name} ({count}/{wall.rows * wall.cols})
                    </button>
                  );
                })}
                <button
                  onClick={() => { setWallError(''); setDeletingWallId(null); setShowWallConfig(true); }}
                  className="px-3 py-2 rounded-xl text-xs bg-stone-900 hover:bg-stone-800 text-amber-300 border border-amber-800/40 flex items-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Configurer murs
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Rechercher cru, cidre, alcool..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 rounded-xl bg-stone-950 border border-amber-900/40 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                {['Tous', 'Rouge', 'Blanc', 'Rosé', 'Effervescent', 'Cidre', 'Alcool'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                      filterType === t ? 'bg-amber-700 text-white' : 'bg-stone-900 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {t === 'Cidre' ? '🍏 Cidres' : t === 'Alcool' ? '🥃 Alcools' : t}
                  </button>
                ))}
              </div>
            </div>

            <p aria-live="polite" aria-label="Stock total de la cave" className="text-sm text-amber-200">
              <strong>{totalQuantity(wines)} bouteille{totalQuantity(wines) === 1 ? '' : 's'}</strong> en stock · {wines.length} référence{wines.length === 1 ? '' : 's'} · Les compteurs des murs indiquent les casiers occupés.
            </p>

            {movingWine && (
              <div className="p-3 rounded-xl bg-amber-900/40 border border-amber-500 text-amber-200 flex items-center justify-between text-sm">
                <span>
                  Déplacement de <strong>{movingWine.name}</strong> : cliquez sur un casier libre pour y déposer la bouteille.
                </span>
                <button onClick={() => setMovingWine(null)} className="px-3 py-1 rounded-lg bg-stone-900 text-xs">
                  Annuler
                </button>
              </div>
            )}

            {/* Grille des casiers en chêne massif */}
            <div className="p-5 md:p-8 rounded-3xl bg-gradient-to-b from-[#261710] via-[#1B100B] to-[#140B07] border-4 border-[#3E2417] shadow-2xl overflow-x-auto">
              <div
                className="grid gap-4 min-w-[640px]"
                style={{ gridTemplateColumns: `repeat(${activeWall.cols}, minmax(120px, 1fr))` }}
              >
                {Array.from({ length: activeWall.rows }).map((_, rIdx) =>
                  Array.from({ length: activeWall.cols }).map((__, cIdx) => {
                    const row = rIdx + 1;
                    const col = cIdx + 1;
                    const bottle = wines.find((w) => w.wallId === activeWall.id && w.row === row && w.col === col);
                    const matchesFilter = !bottle || filteredWines.some(w => w.id === bottle.id);
                    const apogee = bottle ? getApogeeInfo(bottle) : null;

                    return (
                      <div
                        key={`${row}-${col}`}
                        onClick={() => {
                          if (movingWine && !bottle) {
                            const updated = wines.map((w) =>
                              w.id === movingWine.id ? { ...w, wallId: activeWall.id, row, col } : w
                            );
                            updateCellar(walls, updated, history);
                            setMovingWine(null);
                          } else if (bottle) {
                            setSelectedWine(bottle);
                            setLabelStatusMsg('');
                            setWebSearchCandidates([]);
                            setWebSearchGrounding(null);
                          } else {
                            setAddSlotTarget({ wallId: activeWall.id, row, col });
                            setNewWine(emptyWine());
                            setAddError('');
                            setShowAddModal(true);
                          }
                        }}
                        style={{ opacity: matchesFilter ? 1 : 0.25 }}
                        aria-label={bottle ? `${bottle.name}, rangée ${row}, casier ${col}` : `Casier libre, rangée ${row}, colonne ${col}`}
                        className="group relative h-64 rounded-2xl bg-gradient-to-b from-[#1A0F0A] via-[#110906] to-[#24150E] border-2 border-[#472A1B] hover:border-amber-500/80 shadow-inner flex flex-col items-center justify-between p-2.5 cursor-pointer transition-all"
                      >
                        {/* Éclairage spot chaud de cave */}
                        <div className="absolute inset-x-4 top-0 h-16 bg-gradient-to-b from-amber-500/15 to-transparent pointer-events-none rounded-t-xl" />

                        {/* Repère casier + pastille apogée */}
                        <div className="w-full flex items-center justify-between z-10 px-1">
                          <span className="text-[10px] font-mono text-amber-500/70">
                            R{row}•C{col}
                          </span>
                          {bottle && (
                            <span
                              className="w-2.5 h-2.5 rounded-full shadow"
                              style={{ backgroundColor: apogee.dotColor }}
                              title={apogee.label}
                            />
                          )}
                        </div>

                        {/* Bouteille vue de face ou casier vide */}
                        {bottle ? (
                          <div className="my-auto transform group-hover:scale-105 transition-transform">
                            <RealisticBottleSVG wine={bottle} size="rack" />
                          </div>
                        ) : (
                          <div className="my-auto flex flex-col items-center justify-center text-stone-600 group-hover:text-amber-500/80 transition">
                            <Plus className="w-6 h-6 mb-1" />
                            <span className="text-[10px]">Casier libre</span>
                          </div>
                        )}

                        {/* Plaque en laiton gravée */}
                        {bottle ? (
                          <div className="w-full bg-gradient-to-r from-[#8B6B35] via-[#C5A059] to-[#8B6B35] text-stone-950 rounded-md px-2 py-1 text-center shadow-md">
                            <div className="text-[10px] font-serif font-bold truncate leading-tight">{bottle.name}</div>
                            <div className="text-[9px] font-semibold opacity-85">
                              {bottle.vintage} • {bottle.type}
                            </div>
                            <div className="text-[11px] font-bold">{getQuantity(bottle) === 0 ? 'Stock épuisé' : `${getQuantity(bottle)} bouteille${getQuantity(bottle) === 1 ? '' : 's'}`}</div>
                          </div>
                        ) : (
                          <div className="w-full h-6 rounded-md bg-stone-950/40 border border-stone-800/40" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ONGLET 2 : SUIVI DE L'APOGÉE & LIMITES DE BUVABILITÉ */}
        {activeTab === 'apogee' && (
          <div className="p-4 md:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {wines.filter(w => getQuantity(w) > 0).map((wine) => {
                const ap = getApogeeInfo(wine);
                const wallName = walls.find((w) => w.id === wine.wallId)?.name || wine.wallId;
                return (
                  <div
                    key={wine.id}
                    onClick={() => setSelectedWine(wine)}
                    className="p-4 rounded-2xl bg-[#18110D] border border-amber-900/30 hover:border-amber-500/60 flex items-center gap-4 cursor-pointer transition"
                  >
                    <RealisticBottleSVG wine={wine} size="rack" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full border font-semibold ${ap.badgeClass}`}>
                        {ap.label}
                      </span>
                      <h3 className="font-serif font-bold text-base text-amber-100 truncate">{wine.name}</h3>
                      <p className="text-xs text-stone-400">
                        {wine.appellation} • <strong>{wine.vintage}</strong> ({wine.type})
                      </p>
                      <p className="text-xs text-amber-400/90">
                        📍 {wallName} — Rangée {wine.row}, Casier {wine.col} · {getQuantity(wine)} bouteille(s)
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ONGLET 3 : SOMMELIER IA */}
        {activeTab === 'sommelier' && (
          <div className="p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
            <div className="p-6 rounded-3xl bg-[#18110D] border border-amber-800/40 space-y-4">
              <h3 className="text-xl font-serif font-bold text-amber-200 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Que dégustez-vous ce soir ?
              </h3>
              <p className="text-xs md:text-sm text-stone-400">
                Indiquez votre plat, dessert ou moment (ex: Côte de bœuf, Saint-Jacques, Galette bretonne, Tarte aux pommes, Digestif...) et le Sommelier IA sélectionne la bouteille idéale dans vos casiers.
              </p>
              <form onSubmit={handleAskSommelier} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  aria-label="Plat ou occasion"
                  value={dishInput}
                  onChange={(e) => setDishInput(e.target.value)}
                  placeholder="Ex: Magret de canard aux figues, Crêpes normandes, Homard grillé..."
                  className="min-w-0 flex-1 px-4 py-3 rounded-xl bg-stone-950 border border-amber-800/50 text-sm text-stone-100"
                />
                <button
                  type="submit"
                  disabled={isAskingSommelier || !dishInput.trim() || !wines.length}
                  className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm"
                >
                  {isAskingSommelier ? 'Analyse...' : 'Trouver l’accord'}
                </button>
              </form>
            </div>

            <div className="flex flex-wrap gap-2" aria-label="Suggestions de plats">
              {['Côte de bœuf', 'Saint-Jacques', 'Galette bretonne', 'Tarte aux pommes', 'Fromages', 'Apéritif'].map(dish => (
                <button key={dish} disabled={isAskingSommelier} onClick={() => handleAskSommelier(null, dish)} className="px-3 py-2 rounded-xl bg-stone-800 border border-amber-800/50 text-amber-200 text-xs">{dish}</button>
              ))}
            </div>
            {sommelierError && <p role="alert" className="text-sm text-amber-200">{sommelierError}</p>}
            {!aiAvailable && <button onClick={() => { setCloudTab('ai'); setShowCloudModal(true); }} className="text-xs text-amber-400 underline">Configurer Google IA</button>}

            {liveSommelierResult && liveSommelierResult.best && (
              <div className="p-6 rounded-3xl bg-gradient-to-br from-[#23150E] to-[#140C08] border border-amber-600/50 flex flex-col md:flex-row items-center gap-6">
                <RealisticBottleSVG wine={liveSommelierResult.best} size="showcase" />
                <div className="space-y-3 flex-1">
                  <div className="text-xs uppercase tracking-wider text-amber-400 font-bold">
                    Sélection idéale pour « {liveSommelierResult.dish} »
                  </div>
                  <h4 className="text-2xl font-serif font-bold text-amber-100">
                    {liveSommelierResult.best.name} ({liveSommelierResult.best.vintage || 'Sans millésime'})
                  </h4>
                  <p className="text-sm text-stone-300">
                    {liveSommelierResult.best.appellation} • {liveSommelierResult.best.type}
                  </p>
                  <p className="text-xs text-amber-300 bg-amber-950/50 px-3 py-2 rounded-xl border border-amber-800/40">
                    📍 Emplacement : <strong>{walls.find((w) => w.id === liveSommelierResult.best.wallId)?.name}</strong> — Rangée {liveSommelierResult.best.row}, Casier {liveSommelierResult.best.col}
                  </p>
                  <p className="text-sm text-stone-200">{liveSommelierResult.reason}</p>
                  <p className="text-xs text-stone-400 italic">💡 {liveSommelierResult.serviceTip}</p>
                  <button
                    onClick={() => { const current = wines.find(w => w.id === liveSommelierResult.best.id); setSelectedWine(current || null); setLabelStatusMsg(''); setWebSearchCandidates([]); setWebSearchGrounding(null); }}
                    className="px-4 py-2 rounded-xl bg-amber-600 text-stone-950 font-bold text-xs"
                  >
                    Ouvrir la vitrine de la bouteille
                  </button>
                </div>
              </div>
            )}
            {liveSommelierResult?.alternative && wines.some(w => w.id === liveSommelierResult.alternative.id) && <button
              onClick={() => { setSelectedWine(wines.find(w => w.id === liveSommelierResult.alternative.id)); setLabelStatusMsg(''); setWebSearchCandidates([]); setWebSearchGrounding(null); }}
              className="w-full text-left p-4 rounded-2xl bg-stone-900 border border-amber-800/50 text-amber-200">
              Autre accord possible : {liveSommelierResult.alternative.name} ({liveSommelierResult.alternative.vintage || 'Sans millésime'}) — Voir la bouteille
            </button>}
          </div>
        )}

        {/* ONGLET 4 : CARTE GÉOGRAPHIQUE DES VINS DE FRANCE (STYLE AFFICHE HACHETTE VINS) */}
        {activeTab === 'map' && (
          <div className="p-4 md:p-8 space-y-6">
            {/* Filtres de la carte */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#18110D] p-4 rounded-2xl border border-amber-900/30">
              <div className="flex flex-wrap gap-2">
                {['Tous', 'Rouge', 'Blanc', 'Rosé', 'Effervescent', 'Cidre', 'Alcool'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setMapFilterType(t)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      mapFilterType === t
                        ? 'bg-[#D64527] text-white shadow'
                        : 'bg-stone-900 text-stone-300 hover:bg-stone-800'
                    }`}
                  >
                    {t === 'Cidre' ? '🍏 Cidres & Poirés' : t === 'Alcool' ? '🥃 Spiritueux' : t}
                  </button>
                ))}
              </div>
              <div className="text-xs text-amber-300 font-medium">
                Cliquez sur une région sur la carte pour voir vos bouteilles en cave
              </div>
            </div>

            {/* Affiche Cartographique Hachette Vins */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 rounded-2xl bg-[#EFE6D5] text-[#2B2118] p-5 md:p-8 border-4 border-[#C8B89A] shadow-2xl relative overflow-hidden">
                {/* Grand Titre Affiche */}
                <div className="text-center border-b-2 border-[#B8A686] pb-3 mb-4">
                  <div className="text-3xl md:text-5xl font-black tracking-tight text-[#D64527] font-serif leading-none">
                    CARTE DES VINS
                  </div>
                  <div className="text-2xl md:text-4xl font-black tracking-widest text-[#D64527] font-serif mt-1">
                    DE FRANCE
                  </div>
                </div>

                {/* Encarts supérieurs : Types de verres & Types de bouteilles */}
                <div className="flex flex-wrap justify-between items-center gap-4 mb-2 text-[10px] text-[#4A3B2C] border-b border-[#D5C7AD] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold uppercase">Types de verres :</span>
                    <span>Flûte • Tulipe • Bourgogne • Bordeaux • INAO</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold uppercase">Silhouettes :</span>
                    <span>Alsace • Bourgogne • Bordelaise • Champenoise • Normande • Spiritueux</span>
                  </div>
                </div>

                {/* CARTE GÉOGRAPHIQUE DE LA FRANCE EN SVG HAUTE PRÉCISION */}
                <svg viewBox="0 0 520 560" className="w-full h-auto select-none">
                  {/* Fond mer & océan */}
                  <rect x="0" y="0" width="520" height="560" fill="#E6DEC8" rx="12" />

                  {/* Rose des vents à gauche */}
                  <g transform="translate(58, 105)" stroke="#6E5D4B" strokeWidth="1" fill="none">
                    <circle cx="0" cy="0" r="24" strokeDasharray="2,2" />
                    <circle cx="0" cy="0" r="16" />
                    <path d="M 0,-28 L 4,0 L 0,28 L -4,0 Z" fill="#8C7A65" />
                    <path d="M -28,0 L 0,-4 L 28,0 L 0,4 Z" fill="#8C7A65" />
                    <text x="0" y="-32" textAnchor="middle" fontSize="8" fill="#4A3B2C" stroke="none" fontWeight="bold">N</text>
                    <text x="0" y="39" textAnchor="middle" fontSize="8" fill="#4A3B2C" stroke="none">S</text>
                    <text x="-35" y="3" textAnchor="middle" fontSize="8" fill="#4A3B2C" stroke="none">O</text>
                    <text x="35" y="3" textAnchor="middle" fontSize="8" fill="#4A3B2C" stroke="none">E</text>
                  </g>

                  {/* Indications mers */}
                  <text x="155" y="102" fontSize="10" fontStyle="italic" fill="#7D6E5D" fontFamily="Georgia, serif">MANCHE</text>
                  <text x="45" y="355" fontSize="11" fontStyle="italic" fill="#7D6E5D" fontFamily="Georgia, serif">OCÉAN</text>
                  <text x="35" y="370" fontSize="11" fontStyle="italic" fill="#7D6E5D" fontFamily="Georgia, serif">ATLANTIQUE</text>
                  <text x="345" y="525" fontSize="10" fontStyle="italic" fill="#7D6E5D" fontFamily="Georgia, serif">MER MÉDITERRANÉE</text>

                  {/* CONTOUR GÉOGRAPHIQUE AUTHENTIQUE DE LA FRANCE MÉTROPOLITAINE */}
                  <path
                    d="M 248,48 L 272,54 L 292,78 L 332,96 L 375,112 L 418,128 L 448,145 L 442,195 L 432,235 L 408,258 L 414,295 L 402,318 L 426,342 L 432,378 L 422,412 L 446,442 L 435,472 L 395,485 L 358,478 L 328,482 L 315,508 L 265,505 L 215,492 L 148,475 L 128,455 L 138,395 L 148,342 L 132,302 L 112,268 L 95,245 L 55,222 L 48,195 L 92,182 L 128,185 L 142,165 L 132,128 L 155,132 L 172,148 L 208,142 L 235,108 L 238,72 Z"
                    fill="#F5EFE2"
                    stroke="#8C775E"
                    strokeWidth="2.2"
                  />

                  {/* Île de Beauté (Corse) */}
                  <path
                    d="M 465,472 L 478,488 L 480,522 L 468,548 L 455,535 L 454,498 Z"
                    fill="#F5EFE2"
                    stroke="#8C775E"
                    strokeWidth="1.8"
                  />

                  {/* Grands Fleuves Français */}
                  <g fill="none" stroke="#9AB0B8" strokeWidth="1.8" strokeLinecap="round">
                    {/* Seine */}
                    <path d="M 185,145 Q 235,162 255,172 Q 295,188 328,235" />
                    {/* Loire */}
                    <path d="M 118,248 Q 185,238 248,235 Q 298,242 315,328 Q 325,368 318,395" />
                    {/* Garonne & Dordogne */}
                    <path d="M 145,382 Q 185,418 228,458 Q 245,478 238,492" />
                    {/* Rhône & Saône */}
                    <path d="M 358,242 Q 348,305 348,355 Q 348,415 345,475" />
                  </g>

                  {/* Paris repère */}
                  <circle cx="255" cy="172" r="3" fill="#2B2118" />
                  <text x="262" y="175" fontSize="8" fontWeight="bold" fill="#2B2118">PARIS</text>

                  {/* TERROIRS VITICOLES & CIDRICOLES INTERACTIFS + MINI BOUTEILLES */}
                  {WINE_REGIONS_MAP.map((reg) => {
                    const regionBottles = wines.filter((w) => {
                      const norm = normalizeRegionId(w.region);
                      if (norm !== reg.id) return false;
                      if (mapFilterType === 'Tous') return true;
                      if (mapFilterType === 'Cidre') return getCategoryFromType(w.type) === 'Cidre';
                      if (mapFilterType === 'Alcool') return getCategoryFromType(w.type) === 'Alcool';
                      return w.type === mapFilterType;
                    });
                    const count = totalQuantity(regionBottles);
                    const isSelected = selectedMapRegion === reg.id;

                    return (
                      <g
                        key={reg.id}
                        onClick={() => setSelectedMapRegion(reg.id)}
                        className="cursor-pointer group"
                      >
                        <path
                          d={reg.path}
                          fill={reg.color}
                          fillOpacity={isSelected ? 0.95 : count > 0 ? 0.82 : 0.45}
                          stroke={isSelected ? '#1E140C' : '#5C4938'}
                          strokeWidth={isSelected ? '2.2' : '1'}
                        />

                        {/* Silhouette de bouteille debout sur la région (comme sur l'affiche Hachette) */}
                        <g transform={`translate(${reg.x - 5}, ${reg.y - 22})`}>
                          <path
                            d="M 3,0 L 7,0 L 7,5 L 10,9 L 10,22 L 0,22 L 0,9 L 3,5 Z"
                            fill={reg.bottleColor}
                            stroke="#FAF3E6"
                            strokeWidth="0.7"
                          />
                          <rect x="1.5" y="10" width="7" height="7" fill="#FAF3E6" />
                        </g>

                        {/* Nom de la région */}
                        <text
                          x={reg.x}
                          y={reg.y + 10}
                          textAnchor="middle"
                          fontSize="8.5"
                          fontWeight="900"
                          fill="#1E140C"
                          stroke="#EFE6D5"
                          strokeWidth="2.5"
                          paintOrder="stroke"
                        >
                          {reg.label}
                        </text>

                        {/* Pastille compteur de bouteilles */}
                        {count > 0 && (
                          <g transform={`translate(${reg.x + 16}, ${reg.y - 16})`}>
                            <circle cx="0" cy="0" r="8.5" fill="#9E1B24" stroke="#FFF" strokeWidth="1.2" />
                            <text x="0" y="3" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#FFF">
                              {count}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Encart droite : Géographie du verre à vin */}
                  <g transform="translate(458, 325)">
                    <text x="0" y="-12" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#2B2118">
                      VERRE À VIN
                    </text>
                    <path d="M -16,0 Q -18,26 0,30 Q 18,26 16,0 Z" fill="#D96B43" fillOpacity="0.35" stroke="#4A3B2C" strokeWidth="1.2" />
                    <line x1="0" y1="30" x2="0" y2="55" stroke="#4A3B2C" strokeWidth="1.4" />
                    <line x1="-12" y1="55" x2="12" y2="55" stroke="#4A3B2C" strokeWidth="1.4" />
                  </g>
                </svg>

                {/* Pied d'affiche : Nuancier Les Couleurs des Vins & Cidres */}
                <div className="mt-3 pt-3 border-t border-[#C8B89A]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#3D2E20] mb-1.5">
                    Les Couleurs des Vins, Cidres & Spiritueux
                  </div>
                  <div className="grid grid-cols-12 gap-1 h-3 rounded overflow-hidden">
                    {[
                      '#F4EFA6', '#ECD96F', '#DFB948', '#C89228',
                      '#F3C6B6', '#E59880', '#D16A58',
                      '#A82430', '#80141E', '#580E16',
                      '#B86B1E', '#6E380F'
                    ].map((c, idx) => (
                      <div key={idx} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Panneau latéral de détail de la région sélectionnée */}
              <div className="p-6 rounded-2xl bg-[#18110D] border border-amber-900/40 space-y-4">
                <h3 className="text-lg font-serif font-bold text-amber-200">
                  {selectedMapRegion ? `Terroir : ${selectedMapRegion}` : 'Sélectionnez une région sur la carte'}
                </h3>
                <p className="text-xs text-stone-400">
                  {selectedMapRegion
                    ? WINE_REGIONS_MAP.find((r) => r.id === selectedMapRegion)?.sub
                    : 'Cliquez sur n’importe quel vignoble ou terroir cidricole de l’affiche pour inspecter vos bouteilles.'}
                </p>

                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {(selectedMapRegion
                    ? wines.filter((w) => normalizeRegionId(w.region) === selectedMapRegion)
                    : wines
                  ).map((w) => (
                    <div
                      key={w.id}
                      onClick={() => setSelectedWine(w)}
                      className="p-3 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-amber-900/30 flex items-center justify-between cursor-pointer transition"
                    >
                      <div>
                        <div className="text-sm font-serif font-bold text-amber-100">{w.name}</div>
                        <div className="text-xs text-stone-400">
                          {w.appellation} • {w.vintage} • <span className="text-amber-400">{w.type}</span> · {getQuantity(w)} bouteille(s)
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-amber-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ONGLET 5 : CARNET DE DÉGUSTATION */}
        {activeTab === 'history' && (
          <div className="p-4 md:p-8 space-y-4">
            {history.map((h) => (
              <div key={h.id} className="p-5 rounded-2xl bg-[#18110D] border border-amber-900/30 flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-amber-400 font-semibold">Dégusté le {h.drunkDate}</span>
                  <h3 className="text-lg font-serif font-bold text-amber-100">
                    {h.name} ({h.vintage})
                  </h3>
                  <p className="text-xs text-stone-400">{h.appellation} • {h.region} • {h.type}</p>
                  <textarea aria-label={`Notes de dégustation de ${h.name}`} rows="2" value={h.tastingNotes || ''}
                    onChange={e => updateCellar(walls, wines, history.map(entry => entry.id === h.id ? { ...entry, tastingNotes: e.target.value } : entry))}
                    className="w-full p-2 mt-2 rounded-lg bg-stone-950 border border-stone-800 text-sm text-stone-200" placeholder="Vos impressions de dégustation..." />
                </div>
                <RatingInput value={h.userRating} label={`Note de dégustation de ${h.name}`}
                  onChange={value => updateCellar(walls, wines, history.map(entry => entry.id === h.id ? { ...entry, userRating: value } : entry))} />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* BARRE DE NAVIGATION FIXE EN BAS SUR TÉLÉPHONE */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#140D09]/95 border-t border-amber-800/40 flex items-center justify-around py-2.5 z-30 backdrop-blur-md">
        {[
          { id: 'cellar', label: 'Cave', icon: Grid },
          { id: 'apogee', label: 'Apogée', icon: AlertTriangle },
          { id: 'sommelier', label: 'Accords', icon: Utensils },
          { id: 'map', label: 'Carte', icon: MapIcon },
          { id: 'history', label: 'Carnet', icon: BookOpen }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 text-[11px] font-medium ${
                activeTab === item.id ? 'text-amber-400' : 'text-stone-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* =====================================================================
          VITRINE DÉTAILLÉE DE LA BOUTEILLE + STUDIO D'ÉTIQUETTE IA / WEB / SCAN
      ===================================================================== */}
      {selectedWine && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#18100C] border-2 border-amber-700/50 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-12 my-auto max-h-[92vh] overflow-y-auto">
            {/* COLONNE GAUCHE : VITRINE 3D & BOUTONS D'ÉTIQUETTE IA / WEB */}
            <div className="md:col-span-5 bg-gradient-to-b from-[#25160E] via-[#170D08] to-[#120A06] p-6 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-amber-900/40">
              {/* Boutons d'action Étiquette */}
              <div className="w-full space-y-2">
                <div className={`grid ${getCategoryFromType(selectedWine.type) === 'Vin' ? 'grid-cols-3' : 'grid-cols-1'} gap-1.5`}>
                  {getCategoryFromType(selectedWine.type) === 'Vin' && <><button
                    onClick={() => handleGenerateAILabel(selectedWine)}
                    disabled={isFetchingLabel}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-[11px] shadow transition"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Recréer avec Google IA</span>
                  </button>

                  <button
                    onClick={() => handleSearchWebLabels(selectedWine)}
                    disabled={isFetchingLabel}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-700/40 font-semibold text-[11px] transition"
                  >
                    <Globe className="w-4 h-4 text-amber-400" />
                    <span>Chercher une vraie photo</span>
                  </button></>}

                  <label className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-700/40 font-semibold text-[11px] cursor-pointer transition">
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span>📷 Photo étiquette</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleDirectLabelPhotoUpload(e, selectedWine)}
                      className="hidden"
                    />
                  </label>
                </div>

                {labelStatusMsg && (
                  <div role="status" className="text-[11px] text-amber-300 bg-amber-950/60 border border-amber-700/40 rounded-lg px-2.5 py-1.5 text-center">
                    {labelStatusMsg}
                  </div>
                )}

                {webSearchGrounding?.searchEntryPoint?.renderedContent && <iframe title="Suggestions Google Search" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={webSearchGrounding.searchEntryPoint.renderedContent} className="w-full h-28 border-0 rounded-xl bg-white" />}
                {/* Miniatures trouvées sur le Web */}
                {webSearchCandidates.length > 0 && (
                  <div className="p-2 rounded-xl bg-stone-950/80 border border-amber-900/40 space-y-1.5">
                    <div className="text-[10px] text-stone-400 font-semibold">Photos trouvées (cliquez pour appliquer) :</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {webSearchCandidates.map((cand, i) => (
                        <div key={i} className="space-y-1">
                          <a href={cand.source} target="_blank" rel="noreferrer" aria-label={`Voir la source de ${cand.title}`} className="block w-full h-24 rounded-lg overflow-hidden border border-amber-700/40 hover:border-amber-400 bg-stone-900">
                            <img src={cand.url} alt={cand.title} onError={e => { if (!e.currentTarget.dataset.proxy) { e.currentTarget.dataset.proxy = '1'; e.currentTarget.src = `https://wsrv.nl/?url=${encodeURIComponent(cand.url)}&w=160&fit=inside`; } }} className="w-full h-full object-contain" />
                          </a>
                          <a href={cand.source} target="_blank" rel="noreferrer" className="block text-[10px] text-amber-300 underline truncate">{cand.title} — Source</a>
                          <p className="text-[10px] text-stone-400">{cand.vintageStatus}</p>
                          {cand.note && <p className="text-[10px] text-amber-200">{cand.note}</p>}
                          <button disabled={isFetchingLabel} aria-label={`Vérifier et recadrer ${cand.title}`} onClick={() => handleApplyExternalImageUrl(cand.url, cand.source, cand.useWholeBottle)} className="w-full p-1.5 rounded-lg bg-amber-900/60 text-amber-200 text-[10px]">Vérifier et recadrer</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Grande Bouteille 3D */}
              <div className="my-4">
                <RealisticBottleSVG wine={selectedWine} size="showcase" />
              </div>

              {/* Champ pour coller n'importe quelle adresse d'image Web */}
              <div className="w-full space-y-2 pt-2 border-t border-amber-900/30">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-stone-400">Ou coller l’adresse d’une photo :</span>
                  <a
                    href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(selectedWine.name + ' ' + selectedWine.appellation + ' bouteille étiquette')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    Voir Google Images <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={customImageUrlInput}
                    onChange={(e) => setCustomImageUrlInput(e.target.value)}
                    placeholder="Coller le lien d’une image (https://...)"
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-stone-950 border border-amber-900/50 text-xs text-stone-200"
                  />
                  <button
                    onClick={() => handleApplyExternalImageUrl(customImageUrlInput)}
                    className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold"
                  >
                    Vérifier
                  </button>
                </div>
              </div>
            </div>

            {/* COLONNE DROITE : INFORMATIONS DÉTAILLÉES DE LA BOUTEILLE */}
            <div className="md:col-span-7 p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      {getCategoryFromType(selectedWine.type)} • {selectedWine.type} • {selectedWine.region}
                    </span>
                    <h3 className="text-2xl font-serif font-bold text-amber-100 mt-0.5">
                      {selectedWine.name} ({selectedWine.vintage || 'Sans millésime'})
                    </h3>
                    <p className="text-sm text-stone-400">{selectedWine.appellation}</p>
                  </div>
                  <button
                    aria-label="Fermer la bouteille"
                    onClick={() => setSelectedWine(null)}
                    className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Apogée & Note Web cliquable */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${getApogeeInfo(selectedWine).badgeClass}`}>
                    {getApogeeInfo(selectedWine).label}
                  </span>
                  <a
                    href={selectedWine.webUrl || `https://www.vivino.com/search/wines?q=${encodeURIComponent(selectedWine.name)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-amber-950/70 border border-amber-600/40 text-amber-300 hover:bg-amber-900/60"
                  >
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{selectedWine.webRating == null ? 'Consulter les avis Web' : `Note Web : ${selectedWine.webRating}/5 (Voir avis)`}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-stone-900/70 border border-amber-900/30 text-xs">
                  <div>
                    <span className="text-stone-400 block">Cépages / Élaboration :</span>
                    <strong className="text-stone-200">{selectedWine.grapes || 'Traditionnel'}</strong>
                  </div>
                  <div>
                    <span className="text-stone-400 block">Emplacement en cave :</span>
                    <strong className="text-amber-300">
                      {walls.find((w) => w.id === selectedWine.wallId)?.name} (R{selectedWine.row} • C{selectedWine.col})
                    </strong>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-stone-900/70 border border-amber-900/40 space-y-2">
                  <QuantityControl value={getQuantity(selectedWine)} onChange={quantity => patchWine(selectedWine.id, { quantity })} />
                  <p className="text-[11px] text-stone-400">Ajustez le stock ici. « Boire une bouteille » retire une unité et l’ajoute au carnet. À zéro, la fiche reste disponible pour un réapprovisionnement.</p>
                  {getQuantity(selectedWine) === 0 && <button type="button" onClick={() => handleRemoveEmptyReference(selectedWine)} className="text-xs text-stone-400 underline hover:text-amber-200">Retirer la fiche épuisée du casier</button>}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-stone-900/50 border border-stone-800">
                    <span className="text-amber-400 font-semibold block mb-0.5">Conseil de service & dégustation :</span>
                    <p className="text-stone-300">{selectedWine.tastingAdvice}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-900/50 border border-stone-800">
                    <span className="text-amber-400 font-semibold block mb-1">Accords recommandés :</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(Array.isArray(selectedWine.foodPairing) ? selectedWine.foodPairing : [selectedWine.foodPairing]).map((fp, i) => (
                        <span key={i} className="px-2.5 py-0.5 rounded-lg bg-amber-950/70 border border-amber-800/40 text-amber-200">
                          {fp}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-900/50 border border-stone-800">
                    <span className="text-amber-400 font-semibold block mb-2">Mes notes personnelles :</span>
                    <RatingInput value={selectedWine.userRating} onChange={value => patchWine(selectedWine.id, { userRating: value })} />
                    <textarea
                      rows="2"
                      value={selectedWine.userNotes || ''}
                      onChange={(e) => {
                        patchWine(selectedWine.id, { userNotes: e.target.value });
                      }}
                      placeholder="Ajouter vos impressions de dégustation..."
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2 text-stone-200 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Actions du bas */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-amber-900/30">
                <button
                  onClick={() => {
                    setMovingWine(selectedWine);
                    setSelectedWine(null);
                    setActiveTab('cellar');
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold"
                >
                  <Move className="w-4 h-4" />
                  Déplacer de casier
                </button>
                <button
                  disabled={getQuantity(selectedWine) === 0}
                  onClick={() => handleDrinkBottle(selectedWine)}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-800 to-amber-700 hover:from-red-700 hover:to-amber-600 text-white text-xs font-bold shadow-lg"
                >
                  <Wine className="w-4 h-4" />
                  Boire une bouteille (Retirer 1 et archiver)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODALE D'AJOUT DE BOUTEILLE (VIN, CIDRE & SPIRITUEUX / AUTRE ALCOOL)
      ===================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#18100C] border-2 border-amber-700/50 rounded-3xl max-w-xl w-full p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-serif font-bold text-amber-100">
                Ajouter un Vin, Cidre ou Spiritueux
              </h3>
              <button aria-label="Fermer l’ajout" onClick={() => setShowAddModal(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddWineSubmit} className="space-y-4 text-xs">
              {newWine.customLabelUrl && <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-900"><img src={newWine.customLabelUrl} alt="Photo à vérifier" className="w-16 h-20 object-contain" /><p className="text-stone-400">Vérifiez les informations lues sur l’étiquette. Les dates de garde proposées restent à adapter à votre bouteille.</p></div>}
              {/* Sélecteur de Catégorie : Vin / Cidre / Spiritueux */}
              <div>
                <label className="text-amber-300 font-semibold block mb-1.5">Catégorie de bouteille :</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(DRINK_CATEGORIES).map(([catKey, catInfo]) => (
                    <button
                      type="button"
                      key={catKey}
                      onClick={() =>
                        setNewWine((prev) => ({
                          ...prev,
                          category: catKey,
                          type: catInfo.types[0],
                          bottleShape: catInfo.defaultShape,
                          region: catKey === 'Cidre' ? 'Normandie' : prev.region
                        }))
                      }
                      className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition ${
                        newWine.category === catKey
                          ? 'bg-amber-600 text-stone-950 border-amber-400 shadow'
                          : 'bg-stone-900 text-stone-300 border-amber-900/40'
                      }`}
                    >
                      <span>{catInfo.icon}</span>
                      <span>{catInfo.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-stone-400 block mb-1">Nom du Domaine / Cuvée / Marque *</label>
                  <input
                    required
                    type="text"
                    aria-label="Nom du domaine"
                    value={newWine.name}
                    onChange={(e) => setNewWine({ ...newWine, name: e.target.value })}
                    placeholder={
                      newWine.category === 'Cidre'
                        ? 'Ex: Manoir d’Apreval Cuvée Réserve'
                        : newWine.category === 'Alcool'
                        ? 'Ex: Calvados Père Magloire XO'
                        : 'Ex: Château Talbot'
                    }
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-900/50 text-stone-100"
                  />
                </div>
                <div>
                  <label className="text-stone-400 block mb-1">Appellation / Mention</label>
                  <input
                    type="text"
                    aria-label="Appellation"
                    value={newWine.appellation}
                    onChange={(e) => setNewWine({ ...newWine, appellation: e.target.value })}
                    placeholder={
                      newWine.category === 'Cidre'
                        ? 'Ex: Cidre Pays d’Auge AOP'
                        : newWine.category === 'Alcool'
                        ? 'Ex: Calvados Pays d’Auge Hors d’Âge'
                        : 'Ex: Saint-Julien 4e Grand Cru Classé'
                    }
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-900/50 text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-stone-400 block mb-1">Type précis</label>
                  <select
                    aria-label="Type précis"
                    value={newWine.type}
                    onChange={(e) => setNewWine({ ...newWine, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-900/50 text-stone-100"
                  >
                    {(DRINK_CATEGORIES[newWine.category]?.types || DRINK_CATEGORIES.Vin.types).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-stone-400 block mb-1">Région</label>
                  <select
                    aria-label="Région"
                    value={newWine.region}
                    onChange={(e) => setNewWine({ ...newWine, region: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-900/50 text-stone-100"
                  >
                    <option value="">À préciser</option>
                    {newWine.region && !WINE_REGIONS_MAP.some(r => r.id === newWine.region) && <option value={newWine.region}>{newWine.region}</option>}
                    {WINE_REGIONS_MAP.map((r) => (
                      <option key={r.id} value={r.id}>{r.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-stone-400 block mb-1">Millésime / Année</label>
                  <input
                    type="number"
                    aria-label="Millésime"
                    value={newWine.vintage}
                    onChange={(e) => setNewWine({ ...newWine, vintage: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-900/50 text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-stone-400 block mb-1">Cépages / Variétés / Élaboration</label>
                  <input
                    type="text"
                    aria-label="Cépages ou variétés"
                    value={newWine.grapes}
                    onChange={(e) => setNewWine({ ...newWine, grapes: e.target.value })}
                    placeholder={
                      newWine.category === 'Cidre'
                        ? 'Ex: Pommes douces-amères du verger'
                        : newWine.category === 'Alcool'
                        ? 'Ex: Vieilli 12 ans en fût de chêne'
                        : 'Ex: Syrah, Grenache'
                    }
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-900/50 text-stone-100"
                  />
                </div>
                <div>
                  <label className="text-stone-400 block mb-1">Forme du flacon</label>
                  <select
                    aria-label="Forme du flacon"
                    value={newWine.bottleShape}
                    onChange={(e) => setNewWine({ ...newWine, bottleShape: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-900/50 text-stone-100"
                  >
                    <option value="bordeaux">Bordelaise (Épaules hautes)</option>
                    <option value="burgundy">Bourguignonne / Rhône</option>
                    <option value="champagne">Champenoise</option>
                    <option value="cider">Cidre bouché / Poiré (Bouchon et muselet)</option>
                    <option value="flute">Flûte (Alsace / Provence)</option>
                    <option value="spirit">Carafe Spiritueux / Calvados / Whisky</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-stone-400 block mb-1">Début Apogée</label>
                  <input
                    type="number"
                    value={newWine.peakStart}
                    onChange={(e) => setNewWine({ ...newWine, peakStart: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-900/50 text-stone-100"
                  />
                </div>
                <div>
                  <label className="text-stone-400 block mb-1">Fin Apogée</label>
                  <input
                    type="number"
                    value={newWine.peakEnd}
                    onChange={(e) => setNewWine({ ...newWine, peakEnd: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-900/50 text-stone-100"
                  />
                </div>
                <div>
                  <label className="text-stone-400 block mb-1">Limite Buvabilité</label>
                  <input
                    type="number"
                    value={newWine.drinkLimit}
                    onChange={(e) => setNewWine({ ...newWine, drinkLimit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-900/50 text-stone-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-stone-400 block mb-1">Accords recommandés (séparés par une virgule)</label>
                <input
                  type="text"
                  value={newWine.foodPairing}
                  onChange={(e) => setNewWine({ ...newWine, foodPairing: e.target.value })}
                  placeholder="Ex: Volaille rôtie, Camembert au lait cru, Tarte Tatin"
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-900/50 text-stone-100"
                />
              </div>

              <QuantityControl label="Nombre de bouteilles à ajouter" value={newWine.quantity} minimum={1} onChange={quantity => setNewWine(prev => ({ ...prev, quantity }))} />
              <RatingInput value={newWine.userRating} onChange={value => setNewWine({ ...newWine, userRating: value })} />
              {addError && <p role="alert" className="text-amber-200">{addError}</p>}
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm shadow-lg"
              >
                Déposer la bouteille dans la cave
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODALE SCANNER APPAREIL PHOTO */}
      {showScannerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18100C] border-2 border-amber-700/50 rounded-3xl max-w-md w-full p-6 space-y-4 text-center">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-serif font-bold text-amber-100">Scanner une bouteille (Vin, Cidre, Alcool)</h3>
              <button aria-label="Fermer le scanner" disabled={isScanning} onClick={() => setShowScannerModal(false)} className="text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-stone-400">
              Photographiez l’étiquette de près, sans reflet. Google IA lit les informations visibles et pré-remplit la fiche, que vous pourrez vérifier avant l’ajout.
            </p>
            <label className="block p-8 rounded-2xl border-2 border-dashed border-amber-600/60 bg-stone-950/70 hover:bg-stone-900 cursor-pointer transition">
              <Camera className="w-10 h-10 text-amber-400 mx-auto mb-2" />
              <span className="text-sm font-bold text-amber-200 block">
                {isScanning ? 'Analyse IA en cours...' : 'Ouvrir l’appareil photo / Choisir une photo'}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleScannerFileChange}
                disabled={isScanning}
                aria-label="Photo à analyser"
                className="hidden"
              />
            </label>
            {scanPreview && <img src={scanPreview} alt="Étiquette photographiée" className="max-h-40 mx-auto rounded-xl" />}
            {scanError && <p role="alert" className="text-sm text-amber-200">{scanError}</p>}
            {!aiAvailable && <button onClick={() => { setCloudTab('ai'); setShowCloudModal(true); }} className="text-amber-400 underline text-xs">Configurer Google IA</button>}
            {scanPreview && !isScanning && <button onClick={() => {
              setNewWine({ ...emptyWine(), customLabelUrl: scanPreview });
              setAddError(''); setShowScannerModal(false); setShowAddModal(true);
            }} className="text-xs text-amber-300 underline">Garder cette photo et remplir la fiche manuellement</button>}
          </div>
        </div>
      )}

      {/* MODALE CONFIGURATION DES MURS */}
      {showWallConfig && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18100C] border-2 border-amber-700/50 rounded-3xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-serif font-bold text-amber-100">Configurer les murs et casiers</h3>
              <button aria-label="Fermer la configuration" onClick={() => setShowWallConfig(false)} className="text-stone-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {walls.map(w => <div key={w.id} className="p-3 rounded-xl bg-stone-900 border border-amber-900/30 grid grid-cols-2 gap-3 text-xs">
                <label className="col-span-2 text-stone-400">Nom du mur
                  <input aria-label={`Nom du mur ${w.name}`} value={w.name} onChange={e => configureWall(w.id, 'name', e.target.value)} className="block w-full mt-1 px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-amber-100 font-bold" />
                </label>
                <label className="text-stone-400">Étagères (Lignes)
                  <input aria-label={`Lignes de ${w.name}`} type="number" min="1" max="12" value={w.rows} onChange={e => configureWall(w.id, 'rows', e.target.value)} className="block w-full mt-1 px-2 py-1 rounded bg-stone-950 border border-stone-700" />
                </label>
                <label className="text-stone-400">Colonnes
                  <input aria-label={`Colonnes de ${w.name}`} type="number" min="1" max="12" value={w.cols} onChange={e => configureWall(w.id, 'cols', e.target.value)} className="block w-full mt-1 px-2 py-1 rounded bg-stone-950 border border-stone-700" />
                </label>
                <span className="text-stone-400">{wines.filter(b => b.wallId === w.id).length} référence(s) / {w.rows * w.cols} places · {totalQuantity(wines.filter(b => b.wallId === w.id))} bouteille(s)</span>
                <button disabled={walls.length <= 1} onClick={() => { setDeletingWallId(w.id); setDestinationWallId(walls.find(other => other.id !== w.id)?.id || ''); setWallError(''); }} className="text-red-300 text-right disabled:opacity-40">Supprimer {w.name}</button>
              </div>)}
            </div>
            {deletingWallId && <div className="p-3 rounded-xl border border-red-900 space-y-3 text-sm">
              <p>Supprimer « {walls.find(w => w.id === deletingWallId)?.name} » ? Les {wines.filter(w => w.wallId === deletingWallId).length} référence(s), soit {totalQuantity(wines.filter(w => w.wallId === deletingWallId))} bouteille(s), seront transférées vers les places libres du mur choisi.</p>
              <label className="block text-xs text-stone-400">Transférer les bouteilles vers
                <select aria-label="Mur de destination" value={destinationWallId} onChange={e => setDestinationWallId(e.target.value)} className="block w-full mt-1 bg-stone-950 p-2 rounded-lg">
                  {walls.filter(w => w.id !== deletingWallId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
              <div className="flex gap-3"><button onClick={confirmRemoveWall} className="px-3 py-2 rounded-lg bg-red-900 text-white">Confirmer la suppression</button><button onClick={() => { setDeletingWallId(null); setWallError(''); }}>Annuler</button></div>
            </div>}
            {wallError && <p role="alert" className="text-amber-200 text-xs">{wallError}</p>}
            <button onClick={() => {
              const wall = { id: `mur-${crypto.randomUUID()}`, name: `Nouveau mur ${walls.length + 1}`, rows: 4, cols: 5 };
              updateCellar([...walls, wall], wines, history); setSelectedWallId(wall.id); setWallError('');
            }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-stone-950 font-bold text-sm"><Plus className="w-4 h-4" />Ajouter un mur</button>
            {walls.length === 1 && <p className="text-xs text-stone-400">La cave doit conserver au moins un mur.</p>}
          </div>
        </div>
      )}

      {labelDraft && selectedWine?.id === labelDraft.wineId && <LabelCropEditor key={`${labelDraft.wineId}-${labelDraft.dataUrl.slice(-20)}`} draft={labelDraft} onClose={() => setLabelDraft(null)} onApply={({ dataUrl, wholeBottle }) => {
        patchWine(labelDraft.wineId, wholeBottle ? { customBottleUrl: dataUrl } : { customLabelUrl: dataUrl, customBottleUrl: null });
        setLabelDraft(null); setCustomImageUrlInput(''); setLabelStatusMsg('Photo réelle enregistrée sur votre bouteille.');
      }} />}

      {/* MODALE COMPTES, GOOGLE DRIVE KAVA 20 & CLÉ GEMINI IA */}
      {showCloudModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18100C] border-2 border-amber-700/50 rounded-3xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-serif font-bold text-amber-100">Comptes Familiaux, Drive Kava 20 & Clé IA</h3>
              <button aria-label="Fermer les paramètres" onClick={() => setShowCloudModal(false)} className="text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 border-b border-amber-900/30 pb-2 text-xs">
              <button
                onClick={() => setCloudTab('accounts')}
                className={`px-3 py-1.5 rounded-lg font-bold ${cloudTab === 'accounts' ? 'bg-amber-600 text-stone-950' : 'bg-stone-900 text-stone-400'}`}
              >
                1. Caves Familiales
              </button>
              <button
                onClick={() => setCloudTab('drive')}
                className={`px-3 py-1.5 rounded-lg font-bold ${cloudTab === 'drive' ? 'bg-amber-600 text-stone-950' : 'bg-stone-900 text-stone-400'}`}
              >
                2. Google Drive Kava 20
              </button>
              <button
                onClick={() => setCloudTab('ai')}
                className={`px-3 py-1.5 rounded-lg font-bold ${cloudTab === 'ai' ? 'bg-amber-600 text-stone-950' : 'bg-stone-900 text-stone-400'}`}
              >
                3. Google IA
              </button>
            </div>

            {cloudTab === 'accounts' && (
              <div className="space-y-3 text-xs">
                <p className="text-stone-400">Créez autant de caves que nécessaire et passez de l’une à l’autre. Pour transmettre une cave à quelqu’un, exportez sa sauvegarde puis importez ce fichier sur son appareil. Chaque copie évolue indépendamment.</p>
                <form onSubmit={handleCreateCellar} className="p-3 rounded-xl bg-stone-900 border border-amber-900/40 space-y-3">
                  <h4 className="font-bold text-amber-200">Ajouter une cave</h4>
                  <label className="block text-stone-400">Nom de la cave
                    <input aria-label="Nom de la nouvelle cave" required maxLength="80" value={newCellarName} onChange={e => setNewCellarName(e.target.value)} placeholder="Ex. Cave de Marie, Maison de campagne…" className="block w-full mt-1 p-2 rounded-lg bg-stone-950 border border-stone-700 text-stone-100" />
                  </label>
                  <label className="block text-stone-400">Propriétaire ou groupe (facultatif)
                    <input aria-label="Propriétaire de la nouvelle cave" maxLength="80" value={newCellarOwner} onChange={e => setNewCellarOwner(e.target.value)} placeholder="Ex. Marie, Famille…" className="block w-full mt-1 p-2 rounded-lg bg-stone-950 border border-stone-700 text-stone-100" />
                  </label>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-amber-600 text-stone-950 font-bold">Créer la cave</button>
                </form>
                {accountError && <p role="alert" className="text-red-300">{accountError}</p>}
                {accountMessage && <p role="status" className="text-emerald-300">{accountMessage}</p>}
                <div className="grid grid-cols-2 gap-2">
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => setAccountId(acc.id)}
                      className={`p-3 rounded-xl border text-left ${
                        accountId === acc.id
                          ? 'bg-amber-950/60 border-amber-500 text-amber-100'
                          : 'bg-stone-900 border-stone-800 text-stone-300'
                      }`}
                    >
                      <div className="font-bold">{acc.name}</div>
                      <div className="text-[10px] text-amber-400">{acc.owner || 'Cave personnelle'}</div>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify({ format: 'le-grand-chai', version: 1, name: accounts.find(a => a.id === accountId)?.name || 'Ma cave', owner: accounts.find(a => a.id === accountId)?.owner || '', cellar: { walls, wines, history } }, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Kava20_${accountId}.json`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-200 font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> Télécharger sauvegarde (.json)
                  </button>
                  <label className="flex-1 p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-200 text-center font-semibold cursor-pointer">
                    Importer une cave (.json)
                    <input type="file" accept=".json,application/json" aria-label="Importer une cave" onChange={handleImportCellar} className="hidden" />
                  </label>
                </div>
              </div>
            )}

            {cloudTab === 'drive' && (
              <div className="space-y-3 text-xs">
                <label className="text-stone-300 font-semibold block">URL du script Google Drive (Dossier Kava 20) :</label>
                <input
                  type="text"
                  value={driveWebhookUrl}
                  onChange={(e) => {
                    setDriveWebhookUrl(e.target.value);
                    localStorage.setItem('lgc_drive_webhook_kava20', e.target.value);
                  }}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-800/50 text-stone-100"
                />
                <button
                  onClick={() => saveCellarData(walls, wines, history)}
                  className="w-full py-2.5 rounded-xl bg-amber-600 text-stone-950 font-bold"
                >
                  Forcer la synchronisation vers Kava 20 maintenant
                </button>
              </div>
            )}

            {cloudTab === 'ai' && (
              <div className="space-y-3 text-xs">
                {AI_PROXY_URL ? (
                  <div className="space-y-3 rounded-xl border border-amber-800/50 p-3">
                    <p className="font-semibold text-amber-300">IA configurée pour tous vos appareils</p>
                    <p className="text-stone-400">La clé Google est conservée côté serveur, dans le compte Google du propriétaire. Le scanner, le sommelier et la recherche d’étiquettes sont prêts à être utilisés, sans recopier de clé sur le téléphone.</p>
                    <button onClick={verifyAIService} disabled={checkingAIService} className="px-3 py-2 rounded-xl bg-amber-600 text-stone-950 font-bold disabled:opacity-50">Vérifier la connexion IA</button>
                    {aiServiceStatus && <p role="status">{aiServiceStatus}</p>}
                    <p className="text-stone-500">La clé peut être remplacée par le propriétaire dans les paramètres du service Google. Les sauvegardes Drive restent configurées séparément.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-stone-400">La lecture des photos, le sommelier et les étiquettes utilisent votre clé Google AI Studio, conservée dans ce navigateur.</p>
                    <input
                      type="password"
                      aria-label="Clé Google AI Studio"
                      autoComplete="off"
                      value={userGeminiKey}
                      onChange={(e) => {
                        setUserGeminiKey(e.target.value);
                        localStorage.setItem('lgc_gemini_api_key', e.target.value);
                      }}
                      placeholder="AIzaSy..."
                      className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-800/50 text-stone-100"
                    />
                  </>
                )}
                <label className="block text-stone-400">Modèle Gemini
                  <select aria-label="Modèle Gemini" value={geminiModel} onChange={e => { setGeminiModel(e.target.value); localStorage.setItem('lgc_gemini_model', e.target.value); }} className="block w-full mt-1 bg-stone-950 p-2 rounded-xl border border-amber-800/50 text-stone-100">
                    <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
                    <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (anciens projets)</option>
                  </select>
                </label>
                {!AI_PROXY_URL && <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-amber-400 underline">Ouvrir Google AI Studio</a>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
