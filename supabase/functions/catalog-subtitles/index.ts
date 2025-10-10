import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Subtitle {
  id: string;
  language: string;
  languageCode: string;
  url: string;
  label: string;
  format: string;
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
        JSON.stringify({ error: "Missing id parameter", subtitles: [], debug: 'no id' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract IMDb ID
    let imdbId = id.startsWith('tt') ? id.replace('tt', '') : id;
    
    const subtitles: Subtitle[] = [];
    let debugInfo: any = { imdbId, season, episode };

    try {
      const osUrl = (season && episode)
        ? `https://rest.opensubtitles.org/search/episode-${episode}/imdbid-${imdbId}/season-${season}/sublanguageid-all`
        : `https://rest.opensubtitles.org/search/imdbid-${imdbId}/sublanguageid-all`;

      debugInfo.osUrl = osUrl;

      const osResponse = await fetch(osUrl, {
        headers: {
          'User-Agent': 'Arflix v1.0'
        }
      });

      debugInfo.status = osResponse.status;
      debugInfo.statusText = osResponse.statusText;

      if (osResponse.ok) {
        const responseText = await osResponse.text();
        debugInfo.responseLength = responseText.length;
        debugInfo.responsePreview = responseText.substring(0, 200);
        
        const osData = JSON.parse(responseText);
        debugInfo.resultCount = Array.isArray(osData) ? osData.length : 'not-array';

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
        const errorText = await osResponse.text();
        debugInfo.errorText = errorText.substring(0, 200);
      }
    } catch (osError: any) {
      debugInfo.fetchError = osError.message || String(osError);
    }

    return new Response(
      JSON.stringify({ subtitles, debug: debugInfo }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error", subtitles: [], debug: 'fatal-error' }),
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
