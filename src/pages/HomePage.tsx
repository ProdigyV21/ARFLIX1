import { useEffect, useState, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import HeroCarousel from '../components/hero/HeroCarousel';
import MediaCard16x9 from '../components/media/MediaCard16x9';
import { useFocusManager, useFocusable } from '../lib/focus';
import { catalogAPI, type CatalogItem, type HomeRow } from '../lib/catalog';
import { addonAPI } from '../lib/api';
import { getContinueWatching, saveProgress, type WatchProgress } from '../lib/progress';
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

      const [catalogData, addonsData, enrichedWatching] = await Promise.all([
        catalogAPI.getHome(),
        addonAPI.list().catch(() => ({ addons: [] })),
        enrichContinueWatchingImages(getContinueWatching(20)),
      ]);

      setRows(catalogData.rows || []);
      setHasAddons(addonsData.addons?.filter((a: any) => a.enabled).length > 0);
      setContinueWatching(enrichedWatching);
    } catch (error) {
      console.error('Failed to load content:', error);
    } finally {
      setLoading(false);
    }
  }

  async function enrichContinueWatchingImages(watching: WatchProgress[]): Promise<WatchProgress[]> {
    const BASE_URL = 'https://v3-cinemeta.strem.io';

    const enriched = await Promise.all(
      watching.map(async (item) => {
        try {
          const type: 'movie' | 'series' = item.type === 'anime' ? 'series' : item.type;

          const query = encodeURIComponent(item.title);
          const searchUrl = `${BASE_URL}/catalog/${type}/top/search.json?search=${query}`;

          console.log(`[CW] Searching Cinemeta for "${item.title}"`);
          const searchRes = await fetch(searchUrl);

          if (!searchRes.ok) {
            console.error(`[CW] Search failed for "${item.title}"`);
            return item;
          }

          const searchData = await searchRes.json();
          const metas = searchData.metas || [];

          if (metas.length === 0) {
            console.error(`[CW] No results found for "${item.title}"`);
            return item;
          }

          const normalizeTitle = (title: string) =>
            title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

          const searchTerm = normalizeTitle(item.title);

          let match = metas.find((m: any) => {
            const metaTitle = normalizeTitle(m.name || '');
            return metaTitle === searchTerm || metaTitle.includes(searchTerm) || searchTerm.includes(metaTitle);
          });

          if (!match) {
            match = metas[0];
            console.warn(`[CW] No exact match for "${item.title}", using first result: ${match.name}`);
          }

          const cinemetaId = match.id;

          console.log(`[CW] Found match for "${item.title}": ${cinemetaId} (${match.name})`);

          const metaUrl = `${BASE_URL}/meta/${type}/${encodeURIComponent(cinemetaId)}.json`;
          const metaRes = await fetch(metaUrl);

          if (!metaRes.ok) {
            console.error(`[CW] Failed to fetch meta for ${cinemetaId}`);
            return item;
          }

          const metaData = await metaRes.json();
          const meta = metaData.meta;

          console.log(`[CW] Got meta for "${item.title}":`, {
            backdrop: meta.background,
            poster: meta.poster
          });

          const enrichedItem: WatchProgress = {
            ...item,
            id: cinemetaId,
            backdrop: meta.background || item.backdrop,
            poster: meta.poster || item.poster
          };

          saveProgress(enrichedItem);

          return enrichedItem;
        } catch (error) {
          console.error(`[CW] Failed to enrich "${item.title}":`, error);
          return item;
        }
      })
    );

    return enriched;
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
            {continueWatching.map((item, index) => {
              return (
                <div key={`${item.id}-${item.title}-${index}`} className="flex-shrink-0 w-[360px]">
                  <MediaCard16x9
                    item={{
                      id: item.id,
                      title: item.title,
                      image16x9: item.backdrop || item.poster || '',
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
