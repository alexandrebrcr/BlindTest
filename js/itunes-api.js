// Gestionnaire de l'API iTunes Search (CORS natif, previews 30s et pochettes HD)
import { generateTracksFromAI } from './ai-generator.js';

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

  // Si l'un est inclus dans l'autre (ex: "Libérée délivrée" et "Libérée délivrée reprise")
  if (keyA.length >= 5 && keyB.length >= 5) {
    if (keyA.includes(keyB) || keyB.includes(keyA)) return true;
  }

  // Comparaison par mots significatifs (ex: "Zero To Hero" vs "De zéro en héros")
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
export async function searchTrack(query, country = 'FR') {
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
        const artworkHd = (item.artworkUrl100 || '').replace('100x100bb', '600x600bb');
        return {
          id: item.trackId,
          title: cleanedTitle,
          rawTitle: item.trackName,
          artist: item.artistName,
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

// Préparer une sélection de morceaux pour une partie complète (avec IA dynamique & fallback varié)
export async function preparePlaylist(category, trackCount = 10, onProgress = null, customPrompt = null) {
  const pool = [];
  const seenKeys = new Set();
  const allFetchedForDecoys = [];

  // Fonction interne d'ajout avec dédoublonnage strict
  function addTrackToPool(track) {
    if (!track || !track.title || !track.artist) return false;
    const key = canonicalKey(track.title);
    if (!key || key.length < 2) return false;

    // Vérifier si un titre similaire ou équivalent est déjà dans la playlist
    for (const existingTrack of pool) {
      if (areTitlesEquivalent(existingTrack.title, track.title)) {
        return false;
      }
    }

    seenKeys.add(key);
    pool.push(track);
    return true;
  }

  const themeToAsk = customPrompt || category.aiTheme || category.name;

  // 1. TENTATIVE VIA LE GÉNÉRATEUR IA (LLM sans clé d'API)
  if (onProgress) onProgress(15, "L'IA compose votre sélection sur-mesure...");
  const safetyBuffer = trackCount <= 5 ? 2 : 3;
  const aiTracks = await generateTracksFromAI(themeToAsk, trackCount + safetyBuffer);

  if (aiTracks && aiTracks.length > 0) {
    if (onProgress) onProgress(45, "Extraction des extraits audio iTunes...");
    let processed = 0;

    for (const item of aiTracks) {
      const query = `${item.artist} ${item.title}`;
      const results = await searchTrack(query, category.country || 'FR');
      for (const track of results) {
        allFetchedForDecoys.push(track);
        if (addTrackToPool(track)) {
          break; // Un extrait par titre IA
        }
      }
      processed++;
      if (onProgress) {
        onProgress(Math.min(90, 45 + Math.round((processed / aiTracks.length) * 45)));
      }
      if (pool.length >= trackCount + safetyBuffer) break;
    }
  }

  // 2. COMPLÉMENT OU FALLBACK VIA LE VIVIER ALÉATOIRE
  if (pool.length < trackCount) {
    if (onProgress) onProgress(60, "Diversification de la playlist...");
    const shuffledQueries = shuffleArray(category.queries || []);

    for (const q of shuffledQueries) {
      const results = await searchTrack(q, category.country || 'FR');
      // On mélange les résultats d'iTunes pour ne pas toujours prendre le même premier morceau
      const shuffledResults = shuffleArray(results);
      for (const track of shuffledResults) {
        allFetchedForDecoys.push(track);
        if (addTrackToPool(track)) {
          break; // Un morceau par artiste/requête pour varier les genres
        }
      }
      if (pool.length >= trackCount + 6) break;
    }
  }

  // Sélection aléatoire des N morceaux demandés
  const finalTracks = shuffleArray(pool).slice(0, trackCount);

  // 3. GÉNÉRATION DES LEURRES POUR LE MODE QCM (SANS AUCUN DOUBLON)
  const categoryDecoys = category.decoys || [];
  const globalDecoys = [
    ...allFetchedForDecoys,
    ...pool,
    ...categoryDecoys.map(d => ({ title: d.title, artist: d.artist }))
  ];

  const preparedTracks = finalTracks.map((track) => {
    const currentKey = canonicalKey(track.title);
    const usedDecoyKeys = new Set([currentKey]);
    const chosenDecoys = [];

    // Mélanger les candidats pour chaque morceau
    const shuffledCandidates = shuffleArray(globalDecoys);

    for (const cand of shuffledCandidates) {
      if (!cand.title || !cand.artist) continue;
      const candKey = canonicalKey(cand.title);
      if (!candKey || usedDecoyKeys.has(candKey)) continue;

      // Éviter que l'artiste soit identique à la bonne réponse
      if (cand.artist && track.artist && cand.artist.toLowerCase() === track.artist.toLowerCase()) {
        continue;
      }

      // Éviter les titres équivalents ou traduits (ex: "Zero To Hero" vs "De zéro en héros")
      if (areTitlesEquivalent(cand.title, track.title)) {
        continue;
      }

      usedDecoyKeys.add(candKey);
      chosenDecoys.push({ title: cand.title, artist: cand.artist });
      if (chosenDecoys.length === 3) break;
    }

    // Si le vivier est restreint, puiser dans les classiques universels garantis sans doublons
    if (chosenDecoys.length < 3) {
      const universalDecoys = [
        { title: 'One More Time', artist: 'Daft Punk' },
        { title: 'Bohemian Rhapsody', artist: 'Queen' },
        { title: 'Billie Jean', artist: 'Michael Jackson' },
        { title: 'Shape of You', artist: 'Ed Sheeran' },
        { title: 'La terre est ronde', artist: 'Orelsan' },
        { title: 'L\'Aventurier', artist: 'Indochine' },
        { title: 'Hakuna Matata', artist: 'Le Roi Lion' },
        { title: 'Ce rêve bleu', artist: 'Aladdin' }
      ];

      for (const u of shuffleArray(universalDecoys)) {
        const uKey = canonicalKey(u.title);
        if (!usedDecoyKeys.has(uKey) && !areTitlesEquivalent(u.title, track.title)) {
          usedDecoyKeys.add(uKey);
          chosenDecoys.push(u);
          if (chosenDecoys.length === 3) break;
        }
      }
    }

    const options = shuffleArray([
      { title: track.title, artist: track.artist, isCorrect: true },
      { title: chosenDecoys[0].title, artist: chosenDecoys[0].artist, isCorrect: false },
      { title: chosenDecoys[1].title, artist: chosenDecoys[1].artist, isCorrect: false },
      { title: chosenDecoys[2].title, artist: chosenDecoys[2].artist, isCorrect: false }
    ]);

    return {
      ...track,
      options
    };
  });

  return preparedTracks;
}
