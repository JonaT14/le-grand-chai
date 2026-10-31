import React, { useState, useEffect, useMemo } from 'react';
import {
  Wine, Grid, AlertTriangle, Map as MapIcon, BookOpen, Sparkles,
  Plus, Camera, X, Search, Sliders, ExternalLink, Star,
  Move, Cloud, Download, Upload, Users,
  ChevronRight, Utensils, Copy, Check, Key, Globe, RefreshCw
} from 'lucide-react';

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
    defaultShape: 'champagne'
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

// ============================================================================
// CONVERTISSEUR D'IMAGE WEB / IA SANS BLOCAGE CORS (PROXY WSRV.NL -> BASE64)
// ============================================================================
async function fetchImageAsLabelDataUrl(imageUrl, wine) {
  const proxiedUrl = imageUrl.startsWith('data:')
    ? imageUrl
    : `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&w=420&h=580&fit=cover&output=jpg&q=85`;

  const response = await fetch(proxiedUrl);
  if (!response.ok) throw new Error('Image inaccessible');
  const blob = await response.blob();

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

  const scale = Math.max(400 / img.width, 560 / img.height);
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
  const shape = wine.bottleShape || DRINK_CATEGORIES[category].defaultShape;

  // Couleurs réalistes du verre et du liquide selon le type
  const palette = useMemo(() => {
    const t = (wine.type || '').toLowerCase();
    if (category === 'Cidre') {
      return {
        glassTop: '#243B1B',
        glassMid: '#375828',
        glassBot: '#182811',
        liquid: '#D9821E',
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
  const clipId = `bottle-clip-${wine.id}-${size}`;
  const labelClipId = `label-clip-${wine.id}-${size}`;
  const gradId = `bottle-grad-${wine.id}-${size}`;
  const lb = currentShape.labelBox;

  // Ignore l'ancienne image PNG 520x720 cassée si présente
  const hasValidCustomLabel = wine.customLabelUrl &&
    !wine.customLabelUrl.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAggAAALQ');

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
        <rect x="36" y="16" width="28" height="4" fill="rgba(255,255,255,0.22)" />

        {/* Collerette millésime */}
        <path d="M 33,68 Q 50,74 67,68 L 69,80 Q 50,86 31,80 Z" fill="#F5ECD7" stroke="#B69146" strokeWidth="0.8" />
        <text x="50" y="77" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#2A1B12" fontFamily="Georgia, serif">
          {wine.vintage}
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
              preserveAspectRatio="none"
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
              {category === 'Cidre' ? 'CIDRE DE TERROIR' : category === 'Alcool' ? 'SPIRITUEUX D’EXCEPTION' : `GRAND VIN DE ${(wine.region || 'FRANCE').toUpperCase()}`}
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
  const [accounts, setAccounts] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('lgc_accounts_list'));
      return saved && saved.length ? saved : [
        { id: 'MA-CAVE-PRINCIPALE', name: 'Ma Cave Principale', owner: 'Propriétaire', pin: '' },
        { id: 'CAVE-DE-PAPA', name: 'Cave de Papa', owner: 'Papa', pin: '' }
      ];
    } catch {
      return [
        { id: 'MA-CAVE-PRINCIPALE', name: 'Ma Cave Principale', owner: 'Propriétaire', pin: '' },
        { id: 'CAVE-DE-PAPA', name: 'Cave de Papa', owner: 'Papa', pin: '' }
      ];
    }
  });

  const [walls, setWalls] = useState(DEFAULT_WALLS);
  const [wines, setWines] = useState(DEFAULT_WINES);
  const [history, setHistory] = useState(DEFAULT_HISTORY);
  const [selectedWallId, setSelectedWallId] = useState('mur-gauche');
  const [selectedWine, setSelectedWine] = useState(null);
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
  const [driveWebhookUrl, setDriveWebhookUrl] = useState(() => localStorage.getItem('lgc_drive_webhook_kava20') || '');
  const [userGeminiKey, setUserGeminiKey] = useState(() => localStorage.getItem('lgc_gemini_api_key') || '');
  const [syncStatus, setSyncStatus] = useState('Prêt');

  // États du Studio d'Étiquette IA / Web
  const [isFetchingLabel, setIsFetchingLabel] = useState(false);
  const [labelStatusMsg, setLabelStatusMsg] = useState('');
  const [customImageUrlInput, setCustomImageUrlInput] = useState('');
  const [webSearchCandidates, setWebSearchCandidates] = useState([]);

  // États du Scanner IA
  const [isScanning, setIsScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState(null);

  // États du Sommelier IA
  const [dishInput, setDishInput] = useState('');
  const [sommelierResult, setSommelierResult] = useState(null);
  const [isAskingSommelier, setIsAskingSommelier] = useState(false);

  // États Carte de France
  const [selectedMapRegion, setSelectedMapRegion] = useState(null);
  const [mapFilterType, setMapFilterType] = useState('Tous');

  // Formulaire nouvelle bouteille (Vin, Cidre ou Alcool)
  const [newWine, setNewWine] = useState({
    category: 'Vin',
    name: '',
    appellation: '',
    region: 'Bordeaux',
    vintage: CURRENT_YEAR - 3,
    type: 'Rouge',
    bottleShape: 'bordeaux',
    grapes: '',
    peakStart: CURRENT_YEAR,
    peakEnd: CURRENT_YEAR + 8,
    drinkLimit: CURRENT_YEAR + 12,
    webRating: 4.3,
    webReviewCount: 850,
    webUrl: '',
    userRating: 4.5,
    userNotes: '',
    tastingAdvice: 'Servir à température de cave.',
    foodPairing: '',
    customLabelUrl: null
  });

  // Chargement des données du compte actif (+ nettoyage auto d'une éventuelle ancienne étiquette PNG cassée)
  useEffect(() => {
    localStorage.setItem('lgc_active_account', accountId);
    const key = `lgc_cellar_data_${accountId}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.walls) setWalls(parsed.walls);
        if (parsed.wines) {
          const cleanedWines = parsed.wines.map((w) => {
            if (w.customLabelUrl && w.customLabelUrl.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAggAAALQ')) {
              return { ...w, customLabelUrl: null };
            }
            return w;
          });
          setWines(cleanedWines);
        }
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
    localStorage.setItem(`lgc_cellar_data_${accountId}`, JSON.stringify(payload));

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
    setWalls(nextWalls);
    setWines(nextWines);
    setHistory(nextHistory);
    saveCellarData(nextWalls, nextWines, nextHistory);
  };

  // Statut d'apogée (adapté aux spiritueux)
  const getApogeeInfo = (wine) => {
    const cat = getCategoryFromType(wine.type);
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
  // 1. GÉNÉRATION D'ÉTIQUETTE PAR IA (AVEC ILLUSTRATION IA + GRAVURE HAUTE DÉFINITION)
  // ============================================================================
  const handleGenerateAILabel = async (wine) => {
    if (!wine) return;
    setIsFetchingLabel(true);
    setLabelStatusMsg('Création de l’étiquette par l’IA en cours...');

    try {
      let styleInfo = {};
      const activeKey = userGeminiKey.trim();

      // Si une clé Gemini est configurée, on récupère les détails historiques exacts de l'étiquette
      if (activeKey) {
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${activeKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [{
                    text: `Décris les couleurs officielles de l'étiquette de la bouteille "${wine.name}" (${wine.appellation}, ${wine.region}, ${wine.type}). Réponds uniquement en JSON strict : {"bg":"#FCF8F0","border":"#9A7B3E","subText":"#7A5828","sealColor":"#7A1621","motto":"GRAND VIN DE BORDEAUX","footer":"MIS EN BOUTEILLE AU CHÂTEAU","visualPrompt":"classic French vineyard chateau engraving"}`
                  }]
                }]
              })
            }
          );
          const data = await resp.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) styleInfo = JSON.parse(jsonMatch[0]);
        } catch (err) {
          console.warn('Fallback style local:', err);
        }
      }

      // Génération d'une illustration IA du domaine (via Pollinations Flux + proxy CORS wsrv.nl)
      let aiArtworkImg = null;
      try {
        const category = getCategoryFromType(wine.type);
        const promptText = styleInfo.visualPrompt || (
          category === 'Cidre'
            ? `vintage French engraving of Normandy apple orchard half-timbered manor ${wine.name}, warm sepia gold ink`
            : category === 'Alcool'
            ? `vintage French copper alembic distillery oak barrel crest ${wine.name} ${wine.region}, gold sepia engraving`
            : `vintage French wine label illustration of Chateau ${wine.name} ${wine.appellation} ${wine.region} vineyard estate, fine sepia engraving`
        );
        const seed = Math.floor(Math.random() * 99999);
        const rawAiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=480&height=300&nologo=true&seed=${seed}`;
        const proxiedAiUrl = `https://wsrv.nl/?url=${encodeURIComponent(rawAiUrl)}&w=360&h=220&fit=cover&output=jpg`;

        const imgResp = await fetch(proxiedAiUrl);
        if (imgResp.ok) {
          const blob = await imgResp.blob();
          const base64Art = await new Promise((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result);
            reader.readAsDataURL(blob);
          });
          aiArtworkImg = await new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = rej;
            img.src = base64Art;
          });
        }
      } catch (artErr) {
        console.warn('Utilisation de la gravure vectorielle de haute précision :', artErr);
      }

      const dataUrl = await generateAILabelDataUrl(wine, styleInfo, aiArtworkImg);
      const updatedWines = wines.map((w) => (w.id === wine.id ? { ...w, customLabelUrl: dataUrl } : w));
      const updatedSelected = { ...wine, customLabelUrl: dataUrl };

      setSelectedWine(updatedSelected);
      updateCellar(walls, updatedWines, history);
      setLabelStatusMsg('✨ Étiquette IA générée et enregistrée sur la bouteille !');
    } catch (error) {
      console.error(error);
      setLabelStatusMsg('Erreur lors de la génération.');
    } finally {
      setIsFetchingLabel(false);
    }
  };

  // ============================================================================
  // 2. RECHERCHE AUTOMATIQUE DE VRAIES PHOTOS D'ÉTIQUETTES SUR LE WEB
  // ============================================================================
  const handleSearchWebLabels = async (wine) => {
    if (!wine) return;
    setIsFetchingLabel(true);
    setLabelStatusMsg('Recherche de photos réelles sur les bases Web...');
    setWebSearchCandidates([]);

    try {
      const q = encodeURIComponent(`${wine.name} ${wine.appellation || ''}`.trim());
      const foundUrls = [];

      // Recherche OpenFoodFacts (riche en vins, cidres et spiritueux français)
      try {
        const offResp = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=6`);
        if (offResp.ok) {
          const offData = await offResp.json();
          (offData.products || []).forEach((p) => {
            if (p.image_front_url) foundUrls.push({ title: p.product_name || wine.name, url: p.image_front_url });
          });
        }
      } catch {
        // Ignore erreur réseau OFF
      }

      // Recherche Wikimedia Commons (étiquettes de grands crus, cidres, spiritueux)
      try {
        const wikiResp = await fetch(
          `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(wine.name + ' wine OR bottle')}&gsrlimit=6&prop=imageinfo&iiprop=url&format=json&origin=*`
        );
        if (wikiResp.ok) {
          const wikiData = await wikiResp.json();
          const pages = wikiData?.query?.pages || {};
          Object.values(pages).forEach((pg) => {
            const imgUrl = pg?.imageinfo?.[0]?.url;
            if (imgUrl && /\.(jpg|jpeg|png|webp)$/i.test(imgUrl)) {
              foundUrls.push({ title: pg.title.replace('File:', ''), url: imgUrl });
            }
          });
        }
      } catch {
        // Ignore
      }

      if (foundUrls.length > 0) {
        setWebSearchCandidates(foundUrls.slice(0, 6));
        // Applique automatiquement la première photo trouvée via le proxy anti-CORS
        const dataUrl = await fetchImageAsLabelDataUrl(foundUrls[0].url, wine);
        const updatedWines = wines.map((w) => (w.id === wine.id ? { ...w, customLabelUrl: dataUrl } : w));
        setSelectedWine({ ...wine, customLabelUrl: dataUrl });
        updateCellar(walls, updatedWines, history);
        setLabelStatusMsg(`✅ Vraie photo trouvée ! Cliquez sur une autre miniature ci-dessous si vous souhaitez changer.`);
      } else {
        // Si aucune photo directe dans la base libre, génère l'étiquette officielle haute définition
        const fallbackDataUrl = await generateAILabelDataUrl(wine, {});
        const updatedWines = wines.map((w) => (w.id === wine.id ? { ...w, customLabelUrl: fallbackDataUrl } : w));
        setSelectedWine({ ...wine, customLabelUrl: fallbackDataUrl });
        updateCellar(walls, updatedWines, history);
        setLabelStatusMsg('Étiquette officielle recréée ! Vous pouvez aussi coller un lien Google Images ci-dessous.');
      }
    } catch (e) {
      console.error(e);
      setLabelStatusMsg('Collez directement le lien d’une image ci-dessous.');
    } finally {
      setIsFetchingLabel(false);
    }
  };

  // Appliquer une URL d'image Web (avec conversion proxy anti-CORS automatique)
  const handleApplyExternalImageUrl = async (urlToApply) => {
    if (!urlToApply || !selectedWine) return;
    setIsFetchingLabel(true);
    setLabelStatusMsg('Adaptation de la photo Web sur le cylindre de la bouteille...');
    try {
      const dataUrl = await fetchImageAsLabelDataUrl(urlToApply.trim(), selectedWine);
      const updatedWines = wines.map((w) => (w.id === selectedWine.id ? { ...w, customLabelUrl: dataUrl } : w));
      setSelectedWine({ ...selectedWine, customLabelUrl: dataUrl });
      updateCellar(walls, updatedWines, history);
      setCustomImageUrlInput('');
      setLabelStatusMsg('✅ Photo Web appliquée et sauvegardée dans votre cave !');
    } catch {
      setLabelStatusMsg('⚠️ Ce lien ne pointe pas vers une image directe. Faites "Copier l’adresse de l’image" sur Google Images.');
    } finally {
      setIsFetchingLabel(false);
    }
  };

  // ============================================================================
  // 3. SCAN PHOTO D'ÉTIQUETTE (CAMÉRA TÉLÉPHONE)
  // ============================================================================
  const handleDirectLabelPhotoUpload = async (e, targetWine) => {
    const file = e.target.files?.[0];
    if (!file || !targetWine) return;
    setIsFetchingLabel(true);
    setLabelStatusMsg('Recadrage de votre photo sur la bouteille...');
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = await fetchImageAsLabelDataUrl(reader.result, targetWine);
        const updatedWines = wines.map((w) => (w.id === targetWine.id ? { ...w, customLabelUrl: dataUrl } : w));
        setSelectedWine({ ...targetWine, customLabelUrl: dataUrl });
        updateCellar(walls, updatedWines, history);
        setLabelStatusMsg('📷 Photo d’étiquette appliquée avec succès !');
        setIsFetchingLabel(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setIsFetchingLabel(false);
    }
  };

  // Scanner global pour ajouter une bouteille par photo IA
  const handleScannerFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64DataUrl = reader.result;
      setScanPreview(base64DataUrl);

      // Prépare l'étiquette recadrée
      const croppedLabel = await fetchImageAsLabelDataUrl(base64DataUrl, newWine);
      const activeKey = userGeminiKey.trim();

      if (activeKey) {
        try {
          const base64Clean = base64DataUrl.split(',')[1];
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${activeKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    {
                      text: `Analyse cette étiquette de bouteille (Vin, Cidre ou Alcool/Spiritueux). Réponds uniquement en JSON strict :
                      {"category":"Vin ou Cidre ou Alcool","name":"Nom du domaine/château/marque","appellation":"Appellation","region":"Région française","vintage":2020,"type":"Rouge, Blanc, Rosé, Effervescent, Cidre Brut, Calvados, Whisky, Rhum, Cognac...","grapes":"Cépages ou variétés de pommes ou base alcool","peakStart":2025,"peakEnd":2032,"drinkLimit":2035,"webRating":4.4,"tastingAdvice":"Conseil de service","foodPairing":"Plat 1, Plat 2"}`
                    },
                    { inlineData: { mimeType: file.type || 'image/jpeg', data: base64Clean } }
                  ]
                }]
              })
            }
          );
          const data = await resp.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            const cat = parsed.category || getCategoryFromType(parsed.type);
            setNewWine((prev) => ({
              ...prev,
              category: cat,
              name: parsed.name || prev.name,
              appellation: parsed.appellation || prev.appellation,
              region: parsed.region || prev.region,
              vintage: Number(parsed.vintage) || CURRENT_YEAR - 2,
              type: parsed.type || prev.type,
              bottleShape: DRINK_CATEGORIES[cat]?.defaultShape || 'bordeaux',
              grapes: parsed.grapes || prev.grapes,
              peakStart: Number(parsed.peakStart) || CURRENT_YEAR,
              peakEnd: Number(parsed.peakEnd) || CURRENT_YEAR + 6,
              drinkLimit: Number(parsed.drinkLimit) || CURRENT_YEAR + 10,
              webRating: Number(parsed.webRating) || 4.4,
              tastingAdvice: parsed.tastingAdvice || prev.tastingAdvice,
              foodPairing: Array.isArray(parsed.foodPairing) ? parsed.foodPairing.join(', ') : (parsed.foodPairing || ''),
              customLabelUrl: croppedLabel
            }));
          }
        } catch (err) {
          console.warn('Scan OCR fallback:', err);
          setNewWine((prev) => ({ ...prev, customLabelUrl: croppedLabel }));
        }
      } else {
        setNewWine((prev) => ({
          ...prev,
          customLabelUrl: croppedLabel
        }));
      }

      setIsScanning(false);
      setShowScannerModal(false);
      setShowAddModal(true);
    };
    reader.readAsDataURL(file);
  };

  // Ajouter la bouteille dans la cave
  const handleAddWineSubmit = async (e) => {
    e.preventDefault();
    let targetWall = addSlotTarget?.wallId || selectedWallId;
    let targetRow = addSlotTarget?.row || 1;
    let targetCol = addSlotTarget?.col || 1;

    if (!addSlotTarget) {
      const wall = walls.find((w) => w.id === selectedWallId) || walls[0];
      let found = false;
      for (let r = 1; r <= wall.rows && !found; r++) {
        for (let c = 1; c <= wall.cols && !found; c++) {
          if (!wines.some((w) => w.wallId === wall.id && w.row === r && w.col === c)) {
            targetWall = wall.id;
            targetRow = r;
            targetCol = c;
            found = true;
          }
        }
      }
    }

    const created = {
      id: `w_${Date.now()}`,
      ...newWine,
      vintage: Number(newWine.vintage) || CURRENT_YEAR,
      peakStart: Number(newWine.peakStart) || CURRENT_YEAR,
      peakEnd: Number(newWine.peakEnd) || CURRENT_YEAR + 5,
      drinkLimit: Number(newWine.drinkLimit) || CURRENT_YEAR + 8,
      webRating: Number(newWine.webRating) || 4.3,
      webUrl: newWine.webUrl || `https://www.vivino.com/search/wines?q=${encodeURIComponent(newWine.name + ' ' + newWine.vintage)}`,
      foodPairing: typeof newWine.foodPairing === 'string'
        ? newWine.foodPairing.split(',').map((s) => s.trim()).filter(Boolean)
        : newWine.foodPairing || ['Gastronomie française'],
      wallId: targetWall,
      row: targetRow,
      col: targetCol
    };

    // Génère automatiquement une belle étiquette si aucune photo n'a été fournie
    if (!created.customLabelUrl) {
      created.customLabelUrl = await generateAILabelDataUrl(created, {});
    }

    const nextWines = [...wines, created];
    updateCellar(walls, nextWines, history);
    setShowAddModal(false);
    setAddSlotTarget(null);
  };

  // Marquer une bouteille comme bue
  const handleDrinkBottle = (wine) => {
    const entry = {
      id: `h_${Date.now()}`,
      name: wine.name,
      appellation: wine.appellation,
      region: wine.region,
      vintage: wine.vintage,
      type: wine.type,
      drunkDate: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      userRating: wine.userRating || 4.5,
      tastingNotes: wine.userNotes || 'Très belle dégustation.',
      guest: 'Cave personnelle'
    };
    const nextWines = wines.filter((w) => w.id !== wine.id);
    const nextHistory = [entry, ...history];
    updateCellar(walls, nextWines, nextHistory);
    setSelectedWine(null);
  };

  // Sommelier IA
  const handleAskSommelier = (e) => {
    e.preventDefault();
    if (!dishInput.trim() || wines.length === 0) return;
    setIsAskingSommelier(true);

    setTimeout(() => {
      const q = dishInput.toLowerCase();
      const scored = wines.map((w) => {
        let score = 0;
        const pairings = (w.foodPairing || []).join(' ').toLowerCase();
        const cat = getCategoryFromType(w.type);
        if (pairings.includes(q) || q.split(' ').some((word) => word.length > 3 && pairings.includes(word))) score += 50;
        if (/crêpe|galette|tarte|pomme|camembert|normand/i.test(q) && (cat === 'Cidre' || w.region === 'Normandie')) score += 45;
        if (/digestif|café|cigare|chocolat/i.test(q) && cat === 'Alcool') score += 45;
        if (/boeuf|agneau|gibier|canard|viande|côte/i.test(q) && w.type === 'Rouge') score += 30;
        if (/poisson|fruits de mer|homard|saint-jacques|fromage|chèvre/i.test(q) && (w.type === 'Blanc' || w.type === 'Effervescent')) score += 30;
        if (/apéritif|été|grillade|salade|méditerran/i.test(q) && (w.type === 'Rosé' || w.type === 'Effervescent')) score += 30;
        const ap = getApogeeInfo(w);
        if (ap.status === 'peak' || ap.status === 'urgent') score += 15;
        return { wine: w, score };
      }).sort((a, b) => b.score - a.score);

      setSommelierResult({
        dish: dishInput,
        best: scored[0]?.wine || wines[0],
        alternative: scored[1]?.wine || null
      });
      setIsAskingSommelier(false);
    }, 450);
  };

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
      <aside className="hidden md:flex md:w-72 bg-[#160F0B] border-r border-amber-900/30 flex-col justify-between p-6 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-600 to-red-900 flex items-center justify-center shadow-lg">
              <Wine className="w-6 h-6 text-amber-100" />
            </div>
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
            <div className="text-sm font-bold text-amber-100 truncate mt-0.5">{accountId}</div>
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
          <div className="flex items-center gap-3">
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
              onClick={() => setShowScannerModal(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs md:text-sm shadow-lg transition"
            >
              <Camera className="w-4 h-4" />
              <span>Scanner</span>
            </button>
            <button
              onClick={() => {
                setAddSlotTarget(null);
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
                  onClick={() => setShowWallConfig(true)}
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
                    const bottle = filteredWines.find((w) => w.wallId === activeWall.id && w.row === row && w.col === col);
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
                          } else {
                            setAddSlotTarget({ wallId: activeWall.id, row, col });
                            setShowAddModal(true);
                          }
                        }}
                        className="group relative h-56 rounded-2xl bg-gradient-to-b from-[#1A0F0A] via-[#110906] to-[#24150E] border-2 border-[#472A1B] hover:border-amber-500/80 shadow-inner flex flex-col items-center justify-between p-2.5 cursor-pointer transition-all"
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
              {wines.map((wine) => {
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
                        📍 {wallName} — Rangée {wine.row}, Casier {wine.col}
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
              <form onSubmit={handleAskSommelier} className="flex gap-3">
                <input
                  type="text"
                  value={dishInput}
                  onChange={(e) => setDishInput(e.target.value)}
                  placeholder="Ex: Magret de canard aux figues, Crêpes normandes, Homard grillé..."
                  className="flex-1 px-4 py-3 rounded-xl bg-stone-950 border border-amber-800/50 text-sm text-stone-100"
                />
                <button
                  type="submit"
                  disabled={isAskingSommelier}
                  className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm"
                >
                  {isAskingSommelier ? 'Analyse...' : 'Trouver l’accord'}
                </button>
              </form>
            </div>

            {sommelierResult && sommelierResult.best && (
              <div className="p-6 rounded-3xl bg-gradient-to-br from-[#23150E] to-[#140C08] border border-amber-600/50 flex flex-col md:flex-row items-center gap-6">
                <RealisticBottleSVG wine={sommelierResult.best} size="showcase" />
                <div className="space-y-3 flex-1">
                  <div className="text-xs uppercase tracking-wider text-amber-400 font-bold">
                    Sélection idéale pour « {sommelierResult.dish} »
                  </div>
                  <h4 className="text-2xl font-serif font-bold text-amber-100">
                    {sommelierResult.best.name} ({sommelierResult.best.vintage})
                  </h4>
                  <p className="text-sm text-stone-300">
                    {sommelierResult.best.appellation} • {sommelierResult.best.type}
                  </p>
                  <p className="text-xs text-amber-300 bg-amber-950/50 px-3 py-2 rounded-xl border border-amber-800/40">
                    📍 Emplacement : <strong>{walls.find((w) => w.id === sommelierResult.best.wallId)?.name}</strong> — Rangée {sommelierResult.best.row}, Casier {sommelierResult.best.col}
                  </p>
                  <p className="text-xs text-stone-400 italic">💡 {sommelierResult.best.tastingAdvice}</p>
                  <button
                    onClick={() => setSelectedWine(sommelierResult.best)}
                    className="px-4 py-2 rounded-xl bg-amber-600 text-stone-950 font-bold text-xs"
                  >
                    Ouvrir la vitrine de la bouteille
                  </button>
                </div>
              </div>
            )}
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
                    const count = regionBottles.length;
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
                          {w.appellation} • {w.vintage} • <span className="text-amber-400">{w.type}</span>
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
                  <p className="text-sm text-stone-200 italic mt-2">« {h.tastingNotes} »</p>
                </div>
                <div className="text-amber-400 font-bold text-sm">★ {h.userRating}/5</div>
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
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => handleGenerateAILabel(selectedWine)}
                    disabled={isFetchingLabel}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-[11px] shadow transition"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>✨ Étiquette IA</span>
                  </button>

                  <button
                    onClick={() => handleSearchWebLabels(selectedWine)}
                    disabled={isFetchingLabel}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-700/40 font-semibold text-[11px] transition"
                  >
                    <Globe className="w-4 h-4 text-amber-400" />
                    <span>🌐 Vraie photo Web</span>
                  </button>

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
                  <div className="text-[11px] text-amber-300 bg-amber-950/60 border border-amber-700/40 rounded-lg px-2.5 py-1.5 text-center">
                    {labelStatusMsg}
                  </div>
                )}

                {/* Miniatures trouvées sur le Web */}
                {webSearchCandidates.length > 0 && (
                  <div className="p-2 rounded-xl bg-stone-950/80 border border-amber-900/40 space-y-1.5">
                    <div className="text-[10px] text-stone-400 font-semibold">Photos trouvées (cliquez pour appliquer) :</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {webSearchCandidates.map((cand, i) => (
                        <button
                          key={i}
                          onClick={() => handleApplyExternalImageUrl(cand.url)}
                          className="h-14 rounded-lg overflow-hidden border border-amber-700/40 hover:border-amber-400 bg-stone-900"
                        >
                          <img
                            src={`https://wsrv.nl/?url=${encodeURIComponent(cand.url)}&w=120&h=120&fit=cover`}
                            alt={cand.title}
                            className="w-full h-full object-cover"
                          />
                        </button>
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
                    Placer
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
                      {selectedWine.name} ({selectedWine.vintage})
                    </h3>
                    <p className="text-sm text-stone-400">{selectedWine.appellation}</p>
                  </div>
                  <button
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
                    <span>Note Web : {selectedWine.webRating}/5 (Voir avis)</span>
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
                    <span className="text-amber-400 font-semibold block mb-1">Mes notes personnelles ({selectedWine.userRating}/5) :</span>
                    <textarea
                      rows="2"
                      value={selectedWine.userNotes || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = { ...selectedWine, userNotes: val };
                        setSelectedWine(updated);
                        updateCellar(walls, wines.map((w) => (w.id === updated.id ? updated : w)), history);
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
                  onClick={() => handleDrinkBottle(selectedWine)}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-800 to-amber-700 hover:from-red-700 hover:to-amber-600 text-white text-xs font-bold shadow-lg"
                >
                  <Wine className="w-4 h-4" />
                  Boire cette bouteille (Archiver au carnet)
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
              <button onClick={() => setShowAddModal(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddWineSubmit} className="space-y-4 text-xs">
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
                    value={newWine.region}
                    onChange={(e) => setNewWine({ ...newWine, region: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-900/50 text-stone-100"
                  >
                    {WINE_REGIONS_MAP.map((r) => (
                      <option key={r.id} value={r.id}>{r.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-stone-400 block mb-1">Millésime / Année</label>
                  <input
                    type="number"
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
                    value={newWine.bottleShape}
                    onChange={(e) => setNewWine({ ...newWine, bottleShape: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-900/50 text-stone-100"
                  >
                    <option value="bordeaux">Bordelaise (Épaules hautes)</option>
                    <option value="burgundy">Bourguignonne / Rhône</option>
                    <option value="champagne">Champenoise / Cidre Bouché</option>
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
              <button onClick={() => setShowScannerModal(false)} className="text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-stone-400">
              Prenez l’étiquette en photo avec votre téléphone : l’application découpe l’étiquette pour la bouteille 3D et pré-remplit la fiche.
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
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* MODALE CONFIGURATION DES MURS */}
      {showWallConfig && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18100C] border-2 border-amber-700/50 rounded-3xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-serif font-bold text-amber-100">Configurer les murs et casiers</h3>
              <button onClick={() => setShowWallConfig(false)} className="text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {walls.map((w, idx) => (
                <div key={w.id} className="p-3 rounded-xl bg-stone-900 border border-amber-900/30 grid grid-cols-3 gap-2 items-center text-xs">
                  <input
                    type="text"
                    value={w.name}
                    onChange={(e) => {
                      const next = [...walls];
                      next[idx].name = e.target.value;
                      updateCellar(next, wines, history);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-amber-100 font-bold"
                  />
                  <div>
                    <label className="text-[10px] text-stone-400 block">Étagères (Lignes)</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={w.rows}
                      onChange={(e) => {
                        const next = [...walls];
                        next[idx].rows = Number(e.target.value) || 4;
                        updateCellar(next, wines, history);
                      }}
                      className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-400 block">Colonnes</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={w.cols}
                      onChange={(e) => {
                        const next = [...walls];
                        next[idx].cols = Number(e.target.value) || 5;
                        updateCellar(next, wines, history);
                      }}
                      className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-700"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODALE COMPTES, GOOGLE DRIVE KAVA 20 & CLÉ GEMINI IA */}
      {showCloudModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18100C] border-2 border-amber-700/50 rounded-3xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-serif font-bold text-amber-100">Comptes Familiaux, Drive Kava 20 & Clé IA</h3>
              <button onClick={() => setShowCloudModal(false)} className="text-stone-400">
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
                3. Clé API Gemini (Scan IA)
              </button>
            </div>

            {cloudTab === 'accounts' && (
              <div className="space-y-3 text-xs">
                <p className="text-stone-400">Chaque membre dispose de sa propre cave indépendante :</p>
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
                      <div className="text-[10px] text-amber-400">{acc.id}</div>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify({ walls, wines, history }, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Kava20_${accountId}.json`;
                      a.click();
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-200 font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> Télécharger sauvegarde (.json)
                  </button>
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
                <p className="text-stone-400">
                  Le générateur d’étiquette IA et la recherche Web fonctionnent immédiatement sans clé. Pour activer en plus la lecture OCR Gemini lors du scan photo sur Render, collez votre clé Google AI Studio :
                </p>
                <input
                  type="password"
                  value={userGeminiKey}
                  onChange={(e) => {
                    setUserGeminiKey(e.target.value);
                    localStorage.setItem('lgc_gemini_api_key', e.target.value);
                  }}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-800/50 text-stone-100"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
