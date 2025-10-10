import { tmdbBackdrop } from './tmdbImages';

const TMDB_API_KEY = import.meta.env.TMDB_API_KEY || '080380c1ad7b3967af3def25159e4374';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

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

export async function fetchTrendingMovies(): Promise<TMDBMovie[]> {
  const data = await fetchTMDB('/trending/movie/week?language=en-US');
  return data.results.slice(0, 10);
}

export async function fetchTrendingTV(): Promise<TMDBMovie[]> {
  const data = await fetchTMDB('/trending/tv/week?language=en-US');
  return data.results.slice(0, 10);
}

export async function fetchTopAnime(): Promise<TMDBMovie[]> {
  try {
    const data = await fetchTMDB('/discover/tv?with_keywords=210024&sort_by=popularity.desc&language=en-US&page=1');
    return data.results.slice(0, 10);
  } catch (error) {
    console.error('Failed to fetch anime:', error);
    return [];
  }
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
    poster16x9: tmdbBackdrop(item.backdrop_path, 'w780'),
    backdrop: tmdbBackdrop(item.backdrop_path, 'w1280'),
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : undefined,
    trailer: trailer ? {
      kind: 'youtube',
      youtubeId: trailer.key,
      url: `https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailer.key}`
    } : null
  };
}
