// Gestionnaire de l'API iTunes Search (CORS natif, previews 30s et pochettes HD)

const cache = new Map();

// Nettoyage des titres (retirer les mentions parasites comme "Remastered", "Radio Edit", "Live")
export function cleanTitle(rawTitle) {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/\s*\(.*?(remaster|version|edit|live|deluxe|bonus|anniversary|ost|soundtrack|feat|explicit).*?\)/gi, '')
    .replace(/\s*\[.*?(remaster|version|edit|live|deluxe|bonus|anniversary|ost|soundtrack|feat|explicit).*?\]/gi, '')
    .replace(/\s*-\s*(remaster|live|radio edit|deluxe|single version).*/gi, '')
    .trim();
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
  const url = `https://itunes.apple.com/search?term=${encodedQuery}&country=${country}&entity=song&limit=4`;

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

// Préparer une sélection de morceaux pour une partie complète
export async function preparePlaylist(category, trackCount = 10, onProgress = null) {
  const queries = shuffleArray(category.queries);
  const selectedQueries = queries.slice(0, Math.min(queries.length, trackCount + 6));
  const pool = [];
  const seenIds = new Set();
  let completed = 0;

  for (const q of selectedQueries) {
    const results = await searchTrack(q, category.country || 'FR');
    for (const track of results) {
      if (!seenIds.has(track.id) && track.title.length > 1) {
        seenIds.add(track.id);
        pool.push(track);
        break; // 1 morceau par requête pour maximiser la diversité
      }
    }
    completed++;
    if (onProgress) {
      onProgress(Math.round((completed / selectedQueries.length) * 100));
    }
    if (pool.length >= trackCount) break;
  }

  // Si on n'a pas atteint le compte, on fait une passe sur les requêtes restantes
  if (pool.length < trackCount) {
    for (const q of queries.slice(selectedQueries.length)) {
      const results = await searchTrack(q, category.country || 'FR');
      for (const track of results) {
        if (!seenIds.has(track.id)) {
          seenIds.add(track.id);
          pool.push(track);
          if (pool.length >= trackCount) break;
        }
      }
      if (pool.length >= trackCount) break;
    }
  }

  const finalTracks = shuffleArray(pool).slice(0, trackCount);

  // Génération des leurres pour chaque morceau (pour le mode QCM)
  const preparedTracks = finalTracks.map((track) => {
    // Choisir 3 leurres parmi les autres morceaux du vivier
    const decoys = pool
      .filter(other => other.id !== track.id && (other.title !== track.title || other.artist !== track.artist));

    const shuffledDecoys = shuffleArray(decoys).slice(0, 3);

    // Si on n'a pas assez de leurres dans la playlist, en créer des variantes
    while (shuffledDecoys.length < 3) {
      shuffledDecoys.push({
        title: `${track.title} (Alternative)`,
        artist: track.artist
      });
    }

    const options = shuffleArray([
      { title: track.title, artist: track.artist, isCorrect: true },
      { title: shuffledDecoys[0].title, artist: shuffledDecoys[0].artist, isCorrect: false },
      { title: shuffledDecoys[1].title, artist: shuffledDecoys[1].artist, isCorrect: false },
      { title: shuffledDecoys[2].title, artist: shuffledDecoys[2].artist, isCorrect: false }
    ]);

    return {
      ...track,
      options
    };
  });

  return preparedTracks;
}
