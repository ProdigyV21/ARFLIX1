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

    console.log('[subtitles] Fetching from OpenSubtitles for IMDb ID:', imdbId, 'season:', season, 'episode:', episode);

    const subtitles: Subtitle[] = [];

    try {
      const osUrl = (season && episode)
        ? `https://rest.opensubtitles.org/search/episode-${episode}/imdbid-${imdbId.replace('tt', '')}/season-${season}/sublanguageid-all`
        : `https://rest.opensubtitles.org/search/imdbid-${imdbId.replace('tt', '')}/sublanguageid-all`;

      console.log('[subtitles] OpenSubtitles URL:', osUrl);

      const osResponse = await fetch(osUrl, {
        headers: {
          'User-Agent': 'Arflix v1.0'
        }
      });

      if (osResponse.ok) {
        const osData = await osResponse.json();
        console.log('[subtitles] OpenSubtitles returned', osData?.length || 0, 'results');

        if (Array.isArray(osData) && osData.length > 0) {
          const seen = new Set<string>();

          for (const sub of osData) {
            const langCode = getLangCode(sub.SubLanguageID || sub.ISO639 || '');
            const key = `${langCode}-${sub.SubFormat}`;

            if (!seen.has(key) && sub.SubDownloadLink) {
              seen.add(key);

              subtitles.push({
                id: sub.IDSubtitleFile || sub.IDSubtitle,
                language: getLangLabel(langCode),
                languageCode: langCode,
                url: sub.SubDownloadLink,
                label: `${getLangLabel(langCode)} (${sub.SubFormat || 'srt'})`,
                format: sub.SubFormat || 'srt'
              });

              if (subtitles.length >= 10) break;
            }
          }
        }
      } else {
        console.error('[subtitles] OpenSubtitles response not OK:', osResponse.status, osResponse.statusText);
      }
    } catch (osError) {
      console.error('[subtitles] OpenSubtitles fetch failed:', osError);
    }

    console.log('[subtitles] Returning', subtitles.length, 'subtitles');

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
