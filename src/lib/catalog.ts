import { metadataProvider, type Title } from './meta';

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
  source: 'cinemeta' | 'tmdb';
  sourceRef: {
    tmdbId?: number;
    anilistId?: number;
    imdbId?: string;
  };
  releaseDate?: string;
  cast?: Array<{ name: string; character?: string; profile?: string | null; profileUrl?: string }>;
  streamingServices?: string[];
  trailerUrl?: string;
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
    cast?: Array<{ name: string; character?: string; profile?: string | null; profileUrl?: string }>;
    director?: string;
    releaseInfo?: string;
    imdbRating?: string;
    logo?: string;
    releaseDate?: string;
    streamingServices?: string[];
    trailerUrl?: string;
  };
};

function titleToCatalogItem(title: Title): CatalogItem {
  // Use TMDB ID if available, otherwise fall back to the title ID
  const id = title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id;
  
  return {
    id: id,
    type: title.type === 'series' ? 'series' : 'movie',
    title: title.title,
    year: title.year,
    overview: title.overview,
    poster: title.posterUrl,
    backdrop: title.backdropUrl,
    rating: title.rating,
    source: title.source,
    sourceRef: {
      imdbId: title.externalIds.imdb,
      tmdbId: title.externalIds.tmdb ? parseInt(title.externalIds.tmdb) : undefined,
    },
    releaseDate: title.releaseDate,
    cast: title.cast,
    streamingServices: title.streamingServices,
    trailerUrl: title.trailerUrl,
  };
}

export const catalogAPI = {
  async getHome(): Promise<HomeResponse> {
    try {
      const [trendingMovies, topMovies, trendingSeries, topSeries] = await Promise.all([
        metadataProvider.getCatalog('movie', 'top', { limit: 20 }),
        metadataProvider.getCatalog('movie', 'top', { skip: 20, limit: 20 }),
        metadataProvider.getCatalog('series', 'top', { limit: 20 }),
        metadataProvider.getCatalog('series', 'top', { skip: 20, limit: 20 }),
      ]);

      const hero = trendingMovies.slice(0, 5).map(titleToCatalogItem);

      const rows: HomeRow[] = [
        {
          id: 'trending-movies',
          title: 'Trending Movies',
          items: trendingMovies.map(titleToCatalogItem),
        },
        {
          id: 'trending-series',
          title: 'Trending TV Shows',
          items: trendingSeries.map(titleToCatalogItem),
        },
        {
          id: 'top-movies',
          title: 'Popular Movies',
          items: topMovies.map(titleToCatalogItem),
        },
        {
          id: 'top-series',
          title: 'Popular TV Shows',
          items: topSeries.map(titleToCatalogItem),
        },
      ];

      return {
        hero,
        rows,
        usingLiveSources: true,
      };
    } catch (error) {
      console.error('[Catalog] getHome error:', error);
      return {
        hero: [],
        rows: [],
        usingLiveSources: false,
      };
    }
  },

  async getMeta(id: string, type?: 'movie' | 'series'): Promise<MetaResponse> {
    try {
      console.log('[Catalog] getMeta called with:', { id, type });
      const title = await metadataProvider.getTitle(type, id);
      console.log('[Catalog] Metadata provider returned title.type:', title.type);
      const item = titleToCatalogItem(title);
      console.log('[Catalog] titleToCatalogItem returned item.type:', item.type);

      const meta = {
        ...item,
        type: title.type === 'series' ? 'series' : 'movie',
        runtime: title.runtime,
        genres: title.genres,
        imdbRating: title.rating?.toFixed(1),
      };
      console.log('[Catalog] Final meta.type:', meta.type);

      return { meta };
    } catch (error) {
      console.error('[Catalog] getMeta error:', error);
      throw error;
    }
  },

  async search(query: string): Promise<{ results: CatalogItem[] }> {
    try {
      console.log('[Catalog] search called with query:', query);
      if (!query.trim()) {
        console.log('[Catalog] Empty query, returning empty results');
        return { results: [] };
      }

      console.log('[Catalog] Calling metadataProvider.search for movies and series');
      const [movies, series] = await Promise.all([
        metadataProvider.search('movie', query),
        metadataProvider.search('series', query),
      ]);

      console.log('[Catalog] Search results - movies:', movies.length, 'series:', series.length);
      console.log('[Catalog] First few movie results:', movies.slice(0, 3).map(m => m.title));
      console.log('[Catalog] First few series results:', series.slice(0, 3).map(s => s.title));

      const results = [...movies, ...series]
        .map(titleToCatalogItem)
        .slice(0, 50);

      console.log('[Catalog] Final results count:', results.length);
      return { results };
    } catch (error) {
      console.error('[Catalog] search error:', error);
      return { results: [] };
    }
  },

  async resolveTitleToId(query: { type: 'movie' | 'series'; title: string; year?: number }): Promise<{ id: string; type: 'movie' | 'series' }> {
    try {
      return await metadataProvider.resolveTitleToId(query);
    } catch (error) {
      console.error('[Catalog] resolveTitleToId error:', error);
      throw error;
    }
  },
};
