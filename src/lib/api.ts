import { supabase } from './supabase';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
  
  if (!session) {
    // For development, allow unauthenticated requests to some endpoints
    console.warn('No session found, making unauthenticated request with apikey');
    return headers;
  }

  return {
    ...headers,
    Authorization: `Bearer ${session.access_token}`,
  };
}

export const addonAPI = {
  async list() {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/addon-manage`, { headers });
    if (!res.ok) throw new Error('Failed to fetch addons');
    return res.json();
  },

  async add(url: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/addon-register`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Failed to add addon' }));
      throw new Error(errorData.error || 'Failed to add addon');
    }
    return res.json();
  },

  async toggle(url: string, enabled: boolean) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/addon-manage?action=toggle`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, enabled }),
    });
    if (!res.ok) throw new Error('Failed to toggle addon');
    return res.json();
  },

  async remove(url: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/addon-manage`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error('Failed to remove addon');
    return res.json();
  },

  async checkHealth(url: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/addon-manage?action=health&url=${encodeURIComponent(url)}`, { headers });
    if (!res.ok) throw new Error('Failed to check health');
    return res.json();
  },

  async reorder(urls: string[]) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/addon-manage?action=reorder`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ urls }),
    });
    if (!res.ok) throw new Error('Failed to reorder addons');
    return res.json();
  },

  async getCatalog(addonId: string, type: string, genre?: string, skip = 0) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({ addonId, type, skip: String(skip) });
    if (genre) params.set('genre', genre);

    const res = await fetch(`${API_BASE}/addon-catalog/catalog?${params}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch catalog');
    return res.json();
  },

  async getMeta(addonId: string, type: string, id: string) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({ addonId, type, id });

    const res = await fetch(`${API_BASE}/addon-catalog/meta?${params}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch meta');
    return res.json();
  },

  async getStreams(addonId: string, type: string, id: string) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({ addonId, type, id });

    const res = await fetch(`${API_BASE}/addon-catalog/streams?${params}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch streams');
    return res.json();
  },
};

// Stream cache to avoid refetching
const streamCache = new Map<string, { data: any; timestamp: number }>();
const STREAM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchStreams(type: string, id: string, season?: number, episode?: number) {
  try {
    // Create cache key
    const cacheKey = `${type}:${id}:${season}:${episode}`;
    
    // Check cache first
    const cached = streamCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < STREAM_CACHE_TTL) {
      console.log('[API] ⚡ Returning cached streams for:', cacheKey);
      return cached.data;
    }
    
    const startTime = performance.now();
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (season !== undefined) params.set('season', season.toString());
    if (episode !== undefined) params.set('episode', episode.toString());

    const url = `${API_BASE}/catalog-streams/${type}/${id}${params.toString() ? `?${params}` : ''}`;
    console.log('[API] Fetching streams:', { url, type, id, season, episode });

    const res = await fetch(url, { headers });
    const fetchTime = performance.now() - startTime;
    console.log(`[API] ⏱️ Stream API response in ${fetchTime.toFixed(0)}ms - Status: ${res.status}`);

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to fetch streams' }));
      console.error('[API] Error response:', error);
      throw new Error(error.error || 'Failed to fetch streams');
    }

    const data = await res.json();
    console.log('[API] Success - received', data.items?.length || 0, 'streams');
    
    // Cache the result
    streamCache.set(cacheKey, { data, timestamp: Date.now() });
    
    return data;
  } catch (error) {
    console.error('[API] fetchStreams error:', error);
    // Return empty streams for now - user needs to configure addons
    return { items: [], best: null, message: 'No add-ons configured. Go to Settings > Add-ons to add streaming sources.' };
  }
}

export async function fetchSeasons(imdbId: string) {
  const { metadataProvider } = await import('./meta');
  try {
    const title = await metadataProvider.getTitle('series', imdbId);
    const seasons = title.seasons || [];
    console.log('[API] fetchSeasons - title.seasons:', seasons);
    
    // Handle both formats: array of numbers [1,2,3] or array of objects [{seasonNumber: 1}, {seasonNumber: 2}]
    let seasonNumbers: number[];
    if (seasons.length > 0 && typeof seasons[0] === 'number') {
      // Array of numbers format
      seasonNumbers = seasons as number[];
    } else {
      // Array of objects format
      seasonNumbers = seasons.map((s: any) => s.seasonNumber).filter((n: number) => n > 0);
    }
    
    console.log('[API] fetchSeasons - seasonNumbers:', seasonNumbers);
    return { seasons: seasonNumbers };
  } catch (error) {
    console.error('[API] fetchSeasons error:', error);
    return { seasons: [] };
  }
}

export async function fetchEpisodes(id: string, season?: number) {
  try {
    if (season === undefined) {
      return { episodes: [] };
    }

    // Try backend API first for episodes to get TMDB images
    try {
      const headers = await getAuthHeaders();
      const url = `${API_BASE}/catalog-episodes/${id}?season=${season}`;
      const res = await fetch(url, { headers });

      if (res.ok) {
        const data = await res.json();
        return { episodes: data.episodes || [] };
      }
    } catch (apiError) {
      console.warn('[API] Backend episodes API failed, trying fallback:', apiError);
    }

    // Fallback to direct metadata provider
    const { metadataProvider } = await import('./meta');
    
    // Check if the metadata provider has getSeasonEpisodes method (TMDB provider)
    if ('getSeasonEpisodes' in metadataProvider && typeof metadataProvider.getSeasonEpisodes === 'function') {
      console.log('[API] Using getSeasonEpisodes for:', id, 'season:', season);
      const episodes = await metadataProvider.getSeasonEpisodes(id, season);
      return { episodes };
    }
    
    // Fallback for other providers (Cinemeta)
      const title = await metadataProvider.getTitle('series', id);
      const seasonData = (title as any).seasons?.find((s: any) => s.seasonNumber === season);
      
      if (seasonData && seasonData.episodes) {
        return { episodes: seasonData.episodes };
      }

    return { episodes: [] };
  } catch (error) {
    console.error('[API] fetchEpisodes error:', error);
    return { episodes: [] };
  }
}

export async function searchContent(query: string) {
  console.log('[API] searchContent called with query:', query);
  const { catalogAPI } = await import('./catalog');
  try {
    const result = await catalogAPI.search(query);
    console.log('[API] catalogAPI.search result:', result);
    return result;
  } catch (error) {
    console.error('[API] searchContent error:', error);
    // Fallback to direct Cinemeta search if catalog API fails
    try {
      console.log('[API] Trying fallback search with metadataProvider');
      const { metadataProvider } = await import('./meta');
      const [movies, series] = await Promise.all([
        metadataProvider.search('movie', query),
        metadataProvider.search('series', query),
      ]);
      
      console.log('[API] Fallback search results - movies:', movies.length, 'series:', series.length);
      
      const results = [...movies, ...series].map((item: any) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        year: item.year,
        poster: item.posterUrl,
        backdrop: item.backdropUrl,
        rating: item.rating,
      }));
      
      console.log('[API] Fallback search final results:', results.length);
      return { results };
    } catch (fallbackError) {
      console.error('[API] Fallback search error:', fallbackError);
      return { results: [] };
    }
  }
}

export async function fetchMeta(type: string, id: string) {
  const { catalogAPI } = await import('./catalog');
  try {
    return await catalogAPI.getMeta(id, type as 'movie' | 'series');
  } catch (error) {
    console.error('[API] fetchMeta error:', error);
    // Fallback to direct metadata provider
    try {
      const { metadataProvider } = await import('./meta');
      const title = await metadataProvider.getTitle(type as 'movie' | 'series', id);
      return { meta: title };
    } catch (fallbackError) {
      console.error('[API] Fallback fetchMeta error:', fallbackError);
      throw error;
    }
  }
}

