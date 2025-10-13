/**
 * PlayerUI - Unified player interface using PlayerCore
 * Integrates with existing UI components while using the new player architecture
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PlayerCore, createPlayer, detectPlatform } from '../core/PlayerCore';
import { PlayerEvents, PlayerConfig, Source, Quality, AudioTrack, TextTrack } from '../core/types';

interface PlayerUIProps {
  source: Source;
  config?: PlayerConfig;
  onReady?: () => void;
  onError?: (error: any) => void;
  onTimeUpdate?: (current: number, duration: number) => void;
  onStateChange?: (playing: boolean) => void;
  onTracksLoaded?: (audio: AudioTrack[], text: TextTrack[], qualities: Quality[]) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const PlayerUI: React.FC<PlayerUIProps> = ({
  source,
  config = {},
  onReady,
  onError,
  onTimeUpdate,
  onStateChange,
  onTracksLoaded,
  className = '',
  style = {}
}) => {
  const playerRef = useRef<PlayerCore | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(config.volume || 1.0);
  const [muted, setMuted] = useState(config.muted || false);
  const [buffered, setBuffered] = useState(0);
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [textTracks, setTextTracks] = useState<TextTrack[]>([]);
  const [currentQuality, setCurrentQuality] = useState<Quality | undefined>();
  const [currentAudioTrack, setCurrentAudioTrack] = useState<AudioTrack | undefined>();
  const [currentTextTrack, setCurrentTextTrack] = useState<TextTrack | undefined>();
  const [error, setError] = useState<string | null>(null);

  // Initialize player
  useEffect(() => {
    const initializePlayer = async () => {
      try {
        const platform = detectPlatform();
        const player = createPlayer(platform, config);
        playerRef.current = player;

        // Set up event listeners
        const unsubscribe = player.on((event: PlayerEvents) => {
          handlePlayerEvent(event);
        });

        // Load source
        await player.load(source);

        return unsubscribe;
      } catch (err) {
        console.error('Failed to initialize player:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize player');
        onError?.(err);
      }
    };

    const unsubscribe = initializePlayer();

    return () => {
      unsubscribe.then(unsub => unsub?.());
      playerRef.current?.destroy();
    };
  }, []);

  const handlePlayerEvent = useCallback((event: PlayerEvents) => {
    switch (event.type) {
      case 'ready':
        setIsReady(true);
        onReady?.();
        break;
      
      case 'error':
        setError(event.error?.message || 'Unknown error');
        onError?.(event.error);
        break;
      
      case 'time':
        setCurrentTime(event.current);
        setDuration(event.duration);
        onTimeUpdate?.(event.current, event.duration);
        break;
      
      case 'buffer':
        setBuffered(event.percent);
        break;
      
      case 'stateChanged':
        setIsPlaying(event.state.playing);
        setVolume(event.state.volume);
        setMuted(event.state.muted);
        onStateChange?.(event.state.playing);
        break;
      
      case 'tracks':
        setAudioTracks(event.audio);
        setTextTracks(event.text);
        setQualities(event.qualities);
        onTracksLoaded?.(event.audio, event.text, event.qualities);
        break;
      
      case 'qualityChanged':
        setCurrentQuality(event.quality);
        break;
      
      case 'audioChanged':
        setCurrentAudioTrack(event.audio);
        break;
      
      case 'textChanged':
        setCurrentTextTrack(event.text);
        break;
      
      case 'ended':
        setIsPlaying(false);
        onStateChange?.(false);
        break;
    }
  }, [onReady, onError, onTimeUpdate, onStateChange, onTracksLoaded]);

  // Player control methods
  const play = useCallback(async () => {
    try {
      await playerRef.current?.play();
    } catch (err) {
      console.error('Failed to play:', err);
    }
  }, []);

  const pause = useCallback(async () => {
    try {
      await playerRef.current?.pause();
    } catch (err) {
      console.error('Failed to pause:', err);
    }
  }, []);

  const seek = useCallback(async (seconds: number) => {
    try {
      await playerRef.current?.seek(seconds);
    } catch (err) {
      console.error('Failed to seek:', err);
    }
  }, []);

  const setVolumeLevel = useCallback(async (vol: number) => {
    try {
      await playerRef.current?.setVolume(vol);
    } catch (err) {
      console.error('Failed to set volume:', err);
    }
  }, []);

  const setMutedState = useCallback(async (mute: boolean) => {
    try {
      await playerRef.current?.setMuted(mute);
    } catch (err) {
      console.error('Failed to set muted:', err);
    }
  }, []);

  const setQualityLevel = useCallback(async (quality: Quality) => {
    try {
      await playerRef.current?.setQuality(quality);
    } catch (err) {
      console.error('Failed to set quality:', err);
    }
  }, []);

  const setQualityMax = useCallback(async () => {
    try {
      await playerRef.current?.setQualityMax();
    } catch (err) {
      console.error('Failed to set max quality:', err);
    }
  }, []);

  const setAudioTrackId = useCallback(async (trackId: string) => {
    try {
      await playerRef.current?.setAudio(trackId);
    } catch (err) {
      console.error('Failed to set audio track:', err);
    }
  }, []);

  const setTextTrackId = useCallback(async (trackId?: string) => {
    try {
      await playerRef.current?.setText(trackId);
    } catch (err) {
      console.error('Failed to set text track:', err);
    }
  }, []);

  const attachSubtitle = useCallback(async (url: string, format: 'vtt'|'ass'|'srt', lang?: string, label?: string) => {
    try {
      await playerRef.current?.attachExternalSubtitle(url, format, lang, label);
    } catch (err) {
      console.error('Failed to attach subtitle:', err);
    }
  }, []);

  // Expose player methods for external use
  const playerMethods = {
    play,
    pause,
    seek,
    setVolume: setVolumeLevel,
    setMuted: setMutedState,
    setQuality: setQualityLevel,
    setQualityMax,
    setAudioTrack: setAudioTrackId,
    setTextTrack: setTextTrackId,
    attachSubtitle,
    getState: () => playerRef.current?.getState(),
    getConfig: () => playerRef.current?.getConfig(),
    updateConfig: (newConfig: Partial<PlayerConfig>) => playerRef.current?.updateConfig(newConfig)
  };

  // Render error state
  if (error) {
    return (
      <div className={`player-error ${className}`} style={style}>
        <div className="error-message">
          <h3>Playback Error</h3>
          <p>{error}</p>
          <button onClick={() => setError(null)}>Retry</button>
        </div>
      </div>
    );
  }

  // Render loading state
  if (!isReady) {
    return (
      <div className={`player-loading ${className}`} style={style}>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading player...</p>
        </div>
      </div>
    );
  }

  // Render player interface
  return (
    <div className={`player-container ${className}`} style={style}>
      <div className="player-video-container">
        {/* Video element will be injected by the platform-specific player */}
        <div className="player-video-placeholder">
          <p>Video player initialized</p>
        </div>
      </div>
      
      <div className="player-controls">
        <div className="player-controls-top">
          <div className="player-info">
            <span className="player-title">{source.provider || 'Unknown Source'}</span>
            {currentQuality && (
              <span className="player-quality">{currentQuality.label}</span>
            )}
          </div>
        </div>
        
        <div className="player-controls-center">
          <button 
            className="player-play-button"
            onClick={isPlaying ? pause : play}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
        </div>
        
        <div className="player-controls-bottom">
          <div className="player-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
              <div 
                className="buffer-fill" 
                style={{ width: `${buffered}%` }}
              />
            </div>
            <div className="time-display">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          
          <div className="player-controls-right">
            <button 
              className="volume-button"
              onClick={() => setMutedState(!muted)}
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={muted ? 0 : volume}
              onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
              className="volume-slider"
            />
          </div>
        </div>
      </div>
      
      {/* Quality selector */}
      {qualities.length > 1 && (
        <div className="quality-selector">
          <select 
            value={currentQuality?.height || ''} 
            onChange={(e) => {
              const quality = qualities.find(q => q.height?.toString() === e.target.value);
              if (quality) setQualityLevel(quality);
            }}
          >
            <option value="">Auto</option>
            {qualities.map((quality, index) => (
              <option key={index} value={quality.height}>
                {quality.label}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* Audio track selector */}
      {audioTracks.length > 1 && (
        <div className="audio-track-selector">
          <select 
            value={currentAudioTrack?.id || ''} 
            onChange={(e) => setAudioTrackId(e.target.value)}
          >
            {audioTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.label}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* Text track selector */}
      {textTracks.length > 0 && (
        <div className="text-track-selector">
          <select 
            value={currentTextTrack?.id || ''} 
            onChange={(e) => setTextTrackId(e.target.value || undefined)}
          >
            <option value="">Off</option>
            {textTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

// Utility function to format time
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Export player methods for external use
export type PlayerMethods = ReturnType<typeof PlayerUI>['props']['playerMethods'];

// Hook for using player methods
export const usePlayer = (playerRef: React.RefObject<PlayerCore>) => {
  const [playerMethods, setPlayerMethods] = useState<PlayerMethods | null>(null);

  useEffect(() => {
    if (playerRef.current) {
      // This would be populated by the PlayerUI component
      // For now, we'll create a basic interface
      const methods: PlayerMethods = {
        play: () => playerRef.current?.play(),
        pause: () => playerRef.current?.pause(),
        seek: (seconds: number) => playerRef.current?.seek(seconds),
        setVolume: (vol: number) => playerRef.current?.setVolume(vol),
        setMuted: (muted: boolean) => playerRef.current?.setMuted(muted),
        setQuality: (quality: Quality) => playerRef.current?.setQuality(quality),
        setQualityMax: () => playerRef.current?.setQualityMax(),
        setAudioTrack: (trackId: string) => playerRef.current?.setAudio(trackId),
        setTextTrack: (trackId?: string) => playerRef.current?.setText(trackId),
        attachSubtitle: (url: string, format: 'vtt'|'ass'|'srt', lang?: string, label?: string) => 
          playerRef.current?.attachExternalSubtitle(url, format, lang, label),
        getState: () => playerRef.current?.getState(),
        getConfig: () => playerRef.current?.getConfig(),
        updateConfig: (newConfig: Partial<PlayerConfig>) => playerRef.current?.updateConfig(newConfig)
      };
      setPlayerMethods(methods);
    }
  }, [playerRef.current]);

  return playerMethods;
};
