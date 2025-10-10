import { useEffect, useState, useRef } from 'react';
import { Film, Loader2 } from 'lucide-react';
import { ContentCard } from '../components/ContentCard';
import { useFocusManager } from '../lib/focus';
import { supabase } from '../lib/supabase';
import type { WatchHistoryItem } from '../lib/supabase';

interface WatchlistPageProps {
  onNavigate: (page: string, data?: any) => void;
}

export function WatchlistPage({ onNavigate }: WatchlistPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusManager(containerRef, {
    autofocus: true,
  });

  useEffect(() => {
    loadWatchHistory();
  }, []);

  async function loadWatchHistory() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('watch_history')
        .select('*')
        .eq('user_id', user.id)
        .order('last_watched', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Failed to load watch history:', error);
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
          <h1 className="text-5xl font-bold">Continue Watching</h1>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-20">
            <Film className="w-20 h-20 text-muted-foreground mx-auto mb-4" />
            <p className="text-2xl text-muted-foreground">No watch history yet</p>
            <p className="text-lg text-muted-foreground/60 mt-2">
              Start watching content to see it here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {history.map((item) => {
              const progress = item.duration > 0 ? (item.position / item.duration) * 100 : 0;

              return (
                <div key={item.id} className="relative">
                  <ContentCard
                    title={item.title}
                    poster={item.poster || undefined}
                    type={item.content_type}
                    onClick={() => {
                      const [addonId, type, id] = item.content_id.split(':');
                      onNavigate('details', { id, type, addonId });
                    }}
                  />

                  {progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 rounded-b-lg overflow-hidden">
                      <div
                        className="h-full bg-white"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
