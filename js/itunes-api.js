// Gestionnaire de l'API iTunes Search (CORS natif, previews 30s et pochettes HD)
import { generateTracksFromAI, getGeminiApiKey, getCustomProxyUrl } from './ai-generator.js';

const cache = new Map();

// Nettoyage des titres (retirer les mentions parasites, génériques de film et rééditions)
export function cleanTitle(rawTitle) {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/\s*\(.*?(remaster|version|edit|live|deluxe|bonus|anniversary|ost|soundtrack|feat|explicit|bande originale|b\.o\.|de "|from "|du film).*?\)/gi, '')
    .replace(/\s*\[.*?(remaster|version|edit|live|deluxe|bonus|anniversary|ost|soundtrack|feat|explicit|bande originale|b\.o\.|de "|from "|du film).*?\]/gi, '')
    .replace(/\s*-\s*(remaster|live|radio edit|deluxe|single version|bande originale|b\.o\.|from ).*/gi, '')
    .trim();
}

// Extraction du nom de film, série ou animé
export function extractMovieName(rawTitle, collectionName) {
  // 1. Chercher dans les parenthèses ou guillemets du titre
  if (rawTitle) {
    const fromMatch = rawTitle.match(/(?:from|de|du film)\s+["'«]([^"'»]+)["'»]/i);
    if (fromMatch && fromMatch[1]) {
      return fromMatch[1].trim();
    }
    const simpleMatch = rawTitle.match(/\((?:de|from|du film)\s+([^)]+)\)/i);
    if (simpleMatch && simpleMatch[1]) {
      return simpleMatch[1].replace(/bande originale.*|soundtrack.*|original soundtrack.*/i, '').trim();
    }
  }

  // 2. Chercher dans le nom de l'album (collectionName)
  if (collectionName) {
    let cleaned = collectionName
      .replace(/\s*\(.*?(bande originale|b\.o\.|soundtrack|ost|edition|version|de\s+la|du\s+film).*?\)/gi, '')
      .replace(/\s*\[.*?\]/gi, '')
      .replace(/\s*-\s*(bande originale|soundtrack|ost|original score).*/gi, '')
      .replace(/:\s*(original soundtrack|soundtrack|bande originale).*/gi, '')
      .trim();
    if (cleaned.length >= 2 && !/greatest hits|best of|anthology|compilation/i.test(cleaned)) {
      return cleaned;
    }
  }

  return null;
}

// Extraction de la clé canonique pour comparaison stricte et anti-doublons
export function canonicalKey(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(de|la|le|les|un|une|des|du|en|et|a|the|an|in|on|at|of|and|to)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Vérifie si deux titres désignent le même morceau (doublon, traduction ou reprise)
export function areTitlesEquivalent(titleA, titleB) {
  const keyA = canonicalKey(titleA);
  const keyB = canonicalKey(titleB);
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;

  if (keyA.length >= 5 && keyB.length >= 5) {
    if (keyA.includes(keyB) || keyB.includes(keyA)) return true;
  }

  const wordsA = titleA.toLowerCase().normalize('NFD').replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const wordsB = titleB.toLowerCase().normalize('NFD').replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  let common = 0;
  for (const wa of wordsA) {
    for (const wb of wordsB) {
      if (wa === wb || (wa.length >= 4 && wb.length >= 4 && (wa.startsWith(wb) || wb.startsWith(wa)))) {
        common++;
        break;
      }
    }
  }
  if (common >= 2 || (common >= 1 && (wordsA.length <= 2 || wordsB.length <= 2))) {
    return true;
  }

  return false;
}

// Extraction de l'année
export function getYear(releaseDate) {
  if (!releaseDate) return '';
  return releaseDate.substring(0, 4);
}

// Recherche d'un titre ou artiste
export async function searchTrack(query, country = 'FR', movieHint = null) {
  const cacheKey = `${country}:${query}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const encodedQuery = encodeURIComponent(query);
  const url = `https://itunes.apple.com/search?term=${encodedQuery}&country=${country}&entity=song&limit=10`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();

    const validTracks = (data.results || [])
      .filter(item => item.previewUrl && item.trackName && item.artistName)
      .map(item => {
        const cleanedTitle = cleanTitle(item.trackName);
        const extractedMovie = extractMovieName(item.trackName, item.collectionName) || movieHint;
        const artworkHd = (item.artworkUrl100 || '').replace('100x100bb', '600x600bb');
        return {
          id: item.trackId,
          title: cleanedTitle,
          rawTitle: item.trackName,
          artist: item.artistName,
          album: item.collectionName || '',
          movieTitle: extractedMovie || null,
          year: getYear(item.releaseDate),
          genre: item.primaryGenreName,
          previewUrl: item.previewUrl,
          artworkUrl: artworkHd
        };
      });

    cache.set(cacheKey, validTracks);
    return validTracks;
  } catch (err) {
    console.warn(`Erreur lors de la recherche iTunes pour "${query}":`, err);
    return [];
  }
}

// Mélange d'un tableau (Fisher-Yates)
export function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Préparer une sélection de morceaux pour une partie complète
export async function preparePlaylist(category, trackCount = 10, onProgress = null, customPrompt = null) {
  const pool = [];
  const seenKeys = new Set();
  const allFetchedForDecoys = [];

  function addTrackToPool(track) {
    if (!track || !track.title || !track.artist) return false;
    const key = canonicalKey(track.title);
    if (!key || key.length < 2) return false;

    for (const existingTrack of pool) {
      if (areTitlesEquivalent(existingTrack.title, track.title)) {
        return false;
      }
    }

    seenKeys.add(key);
    pool.push(track);
    return true;
  }

  const isCustom = category.isCustom || !!customPrompt;
  const themeToAsk = customPrompt || category.aiTheme || category.name;
  const hasGeminiKey = !!getGeminiApiKey();
  const hasProxy = !!getCustomProxyUrl();

  // On lance l'IA si c'est un thème libre OU si l'utilisateur a configuré Gemini/proxy pour les thèmes standards
  const shouldInvokeAI = isCustom || hasGeminiKey || hasProxy;

  // 1. TENTATIVE VIA LE GÉNÉRATEUR IA
  if (shouldInvokeAI) {
    if (onProgress) {
      const aiProviderName = hasGeminiKey ? "Google Gemini 2.0" : "l'IA";
      onProgress(15, `${aiProviderName} compose votre sélection sur-mesure...`);
    }

    const safetyBuffer = trackCount <= 5 ? 2 : 4;
    const aiTracks = await generateTracksFromAI(themeToAsk, trackCount + safetyBuffer);

    if (aiTracks && aiTracks.length > 0) {
      if (onProgress) onProgress(45, "Extraction des extraits audio iTunes...");
      let processed = 0;

      for (const item of aiTracks) {
        const query = `${item.artist} ${item.title}`;
        const results = await searchTrack(query, category.country || 'FR', item.movie || null);
        for (const track of results) {
          if (item.movie && !track.movieTitle) {
            track.movieTitle = item.movie;
          }
          allFetchedForDecoys.push(track);
          if (addTrackToPool(track)) {
            break;
          }
        }
        processed++;
        if (onProgress) {
          onProgress(Math.min(90, 45 + Math.round((processed / aiTracks.length) * 45)));
        }
        if (pool.length >= trackCount + safetyBuffer) break;
      }
    }
  }

  // 2. COMPLÉMENT OU FALLBACK VIA LE VIVIER ALÉATOIRE
  if (pool.length < trackCount) {
    if (onProgress) onProgress(60, "Diversification et finalisation de la playlist...");

    let queriesToUse = [];

    if (isCustom && customPrompt) {
      // Fallback intelligent pour Thème Libre : recherche directe des mots-clés de l'utilisateur dans iTunes !
      queriesToUse = [
        customPrompt,
        `${customPrompt} hit`,
        `${customPrompt} chanson`,
        `${customPrompt} musique`,
        `${customPrompt} best of`,
        `${customPrompt} compilation`,
        `${customPrompt} remix`
      ];
    } else {
      queriesToUse = category.queries || [];
    }

    const shuffledQueries = shuffleArray(queriesToUse);

    for (const q of shuffledQueries) {
      const results = await searchTrack(q, category.country || 'FR');
      const shuffledResults = shuffleArray(results);
      for (const track of shuffledResults) {
        allFetchedForDecoys.push(track);
        if (addTrackToPool(track)) {
          break;
        }
      }
      if (pool.length >= trackCount + 6) break;
    }
  }

  // Sélection aléatoire des N morceaux demandés
  const finalTracks = shuffleArray(pool).slice(0, trackCount);

  // 3. GÉNÉRATION DES LEURRES POUR LE MODE QCM (SANS AUCUN DOUBLON SUR TOUTE LA SESSION)
  const categoryDecoys = category.decoys || [];
  const globalDecoys = [
    ...allFetchedForDecoys,
    ...pool,
    ...categoryDecoys.map(d => ({ title: d.title, artist: d.artist, movieTitle: d.movie || null }))
  ];

  // Ensemble pour mémoriser les leurres déjà utilisés dans la partie (afin d'éviter les répétitions)
  const sessionUsedDecoyKeys = new Set(finalTracks.map(t => canonicalKey(t.title)));

  const preparedTracks = finalTracks.map((track) => {
    const chosenDecoys = [];
    const shuffledCandidates = shuffleArray(globalDecoys);

    // 1ère passe : chercher des candidats non encore utilisés dans toute la partie
    for (const cand of shuffledCandidates) {
      if (!cand.title || !cand.artist) continue;
      const candKey = canonicalKey(cand.title);
      if (!candKey || sessionUsedDecoyKeys.has(candKey)) continue;

      if (cand.artist && track.artist && cand.artist.toLowerCase() === track.artist.toLowerCase()) {
        continue;
      }

      if (areTitlesEquivalent(cand.title, track.title)) {
        continue;
      }

      sessionUsedDecoyKeys.add(candKey);
      chosenDecoys.push({
        title: cand.title,
        artist: cand.artist,
        movieTitle: cand.movieTitle || cand.movie || null
      });

      if (chosenDecoys.length === 3) break;
    }

    // 2ème passe : si la session est longue et le vivier épuisé, réutiliser des candidats non présents dans ce tour
    if (chosenDecoys.length < 3) {
      const localUsedKeys = new Set([
        canonicalKey(track.title),
        ...chosenDecoys.map(d => canonicalKey(d.title))
      ]);

      for (const cand of shuffledCandidates) {
        if (!cand.title || !cand.artist) continue;
        const candKey = canonicalKey(cand.title);
        if (!candKey || localUsedKeys.has(candKey)) continue;
        if (areTitlesEquivalent(cand.title, track.title)) continue;

        localUsedKeys.add(candKey);
        chosenDecoys.push({
          title: cand.title,
          artist: cand.artist,
          movieTitle: cand.movieTitle || cand.movie || null
        });

        if (chosenDecoys.length === 3) break;
      }
    }

    // 3ème passe : si le vivier est encore insuffisant, puiser dans les classiques universels
    if (chosenDecoys.length < 3) {
      const universalDecoys = [
        { title: 'One More Time', artist: 'Daft Punk' },
        { title: 'Bohemian Rhapsody', artist: 'Queen' },
        { title: 'Billie Jean', artist: 'Michael Jackson' },
        { title: 'Shape of You', artist: 'Ed Sheeran' },
        { title: 'La terre est ronde', artist: 'Orelsan' },
        { title: 'L\'Aventurier', artist: 'Indochine' },
        { title: 'Hakuna Matata', artist: 'Le Roi Lion' },
        { title: 'Ce rêve bleu', artist: 'Aladdin' },
        { title: 'Get Lucky', artist: 'Daft Punk' },
        { title: 'Tous les mêmes', artist: 'Stromae' }
      ];

      for (const u of shuffleArray(universalDecoys)) {
        const uKey = canonicalKey(u.title);
        if (!sessionUsedDecoyKeys.has(uKey) && !areTitlesEquivalent(u.title, track.title)) {
          sessionUsedDecoyKeys.add(uKey);
          chosenDecoys.push(u);
          if (chosenDecoys.length === 3) break;
        }
      }
    }

    const options = shuffleArray([
      { title: track.title, artist: track.artist, movieTitle: track.movieTitle, isCorrect: true },
      { title: chosenDecoys[0]?.title || 'Titre Mystère 1', artist: chosenDecoys[0]?.artist || 'Artiste A', movieTitle: chosenDecoys[0]?.movieTitle, isCorrect: false },
      { title: chosenDecoys[1]?.title || 'Titre Mystère 2', artist: chosenDecoys[1]?.artist || 'Artiste B', movieTitle: chosenDecoys[1]?.movieTitle, isCorrect: false },
      { title: chosenDecoys[2]?.title || 'Titre Mystère 3', artist: chosenDecoys[2]?.artist || 'Artiste C', movieTitle: chosenDecoys[2]?.movieTitle, isCorrect: false }
    ]);

    return {
      ...track,
      options
    };
  });

  return preparedTracks;
}
