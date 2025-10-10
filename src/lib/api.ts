import { supabase } from './supabase';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
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

export async function fetchStreams(type: string, id: string, season?: number, episode?: number) {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (season !== undefined) params.set('season', season.toString());
  if (episode !== undefined) params.set('episode', episode.toString());

  const url = `${API_BASE}/catalog-streams/${type}/${id}${params.toString() ? `?${params}` : ''}`;
  console.log('[API] Fetching streams:', { url, type, id, season, episode });

  const res = await fetch(url, { headers });
  console.log('[API] Response status:', res.status, res.statusText);

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to fetch streams' }));
    console.error('[API] Error response:', error);
    throw new Error(error.error || 'Failed to fetch streams');
  }

  const data = await res.json();
  console.log('[API] Success response:', data);
  return data;
}

export async function fetchSeasons(imdbId: string) {
  const { metadataProvider } = await import('./meta');
  try {
    const title = await metadataProvider.getTitle('series', imdbId);
    return { seasons: title.seasons || [] };
  } catch (error) {
    console.error('[API] fetchSeasons error:', error);
    return { seasons: [] };
  }
}

export async function fetchEpisodes(id: string, season?: number) {
  const { metadataProvider } = await import('./meta');
  try {
    if (season === undefined) {
      return { episodes: [] };
    }
    const episodes = await metadataProvider.getSeasonEpisodes(id, season);
    return { episodes };
  } catch (error) {
    console.error('[API] fetchEpisodes error:', error);
    return { episodes: [] };
  }
}

export async function searchContent(query: string) {
  const { catalogAPI } = await import('./catalog');
  try {
    return await catalogAPI.search(query);
  } catch (error) {
    console.error('[API] searchContent error:', error);
    return { results: [] };
  }
}

export async function fetchMeta(type: string, id: string) {
  const { catalogAPI } = await import('./catalog');
  try {
    return await catalogAPI.getMeta(id, type as 'movie' | 'series');
  } catch (error) {
    console.error('[API] fetchMeta error:', error);
    throw error;
  }
}

