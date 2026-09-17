/**
 * Cloudflare Worker - Proxy Google Gemini pour BlindTest Party
 * 
 * Ce script facultatif permet d'héberger un proxy serverless 100% gratuit sur Cloudflare Workers
 * si vous souhaitez que vos amis puissent utiliser Google Gemini sans avoir à saisir eux-mêmes
 * une clé d'API dans leur navigateur.
 * 
 * ÉTAPES D'INSTALLATION (2 minutes, gratuit sans carte bancaire) :
 * 1. Créez un compte gratuit sur https://workers.cloudflare.com
 * 2. Créez un nouveau Worker (ex: "blindtest-ai")
 * 3. Collez ce code dans l'éditeur Cloudflare
 * 4. Dans Settings > Variables > Environment Variables, ajoutez :
 *    - Variable Name: GEMINI_API_KEY
 *    - Value: Votre clé API Google AI Studio (https://aistudio.google.com)
 *    - Cochez "Encrypt"
 * 5. Déployez le Worker !
 * 6. Dans BlindTest > Réglages IA, renseignez l'URL de votre Worker (ex: https://blindtest-ai.votre-pseudo.workers.dev)
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY non configurée sur le Worker.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      let prompt = '';
      if (request.method === 'POST') {
        const body = await request.json();
        prompt = body.prompt;
      } else {
        const url = new URL(request.url);
        prompt = url.searchParams.get('prompt') || '';
      }

      if (!prompt) {
        return new Response(JSON.stringify({ error: 'Paramètre prompt manquant.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const geminiUrl = https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=;
      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.8,
          },
        }),
      });

      if (!geminiResponse.ok) {
        const errText = await geminiResponse.text();
        return new Response(JSON.stringify({ error: Erreur Gemini: , details: errText }), {
          status: geminiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await geminiResponse.json();
      const contentText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      return new Response(contentText || '[]', {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
