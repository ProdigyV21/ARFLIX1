const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export type CatalogItem = {
  id: string;
  type: 'movie' | 'series' | 'anime';
  title: string;
  year?: number;
  overview?: string;
  poster?: string;
  backdrop?: string;
  rating?: number;
  popularity?: number;
  source: 'tmdb' | 'anilist';
  sourceRef: {
    tmdbId?: number;
    anilistId?: number;
    imdbId?: string;
  };
};

export type HomeRow = {
  id: string;
  title: string;
  items: CatalogItem[];
  layout?: 'carousel' | 'grid';
};

export type HomeResponse = {
  hero: CatalogItem[];
  rows: HomeRow[];
  usingLiveSources: boolean;
};

export type MetaResponse = {
  meta: CatalogItem & {
    runtime?: number;
    genres?: string[];
    cast?: string[];
    director?: string;
    releaseInfo?: string;
    imdbRating?: string;
    logo?: string;
  };
};

export const catalogAPI = {
  async getHome(): Promise<HomeResponse> {
    const res = await fetch(`${API_BASE}/catalog-home`);
    if (!res.ok) throw new Error('Failed to fetch home catalog');
    return res.json();
  },

  async getMeta(id: string): Promise<MetaResponse> {
    const res = await fetch(`${API_BASE}/catalog-meta/${id}`);
    if (!res.ok) throw new Error('Failed to fetch meta');
    return res.json();
  },

  async search(query: string): Promise<{ results: CatalogItem[] }> {
    const res = await fetch(`${API_BASE}/catalog-search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Failed to search');
    return res.json();
  },
};
