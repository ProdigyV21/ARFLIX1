import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY") || "";
const TMDB_BASE = "https://api.themoviedb.org/3";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const tmdbId = pathParts[pathParts.length - 1];

    if (!tmdbId) {
      return new Response(
        JSON.stringify({ error: "Missing TMDB ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}?api_key=${TMDB_API_KEY}`);
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch show details" }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const seasons = (data.seasons || []).map((s: any) => ({
      seasonNumber: s.season_number,
      episodeCount: s.episode_count,
      name: s.name,
      poster: s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : null,
      airDate: s.air_date,
    }));

    return new Response(
      JSON.stringify({ seasons }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Seasons error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error", seasons: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});