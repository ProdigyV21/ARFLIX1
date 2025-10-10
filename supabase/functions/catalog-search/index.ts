import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY") || "";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p";
const ANILIST_BASE = "https://graphql.anilist.co";

type CatalogItem = {
  id: string;
  type: "movie" | "series" | "anime";
  title: string;
  year?: number;
  overview?: string;
  poster?: string;
  backdrop?: string;
  rating?: number;
  source: "tmdb" | "anilist";
  sourceRef: any;
};

async function tmdbFetch(endpoint: string) {
  const url = `${TMDB_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  return res.json();
}

async function anilistFetch(query: string, variables: any) {
  const res = await fetch(ANILIST_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList error: ${res.status}`);
  return res.json();
}

function normalizeTMDB(item: any): CatalogItem {
  const isMovie = item.media_type === 'movie' || item.title;
  const isAnime = !isMovie && item.origin_country?.includes('JP');

  return {
    id: `tmdb:${isMovie ? 'movie' : 'tv'}:${item.id}`,
    type: isMovie ? "movie" : isAnime ? "anime" : "series",
    title: item.title || item.name,
    year: item.release_date
      ? parseInt(item.release_date.split('-')[0])
      : item.first_air_date
      ? parseInt(item.first_air_date.split('-')[0])
      : undefined,
    overview: item.overview,
    poster: item.poster_path ? `${TMDB_IMG_BASE}/w500${item.poster_path}` : undefined,
    backdrop: item.backdrop_path ? `${TMDB_IMG_BASE}/original${item.backdrop_path}` : undefined,
    rating: item.vote_average,
    source: "tmdb",
    sourceRef: { tmdbId: item.id },
  };
}

function normalizeAniList(item: any): CatalogItem {
  return {
    id: `anilist:${item.id}`,
    type: "anime",
    title: item.title?.english || item.title?.romaji || item.title?.native,
    year: item.seasonYear || item.startDate?.year,
    overview: item.description?.replace(/<[^>]*>/g, ''),
    poster: item.coverImage?.large || item.coverImage?.medium,
    backdrop: item.bannerImage,
    rating: item.averageScore ? item.averageScore / 10 : undefined,
    source: "anilist",
    sourceRef: { anilistId: item.id },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q');

    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ error: "Query too short", results: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: CatalogItem[] = [];

    if (TMDB_API_KEY) {
      try {
        const tmdbData = await tmdbFetch(`/search/multi?query=${encodeURIComponent(query)}&page=1`);
        const tmdbItems = tmdbData.results
          .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
          .slice(0, 15)
          .map(normalizeTMDB);
        results.push(...tmdbItems);
      } catch (error) {
        console.error('TMDB search error:', error);
      }
    }

    try {
      const anilistQuery = `
        query ($search: String) {
          Page(page: 1, perPage: 10) {
            media(search: $search, type: ANIME) {
              id
              title { romaji english native }
              seasonYear
              startDate { year }
              description
              coverImage { large medium }
              bannerImage
              averageScore
            }
          }
        }
      `;

      const anilistData = await anilistFetch(anilistQuery, { search: query });
      const anilistItems = anilistData.data.Page.media.map(normalizeAniList);
      results.push(...anilistItems);
    } catch (error) {
      console.error('AniList search error:', error);
    }

    const deduped = Array.from(
      new Map(results.map(item => [item.title.toLowerCase() + item.year, item])).values()
    );

    return new Response(
      JSON.stringify({ results: deduped }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Search error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error", results: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
