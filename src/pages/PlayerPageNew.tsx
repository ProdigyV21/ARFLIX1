/**
 * PlayerPageNew - Updated player page using PlayerCore
 * Integrates the new multi-platform player architecture with existing UI
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useMediaEngine, getAvailableQualities, setQuality, getCurrentQuality, getAudioTracks, setAudioTrack } from '../lib/useMediaEngine';
import type { NormalizedStream } from '../lib/player';
import { PlayerControls } from '../components/player/PlayerControls';
import { SettingsPanel } from '../components/player/SettingsPanel';
import PlayerLoadingScreen from '../components/player/PlayerLoadingScreen';
import { saveProgress, getProgress, shouldShowResumePrompt, WatchProgress } from '../lib/progress';
import { fetchStreams } from '../lib/api';
import { type Subtitle, fetchSubtitlesWithCache } from '../lib/subtitles';
import { supabase } from '../lib/supabase';
import { getDeviceCapabilities } from '../lib/deviceCapabilities';
import { selectPlayableSource, type StreamWithClassification } from '../lib/streamClassifier';
import IncompatibleSourceSheet from '../components/player/IncompatibleSourceSheet';

type PlayerPageProps = {
  contentId: string;
  contentType: 'movie' | 'series' | 'anime';
  addonId?: string;
  title: string;
  poster?: string;
  backdrop?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  onBack: () => void;
};

export function PlayerPageNew({
  contentId,
  contentType,
  title,
  poster,
  backdrop,
  seasonNumber,
  episodeNumber,
  onBack,
}: PlayerPageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { engineRef, attach, destroy } = useMediaEngine();
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [streams, setStreams] = useState<NormalizedStream[]>([]);
  const [classifiedStreams, setClassifiedStreams] = useState<StreamWithClassification[]>([]);
  const [currentStream, setCurrentStream] = useState<NormalizedStream | null>(null);
  const [showIncompatibleSheet, setShowIncompatibleSheet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [muted, setMuted] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [qualities, setQualities] = useState<any[]>([]);
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [textTracks, setTextTracks] = useState<any[]>([]);
  const [currentQuality, setCurrentQuality] = useState<any | undefined>();
  const [currentAudioTrack, setCurrentAudioTrack] = useState<any | undefined>();
  const [currentTextTrack, setCurrentTextTrack] = useState<any | undefined>();
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [preferredSubtitleLang, setPreferredSubtitleLang] = useState<string>('en');
  const [sourceDetails, setSourceDetails] = useState<string>('');
  const [resumeTime, setResumeTime] = useState<number | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  // Initialize video element
  useEffect(() => {
    if (videoRef.current && engineRef.current) {
      attach(videoRef.current);
    }
  }, [attach]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const buffered = video.buffered.end(video.buffered.length - 1);
        setBuffered((buffered / video.duration) * 100);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('progress', handleProgress);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('progress', handleProgress);
    };
  }, []);

  // Load streams
  useEffect(() => {
    const loadStreams = async () => {
      try {
        console.log('[PlayerPage] Loading streams with:', { contentId, contentType, seasonNumber, episodeNumber });
        
        const response = await fetchStreams(contentType, contentId, seasonNumber, episodeNumber);
        console.log('[PlayerPage] Streams response:', response);
        
        if (response.items && response.items.length > 0) {
          setStreams(response.items);
          
          const deviceCapabilities = getDeviceCapabilities();
          console.log('[PlayerPage] Device capabilities:', deviceCapabilities);
          
          // Use selectPlayableSource to classify and select the best stream
          const playableSource = selectPlayableSource(
            response.items.map(s => ({
              url: s.url,
              title: s.title || s.name || 'Unknown',
              quality: s.quality,
              kind: s.kind || 'unknown'
            })),
            deviceCapabilities
          );
          console.log('[PlayerPage] Selected playable source:', playableSource);
          
          if (playableSource) {
            setCurrentStream(playableSource);
            setSourceDetails(playableSource.title || playableSource.name || 'Unknown Source');
            
            // Load the source using existing media engine
            if (engineRef.current) {
              await engineRef.current.load(playableSource.url);
            }
          } else {
            setShowIncompatibleSheet(true);
          }
        } else {
          setError('No streams available for this content');
        }
      } catch (err) {
        console.error('Failed to load streams:', err);
        setError(err instanceof Error ? err.message : 'Failed to load streams');
      } finally {
        setLoading(false);
      }
    };

    loadStreams();
  }, [contentId, contentType, seasonNumber, episodeNumber]);

  // Load subtitles
  useEffect(() => {
    const loadSubtitles = async () => {
      if (!currentStream) return;

      try {
        console.log('[PlayerPage] ===== LOADING SUBTITLES FROM STREAM =====');
        
        // Check if stream has embedded subtitles
        if (currentStream.subtitles && currentStream.subtitles.length > 0) {
          console.log('[PlayerPage] Stream has embedded subtitles:', currentStream.subtitles);
          // Handle embedded subtitles
        } else {
          console.log('[PlayerPage] No stream subtitles, fetching from backend...');
          
          // Fetch subtitles from backend
          const subtitleResponse = await fetchSubtitlesWithCache(
            contentId,
            contentType,
            seasonNumber,
            episodeNumber
          );
          
          console.log('[PlayerPage] Subtitle response status:', subtitleResponse.status);
          console.log('[PlayerPage] Subtitle response data:', subtitleResponse.data);
          
          if (subtitleResponse.data && subtitleResponse.data.length > 0) {
            setSubtitles(subtitleResponse.data);
            console.log('[PlayerPage] Fetched', subtitleResponse.data.length, 'subtitles from backend');
            console.log('[PlayerPage] Subtitle details:', subtitleResponse.data);
          } else {
            console.log('[PlayerPage] ⚠️ No subtitles in response');
          }
        }
      } catch (err) {
        console.error('Failed to load subtitles:', err);
      }
    };

    loadSubtitles();
  }, [currentStream, contentId, contentType, seasonNumber, episodeNumber]);

  // Load user preferences
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('users')
            .select('preferred_subtitle_language')
            .eq('id', user.id)
            .single();
          
          if (data && data.preferred_subtitle_language) {
            setPreferredSubtitleLang(data.preferred_subtitle_language);
          }
        }
      } catch (err) {
        console.error('Failed to load user preferences:', err);
      }
    };

    loadUserPreferences();
  }, []);

  // Load progress
  useEffect(() => {
    const loadProgress = async () => {
      if (!contentId) return;

      try {
        const progress = getProgress(contentId, seasonNumber, episodeNumber);
        if (progress && progress.progress > 0.05) { // Only show if more than 5% watched
          setResumeTime(progress.progress * duration);
          setShowResumePrompt(true);
        }
      } catch (err) {
        console.error('Failed to load progress:', err);
      }
    };

    if (duration > 0) {
      loadProgress();
    }
  }, [contentId, seasonNumber, episodeNumber, duration]);

  // Save progress
  useEffect(() => {
    if (!contentId || duration <= 0) return;

    const saveProgressInterval = () => {
      const progress: WatchProgress = {
        id: contentId,
        progress: currentTime / duration,
        timestamp: Date.now(),
        seasonNumber,
        episodeNumber
      };
      saveProgress(progress);
    };

    progressIntervalRef.current = setInterval(saveProgressInterval, 10000); // Save every 10 seconds

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [contentId, currentTime, duration, seasonNumber, episodeNumber]);

  // Player control methods
  const handlePlay = useCallback(async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Failed to play:', err);
    }
  }, []);

  const handlePause = useCallback(async () => {
    try {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    } catch (err) {
      console.error('Failed to pause:', err);
    }
  }, []);

  const handleSeek = useCallback(async (seconds: number) => {
    try {
      if (videoRef.current) {
        videoRef.current.currentTime = seconds;
      }
    } catch (err) {
      console.error('Failed to seek:', err);
    }
  }, []);

  const handleVolumeChange = useCallback(async (vol: number) => {
    try {
      if (videoRef.current) {
        videoRef.current.volume = vol;
      }
    } catch (err) {
      console.error('Failed to set volume:', err);
    }
  }, []);

  const handleMuteToggle = useCallback(async () => {
    try {
      if (videoRef.current) {
        videoRef.current.muted = !muted;
      }
    } catch (err) {
      console.error('Failed to toggle mute:', err);
    }
  }, [muted]);

  const handleQualityChange = useCallback(async (quality: any) => {
    try {
      if (engineRef.current) {
        await setQuality(engineRef.current, quality);
      }
    } catch (err) {
      console.error('Failed to set quality:', err);
    }
  }, []);

  const handleAudioTrackChange = useCallback(async (trackId: string) => {
    try {
      if (engineRef.current) {
        await setAudioTrack(engineRef.current, trackId);
      }
    } catch (err) {
      console.error('Failed to set audio track:', err);
    }
  }, []);

  const handleTextTrackChange = useCallback(async (trackId?: string) => {
    try {
      // Handle text track changes
      console.log('Text track change:', trackId);
    } catch (err) {
      console.error('Failed to set text track:', err);
    }
  }, []);

  const handleAttachSubtitle = useCallback(async (url: string, format: 'vtt'|'ass'|'srt', lang?: string, label?: string) => {
    try {
      // Handle external subtitle attachment
      console.log('Attach subtitle:', url, format, lang, label);
    } catch (err) {
      console.error('Failed to attach subtitle:', err);
    }
  }, []);

  // UI control methods
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    hideControlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const handleResume = useCallback(() => {
    if (resumeTime) {
      handleSeek(resumeTime);
    }
    setShowResumePrompt(false);
  }, [resumeTime, handleSeek]);

  const handleStartFromBeginning = useCallback(() => {
    setShowResumePrompt(false);
  }, []);

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading streams...</p>
        </div>
      </div>
    );
  }

  if (error && !currentStream) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h2 className="text-2xl font-bold mb-2">Playback Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-screen bg-black overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        crossOrigin="anonymous"
        onClick={handleVideoClick}
      />

      {/* Loading Screen */}
      <PlayerLoadingScreen
        poster={poster}
        title={title}
        isBuffering={false}
        show={loading || (!currentStream && !error)}
      />

      {showIncompatibleSheet && (
        <IncompatibleSourceSheet
          onClose={() => setShowIncompatibleSheet(false)}
          onRetry={() => window.location.reload()}
        />
      )}

      {/* Resume prompt */}
      {showResumePrompt && resumeTime && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg text-white text-center max-w-md">
            <h3 className="text-xl font-bold mb-4">Resume Watching?</h3>
            <p className="mb-4">
              You were watching {title} at {Math.floor(resumeTime / 60)}:{(resumeTime % 60).toFixed(0).padStart(2, '0')}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleResume}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Resume
              </button>
              <button
                onClick={handleStartFromBeginning}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onBack}
        className={`absolute top-6 left-6 z-40 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-white/50 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ArrowLeft className="w-6 h-6" />
      </button>

      {currentStream && (
        <>
          <PlayerControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            buffered={buffered}
            isBuffering={false}
            volume={volume}
            isMuted={muted}
            currentQualityLabel={currentStream.quality || 'Unknown'}
            sourceDetails={sourceDetails}
            title={title}
            subtitle=""
            visible={showControls && !showSettings}
            onPlayPause={isPlaying ? handlePause : handlePlay}
            onSeek={handleSeek}
            onSkipBack={() => handleSeek(Math.max(0, currentTime - 10))}
            onSkipForward={() => handleSeek(Math.min(duration, currentTime + 10))}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            onFullscreen={() => {
              if (videoRef.current) {
                if (videoRef.current.requestFullscreen) {
                  videoRef.current.requestFullscreen();
                }
              }
            }}
            onOpenSettings={() => setShowSettings(true)}
          />

          <SettingsPanel
            visible={showSettings}
            currentStream={currentStream}
            allStreams={streams}
            availableQualities={qualities}
            currentQuality={currentQuality}
            playbackSpeed={1.0}
            subtitlesEnabled={false}
            currentSubtitle=""
            availableSubtitles={textTracks}
            availableAudioTracks={audioTracks}
            currentAudioTrack={currentAudioTrack?.id}
            onClose={() => setShowSettings(false)}
            onQualityChange={handleQualityChange}
            onStreamChange={() => {}}
            onSpeedChange={() => {}}
            onSubtitleChange={handleTextTrackChange}
            onAudioTrackChange={handleAudioTrackChange}
          />
        </>
      )}
    </div>
  );
}
