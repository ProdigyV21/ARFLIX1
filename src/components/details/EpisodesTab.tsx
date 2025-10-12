import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { fetchEpisodes } from '../../lib/api';

interface Episode {
  id?: string | number;
  episode_number?: number;
  number?: number;
  season?: number;
  title?: string;
  name?: string;
  overview?: string;
  description?: string;
  still?: string | null;
  airDate?: string | null;
  air_date?: string | null;
  runtime?: number | null;
  rating?: number;
}

interface EpisodesTabProps {
  itemId: string;
  meta: any;
  onPlay?: (season: number, episode: number) => void;
}

export function EpisodesTab({ itemId, meta, onPlay }: EpisodesTabProps) {
  const [season, setSeason] = useState(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEpisodes() {
      try {
        setLoading(true);
        setError(null);

        // Cinemeta uses IMDB IDs directly
        let contentId = itemId;
        if (itemId.includes(':')) {
          const parts = itemId.split(':');
          contentId = parts[2] || parts[0];
        }

        const data = await fetchEpisodes(contentId, season);
        setEpisodes(data.episodes || []);
      } catch (err: any) {
        console.error('Failed to load episodes:', err);
        setError(err.message || 'Failed to load episodes');
      } finally {
        setLoading(false);
      }
    }

    loadEpisodes();
  }, [itemId, season]);

  const totalSeasons = meta.seasonCount || 1;

  if (loading) {
    return <div className="text-center py-12">Loading episodes...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12 text-white/60">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Episodes</h2>

        <div className="flex items-center gap-4">
          <button
            data-focusable="true"
            onClick={() => setSeason((s) => Math.max(1, s - 1))}
            disabled={season === 1}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <span className="text-lg font-medium min-w-[120px] text-center">
            Season {season}
          </span>

          <button
            data-focusable="true"
            onClick={() => setSeason((s) => Math.min(totalSeasons, s + 1))}
            disabled={season === totalSeasons}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {episodes.map((episode) => {
          const episodeNum = episode.number || episode.episode_number || 0;
          const episodeTitle = episode.title || episode.name || `Episode ${episodeNum}`;
          const episodeDesc = episode.overview || episode.description || '';

          return (
            <button
              key={episode.id || episodeNum}
              data-focusable="true"
              onClick={() => onPlay?.(season, episodeNum)}
              className="group bg-white/5 hover:bg-white/10 rounded-lg overflow-hidden flex gap-4 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50 text-left w-full"
            >
              <div className="relative w-64 h-36 flex-shrink-0">
                {episode.still ? (
                  <>
                    <img
                      src={episode.still}
                      alt={episodeTitle}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-12 h-12" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center">
                    <Play className="w-12 h-12 text-white/30" />
                  </div>
                )}
              </div>

              <div className="flex-1 py-4 pr-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold">
                    {episodeNum}. {episodeTitle}
                  </h3>
                  {episode.runtime && (
                    <span className="text-sm text-white/60">{episode.runtime} min</span>
                  )}
              </div>

              <p className="text-white/70 line-clamp-2 mb-2">{episodeDesc}</p>

              <div className="flex items-center gap-4 text-sm text-white/60">
                {(episode.air_date || episode.airDate) && (
                  <span>{new Date(episode.air_date || episode.airDate || '').toLocaleDateString()}</span>
                )}
                {episode.rating && episode.rating > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="text-yellow-400">★</span>
                    {episode.rating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
        })}
      </div>
    </div>
  );
}
