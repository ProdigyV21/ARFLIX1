import { useState, useEffect, useCallback } from 'react';
import { Play, Info, Plus, Check } from 'lucide-react';
import { metadataProvider } from '../../lib/meta';
import type { Title } from '../../lib/meta/types';

interface HeroRotatorProps {
  onPlayClick: (item: Title) => void;
  onInfoClick: (item: Title) => void;
  onWatchlistClick: (item: Title, isInWatchlist: boolean) => void;
  watchlistIds: Set<string>;
}

const ROTATION_INTERVAL = 9000; // 9 seconds
const CROSSFADE_DURATION = 800; // 0.8 seconds

export default function HeroRotator({ 
  onPlayClick, 
  onInfoClick, 
  onWatchlistClick,
  watchlistIds 
}: HeroRotatorProps) {
  const [items, setItems] = useState<Title[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load and shuffle trending items
  useEffect(() => {
    async function loadTrendingItems() {
      try {
        console.log('[HeroRotator] Loading trending items...');
        
        // Fetch top 3 trending movies and TV shows
        const [trendingMovies, trendingTV] = await Promise.all([
          metadataProvider.getCatalog('movie', 'trending_movies', { limit: 3 }),
          metadataProvider.getCatalog('series', 'trending_tv', { limit: 3 })
        ]);

        // Combine into one pool
        const combined = [
          ...(trendingMovies || []),
          ...(trendingTV || [])
        ].filter(item => item.posterUrl || item.backdropUrl);

        if (combined.length === 0) {
          console.warn('[HeroRotator] No trending items found');
          setLoading(false);
          return;
        }

        // Shuffle using Date.now() as seed for variety
        const seed = Date.now();
        const shuffled = combined
          .map((item, index) => ({ item, sort: (seed + index) % combined.length }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ item }) => item);

        // Check sessionStorage for persisted index
        const sessionKey = 'hero-rotator-index';
        const persistedIndex = sessionStorage.getItem(sessionKey);
        const startIndex = persistedIndex ? parseInt(persistedIndex, 10) % shuffled.length : 0;

        console.log('[HeroRotator] Loaded', shuffled.length, 'items, starting at index', startIndex);
        
        setItems(shuffled);
        setCurrentIndex(startIndex);
        setLoading(false);
      } catch (error) {
        console.error('[HeroRotator] Error loading trending items:', error);
        setLoading(false);
      }
    }

    loadTrendingItems();
  }, []);

  // Auto-rotate with crossfade
  useEffect(() => {
    if (items.length <= 1) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      
      // Wait for crossfade to start, then update index
      setTimeout(() => {
        setCurrentIndex(prev => {
          const next = (prev + 1) % items.length;
          sessionStorage.setItem('hero-rotator-index', String(next));
          return next;
        });
        
        // End transition after fade completes
        setTimeout(() => setIsTransitioning(false), CROSSFADE_DURATION);
      }, 100);
    }, ROTATION_INTERVAL);

    return () => clearInterval(interval);
  }, [items.length]);

  const handlePrevious = useCallback(() => {
    if (items.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => {
        const next = (prev - 1 + items.length) % items.length;
        sessionStorage.setItem('hero-rotator-index', String(next));
        return next;
      });
      setTimeout(() => setIsTransitioning(false), CROSSFADE_DURATION);
    }, 100);
  }, [items.length]);

  const handleNext = useCallback(() => {
    if (items.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(prev => {
        const next = (prev + 1) % items.length;
        sessionStorage.setItem('hero-rotator-index', String(next));
        return next;
      });
      setTimeout(() => setIsTransitioning(false), CROSSFADE_DURATION);
    }, 100);
  }, [items.length]);

  if (loading) {
    return (
      <div className="relative w-full h-[70vh] bg-gradient-to-b from-gray-900 to-black animate-pulse">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  const currentItem = items[currentIndex];
  const isInWatchlist = watchlistIds.has(currentItem.id);

  // Get highest quality backdrop
  const backdropUrl = currentItem.backdropUrl 
    ? currentItem.backdropUrl.replace(/w\d+/, 'original')
    : currentItem.posterUrl?.replace(/w\d+/, 'w1280');

  return (
    <div className="relative w-full h-[70vh] overflow-hidden">
      {/* Backdrop Image with Crossfade */}
      <div 
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-${CROSSFADE_DURATION}`}
        style={{
          backgroundImage: `url(${backdropUrl})`,
          opacity: isTransitioning ? 0 : 1
        }}
      />

      {/* Content */}
      <div className="relative h-full px-8 flex items-end pb-14 sm:pb-16 lg:pb-20">
        <div className="max-w-2xl space-y-4">
          {/* Title */}
          <h1 
            className={`text-4xl sm:text-5xl lg:text-6xl font-bold text-white transition-opacity duration-${CROSSFADE_DURATION}`}
            style={{ opacity: isTransitioning ? 0 : 1 }}
          >
            {currentItem.title}
          </h1>

          {/* Meta Info */}
          <div 
            className={`flex items-center gap-3 text-sm text-gray-300 transition-opacity duration-${CROSSFADE_DURATION}`}
            style={{ opacity: isTransitioning ? 0 : 1 }}
          >
            <span className="text-white font-semibold">{currentItem.year}</span>
            <span>•</span>
            <span className="capitalize">{currentItem.type}</span>
            {currentItem.rating && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">⭐</span>
                  <span>{currentItem.rating.toFixed(1)}</span>
                </div>
              </>
            )}
          </div>

          {/* Overview */}
          <p 
            className={`text-base sm:text-lg text-gray-200 line-clamp-3 transition-opacity duration-${CROSSFADE_DURATION}`}
            style={{ opacity: isTransitioning ? 0 : 1 }}
          >
            {currentItem.overview}
          </p>

          {/* CTA Buttons */}
          <div 
            className={`flex items-center gap-3 transition-opacity duration-${CROSSFADE_DURATION}`}
            style={{ opacity: isTransitioning ? 0 : 1 }}
          >
            <button
              onClick={() => onPlayClick(currentItem)}
              className="px-8 py-3 bg-white hover:bg-gray-200 text-black font-semibold rounded-lg flex items-center gap-2 transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              <Play className="w-5 h-5 fill-current" />
              Play
            </button>
            
            <button
              onClick={() => onInfoClick(currentItem)}
              className="px-6 py-3 bg-gray-600/80 hover:bg-gray-500/80 text-white font-semibold rounded-lg flex items-center gap-2 transition-all duration-200 backdrop-blur-sm"
            >
              <Info className="w-5 h-5" />
              More Info
            </button>

            <button
              onClick={() => onWatchlistClick(currentItem, isInWatchlist)}
              className="p-3 bg-gray-600/80 hover:bg-gray-500/80 text-white rounded-full transition-all duration-200 backdrop-blur-sm"
              aria-label={isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
            >
              {isInWatchlist ? (
                <Check className="w-5 h-5" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {items.length > 1 && (
        <>
          <button
            onClick={handlePrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200 backdrop-blur-sm z-10"
            aria-label="Previous item"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200 backdrop-blur-sm z-10"
            aria-label="Next item"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Progress Indicators */}
      {items.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  setCurrentIndex(index);
                  sessionStorage.setItem('hero-rotator-index', String(index));
                  setTimeout(() => setIsTransitioning(false), CROSSFADE_DURATION);
                }, 100);
              }}
              className={`h-1 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-white w-8' 
                  : 'bg-gray-500 hover:bg-gray-400 w-6'
              }`}
              aria-label={`Go to item ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

