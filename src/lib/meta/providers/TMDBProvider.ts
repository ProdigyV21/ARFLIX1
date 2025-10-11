import type { MetadataProvider, Title, Episode } from '../types';
import { getCached, setCache, shouldDebug } from '../cache';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '080380c1ad7b3967af3def25159e4374';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const SEARCH_TTL = 6 * 60 * 60 * 1000; // 6 hours
const META_TTL = 24 * 60 * 60 * 1000; // 24 hours
const CATALOG_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface TMDBMovie {
  id: number;
  title: string;
  overview?: string;
  release_date?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  adult?: boolean;
  original_language?: string;
  original_title?: string;
  popularity?: number;
  video?: boolean;
}

interface TMDBTVShow {
  id: number;
  name: string;
  overview?: string;
  first_air_date?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  adult?: boolean;
  original_language?: string;
  original_name?: string;
  popularity?: number;
  origin_country?: string[];
}

interface TMDBMovieDetails extends TMDBMovie {
  runtime?: number;
  genres?: Array<{ id: number; name: string }>;
  imdb_id?: string;
  external_ids?: {
    imdb_id?: string;
    tvdb_id?: number;
  };
}

interface TMDBTVDetails extends TMDBTVShow {
  episode_run_time?: number[];
  genres?: Array<{ id: number; name: string }>;
  external_ids?: {
    imdb_id?: string;
    tvdb_id?: number;
  };
  seasons?: Array<{
    air_date?: string;
    episode_count: number;
    id: number;
    name: string;
    overview?: string;
    poster_path?: string;
    season_number: number;
  }>;
}

interface TMDBSearchResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

interface TMDBEpisode {
  air_date?: string;
  episode_number: number;
  id: number;
  name: string;
  overview?: string;
  production_code?: string;
  runtime?: number;
  season_number: number;
  show_id: number;
  still_path?: string;
  vote_average?: number;
  vote_count?: number;
}

interface TMDBSeasonDetails {
  _id: string;
  air_date?: string;
  episodes: TMDBEpisode[];
  name: string;
  overview?: string;
  id: number;
  poster_path?: string;
  season_number: number;
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

      const error: any = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
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
    console.log('[TMDB] Request:', url);
  }

  const cached = await getCached(url);
  if (cached) {
    if (debug) {
      console.log('[TMDB] Cache HIT:', url);
    }
    return cached;
  }

  if (debug) {
    console.log('[TMDB] Cache MISS:', url);
  }

  try {
    const data = await fetchWithRetry(url);
    await setCache(url, data, ttl);
    return data;
  } catch (error) {
    const stale = await getCached(url);
    if (stale) {
      if (debug) {
        console.warn('[TMDB] Network error, using stale cache:', url);
      }
      return stale;
    }
    throw error;
  }
}

function getImageUrl(path: string | undefined, size: 'w500' | 'w1280' | 'original' = 'w500'): string | undefined {
  if (!path) return undefined;
  return `${IMAGE_BASE_URL}/${size}${path}`;
}

function mapMovieToTitle(movie: TMDBMovie): Title {
  return {
    id: `tmdb:${movie.id}`,
    source: 'tmdb',
    type: 'movie',
    title: movie.title,
    year: movie.release_date ? parseInt(movie.release_date.split('-')[0]) : undefined,
    overview: movie.overview,
    rating: movie.vote_average,
    posterUrl: getImageUrl(movie.poster_path),
    backdropUrl: getImageUrl(movie.backdrop_path, 'w1280'),
    externalIds: {
      tmdb: movie.id.toString(),
    },
  };
}

function mapTVShowToTitle(tv: TMDBTVShow): Title {
  return {
    id: `tmdb:${tv.id}`,
    source: 'tmdb',
    type: 'series',
    title: tv.name,
    year: tv.first_air_date ? parseInt(tv.first_air_date.split('-')[0]) : undefined,
    overview: tv.overview,
    rating: tv.vote_average,
    posterUrl: getImageUrl(tv.poster_path),
    backdropUrl: getImageUrl(tv.backdrop_path, 'w1280'),
    externalIds: {
      tmdb: tv.id.toString(),
    },
  };
}

function mapMovieDetailsToTitle(movie: TMDBMovieDetails): Title {
  return {
    id: `tmdb:${movie.id}`,
    source: 'tmdb',
    type: 'movie',
    title: movie.title,
    year: movie.release_date ? parseInt(movie.release_date.split('-')[0]) : undefined,
    overview: movie.overview,
    genres: movie.genres?.map(g => g.name),
    runtime: movie.runtime,
    rating: movie.vote_average,
    posterUrl: getImageUrl(movie.poster_path),
    backdropUrl: getImageUrl(movie.backdrop_path, 'w1280'),
    externalIds: {
      imdb: movie.imdb_id,
      tmdb: movie.id.toString(),
      tvdb: movie.external_ids?.tvdb_id?.toString(),
    },
  };
}

function mapTVDetailsToTitle(tv: TMDBTVDetails): Title {
  return {
    id: `tmdb:${tv.id}`,
    source: 'tmdb',
    type: 'series',
    title: tv.name,
    year: tv.first_air_date ? parseInt(tv.first_air_date.split('-')[0]) : undefined,
    overview: tv.overview,
    genres: tv.genres?.map(g => g.name),
    runtime: tv.episode_run_time?.[0],
    rating: tv.vote_average,
    posterUrl: getImageUrl(tv.poster_path),
    backdropUrl: getImageUrl(tv.backdrop_path, 'w1280'),
    externalIds: {
      imdb: tv.external_ids?.imdb_id,
      tmdb: tv.id.toString(),
      tvdb: tv.external_ids?.tvdb_id?.toString(),
    },
    seasons: tv.seasons?.map(s => s.season_number).filter(n => n > 0).sort((a, b) => a - b),
  };
}

function mapEpisodeToEpisode(episode: TMDBEpisode, seriesId: number): Episode {
  return {
    id: `tmdb:${seriesId}:${episode.season_number}:${episode.episode_number}`,
    season: episode.season_number,
    number: episode.episode_number,
    title: episode.name,
    overview: episode.overview,
    airDate: episode.air_date,
    runtime: episode.runtime,
    still: getImageUrl(episode.still_path),
  };
}

export class TMDBProvider implements MetadataProvider {
  private language: string = 'en-US';

  setLanguage(lang: string) {
    this.language = lang;
  }

  async getCatalog(
    type: 'movie' | 'series',
    catalogId: string,
    opts?: { skip?: number; limit?: number }
  ): Promise<Title[]> {
    const skip = opts?.skip || 0;
    const limit = opts?.limit || 25;
    const page = Math.floor(skip / 20) + 1; // TMDB returns 20 items per page

    // Map catalog IDs to TMDB endpoints
    let endpoint = '';
    let params = `api_key=${TMDB_API_KEY}&language=${this.language}&page=${page}`;

    const mediaType = type === 'series' ? 'tv' : 'movie';

    switch (catalogId) {
      case 'trending_movies':
        endpoint = 'trending/movie/week';
        break;
      case 'trending_tv':
        endpoint = 'trending/tv/week';
        break;
      case 'most_watched':
        endpoint = `${mediaType}/popular`;
        break;
      case 'top':
        endpoint = `${mediaType}/top_rated`;
        break;
      case 'anime':
        if (type === 'series') {
          endpoint = 'discover/tv';
          params += '&with_genres=16&with_origin_country=JP';
        } else {
          endpoint = 'discover/movie';
          params += '&with_genres=16&with_origin_country=JP';
        }
        break;
      case 'netflix':
        endpoint = `discover/${mediaType}`;
        params += '&with_networks=213'; // Netflix network ID
        break;
      case 'disney':
        endpoint = `discover/${mediaType}`;
        params += '&with_networks=2739'; // Disney+ network ID
        break;
      case 'hbo':
        endpoint = `discover/${mediaType}`;
        params += '&with_networks=49'; // HBO network ID
        break;
      case 'amazon':
        endpoint = `discover/${mediaType}`;
        params += '&with_networks=1024'; // Amazon Prime network ID
        break;
      case 'hulu':
        endpoint = `discover/${mediaType}`;
        params += '&with_networks=453'; // Hulu network ID
        break;
      case 'korean':
        endpoint = `discover/${mediaType}`;
        params += '&with_origin_country=KR';
        break;
      case 'indian':
        endpoint = `discover/${mediaType}`;
        params += '&with_origin_country=IN';
        break;
      case 'spanish':
        endpoint = `discover/${mediaType}`;
        params += '&with_origin_country=ES';
        break;
      case 'japanese':
        endpoint = `discover/${mediaType}`;
        params += '&with_origin_country=JP';
        break;
      default:
        endpoint = `${mediaType}/popular`;
    }

    const url = `${BASE_URL}/${endpoint}?${params}`;
    console.log('[TMDB] Fetching catalog:', url);

    try {
      const data: TMDBSearchResponse<TMDBMovie | TMDBTVShow> = await cachedFetch(url, CATALOG_TTL);
      const results = data.results || [];
      
      if (type === 'movie') {
        return (results as TMDBMovie[]).map(mapMovieToTitle).slice(skip % 20, (skip % 20) + limit);
      } else {
        return (results as TMDBTVShow[]).map(mapTVShowToTitle).slice(skip % 20, (skip % 20) + limit);
      }
    } catch (error) {
      console.error('[TMDB] getCatalog error:', error);
      return [];
    }
  }

  async search(type: 'movie' | 'series', query: string): Promise<Title[]> {
    if (!query.trim()) return [];

    // Demo mode - return hardcoded results for testing
    if (!TMDB_API_KEY || TMDB_API_KEY === 'demo_key') {
      console.log('[TMDB] Using demo mode for search:', query);
      return this.getDemoSearchResults(type, query);
    }

    const endpoint = type === 'movie' ? 'search/movie' : 'search/tv';
    const url = `${BASE_URL}/${endpoint}?api_key=${TMDB_API_KEY}&language=${this.language}&query=${encodeURIComponent(query.trim())}&page=1`;

    console.log('[TMDB] Search URL:', url);
    try {
      const data: TMDBSearchResponse<TMDBMovie | TMDBTVShow> = await cachedFetch(url, SEARCH_TTL);
      console.log('[TMDB] Search response:', data);
      console.log('[TMDB] Search results count:', data.results.length);
      
      if (data.results.length > 0) {
        const firstFew = data.results.slice(0, 3);
        if (type === 'movie') {
          console.log('[TMDB] First few movie results:', (firstFew as TMDBMovie[]).map(m => m.title));
        } else {
          console.log('[TMDB] First few TV results:', (firstFew as TMDBTVShow[]).map(t => t.name));
        }
      }

      if (type === 'movie') {
        return (data.results as TMDBMovie[]).map(mapMovieToTitle);
      } else {
        return (data.results as TMDBTVShow[]).map(mapTVShowToTitle);
      }
    } catch (error) {
      console.error('[TMDB] search error:', error);
      return [];
    }
  }

  private getDemoSearchResults(type: 'movie' | 'series', query: string): Title[] {
    const lowerQuery = query.toLowerCase();
    
    if (type === 'movie') {
      const demoMovies: Title[] = [
        {
          id: 'tmdb:27205',
          source: 'tmdb',
          type: 'movie',
          title: 'Inception',
          year: 2010,
          overview: 'Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets is offered a chance to regain his old life as payment for a task considered to be impossible: "inception", the implantation of another person\'s idea into a target\'s subconscious.',
          rating: 8.4,
          posterUrl: 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
          backdropUrl: 'https://image.tmdb.org/t/p/w1280/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
          externalIds: { tmdb: '27205', imdb: 'tt1375666' },
        },
        {
          id: 'tmdb:155',
          source: 'tmdb',
          type: 'movie',
          title: 'The Dark Knight',
          year: 2008,
          overview: 'Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets. The partnership proves to be effective, but they soon find themselves prey to a reign of chaos unleashed by a rising criminal mastermind known to the terrified citizens of Gotham as the Joker.',
          rating: 9.0,
          posterUrl: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
          backdropUrl: 'https://image.tmdb.org/t/p/w1280/hqkIcbrOHL86UncnHIsHVcVmzue.jpg',
          externalIds: { tmdb: '155', imdb: 'tt0468569' },
        },
        {
          id: 'tmdb:49026',
          source: 'tmdb',
          type: 'movie',
          title: 'The Dark Knight Rises',
          year: 2012,
          overview: 'Following the death of District Attorney Harvey Dent, Batman assumes responsibility for Dent\'s crimes to protect the late attorney\'s reputation and is subsequently hunted by the Gotham City Police Department. Eight years later, Batman encounters the mysterious Selina Kyle and the villainous Bane, a new terrorist leader who overwhelms Gotham\'s finest. The Dark Knight resurfaces to protect a city that has branded him an enemy.',
          rating: 8.2,
          posterUrl: 'https://image.tmdb.org/t/p/w500/vdAQxOnsxhgc6e1nxdV1nQiVYAX.jpg',
          backdropUrl: 'https://image.tmdb.org/t/p/w1280/85zHakxSGU6hP3TpUj8x3QdW2bZ.jpg',
          externalIds: { tmdb: '49026', imdb: 'tt1345836' },
        },
      ];

      // Filter results based on query
      return demoMovies.filter(movie => 
        movie.title.toLowerCase().includes(lowerQuery) ||
        movie.overview?.toLowerCase().includes(lowerQuery)
      );
    } else {
      const demoSeries: Title[] = [
        {
          id: 'tmdb:1399',
          source: 'tmdb',
          type: 'series',
          title: 'Game of Thrones',
          year: 2011,
          overview: 'Seven noble families fight for control of the mythical land of Westeros. Friction between the houses leads to full-scale war. All while a very ancient evil awakens in the farthest north. Amidst the war, a neglected military order of misfits, the Night\'s Watch, is all that stands between the realms of men and icy horrors beyond.',
          rating: 8.5,
          posterUrl: 'https://image.tmdb.org/t/p/w500/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg',
          backdropUrl: 'https://image.tmdb.org/t/p/w1280/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg',
          externalIds: { tmdb: '1399', imdb: 'tt0944947' },
          seasons: [1, 2, 3, 4, 5, 6, 7, 8],
        },
        {
          id: 'tmdb:1396',
          source: 'tmdb',
          type: 'series',
          title: 'Breaking Bad',
          year: 2008,
          overview: 'A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family\'s future.',
          rating: 9.5,
          posterUrl: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
          backdropUrl: 'https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
          externalIds: { tmdb: '1396', imdb: 'tt0903747' },
          seasons: [1, 2, 3, 4, 5],
          releaseDate: '2008-01-20',
          cast: [
            { name: 'Bryan Cranston', character: 'Walter White', profileUrl: 'https://image.tmdb.org/t/p/w500/8h7VfVh8nN0ntdWX8vV7n3hJ3xK.jpg' },
            { name: 'Aaron Paul', character: 'Jesse Pinkman', profileUrl: 'https://image.tmdb.org/t/p/w500/8h7VfVh8nN0ntdWX8vV7n3hJ3xK.jpg' },
            { name: 'Anna Gunn', character: 'Skyler White', profileUrl: 'https://image.tmdb.org/t/p/w500/8h7VfVh8nN0ntdWX8vV7n3hJ3xK.jpg' },
            { name: 'Dean Norris', character: 'Hank Schrader', profileUrl: 'https://image.tmdb.org/t/p/w500/8h7VfVh8nN0ntdWX8vV7n3hJ3xK.jpg' },
            { name: 'Betsy Brandt', character: 'Marie Schrader', profileUrl: 'https://image.tmdb.org/t/p/w500/8h7VfVh8nN0ntdWX8vV7n3hJ3xK.jpg' },
          ],
          streamingServices: ['Netflix', 'AMC+'],
          trailerUrl: 'https://www.youtube.com/watch?v=HhesaQXLuRY',
        },
      ];

      // Filter results based on query
      return demoSeries.filter(series => 
        series.title.toLowerCase().includes(lowerQuery) ||
        series.overview?.toLowerCase().includes(lowerQuery)
      );
    }
  }

  private getDemoCatalogResults(
    type: 'movie' | 'series',
    catalogId: string,
    opts?: { skip?: number; limit?: number }
  ): Title[] {
    const skip = opts?.skip || 0;
    const limit = opts?.limit || 25;
    
    // Get base content based on catalog type
    let content: Title[] = [];
    
    if (type === 'movie') {
      content = this.getDemoMovies();
    } else {
      content = this.getDemoSeries();
    }
    
    // Filter content based on catalog type
    switch (catalogId) {
      case 'trending_movies':
        content = content.slice(0, 25); // Trending movies
        break;
      case 'trending_tv':
        content = content.slice(0, 25); // Trending TV shows
        break;
      case 'most_watched':
        content = content.slice(0, 25); // Most watched content
        break;
      case 'netflix':
        content = content.slice(0, 25); // Netflix originals
        break;
      case 'disney':
        content = content.slice(0, 25); // Disney content
        break;
      case 'hbo':
        content = content.slice(0, 25); // HBO content
        break;
      case 'amazon':
        content = content.slice(0, 25); // Amazon content
        break;
      case 'hulu':
        content = content.slice(0, 25); // Hulu content
        break;
      case 'korean':
        content = this.getKoreanContent(type);
        break;
      case 'indian':
        content = this.getIndianContent(type);
        break;
      case 'spanish':
        content = this.getSpanishContent(type);
        break;
      case 'japanese':
        content = this.getJapaneseContent(type);
        break;
      case 'anime':
        content = this.getAnimeContent();
        break;
    }
    
    return content.slice(skip, skip + limit);
  }

  private getDemoMovies(): Title[] {
    return [
      {
        id: 'tmdb:27205',
        source: 'tmdb',
        type: 'movie',
        title: 'Inception',
        year: 2010,
        overview: 'Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets is offered a chance to regain his old life as payment for a task considered to be impossible: "inception", the implantation of another person\'s idea into a target\'s subconscious.',
        rating: 8.4,
        posterUrl: 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
        externalIds: { tmdb: '27205', imdb: 'tt1375666' },
      },
      {
        id: 'tmdb:155',
        source: 'tmdb',
        type: 'movie',
        title: 'The Dark Knight',
        year: 2008,
        overview: 'Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets. The partnership proves to be effective, but they soon find themselves prey to a reign of chaos unleashed by a rising criminal mastermind known to the terrified citizens of Gotham as the Joker.',
        rating: 9.0,
        posterUrl: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/hqkIcbrOHL86UncnHIsHVcVmzue.jpg',
        externalIds: { tmdb: '155', imdb: 'tt0468569' },
      },
      {
        id: 'tmdb:49026',
        source: 'tmdb',
        type: 'movie',
        title: 'The Dark Knight Rises',
        year: 2012,
        overview: 'Following the death of District Attorney Harvey Dent, Batman assumes responsibility for Dent\'s crimes to protect the late attorney\'s reputation and is subsequently hunted by the Gotham City Police Department. Eight years later, Batman encounters the mysterious Selina Kyle and the villainous Bane, a new terrorist leader who overwhelms Gotham\'s finest. The Dark Knight resurfaces to protect a city that has branded him an enemy.',
        rating: 8.2,
        posterUrl: 'https://image.tmdb.org/t/p/w500/vdAQxOnsxhgc6e1nxdV1nQiVYAX.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/85zHakxSGU6hP3TpUj8x3QdW2bZ.jpg',
        externalIds: { tmdb: '49026', imdb: 'tt1345836' },
      },
      {
        id: 'tmdb:550',
        source: 'tmdb',
        type: 'movie',
        title: 'Fight Club',
        year: 1999,
        overview: 'A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy. Their concept catches on, with underground "fight clubs" forming in every town, until an eccentric gets in the way and ignites an out-of-control spiral toward oblivion.',
        rating: 8.4,
        posterUrl: 'https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/87hTDiay2N2qWyX4Dx7d0T6bvl.jpg',
        externalIds: { tmdb: '550', imdb: 'tt0137523' },
      },
      {
        id: 'tmdb:13',
        source: 'tmdb',
        type: 'movie',
        title: 'Forrest Gump',
        year: 1994,
        overview: 'A man with a low IQ has accomplished great things in his life and been present during significant historic events—in each case, far exceeding what anyone imagined he could do. But despite all he has achieved, his one true love eludes him.',
        rating: 8.5,
        posterUrl: 'https://image.tmdb.org/t/p/w500/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7c9UVPPiTPltouxRVY6N9uugaVA.jpg',
        externalIds: { tmdb: '13', imdb: 'tt0109830' },
      },
      {
        id: 'tmdb:238',
        source: 'tmdb',
        type: 'movie',
        title: 'The Godfather',
        year: 1972,
        overview: 'The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.',
        rating: 8.7,
        posterUrl: 'https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/tmU7GeKVybMWFButWEGl2M4GeiP.jpg',
        externalIds: { tmdb: '238', imdb: 'tt0068646' },
      },
      {
        id: 'tmdb:424',
        source: 'tmdb',
        type: 'movie',
        title: 'Schindler\'s List',
        year: 1993,
        overview: 'The true story of how businessman Oskar Schindler saved over a thousand Jewish lives from the Nazis while they worked as slaves in his factory during World War II.',
        rating: 8.9,
        posterUrl: 'https://image.tmdb.org/t/p/w500/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/loRmRzQXZeqG78TqZuyvSlEQfZb.jpg',
        externalIds: { tmdb: '424', imdb: 'tt0108052' },
      },
      {
        id: 'tmdb:389',
        source: 'tmdb',
        type: 'movie',
        title: '12 Angry Men',
        year: 1957,
        overview: 'The defense and the prosecution have rested and the jury is filing into the jury room to decide if a young Spanish-American is guilty or innocent of murdering his father.',
        rating: 8.5,
        posterUrl: 'https://image.tmdb.org/t/p/w500/ow3wq89wM8qd5X7hWKxiRfsFf9C.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/qqHQsStV6exghCM7zbObuYBiYxw.jpg',
        externalIds: { tmdb: '389', imdb: 'tt0050083' },
      },
      {
        id: 'tmdb:129',
        source: 'tmdb',
        type: 'movie',
        title: 'Spirited Away',
        year: 2001,
        overview: 'A young girl, Chihiro, becomes trapped in a strange new world of spirits. When her parents undergo a mysterious transformation, she must call upon the courage she never knew she had to free her family.',
        rating: 8.6,
        posterUrl: 'https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/Ab8mkHmkYADjU7wQiOkia9BzGvS.jpg',
        externalIds: { tmdb: '129', imdb: 'tt0245429' },
      },
      {
        id: 'tmdb:278',
        source: 'tmdb',
        type: 'movie',
        title: 'The Shawshank Redemption',
        year: 1994,
        overview: 'Framed in the 1940s for the double murder of his wife and her lover, upstanding banker Andy Dufresne begins a new life at the Shawshank prison, where he puts his accounting skills to work for an amoral warden.',
        rating: 8.7,
        posterUrl: 'https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/iNh3BivHyg5sQRPP1KOkzguEX0H.jpg',
        externalIds: { tmdb: '278', imdb: 'tt0111161' },
      },
      {
        id: 'tmdb:19404',
        source: 'tmdb',
        type: 'movie',
        title: 'Dilwale Dulhania Le Jayenge',
        year: 1995,
        overview: 'Raj is a rich, carefree, happy-go-lucky second generation NRI. Simran is the daughter of Chaudhary Baldev Singh, who in spite of being an NRI is very strict about adherence to Indian values.',
        rating: 8.7,
        posterUrl: 'https://image.tmdb.org/t/p/w500/2CAL2433ZeIihfX1Hb2139CX0pW.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/90ez6ArvpO8bvpyIngBuwXOqJm5.jpg',
        externalIds: { tmdb: '19404', imdb: 'tt0112870' },
      },
      {
        id: 'tmdb:372058',
        source: 'tmdb',
        type: 'movie',
        title: 'Your Name',
        year: 2016,
        overview: 'High schoolers Mitsuha and Taki are complete strangers living separate lives. But one night, they suddenly switch places. Mitsuha wakes up in Taki\'s body, and he in hers.',
        rating: 8.2,
        posterUrl: 'https://image.tmdb.org/t/p/w500/q719jXXEzOoYaps6babgKnONONX.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7OMbUN8btOi4flWizJ2hFExRpGm.jpg',
        externalIds: { tmdb: '372058', imdb: 'tt5311514' },
      },
      {
        id: 'tmdb:496243',
        source: 'tmdb',
        type: 'movie',
        title: 'Parasite',
        year: 2019,
        overview: 'All unemployed, Ki-taek\'s family takes peculiar interest in the wealthy and glamorous Parks for their livelihood until they get entangled in an unexpected incident.',
        rating: 8.5,
        posterUrl: 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg',
        externalIds: { tmdb: '496243', imdb: 'tt6751668' },
      },
      {
        id: 'tmdb:324857',
        source: 'tmdb',
        type: 'movie',
        title: 'Spider-Man: Into the Spider-Verse',
        year: 2018,
        overview: 'Miles Morales is juggling his life between being a high school student and being a spider-man. When Wilson "Kingpin" Fisk uses a super collider, another spider-man from another dimension, Peter Parker, accidentally winds up in Miles\' dimension.',
        rating: 8.4,
        posterUrl: 'https://image.tmdb.org/t/p/w500/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7d6EY00g1c39SGZOoCJ5Py9nNth.jpg',
        externalIds: { tmdb: '324857', imdb: 'tt4633694' },
      },
      {
        id: 'tmdb:680',
        source: 'tmdb',
        type: 'movie',
        title: 'Pulp Fiction',
        year: 1994,
        overview: 'A burger-loving hit man, his philosophical partner, a drug-addled gangster\'s moll and a washed-up boxer converge in this sprawling, comedic crime caper.',
        rating: 8.5,
        posterUrl: 'https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/4cDFJr4HnXN5AdPw4AKrmLlMWdO.jpg',
        externalIds: { tmdb: '680', imdb: 'tt0110912' },
      },
      {
        id: 'tmdb:389',
        source: 'tmdb',
        type: 'movie',
        title: 'The Good, the Bad and the Ugly',
        year: 1966,
        overview: 'While the Civil War rages between the Union and the Confederacy, three men – a quiet loner, a ruthless hit man and a Mexican bandit – comb the American Southwest in search of a strongbox containing $200,000 in stolen gold.',
        rating: 8.8,
        posterUrl: 'https://image.tmdb.org/t/p/w500/bX2xnavhMYjWDoZp1VM6VnU1xwe.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/90ez6ArvpO8bvpyIngBuwXOqJm5.jpg',
        externalIds: { tmdb: '389', imdb: 'tt0060196' },
      },
      {
        id: 'tmdb:429',
        source: 'tmdb',
        type: 'movie',
        title: 'The Good, the Bad and the Ugly',
        year: 1966,
        overview: 'While the Civil War rages between the Union and the Confederacy, three men – a quiet loner, a ruthless hit man and a Mexican bandit – comb the American Southwest in search of a strongbox containing $200,000 in stolen gold.',
        rating: 8.8,
        posterUrl: 'https://image.tmdb.org/t/p/w500/bX2xnavhMYjWDoZp1VM6VnU1xwe.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/90ez6ArvpO8bvpyIngBuwXOqJm5.jpg',
        externalIds: { tmdb: '429', imdb: 'tt0060196' },
      },
      {
        id: 'tmdb:496243',
        source: 'tmdb',
        type: 'movie',
        title: 'The Matrix',
        year: 1999,
        overview: 'Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.',
        rating: 8.2,
        posterUrl: 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg',
        externalIds: { tmdb: '496243', imdb: 'tt0133093' },
      },
      {
        id: 'tmdb:324857',
        source: 'tmdb',
        type: 'movie',
        title: 'The Lord of the Rings: The Fellowship of the Ring',
        year: 2001,
        overview: 'Young hobbit Frodo Baggins, after inheriting a mysterious ring from his uncle Bilbo, must leave his home in order to keep it from falling into the hands of its evil creator.',
        rating: 8.4,
        posterUrl: 'https://image.tmdb.org/t/p/w500/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/1R6cvRtZgsYCkh8UFuWFN33xBP4.jpg',
        externalIds: { tmdb: '324857', imdb: 'tt0120737' },
      },
      {
        id: 'tmdb:680',
        source: 'tmdb',
        type: 'movie',
        title: 'The Lord of the Rings: The Return of the King',
        year: 2003,
        overview: 'Aragorn is revealed as the heir to the ancient kings as he, Gandalf and the other members of the broken fellowship struggle to save Gondor from Sauron\'s forces.',
        rating: 8.6,
        posterUrl: 'https://image.tmdb.org/t/p/w500/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/2u7zbn8EudG6kLlBzUYqP8RyFU4.jpg',
        externalIds: { tmdb: '680', imdb: 'tt0167260' },
      },
      {
        id: 'tmdb:389',
        source: 'tmdb',
        type: 'movie',
        title: 'The Lord of the Rings: The Two Towers',
        year: 2002,
        overview: 'Frodo and Sam are trekking to Mordor to destroy the One Ring of Power while Gimli, Legolas and Aragorn search for the orc-captured Merry and Pippin.',
        rating: 8.4,
        posterUrl: 'https://image.tmdb.org/t/p/w500/5VTN0pR8gcqV3EPUHHfMGnJYN9L.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/5wDBVictj4wUYZzA5x3Xu0AvBP0.jpg',
        externalIds: { tmdb: '389', imdb: 'tt0167261' },
      },
      {
        id: 'tmdb:429',
        source: 'tmdb',
        type: 'movie',
        title: 'Star Wars: Episode IV - A New Hope',
        year: 1977,
        overview: 'Princess Leia is captured and held hostage by the evil Imperial forces in their effort to take over the galactic Empire.',
        rating: 8.1,
        posterUrl: 'https://image.tmdb.org/t/p/w500/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/4fLZUr1e65h0PP5x0tR9YSlXGsi.jpg',
        externalIds: { tmdb: '429', imdb: 'tt0076759' },
      },
      {
        id: 'tmdb:496243',
        source: 'tmdb',
        type: 'movie',
        title: 'Star Wars: Episode V - The Empire Strikes Back',
        year: 1980,
        overview: 'The epic saga continues as Luke Skywalker, in hopes of defeating the evil Galactic Empire, learns the ways of the Jedi from aging master Yoda.',
        rating: 8.3,
        posterUrl: 'https://image.tmdb.org/t/p/w500/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/8BTsTfln4jlQrLXUBquXJ0ASQy9.jpg',
        externalIds: { tmdb: '496243', imdb: 'tt0080684' },
      },
      {
        id: 'tmdb:324857',
        source: 'tmdb',
        type: 'movie',
        title: 'Star Wars: Episode VI - Return of the Jedi',
        year: 1983,
        overview: 'As Rebel leaders map their strategy for an all-out attack on the Emperor\'s newer, bigger Death Star, Han Solo remains frozen in carbonite and Luke Skywalker attempts to rescue his father from the dark side.',
        rating: 8.0,
        posterUrl: 'https://image.tmdb.org/t/p/w500/j2FA5XQ7qQhB7c0e3rL9iWcX7V9.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg',
        externalIds: { tmdb: '324857', imdb: 'tt0086190' },
      },
      {
        id: 'tmdb:680',
        source: 'tmdb',
        type: 'movie',
        title: 'The Lion King',
        year: 1994,
        overview: 'A young lion prince is cast out of his pride by his cruel uncle, who claims he killed his father. While the uncle rules with an iron paw, the prince grows up beyond the Savannah, living by a philosophy: No worries for the rest of your days.',
        rating: 8.1,
        posterUrl: 'https://image.tmdb.org/t/p/w500/sKCr78MXSLixwmZ8DyJLrpMsd15.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg',
        externalIds: { tmdb: '680', imdb: 'tt0110357' },
      },
      {
        id: 'tmdb:389',
        source: 'tmdb',
        type: 'movie',
        title: 'Aladdin',
        year: 1992,
        overview: 'Princess Jasmine grows tired of being forced to remain in the palace, so she sneaks out into the marketplace, where she meets street-urchin Aladdin.',
        rating: 7.6,
        posterUrl: 'https://image.tmdb.org/t/p/w500/3iYQTLGoy7QnjcUYRJy4YrAgGvp.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg',
        externalIds: { tmdb: '389', imdb: 'tt0103639' },
      },
      {
        id: 'tmdb:429',
        source: 'tmdb',
        type: 'movie',
        title: 'Beauty and the Beast',
        year: 1991,
        overview: 'Follow the adventures of Belle, a bright young woman who finds herself in the castle of a prince who\'s been turned into a mysterious beast.',
        rating: 7.8,
        posterUrl: 'https://image.tmdb.org/t/p/w500/hKmp0lT4DfWQWIVn8lJ0FIj0bX9.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg',
        externalIds: { tmdb: '429', imdb: 'tt0101414' },
      },
      {
        id: 'tmdb:496243',
        source: 'tmdb',
        type: 'movie',
        title: 'The Little Mermaid',
        year: 1989,
        overview: 'This colorful adventure tells the story of an impetuous mermaid princess named Ariel who falls in love with the human Prince Eric and risks everything for her true love.',
        rating: 7.3,
        posterUrl: 'https://image.tmdb.org/t/p/w500/ym1dxyOk4jFcSl4Q2zmRrA5BEEN.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg',
        externalIds: { tmdb: '496243', imdb: 'tt0097757' },
      },
      {
        id: 'tmdb:324857',
        source: 'tmdb',
        type: 'movie',
        title: 'Mulan',
        year: 1998,
        overview: 'To save her father from death in the army, a young maiden secretly goes in his place and becomes one of China\'s greatest heroines in the process.',
        rating: 7.6,
        posterUrl: 'https://image.tmdb.org/t/p/w500/5TYgKxYjnchMcti3akTHqpbKBP1.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg',
        externalIds: { tmdb: '324857', imdb: 'tt0120762' },
      },
      {
        id: 'tmdb:680',
        source: 'tmdb',
        type: 'movie',
        title: 'Pocahontas',
        year: 1995,
        overview: 'Pocahontas, daughter of a Native American tribe chief, falls in love with an English soldier as colonists invade 17th century Virginia.',
        rating: 6.7,
        posterUrl: 'https://image.tmdb.org/t/p/w500/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg',
        externalIds: { tmdb: '680', imdb: 'tt0114148' },
      },
    ];
  }

  private getDemoSeries(): Title[] {
    return [
      {
        id: 'tmdb:1399',
        source: 'tmdb',
        type: 'series',
        title: 'Game of Thrones',
        year: 2011,
        overview: 'Seven noble families fight for control of the mythical land of Westeros. Friction between the houses leads to full-scale war. All while a very ancient evil awakens in the farthest north. Amidst the war, a neglected military order of misfits, the Night\'s Watch, is all that stands between the realms of men and icy horrors beyond.',
        rating: 8.5,
        posterUrl: 'https://image.tmdb.org/t/p/w500/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg',
        externalIds: { tmdb: '1399', imdb: 'tt0944947' },
        seasons: [1, 2, 3, 4, 5, 6, 7, 8],
      },
      {
        id: 'tmdb:1396',
        source: 'tmdb',
        type: 'series',
        title: 'Breaking Bad',
        year: 2008,
        overview: 'A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family\'s future.',
        rating: 9.5,
        posterUrl: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
        externalIds: { tmdb: '1396', imdb: 'tt0903747' },
        seasons: [1, 2, 3, 4, 5],
      },
      {
        id: 'tmdb:1398',
        source: 'tmdb',
        type: 'series',
        title: 'The Sopranos',
        year: 1999,
        overview: 'The story of New Jersey-based Italian-American mobster Tony Soprano and the difficulties he faces as he tries to balance the conflicting requirements of his home life and the criminal organization he leads.',
        rating: 9.2,
        posterUrl: 'https://image.tmdb.org/t/p/w500/rTc7ZXdroqjkKivFPvCPX0Ru7uw.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7c9UVPPiTPltouxRVY6N9uugaVA.jpg',
        externalIds: { tmdb: '1398', imdb: 'tt0141842' },
        seasons: [1, 2, 3, 4, 5, 6],
      },
      {
        id: 'tmdb:1402',
        source: 'tmdb',
        type: 'series',
        title: 'The Walking Dead',
        year: 2010,
        overview: 'Sheriff Deputy Rick Grimes wakes up from a coma to learn the world is in ruins and must lead a group of survivors to stay alive.',
        rating: 8.1,
        posterUrl: 'https://image.tmdb.org/t/p/w500/rqeYMLryjcawh2JeRpCVUDXYM5b.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/5DUMPBSnHOZsbBv81GFXZXvDpo6.jpg',
        externalIds: { tmdb: '1402', imdb: 'tt1520211' },
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      },
      {
        id: 'tmdb:1408',
        source: 'tmdb',
        type: 'series',
        title: 'House',
        year: 2004,
        overview: 'Dr. Gregory House, a drug-addicted, unconventional, misanthropic medical genius, leads a team of diagnosticians at the fictional Princeton-Plainsboro Teaching Hospital in New Jersey.',
        rating: 8.7,
        posterUrl: 'https://image.tmdb.org/t/p/w500/lkvhReTBZ2Ksl0Dl5Oplsf6UYkF.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/5DUMPBSnHOZsbBv81GFXZXvDpo6.jpg',
        externalIds: { tmdb: '1408', imdb: 'tt0412142' },
        seasons: [1, 2, 3, 4, 5, 6, 7, 8],
      },
      {
        id: 'tmdb:1418',
        source: 'tmdb',
        type: 'series',
        title: 'The Big Bang Theory',
        year: 2007,
        overview: 'The sitcom is centered on five characters living in Pasadena, California: roommates Leonard Hofstadter and Sheldon Cooper; Penny, a waitress and aspiring actress who lives across the hall; and Leonard and Sheldon\'s equally geeky and socially awkward friends and co-workers, mechanical engineer Howard Wolowitz and astrophysicist Raj Koothrappali.',
        rating: 8.2,
        posterUrl: 'https://image.tmdb.org/t/p/w500/oKIYuWN2N0C9yXgEiF2D1xqF9Gw.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/oKIYuWN2N0C9yXgEiF2D1xqF9Gw.jpg',
        externalIds: { tmdb: '1418', imdb: 'tt0898266' },
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      },
      {
        id: 'tmdb:1668',
        source: 'tmdb',
        type: 'series',
        title: 'Friends',
        year: 1994,
        overview: 'The misadventures of a group of friends as they navigate the pitfalls of work, life and love in Manhattan.',
        rating: 8.9,
        posterUrl: 'https://image.tmdb.org/t/p/w500/2koX1xLkpTQM4IZebYvaxgJ7VZx.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/2koX1xLkpTQM4IZebYvaxgJ7VZx.jpg',
        externalIds: { tmdb: '1668', imdb: 'tt0108778' },
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      },
      {
        id: 'tmdb:1413',
        source: 'tmdb',
        type: 'series',
        title: 'American Horror Story',
        year: 2011,
        overview: 'An anthology horror drama series centering on different characters and locations, including a house with a murderous past, an asylum, a witch coven, a freak show, a hotel, a farmhouse in Roanoke, a cult, the apocalypse and a summer camp.',
        rating: 8.1,
        posterUrl: 'https://image.tmdb.org/t/p/w500/5LYA4MBAJRw6r3jIzfMz3vfYEcE.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/5LYA4MBAJRw6r3jIzfMz3vfYEcE.jpg',
        externalIds: { tmdb: '1413', imdb: 'tt1844624' },
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      },
      {
        id: 'tmdb:1416',
        source: 'tmdb',
        type: 'series',
        title: 'Grey\'s Anatomy',
        year: 2005,
        overview: 'Follows the personal and professional lives of a group of doctors at Seattle\'s Grey Sloan Memorial Hospital.',
        rating: 8.2,
        posterUrl: 'https://image.tmdb.org/t/p/w500/gdvIHfqxXPrKBpZJMxjl0nKDM4i.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/gdvIHfqxXPrKBpZJMxjl0nKDM4i.jpg',
        externalIds: { tmdb: '1416', imdb: 'tt0413573' },
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
      },
      {
        id: 'tmdb:4194',
        source: 'tmdb',
        type: 'series',
        title: 'The Office',
        year: 2005,
        overview: 'The everyday lives of office employees in the Scranton, Pennsylvania branch of the fictional Dunder Mifflin Paper Company.',
        rating: 8.6,
        posterUrl: 'https://image.tmdb.org/t/p/w500/qWnJzyZhyy74gjpSjIXWmuk0ifX.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/qWnJzyZhyy74gjpSjIXWmuk0ifX.jpg',
        externalIds: { tmdb: '4194', imdb: 'tt0386676' },
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      },
      {
        id: 'tmdb:46952',
        source: 'tmdb',
        type: 'series',
        title: 'The Witcher',
        year: 2019,
        overview: 'Geralt of Rivia, a mutated monster-hunter for hire, journeys toward his destiny in a turbulent world where people often prove more wicked than beasts.',
        rating: 8.0,
        posterUrl: 'https://image.tmdb.org/t/p/w500/7vjaCdMw15FEbXyLQTVa04URsPm.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7vjaCdMw15FEbXyLQTVa04URsPm.jpg',
        externalIds: { tmdb: '46952', imdb: 'tt5180504' },
        seasons: [1, 2, 3],
      },
      {
        id: 'tmdb:60625',
        source: 'tmdb',
        type: 'series',
        title: 'Rick and Morty',
        year: 2013,
        overview: 'Rick is a mentally-unbalanced but scientifically-gifted old man who has recently reconnected with his family. He spends most of his time involving his young grandson Morty in dangerous, outlandish adventures throughout space and alternate universes.',
        rating: 8.7,
        posterUrl: 'https://image.tmdb.org/t/p/w500/gdIrmf2DdY5mgN6ycVP0XlzKzbE.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/gdIrmf2DdY5mgN6ycVP0XlzKzbE.jpg',
        externalIds: { tmdb: '60625', imdb: 'tt2861424' },
        seasons: [1, 2, 3, 4, 5, 6, 7],
      },
      {
        id: 'tmdb:1402',
        source: 'tmdb',
        type: 'series',
        title: 'Stranger Things',
        year: 2016,
        overview: 'When a young boy disappears, his mother, a police chief and his friends must confront terrifying supernatural forces in order to get him back.',
        rating: 8.6,
        posterUrl: 'https://image.tmdb.org/t/p/w500/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg',
        externalIds: { tmdb: '66732', imdb: 'tt4574334' },
        seasons: [1, 2, 3, 4],
      },
      {
        id: 'tmdb:94605',
        source: 'tmdb',
        type: 'series',
        title: 'Arcane',
        year: 2021,
        overview: 'Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war between magic technologies and clashing convictions.',
        rating: 9.0,
        posterUrl: 'https://image.tmdb.org/t/p/w500/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg',
        externalIds: { tmdb: '94605', imdb: 'tt11126994' },
        seasons: [1, 2],
      },
      {
        id: 'tmdb:84958',
        source: 'tmdb',
        type: 'series',
        title: 'Loki',
        year: 2021,
        overview: 'After stealing the Tesseract during the events of "Avengers: Endgame," an alternate version of Loki is brought to the mysterious Time Variance Authority, a bureaucratic organization that exists outside of time and space and monitors the timeline.',
        rating: 8.1,
        posterUrl: 'https://image.tmdb.org/t/p/w500/kEl2t3OhXc3Zb9FBh1AuYzRTgZp.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/kEl2t3OhXc3Zb9FBh1AuYzRTgZp.jpg',
        externalIds: { tmdb: '84958', imdb: 'tt9140554' },
        seasons: [1, 2],
      },
      {
        id: 'tmdb:62286',
        source: 'tmdb',
        type: 'series',
        title: 'Fear the Walking Dead',
        year: 2015,
        overview: 'What did the world look like as it was transforming into the horrifying apocalypse depicted in "The Walking Dead"? This spin-off set in Los Angeles, following new characters as they face the beginning of the end of the world, will answer that question.',
        rating: 7.6,
        posterUrl: 'https://image.tmdb.org/t/p/w500/wGFUewXPeMErCe2xnCmmLEiHOGh.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/wGFUewXPeMErCe2xnCmmLEiHOGh.jpg',
        externalIds: { tmdb: '62286', imdb: 'tt3743822' },
        seasons: [1, 2, 3, 4, 5, 6, 7, 8],
      },
      {
        id: 'tmdb:62425',
        source: 'tmdb',
        type: 'series',
        title: 'Dark',
        year: 2017,
        overview: 'A missing child causes four families to help each other for answers. What they could not imagine is that this mystery would be connected to innumerable other secrets of the small town.',
        rating: 8.5,
        posterUrl: 'https://image.tmdb.org/t/p/w500/56v2KjBlU4XaOv9rVYEQypROD7P.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/56v2KjBlU4XaOv9rVYEQypROD7P.jpg',
        externalIds: { tmdb: '70523', imdb: 'tt5753856' },
        seasons: [1, 2, 3],
      },
      {
        id: 'tmdb:71446',
        source: 'tmdb',
        type: 'series',
        title: 'Money Heist',
        year: 2017,
        overview: 'To carry out the biggest heist in history, a mysterious man called The Professor recruits a band of eight robbers who have a single characteristic: none of them has anything to lose. Five months of seclusion - memorizing every step, every detail, every probability - culminate in eleven days locked up in the National Coinage and Stamp Factory of Spain, surrounded by police forces and with dozens of hostages in their power, to find out whether their suicide wager will lead to everything or nothing.',
        rating: 8.3,
        posterUrl: 'https://image.tmdb.org/t/p/w500/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg',
        externalIds: { tmdb: '71446', imdb: 'tt6468322' },
        seasons: [1, 2, 3, 4, 5],
      },
      {
        id: 'tmdb:69050',
        source: 'tmdb',
        type: 'series',
        title: 'Riverdale',
        year: 2017,
        overview: 'Set in the present, the series offers a bold, subversive take on Archie, Betty, Veronica and their friends, exploring the surreality of small-town life, the darkness and weirdness bubbling beneath Riverdale\'s wholesome facade.',
        rating: 8.6,
        posterUrl: 'https://image.tmdb.org/t/p/w500/4X7o1ssOEvp4BFLim1AZmPNcYbU.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/4X7o1ssOEvp4BFLim1AZmPNcYbU.jpg',
        externalIds: { tmdb: '69050', imdb: 'tt5420376' },
        seasons: [1, 2, 3, 4, 5, 6, 7],
      },
      {
        id: 'tmdb:71712',
        source: 'tmdb',
        type: 'series',
        title: 'The Good Doctor',
        year: 2017,
        overview: 'A young surgeon with Savant syndrome is recruited into the surgical unit of a prestigious hospital. The question will arise: can a person who doesn\'t have the ability to relate to people actually save their lives?',
        rating: 8.6,
        posterUrl: 'https://image.tmdb.org/t/p/w500/6tfT03sGp9k4c0J3dypjrI8TSAI.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/6tfT03sGp9k4c0J3dypjrI8TSAI.jpg',
        externalIds: { tmdb: '71712', imdb: 'tt6470478' },
        seasons: [1, 2, 3, 4, 5, 6, 7],
      },
      {
        id: 'tmdb:80240',
        source: 'tmdb',
        type: 'series',
        title: 'The Last of Us',
        year: 2023,
        overview: 'Twenty years after modern civilization has been destroyed, Joel, a hardened survivor, is hired to smuggle Ellie, a 14-year-old girl, out of an oppressive quarantine zone. What starts as a small job soon becomes a brutal, heartbreaking journey, as they both must traverse the United States and depend on each other for survival.',
        rating: 8.7,
        posterUrl: 'https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg',
        externalIds: { tmdb: '100088', imdb: 'tt3581920' },
        seasons: [1, 2],
      },
      {
        id: 'tmdb:85271',
        source: 'tmdb',
        type: 'series',
        title: 'WandaVision',
        year: 2021,
        overview: 'Wanda Maximoff and Vision—two super-powered beings living idealized suburban lives—begin to suspect that everything is not as it seems.',
        rating: 8.2,
        posterUrl: 'https://image.tmdb.org/t/p/w500/glKDfE6btIRcVB5zrjspRIs4r52.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/glKDfE6btIRcVB5zrjspRIs4r52.jpg',
        externalIds: { tmdb: '85271', imdb: 'tt9140560' },
        seasons: [1],
      },
      {
        id: 'tmdb:95396',
        source: 'tmdb',
        type: 'series',
        title: 'Severance',
        year: 2022,
        overview: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives. When a mysterious colleague appears outside of work, it begins a journey to discover the truth about their jobs.',
        rating: 8.9,
        posterUrl: 'https://image.tmdb.org/t/p/w500/lFf6LLrQjYldcZItzOkGmMMigP7.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/lFf6LLrQjYldcZItzOkGmMMigP7.jpg',
        externalIds: { tmdb: '95396', imdb: 'tt11280740' },
        seasons: [1, 2],
      },
      {
        id: 'tmdb:95557',
        source: 'tmdb',
        type: 'series',
        title: 'Invincible',
        year: 2021,
        overview: 'Mark Grayson is a normal teenager except for the fact that his father is the most powerful superhero on the planet. Shortly after his seventeenth birthday, Mark begins to develop powers of his own and enters into his father\'s tutelage.',
        rating: 8.7,
        posterUrl: 'https://image.tmdb.org/t/p/w500/yDWJYRAwMNKbIYT8ZB33qy84uzO.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/yDWJYRAwMNKbIYT8ZB33qy84uzO.jpg',
        externalIds: { tmdb: '95557', imdb: 'tt6741278' },
        seasons: [1, 2],
      },
      {
        id: 'tmdb:110492',
        source: 'tmdb',
        type: 'series',
        title: 'Peacemaker',
        year: 2022,
        overview: 'The continuing story of Peacemaker – a compellingly vainglorious man who believes in peace at any cost, no matter how many people he has to kill to get it – in the aftermath of the events of "The Suicide Squad."',
        rating: 8.3,
        posterUrl: 'https://image.tmdb.org/t/p/w500/hE3LRZAY84fG19a18pzpkZERjTE.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/hE3LRZAY84fG19a18pzpkZERjTE.jpg',
        externalIds: { tmdb: '110492', imdb: 'tt13146488' },
        seasons: [1, 2],
      },
      {
        id: 'tmdb:95403',
        source: 'tmdb',
        type: 'series',
        title: 'The Sandman',
        year: 2022,
        overview: 'After years of imprisonment, Morpheus — the King of Dreams — embarks on a journey across worlds to find what was stolen from him and restore his power.',
        rating: 7.9,
        posterUrl: 'https://image.tmdb.org/t/p/w500/q54qEgagGOYCq5D1903eBVMNkbo.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/q54qEgagGOYCq5D1903eBVMNkbo.jpg',
        externalIds: { tmdb: '90802', imdb: 'tt1751634' },
        seasons: [1, 2],
      },
      {
        id: 'tmdb:92830',
        source: 'tmdb',
        type: 'series',
        title: 'Ozark',
        year: 2017,
        overview: 'A financial adviser drags his family from Chicago to the Missouri Ozarks, where he must launder $500 million in five years to appease a drug boss.',
        rating: 8.3,
        posterUrl: 'https://image.tmdb.org/t/p/w500/m73QKNDHAMwwXcFOT1qBMc1uwHP.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/m73QKNDHAMwwXcFOT1qBMc1uwHP.jpg',
        externalIds: { tmdb: '69740', imdb: 'tt5071412' },
        seasons: [1, 2, 3, 4],
      },
      {
        id: 'tmdb:82856',
        source: 'tmdb',
        type: 'series',
        title: 'The Mandalorian',
        year: 2019,
        overview: 'After the fall of the Galactic Empire, lawlessness has spread throughout the galaxy. A lone gunfighter makes his way through the outer reaches, earning his keep as a bounty hunter.',
        rating: 8.5,
        posterUrl: 'https://image.tmdb.org/t/p/w500/BbNvKCuEF4SRzFXR16aK6ISFaHm.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/BbNvKCuEF4SRzFXR16aK6ISFaHm.jpg',
        externalIds: { tmdb: '82856', imdb: 'tt8111088' },
        seasons: [1, 2, 3],
      },
      {
        id: 'tmdb:88329',
        source: 'tmdb',
        type: 'series',
        title: 'Chernobyl',
        year: 2019,
        overview: 'The true story of one of the worst man-made catastrophes in history: the catastrophic nuclear accident at Chernobyl. A tale of the brave men and women who sacrificed to save Europe from unimaginable disaster.',
        rating: 9.3,
        posterUrl: 'https://image.tmdb.org/t/p/w500/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg',
        externalIds: { tmdb: '87108', imdb: 'tt7366338' },
        seasons: [1],
      },
    ];
  }

  private getKoreanContent(type: 'movie' | 'series'): Title[] {
    if (type === 'movie') {
      return [
        {
          id: 'tmdb:496243',
          source: 'tmdb',
          type: 'movie',
          title: 'Parasite',
          year: 2019,
          overview: 'All unemployed, Ki-taek and his family take peculiar interest in the wealthy Park family, led by tech CEO Dong-ik, and ingratiate themselves into their lives by infiltrating their household and posing as unrelated, highly qualified individuals.',
          rating: 8.5,
          posterUrl: 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
          backdropUrl: 'https://image.tmdb.org/t/p/w1280/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg',
          externalIds: { tmdb: '496243', imdb: 'tt6751668' },
        },
        {
          id: 'tmdb:372058',
          source: 'tmdb',
          type: 'movie',
          title: 'Your Name',
          year: 2016,
          overview: 'High schoolers Mitsuha and Taki are complete strangers living separate lives. But one day, they suddenly switch places. Mitsuha wakes up in Taki\'s body, and he in hers. This bizarre occurrence continues to happen randomly, and the two must adjust their lives around each other.',
          rating: 8.2,
          posterUrl: 'https://image.tmdb.org/t/p/w500/q719jXXEzOoYaps6babgKnONONX.jpg',
          backdropUrl: 'https://image.tmdb.org/t/p/w1280/7c9UVPPiTPltouxRVY6N9uugaVA.jpg',
          externalIds: { tmdb: '372058', imdb: 'tt5311514' },
        },
      ];
    } else {
      // Return the first 25 series from getDemoSeries for Korean content
      return this.getDemoSeries().slice(0, 25);
    }
  }

  private getIndianContent(type: 'movie' | 'series'): Title[] {
    if (type === 'movie') {
      return [
        {
          id: 'tmdb:19404',
          source: 'tmdb',
          type: 'movie',
          title: 'Dilwale Dulhania Le Jayenge',
          year: 1995,
          overview: 'Raj is a rich, carefree, happy-go-lucky second generation NRI. Simran is the daughter of Chaudhary Baldev Singh, who in spite of being an NRI is very strict about adherence to Indian values. Simran has left for India to be married to her childhood fiancé. Raj leaves for India with a mission at his hands, to claim his lady love under the noses of her entire family.',
          rating: 8.7,
          posterUrl: 'https://image.tmdb.org/t/p/w500/2CAL2433ZeIihfX1Hb2139CX0pW.jpg',
          backdropUrl: 'https://image.tmdb.org/t/p/w1280/7c9UVPPiTPltouxRVY6N9uugaVA.jpg',
          externalIds: { tmdb: '19404', imdb: 'tt0112870' },
        },
        {
          id: 'tmdb:194662',
          source: 'tmdb',
          type: 'movie',
          title: '3 Idiots',
          year: 2009,
          overview: 'In the tradition of "Ferris Bueller\'s Day Off" comes this refreshing comedy about a rebellious prankster with a crafty mind and a heart of gold. Rascal. Joker. Dreamer. Genius... You\'ve never met a college student quite like "Rancho." From the moment he arrives at India\'s most prestigious university, his outlandish schemes turn the campus upside down—along with the lives of his two newfound best friends.',
          rating: 8.4,
          posterUrl: 'https://image.tmdb.org/t/p/w500/66A9MqXyN2Y4c6N2lY3i9XXLz2Q.jpg',
          backdropUrl: 'https://image.tmdb.org/t/p/w1280/7c9UVPPiTPltouxRVY6N9uugaVA.jpg',
          externalIds: { tmdb: '194662', imdb: 'tt1187043' },
        },
      ];
    } else {
      // Return the first 25 series from getDemoSeries for Indian content
      return this.getDemoSeries().slice(0, 25);
    }
  }

  private getSpanishContent(type: 'movie' | 'series'): Title[] {
    if (type === 'movie') {
      return [
        {
          id: 'tmdb:475557',
          source: 'tmdb',
          type: 'movie',
          title: 'Joker',
          year: 2019,
          overview: 'During the 1980s, a failed stand-up comedian is driven insane and turns to a life of crime and chaos in Gotham City while becoming an infamous psychopathic crime figure.',
          rating: 8.2,
          posterUrl: 'https://image.tmdb.org/t/p/w500/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg',
          backdropUrl: 'https://image.tmdb.org/t/p/w1280/n6bUvigpRFqSwmPp1m2YAD6RBol.jpg',
          externalIds: { tmdb: '475557', imdb: 'tt7286456' },
        },
      ];
    } else {
      // Return the first 25 series from getDemoSeries for Spanish content
      return this.getDemoSeries().slice(0, 25);
    }
  }

  private getJapaneseContent(type: 'movie' | 'series'): Title[] {
    if (type === 'movie') {
      return [
        {
          id: 'tmdb:372058',
          source: 'tmdb',
          type: 'movie',
          title: 'Your Name',
          year: 2016,
          overview: 'High schoolers Mitsuha and Taki are complete strangers living separate lives. But one day, they suddenly switch places. Mitsuha wakes up in Taki\'s body, and he in hers. This bizarre occurrence continues to happen randomly, and the two must adjust their lives around each other.',
          rating: 8.2,
          posterUrl: 'https://image.tmdb.org/t/p/w500/q719jXXEzOoYaps6babgKnONONX.jpg',
          backdropUrl: 'https://image.tmdb.org/t/p/w1280/7c9UVPPiTPltouxRVY6N9uugaVA.jpg',
          externalIds: { tmdb: '372058', imdb: 'tt5311514' },
        },
      ];
    } else {
      return [
        {
          id: 'tmdb:82856',
          source: 'tmdb',
          type: 'series',
          title: 'Attack on Titan',
          year: 2013,
          overview: 'Several hundred years ago, humans were nearly exterminated by giants. Giants are typically several stories tall, seem to have no intelligence, devour human beings and, worst of all, seem to do it for the pleasure rather than as a food source. A small percentage of humanity survived by walling themselves in a city protected by extremely high walls, even taller than the biggest of giants.',
          rating: 9.0,
          posterUrl: 'https://image.tmdb.org/t/p/w500/7l3war94b4Zkk8R8kK9j7yqUrSh.jpg',
          backdropUrl: 'https://image.tmdb.org/t/p/w1280/oaGvjB0DvdhXhOAuADfHb261JHa.jpg',
          externalIds: { tmdb: '82856', imdb: 'tt2560140' },
          seasons: [1, 2, 3, 4],
        },
      ];
    }
  }

  private getAnimeContent(): Title[] {
    return [
      {
        id: 'tmdb:82856',
        source: 'tmdb',
        type: 'series',
        title: 'Attack on Titan',
        year: 2013,
        overview: 'Several hundred years ago, humans were nearly exterminated by giants. Giants are typically several stories tall, seem to have no intelligence, devour human beings and, worst of all, seem to do it for the pleasure rather than as a food source. A small percentage of humanity survived by walling themselves in a city protected by extremely high walls, even taller than the biggest of giants.',
        rating: 9.0,
        posterUrl: 'https://image.tmdb.org/t/p/w500/7l3war94b4Zkk8R8kK9j7yqUrSh.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/oaGvjB0DvdhXhOAuADfHb261JHa.jpg',
        externalIds: { tmdb: '82856', imdb: 'tt2560140' },
        seasons: [1, 2, 3, 4],
      },
      {
        id: 'tmdb:1399',
        source: 'tmdb',
        type: 'series',
        title: 'Demon Slayer',
        year: 2019,
        overview: 'It is the Taisho Period in Japan. Tanjiro, a kindhearted boy who sells charcoal for a living, finds his family slaughtered by a demon. To make matters worse, his younger sister Nezuko, the sole survivor, has been transformed into a demon herself.',
        rating: 8.7,
        posterUrl: 'https://image.tmdb.org/t/p/w500/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg',
        externalIds: { tmdb: '1399', imdb: 'tt9335498' },
        seasons: [1, 2, 3],
      },
      {
        id: 'tmdb:82856',
        source: 'tmdb',
        type: 'series',
        title: 'Attack on Titan',
        year: 2013,
        overview: 'Several hundred years ago, humans were nearly exterminated by giants. Giants are typically several stories tall, seem to have no intelligence, devour human beings and, worst of all, seem to do it for the pleasure rather than as a food source.',
        rating: 9.0,
        posterUrl: 'https://image.tmdb.org/t/p/w500/7l3war94b4Zkk8R8kK9j7yqUrSh.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/oaGvjB0DvdhXhOAuADfHb261JHa.jpg',
        externalIds: { tmdb: '82856', imdb: 'tt2560140' },
        seasons: [1, 2, 3, 4],
      },
      {
        id: 'tmdb:1399',
        source: 'tmdb',
        type: 'series',
        title: 'Stranger Things',
        year: 2016,
        overview: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces, and one strange little girl.',
        rating: 8.7,
        posterUrl: 'https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/56v2KjBlU4XaOv9rVYEQypROD7P.jpg',
        externalIds: { tmdb: '1399', imdb: 'tt4574334' },
        seasons: [1, 2, 3, 4],
      },
      {
        id: 'tmdb:1396',
        source: 'tmdb',
        type: 'series',
        title: 'The Office',
        year: 2005,
        overview: 'The everyday lives of office employees in the Scranton, Pennsylvania branch of the fictional Dunder Mifflin Paper Company.',
        rating: 8.5,
        posterUrl: 'https://image.tmdb.org/t/p/w500/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1396', imdb: 'tt0386676' },
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      },
      {
        id: 'tmdb:1398',
        source: 'tmdb',
        type: 'series',
        title: 'Friends',
        year: 1994,
        overview: 'Follows the personal and professional lives of six twenty to thirty-something-year-old friends living in Manhattan.',
        rating: 8.9,
        posterUrl: 'https://image.tmdb.org/t/p/w500/f496cm9enuEsZkSPzCwnTESEK5s.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1398', imdb: 'tt0108778' },
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      },
      {
        id: 'tmdb:1402',
        source: 'tmdb',
        type: 'series',
        title: 'The Simpsons',
        year: 1989,
        overview: 'Set in Springfield, the average American town, the show focuses on the antics and everyday adventures of the Simpson family; Homer, Marge, Bart, Lisa and Maggie, as well as a virtual cast of thousands.',
        rating: 8.7,
        posterUrl: 'https://image.tmdb.org/t/p/w500/yTZQkSsxUFJZJe67IenRM0AEklc.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1402', imdb: 'tt0096697' },
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
      },
      {
        id: 'tmdb:1399',
        source: 'tmdb',
        type: 'series',
        title: 'The Big Bang Theory',
        year: 2007,
        overview: 'The sitcom is centered on five characters living in Pasadena, California: roommates Leonard Hofstadter and Sheldon Cooper, both physicists; Penny, a waitress and aspiring actress who lives across the hall; and Leonard and Sheldon\'s equally geeky and socially awkward friends and co-workers, mechanical engineer Howard Wolowitz and astrophysicist Raj Koothrappali.',
        rating: 8.1,
        posterUrl: 'https://image.tmdb.org/t/p/w500/ooBGRQBdbGzBxAVfExiO8r7kloA.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1399', imdb: 'tt0898266' },
        seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      },
      {
        id: 'tmdb:1396',
        source: 'tmdb',
        type: 'series',
        title: 'House of Cards',
        year: 2013,
        overview: 'Set in present day Washington, D.C., House of Cards is the story of Frank Underwood, a ruthless and cunning politician, and his wife Claire who will stop at nothing to conquer everything.',
        rating: 8.7,
        posterUrl: 'https://image.tmdb.org/t/p/w500/hKWxWjFwnP5VnC4j1PA3qXg8h8.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1396', imdb: 'tt1856010' },
        seasons: [1, 2, 3, 4, 5, 6],
      },
      {
        id: 'tmdb:1398',
        source: 'tmdb',
        type: 'series',
        title: 'Orange Is the New Black',
        year: 2013,
        overview: 'A crime she committed in her youthful past sends Piper Chapman to a women\'s prison, where she trades her comfortable New York life for one of unexpected camaraderie and conflict in an eccentric group of fellow inmates.',
        rating: 8.1,
        posterUrl: 'https://image.tmdb.org/t/p/w500/ekaa7YjGPTkFLcPhwWXTnARbCE0.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1398', imdb: 'tt2372162' },
        seasons: [1, 2, 3, 4, 5, 6, 7],
      },
      {
        id: 'tmdb:1402',
        source: 'tmdb',
        type: 'series',
        title: 'Narcos',
        year: 2015,
        overview: 'A chronicled look at the criminal exploits of Colombian drug lord Pablo Escobar, as well as the many other drug kingpins who plagued the country through the years.',
        rating: 8.8,
        posterUrl: 'https://image.tmdb.org/t/p/w500/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1402', imdb: 'tt2707408' },
        seasons: [1, 2, 3],
      },
      {
        id: 'tmdb:1399',
        source: 'tmdb',
        type: 'series',
        title: 'The Crown',
        year: 2016,
        overview: 'Follows the political rivalries and romance of Queen Elizabeth II\'s reign and the events that shaped the second half of the 20th century.',
        rating: 8.6,
        posterUrl: 'https://image.tmdb.org/t/p/w500/1M876Kj8VfK5LhL5K0w6zTbT2vL.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1399', imdb: 'tt4786824' },
        seasons: [1, 2, 3, 4, 5, 6],
      },
      {
        id: 'tmdb:1396',
        source: 'tmdb',
        type: 'series',
        title: 'The Mandalorian',
        year: 2019,
        overview: 'The travels of a lone bounty hunter in the outer reaches of the galaxy, far from the authority of the New Republic.',
        rating: 8.7,
        posterUrl: 'https://image.tmdb.org/t/p/w500/eU1i6eHXlzMOlEq0ku1Rzq7Y4wA.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1396', imdb: 'tt8111088' },
        seasons: [1, 2, 3],
      },
      {
        id: 'tmdb:1398',
        source: 'tmdb',
        type: 'series',
        title: 'WandaVision',
        year: 2021,
        overview: 'Wanda Maximoff and Vision—two super-powered beings living idealized suburban lives—begin to suspect that everything is not as it seems.',
        rating: 8.0,
        posterUrl: 'https://image.tmdb.org/t/p/w500/glKDfE6btIRcVB5zrjspRIs4F52.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1398', imdb: 'tt9140560' },
        seasons: [1],
      },
      {
        id: 'tmdb:1402',
        source: 'tmdb',
        type: 'series',
        title: 'The Falcon and the Winter Soldier',
        year: 2021,
        overview: 'Following the events of "Avengers: Endgame", Sam Wilson and Bucky Barnes team up in a global adventure that tests their abilities—and their patience.',
        rating: 7.5,
        posterUrl: 'https://image.tmdb.org/t/p/w500/6kbAMLteGO8yyewYau6bJ683sw7.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1402', imdb: 'tt9208876' },
        seasons: [1],
      },
      {
        id: 'tmdb:1399',
        source: 'tmdb',
        type: 'series',
        title: 'Loki',
        year: 2021,
        overview: 'The mercurial villain Loki resumes his role as the God of Mischief in a new series that takes place after the events of "Avengers: Endgame".',
        rating: 8.2,
        posterUrl: 'https://image.tmdb.org/t/p/w500/kEl2t3OhXc3Zb9FBh1AuYzRTgZp.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1399', imdb: 'tt9140554' },
        seasons: [1, 2],
      },
      {
        id: 'tmdb:1396',
        source: 'tmdb',
        type: 'series',
        title: 'What If...?',
        year: 2021,
        overview: 'Exploring pivotal moments from the Marvel Cinematic Universe and turning them on their head, leading the audience into uncharted territory.',
        rating: 7.4,
        posterUrl: 'https://image.tmdb.org/t/p/w500/lztz5XBMG1x6Y5ibzr5x3T30Vao.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1396', imdb: 'tt10168312' },
        seasons: [1, 2],
      },
      {
        id: 'tmdb:1398',
        source: 'tmdb',
        type: 'series',
        title: 'Hawkeye',
        year: 2021,
        overview: 'Former Avenger Clint Barton has a seemingly simple mission: get back to his family for Christmas. Possible? Maybe with the help of Kate Bishop, a 22-year-old archer with dreams of becoming a superhero.',
        rating: 7.5,
        posterUrl: 'https://image.tmdb.org/t/p/w500/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1398', imdb: 'tt10160804' },
        seasons: [1],
      },
      {
        id: 'tmdb:1402',
        source: 'tmdb',
        type: 'series',
        title: 'Moon Knight',
        year: 2022,
        overview: 'When Steven Grant, a mild-mannered gift-shop employee, becomes plagued with blackouts and memories of another life, he discovers he has dissociative identity disorder and shares a body with mercenary Marc Spector.',
        rating: 7.3,
        posterUrl: 'https://image.tmdb.org/t/p/w500/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1402', imdb: 'tt10234724' },
        seasons: [1],
      },
      {
        id: 'tmdb:1399',
        source: 'tmdb',
        type: 'series',
        title: 'Ms. Marvel',
        year: 2022,
        overview: 'A great student, avid gamer, and voracious fan-fic scribe, Kamala Khan has a special affinity for superheroes, particularly Captain Marvel. However, she struggles to fit in at home and at school—that is, until she gets superpowers like the heroes she\'s always looked up to.',
        rating: 6.2,
        posterUrl: 'https://image.tmdb.org/t/p/w500/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1399', imdb: 'tt10857164' },
        seasons: [1],
      },
      {
        id: 'tmdb:1396',
        source: 'tmdb',
        type: 'series',
        title: 'She-Hulk: Attorney at Law',
        year: 2022,
        overview: 'Jennifer Walters navigates the complicated life of a single, 30-something attorney who also happens to be a green 6-foot-7-inch superpowered hulk.',
        rating: 5.2,
        posterUrl: 'https://image.tmdb.org/t/p/w500/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1396', imdb: 'tt10857160' },
        seasons: [1],
      },
      {
        id: 'tmdb:1398',
        source: 'tmdb',
        type: 'series',
        title: 'Secret Invasion',
        year: 2023,
        overview: 'Nick Fury and Talos discover a faction of shapeshifting Skrulls who have been infiltrating Earth for years.',
        rating: 6.0,
        posterUrl: 'https://image.tmdb.org/t/p/w500/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1398', imdb: 'tt13196080' },
        seasons: [1],
      },
      {
        id: 'tmdb:1402',
        source: 'tmdb',
        type: 'series',
        title: 'Echo',
        year: 2024,
        overview: 'Maya Lopez must face her past, reconnect with her Native American roots and embrace the meaning of family and community if she ever hopes to move forward.',
        rating: 6.1,
        posterUrl: 'https://image.tmdb.org/t/p/w500/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
        externalIds: { tmdb: '1402', imdb: 'tt13966962' },
        seasons: [1],
      },
    ];
  }

  private getDemoEpisodes(tmdbId: string, season: number): Episode[] {
    // Demo episodes for Breaking Bad (TMDB ID: 1396)
    if (tmdbId === '1396') {
      if (season === 1) {
        return [
          {
            id: 'tmdb:1396:1:1',
            season: 1,
            number: 1,
            title: 'Pilot',
            overview: 'A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family\'s future.',
            airDate: '2008-01-20',
            runtime: 58,
            still: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
          },
          {
            id: 'tmdb:1396:1:2',
            season: 1,
            number: 2,
            title: 'Cat\'s in the Bag...',
            overview: 'Walt and Jesse try to dispose of the bodies, but Walt\'s brother-in-law Hank, a DEA agent, is investigating the crime scene.',
            airDate: '2008-01-27',
            runtime: 48,
            still: 'https://image.tmdb.org/t/p/w500/8h7VfVh8nN0ntdWX8vV7n3hJ3xK.jpg',
          },
          {
            id: 'tmdb:1396:1:3',
            season: 1,
            number: 3,
            title: '...And the Bag\'s in the River',
            overview: 'Walt and Jesse try to dispose of the bodies, but Walt\'s brother-in-law Hank, a DEA agent, is investigating the crime scene.',
            airDate: '2008-02-03',
            runtime: 48,
            still: 'https://image.tmdb.org/t/p/w500/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
          },
          {
            id: 'tmdb:1396:1:4',
            season: 1,
            number: 4,
            title: 'Cancer Man',
            overview: 'Walt and Jesse try to dispose of the bodies, but Walt\'s brother-in-law Hank, a DEA agent, is investigating the crime scene.',
            airDate: '2008-02-10',
            runtime: 48,
            still: 'https://image.tmdb.org/t/p/w500/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg',
          },
          {
            id: 'tmdb:1396:1:5',
            season: 1,
            number: 5,
            title: 'Gray Matter',
            overview: 'Walt and Jesse try to dispose of the bodies, but Walt\'s brother-in-law Hank, a DEA agent, is investigating the crime scene.',
            airDate: '2008-02-17',
            runtime: 48,
            still: 'https://image.tmdb.org/t/p/w500/90ez6ArvpO8bvpyIngBuwXOqJm5.jpg',
          },
          {
            id: 'tmdb:1396:1:6',
            season: 1,
            number: 6,
            title: 'Crazy Handful of Nothin\'',
            overview: 'Walt and Jesse try to dispose of the bodies, but Walt\'s brother-in-law Hank, a DEA agent, is investigating the crime scene.',
            airDate: '2008-02-24',
            runtime: 48,
            still: 'https://image.tmdb.org/t/p/w500/4fLZUr1e65h0PP5x0tR9YSlXGsi.jpg',
          },
          {
            id: 'tmdb:1396:1:7',
            season: 1,
            number: 7,
            title: 'A No-Rough-Stuff-Type Deal',
            overview: 'Walt and Jesse try to dispose of the bodies, but Walt\'s brother-in-law Hank, a DEA agent, is investigating the crime scene.',
            airDate: '2008-03-02',
            runtime: 48,
            still: 'https://image.tmdb.org/t/p/w500/8BTsTfln4jlQrLXUBquXJ0ASQy9.jpg',
          },
        ];
      } else if (season === 2) {
        return [
          {
            id: 'tmdb:1396:2:1',
            season: 2,
            number: 1,
            title: 'Seven Thirty-Seven',
            overview: 'Walt and Jesse deal with the aftermath of Tuco\'s death and face new challenges.',
            airDate: '2009-03-08',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/1R6cvRtZgsYCkh8UFuWFN33xBP4.jpg',
          },
          {
            id: 'tmdb:1396:2:2',
            season: 2,
            number: 2,
            title: 'Grilled',
            overview: 'Walt and Jesse are held captive by Tuco\'s uncle Hector.',
            airDate: '2009-03-15',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/2u7zbn8EudG6kLlBzUYqP8RyFU4.jpg',
          },
          {
            id: 'tmdb:1396:2:3',
            season: 2,
            number: 3,
            title: 'Bit by a Dead Bee',
            overview: 'Walt tries to cover up his disappearance while Jesse deals with the aftermath.',
            airDate: '2009-03-22',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/5wDBVictj4wUYZzA5x3Xu0AvBP0.jpg',
          },
          {
            id: 'tmdb:1396:2:4',
            season: 2,
            number: 4,
            title: 'Down',
            overview: 'Walt and Jesse struggle with their partnership while Skyler becomes suspicious.',
            airDate: '2009-03-29',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg',
          },
          {
            id: 'tmdb:1396:2:5',
            season: 2,
            number: 5,
            title: 'Breakage',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2009-04-05',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg',
          },
          {
            id: 'tmdb:1396:2:6',
            season: 2,
            number: 6,
            title: 'Peekaboo',
            overview: 'Jesse deals with a difficult situation while Walt faces family problems.',
            airDate: '2009-04-12',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/5VTN0pR8gcqV3EPUHHfMGnJYN9L.jpg',
          },
          {
            id: 'tmdb:1396:2:7',
            season: 2,
            number: 7,
            title: 'Negro y Azul',
            overview: 'Walt and Jesse expand their operation while Hank investigates.',
            airDate: '2009-04-19',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg',
          },
          {
            id: 'tmdb:1396:2:8',
            season: 2,
            number: 8,
            title: 'Better Call Saul',
            overview: 'Walt and Jesse need legal help and meet Saul Goodman.',
            airDate: '2009-04-26',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg',
          },
          {
            id: 'tmdb:1396:2:9',
            season: 2,
            number: 9,
            title: '4 Days Out',
            overview: 'Walt and Jesse go on a cooking marathon in the desert.',
            airDate: '2009-05-03',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/8BTsTfln4jlQrLXUBquXJ0ASQy9.jpg',
          },
          {
            id: 'tmdb:1396:2:10',
            season: 2,
            number: 10,
            title: 'Over',
            overview: 'Walt celebrates his remission while Jesse faces personal struggles.',
            airDate: '2009-05-10',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/1R6cvRtZgsYCkh8UFuWFN33xBP4.jpg',
          },
          {
            id: 'tmdb:1396:2:11',
            season: 2,
            number: 11,
            title: 'Mandala',
            overview: 'Walt and Jesse face a major decision about their future.',
            airDate: '2009-05-17',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/2u7zbn8EudG6kLlBzUYqP8RyFU4.jpg',
          },
          {
            id: 'tmdb:1396:2:12',
            season: 2,
            number: 12,
            title: 'Phoenix',
            overview: 'Walt faces the consequences of his actions.',
            airDate: '2009-05-24',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/5wDBVictj4wUYZzA5x3Xu0AvBP0.jpg',
          },
          {
            id: 'tmdb:1396:2:13',
            season: 2,
            number: 13,
            title: 'ABQ',
            overview: 'The season finale brings major changes for all characters.',
            airDate: '2009-05-31',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg',
          },
        ];
      } else if (season === 3) {
        return [
          {
            id: 'tmdb:1396:3:1',
            season: 3,
            number: 1,
            title: 'No Más',
            overview: 'Walt returns to teaching while Jesse deals with his guilt.',
            airDate: '2010-03-21',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg',
          },
          {
            id: 'tmdb:1396:3:2',
            season: 3,
            number: 2,
            title: 'Caballo Sin Nombre',
            overview: 'Walt and Jesse begin working with Gus Fring.',
            airDate: '2010-03-28',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/5VTN0pR8gcqV3EPUHHfMGnJYN9L.jpg',
          },
          {
            id: 'tmdb:1396:3:3',
            season: 3,
            number: 3,
            title: 'I.F.T.',
            overview: 'Walt and Jesse face new challenges in their partnership.',
            airDate: '2010-04-04',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg',
          },
          {
            id: 'tmdb:1396:3:4',
            season: 3,
            number: 4,
            title: 'Green Light',
            overview: 'Walt and Jesse make a major decision about their future.',
            airDate: '2010-04-11',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg',
          },
          {
            id: 'tmdb:1396:3:5',
            season: 3,
            number: 5,
            title: 'Más',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2010-04-18',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/8BTsTfln4jlQrLXUBquXJ0ASQy9.jpg',
          },
          {
            id: 'tmdb:1396:3:6',
            season: 3,
            number: 6,
            title: 'Sunset',
            overview: 'Walt and Jesse face a major crisis.',
            airDate: '2010-04-25',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/1R6cvRtZgsYCkh8UFuWFN33xBP4.jpg',
          },
          {
            id: 'tmdb:1396:3:7',
            season: 3,
            number: 7,
            title: 'One Minute',
            overview: 'Hank faces a life-threatening situation.',
            airDate: '2010-05-02',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/2u7zbn8EudG6kLlBzUYqP8RyFU4.jpg',
          },
          {
            id: 'tmdb:1396:3:8',
            season: 3,
            number: 8,
            title: 'I See You',
            overview: 'The aftermath of the previous episode affects everyone.',
            airDate: '2010-05-09',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/5wDBVictj4wUYZzA5x3Xu0AvBP0.jpg',
          },
          {
            id: 'tmdb:1396:3:9',
            season: 3,
            number: 9,
            title: 'Kafkaesque',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2010-05-16',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg',
          },
          {
            id: 'tmdb:1396:3:10',
            season: 3,
            number: 10,
            title: 'Fly',
            overview: 'Walt and Jesse deal with a fly in the lab.',
            airDate: '2010-05-23',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg',
          },
          {
            id: 'tmdb:1396:3:11',
            season: 3,
            number: 11,
            title: 'Abiquiu',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2010-05-30',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/5VTN0pR8gcqV3EPUHHfMGnJYN9L.jpg',
          },
          {
            id: 'tmdb:1396:3:12',
            season: 3,
            number: 12,
            title: 'Half Measures',
            overview: 'Walt and Jesse face a major decision.',
            airDate: '2010-06-06',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg',
          },
          {
            id: 'tmdb:1396:3:13',
            season: 3,
            number: 13,
            title: 'Full Measure',
            overview: 'The season finale brings major changes for all characters.',
            airDate: '2010-06-13',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg',
          },
        ];
      } else if (season === 4) {
        return [
          {
            id: 'tmdb:1396:4:1',
            season: 4,
            number: 1,
            title: 'Box Cutter',
            overview: 'Gus deals with the aftermath of Gale\'s death.',
            airDate: '2011-07-17',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/8h7VfVh8nN0ntdWX8vV7n3hJ3xK.jpg',
          },
          {
            id: 'tmdb:1396:4:2',
            season: 4,
            number: 2,
            title: 'Thirty-Eight Snub',
            overview: 'Walt and Jesse adjust to their new working conditions.',
            airDate: '2011-07-24',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
          },
          {
            id: 'tmdb:1396:4:3',
            season: 4,
            number: 3,
            title: 'Open House',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2011-07-31',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg',
          },
          {
            id: 'tmdb:1396:4:4',
            season: 4,
            number: 4,
            title: 'Bullet Points',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2011-08-07',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/90ez6ArvpO8bvpyIngBuwXOqJm5.jpg',
          },
          {
            id: 'tmdb:1396:4:5',
            season: 4,
            number: 5,
            title: 'Shotgun',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2011-08-14',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/4fLZUr1e65h0PP5x0tR9YSlXGsi.jpg',
          },
          {
            id: 'tmdb:1396:4:6',
            season: 4,
            number: 6,
            title: 'Cornered',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2011-08-21',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/8BTsTfln4jlQrLXUBquXJ0ASQy9.jpg',
          },
          {
            id: 'tmdb:1396:4:7',
            season: 4,
            number: 7,
            title: 'Problem Dog',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2011-08-28',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/1R6cvRtZgsYCkh8UFuWFN33xBP4.jpg',
          },
          {
            id: 'tmdb:1396:4:8',
            season: 4,
            number: 8,
            title: 'Hermanos',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2011-09-04',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/2u7zbn8EudG6kLlBzUYqP8RyFU4.jpg',
          },
          {
            id: 'tmdb:1396:4:9',
            season: 4,
            number: 9,
            title: 'Bug',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2011-09-11',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/5wDBVictj4wUYZzA5x3Xu0AvBP0.jpg',
          },
          {
            id: 'tmdb:1396:4:10',
            season: 4,
            number: 10,
            title: 'Salud',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2011-09-18',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg',
          },
          {
            id: 'tmdb:1396:4:11',
            season: 4,
            number: 11,
            title: 'Crawl Space',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2011-09-25',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg',
          },
          {
            id: 'tmdb:1396:4:12',
            season: 4,
            number: 12,
            title: 'End Times',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2011-10-02',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/5VTN0pR8gcqV3EPUHHfMGnJYN9L.jpg',
          },
          {
            id: 'tmdb:1396:4:13',
            season: 4,
            number: 13,
            title: 'Face Off',
            overview: 'The season finale brings major changes for all characters.',
            airDate: '2011-10-09',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg',
          },
        ];
      } else if (season === 5) {
        return [
          {
            id: 'tmdb:1396:5:1',
            season: 5,
            number: 1,
            title: 'Live Free or Die',
            overview: 'Walt and Jesse deal with the aftermath of Gus\'s death.',
            airDate: '2012-07-15',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/8h7VfVh8nN0ntdWX8vV7n3hJ3xK.jpg',
          },
          {
            id: 'tmdb:1396:5:2',
            season: 5,
            number: 2,
            title: 'Madrigal',
            overview: 'Walt and Jesse expand their operation.',
            airDate: '2012-07-22',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
          },
          {
            id: 'tmdb:1396:5:3',
            season: 5,
            number: 3,
            title: 'Hazard Pay',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2012-07-29',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg',
          },
          {
            id: 'tmdb:1396:5:4',
            season: 5,
            number: 4,
            title: 'Fifty-One',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2012-08-05',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/90ez6ArvpO8bvpyIngBuwXOqJm5.jpg',
          },
          {
            id: 'tmdb:1396:5:5',
            season: 5,
            number: 5,
            title: 'Dead Freight',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2012-08-12',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/4fLZUr1e65h0PP5x0tR9YSlXGsi.jpg',
          },
          {
            id: 'tmdb:1396:5:6',
            season: 5,
            number: 6,
            title: 'Buyout',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2012-08-19',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/8BTsTfln4jlQrLXUBquXJ0ASQy9.jpg',
          },
          {
            id: 'tmdb:1396:5:7',
            season: 5,
            number: 7,
            title: 'Say My Name',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2012-08-26',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/1R6cvRtZgsYCkh8UFuWFN33xBP4.jpg',
          },
          {
            id: 'tmdb:1396:5:8',
            season: 5,
            number: 8,
            title: 'Gliding Over All',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2012-09-02',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/2u7zbn8EudG6kLlBzUYqP8RyFU4.jpg',
          },
          {
            id: 'tmdb:1396:5:9',
            season: 5,
            number: 9,
            title: 'Blood Money',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2013-08-11',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/5wDBVictj4wUYZzA5x3Xu0AvBP0.jpg',
          },
          {
            id: 'tmdb:1396:5:10',
            season: 5,
            number: 10,
            title: 'Buried',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2013-08-18',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg',
          },
          {
            id: 'tmdb:1396:5:11',
            season: 5,
            number: 11,
            title: 'Confessions',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2013-08-25',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg',
          },
          {
            id: 'tmdb:1396:5:12',
            season: 5,
            number: 12,
            title: 'Rabid Dog',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2013-09-01',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/5VTN0pR8gcqV3EPUHHfMGnJYN9L.jpg',
          },
          {
            id: 'tmdb:1396:5:13',
            season: 5,
            number: 13,
            title: 'To\'hajilee',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2013-09-08',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg',
          },
          {
            id: 'tmdb:1396:5:14',
            season: 5,
            number: 14,
            title: 'Ozymandias',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2013-09-15',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg',
          },
          {
            id: 'tmdb:1396:5:15',
            season: 5,
            number: 15,
            title: 'Granite State',
            overview: 'Walt and Jesse face new challenges in their business.',
            airDate: '2013-09-22',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/8h7VfVh8nN0ntdWX8vV7n3hJ3xK.jpg',
          },
          {
            id: 'tmdb:1396:5:16',
            season: 5,
            number: 16,
            title: 'Felina',
            overview: 'The series finale brings closure to all storylines.',
            airDate: '2013-09-29',
            runtime: 47,
            still: 'https://image.tmdb.org/t/p/w500/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg',
          },
        ];
      }
    }
    
    // Return empty array for other series/seasons
    return [];
  }

  private getDemoTitle(typeArg: 'movie' | 'series' | undefined, rawId: string): Title {
    // Extract TMDB ID from the rawId
    const tmdbId = rawId.replace('tmdb:', '');
    
    // Demo titles database
    const demoTitles: Record<string, Title> = {
      '27205': {
        id: 'tmdb:27205',
        source: 'tmdb',
        type: 'movie',
        title: 'Inception',
        year: 2010,
        overview: 'Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets is offered a chance to regain his old life as payment for a task considered to be impossible: "inception", the implantation of another person\'s idea into a target\'s subconscious.',
        genres: ['Action', 'Sci-Fi', 'Thriller'],
        runtime: 148,
        rating: 8.4,
        posterUrl: 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
        externalIds: { tmdb: '27205', imdb: 'tt1375666' },
        releaseDate: '2010-07-16',
        streamingServices: ['HBO Max', 'Netflix'],
        cast: [
          { name: 'Leonardo DiCaprio', character: 'Dom Cobb', profileUrl: 'https://image.tmdb.org/t/p/w500/3rg2vq5V4z7Q1yl5Q7XUJg8Yz8I.jpg' },
          { name: 'Marion Cotillard', character: 'Mal Cobb', profileUrl: 'https://image.tmdb.org/t/p/w500/3rg2vq5V4z7Q1yl5Q7XUJg8Yz8I.jpg' },
          { name: 'Tom Hardy', character: 'Eames', profileUrl: 'https://image.tmdb.org/t/p/w500/3rg2vq5V4z7Q1yl5Q7XUJg8Yz8I.jpg' },
          { name: 'Joseph Gordon-Levitt', character: 'Arthur', profileUrl: 'https://image.tmdb.org/t/p/w500/3rg2vq5V4z7Q1yl5Q7XUJg8Yz8I.jpg' },
          { name: 'Ellen Page', character: 'Ariadne', profileUrl: 'https://image.tmdb.org/t/p/w500/3rg2vq5V4z7Q1yl5Q7XUJg8Yz8I.jpg' },
          { name: 'Michael Caine', character: 'Professor Stephen Miles', profileUrl: 'https://image.tmdb.org/t/p/w500/3rg2vq5V4z7Q1yl5Q7XUJg8Yz8I.jpg' }
        ],
        trailerUrl: 'https://www.youtube.com/watch?v=YoHD9XEInc0',
      },
      '155': {
        id: 'tmdb:155',
        source: 'tmdb',
        type: 'movie',
        title: 'The Dark Knight',
        year: 2008,
        overview: 'Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets. The partnership proves to be effective, but they soon find themselves prey to a reign of chaos unleashed by a rising criminal mastermind known to the terrified citizens of Gotham as the Joker.',
        genres: ['Action', 'Crime', 'Drama'],
        runtime: 152,
        rating: 9.0,
        posterUrl: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/hqkIcbrOHL86UncnHIsHVcVmzue.jpg',
        externalIds: { tmdb: '155', imdb: 'tt0468569' },
        releaseDate: '2008-07-18',
        streamingServices: ['HBO Max', 'Netflix'],
        cast: [
          { name: 'Christian Bale', character: 'Bruce Wayne / Batman', profileUrl: 'https://image.tmdb.org/t/p/w500/3rg2vq5V4z7Q1yl5Q7XUJg8Yz8I.jpg' },
          { name: 'Heath Ledger', character: 'Joker', profileUrl: 'https://image.tmdb.org/t/p/w500/3rg2vq5V4z7Q1yl5Q7XUJg8Yz8I.jpg' },
          { name: 'Aaron Eckhart', character: 'Harvey Dent', profileUrl: 'https://image.tmdb.org/t/p/w500/3rg2vq5V4z7Q1yl5Q7XUJg8Yz8I.jpg' },
          { name: 'Michael Caine', character: 'Alfred Pennyworth', profileUrl: 'https://image.tmdb.org/t/p/w500/3rg2vq5V4z7Q1yl5Q7XUJg8Yz8I.jpg' },
          { name: 'Maggie Gyllenhaal', character: 'Rachel Dawes', profileUrl: 'https://image.tmdb.org/t/p/w500/3rg2vq5V4z7Q1yl5Q7XUJg8Yz8I.jpg' },
          { name: 'Gary Oldman', character: 'Jim Gordon', profileUrl: 'https://image.tmdb.org/t/p/w500/3rg2vq5V4z7Q1yl5Q7XUJg8Yz8I.jpg' }
        ],
        trailerUrl: 'https://www.youtube.com/watch?v=EXeTwQWrcwY',
      },
      '49026': {
        id: 'tmdb:49026',
        source: 'tmdb',
        type: 'movie',
        title: 'The Dark Knight Rises',
        year: 2012,
        overview: 'Following the death of District Attorney Harvey Dent, Batman assumes responsibility for Dent\'s crimes to protect the late attorney\'s reputation and is subsequently hunted by the Gotham City Police Department. Eight years later, Batman encounters the mysterious Selina Kyle and the villainous Bane, a new terrorist leader who overwhelms Gotham\'s finest. The Dark Knight resurfaces to protect a city that has branded him an enemy.',
        genres: ['Action', 'Crime', 'Drama'],
        runtime: 164,
        rating: 8.2,
        posterUrl: 'https://image.tmdb.org/t/p/w500/vdAQxOnsxhgc6e1nxdV1nQiVYAX.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/85zHakxSGU6hP3TpUj8x3QdW2bZ.jpg',
        externalIds: { tmdb: '49026', imdb: 'tt1345836' },
      },
      '1399': {
        id: 'tmdb:1399',
        source: 'tmdb',
        type: 'series',
        title: 'Game of Thrones',
        year: 2011,
        overview: 'Seven noble families fight for control of the mythical land of Westeros. Friction between the houses leads to full-scale war. All while a very ancient evil awakens in the farthest north. Amidst the war, a neglected military order of misfits, the Night\'s Watch, is all that stands between the realms of men and icy horrors beyond.',
        genres: ['Action', 'Adventure', 'Drama'],
        runtime: 60,
        rating: 8.5,
        posterUrl: 'https://image.tmdb.org/t/p/w500/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg',
        externalIds: { tmdb: '1399', imdb: 'tt0944947' },
        seasons: [1, 2, 3, 4, 5, 6, 7, 8],
      },
      '1396': {
        id: 'tmdb:1396',
        source: 'tmdb',
        type: 'series',
        title: 'Breaking Bad',
        year: 2008,
        overview: 'A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family\'s future.',
        genres: ['Crime', 'Drama', 'Thriller'],
        runtime: 49,
        rating: 9.5,
        posterUrl: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
        externalIds: { tmdb: '1396', imdb: 'tt0903747' },
        seasons: [1, 2, 3, 4, 5],
        releaseDate: '2008-01-20',
        streamingServices: ['Netflix', 'AMC+'],
        cast: [
          { name: 'Bryan Cranston', character: 'Walter White', profileUrl: 'https://image.tmdb.org/t/p/w500/3rg2vq5V4z7Q1yl5Q7XUJg8Yz8I.jpg' },
          { name: 'Aaron Paul', character: 'Jesse Pinkman', profileUrl: 'https://image.tmdb.org/t/p/w500/8h7VfVh8nN0ntdWX8vV7n3hJ3xK.jpg' },
          { name: 'Anna Gunn', character: 'Skyler White', profileUrl: 'https://image.tmdb.org/t/p/w500/7DJKHzAi73O4B6rv2kajBSY4VlT.jpg' },
          { name: 'Dean Norris', character: 'Hank Schrader', profileUrl: 'https://image.tmdb.org/t/p/w500/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg' },
          { name: 'Betsy Brandt', character: 'Marie Schrader', profileUrl: 'https://image.tmdb.org/t/p/w500/90ez6ArvpO8bvpyIngBuwXOqJm5.jpg' },
          { name: 'RJ Mitte', character: 'Walter White Jr.', profileUrl: 'https://image.tmdb.org/t/p/w500/4fLZUr1e65h0PP5x0tR9YSlXGsi.jpg' },
          { name: 'Bob Odenkirk', character: 'Saul Goodman', profileUrl: 'https://image.tmdb.org/t/p/w500/8BTsTfln4jlQrLXUBquXJ0ASQy9.jpg' },
          { name: 'Giancarlo Esposito', character: 'Gustavo Fring', profileUrl: 'https://image.tmdb.org/t/p/w500/1R6cvRtZgsYCkh8UFuWFN33xBP4.jpg' },
          { name: 'Jonathan Banks', character: 'Mike Ehrmantraut', profileUrl: 'https://image.tmdb.org/t/p/w500/2u7zbn8EudG6kLlBzUYqP8RyFU4.jpg' },
          { name: 'Laura Fraser', character: 'Lydia Rodarte-Quayle', profileUrl: 'https://image.tmdb.org/t/p/w500/5wDBVictj4wUYZzA5x3Xu0AvBP0.jpg' },
          { name: 'Jesse Plemons', character: 'Todd Alquist', profileUrl: 'https://image.tmdb.org/t/p/w500/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg' },
          { name: 'Charles Baker', character: 'Skinny Pete', profileUrl: 'https://image.tmdb.org/t/p/w500/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg' },
          { name: 'Matt Jones', character: 'Badger', profileUrl: 'https://image.tmdb.org/t/p/w500/5VTN0pR8gcqV3EPUHHfMGnJYN9L.jpg' },
          { name: 'Steven Michael Quezada', character: 'Steven Gomez', profileUrl: 'https://image.tmdb.org/t/p/w500/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg' },
          { name: 'Mark Margolis', character: 'Hector Salamanca', profileUrl: 'https://image.tmdb.org/t/p/w500/2l05cFVJue4Ph0hIKsloSeXJgfF.jpg' }
        ],
        trailerUrl: 'https://www.youtube.com/watch?v=HhesaQXLuRY',
      },
    };

    const title = demoTitles[tmdbId];
    if (!title) {
      throw new Error(`Demo title not found for ID: ${rawId}`);
    }

    return title;
  }

  async getTitle(typeArg: 'movie' | 'series' | undefined, rawId: string): Promise<Title> {
    // Demo mode - return hardcoded results for testing
    if (!TMDB_API_KEY || TMDB_API_KEY === 'demo_key') {
      console.log('[TMDB] Using demo mode for getTitle:', rawId);
      return this.getDemoTitle(typeArg, rawId);
    }

    // Extract TMDB ID from various formats
    let tmdbId: string;
    if (rawId.startsWith('tmdb:')) {
      tmdbId = rawId.replace('tmdb:', '');
    } else if (rawId.startsWith('tt')) {
      // IMDb ID - we'll need to resolve it to TMDB ID
      throw new Error('IMDb ID resolution not implemented yet');
    } else {
      tmdbId = rawId;
    }

    // Try both movie and TV if type is not specified
    const types: ('movie' | 'series')[] = typeArg ? [typeArg] : ['movie', 'series'];

    for (const type of types) {
      try {
        const endpoint = type === 'movie' ? 'movie' : 'tv';
        const url = `${BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=${this.language}&append_to_response=external_ids,videos,credits,watch/providers,release_dates,content_ratings`;

        const data = await cachedFetch(url, META_TTL);

        if (type === 'movie') {
          const movieData = data as any;
          const title = mapMovieDetailsToTitle(movieData);
          
          // Add trailer URL
          if (movieData.videos?.results) {
            const trailer = movieData.videos.results.find((v: any) => 
              v.type === 'Trailer' && v.site === 'YouTube'
            );
            if (trailer) {
              title.trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
            }
          }
          
          // Add cast
          if (movieData.credits?.cast) {
            title.cast = movieData.credits.cast.slice(0, 15).map((c: any) => ({
              name: c.name,
              character: c.character,
              profileUrl: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : undefined,
            }));
          }
          
          // Add streaming services
          if (movieData['watch/providers']?.results?.US?.flatrate) {
            title.streamingServices = movieData['watch/providers'].results.US.flatrate.map((p: any) => p.provider_name);
          }
          
          // Add release date
          if (movieData.release_date) {
            title.releaseDate = movieData.release_date;
          }
          
          return title;
        } else {
          const tvData = data as any;
          const title = mapTVDetailsToTitle(tvData);
          
          // Get seasons info
          if (tvData.seasons) {
            title.seasons = tvData.seasons
              .map((s: any) => s.season_number)
              .filter((n: number) => n > 0)
              .sort((a: number, b: number) => a - b);
          }
          
          // Add trailer URL
          if (tvData.videos?.results) {
            const trailer = tvData.videos.results.find((v: any) => 
              v.type === 'Trailer' && v.site === 'YouTube'
            );
            if (trailer) {
              title.trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
            }
          }
          
          // Add cast
          if (tvData.credits?.cast) {
            title.cast = tvData.credits.cast.slice(0, 15).map((c: any) => ({
              name: c.name,
              character: c.character,
              profileUrl: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : undefined,
            }));
          }
          
          // Add streaming services
          if (tvData['watch/providers']?.results?.US?.flatrate) {
            title.streamingServices = tvData['watch/providers'].results.US.flatrate.map((p: any) => p.provider_name);
          }
          
          // Add first air date as release date
          if (tvData.first_air_date) {
            title.releaseDate = tvData.first_air_date;
          }
          
          return title;
        }
      } catch (error: any) {
        if (error.status === 404 && types.length > 1) {
          continue; // Try the other type
        }
        throw error;
      }
    }

    throw new Error('No metadata found');
  }

  async resolveTitleToId(query: { type: 'movie' | 'series'; title: string; year?: number }): Promise<{ id: string; type: 'movie' | 'series' }> {
    const results = await this.search(query.type, query.title);
    
    if (results.length === 0) {
      throw new Error('No match found');
    }

    // If year is specified, try to find exact match
    if (query.year) {
      const exactMatch = results.find(r => r.year === query.year);
      if (exactMatch) {
        return { id: exactMatch.id, type: exactMatch.type };
      }
    }

    // Return the first result
    const first = results[0];
    return { id: first.id, type: first.type };
  }

  async getSeasonEpisodes(seriesId: string, season: number): Promise<Episode[]> {
    // Extract TMDB ID
    const tmdbId = seriesId.replace('tmdb:', '');
    
    // Demo mode - return hardcoded episodes for Breaking Bad
    if (!TMDB_API_KEY || TMDB_API_KEY === 'demo_key') {
      console.log('[TMDB] Using demo mode for getSeasonEpisodes:', seriesId, 'season:', season);
      return this.getDemoEpisodes(tmdbId, season);
    }

    const url = `${BASE_URL}/tv/${tmdbId}/season/${season}?api_key=${TMDB_API_KEY}&language=${this.language}`;

    try {
      const data: TMDBSeasonDetails = await cachedFetch(url, META_TTL);
      return data.episodes.map(ep => mapEpisodeToEpisode(ep, parseInt(tmdbId)));
    } catch (error) {
      console.error('[TMDB] getSeasonEpisodes error:', error);
      return [];
    }
  }
}

export const tmdbProvider = new TMDBProvider();
