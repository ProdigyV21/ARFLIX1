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
  const [subtitleOffset, setSubtitleOffset] = useState<number>(0); // Auto-sync offset in seconds
  const [displayQuality, setDisplayQuality] = useState<string>(''); // Display quality (e.g., "4K", "1080p")
  const [episodeInfo, setEpisodeInfo] = useState<string>(''); // Episode number and title
  const [isAutoSyncing, setIsAutoSyncing] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Set episode info when component mounts or episode changes
  useEffect(() => {
    if (contentType === 'series' && seasonNumber && episodeNumber) {
      // We'll fetch episode title from TMDB API
      const fetchEpisodeTitle = async () => {
        try {
          const tmdbId = contentId.replace('tmdb:', '');
          const apiKey = import.meta.env.VITE_TMDB_API_KEY || '080380c1ad7b3967af3def25159e4374';
          const url = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${apiKey}`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            const episodeTitle = data.name || '';
            setEpisodeInfo(`S${seasonNumber}E${episodeNumber}${episodeTitle ? ` • ${episodeTitle}` : ''}`);
          } else {
            setEpisodeInfo(`S${seasonNumber}E${episodeNumber}`);
          }
        } catch (e) {
          setEpisodeInfo(`S${seasonNumber}E${episodeNumber}`);
        }
      };
      fetchEpisodeTitle();
    } else {
      setEpisodeInfo('');
    }
  }, [contentId, contentType, seasonNumber, episodeNumber]);
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
  const [overlayLines, setOverlayLines] = useState<string[]>([]);

  // Initialize player with stream
  const initializePlayer = useCallback(async (stream: NormalizedStream, startTime?: number) => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    console.log('[PlayerPage] Initializing player with stream:', { url: stream.url, kind: stream.kind, quality: stream.quality });

    // Check if this is a Torrentio "downloading" placeholder
    if (stream.url.includes('torrentio.strem.fun') && stream.url.includes('/videos/downloading')) {
      console.log('[PlayerPage] Torrentio is caching torrent to Real-Debrid...');
      setError('⏳ Torrentio is caching this torrent to Real-Debrid. This may take 1-5 minutes for the first play. Please try again in a moment, or select a different source.');
      setLoading(false);
      return;
    }

    let streamUrl = stream.url;

    try {
      const engine = await attach(
        video,
        streamUrl,
        stream.kind,
        (error) => {
          console.error('Player error:', error);
          
          if (error.message.includes('downloading') || error.message.includes('404')) {
            setError('⏳ Torrentio is still caching this content to Real-Debrid. Please wait 1-2 minutes and try again, or select a different source.');
          } else {
            setError(`Playback error: ${error.message}. Trying fallback...`);
          }

          setTimeout(() => {
            const nextStream = streams.find((s: any) => s.url !== stream.url);
            if (nextStream) {
              initializePlayer(nextStream, video.currentTime);
            }
          }, 2000);
        },
        () => {
          // onManifestParsed - wait for manifest before playing
          video.volume = 1;
          video.muted = false;
          video.play().catch(e => {
            console.warn('Autoplay failed:', e);
          });
        }
      );

      video.addEventListener('loadedmetadata', () => {
        const dur = video.duration;
        
        if (!video.paused) {
          // Already playing
        } else {
          video.play().catch(e => {
            console.warn('[PlayerPage] Autoplay after metadata failed:', e);
          });
        }
        
        if (dur && isFinite(dur)) {
          setDuration(dur);
        }

        if (startTime && startTime > 0 && startTime < dur) {
          video.currentTime = startTime;
        }

        const qualities = getAvailableQualities(engine);
        if (qualities.length > 0) {
          // expose available qualities
          setQualities(['auto', ...qualities]);

          // prefer highest quality on start
          const maxQuality = Math.max(...qualities);
          try {
            setQuality(engine, maxQuality);
            setCurrentQuality(maxQuality);
          } catch {
            // ignore if engine doesn't allow switching now
          }
        } else {
          setQualities([]);
          setCurrentQuality(getCurrentQuality(engine));
        }

        console.log('[PlayerPage] === METADATA LOADED ===');
        console.log('[PlayerPage] Duration:', dur);
        console.log('[PlayerPage] Video dimensions:', video.videoWidth, 'x', video.videoHeight);

        // Check if this is a Torrentio "downloading" placeholder video
        if (dur > 0 && dur <= 120 && (contentType === 'series' || contentType === 'anime')) {
          if (dur < 300) {
            console.warn('[PlayerPage] ⚠️  Detected very short video (' + Math.round(dur) + 's) for TV show - likely uncached torrent');
            setError('⏳ This stream is not cached. Trying next stream...');
            
            setTimeout(() => {
              const nextStream = streams.find((s: any) => s.url !== stream.url);
              if (nextStream) {
                console.log('[PlayerPage] Auto-skipping to next stream');
                initializePlayer(nextStream, 0);
              } else {
                setError('No cached streams found. Please try again later or use a different addon.');
                setLoading(false);
              }
            }, 2000);
            return;
          }
        }

        // ATTACH SUBTITLES HERE - after we confirmed this is a stable, full-duration video
        console.log('[PlayerPage] ✨ Final stream loaded successfully, loading & attaching subtitles...');
        setTimeout(async () => {
          try {
            // Fetch subtitles inline if not already loaded
            let subs = subtitles;
            if (subs.length === 0) {
              console.log('[PlayerPage] Fetching subtitles inline for final stream...');
              subs = await fetchSubtitlesWithCache(contentId, contentType, seasonNumber, episodeNumber);
              if (subs && subs.length > 0) {
                setSubtitles(subs);
                console.log('[PlayerPage] ✅ Fetched', subs.length, 'subtitles inline');
              }
            }
            if (subs && subs.length > 0) {
              addSubtitleTracks();
            } else {
              console.log('[PlayerPage] No subtitles available to attach');
            }
          } catch (e) {
            console.error('[PlayerPage] Error fetching subtitles:', e);
          }
        }, 500);

        // Detect audio tracks from media engine
        if (engineRef.current) {
          const tracks = getAudioTracks(engineRef.current);
          console.log('[PlayerPage] Audio tracks from engine:', tracks);
          setAudioTracks(tracks);
          if (tracks.length > 0 && currentAudioTrack === undefined) {
            const englishTrack = tracks.find((t: any) => t.language === 'en' || t.language === 'eng');
            const defaultTrack = englishTrack || tracks[0];
            setCurrentAudioTrack(defaultTrack);
            setAudioTrack(engineRef.current, defaultTrack.id);
            console.log('[PlayerPage] Auto-selected audio track:', defaultTrack);
          }
        }
      });

      setLoading(false);
    } catch (err: any) {
      console.error('Failed to initialize player:', err);
      setError(err.message || 'Failed to initialize player');
      setLoading(false);
    }
  }, [streams, attach, contentType, engineRef]);

  // Initialize player when stream is selected
  useEffect(() => {
    if (currentStream && videoRef.current) {
      const existingProgress = getProgress(contentId, seasonNumber, episodeNumber);
      if (shouldShowResumePrompt(existingProgress)) {
        setResumeTime(existingProgress!.currentTime);
        setShowResumePrompt(true);
      } else {
        initializePlayer(currentStream);
      }
    }
  }, [currentStream, contentId, seasonNumber, episodeNumber, initializePlayer]);

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

    // Force initial update
    if (video.duration) {
      setDuration(video.duration);
      setCurrentTime(video.currentTime);
    }

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('progress', handleProgress);
    };
  }, [currentStream]);

  // Load streams
  useEffect(() => {
    const loadStreams = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('[PlayerPage] Loading streams with:', { contentId, contentType, seasonNumber, episodeNumber });
        
        const response = await fetchStreams(contentType, contentId, seasonNumber, episodeNumber);
        console.log('[PlayerPage] Streams response:', response);
        
        if (!response.items || response.items.length === 0) {
          const errorMsg = response.error || response.message || 'No streams found. Check your add-ons.';
          console.error('[PlayerPage] No streams:', errorMsg);
          setError(errorMsg);
          setLoading(false);
          return;
        }
        
        // Enrich streams with additional info if available
        let enriched = response.items.map((s: any) => {
          // determine kind if missing
          let kind: 'hls' | 'dash' | 'mp4' | 'unknown' = s.kind || 'unknown';
          if (!kind && s.url) {
            const url = String(s.url).toLowerCase();
            if (url.includes('.m3u8') || url.includes('hls')) kind = 'hls';
            else if (url.includes('.mpd') || url.includes('dash')) kind = 'dash';
            else if (url.includes('.mp4')) kind = 'mp4';
          }

          // normalize filesize
          const sizeNumeric =
            s.filesizeBytes || s.fileSizeBytes || s.sizeBytes || s.bytes || s.fileBytes ||
            (typeof s.size === 'number' ? s.size : undefined);
          return {
            ...s,
            kind,
            provider: s.provider || s.sourceName || s.host,
            qualityLabel: s.qualityLabel || (s.quality ? `${s.quality}p` : undefined),
            filesizeBytes: sizeNumeric,
            seeds: s.seeds ?? s.seeders,
            peers: s.peers,
            sourceType: s.sourceType || (s.infoHash ? 'torrent' : (s.url?.startsWith('http') ? 'http' : 'unknown')),
          };
        });

        // Probe sizes via proxy HEAD for top candidates missing size
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const candidates = enriched.filter((s: any) => !s.filesizeBytes).slice(0, 12);
          const probed = await Promise.all(candidates.map(async (s: any) => {
            try {
              const headUrl = `${supabaseUrl}/functions/v1/proxy-video?url=${encodeURIComponent(s.url)}&head=1`;
              const resp = await fetch(headUrl, { method: 'GET' });
              const len = resp.headers.get('content-length');
              if (len) s.filesizeBytes = parseInt(len, 10);
            } catch {}
            return s;
          }));
          // merge back updated objects (same references updated already)
        } catch {}
        
        setStreams(enriched);
        
        const caps = await getDeviceCapabilities();
        console.log('[PlayerPage] Device capabilities:', caps);
        
        const playableSource = selectPlayableSource(
          enriched.map((s: any) => {
            // Determine kind from URL if not provided
            let kind: 'hls' | 'dash' | 'mp4' | 'unknown' = 'unknown';
            if (s.kind) {
              kind = s.kind;
            } else if (s.url) {
              const url = s.url.toLowerCase();
              if (url.includes('.m3u8') || url.includes('hls')) {
                kind = 'hls';
              } else if (url.includes('.mpd') || url.includes('dash')) {
                kind = 'dash';
              } else if (url.includes('.mp4')) {
                kind = 'mp4';
              }
            }
            
            return {
              url: s.url,
              title: s.title || 'Unknown',
              quality: s.quality,
              kind,
              sizeBytes: (s as any).filesizeBytes || (s as any).fileSizeBytes || (s as any).sizeBytes || (s as any).bytes || (s as any).size
            };
          }),
          caps
        );
        
        const classified = enriched.map((s: any) => {
          // Determine kind from URL if not provided
          let kind: 'hls' | 'dash' | 'mp4' | 'unknown' = 'unknown';
          if (s.kind) {
            kind = s.kind;
          } else if (s.url) {
            const url = s.url.toLowerCase();
            if (url.includes('.m3u8') || url.includes('hls')) {
              kind = 'hls';
            } else if (url.includes('.mpd') || url.includes('dash')) {
              kind = 'dash';
            } else if (url.includes('.mp4')) {
              kind = 'mp4';
            }
          }
          
          return {
            url: s.url,
            title: s.title,
            quality: s.quality,
            kind,
            classification: playableSource?.classification || { isPlayable: false, incompatibilityReasons: [], score: 0 }
          };
        });
        
        setClassifiedStreams(classified as StreamWithClassification[]);
        
        if (!playableSource) {
          console.warn('[PlayerPage] No compatible sources found!');
          setShowIncompatibleSheet(true);
          setLoading(false);
          return;
        }
        
        console.log('[PlayerPage] Selected playable source:', playableSource.title);
        
        const matchingStream = response.items.find((s: any) => s.url === playableSource.url);
        if (matchingStream) {
          setCurrentStream(matchingStream);
          
          // Build better source details
          const quality = matchingStream.quality || playableSource.classification?.quality || 'Unknown';
          const container = playableSource.classification?.container?.toUpperCase() || 'Unknown';
          const size = (matchingStream as any).filesizeBytes 
            ? `${((matchingStream as any).filesizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB`
            : '';
          const seeds = matchingStream.seeds ? `🌱 ${matchingStream.seeds}` : '';
          
          const details = [quality + 'p', container, size, seeds].filter(Boolean).join(' • ');
          setSourceDetails(details || 'Unknown Source');
          
          // Set display quality for top-right corner
          const qualityNum = typeof quality === 'number' ? quality : parseInt(String(quality)) || 0;
          if (qualityNum >= 2160) {
            setDisplayQuality('4K');
          } else if (qualityNum >= 1080) {
            setDisplayQuality('1080p');
          } else if (qualityNum >= 720) {
            setDisplayQuality('720p');
          } else if (qualityNum > 0) {
            setDisplayQuality(qualityNum + 'p');
          } else {
            setDisplayQuality('HD');
          }
        } else if (response.items.length > 0) {
          console.log('[PlayerPage] Fallback to first stream');
          setCurrentStream(response.items[0]);
          setSourceDetails('Unknown Source');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('[PlayerPage] Failed to load streams:', err);
        setError(err instanceof Error ? err.message : 'Failed to load streams');
        setLoading(false);
      }
    };

    loadStreams();
  }, [contentId, contentType, seasonNumber, episodeNumber]);

  // Auto-sync subtitles with audio analysis
  function autoSyncSubtitles() {
    const video = videoRef.current;
    if (!video || !video.textTracks || video.textTracks.length === 0) return;

    console.log('[PlayerPage] 🔄 Starting automatic subtitle sync...');
    setIsAutoSyncing(true);

    // Create audio context for speech detection
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
      
      const source = audioContextRef.current.createMediaElementSource(video);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyser.connect(audioContextRef.current.destination);
      analyserRef.current = analyser;
    }

    // Analyze audio volume peaks to detect speech
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const speechThreshold = 30; // Minimum volume to consider as speech
    const samples: { time: number; volume: number }[] = [];
    
    // Sample audio for 10 seconds to find speech pattern
    const sampleDuration = 10000; // 10 seconds
    const sampleInterval = 100; // Sample every 100ms
    let sampleCount = 0;
    const maxSamples = sampleDuration / sampleInterval;

    const samplingInterval = setInterval(() => {
      if (video.paused || sampleCount >= maxSamples) {
        clearInterval(samplingInterval);
        
        // Find speech peaks
        const speechPeaks = samples.filter(s => s.volume > speechThreshold);
        
        if (speechPeaks.length > 0) {
          // Get first speech moment
          const firstSpeech = speechPeaks[0].time;
          
          // Find first subtitle appearance time
          const activeTrack = Array.from(video.textTracks).find(t => t.mode === 'showing');
          if (activeTrack && activeTrack.cues && activeTrack.cues.length > 0) {
            const firstCue = activeTrack.cues[0] as VTTCue;
            const firstSubTime = firstCue.startTime;
            
            // Calculate offset: if subtitle appears before speech, delay it
            const calculatedOffset = firstSpeech - firstSubTime;
            
            // Only apply if offset is significant (> 0.5s)
            if (Math.abs(calculatedOffset) > 0.5) {
              setSubtitleOffset(calculatedOffset);
              console.log('[PlayerPage] ✅ Auto-sync complete! Applied offset:', calculatedOffset.toFixed(2), 'seconds');
              console.log('[PlayerPage] First speech at:', firstSpeech.toFixed(2), 's, First subtitle at:', firstSubTime.toFixed(2), 's');
            } else {
              console.log('[PlayerPage] ✅ Subtitles already in sync (offset < 0.5s)');
            }
          }
        } else {
          console.log('[PlayerPage] ⚠️ No speech detected in sample period');
        }
        
        setIsAutoSyncing(false);
        return;
      }

      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      samples.push({ time: video.currentTime, volume: average });
      sampleCount++;
    }, sampleInterval);
  }

  // Trigger auto-sync when subtitles are loaded and video starts playing
  useEffect(() => {
    const video = videoRef.current;
    if (!video || subtitles.length === 0) return;

    const handleCanPlay = () => {
      // Wait for video to actually start playing
      if (video.currentTime > 0.5 && !isAutoSyncing && subtitleOffset === 0) {
        // Start auto-sync after 2 seconds of playback
        setTimeout(() => {
          if (!video.paused && video.currentTime > 2) {
            autoSyncSubtitles();
          }
        }, 2000);
      }
    };

    video.addEventListener('playing', handleCanPlay);
    return () => video.removeEventListener('playing', handleCanPlay);
  }, [subtitles, isAutoSyncing, subtitleOffset]);

  // Continuously update subtitle overlay based on offset
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentTextTrack) return;

    const updateOverlay = () => {
      const activeTrack = Array.from(video.textTracks).find(t => t.mode === 'showing');
      if (!activeTrack || !activeTrack.cues) return;

      const currentVideoTime = video.currentTime;
      const adjustedTime = currentVideoTime - subtitleOffset;
      const cues = [] as string[];

      for (let i = 0; i < activeTrack.cues.length; i++) {
        const cue = activeTrack.cues[i] as VTTCue;
        if (cue && adjustedTime >= cue.startTime && adjustedTime <= cue.endTime) {
          if (cue.text) cues.push(cue.text);
        }
      }

      setOverlayLines(cues);
    };

    // Update overlay every 100ms while playing
    const interval = setInterval(updateOverlay, 100);
    return () => clearInterval(interval);
  }, [currentTextTrack, subtitleOffset]);

  // Add subtitle tracks to video element
  function addSubtitleTracks() {
    const video = videoRef.current;
    if (!video || subtitles.length === 0) return;

    console.log('[PlayerPage] ★★★★★ ADDING SUBTITLES ★★★★★');
    console.log('[PlayerPage] Adding', subtitles.length, 'subtitle tracks');

    // Remove only non-embedded tracks
    const trackElements = Array.from(video.querySelectorAll('track'));
    trackElements.forEach(trackEl => {
      if (trackEl.getAttribute('src')) {
        video.removeChild(trackEl);
      }
    });

    // Add external subtitle tracks
    subtitles.forEach(async (sub, index) => {
      if (sub.format === 'embedded') return;

      try {
        console.log('[PlayerPage] 🔄 Fetching subtitle:', sub.label, sub.url);
        
        const response = await fetch(sub.url);
        if (!response.ok) {
          console.error('[PlayerPage] Failed to fetch subtitle:', response.status);
          return;
        }
        
        let content = await response.text();
        console.log('[PlayerPage] ✅ Fetched subtitle, length:', content.length);
        
        // Convert SRT to WebVTT if needed
        if (!content.startsWith('WEBVTT')) {
          console.log('[PlayerPage] Converting SRT to WebVTT...');
          content = 'WEBVTT\n\n' + content
            .replace(/\r\n/g, '\n')
            .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        }
        
        const blob = new Blob([content], { type: 'text/vtt' });
        const dataUrl = URL.createObjectURL(blob);
        
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = sub.label;
        track.srclang = sub.languageCode;
        track.src = dataUrl;
        track.id = sub.id || `sub-${index}`;
        
        console.log('[PlayerPage] ✅ Created subtitle track:', sub.label);

        track.addEventListener('load', () => {
          console.log('[PlayerPage] 🎉 Subtitle track loaded successfully:', sub.label);
        });

        track.addEventListener('error', (e) => {
          console.error('[PlayerPage] ❌ Subtitle track load error:', sub.label, e);
        });

        video.appendChild(track);
      } catch (error) {
        console.error('[PlayerPage] Error processing subtitle:', sub.label, error);
      }
    });

    setTimeout(() => {
      console.log('[PlayerPage] TextTracks available:', video.textTracks.length);

      // Find the FIRST subtitle that matches preferred language and enable ONLY that one
      let foundPreferred = false;
      
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        const trackElement = Array.from(video.querySelectorAll('track'))[i] as HTMLTrackElement;
        const trackId = trackElement?.id;
        
        console.log(`[PlayerPage] Track ${i}:`, {
          id: trackId,
          language: track.language,
          label: track.label,
          kind: track.kind,
          mode: track.mode
        });

        // Enable ONLY the first subtitle that matches preferred language
        if (!foundPreferred && preferredSubtitleLang && track.language === preferredSubtitleLang) {
          // Set to 'showing' so cuechange events fire, but we'll hide native rendering with CSS
          track.mode = 'showing';
          setCurrentTextTrack(trackId || track.language);
          foundPreferred = true;
          console.log('[PlayerPage] ✅ Enabled FIRST subtitle track:', track.label, 'ID:', trackId);

          track.addEventListener('cuechange', () => {
            // Mirror to overlay with offset applied
            const video = videoRef.current;
            if (!video) return;
            
            // Get active cues considering the offset
            const currentVideoTime = video.currentTime;
            const adjustedTime = currentVideoTime - subtitleOffset; // Reverse offset for lookup
            
            const cues = [] as string[];
            
            if (track.cues) {
              for (let i = 0; i < track.cues.length; i++) {
                const cue = track.cues[i] as VTTCue;
                // Check if this cue should be active at the adjusted time
                if (cue && adjustedTime >= cue.startTime && adjustedTime <= cue.endTime) {
                  if (cue.text) cues.push(cue.text);
                }
              }
            }
            
            setOverlayLines(cues);
            if (cues.length > 0) {
              console.log('[PlayerPage] 🎬 Cue active (offset:', subtitleOffset.toFixed(2), 's):', cues[0].substring(0, 50));
            }
          });
        } else {
          track.mode = 'disabled';
        }
      }
      
      if (!foundPreferred) {
        console.log('[PlayerPage] No preferred subtitle found, all tracks hidden');
      }
    }, 500);
  }

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
          console.log('[PlayerPage] No stream subtitles, fetching from built-in addons...');
          
          // Fetch subtitles from built-in addons (OpenSubtitles v3 & Subscene)
          const fetchedSubtitles = await fetchSubtitlesWithCache(
            contentId,
            contentType,
            seasonNumber,
            episodeNumber
          );
          
          console.log('[PlayerPage] Fetched subtitles:', fetchedSubtitles);
          
          if (fetchedSubtitles && fetchedSubtitles.length > 0) {
            setSubtitles(fetchedSubtitles);
            console.log('[PlayerPage] ✅ Loaded', fetchedSubtitles.length, 'English subtitles');
            console.log('[PlayerPage] Subtitle details:', fetchedSubtitles);
          } else {
            console.log('[PlayerPage] ⚠️ No English subtitles available');
          }
        }
      } catch (err) {
        console.error('Failed to load subtitles:', err);
      }
    };

    loadSubtitles();
  }, [currentStream, contentId, contentType, seasonNumber, episodeNumber]);

  // NOTE: Subtitles are now attached directly in the loadedmetadata handler
  // after the final stream is confirmed to be stable (not a short uncached video)
  // This ensures subtitles are only added once to the correct video element

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
    if (!contentId || duration <= 0 || currentTime <= 0) return;

    const saveProgressInterval = () => {
      const progress: WatchProgress = {
        id: contentId,
        type: contentType,
        title,
        poster,
        backdrop,
        currentTime,
        duration,
        updatedAt: Date.now(),
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
  }, [contentId, contentType, title, poster, backdrop, currentTime, duration, seasonNumber, episodeNumber]);

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
    setShowResumePrompt(false);
    if (currentStream && resumeTime) {
      initializePlayer(currentStream, resumeTime);
    }
  }, [currentStream, resumeTime, initializePlayer]);

  const handleStartFromBeginning = useCallback(() => {
    setShowResumePrompt(false);
    if (currentStream) {
      initializePlayer(currentStream);
    }
  }, [currentStream, initializePlayer]);

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
    <div ref={containerRef} className="relative h-screen bg-black overflow-hidden player">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        crossOrigin="anonymous"
        onClick={() => {
          if (isPlaying) {
            handlePause();
          } else {
            handlePlay();
          }
        }}
      />

      {/* Fallback DOM overlay for subtitles (ensures position above controls) */}
      {overlayLines.length > 0 && (
        <div className="subs">
          {overlayLines.map((line, i) => (
            <div key={i} className="line">{line}</div>
          ))}
        </div>
      )}

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

      {/* Title and Episode Info Overlay - Top Left */}
      <div
        className={`absolute top-6 left-20 z-30 transition-opacity ${
          showControls && !showSettings ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <h2 className="text-white text-xl font-semibold drop-shadow-lg">{title}</h2>
        {episodeInfo && (
          <p className="text-white/80 text-sm mt-1 drop-shadow-lg">{episodeInfo}</p>
        )}
      </div>

      {/* Quality Display - Top Right */}
      {displayQuality && (
        <div
          className={`absolute top-6 right-6 z-30 px-3 py-1.5 bg-black/70 rounded text-white text-sm font-semibold transition-opacity ${
            showControls && !showSettings ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {displayQuality}
        </div>
      )}

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
            subtitlesEnabled={Boolean(currentTextTrack)}
            currentSubtitle={currentTextTrack as any}
            availableSubtitles={subtitles as any}
            availableAudioTracks={audioTracks}
            currentAudioTrack={currentAudioTrack?.id}
            onClose={() => setShowSettings(false)}
            onQualityChange={handleQualityChange}
            onStreamChange={() => {}}
            onSpeedChange={() => {}}
            onSubtitleChange={(trackId?: string) => {
              const video = videoRef.current;
              if (!video) return;
              // disable all
              for (let i = 0; i < video.textTracks.length; i++) {
                video.textTracks[i].mode = 'disabled';
              }
              if (!trackId) {
                setCurrentTextTrack(undefined);
                return;
              }
              // find matching element id
              const trackEls = Array.from(video.querySelectorAll('track')) as HTMLTrackElement[];
              const match = trackEls.find(t => t.id === trackId);
              if (match) {
                const index = trackEls.indexOf(match);
                const target = video.textTracks[index];
                if (target) {
                  target.mode = 'showing';
                  setCurrentTextTrack(trackId);
                }
              }
            }}
            onAudioTrackChange={handleAudioTrackChange}
          />
        </>
      )}
    </div>
  );
}
