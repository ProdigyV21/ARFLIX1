import { useEffect, useState, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import HeroRotator from '../components/hero/HeroRotator';
import ScrollCarousel from '../components/common/ScrollCarousel';
import MediaCard16x9 from '../components/media/MediaCard16x9';
import { useFocusManager, useFocusable } from '../lib/focus';
import { catalogAPI, type CatalogItem, type HomeRow } from '../lib/catalog';
import { addonAPI } from '../lib/api';
import { getContinueWatching, saveProgress, type WatchProgress } from '../lib/progress';
import type { HeroItem } from '../lib/tmdb';
import type { Page } from '../types/navigation';
import type { Title } from '../lib/meta/types';

interface HomePageProps {
  onNavigate: (page: Page, data?: any) => void;
}

async function getComprehensiveContent(): Promise<HomeRow[]> {
  const { metadataProvider } = await import('../lib/meta');
  
  try {
    console.log('[HomePage] Loading comprehensive content...');
    
    // Load all collections in parallel
    const [
      trendingMovies,
      trendingTV,
      mostWatchedMovies,
      mostWatchedTV,
      anime,
      _netflixMovies,
      netflixTV,
      _disneyMovies,
      disneyTV,
      _hboMovies,
      hboTV,
      _amazonMovies,
      amazonTV,
      _huluMovies,
      huluTV,
      koreanMovies,
      koreanTV,
      indianMovies,
      indianTV,
      spanishMovies,
      spanishTV,
      japaneseMovies,
      japaneseTV,
    ] = await Promise.all([
        metadataProvider.getCatalog('movie', 'trending_movies', { limit: 25 }),
        metadataProvider.getCatalog('series', 'trending_tv', { limit: 25 }),
        metadataProvider.getCatalog('movie', 'most_watched', { limit: 25 }),
        metadataProvider.getCatalog('series', 'most_watched', { limit: 25 }),
        metadataProvider.getCatalog('series', 'anime', { limit: 25 }),
        metadataProvider.getCatalog('movie', 'netflix', { limit: 25 }),
        metadataProvider.getCatalog('series', 'netflix', { limit: 25 }),
        metadataProvider.getCatalog('movie', 'disney', { limit: 25 }),
        metadataProvider.getCatalog('series', 'disney', { limit: 25 }),
        metadataProvider.getCatalog('movie', 'hbo', { limit: 25 }),
        metadataProvider.getCatalog('series', 'hbo', { limit: 25 }),
        metadataProvider.getCatalog('movie', 'amazon', { limit: 25 }),
        metadataProvider.getCatalog('series', 'amazon', { limit: 25 }),
        metadataProvider.getCatalog('movie', 'hulu', { limit: 25 }),
        metadataProvider.getCatalog('series', 'hulu', { limit: 25 }),
        metadataProvider.getCatalog('movie', 'korean', { limit: 25 }),
        metadataProvider.getCatalog('series', 'korean', { limit: 25 }),
        metadataProvider.getCatalog('movie', 'indian', { limit: 25 }),
        metadataProvider.getCatalog('series', 'indian', { limit: 25 }),
        metadataProvider.getCatalog('movie', 'spanish', { limit: 25 }),
        metadataProvider.getCatalog('series', 'spanish', { limit: 25 }),
        metadataProvider.getCatalog('movie', 'japanese', { limit: 25 }),
        metadataProvider.getCatalog('series', 'japanese', { limit: 25 }),
    ]);
    
    console.log('[HomePage] Loaded collections:', {
      trendingMovies: trendingMovies.length,
      trendingTV: trendingTV.length,
      mostWatchedMovies: mostWatchedMovies.length,
      mostWatchedTV: mostWatchedTV.length,
      anime: anime.length,
      netflixTV: netflixTV.length,
    });

    const rows: HomeRow[] = [];

    // Add collections only if they have content
    if (trendingMovies.length > 0) {
      rows.push({
        id: 'trending-movies',
        title: 'Trending Movies',
        items: trendingMovies.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    if (trendingTV.length > 0) {
      rows.push({
        id: 'trending-tv',
        title: 'Trending TV Shows',
        items: trendingTV.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    if (mostWatchedTV.length > 0) {
      rows.push({
        id: 'most-watched-tv',
        title: 'Most Watched This Week',
        items: mostWatchedTV.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    if (anime.length > 0) {
      rows.push({
        id: 'trending-anime',
        title: 'Trending Airing Anime',
        items: anime.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    // Streaming Services
    if (netflixTV.length > 0) {
      rows.push({
        id: 'netflix-trending',
        title: 'Netflix Trending Series',
        items: netflixTV.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    if (disneyTV.length > 0) {
      rows.push({
        id: 'disney-trending',
        title: 'Disney+ Trending Series',
        items: disneyTV.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    if (hboTV.length > 0) {
      rows.push({
        id: 'hbo-trending',
        title: 'HBO Max Trending Series',
        items: hboTV.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    if (amazonTV.length > 0) {
      rows.push({
        id: 'amazon-trending',
        title: 'Prime Video Trending Series',
        items: amazonTV.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    if (huluTV.length > 0) {
      rows.push({
        id: 'hulu-trending',
        title: 'Hulu Trending Series',
        items: huluTV.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    // International Content
    if (koreanTV.length > 0) {
      rows.push({
        id: 'korean-tv',
        title: 'Top Korean Series',
        items: koreanTV.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    if (indianTV.length > 0) {
      rows.push({
        id: 'indian-tv',
        title: 'Top Indian Series',
        items: indianTV.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    if (spanishTV.length > 0) {
      rows.push({
        id: 'spanish-tv',
        title: 'Top Spanish Series',
        items: spanishTV.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    if (japaneseTV.length > 0) {
      rows.push({
        id: 'japanese-tv',
        title: 'Top Japanese Series',
        items: japaneseTV.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    // Top Movies from different countries
    if (koreanMovies.length > 0) {
      rows.push({
        id: 'korean-movies',
        title: 'Top Korean Movies',
        items: koreanMovies.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    if (indianMovies.length > 0) {
      rows.push({
        id: 'indian-movies',
        title: 'Top Indian Movies',
        items: indianMovies.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    if (spanishMovies.length > 0) {
      rows.push({
        id: 'spanish-movies',
        title: 'Top Spanish Movies',
        items: spanishMovies.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    if (japaneseMovies.length > 0) {
      rows.push({
        id: 'japanese-movies',
        title: 'Top Japanese Movies',
        items: japaneseMovies.map((title): CatalogItem => ({
          id: title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id,
          type: title.type,
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
        }))
      });
    }

    console.log('[HomePage] Returning comprehensive content rows:', rows.length);
    return rows;
  } catch (error) {
    console.error('Failed to load comprehensive content:', error);
    return getFallbackContent();
  }
}

function getFallbackContent(): HomeRow[] {
  return [
    {
      id: 'trending-movies',
      title: 'Trending Movies',
      items: [
        {
          id: 'tmdb:27205',
          type: 'movie',
          title: 'Inception',
          year: 2010,
          poster: 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
          backdrop: 'https://image.tmdb.org/t/p/w1280/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
          rating: 8.4,
          source: 'tmdb',
          sourceRef: { tmdbId: 27205 },
        },
        {
          id: 'tmdb:155',
          type: 'movie',
          title: 'The Dark Knight',
          year: 2008,
          poster: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
          backdrop: 'https://image.tmdb.org/t/p/w1280/hqkIcbrOHL86UncnHIsHVcVmzue.jpg',
          rating: 9.0,
          source: 'tmdb',
          sourceRef: { tmdbId: 155 },
        },
        {
          id: 'tmdb:49026',
          type: 'movie',
          title: 'The Dark Knight Rises',
          year: 2012,
          poster: 'https://image.tmdb.org/t/p/w500/vdAQxOnsxhgc6e1nxdV1nQiVYAX.jpg',
          backdrop: 'https://image.tmdb.org/t/p/w1280/85zHakxSGU6hP3TpUj8x3QdW2bZ.jpg',
          rating: 8.2,
          source: 'tmdb',
          sourceRef: { tmdbId: 49026 },
        }
      ]
    },
    {
      id: 'trending-tv',
      title: 'Trending TV Shows',
      items: [
        {
          id: 'tmdb:1399',
          type: 'series',
          title: 'Game of Thrones',
          year: 2011,
          poster: 'https://image.tmdb.org/t/p/w500/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg',
          backdrop: 'https://image.tmdb.org/t/p/w1280/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg',
          rating: 8.5,
          source: 'tmdb',
          sourceRef: { tmdbId: 1399 },
        },
        {
          id: 'tmdb:1396',
          type: 'series',
          title: 'Breaking Bad',
          year: 2008,
          poster: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
          backdrop: 'https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
          rating: 9.5,
          source: 'tmdb',
          sourceRef: { tmdbId: 1396 },
        },
        {
          id: 'tmdb:1398',
          type: 'series',
          title: 'The Sopranos',
          year: 1999,
          poster: 'https://image.tmdb.org/t/p/w500/rTc7ZXdroqjkKivFPvCPX0Ru7uw.jpg',
          backdrop: 'https://image.tmdb.org/t/p/w1280/7c9UVPPiTPltouxRVY6N9uugaVA.jpg',
          rating: 9.2,
          source: 'tmdb',
          sourceRef: { tmdbId: 1398 },
        }
      ]
    }
  ];
}

export function HomePage({ onNavigate }: HomePageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const watchRef = useRef<HTMLButtonElement>(null);
  const infoRef = useRef<HTMLButtonElement>(null);
  const addonsButtonRef = useRef<HTMLButtonElement>(null);

  const [rows, setRows] = useState<HomeRow[]>([]);
  const [continueWatching, setContinueWatching] = useState<WatchProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAddons, setHasAddons] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [watchedIds, setWatchedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('watched');
      return new Set(raw ? JSON.parse(raw) as string[] : []);
    } catch {
      return new Set();
    }
  });

  useFocusable(watchRef);
  useFocusable(infoRef);
  useFocusable(addonsButtonRef);

  useFocusManager(containerRef, {
    onBack: () => {},
    autofocus: true,
  });

  // Load watchlist from localStorage (supports legacy format)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('watchlist');
      if (stored) {
        const arr = JSON.parse(stored) as any[];
        const keys: string[] = Array.isArray(arr)
          ? arr.map((v) => typeof v === 'string' ? v : (v?.key || ''))
              .filter(Boolean)
          : [];
        setWatchlistIds(new Set(keys));
      }
    } catch (error) {
      console.error('Failed to load watchlist:', error);
    }
  }, []);

  useEffect(() => {
    loadContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedItem) {
      const item = rows.flatMap(r => r.items).find(i => i.id === selectedItem) ||
                   continueWatching.find(i => i.id === selectedItem);
      if (item) {
        requestAnimationFrame(() => {
          onNavigate('details', {
            id: selectedItem,
            type: item.type || 'movie'
          });
        });
        setSelectedItem(null);
      }
    }
  }, [selectedItem, rows, continueWatching, onNavigate]);

  async function loadContent() {
    try {
      setLoading(true);

      const [catalogData, addonsData, enrichedWatching, comprehensiveContent] = await Promise.all([
        catalogAPI.getHome().catch(() => ({ rows: [] })),
        addonAPI.list().catch(() => ({ addons: [] })),
        enrichContinueWatchingImages(getContinueWatching(20)),
        getComprehensiveContent(),
      ]);

      // Use comprehensive content if available, otherwise fall back to catalog data or demo content
      console.log('[HomePage] Content loading results:', {
        comprehensiveContentLength: comprehensiveContent.length,
        catalogDataRowsLength: catalogData.rows?.length || 0,
        comprehensiveContent: comprehensiveContent,
        catalogData: catalogData
      });
      
      if (comprehensiveContent.length > 0) {
        console.log('[HomePage] Using comprehensive content');
        setRows(comprehensiveContent);
      } else if (catalogData.rows && catalogData.rows.length > 0) {
        console.log('[HomePage] Using catalog data');
        setRows(catalogData.rows);
      } else {
        console.log('[HomePage] Using fallback content');
        setRows(getFallbackContent());
      }
      
      setHasAddons(addonsData.addons?.filter((a: any) => a.enabled).length > 0);
      setContinueWatching(enrichedWatching);
    } catch (error) {
      console.error('Failed to load content:', error);
      // Show fallback content if everything fails
      setRows(getFallbackContent());
      setHasAddons(false);
      setContinueWatching([]);
    } finally {
      setLoading(false);
    }
  }

  async function enrichContinueWatchingImages(watching: WatchProgress[]): Promise<WatchProgress[]> {
    const BASE_URL = 'https://v3-cinemeta.strem.io';
    const concurrency = 5;
    const results: WatchProgress[] = [];
    for (let i = 0; i < watching.length; i += concurrency) {
      const batch = watching.slice(i, i + concurrency);
      const enrichedBatch = await Promise.all(
        batch.map(async (item) => {
          try {
            // Skip items that already have artwork
            if (item.poster && item.backdrop) {
              return item;
            }

            const type: 'movie' | 'series' = item.type === 'anime' ? 'series' : item.type;
            const isImdbId = item.id.startsWith('tt') && /^tt\d+$/.test(item.id);

            if (isImdbId) {
              const metaUrl = `${BASE_URL}/meta/${type}/${encodeURIComponent(item.id)}.json`;
              const metaRes = await fetch(metaUrl);

              if (!metaRes.ok) {
                console.error(`[CW] Failed to fetch meta for ${item.id}`);
                return item;
              }

              const metaData = await metaRes.json();
              const meta = metaData.meta;

              const enrichedItem: WatchProgress = {
                ...item,
                title: meta.name || item.title,
                backdrop: meta.background || item.backdrop,
                poster: meta.poster || item.poster,
              };

              // Persist enriched progress; ignore returned promise
              void saveProgress(enrichedItem);
              return enrichedItem;
            }

            // Unsupported ID format; return original
            return item;
          } catch (error) {
            console.error(`[CW] Failed to enrich "${item.title}":`, error);
            return item;
          }
        }),
      );
      results.push(...enrichedBatch);
    }
    return results;
  }

  function handleItemClick(item: CatalogItem) {
    setSelectedItem(item.id);
  }

  function handleWatchlistToggle(item: Title | CatalogItem, isInWatchlist: boolean) {
    // Optimistic UI update
    setWatchlistIds(prev => {
      const next = new Set(prev);
      const baseId = 'id' in item ? (item.id as string) : (item.externalIds?.tmdb ? `tmdb:${item.externalIds.tmdb}` : '');
      const type = ('type' in item ? (item as any).type : undefined) || 'movie';
      const key = `${type}:${baseId}`;
      
      if (isInWatchlist) {
        next.delete(key);
      } else {
        next.add(key);
      }
      
      // Persist to localStorage
      try {
        // Store as array of objects for future-proofing
        const payload = Array.from(next).map(k => ({ key: k }));
        localStorage.setItem('watchlist', JSON.stringify(payload));
      } catch (error) {
        console.error('Failed to save watchlist:', error);
      }
      
      return next;
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl text-muted-foreground">Loading content...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen">
      <HeroRotator
        onPlayClick={(item: Title) => {
          if (!hasAddons) {
            onNavigate('settings');
            return;
          }
          const itemId = item.externalIds?.tmdb ? `tmdb:${item.externalIds.tmdb}` : item.id;
          setSelectedItem(itemId);
        }}
        onInfoClick={(item: Title) => {
          const itemId = item.externalIds?.tmdb ? `tmdb:${item.externalIds.tmdb}` : item.id;
          setSelectedItem(itemId);
        }}
        onWatchlistClick={handleWatchlistToggle}
        watchlistIds={watchlistIds}
      />

      {!hasAddons && (
        <div className="mx-auto max-w-[1600px] px-6 lg:px-10 mt-8 mb-8 p-5 bg-gradient-to-r from-[color:var(--accent)]/20 to-[color:var(--accent-2)]/20 border border-[color:var(--accent)]/30 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold mb-1">Ready to watch?</p>
            <p className="text-sm text-[color:var(--muted)]">
              Connect a Stremio add-on to start streaming
            </p>
          </div>
          <button
            ref={addonsButtonRef}
            data-focusable="true"
            onClick={() => onNavigate('settings')}
            className="flex items-center gap-2 px-6 py-3 bg-[color:var(--accent)] text-black rounded-full font-semibold hover:opacity-90 focus-ring transition-all"
          >
            <ExternalLink className="w-5 h-5" />
            Add Sources
          </button>
        </div>
      )}

      {continueWatching.length > 0 && (
        <section className="px-8 mb-6">
          <h2 className="text-3xl font-bold mb-6">Continue Watching</h2>
          <ScrollCarousel id="continue-watching" className="pb-4">
            {continueWatching.map((item, index) => {
              const epLabel = item.seasonNumber && item.episodeNumber ? `S${String(item.seasonNumber).padStart(2,'0')}-E${String(item.episodeNumber).padStart(2,'0')}` : undefined;
              const pct = item.duration > 0 ? Math.min(100, Math.max(0, (item.position || 0) / item.duration * 100)) : 0;
              return (
                <div key={`${item.id}-${item.title}-${index}`} className="flex-shrink-0 w-[360px]">
                  <MediaCard16x9
                    item={{
                      id: item.id,
                      title: epLabel ? `${epLabel} • ${item.title}` : item.title,
                      image16x9: item.backdrop || item.poster || '',
                      year: undefined
                    }}
                    watched={watchedIds.has(`${item.type}:${item.id}`)}
                    onClick={() => {
                      onNavigate('details', {
                        id: item.id,
                        type: item.type
                      });
                    }}
                  />
                  {item.duration > 0 && (
                    <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-white/80" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </ScrollCarousel>
        </section>
      )}


      {rows.map((row, rowIndex) => {
        if (row.items.length === 0) return null;

        return (
          <section key={rowIndex} className="px-8 mb-6">
            <h2 className="text-3xl font-bold mb-6">{row.title}</h2>
            <ScrollCarousel id={row.id} className="pb-4">
              {row.items.map((item) => (
                <div key={item.id} className="flex-shrink-0 w-[360px]">
                  <MediaCard16x9
                    item={{
                      id: item.id,
                      title: item.title,
                      image16x9: item.backdrop || item.poster || '',
                      year: item.year?.toString()
                    }}
                    watched={watchedIds.has(`${item.type}:${item.id}`)}
                    onClick={() => {
                        handleItemClick(item);
                    }}
                  />
                </div>
              ))}
            </ScrollCarousel>
          </section>
        );
      })}

      {rows.length === 0 && (
        <div className="text-center py-20 px-8">
          <p className="text-2xl text-muted-foreground mb-4">
            Unable to load catalog
          </p>
          <p className="text-lg text-muted-foreground/60">
            Please check your API configuration
          </p>
        </div>
      )}

    </div>
  );
}
