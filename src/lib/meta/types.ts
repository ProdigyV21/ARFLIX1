export interface Title {
  id: string;
  source: 'cinemeta';
  type: 'movie' | 'series';
  title: string;
  year?: number;
  overview?: string;
  genres?: string[];
  runtime?: number;
  rating?: number;
  posterUrl?: string;
  backdropUrl?: string;
  externalIds: {
    imdb?: string;
    tmdb?: string;
    tvdb?: string;
  };
  seasons?: number[];
  trailers?: Array<{
    site: 'youtube' | 'web';
    keyOrUrl: string;
  }>;
}

export interface Episode {
  id: string;
  season: number;
  number: number;
  title: string;
  overview?: string;
  airDate?: string;
  runtime?: number;
}

export interface MetadataProvider {
  getCatalog(
    type: 'movie' | 'series',
    catalogId: string,
    opts?: { skip?: number; limit?: number }
  ): Promise<Title[]>;

  search(type: 'movie' | 'series', query: string): Promise<Title[]>;

  getTitle(type: 'movie' | 'series', id: string): Promise<Title>;

  getSeasonEpisodes(seriesId: string, season: number): Promise<Episode[]>;
}
