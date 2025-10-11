import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SubtitleResult {
  languageCode: string;
  label: string;
  url: string;
  format: string;
}

async function searchOpenSubtitles(
  imdbId: string,
  seasonNumber?: number,
  episodeNumber?: number
): Promise<SubtitleResult[]> {
  const subtitles: SubtitleResult[] = [];
  
  try {
    // Use OpenSubtitles.com API v3 (used by Stremio, no API key required for basic access)
    let searchUrl = `https://api.opensubtitles.com/api/v1/subtitles`;
    const params = new URLSearchParams();
    params.append('imdb_id', imdbId.replace('tt', ''));
    
    if (seasonNumber && episodeNumber) {
      params.append('season_number', seasonNumber.toString());
      params.append('episode_number', episodeNumber.toString());
      params.append('type', 'episode');
    } else {
      params.append('type', 'movie');
    }
    
    // Get English and Spanish subtitles
    params.append('languages', 'en,es');
    
    searchUrl += '?' + params.toString();
    
    console.log('[Subtitles] Searching OpenSubtitles v3:', searchUrl);
    
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "ArFlix v1.0",
        "Api-Key": "", // v3 allows empty API key for limited access
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
    
    console.log('[Subtitles] OpenSubtitles v3 response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('[Subtitles] OpenSubtitles v3 error:', response.status, errorText);
      return subtitles;
    }
    
    const data = await response.json();
    const results = data.data || [];
    
    if (!Array.isArray(results) || results.length === 0) {
      console.log('[Subtitles] No subtitles found from OpenSubtitles v3');
      return subtitles;
    }
    
    console.log('[Subtitles] Found', results.length, 'results from OpenSubtitles v3');
    
    // Group by language and take the best rated/downloaded one per language
    const byLanguage = new Map<string, any>();
    
    for (const sub of results) {
      const lang = sub.attributes?.language || 'en';
      const existing = byLanguage.get(lang);
      
      // Prefer higher rated and more downloaded subtitles
      const rating = parseFloat(sub.attributes?.ratings || '0');
      const downloads = parseInt(sub.attributes?.download_count || '0');
      const score = rating * 100 + downloads;
      
      const existingScore = existing ? 
        (parseFloat(existing.attributes?.ratings || '0') * 100 + parseInt(existing.attributes?.download_count || '0')) : 0;
      
      if (!existing || score > existingScore) {
        byLanguage.set(lang, sub);
      }
    }
    
    // Convert to subtitle results - prioritize English
    const priorityOrder = ['en', 'eng'];
    const orderedLanguages = [...byLanguage.keys()].sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a);
      const bIndex = priorityOrder.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
    
    for (const lang of orderedLanguages) {
      const sub = byLanguage.get(lang)!;
      const fileData = sub.attributes?.files?.[0];
      
      if (fileData?.file_id) {
        // OpenSubtitles v3 download URL format
        const file_id = fileData.file_id;
        const downloadUrl = `https://www.opensubtitles.com/download/${file_id}`;
        
        subtitles.push({
          languageCode: lang,
          label: `${sub.attributes?.feature_details?.movie_name || sub.attributes?.release || 'Subtitle'} (${lang.toUpperCase()})`,
          url: downloadUrl,
          format: 'srt',
        });
      }
    }
    
    console.log('[Subtitles] Returning', subtitles.length, 'subtitle tracks from OpenSubtitles v3');
    
  } catch (error: any) {
    console.error('[Subtitles] OpenSubtitles v3 error:', error.message);
  }
  
  return subtitles;
}


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  
  try {
    const url = new URL(req.url);
    const contentId = url.searchParams.get("contentId");
    const seasonNumber = url.searchParams.get("season");
    const episodeNumber = url.searchParams.get("episode");
    
    if (!contentId) {
      return new Response(
        JSON.stringify({ error: "contentId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log('[Subtitles] Request:', { contentId, seasonNumber, episodeNumber });
    
    let subtitles: SubtitleResult[] = [];
    
    // Try fetching from subtitle addons first (OpenSubtitles addon, Subsource, etc.)
    try {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") || "",
          Deno.env.get("SUPABASE_ANON_KEY") || "",
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: addons } = await supabase
            .from("addons")
            .select("*")
            .eq("user_id", user.id)
            .eq("enabled", true);

          if (addons && addons.length > 0) {
            console.log('[Subtitles] Found', addons.length, 'user addons');
            
            for (const addon of addons) {
              try {
                // Extract base URL from manifest_url or url
                const manifestUrl = addon.manifest_url || addon.url;
                const baseUrl = manifestUrl.replace(/\/manifest\.json$/, '');
                
                // Build subtitle endpoint URL
                const type = seasonNumber ? 'series' : 'movie';
                let subtitleId = contentId;
                
                // Format ID for series: imdbId:season:episode
                if (seasonNumber && episodeNumber) {
                  // If TMDB ID, we need IMDb for addons
                  if (contentId.startsWith('tmdb:')) {
                    // Resolve to IMDb
                    const tmdbId = contentId.replace('tmdb:', '').replace(/^(movie|tv):/, '');
                    const tmdbApiKey = Deno.env.get("TMDB_API_KEY") || '080380c1ad7b3967af3def25159e4374';
                    const tmdbUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${tmdbApiKey}`;
                    
                    const tmdbResponse = await fetch(tmdbUrl, { signal: AbortSignal.timeout(3000) });
                    if (tmdbResponse.ok) {
                      const externalIds = await tmdbResponse.json();
                      if (externalIds.imdb_id) {
                        subtitleId = `${externalIds.imdb_id}:${seasonNumber}:${episodeNumber}`;
                      }
                    }
                  } else if (contentId.startsWith('tt')) {
                    subtitleId = `${contentId}:${seasonNumber}:${episodeNumber}`;
                  }
                }
                
                const subtitleUrl = `${baseUrl}/subtitles/${type}/${encodeURIComponent(subtitleId)}.json`;
                console.log('[Subtitles] Trying addon:', addon.name, subtitleUrl);
                
                const addonResponse = await fetch(subtitleUrl, {
                  headers: { "Accept": "application/json", "User-Agent": "ArFlix/1.0" },
                  signal: AbortSignal.timeout(5000),
                });
                
                if (addonResponse.ok) {
                  const data = await addonResponse.json();
                  console.log('[Subtitles] Addon response:', JSON.stringify(data).substring(0, 200));
                  
                  if (data.subtitles && Array.isArray(data.subtitles)) {
                    for (const sub of data.subtitles) {
                      if (sub.url) {
                        subtitles.push({
                          languageCode: sub.lang || 'en',
                          label: `${sub.lang?.toUpperCase() || 'EN'} (${addon.name})`,
                          url: sub.url,
                          format: sub.url.endsWith('.vtt') ? 'vtt' : 'srt',
                        });
                      }
                    }
                    console.log('[Subtitles] ✅ Found', data.subtitles.length, 'subtitles from', addon.name);
                  }
                }
              } catch (addonError: any) {
                console.log('[Subtitles] Addon error:', addon.name, addonError.message);
              }
            }
          }
        }
      }
    } catch (addonFetchError: any) {
      console.log('[Subtitles] Error fetching from addons:', addonFetchError.message);
    }
    
    // If we found subtitles from addons, return them
    if (subtitles.length > 0) {
      console.log('[Subtitles] ✅ Returning', subtitles.length, 'subtitles from addons');
      return new Response(
        JSON.stringify({ subtitles }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Fallback to OpenSubtitles API if no addon subtitles found
    console.log('[Subtitles] No addon subtitles found, trying OpenSubtitles API...');
    
    // Extract IMDb or TMDB ID
    if (contentId.startsWith('tt')) {
      // IMDb ID - use directly
      console.log('[Subtitles] Using IMDb ID directly:', contentId);
      subtitles = await searchOpenSubtitles(
        contentId,
        seasonNumber ? parseInt(seasonNumber) : undefined,
        episodeNumber ? parseInt(episodeNumber) : undefined
      );
    } else if (contentId.startsWith('tmdb:')) {
      // TMDB ID - resolve to IMDb first
      const tmdbId = contentId.replace('tmdb:', '').replace(/^(movie|tv):/, '');
      const type = contentId.includes(':tv:') || seasonNumber ? 'tv' : 'movie';
      
      try {
        const tmdbApiKey = Deno.env.get("TMDB_API_KEY") || '080380c1ad7b3967af3def25159e4374';
        const tmdbUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${tmdbApiKey}`;
        
        console.log('[Subtitles] Resolving TMDB to IMDb:', tmdbUrl);
        
        const tmdbResponse = await fetch(tmdbUrl, {
          signal: AbortSignal.timeout(5000),
        });
        
        console.log('[Subtitles] TMDB response status:', tmdbResponse.status);
        
        if (tmdbResponse.ok) {
          const externalIds = await tmdbResponse.json();
          console.log('[Subtitles] External IDs from TMDB:', JSON.stringify(externalIds));
          
          if (externalIds.imdb_id) {
            console.log('[Subtitles] ✅ Resolved TMDB to IMDb:', externalIds.imdb_id);
            subtitles = await searchOpenSubtitles(
              externalIds.imdb_id,
              seasonNumber ? parseInt(seasonNumber) : undefined,
              episodeNumber ? parseInt(episodeNumber) : undefined
            );
            console.log('[Subtitles] OpenSubtitles returned', subtitles.length, 'subtitles');
          } else {
            console.log('[Subtitles] ❌ No IMDb ID found for TMDB ID:', tmdbId);
          }
        } else {
          const errorText = await tmdbResponse.text();
          console.log('[Subtitles] ❌ TMDB API returned:', tmdbResponse.status, errorText);
        }
      } catch (e: any) {
        console.error('[Subtitles] Failed to resolve TMDB:', e.message);
      }
    }
    
    // If no subtitles found, return empty array - embedded subs will be used if available
    if (subtitles.length === 0) {
      console.log('[Subtitles] ❌ No subtitles found from OpenSubtitles v3');
      console.log('[Subtitles] 💡 Video file may have embedded subtitles instead');
    } else {
      console.log('[Subtitles] ✅ Found', subtitles.length, 'subtitle track(s)');
    }
    
    return new Response(
      JSON.stringify({ subtitles }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: any) {
    console.error('[Subtitles] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error", subtitles: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
