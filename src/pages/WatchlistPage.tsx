import { useEffect, useState, useRef } from 'react';
import { Film, Loader2 } from 'lucide-react';
import { ContentCard } from '../components/ContentCard';
import { useFocusManager } from '../lib/focus';
import type { Page } from '../types/navigation';
import { metadataProvider } from '../lib/meta';
import type { Title } from '../lib/meta/types';

interface WatchlistPageProps {
  onNavigate: (page: Page, data?: any) => void;
}

export function WatchlistPage({ onNavigate }: WatchlistPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusManager(containerRef, {
    autofocus: true,
  });

  useEffect(() => {
    loadWatchlist();
  }, []);

  async function loadWatchlist() {
    try {
      setLoading(true);
      const stored = localStorage.getItem('watchlist');
      const ids: string[] = stored ? JSON.parse(stored) : [];
      if (!ids || ids.length === 0) {
        setItems([]);
        return;
      }

      // Fetch metadata for each id in parallel
      const results = await Promise.allSettled(
        ids.map(id => metadataProvider.getTitle(undefined, id))
      );
      const titles: Title[] = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<Title>).value);
      setItems(titles);
    } catch (error) {
      console.error('Failed to load watchlist:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Film className="w-12 h-12" />
          <h1 className="text-5xl font-bold">Your Watchlist</h1>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <Film className="w-20 h-20 text-muted-foreground mx-auto mb-4" />
            <p className="text-2xl text-muted-foreground">Your watchlist is empty</n>
            <p className="text-lg text-muted-foreground/60 mt-2">
              Add shows or movies using the + button
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {items.map((title) => (
              <div key={title.id} className="relative">
                <ContentCard
                  title={title.title}
                  poster={title.posterUrl}
                  type={title.type}
                  onClick={() => {
                    const id = title.externalIds.tmdb ? `tmdb:${title.externalIds.tmdb}` : title.id;
                    onNavigate('details', { id, type: title.type });
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
