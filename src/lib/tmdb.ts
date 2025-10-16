import { tmdbBackdrop } from './tmdbImages';
import { supabase } from './supabase';
import { cachedFetch } from './cache';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
// Default to false to avoid routing TMDB traffic through Supabase (bandwidth heavy).
// Can be overridden via VITE_USE_PROXY=true in environment for explicit proxy usage.
const USE_PROXY = (import.meta.env.VITE_USE_PROXY === 'true') || false;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export interface TMDBMovie {
  id: number;
  title: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
  vote_average: number;
  media_type?: 'movie' | 'tv';
}

export interface TMDBVideo {
  id: string;
  key: string;
  site: string;
  type: string;
  official: boolean;
  name: string;
}

export interface HeroItem {
  id: string;
  type: 'movie' | 'tv';
  title: string;
  year?: string;
  overview: string;
  poster16x9: string;
  backdrop: string;
  rating?: number;
  trailer?: {
    kind: 'youtube' | 'hls' | 'mp4';
    url?: string;
    youtubeId?: string;
  } | null;
}

async function fetchTMDB(endpoint: string): Promise<any> {
  if (USE_PROXY) {
    // Use Supabase Edge Function proxy to protect API key
    const { data, error } = await supabase.functions.invoke('tmdb-proxy', {
      body: { endpoint }
    });

    if (error) {
      console.error('TMDB Proxy error:', error);
      throw new Error(`TMDB Proxy error: ${error.message}`);
    }

    return data;
  } else {
    // Direct API call (fallback for local development)
    const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '080380c1ad7b3967af3def25159e4374';
    const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${TMDB_BASE_URL}${endpoint}${separator}api_key=${TMDB_API_KEY}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`);
    }

    return response.json();
  }
}

export async function fetchTrendingMovies(): Promise<TMDBMovie[]> {
  return cachedFetch(
    'tmdb:trending:movies',
    async () => {
      const data = await fetchTMDB('/trending/movie/week?language=en-US');
      return data.results.slice(0, 10);
    },
    CACHE_TTL
  );
}

export async function fetchTrendingTV(): Promise<TMDBMovie[]> {
  return cachedFetch(
    'tmdb:trending:tv',
    async () => {
      const data = await fetchTMDB('/trending/tv/week?language=en-US');
      return data.results.slice(0, 10);
    },
    CACHE_TTL
  );
}

export async function fetchTopAnime(): Promise<TMDBMovie[]> {
  return cachedFetch(
    'tmdb:top:anime',
    async () => {
      try {
        const data = await fetchTMDB('/discover/tv?with_keywords=210024&sort_by=popularity.desc&language=en-US&page=1');
        return data.results.slice(0, 10);
      } catch (error) {
        console.error('Failed to fetch anime:', error);
        return [];
      }
    },
    CACHE_TTL
  );
}

export async function fetchVideos(tmdbId: number, type: 'movie' | 'tv'): Promise<TMDBVideo[]> {
  try {
    const data = await fetchTMDB(`/${type}/${tmdbId}/videos?language=en-US`);
    return data.results || [];
  } catch (error) {
    console.error(`Failed to fetch videos for ${type} ${tmdbId}:`, error);
    return [];
  }
}

export function getImageUrl(path: string | null, size: 'w780' | 'w1280' | 'original' = 'w1280'): string {
  if (!path) return '';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export async function convertToHeroItem(item: TMDBMovie, type: 'movie' | 'tv'): Promise<HeroItem> {
  const title = type === 'movie' ? item.title : item.name || item.title;
  const releaseDate = type === 'movie' ? item.release_date : item.first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear().toString() : undefined;

  const videos = await fetchVideos(item.id, type);
  const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube' && v.official);

  return {
    id: `tmdb:${type}:${item.id}`,
    type,
    title,
    year,
    overview: item.overview,
    poster16x9: tmdbBackdrop(item.backdrop_path, 'original'),
    backdrop: tmdbBackdrop(item.backdrop_path, 'original'),
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : undefined,
    trailer: trailer ? {
      kind: 'youtube',
      youtubeId: trailer.key,
      url: `https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailer.key}`
    } : null
  };
}
