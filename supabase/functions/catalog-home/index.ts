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

type CatalogItem = {
  id: string;
  type: "movie" | "series" | "anime";
  title: string;
  year?: number;
  overview?: string;
  poster?: string;
  backdrop?: string;
  rating?: number;
  popularity?: number;
  source: "tmdb" | "anilist";
  sourceRef: {
    tmdbId?: number;
    anilistId?: number;
    imdbId?: string;
  };
};

type HomeRow = {
  id: string;
  title: string;
  items: CatalogItem[];
  layout?: "carousel" | "grid";
};

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
  if (!TMDB_API_KEY) {
    console.error('TMDB_API_KEY is not set!');
    throw new Error('TMDB API key not configured');
  }
  
  const url = `${TMDB_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  
  if (!res.ok) {
    const error = await res.text();
    console.error(`TMDB error (${res.status}):`, error);
    throw new Error(`TMDB error: ${res.status}`);
  }
  
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

function normalizeTMDBMovie(item: any): CatalogItem {
  return {
    id: `tmdb:movie:${item.id}`,
    type: "movie",
    title: item.title || item.name,
    year: item.release_date ? parseInt(item.release_date.split('-')[0]) : undefined,
    overview: item.overview,
    poster: item.poster_path ? `${TMDB_IMG_BASE}/w500${item.poster_path}` : undefined,
    backdrop: item.backdrop_path ? `${TMDB_IMG_BASE}/original${item.backdrop_path}` : undefined,
    rating: item.vote_average,
    popularity: item.popularity,
    source: "tmdb",
    sourceRef: { tmdbId: item.id },
  };
}

function normalizeTMDBTV(item: any): CatalogItem {
  return {
    id: `tmdb:tv:${item.id}`,
    type: "series",
    title: item.name || item.title,
    year: item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) : undefined,
    overview: item.overview,
    poster: item.poster_path ? `${TMDB_IMG_BASE}/w500${item.poster_path}` : undefined,
    backdrop: item.backdrop_path ? `${TMDB_IMG_BASE}/original${item.backdrop_path}` : undefined,
    rating: item.vote_average,
    popularity: item.popularity,
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
    popularity: item.popularity,
    source: "anilist",
    sourceRef: { anilistId: item.id },
  };
}

async function getTrendingNow(): Promise<CatalogItem[]> {
  try {
    const [movies, shows] = await Promise.all([
      fetchWithCache('tmdb:movies:trending', () => tmdbFetch('/trending/movie/week?page=1')),
      fetchWithCache('tmdb:tv:trending', () => tmdbFetch('/trending/tv/week?page=1')),
    ]);

    const items = [
      ...movies.results.slice(0, 10).map(normalizeTMDBMovie),
      ...shows.results.slice(0, 10).map(normalizeTMDBTV),
    ];

    return items.sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 20);
  } catch (error: any) {
    console.error('Trending error:', error);
    return [];
  }
}

async function getPopularMovies(): Promise<CatalogItem[]> {
  try {
    const data = await fetchWithCache('tmdb:movies:popular', () => tmdbFetch('/movie/popular?page=1'));
    return data.results.slice(0, 20).map(normalizeTMDBMovie);
  } catch (error: any) {
    console.error('Popular movies error:', error);
    return [];
  }
}

async function getPopularSeries(): Promise<CatalogItem[]> {
  try {
    const data = await fetchWithCache('tmdb:tv:popular', () => tmdbFetch('/tv/popular?page=1'));
    return data.results.slice(0, 20).map(normalizeTMDBTV);
  } catch (error: any) {
    console.error('Popular series error:', error);
    return [];
  }
}

async function getTopMovies(): Promise<CatalogItem[]> {
  try {
    const data = await fetchWithCache('tmdb:movies:top', () => tmdbFetch('/movie/top_rated?page=1'));
    return data.results.slice(0, 20).map(normalizeTMDBMovie);
  } catch (error: any) {
    console.error('Top movies error:', error);
    return [];
  }
}

async function getTopSeries(): Promise<CatalogItem[]> {
  try {
    const data = await fetchWithCache('tmdb:tv:top', () => tmdbFetch('/tv/top_rated?page=1'));
    return data.results.slice(0, 20).map(normalizeTMDBTV);
  } catch (error: any) {
    console.error('Top series error:', error);
    return [];
  }
}

async function getTopAnime(): Promise<CatalogItem[]> {
  try {
    const query = `
      query {
        Page(page: 1, perPage: 20) {
          media(type: ANIME, sort: SCORE_DESC, countryOfOrigin: "JP", status: FINISHED) {
            id
            title { romaji english native }
            seasonYear
            startDate { year }
            description
            coverImage { large medium }
            bannerImage
            averageScore
            popularity
          }
        }
      }
    `;

    const data = await fetchWithCache('anilist:top', () => anilistFetch(query, {}));
    return data.data.Page.media.map(normalizeAniList);
  } catch (error: any) {
    console.error('Top anime error:', error);
    return [];
  }
}

async function getNewReleases(): Promise<CatalogItem[]> {
  try {
    const [movies, shows] = await Promise.all([
      fetchWithCache('tmdb:movies:now', () => tmdbFetch('/movie/now_playing?page=1')),
      fetchWithCache('tmdb:tv:airing', () => tmdbFetch('/tv/airing_today?page=1')),
    ]);

    return [
      ...movies.results.slice(0, 10).map(normalizeTMDBMovie),
      ...shows.results.slice(0, 10).map(normalizeTMDBTV),
    ];
  } catch (error: any) {
    console.error('New releases error:', error);
    return [];
  }
}

async function getByGenre(genreIds: number[], type: 'movie' | 'tv'): Promise<CatalogItem[]> {
  try {
    const endpoint = type === 'movie' ? '/discover/movie' : '/discover/tv';
    const data = await fetchWithCache(
      `tmdb:${type}:genre:${genreIds.join(',')}`,
      () => tmdbFetch(`${endpoint}?with_genres=${genreIds.join(',')}&sort_by=popularity.desc&vote_count.gte=100&page=1`)
    );

    const normalizer = type === 'movie' ? normalizeTMDBMovie : normalizeTMDBTV;
    return data.results.slice(0, 20).map(normalizer);
  } catch (error: any) {
    console.error(`Genre ${genreIds} error:`, error);
    return [];
  }
}

async function getCriticsPicks(): Promise<CatalogItem[]> {
  try {
    const [movies, shows] = await Promise.all([
      fetchWithCache('tmdb:critics:movies', () =>
        tmdbFetch('/discover/movie?vote_average.gte=8.0&vote_count.gte=1000&sort_by=vote_average.desc&page=1')
      ),
      fetchWithCache('tmdb:critics:tv', () =>
        tmdbFetch('/discover/tv?vote_average.gte=8.0&vote_count.gte=500&sort_by=vote_average.desc&page=1')
      ),
    ]);

    return [
      ...movies.results.slice(0, 10).map(normalizeTMDBMovie),
      ...shows.results.slice(0, 10).map(normalizeTMDBTV),
    ];
  } catch (error: any) {
    console.error('Critics picks error:', error);
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const rows: HomeRow[] = [];

    const [trending, popularMovies, popularSeries, topMovies, topSeries, topAnime, newReleases, action, comedy, sciFi, critics] = await Promise.all([
      getTrendingNow(),
      getPopularMovies(),
      getPopularSeries(),
      getTopMovies(),
      getTopSeries(),
      getTopAnime(),
      getNewReleases(),
      getByGenre([28, 12], 'movie'),
      getByGenre([35], 'movie'),
      getByGenre([878, 14], 'movie'),
      getCriticsPicks(),
    ]);

    if (trending.length > 0) rows.push({ id: 'trending', title: 'Trending Now', items: trending });
    if (popularMovies.length > 0) rows.push({ id: 'popular-movies', title: 'Popular Movies', items: popularMovies });
    if (popularSeries.length > 0) rows.push({ id: 'popular-series', title: 'Popular Series', items: popularSeries });
    if (topMovies.length > 0) rows.push({ id: 'top-movies', title: 'Top Rated Movies', items: topMovies });
    if (topSeries.length > 0) rows.push({ id: 'top-series', title: 'Top Rated Series', items: topSeries });
    if (topAnime.length > 0) rows.push({ id: 'top-anime', title: 'Top Anime', items: topAnime });
    if (newReleases.length > 0) rows.push({ id: 'new', title: 'New Releases', items: newReleases });
    if (action.length > 0) rows.push({ id: 'action', title: 'Action & Adventure', items: action });
    if (comedy.length > 0) rows.push({ id: 'comedy', title: 'Comedy', items: comedy });
    if (sciFi.length > 0) rows.push({ id: 'scifi', title: 'Sci-Fi & Fantasy', items: sciFi });

    const heroItems = trending.filter(item => item.backdrop).slice(0, 6);

    return new Response(
      JSON.stringify({
        hero: heroItems,
        rows,
        usingLiveSources: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Catalog error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error", hero: [], rows: [], usingLiveSources: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});