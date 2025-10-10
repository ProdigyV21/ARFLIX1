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
  source: 'cinemeta';
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

function titleToCatalogItem(title: Title): CatalogItem {
  return {
    id: title.externalIds.imdb || title.id,
    type: title.type === 'series' ? 'series' : 'movie',
    title: title.title,
    year: title.year,
    overview: title.overview,
    poster: title.posterUrl,
    backdrop: title.backdropUrl,
    rating: title.rating,
    source: 'cinemeta',
    sourceRef: {
      imdbId: title.externalIds.imdb,
      tmdbId: title.externalIds.tmdb ? parseInt(title.externalIds.tmdb) : undefined,
    },
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
      const title = await metadataProvider.getTitle(type, id);
      const item = titleToCatalogItem(title);

      return {
        meta: {
          ...item,
          type: title.type === 'series' ? 'series' : 'movie',
          runtime: title.runtime,
          genres: title.genres,
          imdbRating: title.rating?.toFixed(1),
        },
      };
    } catch (error) {
      console.error('[Catalog] getMeta error:', error);
      throw error;
    }
  },

  async search(query: string): Promise<{ results: CatalogItem[] }> {
    try {
      if (!query.trim()) {
        return { results: [] };
      }

      const [movies, series] = await Promise.all([
        metadataProvider.search('movie', query),
        metadataProvider.search('series', query),
      ]);

      const results = [...movies, ...series]
        .map(titleToCatalogItem)
        .slice(0, 50);

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
