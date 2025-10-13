import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
    const type = url.searchParams.get("type") || "movie";
    const season = url.searchParams.get("season");
    const episode = url.searchParams.get("episode");

    if (!id) {
      return new Response(
        JSON.stringify({ error: "Missing id parameter", subtitles: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with auth from request
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // Get user's enabled addons
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('[subtitles] No authenticated user, returning empty subtitles');
      return new Response(
        JSON.stringify({ subtitles: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: addons } = await supabase
      .from("addons")
      .select("*")
      .eq("user_id", user.id)
      .eq("enabled", true);

    if (!addons || addons.length === 0) {
      console.log('[subtitles] No enabled addons found');
      return new Response(
        JSON.stringify({ subtitles: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract IMDb ID (with tt prefix)
    let imdbId = id.startsWith('tt') ? id : `tt${id}`;
    
    // Build the video ID for Stremio addons
    let videoId = imdbId;
    if (type === 'series' && season && episode) {
      videoId = `${imdbId}:${season}:${episode}`;
    }

    const subtitles: Subtitle[] = [];

    // Query each addon's subtitles endpoint
    for (const addon of addons) {
      try {
        const manifestUrl = addon.manifest_url;
        
        // Fetch manifest to check if addon provides subtitles
        const manifestRes = await fetch(manifestUrl);
        if (!manifestRes.ok) continue;
        
        const manifest = await manifestRes.json();
        
        // Check if addon provides subtitles resource
        if (!manifest.resources || !manifest.resources.includes('subtitles')) {
          console.log(`[subtitles] Addon ${addon.id} does not provide subtitles`);
          continue;
        }

        // Build subtitles URL
        const subtitlesUrl = manifestUrl.replace("/manifest.json", "") + `/subtitles/${type}/${videoId}.json`;
        console.log(`[subtitles] Fetching from addon: ${subtitlesUrl}`);

        const subtitlesRes = await fetch(subtitlesUrl, {
          headers: {
            'User-Agent': 'ArFlix v1.0'
          }
        });

        if (!subtitlesRes.ok) {
          console.log(`[subtitles] Addon returned ${subtitlesRes.status}`);
          continue;
        }

        const subtitlesData = await subtitlesRes.json();
        
        if (subtitlesData.subtitles && Array.isArray(subtitlesData.subtitles)) {
          console.log(`[subtitles] Found ${subtitlesData.subtitles.length} subtitles from addon ${addon.id}`);
          
          // Add subtitles to results
          for (const sub of subtitlesData.subtitles) {
            subtitles.push({
              id: sub.id || `${addon.id}-${subtitles.length}`,
              language: sub.lang || 'Unknown',
              languageCode: sub.lang || 'unknown',
              url: sub.url,
              label: `${sub.lang || 'Unknown'} (${addon.name || 'Unknown'})`,
              format: 'srt' // Most Stremio addons provide SRT
            });
          }
        }
      } catch (addonError: any) {
        console.error(`[subtitles] Error fetching from addon ${addon.id}:`, addonError.message);
      }
    }

    console.log(`[subtitles] Returning ${subtitles.length} total subtitles`);

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
