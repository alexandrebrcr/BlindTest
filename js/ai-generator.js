// Module Générateur Musical par IA (LLM ouvert sans clé d'API, prompt anti-clichés)

export async function generateTracksFromAI(themeDescription, count = 12) {
  const prompt = `Tu es un programmateur musical expert pour des parties de Blind Test captivantes et conviviales.
Propose une sélection de ${count} chansons pour le thème suivant : "${themeDescription}".

Consignes très importantes :
1. Mélange des classiques incontournables et de superbes morceaux très connus des amateurs de ce genre.
2. Évite absolument de choisir uniquement les 3 ou 4 clichés les plus évidents et rabâchés, pour garantir la surprise et le plaisir de chercher.
3. Chaque chanson doit être réellement sortie dans le commerce et trouvable facilement sur les plateformes de streaming.
4. Réponds UNIQUEMENT et STRICTEMENT sous forme d'un tableau JSON d'objets, comme ceci :
[
  {"title": "Nom du morceau", "artist": "Nom de l'artiste"}
]
Ne mets aucun texte avant ou après le tableau JSON, pas d'explication.`;

  // Gestion d'un timeout strict de 5 secondes pour ne jamais faire attendre le joueur
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5500);

  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://text.pollinations.ai/${encodedPrompt}?json=true&model=openai&seed=${Math.floor(Math.random() * 100000)}`;

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

    // Extraction du tableau JSON si du texte superflu entoure la réponse
    const firstBracket = cleanedJson.indexOf('[');
    const lastBracket = cleanedJson.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      cleanedJson = cleanedJson.substring(firstBracket, lastBracket + 1);
    }

    const parsed = JSON.parse(cleanedJson);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    // Filtrage et validation des données reçues
    const validTracks = parsed
      .filter(item => item && item.title && item.artist)
      .map(item => ({
        title: String(item.title).trim(),
        artist: String(item.artist).trim()
      }));

    return validTracks.length > 0 ? validTracks : null;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Erreur ou timeout lors de l\'appel à l\'IA:', err.name === 'AbortError' ? 'Délai d\'attente dépassé (timeout)' : err.message);
    return null;
  }
}
