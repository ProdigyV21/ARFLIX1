import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY") || "";
const TMDB_BASE = "https://api.themoviedb.org/3";
const ANILIST_BASE = "https://graphql.anilist.co";

async function anilistFetch(query: string, variables: any) {
  const res = await fetch(ANILIST_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList error: ${res.status}`);
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const id = pathParts[pathParts.length - 1];
    const season = url.searchParams.get("season");

    if (!id) {
      return new Response(
        JSON.stringify({ error: "Missing ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle IMDb IDs directly
    if (id.startsWith('tt')) {
      if (!season) {
        return new Response(
          JSON.stringify({ error: "Missing season parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Look up TMDB ID from IMDb ID
      const findRes = await fetch(`${TMDB_BASE}/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id`);
      if (!findRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to find TV show" }),
          { status: findRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const findData = await findRes.json();
      const tvShow = findData.tv_results?.[0];

      if (!tvShow) {
        return new Response(
          JSON.stringify({ error: "TV show not found", episodes: [] }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tmdbId = tvShow.id;
      const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}/season/${season}?api_key=${TMDB_API_KEY}`);
      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch episodes" }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();
      const episodes = (data.episodes || []).map((e: any) => ({
        episodeNumber: e.episode_number,
        title: e.name,
        overview: e.overview,
        still: e.still_path ? `https://image.tmdb.org/t/p/w500${e.still_path}` : null,
        airDate: e.air_date,
        runtime: e.runtime,
        voteAverage: e.vote_average,
      }));

      return new Response(
        JSON.stringify({ episodes }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [source] = id.split(':');

    if (source === 'anilist') {
      const anilistId = parseInt(id.split(':')[1]);
      const anilistQuery = `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            episodes
            streamingEpisodes {
              title
              thumbnail
            }
          }
        }
      `;

      const data = await anilistFetch(anilistQuery, { id: anilistId });
      const media = data.data.Media;

      const episodeCount = media.episodes || 0;
      const episodes = [];

      for (let i = 1; i <= episodeCount; i++) {
        const streamingEp = media.streamingEpisodes?.[i - 1];
        episodes.push({
          episodeNumber: i,
          title: streamingEp?.title || `Episode ${i}`,
          overview: null,
          still: streamingEp?.thumbnail || null,
          airDate: null,
          runtime: null,
          voteAverage: null,
        });
      }

      return new Response(
        JSON.stringify({ episodes }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!season) {
      return new Response(
        JSON.stringify({ error: "Missing season parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tmdbId = id.split(':')[2];
    const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}/season/${season}?api_key=${TMDB_API_KEY}`);
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch episodes" }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const episodes = (data.episodes || []).map((e: any) => ({
      episodeNumber: e.episode_number,
      title: e.name,
      overview: e.overview,
      still: e.still_path ? `https://image.tmdb.org/t/p/w500${e.still_path}` : null,
      airDate: e.air_date,
      runtime: e.runtime,
      voteAverage: e.vote_average,
    }));

    return new Response(
      JSON.stringify({ episodes }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Episodes error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error", episodes: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
