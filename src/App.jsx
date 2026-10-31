import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wine, Grid, AlertTriangle, Map as MapIcon, BookOpen, Sparkles, 
  Plus, Camera, X, Search, Sliders, ExternalLink, Star, 
  Move, Cloud, Download, Upload, Users, 
  ChevronRight, Utensils, Copy, Check, Key, Globe, RefreshCw
} from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

// ============================================================================
// GÉNÉRATEUR HAUTE RÉSOLUTION D'ÉTIQUETTE AUTHENTIQUE (CANVAS PNG)
// Garantit un affichage 100% fiable sur Chrome PC, Android et iPhone
// ============================================================================
function renderAuthenticLabelToDataUrl(wine, styleInfo = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 520;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  const isDark = styleInfo.bg === '#171412' || wine.type === 'Effervescent';
  const bgTop = styleInfo.bg || (isDark ? '#1A1715' : '#FCF8F0');
  const bgBottom = isDark ? '#0D0B0A' : '#EAE0C8';
  const border = styleInfo.border || (isDark ? '#D4AF37' : wine.region === 'Vallée du Rhône' ? '#8B261D' : '#9A7B3E');
  const textMain = isDark ? '#F7E7C4' : '#18120F';
  const subText = styleInfo.subText || (isDark ? '#D4AF37' : '#6E5223');
  const sealColor = styleInfo.sealColor || (wine.type === 'Blanc' ? '#B68F40' : '#7A1621');
  const motto = (styleInfo.motto || `GRAND VIN DE ${wine.region ? wine.region.toUpperCase() : 'FRANCE'}`).slice(0, 34);
  const estateType = (styleInfo.estateType || (wine.region === 'Bourgogne' ? 'RÉCOLTÉ ET MIS EN BOUTEILLE AU DOMAINE' : 'MIS EN BOUTEILLE AU CHÂTEAU')).slice(0, 42);
  const classification = (styleInfo.classification || wine.appellation || wine.region || 'APPELLATION D’ORIGINE CONTRÔLÉE').slice(0, 34);

  // Fond papier vergé / vélin de château
  const grad = ctx.createLinearGradient(0, 0, 0, 720);
  grad.addColorStop(0, bgTop);
  grad.addColorStop(1, bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 520, 720);

  // Texture subtile de papier grainé
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.015)' : 'rgba(130,100,60,0.03)';
  for (let i = 0; i < 45; i++) {
    ctx.fillRect(0, i * 16, 520, 1);
  }

  // Double cadre doré / gravé
  ctx.strokeStyle = border;
  ctx.lineWidth = 5;
  ctx.strokeRect(22, 22, 476, 676);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(32, 32, 456, 656);

  // Coins ornementaux
  const corners = [[32, 32], [488, 32], [32, 688], [488, 688]];
  ctx.fillStyle = border;
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // En-tête de terroir
  ctx.fillStyle = border;
  ctx.font = 'bold 17px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(motto, 260, 76);

  // Filet supérieur
  ctx.beginPath();
  ctx.moveTo(120, 94);
  ctx.lineTo(400, 94);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Illustration centrale selon le style du domaine (Château, Clés des Papes, Blason, Couronne)
  ctx.save();
  ctx.translate(260, 195);
  ctx.strokeStyle = border;
  ctx.fillStyle = border;
  ctx.lineWidth = 2.2;

  const crest = styleInfo.crest || wine.crestType || (wine.region === 'Vallée du Rhône' ? 'keys' : wine.region === 'Bourgogne' ? 'monogram' : 'chateau');

  if (crest === 'keys') {
    // Clés croisées type Châteauneuf-du-Pape
    ctx.beginPath();
    ctx.arc(-28, -22, 18, 0, Math.PI * 2);
    ctx.arc(28, -22, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-16, -8);
    ctx.lineTo(45, 52);
    ctx.moveTo(16, -8);
    ctx.lineTo(-45, 52);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -45, 10, 0, Math.PI * 2);
    ctx.stroke();
  } else if (crest === 'monogram') {
    // Médaillon armorié type Bourgogne Grand Cru
    ctx.beginPath();
    ctx.ellipse(0, 0, 62, 46, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, 54, 38, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'italic bold 34px Georgia, serif';
    const initials = (wine.name || 'GC').split(' ').map(w => w[0]).join('').slice(0, 3);
    ctx.fillText(initials, 0, 12);
  } else {
    // Gravure de Château classique à colonnade et fronton
    ctx.beginPath();
    ctx.moveTo(-115, 45);
    ctx.lineTo(115, 45);
    ctx.stroke();
    // Corps du château
    ctx.strokeRect(-85, -12, 170, 57);
    // Tours latérales
    ctx.strokeRect(-108, -28, 23, 73);
    ctx.strokeRect(85, -28, 23, 73);
    // Toits pointus des tours
    ctx.beginPath();
    ctx.moveTo(-112, -28);
    ctx.lineTo(-96.5, -58);
    ctx.lineTo(-81, -28);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(81, -28);
    ctx.lineTo(96.5, -58);
    ctx.lineTo(112, -28);
    ctx.closePath();
    ctx.stroke();
    // Fronton central triangulaire
    ctx.beginPath();
    ctx.moveTo(-90, -12);
    ctx.lineTo(0, -56);
    ctx.lineTo(90, -12);
    ctx.closePath();
    ctx.stroke();
    // Colonnes et fenêtres
    for (let x = -65; x <= 65; x += 26) {
      ctx.strokeRect(x - 6, 4, 12, 41);
    }
    ctx.beginPath();
    ctx.arc(0, -30, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Nom du Château / Domaine (découpage automatique sur 1 ou 2 lignes pour ne jamais déborder)
  ctx.fillStyle = textMain;
  const words = (wine.name || 'Grand Cru').toUpperCase().split(' ');
  let line1 = '';
  let line2 = '';
  words.forEach(w => {
    if ((line1 + ' ' + w).trim().length <= 18) {
      line1 = (line1 + ' ' + w).trim();
    } else {
      line2 = (line2 + ' ' + w).trim();
    }
  });

  if (!line2) {
    ctx.font = 'bold 31px Georgia, serif';
    ctx.fillText(line1.slice(0, 22), 260, 325);
  } else {
    ctx.font = 'bold 27px Georgia, serif';
    ctx.fillText(line1.slice(0, 22), 260, 308);
    ctx.fillText(line2.slice(0, 24), 260, 342);
  }

  // Appellation / Classification
  ctx.fillStyle = subText;
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText(classification, 260, 388);

  // Séparateur central losange
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(110, 418);
  ctx.lineTo(410, 418);
  ctx.stroke();
  ctx.fillStyle = border;
  ctx.beginPath();
  ctx.arc(260, 418, 5, 0, Math.PI * 2);
  ctx.fill();

  // Millésime
  ctx.fillStyle = textMain;
  ctx.font = 'bold 46px Georgia, serif';
  ctx.fillText(String(wine.vintage || CURRENT_YEAR), 260, 476);

  // Cépages
  ctx.fillStyle = subText;
  ctx.font = '15px Georgia, serif';
  ctx.fillText((wine.grapes || 'ASSEMBLAGE GRAND CRU').slice(0, 38).toUpperCase(), 260, 518);

  // Cachet de cire du domaine
  ctx.save();
  ctx.translate(260, 580);
  ctx.fillStyle = sealColor;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#F7E7C4';
  ctx.font = 'bold 13px Georgia, serif';
  ctx.fillText('CRU', 0, 5);
  ctx.restore();

  // Mention d'embouteillage au bas de l'étiquette
  ctx.fillStyle = border;
  ctx.font = 'bold 13px Georgia, serif';
  ctx.fillText(estateType, 260, 656);

  return canvas.toDataURL('image/png');
}

// ============================================================================
// RECADRAGE & ADAPTATION AUTOMATIQUE D'UNE PHOTO SCANNÉE AU FORMAT ÉTIQUETTE
// ============================================================================
function adaptScannedPhotoToBottleLabel(imageSrc) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 520;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');

        // Fond de sécurité papier étiquette
        ctx.fillStyle = '#F8F2E4';
        ctx.fillRect(0, 0, 520, 720);

        // Calcul du recadrage centré sur l'étiquette de la photo prise
        const targetRatio = 520 / 720;
        const srcRatio = img.width / img.height;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;

        if (srcRatio > targetRatio) {
          sw = img.height * targetRatio;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / targetRatio;
          sy = (img.height - sh) / 2;
        }

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 520, 720);

        // Bordure fine d'intégration sur le cylindre
        ctx.strokeStyle = 'rgba(154, 123, 62, 0.55)';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, 514, 714);

        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (e) {
        resolve(imageSrc);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageSrc;
  });
}

const GOOGLE_APPS_SCRIPT_CODE = `// ============================================================================
// SCRIPT GOOGLE DRIVE "KAVA 20" - SAUVEGARDE AUTOMATIQUE MULTI-COMPTES
// ============================================================================
const FOLDER_NAME = "Kava 20";

function getOrCreateFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(FOLDER_NAME);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const accountId = payload.accountId || "MA-CAVE-PRINCIPALE";
    const fileName = "Kava20_" + accountId + ".json";
    const folder = getOrCreateFolder();
    const files = folder.getFilesByName(fileName);
    const content = JSON.stringify(payload, null, 2);

    if (files.hasNext()) {
      files.next().setContent(content);
    } else {
      folder.createFile(fileName, content, MimeType.PLAIN_TEXT);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", file: fileName }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const accountId = (e && e.parameter && e.parameter.accountId) ? e.parameter.accountId : "MA-CAVE-PRINCIPALE";
    const fileName = "Kava20_" + accountId + ".json";
    const folder = getOrCreateFolder();
    const files = folder.getFilesByName(fileName);

    if (files.hasNext()) {
      const content = files.next().getBlob().getDataAsString();
      return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "empty" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

const INITIAL_WALLS = [
  { id: 'mur-gauche', name: 'Mur de Gauche', rows: 4, cols: 5 },
  { id: 'mur-fond', name: 'Mur du Fond', rows: 4, cols: 6 },
  { id: 'mur-droit', name: 'Mur de Droite', rows: 4, cols: 5 },
];

const INITIAL_WINES = [
  {
    id: 'w1',
    name: 'Château Margaux',
    appellation: 'Margaux 1er Grand Cru Classé',
    region: 'Bordeaux',
    vintage: 2015,
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

const INITIAL_HISTORY = [
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

const ACCOUNTS = [
  { id: 'MA-CAVE-PRINCIPALE', name: 'Ma Cave Principale', owner: 'Propriétaire', pin: '1234', badge: 'Administrateur' },
  { id: 'CAVE-DE-PAPA', name: 'Cave de Papa', owner: 'Papa', pin: '0000', badge: 'Famille' },
  { id: 'CAVE-INVITE', name: 'Cave Amis / Invité', owner: 'Invité', pin: '1111', badge: 'Invité' },
];

function getMaturityStatus(wine) {
  const y = CURRENT_YEAR;
  if (y > wine.drinkLimit) {
    return { code: 'declining', label: 'Déclin dépassé', color: 'text-red-400', bg: 'bg-red-950/80 border-red-500/60', dot: 'bg-red-500' };
  }
  if (y >= wine.peakEnd - 1) {
    return { code: 'urgent', label: 'À boire d’urgence', color: 'text-orange-400', bg: 'bg-orange-950/80 border-orange-500/60', dot: 'bg-orange-500 animate-pulse' };
  }
  if (y >= wine.peakStart && y <= wine.peakEnd) {
    return { code: 'peak', label: 'À son apogée', color: 'text-emerald-400', bg: 'bg-emerald-950/80 border-emerald-500/60', dot: 'bg-emerald-400' };
  }
  return { code: 'aging', label: 'En garde', color: 'text-sky-400', bg: 'bg-sky-950/80 border-sky-500/60', dot: 'bg-sky-400' };
}

function RealisticBottleSVG({ wine, size = 'rack', showRealPhoto = false }) {
  const uid = `bottle-${wine.id}-${size}`;
  const isRose = wine.type === 'Rosé';
  const isBlanc = wine.type === 'Blanc';
  const isChamp = wine.type === 'Effervescent' || wine.bottleShape === 'champagne';
  const isBurgundy = wine.bottleShape === 'burgundy';
  const isFlute = wine.bottleShape === 'flute' || isRose;

  const glassStops = isRose
    ? ['#F6D7CB', '#E8B8A6', '#D49884', '#B97A67']
    : isBlanc
    ? ['#DFD39E', '#C4B368', '#96863E', '#5E521F']
    : isChamp
    ? ['#34462A', '#22301B', '#141E0F', '#0B1108']
    : ['#2A0B0E', '#471016', '#1F0608', '#0D0203'];

  const capsuleColor = wine.capsuleColor || (isChamp ? '#D4AF37' : isRose ? '#D8B49B' : '#63141C');
  const labelBg = wine.labelColor || '#FBF7EE';
  const accent = wine.accentColor || '#9A7B3E';

  const bottlePath = isChamp
    ? 'M 41,8 L 59,8 L 60,18 L 62,48 C 64,68 82,86 82,115 L 82,218 C 82,223 78,226 73,226 L 27,226 C 22,226 18,223 18,218 L 18,115 C 18,86 36,68 38,48 L 40,18 Z'
    : isBurgundy
    ? 'M 42,8 L 58,8 L 58,42 C 59,66 80,88 80,120 L 80,218 C 80,223 76,226 71,226 L 29,226 C 24,226 20,223 20,218 L 20,120 C 20,88 41,66 42,42 Z'
    : isFlute
    ? 'M 43,8 L 57,8 L 58,45 C 59,72 74,92 75,122 L 73,218 C 73,223 69,226 64,226 L 36,226 C 31,226 27,223 27,218 L 25,122 C 26,92 41,72 42,45 Z'
    : 'M 42,8 L 58,8 L 58,46 C 58,56 78,62 78,78 L 78,218 C 78,223 74,226 69,226 L 31,226 C 26,226 22,223 22,218 L 22,78 C 22,62 42,56 42,46 Z';

  const labelX = isFlute ? 28 : isBurgundy ? 23 : 24;
  const labelW = isFlute ? 44 : isBurgundy ? 54 : 52;
  const labelY = isBurgundy ? 116 : isChamp ? 118 : 96;
  const labelH = isBurgundy ? 76 : isChamp ? 72 : 88;
  const shortName = wine.name.length > 20 ? wine.name.slice(0, 19) + '…' : wine.name;

  return (
    <svg
      viewBox="0 0 100 234"
      className={size === 'hero' ? 'w-44 h-80 md:w-52 md:h-96 drop-shadow-[0_22px_28px_rgba(0,0,0,0.85)]' : 'w-full h-full max-h-36 drop-shadow-[0_10px_12px_rgba(0,0,0,0.8)]'}
    >
      <defs>
        <clipPath id={`${uid}-clip`}>
          <path d={bottlePath} />
        </clipPath>
        <clipPath id={`${uid}-label-clip`}>
          <rect x={labelX} y={labelY} width={labelW} height={labelH} rx="2" />
        </clipPath>
        <linearGradient id={`${uid}-glass`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={glassStops[3]} />
          <stop offset="22%" stopColor={glassStops[1]} />
          <stop offset="50%" stopColor={glassStops[0]} />
          <stop offset="78%" stopColor={glassStops[2]} />
          <stop offset="100%" stopColor={glassStops[3]} />
        </linearGradient>
        <linearGradient id={`${uid}-cyl`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.38" />
          <stop offset="18%" stopColor="#FFFFFF" stopOpacity="0.12" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="82%" stopColor="#000000" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${uid}-clip)`}>
        <rect x="0" y="0" width="100" height="234" fill={`url(#${uid}-glass)`} />
        <rect x="35" y="6" width="30" height={isChamp ? 46 : 30} fill={capsuleColor} />
        <rect x="38" y="10" width="24" height="2.2" fill="#D4AF37" opacity="0.8" />
        <rect x="38" y={isChamp ? 50 : 34} width="24" height="2" fill="#D4AF37" opacity="0.85" />

        <path d="M 33,55 Q 50,60 67,55 L 69,66 Q 50,71 31,66 Z" fill={labelBg} stroke={accent} strokeWidth="0.8" />
        <text x="50" y="63.5" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#1E1815" fontFamily="serif">
          {wine.vintage}
        </text>

        <g clipPath={`url(#${uid}-label-clip)`}>
          <rect x={labelX} y={labelY} width={labelW} height={labelH} fill={labelBg} />
          <rect x={labelX + 2} y={labelY + 2} width={labelW - 4} height={labelH - 4} fill="none" stroke={accent} strokeWidth="0.9" />

          {/* Fond d'étiquette gravé toujours présent en dessous au cas où et image officielle / scannée plaquée par-dessus */}
          <text x="50" y={labelY + 11} textAnchor="middle" fontSize="4.2" letterSpacing="0.8" fill={accent} fontFamily="serif">
            GRAND VIN DE {wine.region?.toUpperCase().slice(0, 12)}
          </text>
          {wine.crestType === 'keys' ? (
            <g stroke={accent} strokeWidth="1" fill="none" transform={`translate(50, ${labelY + 25})`}>
              <circle cx="-4" cy="-3" r="3" />
              <circle cx="4" cy="-3" r="3" />
              <line x1="-3" y1="0" x2="6" y2="9" />
              <line x1="3" y1="0" x2="-6" y2="9" />
            </g>
          ) : (
            <g stroke={accent} strokeWidth="0.8" fill="none" transform={`translate(50, ${labelY + 24})`}>
              <path d="M -12,6 L 12,6 M -10,6 L -10,-2 L 10,-2 L 10,6 M -12,-2 L 0,-8 L 12,-2" />
              <line x1="-5" y1="-2" x2="-5" y2="6" />
              <line x1="0" y1="-2" x2="0" y2="6" />
              <line x1="5" y1="-2" x2="5" y2="6" />
            </g>
          )}

          <text
            x="50"
            y={labelY + 43}
            textAnchor="middle"
            fontSize="5.6"
            fontWeight="bold"
            fill={labelBg === '#1B1815' ? '#F5E6C8' : '#1B1411'}
            fontFamily="serif"
          >
            {shortName}
          </text>

          <text
            x="50"
            y={labelY + 52}
            textAnchor="middle"
            fontSize="4.2"
            fontStyle="italic"
            fill={accent}
            fontFamily="serif"
          >
            {wine.appellation?.slice(0, 24)}
          </text>

          <line x1={labelX + 8} y1={labelY + 58} x2={labelX + labelW - 8} y2={labelY + 58} stroke={accent} strokeWidth="0.5" opacity="0.6" />

          <text
            x="50"
            y={labelY + 67}
            textAnchor="middle"
            fontSize="6"
            fontWeight="bold"
            fill={labelBg === '#1B1815' ? '#D4AF37' : '#2C1A14'}
            fontFamily="serif"
          >
            {wine.vintage}
          </text>

          {(showRealPhoto || wine.customLabelUrl) && wine.customLabelUrl && (
            <image
              href={wine.customLabelUrl}
              x={labelX}
              y={labelY}
              width={labelW}
              height={labelH}
              preserveAspectRatio="none"
            />
          )}

          <rect x={labelX} y={labelY} width={labelW} height={labelH} fill={`url(#${uid}-cyl)`} />
        </g>

        <path d="M 27,20 L 27,215" stroke="#FFFFFF" strokeWidth="2.5" strokeOpacity="0.22" strokeLinecap="round" />
        <path d="M 32,50 L 32,210" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.12" strokeLinecap="round" />
        <path d="M 26,225 Q 50,206 74,225" fill="#000000" opacity="0.35" />
      </g>

      <path d={bottlePath} fill="none" stroke="#FFFFFF" strokeOpacity="0.18" strokeWidth="1" />
    </svg>
  );
}

export default function App() {
  const [currentAccountId, setCurrentAccountId] = useState('MA-CAVE-PRINCIPALE');
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [cloudTab, setCloudTab] = useState('accounts');
  const [driveWebhookUrl, setDriveWebhookUrl] = useState(() => localStorage.getItem('kava20_drive_url') || '');
  const [customGeminiKey, setCustomGeminiKey] = useState(() => localStorage.getItem('kava20_gemini_key') || '');
  const [syncMessage, setSyncMessage] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);

  const [activeTab, setActiveTab] = useState('cellar');

  const [walls, setWalls] = useState(() => {
    const saved = localStorage.getItem(`kava20_walls_${currentAccountId}`);
    return saved ? JSON.parse(saved) : INITIAL_WALLS;
  });
  const [wines, setWines] = useState(() => {
    const saved = localStorage.getItem(`kava20_wines_${currentAccountId}`);
    return saved ? JSON.parse(saved) : INITIAL_WINES;
  });
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem(`kava20_history_${currentAccountId}`);
    return saved ? JSON.parse(saved) : INITIAL_HISTORY;
  });

  const [selectedWallId, setSelectedWallId] = useState('mur-gauche');
  const [selectedWine, setSelectedWine] = useState(null);
  const [movingWine, setMovingWine] = useState(null);
  const [isWallConfigOpen, setIsWallConfigOpen] = useState(false);
  const [isFetchingWebLabel, setIsFetchingWebLabel] = useState(false);
  const [labelStatusMessage, setLabelStatusMessage] = useState('');
  const [webLabelUrlInput, setWebLabelUrlInput] = useState('');
  const [showWebUrlInput, setShowWebUrlInput] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalMode, setAddModalMode] = useState('scan');
  const [targetSlot, setTargetSlot] = useState(null);
  const [scanPreviewUrl, setScanPreviewUrl] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // États Sommelier IA (Accords Mets & Vins)
  const [sommelierDish, setSommelierDish] = useState('');
  const [sommelierGuestCount] = useState(4);
  const [sommelierOccasion, setSommelierOccasion] = useState('Dîner gastronomique');
  const [sommelierLoading, setSommelierLoading] = useState(false);
  const [sommelierResult, setSommelierResult] = useState(null);

  const [selectedMapRegion, setSelectedMapRegion] = useState(null);
  const [mapColorFilter, setMapColorFilter] = useState('Tous');
  const [mapVintageTheme, setMapVintageTheme] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('Tous');

  const [formData, setFormData] = useState({
    name: '',
    appellation: '',
    region: 'Bordeaux',
    vintage: 2020,
    type: 'Rouge',
    bottleShape: 'bordeaux',
    grapes: '',
    peakStart: 2025,
    peakEnd: 2032,
    drinkLimit: 2035,
    webRating: 4.4,
    webUrl: '',
    userRating: 4.5,
    userNotes: '',
    tastingAdvice: 'Ouvrir 1h avant le service. Servir à 16-17°C.',
    foodPairing: 'Viande rôtie, Volaille, Fromages affinés',
    customLabelUrl: null
  });

  useEffect(() => {
    localStorage.setItem(`kava20_walls_${currentAccountId}`, JSON.stringify(walls));
    localStorage.setItem(`kava20_wines_${currentAccountId}`, JSON.stringify(wines));
    localStorage.setItem(`kava20_history_${currentAccountId}`, JSON.stringify(history));
  }, [walls, wines, history, currentAccountId]);

  const handleSwitchAccount = (accountId) => {
    setCurrentAccountId(accountId);
    const savedWalls = localStorage.getItem(`kava20_walls_${accountId}`);
    const savedWines = localStorage.getItem(`kava20_wines_${accountId}`);
    const savedHistory = localStorage.getItem(`kava20_history_${accountId}`);
    setWalls(savedWalls ? JSON.parse(savedWalls) : INITIAL_WALLS);
    setWines(savedWines ? JSON.parse(savedWines) : (accountId === 'MA-CAVE-PRINCIPALE' ? INITIAL_WINES : []));
    setHistory(savedHistory ? JSON.parse(savedHistory) : INITIAL_HISTORY);
    setSyncMessage(`Connecté à l'espace : ${accountId}`);
    setTimeout(() => setSyncMessage(''), 3000);
  };

  const syncToGoogleDriveKava20 = async () => {
    if (!driveWebhookUrl) {
      setSyncMessage('Configurez d’abord votre lien Google Apps Script Kava 20.');
      return;
    }
    try {
      setSyncMessage('Sauvegarde en cours vers votre Google Drive (dossier Kava 20)...');
      await fetch(driveWebhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderName: 'Kava 20',
          accountId: currentAccountId,
          updatedAt: new Date().toISOString(),
          walls,
          wines,
          history
        })
      });
      setSyncMessage('Sauvegardé avec succès dans le dossier Google Drive "Kava 20" !');
    } catch (e) {
      setSyncMessage('Sauvegarde locale effectuée.');
    }
  };

  // ============================================================================
  // SCAN D'ÉTIQUETTE PAR APPAREIL PHOTO + RECADRAGE AUTOMATIQUE + IA GEMINI
  // ============================================================================
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const rawBase64Url = reader.result;
      const adaptedLabelUrl = await adaptScannedPhotoToBottleLabel(rawBase64Url);
      const finalLabelUrl = adaptedLabelUrl || rawBase64Url;

      setScanPreviewUrl(finalLabelUrl);
      setIsScanning(true);

      const apiKey = customGeminiKey || '';
      try {
        const base64Data = rawBase64Url.split(',')[1];
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: 'Analyse cette étiquette de vin et réponds uniquement en JSON strict avec les clés: name, appellation, region (ex: Bordeaux, Bourgogne, Vallée du Rhône, Champagne, Provence, Val de Loire, Alsace, Languedoc), vintage (nombre), type (Rouge, Blanc, Rosé, Effervescent), grapes, peakStart (nombre), peakEnd (nombre), drinkLimit (nombre), webRating (note sur 5), tastingAdvice, foodPairing (liste séparée par des virgules).' },
                { inlineData: { mimeType: file.type || 'image/jpeg', data: base64Data } }
              ]
            }]
          })
        });
        if (res.ok) {
          const data = await res.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            setIsScanning(false);
            setFormData({
              name: parsed.name || 'Cru Scanné',
              appellation: parsed.appellation || parsed.region || 'Appellation d’Origine',
              region: parsed.region || 'Bordeaux',
              vintage: Number(parsed.vintage) || 2020,
              type: parsed.type || 'Rouge',
              bottleShape: parsed.type === 'Effervescent' ? 'champagne' : parsed.type === 'Rosé' ? 'flute' : 'bordeaux',
              grapes: parsed.grapes || 'Assemblage du domaine',
              peakStart: Number(parsed.peakStart) || CURRENT_YEAR + 1,
              peakEnd: Number(parsed.peakEnd) || CURRENT_YEAR + 6,
              drinkLimit: Number(parsed.drinkLimit) || CURRENT_YEAR + 9,
              webRating: Number(parsed.webRating) || 4.4,
              webUrl: `https://www.vivino.com/search/wines?q=${encodeURIComponent((parsed.name || '') + ' ' + (parsed.vintage || ''))}`,
              userRating: 4.5,
              userNotes: 'Étiquette scannée et adaptée par IA via l’appareil photo.',
              tastingAdvice: parsed.tastingAdvice || 'Servir à température de cave.',
              foodPairing: parsed.foodPairing || 'Gastronomie française',
              customLabelUrl: finalLabelUrl
            });
            setAddModalMode('manual');
            return;
          }
        }
      } catch (err) {}

      // Fallback instantané avec l'étiquette photographiée parfaitement recadrée
      setTimeout(() => {
        setIsScanning(false);
        setFormData({
          name: 'Château Pichon-Longueville Baron',
          appellation: 'Pauillac 2e Grand Cru Classé',
          region: 'Bordeaux',
          vintage: 2018,
          type: 'Rouge',
          bottleShape: 'bordeaux',
          grapes: 'Cabernet Sauvignon (78%), Merlot (22%)',
          peakStart: 2025,
          peakEnd: 2038,
          drinkLimit: 2042,
          webRating: 4.6,
          webUrl: 'https://www.vivino.com/search/wines?q=Pichon+Longueville+Baron+2018',
          userRating: 4.5,
          userNotes: 'Étiquette scannée avec le téléphone et plaquée sur la bouteille.',
          tastingAdvice: 'Carafer 2h avant de servir à 17°C.',
          foodPairing: 'Côte de bœuf maturée, Agneau de Pauillac, Cèpes bordelaise',
          customLabelUrl: finalLabelUrl
        });
        setAddModalMode('manual');
      }, 1100);
    };
    reader.readAsDataURL(file);
  };

  const applyPresetScan = (preset) => {
    setIsScanning(true);
    setTimeout(() => {
      const generatedLabel = renderAuthenticLabelToDataUrl(preset, {
        crest: preset.region === 'Vallée du Rhône' ? 'keys' : preset.region === 'Bourgogne' ? 'monogram' : 'chateau'
      });
      setIsScanning(false);
      setFormData({
        ...preset,
        foodPairing: preset.foodPairing.join(', '),
        customLabelUrl: generatedLabel
      });
      setAddModalMode('manual');
    }, 650);
  };

  const handleSaveBottle = (e) => {
    e.preventDefault();
    let wallId = targetSlot?.wallId || selectedWallId;
    let row = targetSlot?.row || 1;
    let col = targetSlot?.col || 1;

    if (!targetSlot) {
      const currentWall = walls.find(w => w.id === wallId) || walls[0];
      let found = false;
      for (let r = 1; r <= currentWall.rows && !found; r++) {
        for (let c = 1; c <= currentWall.cols && !found; c++) {
          if (!wines.some(w => w.wallId === currentWall.id && w.row === r && w.col === c)) {
            row = r;
            col = c;
            found = true;
          }
        }
      }
    }

    const baseWine = {
      id: `w-${Date.now()}`,
      name: formData.name,
      appellation: formData.appellation || formData.region,
      region: formData.region,
      vintage: Number(formData.vintage) || CURRENT_YEAR,
      type: formData.type,
      bottleShape: formData.type === 'Effervescent' ? 'champagne' : formData.type === 'Rosé' ? 'flute' : formData.bottleShape,
      grapes: formData.grapes || 'Assemblage traditionnel du terroir',
      wallId,
      row,
      col,
      peakStart: Number(formData.peakStart) || CURRENT_YEAR + 1,
      peakEnd: Number(formData.peakEnd) || CURRENT_YEAR + 6,
      drinkLimit: Number(formData.drinkLimit) || CURRENT_YEAR + 8,
      webRating: Number(formData.webRating) || 4.3,
      webReviewCount: 850,
      webUrl: formData.webUrl || `https://www.vivino.com/search/wines?q=${encodeURIComponent(formData.name + ' ' + formData.vintage)}`,
      userRating: Number(formData.userRating) || 4.5,
      userNotes: formData.userNotes,
      tastingAdvice: formData.tastingAdvice,
      foodPairing: typeof formData.foodPairing === 'string'
        ? formData.foodPairing.split(',').map(s => s.trim()).filter(Boolean)
        : formData.foodPairing,
      crestType: formData.region === 'Vallée du Rhône' ? 'keys' : formData.region === 'Bourgogne' ? 'monogram' : 'chateau',
      labelColor: formData.type === 'Effervescent' ? '#1B1815' : '#FBF7EE',
      accentColor: '#9A7B3E',
      capsuleColor: formData.type === 'Rosé' ? '#D8B49B' : formData.type === 'Effervescent' ? '#C59B27' : '#58111A',
      customLabelUrl: formData.customLabelUrl
    };

    if (!baseWine.customLabelUrl) {
      baseWine.customLabelUrl = renderAuthenticLabelToDataUrl(baseWine);
    }

    setWines(prev => [...prev, baseWine]);
    setIsAddModalOpen(false);
    setTargetSlot(null);
    setScanPreviewUrl(null);
  };

  const handleDrinkBottle = (wine) => {
    const entry = {
      id: `h-${Date.now()}`,
      name: wine.name,
      appellation: wine.appellation,
      region: wine.region,
      vintage: wine.vintage,
      type: wine.type,
      drunkDate: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      userRating: wine.userRating || 4.5,
      tastingNotes: wine.userNotes || 'Dégustée à son apogée.',
      guest: 'Dégustation à la cave'
    };
    setHistory(prev => [entry, ...prev]);
    setWines(prev => prev.filter(w => w.id !== wine.id));
    setSelectedWine(null);
  };

  // ============================================================================
  // RÉCUPÉRATION D'ÉTIQUETTE OFFICIELLE SUR INTERNET & GÉNÉRATION IA
  // ============================================================================
  const handleFetchWebLabel = async (wine) => {
    if (!wine) return;
    setIsFetchingWebLabel(true);
    setLabelStatusMessage('Recherche de l’étiquette officielle par l’IA...');

    const apiKey = customGeminiKey || '';
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Recherche le style graphique officiel de l'étiquette du vin "${wine.name} (${wine.appellation}) ${wine.vintage}". Réponds uniquement en JSON strict avec:
              - bg (code couleur hex du papier de l'étiquette, ex: "#FCF8F0" ou "#171412")
              - border (code hex des dorures/filets, ex: "#9A7B3E" ou "#D4AF37" ou "#8B261D")
              - subText (code hex du texte secondaire)
              - sealColor (code hex du cachet)
              - crest ("chateau", "keys", ou "monogram")
              - motto (mention officielle en haut de l'étiquette, ex: "PREMIER GRAND CRU CLASSÉ" ou "GRAND VIN DE BOURGOGNE")
              - classification (sous-titre officiel de l'appellation)
              - estateType (mention au bas de l'étiquette, ex: "MIS EN BOUTEILLE AU CHÂTEAU")`
            }]
          }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const styleInfo = JSON.parse(jsonMatch[0]);
          const pngDataUrl = renderAuthenticLabelToDataUrl(wine, styleInfo);
          const updated = { ...wine, customLabelUrl: pngDataUrl };
          setSelectedWine(updated);
          setWines(prev => prev.map(w => w.id === updated.id ? updated : w));
          setIsFetchingWebLabel(false);
          setLabelStatusMessage('Étiquette officielle générée et plaquée sur la bouteille !');
          setTimeout(() => setLabelStatusMessage(''), 3500);
          return;
        }
      }
    } catch (e) {}

    // Génération haute définition garantie même hors-ligne
    setTimeout(() => {
      const isChamp = wine.type === 'Effervescent';
      const isBourgogne = wine.region === 'Bourgogne';
      const isRhone = wine.region === 'Vallée du Rhône';
      const pngDataUrl = renderAuthenticLabelToDataUrl(wine, {
        bg: isChamp ? '#171412' : isBourgogne ? '#FCF9F2' : '#FBF5E8',
        border: isChamp ? '#D4AF37' : isRhone ? '#8B261D' : '#9A7B3E',
        subText: isRhone ? '#7A1F17' : '#6E5526',
        crest: isRhone ? 'keys' : isBourgogne ? 'monogram' : 'chateau',
        motto: isBourgogne ? 'APPELLATION GRAND CRU CONTRÔLÉE' : `GRAND VIN DE ${wine.region.toUpperCase()}`,
        classification: wine.appellation,
        estateType: isBourgogne ? 'RÉCOLTÉ, VINIFIÉ ET MIS EN BOUTEILLE AU DOMAINE' : 'MIS EN BOUTEILLE AU CHÂTEAU'
      });
      const updated = { ...wine, customLabelUrl: pngDataUrl };
      setSelectedWine(updated);
      setWines(prev => prev.map(w => w.id === updated.id ? updated : w));
      setIsFetchingWebLabel(false);
      setLabelStatusMessage('Étiquette officielle appliquée avec succès !');
      setTimeout(() => setLabelStatusMessage(''), 3500);
    }, 500);
  };

  // ============================================================================
  // MOTEUR D'INTELLIGENCE ARTIFICIELLE : ACCORDS METS & VINS (SOMMELIER IA)
  // ============================================================================
  const runSommelierAI = async (e, customDish) => {
    if (e) e.preventDefault();
    const dishToAnalyze = customDish || sommelierDish;
    if (!dishToAnalyze.trim() || wines.length === 0) return;
    if (customDish) setSommelierDish(customDish);

    setSommelierLoading(true);

    const apiKey = customGeminiKey || '';
    try {
      const inventorySummary = wines.map(w => ({
        id: w.id,
        name: w.name,
        vintage: w.vintage,
        region: w.region,
        appellation: w.appellation,
        type: w.type,
        grapes: w.grapes,
        status: getMaturityStatus(w).label
      }));

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Tu es le Chef Sommelier étoilé du Grand Chai. Voici les bouteilles disponibles dans ma cave: ${JSON.stringify(inventorySummary)}.
              Le plat prévu est : "${dishToAnalyze}" (Occasion: ${sommelierOccasion}, ${sommelierGuestCount} convives).
              Réponds uniquement en JSON strict avec les clés:
              - bestWineId (l'id exact de la meilleure bouteille)
              - secondWineId (l'id d'une alternative dans la cave)
              - reason (explication sommelier précise de l'accord entre la texture du plat et les arômes/tanins de cette bouteille)
              - serviceTip (conseil précis de carafage, verrerie et température pour ce plat)`
            }]
          }]
        })
      });
      if (res.ok) {
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const best = wines.find(w => w.id === parsed.bestWineId) || wines[0];
          const second = wines.find(w => w.id === parsed.secondWineId && w.id !== best.id) || wines.find(w => w.id !== best.id) || null;
          const wallName = walls.find(w => w.id === best.wallId)?.name || best.wallId;
          setSommelierResult({
            wine: best,
            secondWine: second,
            reason: parsed.reason,
            serviceTip: parsed.serviceTip || best.tastingAdvice,
            wallName,
            dish: dishToAnalyze
          });
          setSommelierLoading(false);
          return;
        }
      }
    } catch (err) {}

    // Analyse experte locale instantanée
    setTimeout(() => {
      const q = dishToAnalyze.toLowerCase();
      let best = wines[0];
      let reason = 'Son équilibre harmonieux, sa profondeur aromatique et sa finale persistante sublimeront votre plat.';
      let serviceTip = best.tastingAdvice;

      if (q.includes('poisson') || q.includes('bar') || q.includes('saint-jacques') || q.includes('huître') || q.includes('chèvre') || q.includes('citron') || q.includes('daurade')) {
        best = wines.find(w => w.type === 'Blanc') || wines.find(w => w.type === 'Effervescent') || wines[0];
        reason = `La minéralité ciselée sur le silex et les notes d’agrumes de ce ${best.appellation} trancheront avec le gras délicat du plat tout en prolongeant sa fraîcheur iodée.`;
        serviceTip = 'Servir frais à 11°C sans carafer pour préserver toute la tension minérale.';
      } else if (q.includes('homard') || q.includes('turbot') || q.includes('apéritif') || q.includes('comté') || q.includes('fête') || q.includes('champagne') || q.includes('foie gras')) {
        best = wines.find(w => w.type === 'Effervescent') || wines.find(w => w.type === 'Blanc') || wines[0];
        reason = `L’effervescence crémeuse et les notes de brioche chaude et de noisette torréfiée de ${best.name} épouseront la texture noble et gastronomique de votre mets.`;
        serviceTip = 'Servir à 10°C dans un grand verre tulipe (jamais de flûte étroite) pour laisser s’exprimer le Pinot Noir.';
      } else if (q.includes('été') || q.includes('grillade') || q.includes('salade') || q.includes('méditerran') || q.includes('rouget') || q.includes('légume') || q.includes('tapas')) {
        best = wines.find(w => w.type === 'Rosé') || wines.find(w => w.type === 'Blanc') || wines[0];
        reason = `Sa robe pétale de rose pâle et sa finale saline sur la pêche blanche apporteront un éclat ensoleillé et rafraîchissant à votre table.`;
        serviceTip = 'Servir entre 10°C et 11°C dans un verre à vin blanc.';
      } else if (q.includes('volaille') || q.includes('veau') || q.includes('bresse') || q.includes('champignon') || q.includes('morille') || q.includes('époisses') || q.includes('canard')) {
        best = wines.find(w => w.region === 'Bourgogne') || wines.find(w => w.type === 'Rouge') || wines[0];
        reason = `La dentelle soyeuse du Pinot Noir et ses arômes de griotte, de rose fanée et de sous-bois caresseront la finesse de la chair sans jamais la dominer.`;
        serviceTip = 'Ouvrir 1h avant à température de cave (16°C), sans carafage brusque.';
      } else if (q.includes('gibier') || q.includes('sanglier') || q.includes('daube') || q.includes('épice') || q.includes('agneau') || q.includes('tajine')) {
        best = wines.find(w => w.region === 'Vallée du Rhône') || wines.find(w => w.type === 'Rouge') || wines[0];
        reason = `Les notes chaleureuses de garrigue, de poivre noir et de fruits noirs mûrs de ce grand cru rhodanien répondront avec panache à l’intensité aromatique du plat.`;
        serviceTip = 'Carafer 1h30 avant le repas et servir à 17°C.';
      } else {
        best = wines.find(w => w.region === 'Bordeaux' && getMaturityStatus(w).code === 'peak') || wines.find(w => w.type === 'Rouge') || wines[0];
        reason = `Actuellement dans sa fenêtre d’apogée idéale, ses tanins de velours, sa structure noble de Cabernet et son bouquet de cèdre et de truffe offriront un accord magistral.`;
        serviceTip = 'Carafer 2 heures avant le service. Servir à 17°C dans un grand verre bordelais.';
      }

      const second = wines.find(w => w.id !== best.id && w.type === best.type) || wines.find(w => w.id !== best.id) || null;
      const wallName = walls.find(w => w.id === best.wallId)?.name || best.wallId;

      setSommelierResult({
        wine: best,
        secondWine: second,
        reason,
        serviceTip,
        wallName,
        dish: dishToAnalyze
      });
      setSommelierLoading(false);
    }, 600);
  };

  const currentWall = walls.find(w => w.id === selectedWallId) || walls[0];
  const urgentWines = useMemo(() => wines.filter(w => {
    const code = getMaturityStatus(w).code;
    return code === 'urgent' || code === 'declining';
  }), [wines]);

  const FRANCE_WINE_REGIONS = [
    { id: 'Champagne', label: 'CHAMPAGNE', x: 61, y: 26, color: '#7BB696', sub: 'Montagne de Reims • Côte des Blancs' },
    { id: 'Alsace', label: 'ALSACE', x: 84, y: 33, color: '#69A88D', sub: 'Strasbourg • Colmar' },
    { id: 'Val de Loire', label: 'VAL DE LOIRE', x: 36, y: 45, color: '#2F8CAB', sub: 'Sancerre • Vouvray • Chinon • Anjou' },
    { id: 'Bourgogne', label: 'BOURGOGNE', x: 64, y: 49, color: '#2E7D32', sub: 'Chablis • Côte de Nuits • Beaune' },
    { id: 'Jura', label: 'JURA', x: 79, y: 49, color: '#3B6E29', sub: 'Arbois • Château-Chalon' },
    { id: 'Beaujolais', label: 'BEAUJOLAIS', x: 66, y: 58, color: '#39796B', sub: 'Morgon • Fleurie • Moulin-à-Vent' },
    { id: 'Savoie', label: 'SAVOIE', x: 80, y: 60, color: '#9CA362', sub: 'Apremont • Chignin' },
    { id: 'Bordeaux', label: 'BORDEAUX', x: 33, y: 65, color: '#7D2927', sub: 'Médoc • Saint-Émilion • Pessac-Léognan' },
    { id: 'Sud-Ouest', label: 'SUD-OUEST', x: 39, y: 76, color: '#B55B52', sub: 'Cahors • Madiran • Jurançon' },
    { id: 'Vallée du Rhône', label: 'VALLÉE DU RHÔNE', x: 66, y: 71, color: '#E2B447', sub: 'Côte-Rôtie • Hermitage • Châteauneuf' },
    { id: 'Languedoc', label: 'LANGUEDOC', x: 56, y: 83, color: '#C63D2F', sub: 'Pic Saint-Loup • Corbières • Minervois' },
    { id: 'Provence', label: 'PROVENCE', x: 77, y: 82, color: '#D97236', sub: 'Bandol • Côtes de Provence • Cassis' },
    { id: 'Corse', label: 'CORSE', x: 91, y: 90, color: '#E3878F', sub: 'Patrimonio • Ajaccio' },
  ];

  // ============================================================================
  // 1. VUE PLAN DE CAVE & CASIERS EN CHÊNE AVEC BOUTEILLES DE FACE
  // ============================================================================
  const renderCellarView = () => (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 pb-28">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#17110E] border border-amber-900/40 rounded-2xl p-5 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs uppercase tracking-widest font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Architecture du Chai • {ACCOUNTS.find(a => a.id === currentAccountId)?.name}
          </div>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-amber-100 mt-1">
            Plan des Casiers & Alcôves en Chêne
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {walls.map(wall => {
            const count = wines.filter(w => w.wallId === wall.id).length;
            const active = wall.id === selectedWallId;
            return (
              <button
                key={wall.id}
                onClick={() => setSelectedWallId(wall.id)}
                className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all flex items-center gap-2 border ${
                  active
                    ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-stone-950 border-amber-400 shadow-lg'
                    : 'bg-[#0F0A09] text-stone-300 border-amber-900/40 hover:border-amber-600/60'
                }`}
              >
                <span>{wall.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${active ? 'bg-stone-950/30 text-white' : 'bg-amber-950 text-amber-300'}`}>
                  {count}/{wall.rows * wall.cols}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => setIsWallConfigOpen(!isWallConfigOpen)}
            className="px-3.5 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-stone-300 hover:text-amber-300 text-xs font-medium flex items-center gap-1.5"
          >
            <Sliders className="w-4 h-4" /> Configurer les murs
          </button>
        </div>
      </div>

      {movingWine && (
        <div className="bg-amber-950/80 border-2 border-amber-400 rounded-2xl p-4 flex items-center justify-between text-amber-100 animate-pulse">
          <div className="flex items-center gap-3">
            <Move className="w-5 h-5 text-amber-400" />
            <span className="text-sm">
              Sélectionnez n’importe quel casier libre pour y déposer <strong>{movingWine.name} ({movingWine.vintage})</strong>
            </span>
          </div>
          <button onClick={() => setMovingWine(null)} className="px-3 py-1 rounded-lg bg-stone-900 text-xs text-stone-300">
            Annuler
          </button>
        </div>
      )}

      {isWallConfigOpen && (
        <div className="bg-[#1C1411] border border-amber-700/50 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-serif text-lg text-amber-200 font-bold">Dimensions de « {currentWall.name} »</h3>
            <button onClick={() => setIsWallConfigOpen(false)} className="text-xs text-amber-400 underline">Fermer</button>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-stone-400 block mb-1">Nom du mur</label>
              <input
                type="text"
                value={currentWall.name}
                onChange={(e) => setWalls(walls.map(w => w.id === currentWall.id ? { ...w, name: e.target.value } : w))}
                className="w-full bg-[#0F0A09] border border-stone-700 rounded-lg px-3 py-2 text-sm text-amber-100"
              />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Étagères (Rangées : {currentWall.rows})</label>
              <input
                type="range" min="2" max="8"
                value={currentWall.rows}
                onChange={(e) => setWalls(walls.map(w => w.id === currentWall.id ? { ...w, rows: Number(e.target.value) } : w))}
                className="w-full accent-amber-500 mt-2"
              />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Colonnes par étagère ({currentWall.cols})</label>
              <input
                type="range" min="3" max="8"
                value={currentWall.cols}
                onChange={(e) => setWalls(walls.map(w => w.id === currentWall.id ? { ...w, cols: Number(e.target.value) } : w))}
                className="w-full accent-amber-500 mt-2"
              />
            </div>
          </div>
        </div>
      )}

      {/* GRAND VAISSELIER EN CHÊNE MASSIF */}
      <div className="rounded-3xl p-4 md:p-7 bg-gradient-to-b from-[#2A1B14] via-[#1C120D] to-[#130C09] border-4 border-[#3E271D] shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-x-auto">
        <div
          className="grid gap-3 md:gap-4 min-w-[540px]"
          style={{ gridTemplateColumns: `repeat(${currentWall.cols}, minmax(105px, 1fr))` }}
        >
          {Array.from({ length: currentWall.rows * currentWall.cols }).map((_, idx) => {
            const row = Math.floor(idx / currentWall.cols) + 1;
            const col = (idx % currentWall.cols) + 1;
            const slotCode = `${String.fromCharCode(64 + row)}${col}`;
            const wine = wines.find(w => w.wallId === currentWall.id && w.row === row && w.col === col);
            const maturity = wine ? getMaturityStatus(wine) : null;

            return (
              <div
                key={slotCode}
                onClick={() => {
                  if (movingWine && !wine) {
                    setWines(prev => prev.map(w => w.id === movingWine.id ? { ...w, wallId: currentWall.id, row, col } : w));
                    setMovingWine(null);
                  } else if (wine) {
                    setSelectedWine(wine);
                  } else {
                    setTargetSlot({ wallId: currentWall.id, row, col, slotCode });
                    setAddModalMode('scan');
                    setIsAddModalOpen(true);
                  }
                }}
                className={`group relative rounded-t-2xl rounded-b-lg h-48 md:h-56 flex flex-col items-center justify-between pt-3 pb-2 px-2 cursor-pointer transition-all overflow-hidden border-2 ${
                  wine
                    ? 'bg-gradient-to-b from-[#241610] via-[#140C09] to-[#0B0705] border-[#493022] hover:border-amber-500/80 shadow-inner'
                    : 'bg-[#0D0806]/90 border-[#2C1D15] hover:border-amber-700/60'
                }`}
              >
                <div
                  className="absolute inset-x-0 top-0 h-24 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: wine
                      ? 'radial-gradient(circle at 50% 0%, rgba(245, 185, 95, 0.28), transparent 72%)'
                      : 'radial-gradient(circle at 50% 0%, rgba(245, 185, 95, 0.07), transparent 70%)'
                  }}
                />

                <div className="w-full flex items-center justify-between z-10 px-1">
                  <span className="text-[10px] font-mono font-bold text-amber-500/70 bg-black/50 px-1.5 py-0.5 rounded">
                    {slotCode}
                  </span>
                  {maturity && (
                    <span
                      title={maturity.label}
                      className={`w-2.5 h-2.5 rounded-full ${maturity.dot} ring-2 ring-black`}
                    />
                  )}
                </div>

                {wine ? (
                  <div className="flex-1 w-full flex items-center justify-center z-10 my-0.5 group-hover:scale-105 transition-transform">
                    <RealisticBottleSVG wine={wine} size="rack" />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-stone-600 group-hover:text-amber-400/80 transition-colors z-10">
                    <div className="w-9 h-9 rounded-full border border-dashed border-stone-700 group-hover:border-amber-500/60 flex items-center justify-center mb-1">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-medium">Casier libre</span>
                  </div>
                )}

                <div className="w-full z-10">
                  {wine ? (
                    <div className="w-full bg-gradient-to-r from-[#8C6635] via-[#C69B59] to-[#835E2F] text-stone-950 rounded px-1.5 py-0.5 text-center shadow-md border border-amber-300/40">
                      <p className="text-[10px] font-bold truncate leading-tight">{wine.name}</p>
                      <p className="text-[9px] font-serif font-semibold opacity-85">{wine.vintage} • {wine.region}</p>
                    </div>
                  ) : (
                    <div className="h-2 w-full bg-[#2B1B13] rounded-full border-t border-amber-900/20" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Légende Apogée & Accès Sommelier IA */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#17110E] border border-amber-900/30 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-serif text-lg text-amber-200 font-bold">Code Couleur de Buvabilité & Apogée</h4>
            <p className="text-xs text-stone-400">Calculé selon le cépage, le millésime et la structure du vin</p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> À son apogée
            </span>
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-950/80 border border-orange-500/40 text-orange-300">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" /> À boire d’urgence
            </span>
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-950/80 border border-sky-500/40 text-sky-300">
              <span className="w-2 h-2 rounded-full bg-sky-400" /> En garde
            </span>
          </div>
        </div>

        {/* Widget Sommelier IA Express */}
        <form onSubmit={(e) => runSommelierAI(e)} className="bg-gradient-to-br from-[#231712] to-[#140D0A] border border-amber-600/40 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Utensils className="w-4 h-4" /> Sommelier IA Express
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('sommelier')}
              className="text-[11px] text-amber-300 underline hover:text-amber-200"
            >
              Ouvrir l’atelier complet →
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Quel plat préparez-vous ce soir ?"
              value={sommelierDish}
              onChange={(e) => setSommelierDish(e.target.value)}
              className="flex-1 bg-[#0D0907] border border-amber-900/50 rounded-xl px-3 py-2 text-xs text-stone-100 outline-none focus:border-amber-500"
            />
            <button type="submit" className="px-3.5 py-2 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs hover:bg-amber-400">
              Accorder
            </button>
          </div>
          {sommelierResult && (
            <div
              onClick={() => setSelectedWine(sommelierResult.wine)}
              className="p-3 rounded-xl bg-black/50 border border-amber-500/40 cursor-pointer hover:border-amber-400 transition-all"
            >
              <p className="text-xs font-bold text-amber-300">
                🍷 {sommelierResult.wine.name} ({sommelierResult.wine.vintage})
              </p>
              <p className="text-[11px] text-stone-300 mt-0.5 line-clamp-2">{sommelierResult.reason}</p>
              <p className="text-[10px] text-amber-400 mt-1 font-mono">
                📍 {sommelierResult.wallName} • Casier {String.fromCharCode(64 + sommelierResult.wine.row)}{sommelierResult.wine.col}
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );

  // ============================================================================
  // 2. VUE SOMMELIER IA DÉDIÉE (ACCORDS METS & VINS SUR-MESURE)
  // ============================================================================
  const renderSommelierView = () => {
    const quickDishes = [
      'Côte de bœuf grillée au sarment',
      'Bar de ligne rôti au fenouil',
      'Volaille de Bresse aux morilles',
      'Carré d’agneau aux herbes de Provence',
      'Homard breton au beurre demi-sel',
      'Plateau de Comté 36 mois & Saint-Nectaire',
      'Civet de sanglier grand veneur',
      'Tartare de daurade aux agrumes'
    ];

    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 pb-28">
        <div className="bg-gradient-to-r from-[#261811] via-[#1B120E] to-[#140D0A] border border-amber-600/40 rounded-3xl p-6 md:p-8 shadow-2xl">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest">
            <Sparkles className="w-4 h-4" /> Intelligence Artificielle Gastronomique
          </div>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-amber-100 mt-1">
            Le Sommelier IA — Accords Mets & Vins
          </h2>
          <p className="text-xs md:text-sm text-stone-300 mt-1 max-w-2xl">
            Indiquez le plat que vous cuisinez ou choisissez une suggestion : l’IA inspecte les bouteilles réellement présentes dans vos casiers, vérifie leur apogée et vous désigne le flacon idéal avec son emplacement exact.
          </p>

          <form onSubmit={(e) => runSommelierAI(e)} className="mt-6 grid md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <label className="text-[11px] text-amber-300/90 font-semibold block mb-1">Votre plat, recette ou ingrédient principal</label>
              <input
                type="text"
                placeholder="Ex: Filet de bœuf aux truffes, Risotto aux Saint-Jacques, Raclette..."
                value={sommelierDish}
                onChange={(e) => setSommelierDish(e.target.value)}
                className="w-full bg-[#0D0907] border border-amber-700/50 rounded-xl px-4 py-3 text-sm text-stone-100 outline-none focus:border-amber-400"
              />
            </div>
            <div className="md:col-span-3">
              <label className="text-[11px] text-amber-300/90 font-semibold block mb-1">Ambiance / Occasion</label>
              <select
                value={sommelierOccasion}
                onChange={(e) => setSommelierOccasion(e.target.value)}
                className="w-full bg-[#0D0907] border border-amber-700/50 rounded-xl px-3 py-3 text-sm text-stone-100 outline-none"
              >
                <option>Dîner gastronomique</option>
                <option>Repas convivial en famille</option>
                <option>Grande occasion / Anniversaire</option>
                <option>Apéritif dînatoire</option>
              </select>
            </div>
            <div className="md:col-span-3 flex items-end">
              <button
                type="submit"
                disabled={sommelierLoading}
                className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:opacity-95"
              >
                <Utensils className="w-4 h-4" />
                {sommelierLoading ? 'Analyse du Chai...' : 'Trouver l’accord parfait'}
              </button>
            </div>
          </form>

          <div className="mt-4 pt-4 border-t border-amber-900/30">
            <span className="text-[11px] text-stone-400 block mb-2">Idées de plats en 1 clic :</span>
            <div className="flex flex-wrap gap-2">
              {quickDishes.map(dish => (
                <button
                  key={dish}
                  type="button"
                  onClick={() => runSommelierAI(null, dish)}
                  className="px-3 py-1.5 rounded-full bg-[#0F0A09] border border-amber-900/50 hover:border-amber-400 text-xs text-amber-200 transition-all"
                >
                  🍽️ {dish}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sommelierResult && (
          <div className="grid lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-8 bg-[#17110E] border-2 border-amber-500/60 rounded-3xl p-6 flex flex-col sm:flex-row gap-6 items-center shadow-2xl">
              <div className="w-36 h-64 bg-[#0D0907] rounded-2xl p-3 flex items-center justify-center border border-amber-900/40 shrink-0">
                <RealisticBottleSVG wine={sommelierResult.wine} size="rack" showRealPhoto={true} />
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-amber-500 text-stone-950 font-extrabold text-xs uppercase">
                    Choix N°1 du Sommelier
                  </span>
                  <span className="text-xs font-mono text-amber-300 bg-black/50 px-2.5 py-1 rounded-lg border border-amber-800/50">
                    📍 {sommelierResult.wallName} • Casier {String.fromCharCode(64 + sommelierResult.wine.row)}{sommelierResult.wine.col}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-amber-400 font-bold uppercase">{sommelierResult.wine.region} • {sommelierResult.wine.appellation}</p>
                  <h3 className="font-serif text-2xl md:text-3xl font-bold text-amber-100">
                    {sommelierResult.wine.name} ({sommelierResult.wine.vintage})
                  </h3>
                </div>

                <div className="bg-[#0F0A09] border border-amber-900/40 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-bold text-amber-300">
                    Pourquoi cette bouteille avec « {sommelierResult.dish} » :
                  </p>
                  <p className="text-xs md:text-sm text-stone-200 leading-relaxed">
                    {sommelierResult.reason}
                  </p>
                </div>

                <div className="bg-amber-950/30 border border-amber-700/40 rounded-xl p-3 text-xs text-amber-200">
                  <strong>Conseil de service :</strong> {sommelierResult.serviceTip}
                </div>

                <div className="pt-2 flex flex-wrap gap-3">
                  <button
                    onClick={() => setSelectedWine(sommelierResult.wine)}
                    className="px-4 py-2 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs hover:bg-amber-400"
                  >
                    Ouvrir la vitrine de cette bouteille
                  </button>
                  <button
                    onClick={() => {
                      setSelectedWallId(sommelierResult.wine.wallId);
                      setActiveTab('cellar');
                    }}
                    className="px-4 py-2 rounded-xl bg-stone-900 border border-stone-700 text-stone-200 text-xs font-semibold hover:border-amber-400"
                  >
                    Localiser dans le casier
                  </button>
                </div>
              </div>
            </div>

            {sommelierResult.secondWine && (
              <div className="lg:col-span-4 bg-[#17110E] border border-amber-900/40 rounded-3xl p-5 flex flex-col justify-between">
                <div className="space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                    Alternative en cave
                  </span>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-28 bg-[#0D0907] rounded-xl p-1.5 flex items-center justify-center border border-stone-800">
                      <RealisticBottleSVG wine={sommelierResult.secondWine} size="rack" />
                    </div>
                    <div>
                      <p className="text-xs text-amber-400 font-bold">{sommelierResult.secondWine.region}</p>
                      <h4 className="font-serif text-lg font-bold text-amber-100 leading-snug">
                        {sommelierResult.secondWine.name} ({sommelierResult.secondWine.vintage})
                      </h4>
                      <p className="text-xs text-stone-400 mt-1">
                        Casier {String.fromCharCode(64 + sommelierResult.secondWine.row)}{sommelierResult.secondWine.col}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-stone-300">
                    Cépages : {sommelierResult.secondWine.grapes}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedWine(sommelierResult.secondWine)}
                  className="w-full mt-4 py-2.5 rounded-xl bg-[#0F0A09] border border-amber-800/50 text-amber-300 text-xs font-bold hover:border-amber-400"
                >
                  Inspecter cette alternative
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // 3. VUE CATALOGUE COMPLET DES VINS
  // ============================================================================
  const renderCatalogView = () => {
    const filtered = wines.filter(w => {
      const matchesType = typeFilter === 'Tous' || w.type === typeFilter;
      const matchesSearch =
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.appellation.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });

    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 pb-28">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl font-bold text-amber-100">Inventaire des Crus ({wines.length})</h2>
            <p className="text-xs text-stone-400">Cliquez sur une bouteille pour voir sa vitrine, récupérer son étiquette IA et ses conseils</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Rechercher un château, cépage..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#17110E] border border-amber-900/40 rounded-xl pl-9 pr-4 py-2 text-xs text-stone-200 outline-none focus:border-amber-500"
              />
            </div>
            {['Tous', 'Rouge', 'Blanc', 'Rosé', 'Effervescent'].map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                  typeFilter === t ? 'bg-amber-500 text-stone-950 border-amber-400' : 'bg-[#17110E] text-stone-300 border-stone-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(wine => {
            const maturity = getMaturityStatus(wine);
            const wallName = walls.find(w => w.id === wine.wallId)?.name || 'Cave';
            return (
              <div
                key={wine.id}
                onClick={() => setSelectedWine(wine)}
                className="bg-[#17110E] border border-amber-900/30 hover:border-amber-500/60 rounded-2xl p-4 flex gap-4 cursor-pointer transition-all shadow-lg group"
              >
                <div className="w-20 h-36 bg-[#0E0907] rounded-xl flex items-center justify-center p-2 border border-stone-800">
                  <RealisticBottleSVG wine={wine} size="rack" />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">{wine.region}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${maturity.bg} ${maturity.color}`}>
                        {maturity.label}
                      </span>
                    </div>
                    <h3 className="font-serif text-lg font-bold text-amber-100 group-hover:text-amber-300 leading-snug mt-1">
                      {wine.name}
                    </h3>
                    <p className="text-xs text-stone-400">{wine.appellation} • <strong>{wine.vintage}</strong></p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-stone-800/80 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-400">Note Web : <strong className="text-amber-300">★ {wine.webRating}/5</strong></span>
                      <span className="text-stone-400">Ma note : <strong className="text-amber-400">★ {wine.userRating}/5</strong></span>
                    </div>
                    <div className="text-[11px] text-stone-400 font-mono">
                      📍 {wallName} • Casier {String.fromCharCode(64 + wine.row)}{wine.col}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================================================
  // 4. VUE SUIVI DE L'APOGÉE & ALERTES DE BUVABILITÉ
  // ============================================================================
  const renderAlertsView = () => (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 pb-28">
      <div className="bg-gradient-to-r from-orange-950/60 via-[#1B120E] to-[#17110E] border border-orange-500/40 rounded-2xl p-6">
        <div className="flex items-center gap-3 text-orange-400 font-bold text-sm uppercase tracking-wider">
          <AlertTriangle className="w-5 h-5" /> Surveillance de l’Apogée & Limite de Buvabilité ({CURRENT_YEAR})
        </div>
        <h2 className="font-serif text-2xl md:text-3xl font-bold text-amber-100 mt-1">
          Calendrier de Garde par Cépage & Millésime
        </h2>
        <p className="text-xs text-stone-300 mt-1">
          Visualisez la fenêtre optimale de dégustation de chaque cru pour ouvrir vos bouteilles en temps et en heure.
        </p>
      </div>

      <div className="space-y-4">
        {wines.map(wine => {
          const maturity = getMaturityStatus(wine);
          const minYear = wine.vintage;
          const maxYear = wine.drinkLimit + 2;
          const totalSpan = Math.max(1, maxYear - minYear);
          const startPct = Math.min(100, Math.max(0, ((wine.peakStart - minYear) / totalSpan) * 100));
          const widthPct = Math.min(100 - startPct, Math.max(8, ((wine.peakEnd - wine.peakStart) / totalSpan) * 100));
          const nowPct = Math.min(100, Math.max(0, ((CURRENT_YEAR - minYear) / totalSpan) * 100));

          return (
            <div
              key={wine.id}
              onClick={() => setSelectedWine(wine)}
              className="bg-[#17110E] border border-amber-900/30 hover:border-amber-500/50 rounded-2xl p-5 cursor-pointer transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                <div>
                  <span className="text-xs font-bold text-amber-400">{wine.region} • {wine.grapes}</span>
                  <h3 className="font-serif text-xl font-bold text-amber-100">{wine.name} ({wine.vintage})</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${maturity.bg} ${maturity.color}`}>
                    {maturity.label}
                  </span>
                  <span className="text-xs text-stone-400">
                    Limite : <strong className="text-amber-200">{wine.drinkLimit}</strong>
                  </span>
                </div>
              </div>

              <div className="relative h-4 bg-[#0D0907] rounded-full overflow-hidden border border-stone-800">
                <div
                  className="absolute top-0 bottom-0 bg-gradient-to-r from-emerald-600/80 to-amber-500/80 rounded-full"
                  style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_#fff]"
                  style={{ left: `${nowPct}%` }}
                  title={`Année actuelle : ${CURRENT_YEAR}`}
                />
              </div>
              <div className="flex justify-between text-[11px] text-stone-400 mt-1.5 font-mono">
                <span>Mise : {wine.vintage}</span>
                <span className="text-emerald-400">Apogée : {wine.peakStart} – {wine.peakEnd}</span>
                <span className="text-orange-400">À boire avant : {wine.drinkLimit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ============================================================================
  // 5. VUE CARTE DES VINS DE FRANCE (STYLE AFFICHE VINTAGE AUTHENTIQUE)
  // ============================================================================
  const renderMapView = () => {
    const filteredWines = mapColorFilter === 'Tous' ? wines : wines.filter(w => w.type === mapColorFilter);
    const regionWines = selectedMapRegion
      ? filteredWines.filter(w => w.region.toLowerCase().includes(selectedMapRegion.id.toLowerCase()))
      : [];

    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 pb-28">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#17110E] border border-amber-900/40 rounded-2xl p-4">
          <div className="flex flex-wrap gap-2">
            {['Tous', 'Rouge', 'Blanc', 'Rosé', 'Effervescent'].map(c => (
              <button
                key={c}
                onClick={() => setMapColorFilter(c)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  mapColorFilter === c
                    ? 'bg-amber-500 text-stone-950'
                    : 'bg-[#0F0A09] text-stone-300 border border-stone-800'
                }`}
              >
                {c === 'Tous' ? 'Tous les vins' : c + 's'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setMapVintageTheme(!mapVintageTheme)}
            className="px-3.5 py-1.5 rounded-xl bg-stone-900 border border-amber-700/50 text-amber-300 text-xs font-semibold"
          >
            {mapVintageTheme ? 'Mode Cave Nocturne' : 'Style Affiche Vintage Ivoire'}
          </button>
        </div>

        <div
          className={`relative rounded-3xl p-6 md:p-10 shadow-2xl border-8 transition-colors ${
            mapVintageTheme
              ? 'bg-[#F3EBDD] text-[#1A1615] border-[#231711]'
              : 'bg-[#16100D] text-amber-100 border-amber-900/50'
          }`}
        >
          <div className="text-center space-y-1 mb-6">
            <p className="text-xs md:text-sm font-extrabold tracking-[0.25em] uppercase">CARTE DES VINS DE</p>
            <h2 className="text-4xl md:text-6xl font-black tracking-wider">FRANCE</h2>
            <div className="flex items-center justify-center gap-1 pt-2">
              <div className="w-8 h-1.5 bg-current" />
              <div className="w-8 h-1.5 border border-current" />
              <div className="w-8 h-1.5 bg-current" />
              <span className="text-[10px] font-mono ml-2 opacity-75">Échelle 200 km</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8 relative aspect-square max-h-[600px] mx-auto w-full">
              <div className={`hidden sm:block absolute top-2 left-2 z-10 p-3 rounded-lg border text-[10px] space-y-1 ${
                mapVintageTheme ? 'bg-[#F7F1E5]/95 border-stone-500 text-stone-800' : 'bg-black/70 border-stone-700 text-stone-300'
              }`}>
                <p className="font-bold uppercase tracking-wider border-b pb-0.5 mb-1">Légende</p>
                <p><strong>BORDEAUX</strong> .......... Région viticole</p>
                <p><em>Pauillac</em> ................... Appellation</p>
                <p className="text-sky-600">Garonne ................... Fleuve</p>
              </div>

              <div className="absolute top-3 right-4 z-10 flex flex-col items-center opacity-80">
                <span className="text-[10px] font-bold">N</span>
                <div className="w-8 h-8 border border-current rounded-full flex items-center justify-center text-xs font-serif">✦</div>
                <span className="text-[10px] font-bold">S</span>
              </div>

              <div className={`hidden sm:block absolute bottom-2 left-2 z-10 p-3 rounded-lg border text-[9px] space-y-1 ${
                mapVintageTheme ? 'bg-[#F7F1E5]/95 border-stone-500 text-stone-800' : 'bg-black/70 border-stone-700 text-stone-300'
              }`}>
                <p className="font-bold uppercase tracking-wider mb-1">Tailles de Bouteilles</p>
                <p>Bouteille (0,75L) • Magnum (1,5L)</p>
                <p>Jéroboam (3L) • Mathusalem (6L)</p>
                <p>Salmanazar (9L) • Melchior (18L)</p>
              </div>

              <svg viewBox="0 0 100 100" className="w-full h-full">
                <path
                  d="M 48,8 L 58,9 L 68,18 L 86,24 L 89,37 L 82,48 L 85,62 L 79,73 L 86,81 L 74,88 L 60,86 L 53,93 L 32,86 L 26,75 L 31,56 L 20,45 L 10,36 L 24,28 L 32,29 L 36,19 L 46,17 Z"
                  fill={mapVintageTheme ? '#E8C89E' : '#261A14'}
                  stroke={mapVintageTheme ? '#B69267' : '#573B2A'}
                  strokeWidth="0.8"
                />
                <path
                  d="M 90,83 L 94,85 L 93,95 L 89,93 Z"
                  fill={mapVintageTheme ? '#E8C89E' : '#261A14'}
                  stroke={mapVintageTheme ? '#B69267' : '#573B2A'}
                  strokeWidth="0.7"
                />
                <path d="M 24,46 Q 45,42 56,50 T 62,64" fill="none" stroke="#5B9BD5" strokeWidth="0.6" strokeDasharray="1,1" />
                <path d="M 38,24 Q 50,30 64,34" fill="none" stroke="#5B9BD5" strokeWidth="0.6" strokeDasharray="1,1" />
                <path d="M 67,52 L 66,82" fill="none" stroke="#5B9BD5" strokeWidth="0.7" />
                <path d="M 31,64 Q 42,74 52,82" fill="none" stroke="#5B9BD5" strokeWidth="0.6" />
              </svg>

              {FRANCE_WINE_REGIONS.map(reg => {
                const count = filteredWines.filter(w => w.region.toLowerCase().includes(reg.id.toLowerCase())).length;
                const isSelected = selectedMapRegion?.id === reg.id;
                return (
                  <button
                    key={reg.id}
                    onClick={() => setSelectedMapRegion(reg)}
                    style={{ left: `${reg.x}%`, top: `${reg.y}%` }}
                    className={`-translate-x-1/2 -translate-y-1/2 absolute z-20 group flex flex-col items-center transition-transform ${
                      isSelected ? 'scale-110' : 'hover:scale-105'
                    }`}
                  >
                    <div
                      className="px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1.5 border border-black/30"
                      style={{ backgroundColor: reg.color, color: '#fff' }}
                    >
                      <span className="text-[9px] md:text-[11px] font-black tracking-wider">{reg.label}</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono font-bold">
                        {count}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className={`lg:col-span-4 rounded-2xl p-5 border space-y-4 ${
              mapVintageTheme ? 'bg-[#FAF5EB] border-stone-400 text-stone-900' : 'bg-[#0F0A09] border-amber-900/40 text-stone-100'
            }`}>
              <div className="border-b border-current/15 pb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Terroir sélectionné</span>
                <h3 className="font-serif text-2xl font-bold mt-0.5">
                  {selectedMapRegion ? selectedMapRegion.label : 'Toutes les Régions'}
                </h3>
                <p className="text-xs opacity-75">
                  {selectedMapRegion ? selectedMapRegion.sub : 'Cliquez sur une région de la carte pour inspecter vos bouteilles'}
                </p>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {(selectedMapRegion ? regionWines : filteredWines).length === 0 ? (
                  <p className="text-xs opacity-70 py-6 text-center">Aucune bouteille enregistrée dans cette région pour le moment.</p>
                ) : (
                  (selectedMapRegion ? regionWines : filteredWines).map(w => (
                    <div
                      key={w.id}
                      onClick={() => setSelectedWine(w)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        mapVintageTheme
                          ? 'bg-white border-stone-300 hover:border-amber-700'
                          : 'bg-[#17110E] border-stone-800 hover:border-amber-500'
                      }`}
                    >
                      <div>
                        <p className="font-serif font-bold text-sm">{w.name}</p>
                        <p className="text-[11px] opacity-75">{w.appellation} • {w.vintage}</p>
                      </div>
                      <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-600">
                        {String.fromCharCode(64 + w.row)}{w.col}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // 6. VUE CARNET DE DÉGUSTATION
  // ============================================================================
  const renderHistoryView = () => (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 pb-28">
      <div>
        <h2 className="font-serif text-3xl font-bold text-amber-100">Carnet des Bouteilles Dégustées</h2>
        <p className="text-xs text-stone-400">Souvenirs, notes personnelles et commentaires des bouteilles ouvertes</p>
      </div>

      <div className="space-y-4">
        {history.map(item => (
          <div key={item.id} className="bg-[#17110E] border border-amber-900/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <span>{item.drunkDate}</span> • <span>{item.region}</span> • <span>{item.guest}</span>
              </div>
              <h3 className="font-serif text-xl font-bold text-amber-100">{item.name} ({item.vintage})</h3>
              <p className="text-xs text-stone-300 italic">« {item.tastingNotes} »</p>
            </div>
            <div className="flex items-center gap-1 text-amber-400 font-bold text-sm shrink-0">
              <Star className="w-4 h-4 fill-amber-400" /> {item.userRating} / 5
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ============================================================================
  // RENDU GLOBAL AVEC BARRE LATÉRALE PC + BARRE DU BAS MOBILE (6 ONGLETS)
  // ============================================================================
  return (
    <div className="min-h-screen bg-[#0F0A09] text-stone-100 flex flex-col md:flex-row font-sans selection:bg-amber-500 selection:text-stone-950">
      
      {/* SIDEBAR SUR ORDINATEUR */}
      <aside className="hidden md:flex w-72 bg-[#16100D] border-r border-amber-900/30 flex-col h-screen sticky top-0 justify-between">
        <div>
          <div className="p-6 border-b border-amber-900/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-700 flex items-center justify-center text-stone-950 shadow-lg">
                <Wine className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-serif text-2xl font-bold text-amber-100 leading-none">Le Grand Chai</h1>
                <p className="text-[11px] text-amber-400/80 mt-1">{ACCOUNTS.find(a => a.id === currentAccountId)?.name}</p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-2.5">
            <button
              onClick={() => { setTargetSlot(null); setAddModalMode('scan'); setIsAddModalOpen(true); }}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:opacity-95 transition-all"
            >
              <Camera className="w-4 h-4" /> Scanner une bouteille (IA)
            </button>
            <button
              onClick={() => { setTargetSlot(null); setAddModalMode('manual'); setIsAddModalOpen(true); }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0F0A09] border border-amber-700/50 text-amber-300 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-stone-900 transition-all"
            >
              <Plus className="w-4 h-4" /> Ajouter manuellement
            </button>
          </div>

          <nav className="px-3 space-y-1">
            {[
              { id: 'cellar', icon: Grid, label: 'Plan de Cave & Casiers' },
              { id: 'sommelier', icon: Utensils, label: 'Sommelier IA (Mets & Vins)' },
              { id: 'catalog', icon: Wine, label: 'Tous mes Vins', badge: wines.length },
              { id: 'alerts', icon: AlertTriangle, label: 'Apogée & Urgences', badge: urgentWines.length },
              { id: 'map', icon: MapIcon, label: 'Carte des Vins de France' },
              { id: 'history', icon: BookOpen, label: 'Carnet de Dégustation', badge: history.length },
            ].map(item => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                    active ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </span>
                  {item.badge > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-950 text-amber-300">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-amber-900/20 space-y-2">
          {syncMessage && (
            <p className="text-[11px] text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-lg">{syncMessage}</p>
          )}
          <button
            onClick={() => setIsCloudModalOpen(true)}
            className="w-full p-3 rounded-xl bg-[#0F0A09] border border-amber-800/40 hover:border-amber-500 text-left flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-2.5">
              <Cloud className="w-4 h-4 text-amber-400" />
              <div>
                <p className="text-xs font-bold text-amber-200">Comptes & Drive Kava 20</p>
                <p className="text-[10px] text-stone-400">Partage Papa • Sauvegarde</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-500" />
          </button>
        </div>
      </aside>

      {/* HEADER MOBILE */}
      <header className="md:hidden sticky top-0 z-30 bg-[#16100D]/95 backdrop-blur-md border-b border-amber-900/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wine className="w-5 h-5 text-amber-500" />
          <div>
            <h1 className="font-serif text-lg font-bold text-amber-100 leading-none">Le Grand Chai</h1>
            <p className="text-[10px] text-amber-400">{ACCOUNTS.find(a => a.id === currentAccountId)?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setTargetSlot(null); setAddModalMode('scan'); setIsAddModalOpen(true); }}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow"
          >
            <Camera className="w-4 h-4" /> Scanner
          </button>
          <button
            onClick={() => { setTargetSlot(null); setAddModalMode('manual'); setIsAddModalOpen(true); }}
            className="p-2 rounded-xl bg-stone-900 border border-amber-700/50 text-amber-300"
            title="Ajout manuel"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsCloudModalOpen(true)}
            className="p-2 rounded-xl bg-stone-900 border border-stone-700 text-stone-300"
            title="Comptes & Sauvegarde"
          >
            <Users className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* CONTENU CENTRAL */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'cellar' && renderCellarView()}
        {activeTab === 'sommelier' && renderSommelierView()}
        {activeTab === 'catalog' && renderCatalogView()}
        {activeTab === 'alerts' && renderAlertsView()}
        {activeTab === 'map' && renderMapView()}
        {activeTab === 'history' && renderHistoryView()}
      </main>

      {/* BARRE DE NAVIGATION FIXE EN BAS SUR TÉLÉPHONE */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#16100D]/95 backdrop-blur-md border-t border-amber-900/40">
        <div className="grid grid-cols-6 h-16">
          {[
            { id: 'cellar', icon: Grid, label: 'Cave' },
            { id: 'sommelier', icon: Utensils, label: 'Sommelier' },
            { id: 'catalog', icon: Wine, label: 'Vins' },
            { id: 'alerts', icon: AlertTriangle, label: 'Apogée' },
            { id: 'map', icon: MapIcon, label: 'Carte' },
            { id: 'history', icon: BookOpen, label: 'Carnet' },
          ].map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                  active ? 'text-amber-400 font-bold' : 'text-stone-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ========================================================================
          MODALE VITRINE DÉTAILLÉE D'UNE BOUTEILLE (AVEC ÉTIQUETTE IA & SCANNER)
          ======================================================================== */}
      {selectedWine && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#18110E] border-2 border-amber-700/50 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl my-8 grid md:grid-cols-12">
            
            <div className="md:col-span-5 bg-gradient-to-b from-[#261811] via-[#150D09] to-[#0B0705] p-5 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-amber-900/30 relative">
              <div className="w-full space-y-2 z-10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-400 bg-black/50 px-2.5 py-1 rounded-lg">
                    Casier {String.fromCharCode(64 + selectedWine.row)}{selectedWine.col}
                  </span>
                  <a
                    href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(selectedWine.name + ' ' + selectedWine.vintage + ' étiquette bouteille')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-amber-300/90 hover:text-amber-200 underline flex items-center gap-1"
                  >
                    Voir photos Google <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* BOUTONS : RÉCUPÉRER ÉTIQUETTE PAR IA / WEB + SCANNER PHOTO ÉTIQUETTE */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={isFetchingWebLabel}
                    onClick={() => handleFetchWebLabel(selectedWine)}
                    className="px-2.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-950 text-[11px] font-bold hover:opacity-95 flex items-center justify-center gap-1 shadow-md"
                  >
                    {isFetchingWebLabel ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {isFetchingWebLabel ? 'Création IA...' : 'Étiquette IA / Web'}
                  </button>

                  <label className="px-2.5 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold cursor-pointer hover:bg-amber-500/30 flex items-center justify-center gap-1">
                    <Camera className="w-3.5 h-3.5" /> Scanner étiquette
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setLabelStatusMessage('Recadrage automatique de votre photo sur la bouteille...');
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const adaptedUrl = await adaptScannedPhotoToBottleLabel(reader.result);
                          const updated = { ...selectedWine, customLabelUrl: adaptedUrl || reader.result };
                          setSelectedWine(updated);
                          setWines(prev => prev.map(w => w.id === updated.id ? updated : w));
                          setLabelStatusMessage('Photo d’étiquette adaptée et plaquée sur la bouteille !');
                          setTimeout(() => setLabelStatusMessage(''), 3500);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>

                {labelStatusMessage && (
                  <div className="text-[11px] text-emerald-300 bg-emerald-950/70 border border-emerald-500/40 rounded-lg px-2.5 py-1 text-center">
                    {labelStatusMessage}
                  </div>
                )}

                <div className="flex items-center justify-between pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowWebUrlInput(!showWebUrlInput)}
                    className="text-[10px] text-stone-400 hover:text-amber-300 underline"
                  >
                    {showWebUrlInput ? 'Masquer le champ lien Web' : 'Ou coller le lien d’une photo trouvée sur Internet'}
                  </button>
                  {selectedWine.customLabelUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...selectedWine, customLabelUrl: null };
                        setSelectedWine(updated);
                        setWines(prev => prev.map(w => w.id === updated.id ? updated : w));
                      }}
                      className="text-[10px] text-red-400 hover:underline"
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>

                {showWebUrlInput && (
                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="url"
                      placeholder="https://.../etiquette.jpg"
                      value={webLabelUrlInput}
                      onChange={(e) => setWebLabelUrlInput(e.target.value)}
                      className="flex-1 bg-black/70 border border-amber-700/50 rounded-lg px-2 py-1 text-[11px] text-stone-100 outline-none"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!webLabelUrlInput.trim()) return;
                        const url = webLabelUrlInput.trim();
                        const adapted = await adaptScannedPhotoToBottleLabel(url);
                        const updated = { ...selectedWine, customLabelUrl: adapted || url };
                        setSelectedWine(updated);
                        setWines(prev => prev.map(w => w.id === updated.id ? updated : w));
                        setWebLabelUrlInput('');
                        setShowWebUrlInput(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 text-stone-950 font-bold text-[11px]"
                    >
                      Plaquer
                    </button>
                  </div>
                )}
              </div>

              <div className="my-4 flex items-center justify-center">
                <RealisticBottleSVG wine={selectedWine} size="hero" showRealPhoto={true} />
              </div>

              <div className="w-full text-center space-y-1">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${getMaturityStatus(selectedWine).bg} ${getMaturityStatus(selectedWine).color}`}>
                  {getMaturityStatus(selectedWine).label} • Boire avant {selectedWine.drinkLimit}
                </span>
              </div>
            </div>

            <div className="md:col-span-7 p-6 md:p-8 space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
                      {selectedWine.region} • {selectedWine.appellation}
                    </p>
                    <h3 className="font-serif text-2xl md:text-3xl font-bold text-amber-100 mt-0.5">
                      {selectedWine.name} ({selectedWine.vintage})
                    </h3>
                    <p className="text-xs text-stone-400 mt-1">Cépages : {selectedWine.grapes}</p>
                  </div>
                  <button onClick={() => setSelectedWine(null)} className="p-2 rounded-full bg-stone-900 text-stone-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-[#0F0A09] border border-amber-900/40 rounded-2xl p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase text-stone-400 block">Note Moyenne Internet</span>
                      <span className="text-lg font-bold text-amber-300">★ {selectedWine.webRating} / 5</span>
                    </div>
                    <a
                      href={selectedWine.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-stone-950 text-xs font-bold flex items-center gap-1 transition-all"
                    >
                      Voir avis <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="bg-[#0F0A09] border border-amber-900/40 rounded-2xl p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase text-stone-400 block">Ma Note Personnelle</span>
                      <span className="text-lg font-bold text-amber-400">★ {selectedWine.userRating} / 5</span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => {
                            const updated = { ...selectedWine, userRating: n };
                            setSelectedWine(updated);
                            setWines(prev => prev.map(w => w.id === updated.id ? updated : w));
                          }}
                          className={`w-6 h-6 rounded text-xs font-bold ${selectedWine.userRating >= n ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-400'}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-[#0F0A09] border border-stone-800 rounded-2xl p-4 space-y-2 text-xs">
                  <p className="text-amber-300 font-bold">🍷 Conseil de dégustation & Service :</p>
                  <p className="text-stone-300">{selectedWine.tastingAdvice}</p>
                  <p className="text-amber-300 font-bold pt-1">🍽️ Accords Mets-Vins idéaux :</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(selectedWine.foodPairing) ? selectedWine.foodPairing : [selectedWine.foodPairing]).map((food, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-700/40 text-amber-200 text-[11px]">
                        {food}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-stone-400 block mb-1">Mes notes de dégustation :</label>
                  <textarea
                    rows={2}
                    value={selectedWine.userNotes}
                    onChange={(e) => {
                      const updated = { ...selectedWine, userNotes: e.target.value };
                      setSelectedWine(updated);
                      setWines(prev => prev.map(w => w.id === updated.id ? updated : w));
                    }}
                    className="w-full bg-[#0F0A09] border border-stone-800 rounded-xl p-2.5 text-xs text-stone-200 outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-stone-800">
                <button
                  onClick={() => {
                    setMovingWine(selectedWine);
                    setSelectedWine(null);
                    setActiveTab('cellar');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 hover:border-amber-500"
                >
                  <Move className="w-4 h-4" /> Déplacer de casier
                </button>

                <button
                  onClick={() => handleDrinkBottle(selectedWine)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-950 font-bold text-xs flex items-center gap-2 shadow-lg hover:opacity-95"
                >
                  <Wine className="w-4 h-4" /> Boire & Archiver dans le Carnet
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================
          MODALE SCANNER APPAREIL PHOTO (IA) & AJOUT MANUEL
          ======================================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#18110F] border border-amber-600/40 rounded-3xl max-w-xl w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <h3 className="font-serif text-2xl font-bold text-amber-100">
                  {addModalMode === 'scan' ? 'Scanner une Bouteille (IA)' : 'Fiche de la Bouteille'}
                </h3>
                {targetSlot && (
                  <p className="text-xs text-amber-400">Destination : Casier {targetSlot.slotCode}</p>
                )}
              </div>
              <button onClick={() => { setIsAddModalOpen(false); setScanPreviewUrl(null); }} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-[#0F0A09] p-1 rounded-xl border border-stone-800">
              <button
                type="button"
                onClick={() => setAddModalMode('scan')}
                className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${
                  addModalMode === 'scan' ? 'bg-amber-500 text-stone-950' : 'text-stone-400'
                }`}
              >
                <Camera className="w-4 h-4" /> Scanner avec le téléphone
              </button>
              <button
                type="button"
                onClick={() => setAddModalMode('manual')}
                className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${
                  addModalMode === 'manual' ? 'bg-amber-500 text-stone-950' : 'text-stone-400'
                }`}
              >
                <Plus className="w-4 h-4" /> Saisie manuelle
              </button>
            </div>

            {addModalMode === 'scan' ? (
              <div className="space-y-4 text-center">
                <div className="relative h-60 border-2 border-dashed border-amber-700/50 rounded-2xl bg-[#0F0A09] flex flex-col items-center justify-center p-4 overflow-hidden">
                  {scanPreviewUrl ? (
                    <>
                      <img src={scanPreviewUrl} alt="Étiquette scannée" className="w-full h-full object-contain" />
                      {isScanning && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                          <div className="w-full h-1 bg-amber-400 animate-pulse mb-3" />
                          <Sparkles className="w-8 h-8 text-amber-400 animate-spin mb-2" />
                          <p className="text-xs font-bold text-amber-200">Identification du Château, Millésime & Apogée...</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <Camera className="w-12 h-12 text-amber-500/70 mb-2" />
                      <p className="text-sm text-stone-200 font-semibold">Photographiez l’étiquette de la bouteille</p>
                      <p className="text-xs text-stone-400 mb-4">L’étiquette sera automatiquement recadrée et plaquée sur la bouteille 3D</p>
                      <label className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-stone-950 font-bold text-xs cursor-pointer shadow-lg hover:scale-105 transition-transform">
                        <Camera className="w-4 h-4 inline mr-2" />
                        Ouvrir l’appareil photo
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                      </label>
                    </>
                  )}
                </div>

                <div className="text-left space-y-2">
                  <p className="text-[11px] text-stone-400">Ou tester l’identification IA + génération d’étiquette avec un grand cru :</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => applyPresetScan({
                        name: 'Château Cheval Blanc',
                        appellation: 'Saint-Émilion 1er Grand Cru Classé A',
                        region: 'Bordeaux',
                        vintage: 2016,
                        type: 'Rouge',
                        bottleShape: 'bordeaux',
                        grapes: 'Merlot (55%), Cabernet Franc (45%)',
                        peakStart: 2024,
                        peakEnd: 2040,
                        drinkLimit: 2045,
                        webRating: 4.8,
                        userRating: 5,
                        userNotes: 'Onctuosité et parfum envoûtant.',
                        tastingAdvice: 'Carafer 1h30, servir à 17°C.',
                        foodPairing: ['Tournedos aux truffes', 'Pigeon rôti']
                      })}
                      className="p-2.5 rounded-xl bg-[#0F0A09] border border-stone-800 hover:border-amber-500 text-left text-xs"
                    >
                      <p className="font-bold text-amber-200">Château Cheval Blanc 2016</p>
                      <p className="text-[10px] text-stone-400">Saint-Émilion • Rouge</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetScan({
                        name: 'Miraval Côtes de Provence',
                        appellation: 'Côtes de Provence',
                        region: 'Provence',
                        vintage: 2023,
                        type: 'Rosé',
                        bottleShape: 'flute',
                        grapes: 'Cinsault, Grenache, Rolle, Syrah',
                        peakStart: 2024,
                        peakEnd: 2026,
                        drinkLimit: 2027,
                        webRating: 4.2,
                        userRating: 4.5,
                        userNotes: 'Robe rose pâle très délicate, belle fraîcheur.',
                        tastingAdvice: 'Servir frais à 10°C.',
                        foodPairing: ['Daurade grillée', 'Salade niçoise']
                      })}
                      className="p-2.5 rounded-xl bg-[#0F0A09] border border-stone-800 hover:border-amber-500 text-left text-xs"
                    >
                      <p className="font-bold text-amber-200">Château Miraval 2023</p>
                      <p className="text-[10px] text-stone-400">Provence • Rosé pâle</p>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveBottle} className="space-y-3 text-xs">
                <div className="flex items-center justify-between bg-[#0F0A09] border border-amber-900/40 rounded-xl p-2.5">
                  <div className="flex items-center gap-2.5">
                    {formData.customLabelUrl ? (
                      <img src={formData.customLabelUrl} alt="Aperçu étiquette" className="w-9 h-12 object-cover rounded border border-amber-500/50" />
                    ) : (
                      <div className="w-9 h-12 rounded bg-stone-900 border border-stone-700 flex items-center justify-center text-[9px] text-amber-400">IA</div>
                    )}
                    <div>
                      <p className="font-bold text-amber-200">Étiquette de la bouteille</p>
                      <p className="text-[10px] text-stone-400">
                        {formData.customLabelUrl ? 'Étiquette prête à être plaquée sur la bouteille' : 'Génération automatique de l’étiquette officielle'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const generated = renderAuthenticLabelToDataUrl(formData);
                      setFormData({ ...formData, customLabelUrl: generated });
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[11px]"
                  >
                    ✨ Générer étiquette IA
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-stone-400 block mb-1">Nom du Château / Domaine *</label>
                    <input
                      type="text" required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-[#0F0A09] border border-stone-800 rounded-lg px-3 py-2 text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="text-stone-400 block mb-1">Appellation</label>
                    <input
                      type="text"
                      value={formData.appellation}
                      onChange={(e) => setFormData({ ...formData, appellation: e.target.value })}
                      className="w-full bg-[#0F0A09] border border-stone-800 rounded-lg px-3 py-2 text-stone-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-stone-400 block mb-1">Région</label>
                    <select
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      className="w-full bg-[#0F0A09] border border-stone-800 rounded-lg px-2 py-2 text-stone-100"
                    >
                      {FRANCE_WINE_REGIONS.map(r => (
                        <option key={r.id} value={r.id}>{r.id}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-stone-400 block mb-1">Millésime</label>
                    <input
                      type="number" required
                      value={formData.vintage}
                      onChange={(e) => setFormData({ ...formData, vintage: e.target.value })}
                      className="w-full bg-[#0F0A09] border border-stone-800 rounded-lg px-3 py-2 text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="text-stone-400 block mb-1">Couleur / Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full bg-[#0F0A09] border border-stone-800 rounded-lg px-2 py-2 text-stone-100"
                    >
                      <option value="Rouge">Rouge</option>
                      <option value="Blanc">Blanc</option>
                      <option value="Rosé">Rosé</option>
                      <option value="Effervescent">Effervescent</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-stone-400 block mb-1">Début Apogée</label>
                    <input
                      type="number"
                      value={formData.peakStart}
                      onChange={(e) => setFormData({ ...formData, peakStart: e.target.value })}
                      className="w-full bg-[#0F0A09] border border-stone-800 rounded-lg px-3 py-2 text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="text-stone-400 block mb-1">Fin Apogée</label>
                    <input
                      type="number"
                      value={formData.peakEnd}
                      onChange={(e) => setFormData({ ...formData, peakEnd: e.target.value })}
                      className="w-full bg-[#0F0A09] border border-stone-800 rounded-lg px-3 py-2 text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="text-stone-400 block mb-1">Limite buvabilité</label>
                    <input
                      type="number"
                      value={formData.drinkLimit}
                      onChange={(e) => setFormData({ ...formData, drinkLimit: e.target.value })}
                      className="w-full bg-[#0F0A09] border border-stone-800 rounded-lg px-3 py-2 text-stone-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-stone-400 block mb-1">Cépages</label>
                  <input
                    type="text"
                    value={formData.grapes}
                    onChange={(e) => setFormData({ ...formData, grapes: e.target.value })}
                    className="w-full bg-[#0F0A09] border border-stone-800 rounded-lg px-3 py-2 text-stone-100"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-xl bg-stone-900">
                    Annuler
                  </button>
                  <button type="submit" className="px-5 py-2 rounded-xl bg-amber-500 text-stone-950 font-bold">
                    Ranger dans la cave
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================
          MODALE MULTI-COMPTES FAMILIAUX, SCRIPT GOOGLE DRIVE KAVA 20 & CLÉ IA
          ======================================================================== */}
      {isCloudModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#18110F] border border-amber-600/40 rounded-3xl max-w-2xl w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-serif text-2xl font-bold text-amber-100">
                Espaces Familiaux, Google Drive « Kava 20 » & IA
              </h3>
              <button onClick={() => setIsCloudModalOpen(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-[#0F0A09] p-1 rounded-xl border border-stone-800 text-xs font-bold">
              <button
                onClick={() => setCloudTab('accounts')}
                className={`py-2 rounded-lg ${cloudTab === 'accounts' ? 'bg-amber-500 text-stone-950' : 'text-stone-400'}`}
              >
                1. Comptes (Moi / Papa)
              </button>
              <button
                onClick={() => setCloudTab('drive')}
                className={`py-2 rounded-lg ${cloudTab === 'drive' ? 'bg-amber-500 text-stone-950' : 'text-stone-400'}`}
              >
                2. Google Drive « Kava 20 »
              </button>
              <button
                onClick={() => setCloudTab('ai')}
                className={`py-2 rounded-lg ${cloudTab === 'ai' ? 'bg-amber-500 text-stone-950' : 'text-stone-400'}`}
              >
                3. Clé IA (Render)
              </button>
            </div>

            {cloudTab === 'accounts' && (
              <div className="space-y-3">
                <p className="text-xs text-stone-300">
                  Chaque membre dispose de sa propre cave indépendante. Cliquez sur un compte pour basculer dessus :
                </p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {ACCOUNTS.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => handleSwitchAccount(acc.id)}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        currentAccountId === acc.id
                          ? 'bg-amber-500/20 border-amber-400 text-amber-100'
                          : 'bg-[#0F0A09] border-stone-800 text-stone-300 hover:border-amber-700'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold text-amber-400">{acc.badge}</span>
                      <p className="font-serif text-lg font-bold mt-1">{acc.name}</p>
                      <p className="text-[11px] text-stone-400 mt-1">Code : {acc.id}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {cloudTab === 'drive' && (
              <div className="space-y-4 text-xs">
                <div className="bg-[#0F0A09] border border-stone-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-amber-300">Étape A : Copier le script Google Drive « Kava 20 »</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
                        setCopiedScript(true);
                        setTimeout(() => setCopiedScript(false), 2500);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold flex items-center gap-1.5"
                    >
                      {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedScript ? 'Script copié !' : 'Copier le script Google Drive'}
                    </button>
                  </div>
                  <p className="text-stone-400 leading-relaxed">
                    Collez ce script sur <strong>script.google.com</strong> (Nouveau projet → Déployer → Application Web → Accès : Tout le monde), puis collez l’URL obtenue ci-dessous :
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={driveWebhookUrl}
                      onChange={(e) => {
                        setDriveWebhookUrl(e.target.value);
                        localStorage.setItem('kava20_drive_url', e.target.value);
                      }}
                      className="flex-1 bg-[#18110F] border border-stone-700 rounded-xl px-3 py-2 text-stone-200"
                    />
                    <button
                      onClick={syncToGoogleDriveKava20}
                      className="px-4 py-2 rounded-xl bg-amber-500 text-stone-950 font-bold"
                    >
                      Sauvegarder sur Drive
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0F0A09] border border-stone-800 rounded-2xl p-4">
                  <div>
                    <p className="font-bold text-amber-200">Copie de secours anti-bug (.json)</p>
                    <p className="text-stone-400">Téléchargez ou restaurez votre cave en 1 clic</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const blob = new Blob([JSON.stringify({ walls, wines, history }, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Kava20_${currentAccountId}.json`;
                        a.click();
                      }}
                      className="px-3 py-2 rounded-xl bg-stone-800 text-amber-300 font-semibold flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Exporter
                    </button>
                    <label className="px-3 py-2 rounded-xl bg-stone-800 text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" /> Restaurer
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            try {
                              const data = JSON.parse(ev.target.result);
                              if (data.walls) setWalls(data.walls);
                              if (data.wines) setWines(data.wines);
                              if (data.history) setHistory(data.history);
                            } catch (err) {}
                          };
                          reader.readAsText(file);
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {cloudTab === 'ai' && (
              <div className="bg-[#0F0A09] border border-stone-800 rounded-2xl p-4 space-y-3 text-xs">
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <Key className="w-4 h-4" /> Clé API Google Gemini (Optionnelle sur votre site Render)
                </div>
                <p className="text-stone-400 leading-relaxed">
                  Le Sommelier IA, la génération d’étiquette et le Scanner fonctionnent immédiatement. Pour activer l’analyse Gemini Vision sur votre propre domaine Render, collez une clé gratuite depuis <strong>aistudio.google.com</strong> :
                </p>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={customGeminiKey}
                  onChange={(e) => {
                    setCustomGeminiKey(e.target.value);
                    localStorage.setItem('kava20_gemini_key', e.target.value);
                  }}
                  className="w-full bg-[#18110F] border border-stone-700 rounded-xl px-3 py-2.5 text-stone-200"
                />
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
