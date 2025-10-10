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
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = parseInt(Deno.env.get("CACHE_TTL_SECONDS") || "3600") * 1000;

async function fetchWithCache(key: string, fetcher: () => Promise<any>) {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const data = await fetcher();
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
  return data;
}

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

function normalizeTMDBItem(item: any, type: string): any {
  return {
    id: `tmdb:${type}:${item.id}`,
    type: type === 'movie' ? 'movie' : 'series',
    title: item.title || item.name,
    year: item.release_date ? parseInt(item.release_date.split('-')[0]) : item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) : undefined,
    overview: item.overview,
    poster: item.poster_path ? `${TMDB_IMG_BASE}/w500${item.poster_path}` : undefined,
    backdrop: item.backdrop_path ? `${TMDB_IMG_BASE}/original${item.backdrop_path}` : undefined,
    rating: item.vote_average,
    popularity: item.popularity,
    source: "tmdb",
    sourceRef: { tmdbId: item.id },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const type = pathParts[pathParts.length - 2];
    const id = pathParts[pathParts.length - 1];

    if (!type || !id) {
      return new Response(
        JSON.stringify({ error: "Missing type or id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [source, mediaType, sourceId] = id.split(':');

    // Handle AniList anime
    if (source === 'anilist') {
      const anilistQuery = `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            title { romaji english native }
            seasonYear
            startDate { year month day }
            endDate { year month day }
            description
            episodes
            duration
            status
            genres
            averageScore
            coverImage { extraLarge large medium }
            bannerImage
            studios(isMain: true) {
              nodes { name }
            }
            characters(sort: ROLE, perPage: 8) {
              nodes {
                name { full }
                image { large }
              }
            }
            relations {
              edges {
                relationType
                node {
                  id
                  type
                  title { romaji english }
                  coverImage { large }
                  bannerImage
                  seasonYear
                  averageScore
                }
              }
            }
            trailer { id site }
          }
        }
      `;

      const data = await fetchWithCache(`anilist:meta:${id}`, () =>
        anilistFetch(anilistQuery, { id: parseInt(mediaType || sourceId) })
      );

      const media = data.data.Media;

      const trailer = media.trailer && media.trailer.site === 'youtube' ? {
        id: media.trailer.id,
        name: 'Trailer',
        key: media.trailer.id,
        site: media.trailer.site,
        url: `https://www.youtube.com/watch?v=${media.trailer.id}`,
      } : null;

      const similar = media.relations?.edges
        ?.filter((edge: any) => edge.relationType === 'SEQUEL' || edge.relationType === 'PREQUEL' || edge.relationType === 'ALTERNATIVE')
        .slice(0, 12)
        .map((edge: any) => ({
          id: `anilist:${edge.node.id}`,
          type: 'anime',
          title: edge.node.title.english || edge.node.title.romaji,
          year: edge.node.seasonYear,
          poster: edge.node.coverImage?.large,
          backdrop: edge.node.bannerImage,
          rating: edge.node.averageScore ? edge.node.averageScore / 10 : undefined,
          source: 'anilist',
          sourceRef: { anilistId: edge.node.id },
        })) || [];

      const meta = {
        id,
        type: 'anime',
        title: media.title.english || media.title.romaji || media.title.native,
        year: media.seasonYear || media.startDate?.year,
        overview: media.description?.replace(/<[^>]*>/g, ''),
        poster: media.coverImage?.extraLarge || media.coverImage?.large,
        backdrop: media.bannerImage,
        rating: media.averageScore ? media.averageScore / 10 : undefined,
        runtime: media.duration,
        genres: media.genres || [],
        cast: media.characters?.nodes?.map((char: any) => ({
          name: char.name.full,
          character: '',
          profile: char.image.large,
        })) || [],
        studios: media.studios?.nodes?.map((s: any) => s.name) || [],
        releaseInfo: media.startDate ? `${media.startDate.year}-${String(media.startDate.month).padStart(2, '0')}-${String(media.startDate.day).padStart(2, '0')}` : undefined,
        episodeCount: media.episodes,
        status: media.status,
        trailers: trailer ? [trailer] : [],
        similar,
        source: 'anilist',
        sourceRef: { anilistId: media.id },
      };

      return new Response(
        JSON.stringify({ meta }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (source === 'tmdb' && TMDB_API_KEY) {
      const endpoint = mediaType === 'movie' ? `/movie/${sourceId}` : `/tv/${sourceId}`;
      const detailEndpoint = `${endpoint}?append_to_response=credits,videos,similar,content_ratings,external_ids`;

      const data = await fetchWithCache(`tmdb:meta:${id}`, () => tmdbFetch(detailEndpoint));

      const trailers = data.videos?.results
        ?.filter((v: any) => v.type === 'Trailer' && v.site === 'YouTube')
        .slice(0, 5)
        .map((v: any) => ({
          id: v.key,
          name: v.name,
          key: v.key,
          site: v.site,
          type: v.type,
          official: v.official,
          url: `https://www.youtube.com/watch?v=${v.key}`,
        })) || [];

      const similar = data.similar?.results
        ?.slice(0, 20)
        .map((item: any) => normalizeTMDBItem(item, mediaType)) || [];

      const isAnime = mediaType === 'tv' && data.origin_country?.includes('JP');

      const meta = {
        id,
        type: mediaType === 'movie' ? 'movie' : isAnime ? 'anime' : 'series',
        title: data.title || data.name,
        year: data.release_date
          ? parseInt(data.release_date.split('-')[0])
          : data.first_air_date
          ? parseInt(data.first_air_date.split('-')[0])
          : undefined,
        overview: data.overview,
        poster: data.poster_path ? `${TMDB_IMG_BASE}/w500${data.poster_path}` : undefined,
        backdrop: data.backdrop_path ? `${TMDB_IMG_BASE}/original${data.backdrop_path}` : undefined,
        logo: data.belongs_to_collection?.poster_path
          ? `${TMDB_IMG_BASE}/w300${data.belongs_to_collection.poster_path}`
          : undefined,
        rating: data.vote_average,
        runtime: data.runtime || data.episode_run_time?.[0],
        genres: data.genres?.map((g: any) => g.name) || [],
        cast: data.credits?.cast?.slice(0, 8).map((c: any) => ({
          name: c.name,
          character: c.character,
          profile: c.profile_path ? `${TMDB_IMG_BASE}/w185${c.profile_path}` : null,
        })) || [],
        director: data.credits?.crew?.find((c: any) => c.job === 'Director')?.name,
        creators: data.created_by?.map((c: any) => c.name) || [],
        networks: data.networks?.map((n: any) => n.name) || [],
        studios: data.production_companies?.slice(0, 3).map((c: any) => c.name) || [],
        releaseInfo: data.release_date || data.first_air_date,
        imdbRating: data.vote_average?.toFixed(1),
        imdbId: data.external_ids?.imdb_id,
        seasonCount: data.number_of_seasons,
        episodeCount: data.number_of_episodes,
        status: data.status,
        tagline: data.tagline,
        trailers,
        similar,
        source: 'tmdb',
        sourceRef: { tmdbId: parseInt(sourceId), imdbId: data.external_ids?.imdb_id },
      };

      return new Response(
        JSON.stringify({ meta }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Source not supported or API key missing" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Meta error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
