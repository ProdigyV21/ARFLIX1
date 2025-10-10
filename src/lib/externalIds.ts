export type ExternalIds = {
  tmdbMovieId?: number;
  tmdbTvId?: number;
  imdbId?: string;
  tvdbId?: number;
  traktMovieId?: number;
  traktShowId?: number;
  anilistId?: number;
  kitsuId?: number;
};

export type ExternalIdInput = {
  type: "movie" | "series" | "anime";
  tmdbId?: number;
  imdbId?: string;
  traktId?: number;
  anilistId?: number;
};

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const cache = new Map<string, { data: ExternalIds; expires: number }>();
const CACHE_TTL = 3600000;

export async function getExternalIds(input: ExternalIdInput): Promise<ExternalIds> {
  const cacheKey = JSON.stringify(input);
  const cached = cache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const result: ExternalIds = {};

  if (input.type === 'movie' && input.tmdbId) {
    result.tmdbMovieId = input.tmdbId;

    try {
      const res = await fetch(`${TMDB_BASE}/movie/${input.tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
      if (res.ok) {
        const data = await res.json();
        if (data.imdb_id) result.imdbId = data.imdb_id;
        if (data.tvdb_id) result.tvdbId = data.tvdb_id;
      }
    } catch (error) {
      console.error('TMDB movie external IDs fetch failed:', error);
    }
  }

  if (input.type === 'series' && input.tmdbId) {
    result.tmdbTvId = input.tmdbId;

    try {
      const res = await fetch(`${TMDB_BASE}/tv/${input.tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
      if (res.ok) {
        const data = await res.json();
        if (data.imdb_id) result.imdbId = data.imdb_id;
        if (data.tvdb_id) result.tvdbId = data.tvdb_id;
      }
    } catch (error) {
      console.error('TMDB TV external IDs fetch failed:', error);
    }
  }

  if (input.type === 'anime' && input.anilistId) {
    result.anilistId = input.anilistId;
  }

  if (input.imdbId) {
    result.imdbId = input.imdbId;
  }

  cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
  return result;
}

export function parseIdFromString(id: string): ExternalIdInput | null {
  if (id.startsWith('tmdb:movie:')) {
    return { type: 'movie', tmdbId: parseInt(id.split(':')[2]) };
  }
  if (id.startsWith('tmdb:tv:')) {
    return { type: 'series', tmdbId: parseInt(id.split(':')[2]) };
  }
  if (id.startsWith('anilist:')) {
    return { type: 'anime', anilistId: parseInt(id.split(':')[1]) };
  }
  if (id.startsWith('tt')) {
    return { type: 'movie', imdbId: id };
  }
  return null;
}
