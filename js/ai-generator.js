// Module Générateur Musical par IA
// Supporte Google Gemini API (clé gratuite stockée localement dans le navigateur)
// Supporte également le fallback IA public gratuit sans clé pour jouer entre amis

export const GEMINI_STORAGE_KEY = 'blindtest_gemini_api_key';

export function getGeminiApiKey() {
  return (localStorage.getItem(GEMINI_STORAGE_KEY) || '').trim();
}

export function setGeminiApiKey(key) {
  if (!key) {
    localStorage.removeItem(GEMINI_STORAGE_KEY);
  } else {
    localStorage.setItem(GEMINI_STORAGE_KEY, key.trim());
  }
}

export const GEMINI_MODELS = [
  'gemini-3.5-flash-lite'
];

// Test rapide de la clé Gemini
export async function testGeminiApiKey(key) {
  const cleanKey = (key || '').trim();
  if (!cleanKey) {
    return { success: false, message: 'Veuillez saisir une clé API.' };
  }

  const testPrompt = 'Retourne uniquement ce JSON strict : {"tracks":[{"title":"Test","artist":"Test"}]}';
  let lastError = 'Impossible de contacter Google Gemini.';

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: testPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 200
          }
        })
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          return { success: true, message: `Connexion à Google Gemini réussie (${model}) ! 🚀` };
        }
      } else {
        const errJson = await response.json().catch(() => null);
        const errMsg = errJson?.error?.message || `Erreur HTTP ${response.status}`;
        lastError = `Clé invalide : ${errMsg}`;
        // Si la clé API elle-même est rejetée (invalide), pas la peine d'essayer les autres modèles
        if (errMsg.toLowerCase().includes('api key not valid') || errMsg.toLowerCase().includes('api_key_invalid')) {
          return { success: false, message: lastError };
        }
        // Sinon (ex: modèle retiré/indisponible), on tente le modèle suivant
      }
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = `Échec de connexion : ${err.name === 'AbortError' ? 'Délai d\'attente dépassé' : err.message}`;
    }
  }

  return { success: false, message: lastError };
}

// Nettoyage et normalisation d'une liste de pistes
function sanitizeTrackItems(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(item => item && (item.title || item.titre || item.track) && (item.artist || item.artiste || item.author || item.singer))
    .map(item => ({
      title: String(item.title || item.titre || item.track).trim(),
      artist: String(item.artist || item.artiste || item.author || item.singer).trim(),
      movie: item.movie || item.film || item.serie || item.show || null
    }))
    .filter(item => item.title.length > 1 && item.artist.length > 1);
}

// Extraction et nettoyage des pistes et leurres JSON
function parseAiResponse(rawText) {
  if (!rawText || rawText.trim().length === 0) return null;

  let cleaned = rawText.trim();
  if (cleaned.includes('```')) {
    cleaned = cleaned.replace(/```(?:json)?([\s\S]*?)```/g, '$1').trim();
  }

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch {
        // Essai avec crochet pour tableau direct
        const firstBracket = cleaned.indexOf('[');
        const lastBracket = cleaned.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          try {
            parsed = JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
          } catch (e) {
            console.warn('Échec parsing JSON partiel:', e);
          }
        }
      }
    }
  }

  if (!parsed) return null;

  let tracks = [];
  let decoys = [];

  if (Array.isArray(parsed)) {
    tracks = sanitizeTrackItems(parsed);
  } else if (typeof parsed === 'object') {
    const rawTracks = parsed.tracks || parsed.chansons || parsed.morceaux || parsed.songs || [];
    const rawDecoys = parsed.decoys || parsed.leurres || parsed.fausses_reponses || parsed.fakes || [];

    tracks = sanitizeTrackItems(Array.isArray(rawTracks) ? rawTracks : []);
    decoys = sanitizeTrackItems(Array.isArray(rawDecoys) ? rawDecoys : []);

    // Si tracks est vide mais qu'un autre tableau existe
    if (tracks.length === 0) {
      const foundArray = Object.values(parsed).find(Array.isArray);
      if (foundArray) tracks = sanitizeTrackItems(foundArray);
    }
  }

  return (tracks.length > 0) ? { tracks, decoys } : null;
}

// Appel direct à Google Gemini REST API
async function fetchFromGemini(apiKey, prompt) {
  for (const model of GEMINI_MODELS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.85
          }
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Gemini (${model}) a retourné le statut HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const result = parseAiResponse(rawText);
      if (result && result.tracks.length > 0) {
        return result;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`Erreur appel Gemini (${model}):`, err.name === 'AbortError' ? 'Timeout 9s' : err.message);
    }
  }

  return null;
}

// Fallback gratuit sans clé (utilise le service public Pollinations avec timeout de 8s)
async function fetchFromFreeService(prompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://text.pollinations.ai/${encodedPrompt}?json=true&seed=${Math.floor(Math.random() * 1000000)}`;

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json, text/plain, */*' }
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const rawText = await response.text();
    return parseAiResponse(rawText);
  } catch (err) {
    clearTimeout(timeoutId);
    console.info('Service IA gratuit public indisponible ou lent (timeout 8s) :', err.message);
    return null;
  }
}

// Fonction principale exportée : Génération des morceaux ET des leurres ciblés
export async function generateTracksFromAI(themeDescription, count = 10) {
  const prompt = `Tu es un programmateur musical d'exception pour un jeu de blind test en soirée.
Génère une sélection de qualité pour le thème : "${themeDescription}".

Consignes :
1. "tracks" : Exactement ${count} morceaux cultes, immédiatement identifiables, emblématiques du thème (titre et artiste). Si c'est un animé, film ou série, indique le nom dans "movie".
2. "decoys" : 20 autres morceaux ou artistes très connus du MÊME univers/genre musical pour servir de fausses réponses crédibles (leurres de QCM).
3. Qualité sonore : Choisis UNIQUEMENT des morceaux connus dans leur version studio originale culte (jamais de versions live, acoustiques, reprises obscures ou remixes).
Format strict JSON uniquement, sans aucun texte autour :
{
  "tracks": [
    {"title": "Titre du morceau", "artist": "Nom de l'artiste", "movie": "Nom film/série si applicable"}
  ],
  "decoys": [
    {"title": "Faux titre crédible", "artist": "Artiste du même style", "movie": "Nom film/série si applicable"}
  ]
}`;

  // 1. Priorité à la clé Google Gemini si renseignée dans les réglages
  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    const geminiResult = await fetchFromGemini(geminiKey, prompt);
    if (geminiResult && geminiResult.tracks.length > 0) {
      return geminiResult;
    }
  }

  // 2. Service public sans clé (Pollinations)
  const freeResult = await fetchFromFreeService(prompt);
  if (freeResult && freeResult.tracks.length > 0) {
    return freeResult;
  }

  return null;
}
