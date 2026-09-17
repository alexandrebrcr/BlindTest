// Module Générateur Musical par IA (LLM ouvert sans clé d'API, prompt anti-clichés)

// Module Générateur Musical par IA (LLM ouvert sans clé d'API, prompt anti-clichés)

export async function generateTracksFromAI(themeDescription, count = 10) {
  const prompt = `Tu es programmateur musical pour un blind test.
Génère une sélection de ${count} chansons variées, emblématiques et reconnaissables pour le thème : "${themeDescription}".
Consignes :
- Évite les clichés ultra-évidents ou sur-joués, surprends les joueurs avec de superbes pépites connues du genre.
- Exclus les artistes accusés ou condamnés pour violences.
- Format strict JSON uniquement, pas de texte avant ni après :
[{"title": "Nom du morceau", "artist": "Nom de l'artiste"}]`;

  // Timeout généreux de 12 secondes adapté au temps de réponse des LLMs sur mobile
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://text.pollinations.ai/${encodedPrompt}?json=true&seed=${Math.floor(Math.random() * 1000000)}`;

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json, text/plain, */*'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Le service IA a retourné le statut HTTP ${response.status}`);
      return null;
    }

    const rawText = await response.text();
    if (!rawText || rawText.trim().length === 0) return null;

    // Nettoyage des éventuels blocs de code markdown ```json ... ```
    let cleanedJson = rawText.trim();
    if (cleanedJson.includes('```')) {
      cleanedJson = cleanedJson.replace(/```(?:json)?([\s\S]*?)```/g, '$1').trim();
    }

    let parsed = null;
    try {
      parsed = JSON.parse(cleanedJson);
    } catch {
      const firstBracket = cleanedJson.indexOf('[');
      const lastBracket = cleanedJson.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        try {
          parsed = JSON.parse(cleanedJson.substring(firstBracket, lastBracket + 1));
        } catch (e) {
          console.warn("Échec parsing extrait JSON:", e);
        }
      }
    }

    // Récupération de la liste (que ce soit un tableau direct ou contenu dans une clé d'objet)
    let rawList = [];
    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const foundArray = Object.values(parsed).find(Array.isArray);
      if (foundArray) rawList = foundArray;
    }

    if (rawList.length === 0) return null;

    // Filtrage et validation des données reçues (support des clés françaises et anglaises)
    const validTracks = rawList
      .filter(item => item && (item.title || item.titre || item.titreFrançais || item.track) && (item.artist || item.artiste || item.author || item.singer))
      .map(item => ({
        title: String(item.title || item.titre || item.titreFrançais || item.track).trim(),
        artist: String(item.artist || item.artiste || item.author || item.singer).trim()
      }))
      .filter(item => item.title.length > 1 && item.artist.length > 1);

    return validTracks.length > 0 ? validTracks : null;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Erreur ou timeout lors de l\'appel à l\'IA:', err.name === 'AbortError' ? 'Délai d\'attente dépassé (timeout 12s)' : err.message);
    return null;
  }
}
