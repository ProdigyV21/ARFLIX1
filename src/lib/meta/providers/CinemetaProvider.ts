import type { MetadataProvider, Title, Episode } from '../types';
import { getCached, setCache, shouldDebug } from '../cache';

const BASE_URL = 'https://v3-cinemeta.strem.io';
const CATALOG_TTL = 24 * 60 * 60 * 1000; // 24 hours
const SEARCH_TTL = 6 * 60 * 60 * 1000; // 6 hours
const META_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CinemetaMeta {
  id: string;
  type: 'movie' | 'series';
  name: string;
  year?: string | number;
  description?: string;
  genres?: string[];
  runtime?: string | number;
  imdbRating?: string | number;
  rating?: string | number;
  poster?: string;
  background?: string;
  logo?: string;
  imdb_id?: string;
  imdbId?: string;
  tmdb_id?: string;
  tvdb_id?: string;
  videos?: Array<{
    id: string;
    season?: number;
    episode?: number;
    title?: string;
    name?: string;
    overview?: string;
    description?: string;
    released?: string;
    aired?: string;
    runtime?: string | number;
  }>;
}

interface CinemetaResponse {
  metas?: CinemetaMeta[];
  meta?: CinemetaMeta;
}

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  const delays = [250, 500, 1000];
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 429 || response.status >= 500) {
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delays[i]));
          continue;
        }
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error: any) {
      lastError = error;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delays[i]));
      }
    }
  }

  throw lastError || new Error('Fetch failed');
}

async function cachedFetch(url: string, ttl: number): Promise<any> {
  const debug = shouldDebug();

  if (debug) {
    console.log('[Cinemeta] Request:', url);
  }

  const cached = await getCached(url);
  if (cached) {
    if (debug) {
      console.log('[Cinemeta] Cache HIT:', url);
    }
    return cached;
  }

  if (debug) {
    console.log('[Cinemeta] Cache MISS:', url);
  }

  try {
    const data = await fetchWithRetry(url);
    await setCache(url, data, ttl);
    return data;
  } catch (error) {
    const stale = await getCached(url);
    if (stale) {
      if (debug) {
        console.warn('[Cinemeta] Network error, using stale cache:', url);
      }
      return stale;
    }
    throw error;
  }
}

function mapToTitle(item: CinemetaMeta): Title {
  const imdbId = item.imdb_id || item.imdbId || item.id;

  return {
    id: imdbId,
    source: 'cinemeta',
    type: item.type,
    title: item.name,
    year: item.year ? parseInt(String(item.year)) : undefined,
    overview: item.description,
    genres: item.genres || [],
    runtime: item.runtime ? parseInt(String(item.runtime)) : undefined,
    rating: item.imdbRating ? parseFloat(String(item.imdbRating)) :
            item.rating ? parseFloat(String(item.rating)) : undefined,
    posterUrl: item.poster,
    backdropUrl: item.background || item.logo,
    externalIds: {
      imdb: imdbId,
      tmdb: item.tmdb_id,
      tvdb: item.tvdb_id,
    },
  };
}

function extractSeasons(item: CinemetaMeta): number[] {
  if (!item.videos || item.type !== 'series') return [];

  const seasons = new Set<number>();
  for (const video of item.videos) {
    if (video.season !== undefined && video.season > 0) {
      seasons.add(video.season);
    }
  }

  return Array.from(seasons).sort((a, b) => a - b);
}

function extractEpisodes(item: CinemetaMeta, season: number): Episode[] {
  if (!item.videos || item.type !== 'series') return [];

  return item.videos
    .filter(v => v.season === season && v.episode !== undefined)
    .map(v => ({
      id: `${item.id}:${v.season}:${v.episode}`,
      season: v.season!,
      number: v.episode!,
      title: v.title || v.name || `Episode ${v.episode}`,
      overview: v.overview || v.description,
      airDate: v.released || v.aired,
      runtime: v.runtime ? parseInt(String(v.runtime)) : undefined,
    }))
    .sort((a, b) => a.number - b.number);
}

export class CinemetaProvider implements MetadataProvider {
  private language: string = 'en';

  setLanguage(lang: string) {
    this.language = lang;
  }

  async getCatalog(
    type: 'movie' | 'series',
    catalogId: string,
    opts?: { skip?: number; limit?: number }
  ): Promise<Title[]> {
    const skip = opts?.skip || 0;
    const url = `${BASE_URL}/catalog/${type}/${catalogId}.json`;

    try {
      const data: CinemetaResponse = await cachedFetch(url, CATALOG_TTL);
      const metas = data.metas || [];

      const limit = opts?.limit || metas.length;
      const items = metas.slice(skip, skip + limit);

      return items.map(mapToTitle);
    } catch (error) {
      console.error('[Cinemeta] getCatalog error:', error);
      return [];
    }
  }

  async search(type: 'movie' | 'series', query: string): Promise<Title[]> {
    if (!query.trim()) return [];

    const encodedQuery = encodeURIComponent(query.trim());
    const url = `${BASE_URL}/catalog/${type}/search=${encodedQuery}.json`;

    try {
      const data: CinemetaResponse = await cachedFetch(url, SEARCH_TTL);
      const metas = data.metas || [];
      return metas.map(mapToTitle);
    } catch (error) {
      console.error('[Cinemeta] search error:', error);
      return [];
    }
  }

  async getTitle(type: 'movie' | 'series', id: string): Promise<Title> {
    const url = `${BASE_URL}/meta/${type}/${id}.json`;

    try {
      const data: CinemetaResponse = await cachedFetch(url, META_TTL);
      if (!data.meta) {
        throw new Error('No metadata found');
      }

      const title = mapToTitle(data.meta);

      if (type === 'series') {
        title.seasons = extractSeasons(data.meta);
      }

      return title;
    } catch (error) {
      console.error('[Cinemeta] getTitle error:', error);
      throw error;
    }
  }

  async getSeasonEpisodes(seriesId: string, season: number): Promise<Episode[]> {
    const url = `${BASE_URL}/meta/series/${seriesId}.json`;

    try {
      const data: CinemetaResponse = await cachedFetch(url, META_TTL);
      if (!data.meta) {
        throw new Error('No metadata found');
      }

      return extractEpisodes(data.meta, season);
    } catch (error) {
      console.error('[Cinemeta] getSeasonEpisodes error:', error);
      return [];
    }
  }
}

export const cinemetaProvider = new CinemetaProvider();
