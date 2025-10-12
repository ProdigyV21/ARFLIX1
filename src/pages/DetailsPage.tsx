import { useEffect, useState, useRef } from 'react';
import { Play, ArrowLeft, Loader2, Plus, Check, Info, PlayCircle } from 'lucide-react';
import { useFocusManager, useFocusable } from '../lib/focus';
import { fetchSeasons, fetchEpisodes, fetchMeta } from '../lib/api';
import CastCarousel from '../components/cast/CastCarousel';
import MoreLikeThis from '../components/recommendations/MoreLikeThis';
import ScrollCarousel from '../components/common/ScrollCarousel';
import type { Page } from '../types/navigation';

interface DetailsPageProps {
  contentId: string;
  contentType: string;
  addonId?: string;
  onNavigate: (page: Page, data?: any) => void;
  onBack: () => void;
}

interface MetaDetails {
  id: string;
  type: string;
  title?: string;
  name?: string;
  poster?: string;
  backdrop?: string;
  background?: string;
  logo?: string;
  overview?: string;
  description?: string;
  releaseInfo?: string;
  year?: number;
  runtime?: number;
  genres?: string[];
  genre?: string[];
  director?: string;
  creators?: string[];
  cast?: Array<{ name: string; character?: string; profile?: string | null; profileUrl?: string }>;
  imdbRating?: string;
  rating?: number;
  seasonCount?: number;
  episodeCount?: number;
  trailers?: Array<{
    id: string;
    name: string;
    key: string;
    url: string;
  }>;
  videos?: Array<{
    id: string;
    title: string;
    season?: number;
    episode?: number;
  }>;
  releaseDate?: string; // ISO date string (YYYY-MM-DD)
  streamingServices?: string[];
  trailerUrl?: string; // Direct YouTube URL for demo purposes
}

interface Season {
  seasonNumber: number;
  episodeCount: number;
  name: string;
  poster?: string;
  airDate?: string;
}

interface Episode {
  id?: string;
  episodeNumber?: number;
  number?: number;
  season?: number;
  title?: string;
  name?: string;
  overview?: string;
  description?: string;
  still?: string;
  airDate?: string;
  runtime?: number;
  voteAverage?: number;
}

export function DetailsPage({ contentId, contentType, addonId, onNavigate, onBack }: DetailsPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);

  const [meta, setMeta] = useState<MetaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());

  useFocusable(backRef);
  useFocusable(playRef);

  useFocusManager(containerRef, {
    onBack: onBack,
    autofocus: true,
  });

  // Load watchlist from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('watchlist');
      if (stored) {
        setWatchlistIds(new Set(JSON.parse(stored)));
      }
    } catch (error) {
      console.error('Failed to load watchlist:', error);
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [contentId, contentType, addonId]);

  async function loadMeta() {
    try {
      setLoading(true);
      setError(null);

      console.log('[DetailsPage] Loading meta for:', { contentType, contentId });

      // Always use Cinemeta for metadata (like Stremio does)
      // Addons are only used for streams, not metadata
      const data = await fetchMeta(contentType, contentId);
      console.log('[DetailsPage] Fetched meta data:', data);
      const metaData = data.meta;

      if (!metaData) {
        throw new Error('No metadata returned');
      }

      console.log('[DetailsPage] Meta type:', metaData.type, 'ID:', metaData.id);
      setMeta(metaData as any);

      if ((metaData.type === 'series' || metaData.type === 'anime') && metaData.id) {
        // For Cinemeta, ID is IMDB ID (tt1234567)
        if (metaData.id.startsWith('tt')) {
          const seasonsData = await fetchSeasons(metaData.id);
          const seasonNumbers = seasonsData.seasons || [];

          // Convert season numbers to Season objects
          const validSeasons = seasonNumbers.map((num: number) => ({
            seasonNumber: num,
            name: `Season ${num}`,
            episodeCount: 0,
          }));

          setSeasons(validSeasons);
          if (validSeasons.length > 0) {
            setSelectedSeason(validSeasons[0].seasonNumber);
            loadEpisodesForSeason(metaData.id, validSeasons[0].seasonNumber);
          }
        } else if (metaData.id.startsWith('tmdb:')) {
          // New TMDB format (tmdb:1396)
          const tmdbId = metaData.id.replace('tmdb:', '');
          console.log('[DetailsPage] Loading seasons for TMDB ID:', tmdbId);
          
          const seasonsData = await fetchSeasons(tmdbId);
          console.log('[DetailsPage] Raw seasons data:', seasonsData.seasons);
          
          // Handle both formats: array of numbers [1,2,3] or array of Season objects
          let validSeasons: Season[];
          if (seasonsData.seasons.length > 0 && typeof seasonsData.seasons[0] === 'number') {
            // Array of numbers format - convert to Season objects
            validSeasons = (seasonsData.seasons as number[]).map((num: number) => ({
              seasonNumber: num,
              name: `Season ${num}`,
              episodeCount: 0,
            }));
          } else {
            // Array of Season objects format
            validSeasons = (seasonsData.seasons as any[]).filter((s: any) => s.seasonNumber > 0) as Season[];
          }
          
          console.log('[DetailsPage] Loaded seasons:', validSeasons);
          
          setSeasons(validSeasons);
          if (validSeasons.length > 0) {
            setSelectedSeason(validSeasons[0].seasonNumber);
            loadEpisodesForSeason(metaData.id, validSeasons[0].seasonNumber);
          }
        } else if (metaData.id.includes(':')) {
          // Fallback for old format (tmdb:tv:123)
          const parts = metaData.id.split(':');
          const source = parts[0];
          const tmdbId = parts[2];

          if (source === 'anilist') {
            loadAnimeEpisodes(metaData.id);
          } else if (tmdbId) {
            const seasonsData = await fetchSeasons(tmdbId);
            const validSeasons = (seasonsData.seasons as any[]).filter((s: any) => s.seasonNumber > 0) as Season[];
            setSeasons(validSeasons);
            if (validSeasons.length > 0) {
              setSelectedSeason(validSeasons[0].seasonNumber);
              loadEpisodesForSeason(metaData.id, validSeasons[0].seasonNumber);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load metadata:', err);
      setError('Failed to load content details');
    } finally {
      setLoading(false);
    }
  }

  async function loadAnimeEpisodes(animeId: string) {
    try {
      setLoadingEpisodes(true);
      const episodesData = await fetchEpisodes(animeId);
      setEpisodes(episodesData.episodes);
    } catch (err) {
      console.error('Failed to load anime episodes:', err);
    } finally {
      setLoadingEpisodes(false);
    }
  }

  async function loadEpisodesForSeason(id: string, seasonNum: number) {
    try {
      setLoadingEpisodes(true);
      const episodesData = await fetchEpisodes(id, seasonNum);
      setEpisodes(episodesData.episodes);
    } catch (err) {
      console.error('Failed to load episodes:', err);
    } finally {
      setLoadingEpisodes(false);
    }
  }

  function handleSeasonChange(seasonNum: number) {
    setSelectedSeason(seasonNum);
    if (meta?.id) {
      loadEpisodesForSeason(meta.id, seasonNum);
    }
  }

  async function handlePlay(season?: number, episode?: number) {
    if (!meta) return;
    const title = meta.title || meta.name;

    // For series, get the episode backdrop/still
    let backdrop = meta.backdrop || meta.background;
    if ((meta.type === 'series' || meta.type === 'anime') && season && episode) {
      const episodeData = episodes.find(e =>
        (e.episodeNumber || e.number) === episode
      );
      if (episodeData?.still) {
        backdrop = episodeData.still;
      }
    }

    onNavigate('player', {
      id: meta.id,
      type: meta.type,
      addonId,
      title,
      season,
      episode,
      poster: meta.poster,
      backdrop,
    });
  }

  function handleTrailer() {
    if (meta?.trailerUrl) {
      // Use the direct trailer URL
      window.open(meta.trailerUrl, '_blank');
    } else if (meta?.trailers && meta.trailers.length > 0) {
      const trailerKey = meta.trailers[0].key;
      // Try to open in new window as YouTube embed restrictions can block iframe embedding
      window.open(`https://www.youtube.com/watch?v=${trailerKey}`, '_blank');
    }
  }

  function handleWatchlistToggle(id: string, isInWatchlist: boolean) {
    setWatchlistIds(prev => {
      const next = new Set(prev);
      if (isInWatchlist) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem('watchlist', JSON.stringify(Array.from(next)));
      } catch (error) {
        console.error('Failed to save watchlist:', error);
      }
      return next;
    });
  }

  function handleItemClick(id: string, type: 'movie' | 'series') {
    onNavigate('details', { id, type });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin" />
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="min-h-screen flex items-center justify-center px-8">
        <div className="text-center max-w-md">
          <h2 className="text-3xl font-bold mb-4">Error</h2>
          <p className="text-xl text-muted-foreground mb-8">{error || 'Content not found'}</p>
          <button
            ref={backRef}
            data-focusable="true"
            onClick={onBack}
            className="px-8 py-4 bg-white text-black rounded-lg text-lg font-semibold"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const displayTitle = meta.title || meta.name || '';
  const hasTrailer = (meta.trailers && meta.trailers.length > 0) || meta.trailerUrl;

  return (
    <div ref={containerRef} className="min-h-screen -ml-[90px]">
      <div className="relative min-h-[72vh]">
        {(meta.backdrop || meta.background || meta.poster) ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${meta.backdrop || meta.background || meta.poster})`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/40" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-black to-zinc-900" />
        )}

        <div className="relative flex flex-col justify-start pt-16 pb-4 pl-[102px] pr-12">
          <button
            ref={backRef}
            data-focusable="true"
            onClick={onBack}
            className="absolute top-8 left-[102px] flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="text-lg">Back</span>
          </button>

          <div className="max-w-3xl space-y-6">
            <h1 className="text-7xl font-bold drop-shadow-2xl">{displayTitle}</h1>

            <div className="flex items-center gap-4 text-lg">
              {meta.year && (
                <span className="text-white/90">{meta.year}</span>
              )}
              {meta.type === 'anime' && meta.episodeCount && (
                <>
                  <span className="text-white/60">•</span>
                  <span className="text-white/90">{meta.episodeCount} Episode{meta.episodeCount > 1 ? 's' : ''}</span>
                </>
              )}
              {meta.type === 'series' && meta.seasonCount && (
                <>
                  <span className="text-white/60">•</span>
                  <span className="text-white/90">{meta.seasonCount} Season{meta.seasonCount > 1 ? 's' : ''}</span>
                </>
              )}
              {meta.genres && meta.genres.length > 0 && (
                <>
                  <span className="text-white/60">•</span>
                  <span className="px-3 py-1 border border-white/40 rounded text-sm">
                    {meta.genres[0]}
                  </span>
                </>
              )}
              {(meta.rating || meta.imdbRating) && (
                <>
                  <span className="text-white/60">•</span>
                  <span className="flex items-center gap-1 text-white/90">
                    <span className="text-yellow-400">⭐</span>
                    {meta.imdbRating || meta.rating?.toFixed(1)}
                  </span>
                </>
              )}
            </div>

            {(meta.overview || meta.description) && (
              <p className="text-lg text-white/90 leading-relaxed max-w-2xl line-clamp-3">
                {meta.overview || meta.description}
              </p>
            )}

            {/* Release Date */}
            {meta.releaseDate && (
              <div className="flex items-center gap-2 text-white/80">
                <span className="text-sm font-medium">Release Date:</span>
                <span className="text-sm">
                  {new Date(meta.releaseDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            )}

            {/* Streaming Services */}
            {meta.streamingServices && meta.streamingServices.length > 0 && (
              <div className="flex items-center gap-2 text-white/80">
                <span className="text-sm font-medium">Available on:</span>
                <div className="flex gap-2">
                  {meta.streamingServices.map((service, index) => (
                    <span key={index} className="px-2 py-1 bg-white/20 rounded text-xs">
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            )}


            <div className="flex items-center gap-4 pt-2">
              <button
                ref={playRef}
                data-focusable="true"
                onClick={() => meta.type === 'movie' ? handlePlay() : handlePlay(1, 1)}
                className="flex items-center gap-3 px-10 py-4 bg-white text-black rounded-lg text-lg font-semibold hover:bg-white/90 transition-all"
              >
                <Play className="w-6 h-6 fill-current" />
                {meta.type === 'movie' ? 'Play Now' : meta.type === 'anime' ? 'Play Episode 1' : 'Play S1 E1'}
              </button>

              {hasTrailer && (
                <button
                  data-focusable="true"
                  onClick={handleTrailer}
                  className="flex items-center gap-3 px-10 py-4 bg-white/20 backdrop-blur text-white rounded-lg text-lg font-semibold hover:bg-white/30 transition-all"
                >
                  <PlayCircle className="w-6 h-6" />
                  Trailer
                </button>
              )}

              <button
                data-focusable="true"
                onClick={() => handleWatchlistToggle(contentId, watchlistIds.has(contentId))}
                className="flex items-center justify-center w-14 h-14 bg-white/20 backdrop-blur text-white rounded-full hover:bg-white/30 transition-all"
                aria-label={watchlistIds.has(contentId) ? 'Remove from watchlist' : 'Add to watchlist'}
              >
                {watchlistIds.has(contentId) ? (
                  <Check className="w-7 h-7" />
                ) : (
                  <Plus className="w-7 h-7" />
                )}
              </button>

              <button
                data-focusable="true"
                className="flex items-center justify-center w-14 h-14 bg-white/20 backdrop-blur text-white rounded-full hover:bg-white/30 transition-all"
              >
                <Info className="w-7 h-7" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {(meta.type === 'series' || meta.type === 'anime') && seasons.length > 0 && (
        <div className="relative z-10 bg-transparent -mt-16 md:-mt-20 pt-0 pb-8">
          <div className="pl-[102px] pr-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-4">Seasons</h2>
            <div className="flex gap-3 flex-wrap">
              {seasons.map((season) => (
                <button
                  key={season.seasonNumber}
                  onClick={() => handleSeasonChange(season.seasonNumber)}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    selectedSeason === season.seasonNumber
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {season.name}
                </button>
              ))}
            </div>
          </div>

          {loadingEpisodes ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin" />
            </div>
          ) : (
            <div>
              <h3 className="text-2xl font-bold mb-6">Episodes</h3>
              <ScrollCarousel id={`episodes-s${selectedSeason}`} className="pb-4">
                {episodes.map((episode) => {
                  const episodeNum = episode.episodeNumber || episode.number || 0;
                  const episodeTitle = episode.title || episode.name || `Episode ${episodeNum}`;

                  return (
                    <button
                      key={episode.id || episodeNum}
                      onClick={() => handlePlay(selectedSeason, episodeNum)}
                      className="group text-left bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-all flex-shrink-0 w-[420px]"
                    >
                      <div className="relative aspect-video bg-gray-800">
                        {episode.still ? (
                          <img
                            src={episode.still}
                            alt={episodeTitle}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-16 h-16 text-white/30" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center pointer-events-none">
                          <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity fill-current" />
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-base line-clamp-1">
                            {episodeNum}. {episodeTitle}
                          </h4>
                          {episode.runtime && (
                            <span className="text-sm text-white/60 ml-2 flex-shrink-0">
                              {episode.runtime}m
                          </span>
                        )}
                      </div>
                      {episode.airDate && (
                        <p className="text-xs text-white/50 mb-1">
                          {new Date(episode.airDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      )}
                      {(episode.overview || episode.description) && (
                        <p className="text-sm text-white/70 line-clamp-2">
                          {episode.overview || episode.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
                })}
              </ScrollCarousel>
            </div>
          )}
          </div>
        </div>
      )}

      <div className="pl-[102px] pr-12 py-8 bg-black">
        {meta.cast && meta.cast.length > 0 && (
          <CastCarousel 
            cast={meta.cast.map((actor, index) => ({
              id: `cast-${index}`,
              name: actor.name,
              character: actor.character || '',
              profile: actor.profile,
              profileUrl: actor.profileUrl
            }))}
            onNavigate={(id, t) => {
              onNavigate('details', {
                id,
                type: t
              });
            }}
            className="mb-12"
          />
        )}

        <MoreLikeThis
          contentId={contentId}
          contentType={contentType === 'series' || contentType === 'anime' ? 'series' : 'movie'}
          onItemClick={handleItemClick}
          watchlistIds={watchlistIds}
          onWatchlistToggle={handleWatchlistToggle}
          className="mb-12"
        />

        {(meta.director || (meta.creators && meta.creators.length > 0)) && (
          <div>
            <h2 className="text-3xl font-bold mb-6">Details</h2>
            <div className="space-y-4">
              {meta.director && (
                <div>
                  <span className="text-white/60 text-sm">Director: </span>
                  <span className="text-white">{meta.director}</span>
                </div>
              )}
              {meta.creators && meta.creators.length > 0 && (
                <div>
                  <span className="text-white/60 text-sm">Creators: </span>
                  <span className="text-white">{meta.creators.join(', ')}</span>
                </div>
              )}
              {meta.genres && meta.genres.length > 0 && (
                <div>
                  <span className="text-white/60 text-sm">Genres: </span>
                  <span className="text-white">{meta.genres.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
