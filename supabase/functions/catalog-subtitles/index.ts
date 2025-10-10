import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY") || "";

interface Subtitle {
  id: string;
  language: string;
  languageCode: string;
  url: string;
  label: string;
  format: string;
}

async function getTMDBImdbId(tmdbId: string, type: string): Promise<string | null> {
  if (!TMDB_API_KEY) return null;

  try {
    const endpoint = type === 'movie'
      ? `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids`
      : `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids`;

    const response = await fetch(`${endpoint}?api_key=${TMDB_API_KEY}`);
    if (!response.ok) return null;

    const data = await response.json();
    return data.imdb_id || null;
  } catch (error) {
    console.error('[subtitles] Failed to get IMDB ID:', error);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const season = url.searchParams.get("season");
    const episode = url.searchParams.get("episode");

    if (!id) {
      return new Response(
        JSON.stringify({ error: "Missing id parameter", subtitles: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle both IMDb IDs (tt123456) and structured IDs (tmdb:movie:123)
    let imdbId: string | null = null;

    if (id.startsWith('tt')) {
      // Direct IMDb ID
      imdbId = id;
      console.log('[subtitles] Using direct IMDb ID:', imdbId);
    } else {
      // Structured ID format
      const [source, type, sourceId] = id.split(':');

      if (source !== 'tmdb') {
        return new Response(
          JSON.stringify({ subtitles: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tmdbId = sourceId;
      imdbId = await getTMDBImdbId(tmdbId, type);
    }

    if (!imdbId) {
      console.log('[subtitles] No IMDB ID found');
      return new Response(
        JSON.stringify({ subtitles: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use OpenSubtitles.com API with API key from env
    const OS_API_KEY = Deno.env.get("OPENSUBTITLES_API_KEY");

    if (!OS_API_KEY) {
      console.log('[subtitles] No OpenSubtitles API key configured');
      return new Response(
        JSON.stringify({ subtitles: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const languageCodes = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ar'];
    const subtitles: Subtitle[] = [];

    try {
      // Build query params
      const params = new URLSearchParams({
        imdb_id: imdbId.replace('tt', ''),
        languages: languageCodes.join(','),
      });

      if (season) params.append('season_number', season);
      if (episode) params.append('episode_number', episode);

      const searchUrl = `https://api.opensubtitles.com/api/v1/subtitles?${params.toString()}`;
      console.log('[subtitles] Searching:', searchUrl);

      const response = await fetch(searchUrl, {
        headers: {
          'Api-Key': OS_API_KEY,
          'User-Agent': 'ArFlix v1.0',
        },
      });

      if (!response.ok) {
        console.error('[subtitles] API error:', response.status, await response.text());
        return new Response(
          JSON.stringify({ subtitles: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const results = data.data || [];
      console.log(`[subtitles] Found ${results.length} subtitle results`);

      const seenLangs = new Set<string>();

      for (const result of results) {
        const langCode = result.attributes?.language;
        if (!langCode || seenLangs.has(langCode)) continue;

        const fileId = result.attributes?.files?.[0]?.file_id;
        if (!fileId) continue;

        seenLangs.add(langCode);

        // Download link from OpenSubtitles API
        const downloadUrl = `https://api.opensubtitles.com/api/v1/download`;

        const proxyUrl = new URL(req.url);
        const baseUrl = `https://${proxyUrl.host}`;
        const proxiedUrl = `${baseUrl}/functions/v1/proxy-subtitle?url=${encodeURIComponent(downloadUrl)}&file_id=${fileId}&api_key=${encodeURIComponent(OS_API_KEY)}`;

        console.log(`[subtitles] Adding ${langCode} subtitle`);

        subtitles.push({
          id: fileId.toString(),
          language: getLangLabel(langCode),
          languageCode: langCode,
          url: proxiedUrl,
          label: getLangLabel(langCode),
          format: 'vtt',
        });
      }
    } catch (err) {
      console.error('[subtitles] Search error:', err);
    }

    console.log(`[subtitles] Found ${subtitles.length} subtitle languages for ${imdbId}`);

    return new Response(
      JSON.stringify({ subtitles }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error('[subtitles] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error", subtitles: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getLangCode(osLang: string): string {
  const map: Record<string, string> = {
    'eng': 'en', 'spa': 'es', 'fre': 'fr', 'ger': 'de',
    'ita': 'it', 'por': 'pt', 'jpn': 'ja', 'kor': 'ko',
    'chi': 'zh', 'ara': 'ar',
  };
  return map[osLang] || osLang;
}

function getLangLabel(langCode: string): string {
  const map: Record<string, string> = {
    'en': 'English', 'es': 'Español', 'fr': 'Français', 'de': 'Deutsch',
    'it': 'Italiano', 'pt': 'Português', 'ja': '日本語', 'ko': '한국어',
    'zh': '中文', 'ar': 'العربية',
  };
  return map[langCode] || langCode.toUpperCase();
}
