export interface CastMember {
  id?: string; // e.g., tmdb:12345
  name: string;
  character: string;
  profileUrl?: string;
}

export interface Title {
  id: string;
  source: 'cinemeta' | 'tmdb';
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
  releaseDate?: string; // ISO date string (YYYY-MM-DD)
  cast?: CastMember[];
  streamingServices?: string[];
  trailerUrl?: string; // Direct YouTube URL for demo purposes
}

export interface Episode {
  id: string;
  season: number;
  number: number;
  title: string;
  overview?: string;
  airDate?: string;
  runtime?: number;
  still?: string;
}

export interface MetadataProvider {
  getCatalog(
    type: 'movie' | 'series',
    catalogId: string,
    opts?: { skip?: number; limit?: number }
  ): Promise<Title[]>;

  search(type: 'movie' | 'series', query: string): Promise<Title[]>;

  getTitle(type: 'movie' | 'series' | undefined, id: string): Promise<Title>;

  resolveTitleToId(query: { type: 'movie' | 'series'; title: string; year?: number }): Promise<{ id: string; type: 'movie' | 'series' }>;

  getSeasonEpisodes(seriesId: string, season: number): Promise<Episode[]>;
}
