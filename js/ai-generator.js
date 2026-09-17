// Module Générateur Musical par IA
// Supporte Google Gemini API (clé stockée localement dans le navigateur, jamais dans Git)
// Supporte également un proxy Cloudflare Worker ou le fallback gratuit à timeout court

export const GEMINI_STORAGE_KEY = 'blindtest_gemini_api_key';
export const PROXY_STORAGE_KEY = 'blindtest_ai_proxy_url';

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

export function getCustomProxyUrl() {
  return (localStorage.getItem(PROXY_STORAGE_KEY) || '').trim();
}

export function setCustomProxyUrl(url) {
  if (!url) {
    localStorage.removeItem(PROXY_STORAGE_KEY);
  } else {
    localStorage.setItem(PROXY_STORAGE_KEY, url.trim().replace(/\/+$/, ''));
  }
}

// Test rapide de la clé Gemini
export async function testGeminiApiKey(key) {
  const cleanKey = (key || '').trim();
  if (!cleanKey) {
    return { success: false, message: 'Veuillez saisir une clé API.' };
  }

  const testPrompt = 'Retourne uniquement ce JSON strict : [{"title":"Test","artist":"Test"}]';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(cleanKey)}`;

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

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      const errMsg = errJson?.error?.message || `Erreur HTTP ${response.status}`;
      return { success: false, message: `Clé invalide : ${errMsg}` };
    }

    const data = await response.json();
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return { success: true, message: 'Connexion à Google Gemini réussie ! 🚀' };
    }

    return { success: false, message: 'Réponse inattendue de Gemini.' };
  } catch (err) {
    clearTimeout(timeoutId);
    return { success: false, message: `Échec de connexion : ${err.name === 'AbortError' ? 'Délai d\'attente dépassé' : err.message}` };
  }
}

// Appel direct à Google Gemini REST API
async function fetchFromGemini(apiKey, prompt, count) {
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];

  for (const model of models) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

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

      const tracks = parseJsonTrackList(rawText);
      if (tracks && tracks.length > 0) {
        return tracks;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`Erreur appel Gemini (${model}):`, err.name === 'AbortError' ? 'Timeout 8s' : err.message);
    }
  }

  return null;
}

// Appel via proxy personnalisé (Cloudflare Worker)
async function fetchFromProxy(proxyUrl, prompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(proxyUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const rawText = await response.text();
    return parseJsonTrackList(rawText);
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Erreur appel proxy IA:', err);
    return null;
  }
}

// Fallback gratuit sans clé (timeout court de 4s pour ne jamais bloquer l'utilisateur)
async function fetchFromFreeService(prompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

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
    return parseJsonTrackList(rawText);
  } catch (err) {
    clearTimeout(timeoutId);
    console.info('Service IA gratuit non disponible ou trop lent (timeout 4s) :', err.message);
    return null;
  }
}

// Extraction et nettoyage des pistes JSON
function parseJsonTrackList(rawText) {
  if (!rawText || rawText.trim().length === 0) return null;

  let cleaned = rawText.trim();
  if (cleaned.includes('```')) {
    cleaned = cleaned.replace(/```(?:json)?([\s\S]*?)```/g, '$1').trim();
  }

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
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

  let rawList = [];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const foundArray = Object.values(parsed).find(Array.isArray);
    if (foundArray) rawList = foundArray;
  }

  if (!rawList || rawList.length === 0) return null;

  const validTracks = rawList
    .filter(item => item && (item.title || item.titre || item.track) && (item.artist || item.artiste || item.author || item.singer))
    .map(item => ({
      title: String(item.title || item.titre || item.track).trim(),
      artist: String(item.artist || item.artiste || item.author || item.singer).trim(),
      movie: item.movie || item.film || item.serie || item.show || null
    }))
    .filter(item => item.title.length > 1 && item.artist.length > 1);

  return validTracks.length > 0 ? validTracks : null;
}

// Fonction principale exportée
export async function generateTracksFromAI(themeDescription, count = 10) {
  const prompt = `Tu es un programmateur musical d'exception pour un jeu de blind test.
Génère une sélection de ${count} morceaux variés, populaires et immédiatement identifiables pour le thème suivant : "${themeDescription}".
Règles impératives :
- Chansons marquantes, cultes ou emblématiques du style/thème, avec un bon mix d'époques et de styles.
- Si le thème concerne des films, séries, animés ou Disney, inclus si possible le nom du film ou série associé ("movie").
- Format strict JSON uniquement, aucun blabla :
[{"title": "Nom du morceau", "artist": "Nom de l'artiste", "movie": "Nom du film ou série si applicable"}]`;

  // 1. Priorité à la clé Google Gemini si renseignée dans les réglages
  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    const geminiTracks = await fetchFromGemini(geminiKey, prompt, count);
    if (geminiTracks && geminiTracks.length > 0) {
      return geminiTracks;
    }
  }

  // 2. Proxy personnalisé si configuré (Cloudflare Worker)
  const proxyUrl = getCustomProxyUrl();
  if (proxyUrl) {
    const proxyTracks = await fetchFromProxy(proxyUrl, prompt);
    if (proxyTracks && proxyTracks.length > 0) {
      return proxyTracks;
    }
  }

  // 3. Fallback gratuit avec timeout court (4s maximum)
  const freeTracks = await fetchFromFreeService(prompt);
  if (freeTracks && freeTracks.length > 0) {
    return freeTracks;
  }

  return null;
}
