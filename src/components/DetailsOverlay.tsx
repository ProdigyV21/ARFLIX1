import { useEffect, useState, useRef } from 'react';
import { X, Play, Plus } from 'lucide-react';
import { useFocusManager, useFocusable } from '../lib/focus';
import { catalogAPI } from '../lib/catalog';
import { OverviewTab } from './details/OverviewTab';
import { EpisodesTab } from './details/EpisodesTab';
import { SourcesTab } from './details/SourcesTab';
import { SimilarTab } from './details/SimilarTab';
import { TrailersTab } from './details/TrailersTab';

type Tab = 'overview' | 'episodes' | 'sources' | 'similar' | 'trailers';

interface DetailsOverlayProps {
  itemId: string;
  onClose: () => void;
  onPlay?: (season?: number, episode?: number) => void;
}

export function DetailsOverlay({ itemId, onClose, onPlay }: DetailsOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useFocusable(closeButtonRef);
  useFocusManager(containerRef, {
    autofocus: true,
  });

  useEffect(() => {
    async function loadMeta() {
      try {
        setLoading(true);
        const response = await catalogAPI.getMeta(itemId);
        setMeta(response.meta);
      } catch (error) {
        console.error('Failed to load meta:', error);
      } finally {
        setLoading(false);
      }
    }

    loadMeta();
  }, [itemId]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  if (!meta) {
    return null;
  }

  const tabs: { id: Tab; label: string; hidden?: boolean }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'episodes', label: 'Episodes', hidden: meta.type !== 'series' },
    { id: 'sources', label: 'Sources' },
    { id: 'similar', label: 'Similar' },
    { id: 'trailers', label: 'Trailers' },
  ];

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black/95 z-50 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="min-h-screen">
        <div className="relative">
          {meta.backdrop && (
            <div className="relative h-[60vh] w-full">
              <img
                src={meta.backdrop}
                alt={meta.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black" />
            </div>
          )}

          <button
            ref={closeButtonRef}
            data-focusable="true"
            onClick={onClose}
            className="absolute top-8 right-8 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-8 h-8" />
          </button>

          <div className="absolute bottom-0 left-0 right-0 p-12">
            <div className="max-w-7xl mx-auto flex gap-8 items-end">
              {meta.poster && (
                <img
                  src={meta.poster}
                  alt={meta.title}
                  className="w-64 h-96 object-cover rounded-lg shadow-2xl hidden md:block"
                />
              )}

              <div className="flex-1">
                <h1 className="text-6xl font-bold mb-4">{meta.title}</h1>
                {meta.tagline && (
                  <p className="text-2xl text-white/80 mb-4 italic">{meta.tagline}</p>
                )}
                <div className="flex items-center gap-4 text-lg mb-6">
                  {meta.year && <span>{meta.year}</span>}
                  {meta.rating && (
                    <span className="flex items-center gap-2">
                      <span className="text-yellow-400">★</span>
                      {meta.rating.toFixed(1)}
                    </span>
                  )}
                  {meta.runtime && <span>{meta.runtime} min</span>}
                  {meta.seasonCount && (
                    <span>{meta.seasonCount} Season{meta.seasonCount > 1 ? 's' : ''}</span>
                  )}
                </div>

                {meta.genres && meta.genres.length > 0 && (
                  <div className="flex gap-2 mb-6">
                    {meta.genres.map((genre: string) => (
                      <span
                        key={genre}
                        className="px-3 py-1 bg-white/10 rounded-full text-sm"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-4">
                  {onPlay && (
                    <button
                      data-focusable="true"
                      onClick={() => onPlay?.()}
                      className="flex items-center gap-3 px-8 py-4 bg-white text-black rounded-lg font-bold text-lg hover:bg-white/90 transition-all"
                    >
                      <Play className="w-6 h-6 fill-current" />
                      Play
                    </button>
                  )}
                  <button
                    data-focusable="true"
                    className="flex items-center gap-3 px-8 py-4 bg-white/20 hover:bg-white/30 rounded-lg font-bold text-lg transition-all"
                  >
                    <Plus className="w-6 h-6" />
                    Watchlist
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-12 py-8">
          <div className="flex gap-8 border-b border-white/20 mb-8">
            {tabs
              .filter((tab) => !tab.hidden)
              .map((tab) => (
                <button
                  key={tab.id}
                  data-focusable="true"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 text-lg font-semibold transition-all relative ${
                    activeTab === tab.id
                      ? 'text-white'
                      : 'text-white/60 hover:text-white/80'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white" />
                  )}
                </button>
              ))}
          </div>

          <div className="pb-12">
            {activeTab === 'overview' && <OverviewTab meta={meta} />}
            {activeTab === 'episodes' && (
              <EpisodesTab
                itemId={itemId}
                meta={meta}
                onPlay={(season, episode) => {
                  onClose();
                  onPlay?.(season, episode);
                }}
              />
            )}
            {activeTab === 'sources' && <SourcesTab itemId={itemId} />}
            {activeTab === 'similar' && <SimilarTab similar={meta.similar || []} />}
            {activeTab === 'trailers' && <TrailersTab trailers={meta.trailers || []} />}
          </div>
        </div>
      </div>
    </div>
  );
}
