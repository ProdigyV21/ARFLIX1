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
        JSON.stringify({ error: "Missing id parameter", subtitles: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract IMDb ID (with tt prefix)
    let imdbId = id.startsWith('tt') ? id : `tt${id}`;
    const subtitles: Subtitle[] = [];

    try {
      // Use direct download URLs from OpenSubtitles REST API (older but works without auth)
      // These URLs are accessible from edge functions
      const imdbNumeric = imdbId.replace('tt', '');
      const osUrl = (season && episode)
        ? `https://dl.opensubtitles.org/en/download/sublanguageid-eng/subformat-srt/imdbid-${imdbNumeric}/season-${season}/episode-${episode}`
        : `https://dl.opensubtitles.org/en/download/sublanguageid-eng/subformat-srt/imdbid-${imdbNumeric}`;

      console.log('[subtitles] Trying OpenSubtitles download URL:', osUrl);

      const osResponse = await fetch(osUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'ArFlix v1.0'
        },
        redirect: 'follow'
      });

      console.log('[subtitles] Response status:', osResponse.status, 'Content-Type:', osResponse.headers.get('content-type'));

      // If the direct download approach doesn't work, try the search API
      if (!osResponse.ok || osResponse.status === 404) {
        console.log('[subtitles] Direct download failed, trying search API');
        
        // Try alternative: Use a CORS proxy or return empty for now
        // The REST API at rest.opensubtitles.org has DNS issues from edge functions
        throw new Error('OpenSubtitles REST API not accessible from edge function');
      }

      // Process the response if we got subtitle data
      const contentType = osResponse.headers.get('content-type') || '';
      if (contentType.includes('application/x-gzip') || contentType.includes('application/gzip')) {
        console.log('[subtitles] Got gzipped subtitle, adding to results');
        subtitles.push({
          id: '1',
          language: 'English',
          languageCode: 'en',
          url: osUrl,
          label: 'English (srt)',
          format: 'srt'
        });
      }
    } catch (osError: any) {
      console.error('[subtitles] Error:', osError.message);
    }

    return new Response(
      JSON.stringify({ subtitles }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error('[subtitles] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error", subtitles: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
