import { useEffect, useState, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import HeroCarousel from '../components/hero/HeroCarousel';
import MediaCard16x9 from '../components/media/MediaCard16x9';
import { useFocusManager, useFocusable } from '../lib/focus';
import { catalogAPI, type CatalogItem, type HomeRow } from '../lib/catalog';
import { addonAPI } from '../lib/api';
import { getContinueWatching, type WatchProgress } from '../lib/progress';
import type { HeroItem } from '../lib/tmdb';
import { tmdbBackdrop } from '../lib/tmdbImages';

interface HomePageProps {
  onNavigate: (page: string, data?: any) => void;
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

  useFocusable(watchRef);
  useFocusable(infoRef);
  useFocusable(addonsButtonRef);

  useFocusManager(containerRef, {
    onBack: () => {},
    autofocus: true,
  });

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

      const [catalogData, addonsData] = await Promise.all([
        catalogAPI.getHome(),
        addonAPI.list().catch(() => ({ addons: [] })),
      ]);

      setRows(catalogData.rows || []);
      setHasAddons(addonsData.addons?.filter((a: any) => a.enabled).length > 0);
      setContinueWatching(getContinueWatching(20));
    } catch (error) {
      console.error('Failed to load content:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleItemClick(item: CatalogItem) {
    setSelectedItem(item.id);
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
      <HeroCarousel
        onPlayClick={(item: HeroItem) => {
          if (!hasAddons) {
            onNavigate('settings');
            return;
          }
          setSelectedItem(item.id);
        }}
        onInfoClick={(item: HeroItem) => {
          setSelectedItem(item.id);
        }}
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
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
            {continueWatching.map((item) => {
              // Prefer backdrop from watch progress (episode still), then catalog item
              const catalogItem = rows.flatMap(r => r.items).find((i: CatalogItem) => i.id === item.id);
              const image = item.backdrop || catalogItem?.backdrop || catalogItem?.poster || item.poster || '';

              return (
                <div key={item.id} className="flex-shrink-0 w-[360px]">
                  <MediaCard16x9
                    item={{
                      id: item.id,
                      title: item.title,
                      image16x9: image,
                    }}
                    onClick={() => {
                      onNavigate('details', {
                        id: item.id,
                        type: item.type
                      });
                    }}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}


      {rows.map((row, rowIndex) => {
        if (row.items.length === 0) return null;

        return (
          <section key={rowIndex} className="px-8 mb-6">
            <h2 className="text-3xl font-bold mb-6">{row.title}</h2>
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
              {row.items.map((item) => (
                <div key={item.id} className="flex-shrink-0 w-[360px]">
                  <MediaCard16x9
                    item={{
                      id: item.id,
                      title: item.title,
                      image16x9: item.backdrop || item.poster || '',
                      year: item.year?.toString()
                    }}
                    onClick={() => {
                      if (hasAddons) {
                        handleItemClick(item);
                      } else {
                        onNavigate('settings');
                      }
                    }}
                  />
                </div>
              ))}
            </div>
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
