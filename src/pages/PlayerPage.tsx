import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useMediaEngine, getAvailableQualities, setQuality, getCurrentQuality, getAudioTracks, setAudioTrack, type AttachResult } from '../lib/useMediaEngine';
import type { NormalizedStream } from '../lib/player';
import { PlayerControls } from '../components/player/PlayerControls';
import { SettingsPanel } from '../components/player/SettingsPanel';
import { saveProgress, getProgress, shouldShowResumePrompt, WatchProgress } from '../lib/progress';
import { fetchStreams } from '../lib/api';
import { fetchSubtitles, type Subtitle } from '../lib/subtitles';
import { supabase } from '../lib/supabase';
import { getDeviceCapabilities } from '../lib/deviceCapabilities';
import { selectPlayableSource, type StreamWithClassification } from '../lib/streamClassifier';
import IncompatibleSourceSheet from '../components/player/IncompatibleSourceSheet';
import SourceSelector from '../components/player/SourceSelector';

type PlayerPageProps = {
  contentId: string;
  contentType: 'movie' | 'series' | 'anime';
  addonId?: string;
  title: string;
  poster?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  onBack: () => void;
};

export function PlayerPage({
  contentId,
  contentType,
  title,
  poster,
  seasonNumber,
  episodeNumber,
  onBack,
}: PlayerPageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { engineRef, attach, destroy } = useMediaEngine();
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<any>(null);

  const [streams, setStreams] = useState<NormalizedStream[]>([]);
  const [classifiedStreams, setClassifiedStreams] = useState<StreamWithClassification[]>([]);
  const [currentStream, setCurrentStream] = useState<NormalizedStream | null>(null);
  const [showIncompatibleSheet, setShowIncompatibleSheet] = useState(false);
  const [showSourceSelector, setShowSourceSelector] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [hasAudio, setHasAudio] = useState<boolean | null>(null);
  const [showAudioWarning, setShowAudioWarning] = useState(false);
  const [availableQualities, setAvailableQualities] = useState<(number | 'auto')[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number | 'auto' | null>(null);

  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeTime, setResumeTime] = useState(0);

  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState<string | undefined>();
  const [availableSubtitles, setAvailableSubtitles] = useState<Subtitle[]>([]);
  const [preferredSubtitleLang, setPreferredSubtitleLang] = useState<string>('en');

  const subtitle = seasonNumber && episodeNumber
    ? `S${seasonNumber} E${episodeNumber}`
    : undefined;

  useEffect(() => {
    loadUserPreferences();
    loadSubtitles();
  }, [contentId, seasonNumber, episodeNumber]);

  useEffect(() => {
    if (availableSubtitles.length > 0 && videoRef.current) {
      addSubtitleTracks();
    }
  }, [availableSubtitles, preferredSubtitleLang]);

  async function loadUserPreferences() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('users')
        .select('preferred_subtitle_language')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data?.preferred_subtitle_language) {
        setPreferredSubtitleLang(data.preferred_subtitle_language);
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error);
    }
  }

  async function loadSubtitles() {
    try {
      console.log('[PlayerPage] ===== FETCHING SUBTITLES START =====');
      console.log('[PlayerPage] Content ID:', contentId);
      const subs = await fetchSubtitles(contentId, seasonNumber, episodeNumber);
      console.log('[PlayerPage] ===== FETCHED', subs.length, 'SUBTITLES =====');
      console.log('[PlayerPage] All subtitle URLs:', subs.map(s => ({ lang: s.languageCode, url: s.url })));
      setAvailableSubtitles(subs);
      console.log('[PlayerPage] Loaded', subs.length, 'subtitle tracks');
      console.log('[PlayerPage] Sample fetched subtitle:', subs[0]);
    } catch (error) {
      console.error('Failed to load subtitles:', error);
    }
  }

  function addSubtitleTracks() {
    const video = videoRef.current;
    if (!video || availableSubtitles.length === 0) return;

    console.log('[PlayerPage] ★★★★★ ADDING SUBTITLES VERSION 2 ★★★★★');
    console.log('[PlayerPage] Adding', availableSubtitles.length, 'subtitle tracks');
    console.log('[PlayerPage] ALL subtitle URLs BEFORE conversion:', availableSubtitles.map(s => ({ lang: s.languageCode, url: s.url })));

    while (video.textTracks.length > 0) {
      const track = video.textTracks[0];
      const trackElement = Array.from(video.querySelectorAll('track')).find(
        el => el.track === track
      );
      if (trackElement) {
        video.removeChild(trackElement);
      }
    }

    availableSubtitles.forEach((sub) => {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = sub.label;
      track.srclang = sub.languageCode;
      track.src = sub.url;

      track.addEventListener('load', () => {
        console.log('[PlayerPage] Subtitle track loaded:', sub.languageCode, sub.url);
      });

      track.addEventListener('error', (e) => {
        console.error('[PlayerPage] Subtitle track error:', sub.languageCode, e);
      });

      if (sub.languageCode === preferredSubtitleLang) {
        track.default = true;
        console.log('[PlayerPage] Setting default subtitle track:', sub.languageCode, sub.url);
      }

      video.appendChild(track);
    });

    setTimeout(() => {
      console.log('[PlayerPage] TextTracks available:', video.textTracks.length);

      if (preferredSubtitleLang && video.textTracks.length > 0) {
        for (let i = 0; i < video.textTracks.length; i++) {
          const track = video.textTracks[i];
          console.log(`[PlayerPage] Track ${i}:`, {
            language: track.language,
            label: track.label,
            kind: track.kind,
            mode: track.mode,
            readyState: track.mode === 'showing' ? 'showing' : track.mode
          });

          if (track.language === preferredSubtitleLang) {
            track.mode = 'showing';
            setCurrentSubtitle(preferredSubtitleLang);
            setSubtitlesEnabled(true);
            console.log('[PlayerPage] Enabled subtitle track:', preferredSubtitleLang, 'mode:', track.mode);

            track.addEventListener('cuechange', () => {
              console.log('[PlayerPage] Cue changed, active cues:', track.activeCues?.length);
            });
          } else {
            track.mode = 'hidden';
          }
        }
      }
    }, 500);
  }

  const loadStreams = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[PlayerPage] Loading streams with:', {
        contentType,
        contentId,
        seasonNumber,
        episodeNumber
      });

      const response = await fetchStreams(contentType, contentId, seasonNumber, episodeNumber);

      console.log('[PlayerPage] Streams response:', response);

      if (!response.items || response.items.length === 0) {
        const errorMsg = response.error || response.message || 'No streams found. Check your add-ons.';
        console.error('[PlayerPage] No streams:', errorMsg);
        setError(errorMsg);
        return;
      }

      setStreams(response.items);

      console.log('[PlayerPage] Streams loaded:', response);

      const caps = await getDeviceCapabilities();
      console.log('[PlayerPage] Device capabilities:', caps);

      const playableSource = selectPlayableSource(
        response.items.map(s => ({
          url: s.url,
          title: s.title,
          quality: s.quality,
          kind: s.kind
        })),
        caps
      );

      const classified = response.items.map(s => ({
        url: s.url,
        title: s.title,
        quality: s.quality,
        kind: s.kind,
        classification: playableSource?.classification || { isPlayable: false, incompatibilityReasons: [], score: 0 }
      }));

      setClassifiedStreams(classified as StreamWithClassification[]);

      if (!playableSource) {
        console.warn('[PlayerPage] No compatible sources found!');
        setShowIncompatibleSheet(true);
        setLoading(false);
        return;
      }

      console.log('[PlayerPage] Selected playable source:', playableSource.title);

      const matchingStream = response.items.find(s => s.url === playableSource.url);
      if (matchingStream) {
        setCurrentStream(matchingStream);
      } else if (response.items.length > 0) {
        console.log('[PlayerPage] Fallback to first stream');
        setCurrentStream(response.items[0]);
      }
    } catch (err: any) {
      console.error('[PlayerPage] Failed to load streams:', err);
      setError(err.message || 'Failed to load streams');
    } finally {
      setLoading(false);
    }
  }, [contentId, contentType, seasonNumber, episodeNumber]);

  const initializePlayer = useCallback(async (stream: NormalizedStream, startTime?: number) => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    console.log('[PlayerPage] Initializing player with stream:', { url: stream.url, kind: stream.kind, quality: stream.quality });

    let streamUrl = stream.url;

    if (stream.kind === 'mp4' && !streamUrl.includes('/functions/v1/proxy-video')) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      streamUrl = `${supabaseUrl}/functions/v1/proxy-video?url=${encodeURIComponent(stream.url)}`;
      console.log('[PlayerPage] Proxying MP4 through:', streamUrl.substring(0, 150));
    }

    try {
      const engine = await attach(video, streamUrl, stream.kind, (error) => {
        console.error('Player error:', error);
        setError(`Playback error: ${error.message}. Trying fallback...`);

        setTimeout(() => {
          const nextStream = streams.find(s => s.url !== stream.url);
          if (nextStream) {
            initializePlayer(nextStream, video.currentTime);
          }
        }, 2000);
      });

      video.addEventListener('loadedmetadata', () => {
        const dur = video.duration;
        if (dur && isFinite(dur)) {
          setDuration(dur);
        }

        if (startTime && startTime > 0 && startTime < dur) {
          video.currentTime = startTime;
        }

        const qualities = getAvailableQualities(engine);
        if (qualities.length > 0) {
          setAvailableQualities(['auto', ...qualities]);
        } else {
          setAvailableQualities([]);
        }

        const current = getCurrentQuality(engine);
        setCurrentQuality(current);

        // Log all available video/audio info
        console.log('[PlayerPage] === METADATA LOADED ===');
        console.log('[PlayerPage] Duration:', dur);
        console.log('[PlayerPage] Video dimensions:', video.videoWidth, 'x', video.videoHeight);

        const audioTracks = video.audioTracks || (video as any).webkitAudioTracks;
        console.log('[PlayerPage] Audio tracks available:', audioTracks ? audioTracks.length : 'unknown');
        console.log('[PlayerPage] mozHasAudio:', (video as any).mozHasAudio);
        console.log('[PlayerPage] webkitAudioDecodedByteCount:', (video as any).webkitAudioDecodedByteCount);

        // Check if video element can play audio codecs
        console.log('[PlayerPage] Can play AAC:', video.canPlayType('audio/mp4; codecs="mp4a.40.2"'));
        console.log('[PlayerPage] Can play MP3:', video.canPlayType('audio/mpeg'));

        // Check video source
        console.log('[PlayerPage] Current src:', video.currentSrc ? video.currentSrc.substring(0, 150) : 'none');
        console.log('[PlayerPage] Network state:', video.networkState, 'Ready state:', video.readyState);

        addSubtitleTracks();
      });

      video.addEventListener('timeupdate', () => {
        setCurrentTime(video.currentTime);
        if (video.buffered.length > 0) {
          setBuffered(video.buffered.end(video.buffered.length - 1));
        }
      });

      video.addEventListener('play', () => {
        setIsPlaying(true);
        setIsBuffering(false);

        // Check audio info once playing starts
        setTimeout(() => {
          const audioTracks = video.audioTracks || (video as any).webkitAudioTracks;
          const audioDecodedBytes = (video as any).webkitAudioDecodedByteCount;
          const hasAudioTrack = audioTracks && audioTracks.length > 0;
          const hasDecodedAudio = audioDecodedBytes && audioDecodedBytes > 0;

          console.log('[PlayerPage] AFTER PLAY - Audio tracks:', audioTracks ? audioTracks.length : 'none');
          console.log('[PlayerPage] AFTER PLAY - Volume:', video.volume, 'Muted:', video.muted);
          console.log('[PlayerPage] AFTER PLAY - Audio decoded bytes:', audioDecodedBytes || 'unknown');

          if (hasAudioTrack || hasDecodedAudio) {
            setHasAudio(true);
            console.log('[PlayerPage] ✅ VIDEO HAS AUDIO');
          } else {
            setHasAudio(false);
            setShowAudioWarning(true);
            console.log('[PlayerPage] ❌ VIDEO HAS NO AUDIO TRACK');
            console.log('[PlayerPage] This file likely contains DTS/Atmos/AC3 audio which browsers cannot decode.');
            console.log('[PlayerPage] Try selecting a different quality/source with AAC or MP3 audio.');

            setTimeout(() => {
              setShowAudioWarning(false);
            }, 5000);
          }
        }, 2000);
      });

      video.addEventListener('pause', () => {
        setIsPlaying(false);
      });

      video.addEventListener('waiting', () => {
        setIsBuffering(true);
      });

      video.addEventListener('canplay', () => {
        setIsBuffering(false);
      });

      video.addEventListener('volumechange', () => {
        setVolume(video.volume);
        setIsMuted(video.muted);
      });

      video.addEventListener('ended', () => {
        setIsPlaying(false);
      });

      video.volume = 1;
      video.muted = false;
      console.log('[PlayerPage] Audio initialized - volume:', video.volume, 'muted:', video.muted);

      video.play().catch(e => {
        console.error('Autoplay failed:', e);
        video.muted = false;
        video.volume = 1;
        console.log('[PlayerPage] Audio reset after autoplay fail - volume:', video.volume, 'muted:', video.muted);
      });
    } catch (err: any) {
      console.error('Failed to initialize player:', err);
      setError(err.message || 'Failed to initialize player');
    }
  }, [streams, attach]);

  useEffect(() => {
    loadStreams();
  }, [loadStreams]);

  useEffect(() => {
    if (currentStream && videoRef.current) {
      const existingProgress = getProgress(contentId);
      if (shouldShowResumePrompt(existingProgress)) {
        setResumeTime(existingProgress!.currentTime);
        setShowResumePrompt(true);
      } else {
        initializePlayer(currentStream);
      }
    }
  }, [currentStream, contentId, initializePlayer]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('progress', handleProgress);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('progress', handleProgress);
    };
  }, []);

  useEffect(() => {
    if (duration > 0 && currentTime > 0) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      progressIntervalRef.current = setInterval(() => {
        const progress: WatchProgress = {
          id: contentId,
          type: contentType,
          title,
          poster,
          currentTime: videoRef.current?.currentTime || 0,
          duration,
          updatedAt: Date.now(),
          seasonNumber,
          episodeNumber,
        };
        saveProgress(progress);
      }, 5000);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [contentId, contentType, title, poster, duration, currentTime, seasonNumber, episodeNumber]);

  const resetHideControlsTimer = useCallback(() => {
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }

    setControlsVisible(true);

    hideControlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !settingsVisible) {
        setControlsVisible(false);
      }
    }, 3000);
  }, [isPlaying, settingsVisible]);

  useEffect(() => {
    const handleMouseMove = () => resetHideControlsTimer();
    const handleKeyDown = () => resetHideControlsTimer();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [resetHideControlsTimer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleSkipBack();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleSkipForward();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setControlsVisible(true);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSettingsVisible(true);
          break;
        case 'm':
        case 'M':
          handleMuteToggle();
          break;
        case 'f':
        case 'F':
          handleFullscreen();
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          if (settingsVisible) {
            setSettingsVisible(false);
          } else {
            handleExit();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsVisible]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.muted = false;
      videoRef.current.volume = 1;
      console.log('[PlayerPage] Play button clicked - volume:', videoRef.current.volume, 'muted:', videoRef.current.muted);
      videoRef.current.play().catch(e => {
        console.error('Play failed:', e);
      });
    }
  };

  const handleSeek = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
  };

  const handleSkipBack = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
  };

  const handleSkipForward = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
  };

  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    if (newVolume > 0) setIsMuted(false);
  };

  const handleMuteToggle = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  const handleQualityChange = (quality: number | 'auto') => {
    if (engineRef.current) {
      setQuality(engineRef.current, quality);
      setCurrentQuality(quality);
    }
  };

  const handleStreamChange = (stream: NormalizedStream) => {
    const currentTimeBackup = videoRef.current?.currentTime || 0;
    setCurrentStream(stream);
    setSettingsVisible(false);
    setTimeout(() => {
      initializePlayer(stream, currentTimeBackup);
    }, 100);
  };

  const handleSpeedChange = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const handleSubtitleChange = (lang?: string) => {
    console.log('[PlayerPage] handleSubtitleChange called with:', lang);
    setCurrentSubtitle(lang);
    setSubtitlesEnabled(!!lang);

    if (videoRef.current) {
      const tracks = videoRef.current.textTracks;
      console.log('[PlayerPage] Total tracks:', tracks.length);

      for (let i = 0; i < tracks.length; i++) {
        const shouldShow = tracks[i].language === lang;
        tracks[i].mode = shouldShow ? 'showing' : 'hidden';
        console.log(`[PlayerPage] Track ${i} (${tracks[i].language}): mode=${tracks[i].mode}, shouldShow=${shouldShow}`);
      }
    }
  };

  const handleExit = () => {
    destroy();
    onBack();
  };

  const handleResume = () => {
    setShowResumePrompt(false);
    if (currentStream) {
      initializePlayer(currentStream, resumeTime);
    }
  };

  const handleStartOver = () => {
    setShowResumePrompt(false);
    if (currentStream) {
      initializePlayer(currentStream);
    }
  };

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
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Playback Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={handleExit}
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
        onClick={handlePlayPause}
      />

      {showIncompatibleSheet && (
        <IncompatibleSourceSheet
          streams={classifiedStreams}
          onClose={handleExit}
        />
      )}

      {showAudioWarning && !showIncompatibleSheet && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-blue-600/90 text-white px-6 py-3 rounded-lg shadow-lg z-40 max-w-md text-center">
          <div className="text-sm">
            Your browser or device cannot handle this quality audio, a lower one is selected.
          </div>
        </div>
      )}

      {showResumePrompt && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-neutral-900 rounded-lg p-8 max-w-md">
            <h2 className="text-2xl font-bold mb-4">Resume Playback?</h2>
            <p className="text-gray-400 mb-6">
              Continue from {Math.floor(resumeTime / 60)}:{Math.floor(resumeTime % 60).toString().padStart(2, '0')}
            </p>
            <div className="flex gap-4">
              <button
                data-focusable="true"
                onClick={handleResume}
                className="flex-1 px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                Resume
              </button>
              <button
                data-focusable="true"
                onClick={handleStartOver}
                className="flex-1 px-6 py-3 bg-neutral-800 rounded-lg font-medium hover:bg-neutral-700 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        data-focusable="true"
        onClick={handleExit}
        className={`absolute top-6 left-6 z-40 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-white/50 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
            isBuffering={isBuffering}
            volume={volume}
            isMuted={isMuted}
            currentQualityLabel={currentStream.label}
            title={title}
            subtitle={subtitle}
            visible={controlsVisible && !settingsVisible}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onSkipBack={handleSkipBack}
            onSkipForward={handleSkipForward}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            onFullscreen={handleFullscreen}
            onOpenSettings={() => setSettingsVisible(true)}
          />

          <SettingsPanel
            visible={settingsVisible}
            currentStream={currentStream}
            allStreams={streams}
            availableQualities={availableQualities}
            currentQuality={currentQuality}
            playbackSpeed={playbackSpeed}
            subtitlesEnabled={subtitlesEnabled}
            currentSubtitle={currentSubtitle}
            availableSubtitles={availableSubtitles}
            onClose={() => setSettingsVisible(false)}
            onQualityChange={handleQualityChange}
            onStreamChange={handleStreamChange}
            onSpeedChange={handleSpeedChange}
            onSubtitleChange={handleSubtitleChange}
          />
        </>
      )}
    </div>
  );
}
