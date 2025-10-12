import { useState, useEffect } from 'react';
import ScrollCarousel from '../common/ScrollCarousel';
import MediaCard16x9 from '../media/MediaCard16x9';
import { Plus, Check } from 'lucide-react';

interface MoreLikeThisProps {
  contentId: string;
  contentType: 'movie' | 'series';
  onItemClick: (id: string, type: 'movie' | 'series') => void;
  watchlistIds?: Set<string>;
  onWatchlistToggle?: (id: string, isInWatchlist: boolean) => void;
  className?: string;
}

interface RecommendedItem {
  id: string;
  title: string;
  type: 'movie' | 'series';
  backdrop?: string;
  poster?: string;
  year?: number;
  rating?: number;
}

export default function MoreLikeThis({ 
  contentId, 
  contentType, 
  onItemClick,
  watchlistIds = new Set(),
  onWatchlistToggle,
  className = '' 
}: MoreLikeThisProps) {
  const [recommendations, setRecommendations] = useState<RecommendedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecommendations() {
      try {
        setLoading(true);
        
        // Extract TMDB ID
        const tmdbId = contentId.includes(':') 
          ? contentId.split(':').pop() 
          : contentId;
        
        const tmdbApiKey = '080380c1ad7b3967af3def25159e4374';
        const mediaType = contentType === 'series' ? 'tv' : 'movie';
        
        // Try recommendations first, fallback to similar
        const [recResponse, similarResponse] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/recommendations?api_key=${tmdbApiKey}&language=en-US&page=1`),
          fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/similar?api_key=${tmdbApiKey}&language=en-US&page=1`)
        ]);

        let items: any[] = [];
        
        if (recResponse.ok) {
          const recData = await recResponse.json();
          items = recData.results || [];
        }
        
        if (items.length < 10 && similarResponse.ok) {
          const similarData = await similarResponse.json();
          const similarItems = similarData.results || [];
          
          // Merge and dedupe
          const existingIds = new Set(items.map((i: any) => i.id));
          items = [
            ...items,
            ...similarItems.filter((i: any) => !existingIds.has(i.id))
          ];
        }

        const mapped = items.slice(0, 10).map((item: any) => ({
          id: `tmdb:${item.id}`,
          title: item.title || item.name,
          type: contentType,
          backdrop: item.backdrop_path 
            ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
            : undefined,
          poster: item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : undefined,
          year: item.release_date 
            ? new Date(item.release_date).getFullYear()
            : item.first_air_date
            ? new Date(item.first_air_date).getFullYear()
            : undefined,
          rating: item.vote_average
        }));

        setRecommendations(mapped);
      } catch (error) {
        console.error('Failed to load recommendations:', error);
        setRecommendations([]);
      } finally {
        setLoading(false);
      }
    }

    loadRecommendations();
  }, [contentId, contentType]);

  if (loading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="h-8 w-48 bg-gray-800 rounded mb-4" />
        <div className="flex gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[360px] h-[200px] bg-gray-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h2 className="text-2xl font-bold mb-4">More Like This</h2>
      <ScrollCarousel id="more-like-this" className="pb-2">
        {recommendations.map((item) => {
          const isInWatchlist = watchlistIds.has(item.id);
          
          return (
            <div key={item.id} className="flex-shrink-0 w-[360px] group relative transition-transform duration-300 ease-out hover:scale-[1.03]">
              <MediaCard16x9
                item={{
                  id: item.id,
                  title: item.title,
                  image16x9: item.backdrop || item.poster || '',
                  year: item.year?.toString()
                }}
                onClick={() => onItemClick(item.id, item.type)}
              />
              
              {/* Quick Add to Watchlist */}
              {onWatchlistToggle && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onWatchlistToggle(item.id, isInWatchlist);
                  }}
                  className="absolute top-2 right-2 p-2 bg-black/70 hover:bg-black/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                >
                  {isInWatchlist ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </ScrollCarousel>
    </div>
  );
}

