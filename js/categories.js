// Définition des catégories de Blind Test et de leurs morceaux/artistes cultes

export const CATEGORIES = [
  {
    id: 'rap_fr',
    name: 'Rap Français',
    icon: '🔥',
    color: '#ff0055',
    description: 'De NTM et IAM jusqu\'à Jul, Orelsan, PNL et Ninho',
    country: 'FR',
    queries: [
      'Jul bande organisée', 'Orelsan la terre est ronde', 'PNL au dd',
      'Ninho lettre a une femme', 'Booba dkr', 'Damso macarena',
      'Nekfeu on verra', 'IAM le mia', 'Suprême NTM seine saint denis style',
      'Soprano en feu', 'SCH bande organisée', 'Lomepal trop beau',
      'Gazo die', 'Gims bella', 'Vald desaccordes', 'Aya Nakamura djadja',
      'Kaaris tchoin', 'Heuss l\'enfoire moulaga', 'PLK un peu de haine'
    ]
  },
  {
    id: 'annees_80',
    name: 'Années 80',
    icon: '🕺',
    color: '#ff00d4',
    description: 'Les plus grands tubes disco, synthwave et new-wave',
    country: 'FR',
    queries: [
      'Michael Jackson billie jean', 'Madonna like a virgin', 'Indochine l aventurier',
      'Balavoine tous les cris les sos', 'Debut de soiree nuit de folie', 'Queen another one bites the dust',
      'Cyndi Lauper girls just want to have fun', 'Gilbert Montagne sous les sunlights des tropiques',
      'Wham wake me up before you go go', 'A-ha take on me', 'Gold ville de lumiere',
      'Eurythmics sweet dreams', 'Desireless voyage voyage', 'Partenaire Particulier',
      'Emile et Images les demons de minuit', 'Jean Schultheis confiance pour confiance',
      'Earth Wind and Fire let s groove', 'Rick Astley never gonna give you up'
    ]
  },
  {
    id: 'annees_90_2000',
    name: 'Années 90 & 2000',
    icon: '💿',
    color: '#00f2fe',
    description: 'L\'âge d\'or MTV, les boys bands, l\'eurodance et les hymnes 2000',
    country: 'FR',
    queries: [
      'Britney Spears baby one more time', 'Daft Punk one more time', 'Eminem without me',
      'Manau la tribu de dana', 'Kyo derniere danse', 'Diams la boulette',
      'Shakira whenever wherever', 'Beyonce crazy in love', 'Louise Attaque j t emmene au vent',
      'Black Eyed Peas i gotta feeling', 'Linkin Park in the end', 'Avril Lavigne complicated',
      'Rihanna umbrella', 'Alizee moi lolita', 'Celine Dion pour que tu m aimes encore',
      'Gala freed from desire', 'Corona the rhythm of the night', 'Coolio gangsta s paradise'
    ]
  },
  {
    id: 'rock_classics',
    name: 'Rock Classics',
    icon: '🎸',
    color: '#ff9900',
    description: 'Riffs légendaires, solos mythiques et légendes du rock',
    country: 'US',
    queries: [
      'Queen bohemian rhapsody', 'AC DC highway to hell', 'Nirvana smells like teen spirit',
      'The Beatles let it be', 'Rolling Stones paint it black', 'Pink Floyd another brick in the wall',
      'Guns N Roses sweet child o mine', 'Red Hot Chili Peppers californication', 'Telephone ca c est vraiment toi',
      'Oasis wonderwall', 'Led Zeppelin stairway to heaven', 'The Cranberries zombie',
      'Deep Purple smoke on the water', 'The Police roxanne', 'U2 with or without you',
      'Bon Jovi livin on a prayer', 'Scorpions wind of change', 'Dire Straits sultans of swing'
    ]
  },
  {
    id: 'pop_internationale',
    name: 'Pop Internationale',
    icon: '✨',
    color: '#9d00ff',
    description: 'Les méga-hits mondiaux qui cartonnent sur toutes les radios',
    country: 'US',
    queries: [
      'Taylor Swift shake it off', 'The Weeknd blinding lights', 'Dua Lipa levitating',
      'Bruno Mars uptown funk', 'Billie Eilish bad guy', 'Ed Sheeran shape of you',
      'Ariana Grande 7 rings', 'Coldplay viva la vida', 'Harry Styles as it was',
      'Sia chandelier', 'Justin Bieber stay', 'Katy Perry roar',
      'Lady Gaga bad romance', 'Miley Cyrus flowers', 'Imagine Dragons radioactive',
      'Maroon 5 sugar', 'Adele rolling in the deep', 'Stromae alors on danse'
    ]
  },
  {
    id: 'disney_dessins_animes',
    name: 'Disney & Enfance',
    icon: '🏰',
    color: '#00e5ff',
    description: 'Les plus beaux classiques d\'animation Disney et génériques cultes',
    country: 'FR',
    queries: [
      'Disney le roi lion histoire de la vie', 'Disney la reine des neiges liberee delivree',
      'Disney aladdin ce reve bleu', 'Disney tarzan entre deux mondes',
      'Pokemon un jour je serai le meilleur dresseur', 'Disney hercule zero en heros',
      'Disney vaiana le bleu lumiere', 'Disney mulan comme un homme',
      'Disney le livre de la jungle il en faut peu pour etre heureux',
      'Disney la belle et la bete c est la fete', 'Disney raiponce ou est la vraie vie',
      'Les Mysterieuses Cites d or generique', 'Disney encanto ne parlons pas de bruno'
    ]
  },
  {
    id: 'cinema_series',
    name: 'Cinéma & Séries',
    icon: '🎬',
    color: '#e6c800',
    description: 'Bandes originales légendaires du grand et du petit écran',
    country: 'US',
    queries: [
      'John Williams star wars main theme', 'Hans Zimmer pirates of the caribbean',
      'John Williams harry potter hedwig theme', 'Ramin Djawadi game of thrones',
      'Hans Zimmer gladiator now we are free', 'Howard Shore the lord of the rings concerning hobbits',
      'Hans Zimmer interstellar main theme', 'Ennio Morricone the good the bad and the ugly',
      'John Williams jurassic park theme', 'Monty Norman james bond theme',
      'Alan Silvestri the avengers theme', 'Clint Mansell requiem for a dream lux aeterna',
      'Brad Fiedel the terminator theme', 'John Williams indiana jones theme'
    ]
  },
  {
    id: 'variete_francaise',
    name: 'Variété Française',
    icon: '🍷',
    color: '#00d26a',
    description: 'Les grands classiques de la chanson et du patrimoine français',
    country: 'FR',
    queries: [
      'Jean-Jacques Goldman envole-moi', 'Renaud des que le vent soufflera',
      'Francis Cabrel la corrida', 'Johnny Hallyday allumer le feu',
      'Charles Aznavour la boheme', 'Daniel Balavoine je ne suis pas un heros',
      'Michel Sardou les lacs du connemara', 'Jacques Brel ne me quitte pas',
      'Claude Francois alexandrie alexandra', 'Vianney beau-papa',
      'Florent Pagny savoir aimer', 'Christophe ma reveuse'
    ]
  }
];

export function getCategoryById(id) {
  return CATEGORIES.find(cat => cat.id === id) || CATEGORIES[0];
}
