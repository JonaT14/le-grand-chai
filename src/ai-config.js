// Adresse publique du service IA. La clé Google est uniquement côté Apps Script.
// Une valeur vide explicite permet de tester le mode historique sans service.
export const AI_PROXY_URL = import.meta.env?.VITE_AI_PROXY_URL ?? 'https://script.google.com/macros/s/AKfycbxTlaoJ4D3t83mpdpoIYwA7KrVZhs1L7YhX_a62QlSEnCNhDpPy4p6POcoI_kwzkugL/exec';
