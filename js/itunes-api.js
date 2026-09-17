// Gestionnaire de l'API iTunes Search (CORS natif, previews 30s et pochettes HD)
import { generateTracksFromAI, getGeminiApiKey } from './ai-generator.js';

const cache = new Map();

// Dictionnaire des franchises, films d'animation et séries cultes
const KNOWN_FRANCHISES = [
  // Disney & Pixar
  { patterns: [/roi lion/i, /lion king/i], name: 'Le Roi Lion' },
  { patterns: [/reine des neiges/i, /\bfrozen\b/i], name: 'La Reine des Neiges' },
  { patterns: [/aladdin/i], name: 'Aladdin' },
  { patterns: [/petite sir[eè]ne/i, /little mermaid/i], name: 'La Petite Sirène' },
  { patterns: [/livre de la jungle/i, /jungle book/i], name: 'Le Livre de la Jungle' },
  { patterns: [/belle et la b[eê]te/i, /beauty and the beast/i], name: 'La Belle et la Bête' },
  { patterns: [/mulan/i], name: 'Mulan' },
  { patterns: [/hercule/i, /hercules/i], name: 'Hercule' },
  { patterns: [/tarzan/i], name: 'Tarzan' },
  { patterns: [/vaiana/i, /\bmoana\b/i], name: 'Vaiana' },
  { patterns: [/pocahontas/i], name: 'Pocahontas' },
  { patterns: [/aristochats/i, /aristocats/i], name: 'Les Aristochats' },
  { patterns: [/toy story/i], name: 'Toy Story' },
  { patterns: [/cendrillon/i, /cinderella/i], name: 'Cendrillon' },
  { patterns: [/pinocchio/i], name: 'Pinocchio' },
  { patterns: [/blanche[- ]neige/i, /snow white/i], name: 'Blanche-Neige' },
  { patterns: [/raiponce/i, /tangled/i], name: 'Raiponce' },
  { patterns: [/encanto/i], name: 'Encanto' },
  { patterns: [/\bcoco\b/i], name: 'Coco' },
  { patterns: [/zootopie/i, /zootopia/i], name: 'Zootopie' },
  { patterns: [/princesse et la grenouille/i, /princess and the frog/i], name: 'La Princesse et la Grenouille' },
  { patterns: [/ratatouille/i], name: 'Ratatouille' },
  { patterns: [/monstres [&e]t? cie/i, /monsters inc/i], name: 'Monstres & Cie' },
  { patterns: [/monde de nemo/i, /finding nemo/i], name: 'Le Monde de Nemo' },
  { patterns: [/indestructibles/i, /incredibles/i], name: 'Les Indestructibles' },
  { patterns: [/bossu de notre[- ]dame/i, /hunchback of notre dame/i], name: 'Le Bossu de Notre-Dame' },
  { patterns: [/peter pan/i], name: 'Peter Pan' },
  { patterns: [/bambi/i], name: 'Bambi' },
  { patterns: [/dumbo/i], name: 'Dumbo' },
  { patterns: [/la haut/i, /là-haut/i], name: 'Là-Haut' },
  { patterns: [/\bcars\b/i], name: 'Cars' },

  // Dessins animés cultes & Séries jeunesse
  { patterns: [/pok[eé]mon/i], name: 'Pokémon' },
  { patterns: [/myst[eé]rieuses cit[eé]s d[' ]or/i], name: 'Les Mystérieuses Cités d\'Or' },
  { patterns: [/inspecteur gadget/i], name: 'Inspecteur Gadget' },
  { patterns: [/capitaine flam/i], name: 'Capitaine Flam' },
  { patterns: [/goldorak/i], name: 'Goldorak' },
  { patterns: [/olive et tom/i, /captain tsubasa/i], name: 'Olive et Tom' },
  { patterns: [/tortues ninja/i, /ninja turtles/i], name: 'Les Tortues Ninja' },
  { patterns: [/dragon ball/i], name: 'Dragon Ball' },
  { patterns: [/naruto/i], name: 'Naruto' },
  { patterns: [/one piece/i], name: 'One Piece' },
  { patterns: [/attaque des titans/i, /shingeki/i, /\bsnk\b/i], name: 'L\'Attaque des Titans' },
  { patterns: [/chevaliers du zodiaque/i, /saint seiya/i], name: 'Les Chevaliers du Zodiaque' },
  { patterns: [/albator/i], name: 'Albator' },
  { patterns: [/sailor moon/i], name: 'Sailor Moon' },

  // Cinéma & Séries cultes
  { patterns: [/star wars/i, /guerre des [eé]toiles/i], name: 'Star Wars' },
  { patterns: [/pirates des cara[iï]bes/i, /pirates of the caribbean/i], name: 'Pirates des Caraïbes' },
  { patterns: [/harry potter/i], name: 'Harry Potter' },
  { patterns: [/game of thrones/i, /tr[oô]ne de fer/i], name: 'Game of Thrones' },
  { patterns: [/seigneur des anneaux/i, /lord of the rings/i], name: 'Le Seigneur des Anneaux' },
  { patterns: [/gladiator/i], name: 'Gladiator' },
  { patterns: [/interstellar/i], name: 'Interstellar' },
  { patterns: [/jurassic park/i], name: 'Jurassic Park' },
  { patterns: [/james bond/i, /\b007\b/i, /skyfall/i], name: 'James Bond' },
  { patterns: [/avengers/i, /marvel/i], name: 'Avengers' },
  { patterns: [/titanic/i], name: 'Titanic' },
  { patterns: [/rocky\b/i], name: 'Rocky' },
  { patterns: [/top gun/i], name: 'Top Gun' },
  { patterns: [/pulp fiction/i], name: 'Pulp Fiction' },
  { patterns: [/mission impossible/i], name: 'Mission Impossible' },
  { patterns: [/panth[eè]re rose/i, /pink panther/i], name: 'La Panthère Rose' },
  { patterns: [/terminator/i], name: 'Terminator' },
  { patterns: [/indiana jones/i], name: 'Indiana Jones' },
  { patterns: [/retour vers le futur/i, /back to the future/i], name: 'Retour vers le Futur' },
  { patterns: [/sos fant[oô]mes/i, /ghostbusters/i], name: 'SOS Fantômes' },
  { patterns: [/le bon la brute et le truand/i, /good the bad and the ugly/i], name: 'Le Bon, la Brute et le Truand' },
  { patterns: [/requiem for a dream/i], name: 'Requiem for a Dream' }
];

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
export function extractMovieName(rawTitle, collectionName, queryText = null, movieHint = null) {
  const combined = `${rawTitle || ''} ${collectionName || ''} ${queryText || ''} ${movieHint || ''}`;

  // 1. Chercher dans les franchises et films cultes connus
  for (const franchise of KNOWN_FRANCHISES) {
    if (franchise.patterns.some(regex => regex.test(combined))) {
      return franchise.name;
    }
  }

  // 2. Chercher dans les parenthèses ou guillemets du titre
  if (rawTitle) {
    const fromMatch = rawTitle.match(/(?:from|de|du film)\s+["'«]([^"'»]+)["'»]/i);
    if (fromMatch && fromMatch[1]) {
      return fromMatch[1].trim();
    }
    const simpleMatch = rawTitle.match(/\((?:de|from|du film)\s+([^)]+)\)/i);
    if (simpleMatch && simpleMatch[1]) {
      return simpleMatch[1].trim();
    }
  }

  // 3. Chercher dans le nom de l'album / collection
  if (collectionName) {
    const ostMatch = collectionName.match(/(.+?)\s*(?:\(original soundtrack|\(b\.o\.|\(soundtrack|\(bande originale|original score|ost\))/i);
    if (ostMatch && ostMatch[1]) {
      return ostMatch[1].trim();
    }
    if (collectionName.toLowerCase().includes('soundtrack') || collectionName.toLowerCase().includes('bande originale')) {
      return collectionName.replace(/\s*\(.*?\)/g, '').replace(/\s*-.*$/, '').trim();
    }
  }

  return movieHint || null;
}

// Fonction de mélange de tableau (Fisher-Yates)
export function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Nettoyage canonique d'un titre pour comparaison robuste
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

// Évaluation de la qualité d'une piste (priorité absolue aux versions studio originales cultes)
export function getTrackQualityScore(item, query = '') {
  const q = (query || '').toLowerCase();
  const title = (item.trackName || '').toLowerCase();
  const album = (item.collectionName || '').toLowerCase();
  const artist = (item.artistName || '').toLowerCase();
  const combined = `${title} ${album} ${artist}`;

  // Détection des versions indésirables pour un blind test (sauf si expressément demandé)
  const isLive = !q.includes('live') && !q.includes('concert') &&
    /\b(live|en public|en concert|au z[eé]nith|au bataclan|[aà] l[' ]olympia|live at|live from|in concert|tour \d{4}|live recording|direct live)\b/i.test(combined);

  const isAcoustic = !q.includes('acoustic') && !q.includes('acoustique') && !q.includes('unplugged') &&
    /\b(acoustic|acoustique|unplugged|piano version|acoustic version|version acoustique|guitare voix|piano solo)\b/i.test(combined);

  const isRemix = !q.includes('remix') && !q.includes('mix') &&
    /\b(remix|remixed|club mix|extended mix|dub mix|dance mix|mashup|rework|bootleg)\b/i.test(combined);

  const isKaraokeOrTribute = !q.includes('karaoke') && !q.includes('tribute') &&
    /\b(karaoke|karaok[eé]|instrumental|tribute|cover band|backing track|made famous by|in the style of|piano project|hit crew|all stars|orchestral tribute|sing king)\b/i.test(combined);

  const isDemo = !q.includes('demo') &&
    /\b(demo|d[eé]mo|rehearsal|session acoustique|work tape|rough mix)\b/i.test(combined);

  if (isKaraokeOrTribute) return -100;
  if (isLive) return -80;
  if (isAcoustic) return -60;
  if (isRemix) return -50;
  if (isDemo) return -40;

  let score = 100;

  // Bonus pour un album studio original plutôt qu'une compilation
  if (item.collectionName && !/best of|compilation|greatest hits|anthology|intégrale/i.test(item.collectionName)) {
    score += 15;
  }

  // Bonus si le titre est net, sans parenthèse parasite
  if (!/\(.*\)|\[.*\]/.test(item.trackName)) {
    score += 25;
  }

  // Les versions remasterisées studio sont appréciées pour leur dynamique
  if (/\b(remaster|remastered)\b/i.test(item.trackName)) {
    score += 10;
  }

  return score;
}

// Recherche d'un titre ou d'un artiste avec priorisation des versions studio
export async function searchTrack(query, country = 'FR', movieHint = null) {
  const cacheKey = `${country}:${query}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const encodedQuery = encodeURIComponent(query);
  // On récupère jusqu'à 25 résultats pour s'assurer d'obtenir la version studio originale
  const url = `https://itunes.apple.com/search?term=${encodedQuery}&country=${country}&entity=song&limit=25`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();

    const rawTracks = (data.results || [])
      .filter(item => item.previewUrl && item.trackName && item.artistName);

    // Calcul du score studio pour chaque piste
    const scoredTracks = rawTracks.map(item => ({
      item,
      score: getTrackQualityScore(item, query)
    }));

    // Tri pour placer les versions studio originales en premier
    scoredTracks.sort((a, b) => b.score - a.score);

    // Si des versions studio propres (score >= 50) existent, on rejette catégoriquement tous les lives/acoustiques/remixes
    const hasCleanStudio = scoredTracks.some(t => t.score >= 50);
    const chosenItems = hasCleanStudio
      ? scoredTracks.filter(t => t.score >= 50).map(t => t.item)
      : scoredTracks.filter(t => t.score > -100).map(t => t.item);

    const validTracks = chosenItems
      .map(item => {
        const cleanedTitle = cleanTitle(item.trackName);
        const extractedMovie = extractMovieName(item.trackName, item.collectionName, query, movieHint);
        const artworkHd = (item.artworkUrl100 || '').replace('100x100bb', '600x600bb');
        return {
          id: item.trackId,
          title: cleanedTitle,
          rawTitle: item.trackName,
          artist: item.artistName,
          album: item.collectionName || '',
          movieTitle: extractedMovie || null,
          year: getYear(item.releaseDate),
          genre: item.primaryGenreName || '',
          previewUrl: item.previewUrl,
          artworkUrl: artworkHd,
          country: country
        };
      })
      .filter(item => item.title.length > 0 && item.artist.length > 0);

    // Déduplication locale par canonicalKey
    const seen = new Set();
    const unique = [];
    for (const t of validTracks) {
      const key = canonicalKey(t.title);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(t);
      }
    }

    cache.set(cacheKey, unique);
    return unique;
  } catch (err) {
    console.warn(`Erreur recherche iTunes pour "${query}":`, err);
    return [];
  }
}

// Générateur musical intelligent pour Thème Libre (100% autonome, 0 clé API requise)
export function getSmartThemeQueries(theme) {
  if (!theme || typeof theme !== 'string') return [];
  const lower = theme.toLowerCase().trim();
  const queries = [];

  // 1. Thématiques, genres et univers cultes enrichis
  if (lower.includes('manga') || lower.includes('anime') || lower.includes('animé') || lower.includes('japon')) {
    queries.push('generique dessin anime', 'manga opening', 'naruto opening', 'dragon ball z', 'one piece we are', 'japanimation', 'snk opening', 'death note theme');
  } else if (lower.includes('dessin') || lower.includes('enfance') || lower.includes('cartoon')) {
    queries.push('generique dessin anime', 'les mysterieuses cites dor', 'inspecteur gadget', 'pokemon generique', 'goldorak', 'capitaine flam', 'tortues ninja', 'olive et tom');
  } else if (lower.includes('disney') || lower.includes('pixar')) {
    queries.push('disney le roi lion', 'disney aladdin', 'disney la reine des neiges', 'disney hercule', 'disney tarzan', 'disney vaiana', 'disney mulan', 'disney livre de la jungle');
  } else if (lower.includes('film') || lower.includes('cinema') || lower.includes('cinéma') || lower.includes('serie') || lower.includes('série') || lower.includes('b.o.')) {
    queries.push('star wars john williams', 'pirates of the caribbean', 'game of thrones theme', 'harry potter hedwig', 'gladiator hans zimmer', 'titanic celine dion', 'pulp fiction', 'mission impossible theme');
  } else if (lower.includes('jeu') || lower.includes('gaming') || lower.includes('zelda') || lower.includes('mario')) {
    queries.push('super mario bros theme', 'zelda main theme', 'pokemon red blue', 'tetris theme', 'final fantasy victory fanfare', 'halo theme song', 'skyrim theme');
  } else if (lower.includes('prenom') || lower.includes('prénom')) {
    queries.push('aline christophe', 'caroline mc solaar', 'roxanne the police', 'billie jean michael jackson', 'angie rolling stones', 'laura johnny hallyday', 'sarah georges moustaki');
  } else if (lower.includes('ete') || lower.includes('été') || lower.includes('soleil') || lower.includes('plage') || lower.includes('vacance')) {
    queries.push('tube ete', 'hit ete', 'macarena los del rio', 'lambada kaoma', 'despacito luis fonsi', 'soco bate vira', 'asereje las ketchup', 'danza kuduro don omar');
  } else if (lower.includes('amour') || lower.includes('love') || lower.includes('romantique') || lower.includes('rupture')) {
    queries.push('chanson damour', 'ne me quitte pas jacques brel', 'my heart will go on celine dion', 'all of me john legend', 'je laime a mourir francis cabrel', 'i will always love you whitney houston');
  } else if (lower.includes('rock') || lower.includes('metal') || lower.includes('hard rock') || lower.includes('punk')) {
    queries.push('queen bohemian rhapsody', 'ac dc highway to hell', 'nirvana smells like teen spirit', 'the beatles let it be', 'rolling stones paint it black', 'metallica enter sandman', 'guns n roses sweet child');
  } else if (lower.includes('rap francais') || lower.includes('rap fr')) {
    queries.push('jul bande organisee', 'iam le mia', 'supreme ntm seine saint denis', 'orelsan la terre est ronde', 'booba dkr', 'pnl au dd', 'ninho lettre a une femme', 'damso macarena');
  } else if (lower.includes('rap') || lower.includes('hip hop')) {
    queries.push('eminem lose yourself', 'tupac california love', 'coolio gangsta paradise', 'dr dre still dre', '50 cent in da club', 'notorious big juicy');
  } else if (lower.includes('electro') || lower.includes('techno') || lower.includes('dance') || lower.includes('house') || lower.includes('club')) {
    queries.push('daft punk one more time', 'david guetta titanium', 'avicii wake me up', 'calvin harris summer', 'gala freed from desire', 'swedish house mafia don t you worry');
  } else if (lower.includes('80') || lower.includes('eighties') || lower.includes('disco')) {
    queries.push('michael jackson billie jean', 'madonna like a virgin', 'indochine l aventurier', 'a-ha take on me', 'eurythmics sweet dreams', 'wham wake me up', 'rick astley never gonna give you up');
  } else if (lower.includes('90') || lower.includes('nineties')) {
    queries.push('britney spears baby one more time', 'backstreet boys everybody', 'aqua barbie girl', 'louis attaque j t emmene au vent', 'manau la tribu de dana', 'gala freed from desire');
  } else if (lower.includes('2000')) {
    queries.push('black eyed peas i gotta feeling', 'rihanna umbrella', 'beyonce crazy in love', 'kyo derniere danse', 'diams la boulette', 'shakira whenever wherever');
  } else if (lower.includes('variete') || lower.includes('francais') || lower.includes('francaise')) {
    queries.push('jean-jacques goldman encore un matin', 'michel sardou les lacs du connemara', 'daniel balavoine tous les cris les sos', 'johnny hallyday allumer le feu', 'celine dion pour que tu m aimes encore');
  } else if (lower.includes('kpop') || lower.includes('k-pop')) {
    queries.push('bts dynamite', 'blackpink ddu du ddu du', 'psy gangnam style', 'twice the feels', 'stray kids god s menu');
  } else if (lower.includes('latino') || lower.includes('reggaeton') || lower.includes('salsa')) {
    queries.push('despacito luis fonsi', 'danza kuduro don omar', 'gasolina daddy yankee', 'bailando enrique iglesias', 'la camisa negra juanes');
  }

  // 2. Recherche avec le texte exact
  queries.push(theme);
  queries.push(`${theme} hit`);
  queries.push(`${theme} chanson`);
  queries.push(`${theme} best of`);

  // 3. Découpage en mots-clés
  const stopWords = new Set(['des', 'les', 'une', 'qui', 'avec', 'dans', 'pour', 'chansons', 'morceaux', 'musique', 'titres', 'tubes', 'meilleurs', 'top']);
  const words = theme
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w.toLowerCase()));

  if (words.length >= 2) {
    queries.push(words.join(' '));
  }
  for (const w of words) {
    queries.push(`${w} hit`);
  }

  return [...new Set(queries)];
}

// Vivier de secours spécialisé pour les films, Disney et séries (Leurres avec nom de film)
const UNIVERSAL_MOVIE_DECOYS = [
  // Disney Classiques & Pixar
  { title: 'L\'Histoire de la vie', artist: 'Le Roi Lion', movieTitle: 'Le Roi Lion' },
  { title: 'Hakuna Matata', artist: 'Le Roi Lion', movieTitle: 'Le Roi Lion' },
  { title: 'Je voudrais déjà être roi', artist: 'Le Roi Lion', movieTitle: 'Le Roi Lion' },
  { title: 'L\'Amour brille sous les étoiles', artist: 'Le Roi Lion', movieTitle: 'Le Roi Lion' },
  { title: 'Ce rêve bleu', artist: 'Aladdin', movieTitle: 'Aladdin' },
  { title: 'Prince Ali', artist: 'Aladdin', movieTitle: 'Aladdin' },
  { title: 'Je suis ton meilleur ami', artist: 'Aladdin', movieTitle: 'Aladdin' },
  { title: 'Nuits d\'Arabie', artist: 'Aladdin', movieTitle: 'Aladdin' },
  { title: 'Libérée, délivrée', artist: 'La Reine des Neiges', movieTitle: 'La Reine des Neiges' },
  { title: 'Le Renouveau', artist: 'La Reine des Neiges', movieTitle: 'La Reine des Neiges' },
  { title: 'Je voudrais un bonhomme de neige', artist: 'La Reine des Neiges', movieTitle: 'La Reine des Neiges' },
  { title: 'Dans un autre monde', artist: 'La Reine des Neiges 2', movieTitle: 'La Reine des Neiges 2' },
  { title: 'Sous l\'océan', artist: 'La Petite Sirène', movieTitle: 'La Petite Sirène' },
  { title: 'Partir là-bas', artist: 'La Petite Sirène', movieTitle: 'La Petite Sirène' },
  { title: 'Embrasse-la', artist: 'La Petite Sirène', movieTitle: 'La Petite Sirène' },
  { title: 'Pauvres âmes en perdition', artist: 'La Petite Sirène', movieTitle: 'La Petite Sirène' },
  { title: 'Il en faut peu pour être heureux', artist: 'Le Livre de la Jungle', movieTitle: 'Le Livre de la Jungle' },
  { title: 'Être un homme comme vous', artist: 'Le Livre de la Jungle', movieTitle: 'Le Livre de la Jungle' },
  { title: 'Comme un homme', artist: 'Mulan', movieTitle: 'Mulan' },
  { title: 'Réflexion', artist: 'Mulan', movieTitle: 'Mulan' },
  { title: 'Une belle fille à aimer', artist: 'Mulan', movieTitle: 'Mulan' },
  { title: 'De zéro en héros', artist: 'Hercule', movieTitle: 'Hercule' },
  { title: 'Jamais je n\'avouerai', artist: 'Hercule', movieTitle: 'Hercule' },
  { title: 'Le Gospel pur', artist: 'Hercule', movieTitle: 'Hercule' },
  { title: 'Entre deux mondes', artist: 'Tarzan', movieTitle: 'Tarzan' },
  { title: 'Enfant de l\'homme', artist: 'Tarzan', movieTitle: 'Tarzan' },
  { title: 'Je veux savoir', artist: 'Tarzan', movieTitle: 'Tarzan' },
  { title: 'Le Bleu lumière', artist: 'Vaiana', movieTitle: 'Vaiana' },
  { title: 'Pour les hommes', artist: 'Vaiana', movieTitle: 'Vaiana' },
  { title: 'Bling-bling', artist: 'Vaiana', movieTitle: 'Vaiana' },
  { title: 'Tout le monde veut devenir un cat', artist: 'Les Aristochats', movieTitle: 'Les Aristochats' },
  { title: 'Des gammes et des arpèges', artist: 'Les Aristochats', movieTitle: 'Les Aristochats' },
  { title: 'Je suis ton ami', artist: 'Toy Story', movieTitle: 'Toy Story' },
  { title: 'Jamais plus je ne volerai', artist: 'Toy Story', movieTitle: 'Toy Story' },
  { title: 'Ne parlons pas de Bruno', artist: 'Encanto', movieTitle: 'Encanto' },
  { title: 'Sous les apparences', artist: 'Encanto', movieTitle: 'Encanto' },
  { title: 'Où est la vraie vie ?', artist: 'Raiponce', movieTitle: 'Raiponce' },
  { title: 'Je veux y croire', artist: 'Raiponce', movieTitle: 'Raiponce' },
  { title: 'J\'ai un rêve', artist: 'Raiponce', movieTitle: 'Raiponce' },
  { title: 'Ne m\'oublie pas', artist: 'Coco', movieTitle: 'Coco' },
  { title: 'Un poco loco', artist: 'Coco', movieTitle: 'Coco' },
  { title: 'Histoire éternelle', artist: 'La Belle et la Bête', movieTitle: 'La Belle et la Bête' },
  { title: 'C\'est la fête', artist: 'La Belle et la Bête', movieTitle: 'La Belle et la Bête' },
  { title: 'Belle', artist: 'La Belle et la Bête', movieTitle: 'La Belle et la Bête' },
  { title: 'L\'Air du vent', artist: 'Pocahontas', movieTitle: 'Pocahontas' },
  { title: 'Des sauvages', artist: 'Pocahontas', movieTitle: 'Pocahontas' },
  { title: 'Au bout du rêve', artist: 'La Princesse et la Grenouille', movieTitle: 'La Princesse et la Grenouille' },
  { title: 'Mes amis de l\'au-delà', artist: 'La Princesse et la Grenouille', movieTitle: 'La Princesse et la Grenouille' },
  { title: 'Quand on prie la bonne étoile', artist: 'Pinocchio', movieTitle: 'Pinocchio' },
  { title: 'Bibbidi-Bobbidi-Boo', artist: 'Cendrillon', movieTitle: 'Cendrillon' },
  { title: 'Un jour mon prince viendra', artist: 'Blanche-Neige', movieTitle: 'Blanche-Neige' },
  { title: 'Heigh-Ho', artist: 'Blanche-Neige', movieTitle: 'Blanche-Neige' },
  { title: 'Try Everything', artist: 'Zootopie', movieTitle: 'Zootopie' },
  { title: 'Le Festin', artist: 'Ratatouille', movieTitle: 'Ratatouille' },
  { title: 'Si je ne t\'avais pas', artist: 'Monstres et Cie', movieTitle: 'Monstres et Cie' },
  { title: 'Les Indestructibles Thème', artist: 'Les Indestructibles', movieTitle: 'Les Indestructibles' },
  { title: 'Life is a Highway', artist: 'Cars', movieTitle: 'Cars' },
  // Cinéma & Séries cultes
  { title: 'Star Wars Theme', artist: 'John Williams', movieTitle: 'Star Wars' },
  { title: 'He\'s a Pirate', artist: 'Hans Zimmer', movieTitle: 'Pirates des Caraïbes' },
  { title: 'Hedwig\'s Theme', artist: 'John Williams', movieTitle: 'Harry Potter' },
  { title: 'Game of Thrones Theme', artist: 'Ramin Djawadi', movieTitle: 'Game of Thrones' },
  { title: 'Now We Are Free', artist: 'Hans Zimmer', movieTitle: 'Gladiator' },
  { title: 'Concerning Hobbits', artist: 'Howard Shore', movieTitle: 'Le Seigneur des Anneaux' },
  { title: 'My Heart Will Go On', artist: 'Céline Dion', movieTitle: 'Titanic' },
  { title: 'Eye of the Tiger', artist: 'Survivor', movieTitle: 'Rocky' },
  { title: 'Jurassic Park Theme', artist: 'John Williams', movieTitle: 'Jurassic Park' },
  { title: 'James Bond Theme', artist: 'Monty Norman', movieTitle: 'James Bond' },
  { title: 'Ghostbusters', artist: 'Ray Parker Jr.', movieTitle: 'SOS Fantômes' },
  { title: 'Danger Zone', artist: 'Kenny Loggins', movieTitle: 'Top Gun' },
  { title: 'Mission Impossible Theme', artist: 'Lalo Schifrin', movieTitle: 'Mission Impossible' },
  { title: 'The Pink Panther Theme', artist: 'Henry Mancini', movieTitle: 'La Panthère Rose' },
  { title: 'Stayin\' Alive', artist: 'Bee Gees', movieTitle: 'La Fièvre du samedi soir' }
];

// Vaste vivier universel de secours (60 classiques cultes multi-genres)
const EXTENDED_UNIVERSAL_DECOYS = [
  { title: 'One More Time', artist: 'Daft Punk' },
  { title: 'Bohemian Rhapsody', artist: 'Queen' },
  { title: 'Billie Jean', artist: 'Michael Jackson' },
  { title: 'Shape of You', artist: 'Ed Sheeran' },
  { title: 'La terre est ronde', artist: 'Orelsan' },
  { title: 'L\'Aventurier', artist: 'Indochine' },
  { title: 'Hakuna Matata', artist: 'Le Roi Lion' },
  { title: 'Ce rêve bleu', artist: 'Aladdin' },
  { title: 'Get Lucky', artist: 'Daft Punk' },
  { title: 'Tous les mêmes', artist: 'Stromae' },
  { title: 'Smells Like Teen Spirit', artist: 'Nirvana' },
  { title: 'Highway to Hell', artist: 'AC/DC' },
  { title: 'Stayin\' Alive', artist: 'Bee Gees' },
  { title: 'Lose Yourself', artist: 'Eminem' },
  { title: 'Blinding Lights', artist: 'The Weeknd' },
  { title: 'Rolling in the Deep', artist: 'Adele' },
  { title: 'Uptown Funk', artist: 'Bruno Mars' },
  { title: 'Dancing Queen', artist: 'ABBA' },
  { title: 'Bad Romance', artist: 'Lady Gaga' },
  { title: 'Wake Me Up', artist: 'Avicii' },
  { title: 'Balance ton quoi', artist: 'Angèle' },
  { title: 'Titanium', artist: 'David Guetta & Sia' },
  { title: 'Happy', artist: 'Pharrell Williams' },
  { title: 'Allumer le feu', artist: 'Johnny Hallyday' },
  { title: 'Les Lacs du Connemara', artist: 'Michel Sardou' },
  { title: 'Encore un matin', artist: 'Jean-Jacques Goldman' },
  { title: 'Pour que tu m\'aimes encore', artist: 'Céline Dion' },
  { title: 'La Tribu de Dana', artist: 'Manau' },
  { title: 'Dernière danse', artist: 'Kyo' },
  { title: 'La Boulette', artist: 'Diam\'s' },
  { title: 'Je danse le Mia', artist: 'IAM' },
  { title: 'Seine Saint-Denis Style', artist: 'Suprême NTM' },
  { title: 'Bande organisée', artist: '13 Organisé' },
  { title: 'Au DD', artist: 'PNL' },
  { title: 'Lettre à une femme', artist: 'Ninho' },
  { title: 'In the End', artist: 'Linkin Park' },
  { title: 'Wonderwall', artist: 'Oasis' },
  { title: 'Zombie', artist: 'The Cranberries' },
  { title: 'Sweet Child O\' Mine', artist: 'Guns N\' Roses' },
  { title: 'Seven Nation Army', artist: 'The White Stripes' },
  { title: 'Take On Me', artist: 'A-ha' },
  { title: 'Sweet Dreams', artist: 'Eurythmics' },
  { title: 'Les Démons de minuit', artist: 'Émile et Images' },
  { title: 'Nuit de folie', artist: 'Début de Soirée' },
  { title: 'Voyage Voyage', artist: 'Desireless' },
  { title: '...Baby One More Time', artist: 'Britney Spears' },
  { title: 'Crazy in Love', artist: 'Beyoncé' },
  { title: 'Umbrella', artist: 'Rihanna' },
  { title: 'I Gotta Feeling', artist: 'Black Eyed Peas' },
  { title: 'Libérée, Délivrée', artist: 'La Reine des Neiges' },
  { title: 'L\'Histoire de la vie', artist: 'Le Roi Lion' },
  { title: 'Il en faut peu pour être heureux', artist: 'Le Livre de la Jungle' },
  { title: 'Sous l\'océan', artist: 'La Petite Sirène' },
  { title: 'Eye of the Tiger', artist: 'Survivor' },
  { title: 'Gangsta\'s Paradise', artist: 'Coolio' },
  { title: 'Despacito', artist: 'Luis Fonsi' },
  { title: 'Danza Kuduro', artist: 'Don Omar' },
  { title: 'Californication', artist: 'Red Hot Chili Peppers' }
];

// Préparer une sélection de morceaux pour une partie complète
export async function preparePlaylist(category, trackCount = 10, onProgress = null, customPrompt = null) {
  const pool = [];
  const seenKeys = new Set();
  const allFetchedForDecoys = [];
  let aiDecoys = [];

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

  // On lance l'IA si c'est un thème libre OU si l'utilisateur a configuré Gemini pour les thèmes standards
  const shouldInvokeAI = isCustom || hasGeminiKey;

  // 1. APPEL IA (Google Gemini si configuré, sinon service public sans clé)
  if (shouldInvokeAI) {
    if (onProgress) {
      const aiProviderName = hasGeminiKey ? "Google Gemini" : "L'IA musicale";
      onProgress(20, `${aiProviderName} compose votre sélection sur-mesure...`);
    }

    // On demande un buffer de sécurité substantiel pour compenser les éventuels morceaux introuvables sur iTunes
    const safetyBuffer = Math.max(5, Math.ceil(trackCount * 0.4));
    const aiResult = await generateTracksFromAI(themeToAsk, trackCount + safetyBuffer);

    if (aiResult) {
      const aiTracks = Array.isArray(aiResult) ? aiResult : (aiResult.tracks || []);
      aiDecoys = Array.isArray(aiResult.decoys) ? aiResult.decoys : [];

      if (aiTracks.length > 0) {
        if (onProgress) onProgress(50, "Extraction des extraits audio iTunes...");
        let processed = 0;

        for (const item of aiTracks) {
          const query = item.artist ? `${item.artist} ${item.title}` : item.title;
          const results = await searchTrack(query, category.country || 'FR', item.movie || null);

          if (results && results.length > 0) {
            // Conserver TOUS les résultats dans le vivier de leurres
            for (const track of results) {
              if (item.movie && !track.movieTitle) {
                track.movieTitle = item.movie;
              }
              allFetchedForDecoys.push(track);
            }

            // Ajouter UNIQUEMENT le premier résultat (le meilleur match studio) au pool de jeu
            const bestTrack = results[0];
            if (item.movie && !bestTrack.movieTitle) {
              bestTrack.movieTitle = item.movie;
            }
            addTrackToPool(bestTrack);
          }

          processed++;
          if (onProgress) {
            onProgress(Math.min(90, 50 + Math.round((processed / aiTracks.length) * 40)));
          }

          // On ne s'arrête que lorsque le pool a VRAIMENT atteint le nombre de pistes demandé
          if (pool.length >= trackCount + safetyBuffer) break;
        }
      }
    }
  }

  // 2. MODE SANS CLÉ (100% AUTONOME, INSTANTANÉ) OU COMPLÉMENT SI QUOTA IA INSUFFISANT
  if (pool.length < trackCount) {
    if (onProgress) onProgress(40, isCustom ? "Recherche musicale sur votre thème..." : "Finalisation de la playlist...");

    const queriesToUse = isCustom && customPrompt
      ? getSmartThemeQueries(customPrompt)
      : (category.queries || []);

    const shuffledQueries = shuffleArray(queriesToUse);

    for (const q of shuffledQueries) {
      const results = await searchTrack(q, category.country || 'FR');

      // On conserve tous les résultats pour les leurres
      for (const track of results) {
        allFetchedForDecoys.push(track);
      }

      // N'ajouter qu'un seul morceau par recherche
      const shuffledResults = shuffleArray(results);
      for (const track of shuffledResults) {
        if (addTrackToPool(track)) {
          break;
        }
      }
      if (pool.length >= trackCount + 4) break;
    }

    // Filet de sécurité ultime pour garantir à 100% le nombre de morceaux choisi par l'utilisateur
    if (pool.length < trackCount) {
      for (const track of shuffleArray(allFetchedForDecoys)) {
        addTrackToPool(track);
        if (pool.length >= trackCount) break;
      }
    }
  }

  // Sélection aléatoire des N morceaux demandés (respect strict du nombre)
  const finalTracks = shuffleArray(pool).slice(0, trackCount);

  // 3. GÉNÉRATION DES LEURRES POUR LE MODE QCM (SANS AUCUN DOUBLON SUR TOUTE LA SESSION)
  const categoryDecoys = category.decoys || [];

  // Détermine si cette partie est axée sur des films / dessins animés / Disney / séries
  const isMovieTheme = category.id === 'disney_dessins_animes' ||
                       category.id === 'cinema_series' ||
                       (customPrompt && /\b(disney|pixar|dessin|manga|anime|anim[eé]|film|cinema|cin[eé]ma|s[eé]rie|serie|ost|b\.o\.|soundtrack)\b/i.test(customPrompt)) ||
                       finalTracks.filter(t => !!t.movieTitle).length >= Math.max(1, Math.floor(finalTracks.length / 3));

  const rawGlobalDecoys = [
    // Priorité 1 : les leurres thématiques ciblés générés par l'IA
    ...aiDecoys.map(d => ({ title: d.title, artist: d.artist, movieTitle: d.movie || d.movieTitle || null })),
    // Priorité 2 : les alternatives réelles issues des recherches iTunes
    ...allFetchedForDecoys,
    // Priorité 3 : les morceaux alternatifs du pool
    ...pool,
    // Priorité 4 : les leurres prédéfinis de la catégorie
    ...categoryDecoys.map(d => ({ title: d.title, artist: d.artist, movieTitle: d.movie || d.movieTitle || null }))
  ];

  // RÈGLE D'OR : En thème film/Disney, aucun leurre sans nom de film/Disney n'a le droit d'entrer !
  const globalDecoys = isMovieTheme
    ? rawGlobalDecoys.filter(d => !!(d.movieTitle || d.movie))
    : rawGlobalDecoys;

  // Ensemble pour mémoriser les leurres déjà utilisés dans la partie (afin d'éviter les répétitions)
  const sessionUsedDecoyKeys = new Set(finalTracks.map(t => canonicalKey(t.title)));

  const preparedTracks = finalTracks.map((track) => {
    const chosenDecoys = [];
    const shuffledCandidates = shuffleArray(globalDecoys);
    const trackMovie = track.movieTitle || track.movie || null;
    const treatAsMovie = isMovieTheme || !!trackMovie;

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

      const candMovie = cand.movieTitle || cand.movie || null;

      // Si le morceau est un film/dessin animé :
      if (treatAsMovie) {
        if (!candMovie) continue;
        if (trackMovie && canonicalKey(candMovie) === canonicalKey(trackMovie)) continue;
        if (chosenDecoys.some(d => canonicalKey(d.movieTitle || d.movie) === canonicalKey(candMovie))) continue;
      }

      sessionUsedDecoyKeys.add(candKey);
      chosenDecoys.push({
        title: cand.title,
        artist: cand.artist,
        movieTitle: candMovie
      });

      if (chosenDecoys.length === 3) break;
    }

    // 2ème passe : si la session est longue et le vivier épuisé, réutiliser des candidats du vivier sans doublon au sein du même tour
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

        const candMovie = cand.movieTitle || cand.movie || null;

        if (treatAsMovie) {
          if (!candMovie) continue;
          if (trackMovie && canonicalKey(candMovie) === canonicalKey(trackMovie)) continue;
          if (chosenDecoys.some(d => canonicalKey(d.movieTitle || d.movie) === canonicalKey(candMovie))) continue;
        }

        localUsedKeys.add(candKey);
        chosenDecoys.push({
          title: cand.title,
          artist: cand.artist,
          movieTitle: candMovie
        });

        if (chosenDecoys.length === 3) break;
      }
    }

    // 3ème passe : si le vivier est encore insuffisant, puiser dans les viviers universels thématiques
    if (chosenDecoys.length < 3) {
      const backupList = treatAsMovie ? UNIVERSAL_MOVIE_DECOYS : EXTENDED_UNIVERSAL_DECOYS;

      for (const u of shuffleArray(backupList)) {
        const uKey = canonicalKey(u.title);
        const uMovie = u.movieTitle || u.movie || null;

        if (areTitlesEquivalent(u.title, track.title)) continue;
        if (sessionUsedDecoyKeys.has(uKey)) continue;

        if (treatAsMovie) {
          if (!uMovie) continue;
          if (trackMovie && canonicalKey(uMovie) === canonicalKey(trackMovie)) continue;
          if (chosenDecoys.some(d => canonicalKey(d.movieTitle || d.movie) === canonicalKey(uMovie))) continue;
        }

        sessionUsedDecoyKeys.add(uKey);
        chosenDecoys.push({
          title: u.title,
          artist: u.artist,
          movieTitle: uMovie
        });

        if (chosenDecoys.length === 3) break;
      }
    }

    // 4ème passe : garantie absolue sans jamais de hors-sujet ni de "Titre Mystère"
    if (chosenDecoys.length < 3) {
      const backupList = treatAsMovie ? UNIVERSAL_MOVIE_DECOYS : EXTENDED_UNIVERSAL_DECOYS;
      const localUsedKeys = new Set([
        canonicalKey(track.title),
        ...chosenDecoys.map(d => canonicalKey(d.title))
      ]);

      for (const u of shuffleArray(backupList)) {
        const uKey = canonicalKey(u.title);
        const uMovie = u.movieTitle || u.movie || null;

        if (!uKey || localUsedKeys.has(uKey)) continue;
        if (areTitlesEquivalent(u.title, track.title)) continue;

        if (treatAsMovie) {
          if (!uMovie) continue;
          if (trackMovie && canonicalKey(uMovie) === canonicalKey(trackMovie)) continue;
          if (chosenDecoys.some(d => canonicalKey(d.movieTitle || d.movie) === canonicalKey(uMovie))) continue;
        }

        localUsedKeys.add(uKey);
        chosenDecoys.push({
          title: u.title,
          artist: u.artist,
          movieTitle: uMovie
        });

        if (chosenDecoys.length === 3) break;
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
