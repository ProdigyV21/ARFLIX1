import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useMediaEngine, getAvailableQualities, setQuality, getCurrentQuality, getAudioTracks, setAudioTrack } from '../lib/useMediaEngine';
import type { NormalizedStream } from '../lib/player';
import { PlayerControls } from '../components/player/PlayerControls';
import { SettingsPanel } from '../components/player/SettingsPanel';
import PlayerLoadingScreen from '../components/player/PlayerLoadingScreen';
import { saveProgress, getProgress, shouldShowResumePrompt, WatchProgress } from '../lib/progress';
import { fetchStreams } from '../lib/api';
import { type Subtitle } from '../lib/subtitles';
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

export function PlayerPage({
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
  // const wakeLockRef = useRef<any>(null);

  const [streams, setStreams] = useState<NormalizedStream[]>([]);
  const [classifiedStreams, setClassifiedStreams] = useState<StreamWithClassification[]>([]);
  const [currentStream, setCurrentStream] = useState<NormalizedStream | null>(null);
  const [showIncompatibleSheet, setShowIncompatibleSheet] = useState(false);
  // const [showSourceSelector, setShowSourceSelector] = useState(false);
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
  const [availableQualities, setAvailableQualities] = useState<(number | 'auto')[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number | 'auto' | null>(null);

  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeTime, setResumeTime] = useState(0);

  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState<string | undefined>(); // Store subtitle ID, not language
  const [availableSubtitles, setAvailableSubtitles] = useState<Subtitle[]>([]);
  const [preferredSubtitleLang, setPreferredSubtitleLang] = useState<string>('en');
  const [availableAudioTracks, setAvailableAudioTracks] = useState<Array<{ id: number; label: string; language: string }>>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number | undefined>();

  const subtitle = seasonNumber && episodeNumber
    ? `S${seasonNumber} E${episodeNumber}`
    : undefined;

  useEffect(() => {
    loadUserPreferences();
  }, [contentId, seasonNumber, episodeNumber]);

  useEffect(() => {
    if (currentStream) {
      loadSubtitles();
      if (engineRef.current) {
        const tracks = getAudioTracks(engineRef.current);
        setAvailableAudioTracks(tracks);
      }
    }
  }, [currentStream, contentId, seasonNumber, episodeNumber]);

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
      console.log('[PlayerPage] ===== LOADING SUBTITLES FROM STREAM =====');
      
      // Get subtitles from the current stream (embedded or external)
      if (currentStream?.captions && currentStream.captions.length > 0) {
        console.log('[PlayerPage] Found', currentStream.captions.length, 'subtitle tracks in stream');
        const streamSubs: Subtitle[] = currentStream.captions.map((cap, index) => ({
          id: `stream-${cap.lang}-${index}`,
          language: cap.lang.toUpperCase(),
          languageCode: cap.lang,
          label: cap.lang.toUpperCase(),
          url: cap.url,
          format: cap.mime === 'embedded' ? 'embedded' : 'vtt'
        }));
        setAvailableSubtitles(streamSubs);
        console.log('[PlayerPage] Loaded stream subtitles:', streamSubs);
        return;
      }

      // Fallback: Use OpenSubtitles Stremio addon directly (free, no API key!)
      console.log('[PlayerPage] No stream subtitles, trying OpenSubtitles v3 Stremio addon...');
      try {
        // Try OpenSubtitles v3 Stremio addon directly
        // This is a free public addon, no user auth needed!
        let subtitleId = contentId;
        
        // Format for series: imdbId:season:episode
        if (seasonNumber && episodeNumber) {
          // Need to resolve TMDB to IMDb
          if (contentId.startsWith('tmdb:')) {
            const tmdbId = contentId.replace('tmdb:', '').replace(/^(movie|tv):/, '');
            const tmdbApiKey = import.meta.env.VITE_TMDB_API_KEY || '080380c1ad7b3967af3def25159e4374';
            const tmdbUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${tmdbApiKey}`;
            
            console.log('[PlayerPage] Resolving TMDB to IMDb:', tmdbUrl);
            
            try {
              const tmdbResponse = await fetch(tmdbUrl);
              if (tmdbResponse.ok) {
                const externalIds = await tmdbResponse.json();
                if (externalIds.imdb_id) {
                  subtitleId = `${externalIds.imdb_id}:${seasonNumber}:${episodeNumber}`;
                  console.log('[PlayerPage] Resolved to:', subtitleId);
                }
              }
            } catch (e) {
              console.log('[PlayerPage] TMDB resolution failed:', e);
            }
          } else if (contentId.startsWith('tt')) {
            subtitleId = `${contentId}:${seasonNumber}:${episodeNumber}`;
          }
        }
        
        const openSubsUrl = `https://opensubtitles-v3.strem.io/subtitles/${seasonNumber ? 'series' : 'movie'}/${encodeURIComponent(subtitleId)}.json`;
        console.log('[PlayerPage] 🎬 Fetching from OpenSubtitles addon:', openSubsUrl);
        
        const response = await fetch(openSubsUrl, {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        
        console.log('[PlayerPage] OpenSubtitles addon response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[PlayerPage] OpenSubtitles addon response:', JSON.stringify(data).substring(0, 300));
          
          if (data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
            const mappedSubs: Subtitle[] = data.subtitles.map((sub: any, index: number) => ({
              id: sub.id || `opensub-${sub.lang}-${index}`,
              language: sub.lang?.toUpperCase() || 'EN',
              languageCode: sub.lang || 'en',
              label: `${sub.lang?.toUpperCase() || 'EN'} (OpenSubtitles)`,
              url: sub.url,
              format: sub.url.endsWith('.vtt') ? 'vtt' : 'srt'
            }));
            
            console.log('[PlayerPage] ✅ Found', mappedSubs.length, 'subtitles from OpenSubtitles addon!');
            console.log('[PlayerPage] Subtitle details:', mappedSubs.map(s => ({ id: s.id, label: s.label, url: s.url })));
            setAvailableSubtitles(mappedSubs);
            return;
          } else {
            console.log('[PlayerPage] ⚠️ OpenSubtitles addon returned no subtitles');
            console.log('[PlayerPage] Response structure:', Object.keys(data));
          }
        } else {
          console.log('[PlayerPage] ❌ OpenSubtitles addon fetch failed:', response.status);
          try {
            const errorText = await response.text();
            console.log('[PlayerPage] Error response:', errorText.substring(0, 200));
          } catch {}
        }
      } catch (error) {
        console.log('[PlayerPage] Subtitle fetch error:', error);
      }
    } catch (error) {
      console.error('Failed to load subtitles:', error);
    }
  }

  function detectEmbeddedSubtitles() {
    const video = videoRef.current;
    if (!video) return;

    console.log('[PlayerPage] === CHECKING FOR EMBEDDED SUBTITLES ===');

    // HLS.js provides text tracks
    if (engineRef.current && (engineRef.current as any).textTracks) {
      const hlsTracks = (engineRef.current as any).textTracks;
      console.log('[PlayerPage] HLS.js text tracks:', hlsTracks.length);
    }

    // Check video element text tracks (embedded in video file or from HLS manifest)
    setTimeout(() => {
      const tracks = video.textTracks;
      console.log('[PlayerPage] === DETAILED TEXT TRACK ANALYSIS ===');
      console.log('[PlayerPage] Total text tracks:', tracks.length);
      console.log('[PlayerPage] Video src:', video.src?.substring(0, 100));
      console.log('[PlayerPage] Video readyState:', video.readyState);
      console.log('[PlayerPage] Video duration:', video.duration);

      const embeddedSubs: typeof availableSubtitles = [];

      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        console.log(`[PlayerPage] Track ${i}:`, {
          kind: track.kind,
          label: track.label,
          language: track.language,
          mode: track.mode,
          cues: track.cues?.length,
          id: track.id
        });

        // ONLY add tracks that are ACTUALLY from the video file (not our added ones)
        // Our added tracks have labels like "English (Demo - OpenSubtitles unavailable)"
        const isOurAddedTrack = track.label?.includes('Demo') || track.label?.includes('OpenSubtitles');
        
        if (!isOurAddedTrack && (track.kind === 'subtitles' || track.kind === 'captions')) {
          const langCode = track.language || 'en';
          const trackLabel = track.label || `${langCode.toUpperCase()} (Embedded from video)`;
          
          embeddedSubs.push({
            id: `embedded-${i}`,
            language: trackLabel,
            languageCode: langCode,
            url: `embedded://${i}`, // Special URL to identify embedded tracks
            label: trackLabel,
            format: 'embedded'
          });
          
          console.log(`[PlayerPage] ✅ Found REAL embedded track: ${trackLabel}`);
          
          // Auto-enable it
          if (track.mode !== 'showing') {
            track.mode = 'showing';
            console.log(`[PlayerPage] 🎯 Auto-enabled embedded track: ${trackLabel}`);
          }
        } else if (isOurAddedTrack) {
          console.log(`[PlayerPage] ⏭️ Skipping our own added track: ${track.label}`);
        }
      }

      if (embeddedSubs.length > 0) {
        console.log('[PlayerPage] 🎉 Found', embeddedSubs.length, 'REAL embedded subtitle tracks from video file!');
        // Add embedded subtitles to the list (don't replace fetched ones)
        setAvailableSubtitles(prev => {
          const nonEmbedded = prev.filter(s => !s.url.startsWith('embedded://'));
          return [...embeddedSubs, ...nonEmbedded];
        });
      } else {
        console.log('[PlayerPage] ❌ This video file has NO embedded subtitle tracks');
        console.log('[PlayerPage] 💡 Container format:', currentStream?.url?.includes('.mkv') ? 'MKV' : currentStream?.url?.includes('.mp4') ? 'MP4' : 'Unknown');
        console.log('[PlayerPage] 💡 Note: Browsers may not expose all embedded tracks from MKV files');
        console.log('[PlayerPage] 💡 Try using external subtitle sources or check if the file actually contains subs');
      }
    }, 2000); // Increased delay to give more time for tracks to load
    
    // Also check again after 5 seconds in case tracks load slowly
    setTimeout(() => {
      const tracks = video.textTracks;
      if (tracks.length > 0) {
        console.log('[PlayerPage] 🔄 LATE CHECK: Found', tracks.length, 'text tracks after 5 seconds');
        detectEmbeddedSubtitles(); // Re-run detection
      }
    }, 5000);
  }

  function addSubtitleTracks() {
    const video = videoRef.current;
    if (!video || availableSubtitles.length === 0) return;

    console.log('[PlayerPage] ★★★★★ ADDING SUBTITLES VERSION 2 ★★★★★');
    console.log('[PlayerPage] Adding', availableSubtitles.length, 'subtitle tracks');
    console.log('[PlayerPage] ALL subtitle URLs BEFORE conversion:', availableSubtitles.map(s => ({ lang: s.languageCode, url: s.url })));

    // Remove only non-embedded tracks
    const trackElements = Array.from(video.querySelectorAll('track'));
    trackElements.forEach(trackEl => {
      if (trackEl.getAttribute('src')) { // Only remove tracks with external src
        video.removeChild(trackEl);
      }
    });

    // Add external subtitle tracks (skip embedded ones) - fetch and convert client-side
    availableSubtitles.forEach(async (sub, index) => {
      if (sub.format === 'embedded') return; // Skip embedded, they're already in the video

      try {
        console.log('[PlayerPage] 🔄 Fetching subtitle:', sub.label, sub.url);
        
        // Fetch the subtitle content
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
            .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'); // Replace comma with period in timestamps
        }
        
        // Create a Blob and data URL
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
          track.mode = 'showing';
          setCurrentSubtitle(trackId || track.language); // Store unique ID
          setSubtitlesEnabled(true);
          foundPreferred = true;
          console.log('[PlayerPage] ✅ Enabled FIRST subtitle track:', track.label, 'ID:', trackId);

          track.addEventListener('cuechange', () => {
            console.log('[PlayerPage] Cue changed, active cues:', track.activeCues?.length);
          });
        } else {
          track.mode = 'hidden';
        }
      }
      
      if (!foundPreferred) {
        console.log('[PlayerPage] No preferred subtitle found, all tracks hidden');
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

      // Enrich streams with additional info if available
      const enriched = response.items.map((s: any) => ({
        ...s,
        provider: s.provider || s.sourceName || s.host,
        qualityLabel: s.qualityLabel || (s.quality ? `${s.quality}p` : undefined),
        filesizeBytes: s.filesizeBytes || s.fileSizeBytes || s.sizeBytes,
        seeds: s.seeds ?? s.seeders,
        peers: s.peers,
        sourceType: s.sourceType || (s.infoHash ? 'torrent' : (s.url?.startsWith('http') ? 'http' : 'unknown')),
      }));

      setStreams(enriched);

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

      const classified = enriched.map((s: any) => ({
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

      const matchingStream = response.items.find((s: any) => s.url === playableSource.url);
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

    // Check if this is a Torrentio "downloading" placeholder
    if (stream.url.includes('torrentio.strem.fun') && stream.url.includes('/videos/downloading')) {
      console.log('[PlayerPage] Torrentio is caching torrent to Real-Debrid...');
      setError('⏳ Torrentio is caching this torrent to Real-Debrid. This may take 1-5 minutes for the first play. Please try again in a moment, or select a different source.');
      setLoading(false);
      return;
    }

    // Use the URL as-is from the backend
    // The backend already proxies Real-Debrid URLs if needed
    let streamUrl = stream.url;

    try {
      const engine = await attach(
        video,
        streamUrl,
        stream.kind,
        (error) => {
          console.error('Player error:', error);
          
          // Check if it's a downloading error
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
        
        // Autoplay the video once metadata is loaded
        if (!video.paused) {
          // Already playing
        } else {
          video.play().catch(e => {
            console.warn('[PlayerPage] Autoplay after metadata failed:', e);
            // Browser may block autoplay, user will need to click play button
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

        const audioTracks = (video as any).audioTracks || (video as any).webkitAudioTracks;
        console.log('[PlayerPage] Audio tracks available:', audioTracks ? audioTracks.length : 'unknown');
        console.log('[PlayerPage] mozHasAudio:', (video as any).mozHasAudio);
        console.log('[PlayerPage] webkitAudioDecodedByteCount:', (video as any).webkitAudioDecodedByteCount);

        // Check if video element can play audio codecs
        console.log('[PlayerPage] Can play AAC:', video.canPlayType('audio/mp4; codecs="mp4a.40.2"'));
        console.log('[PlayerPage] Can play MP3:', video.canPlayType('audio/mpeg'));

        // Check video source
        console.log('[PlayerPage] Current src:', video.currentSrc ? video.currentSrc.substring(0, 150) : 'none');
        console.log('[PlayerPage] Network state:', video.networkState, 'Ready state:', video.readyState);
        
        // Check if this is a Torrentio "downloading" placeholder video
        // These are typically exactly 30 seconds (give or take 1 second)
        // Real episodes/movies are always > 5 minutes
        if (dur > 0 && dur <= 120 && (contentType === 'series' || contentType === 'anime')) {
          // Check if it's suspiciously short for a TV episode (which are typically 20-60 minutes)
          if (dur < 300) { // Less than 5 minutes
            console.warn('[PlayerPage] ⚠️  Detected very short video (' + Math.round(dur) + 's) for TV show - likely uncached torrent');
            setError('⏳ This stream is not cached. Trying next stream...');
            
            // Auto-skip to next stream immediately
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

        // Check for embedded text tracks
        detectEmbeddedSubtitles();

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
          const audioTracks = (video as any).audioTracks || (video as any).webkitAudioTracks;
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
            // No visible warning; handled via stream classifier UI
            console.log('[PlayerPage] ❌ VIDEO HAS NO AUDIO TRACK');
            console.log('[PlayerPage] This file likely contains DTS/Atmos/AC3 audio which browsers cannot decode.');
            console.log('[PlayerPage] Try selecting a different quality/source with AAC or MP3 audio.');

            // no-op
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
          backdrop,
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
  }, [contentId, contentType, title, poster, backdrop, duration, currentTime, seasonNumber, episodeNumber]);

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

  const handleSubtitleChange = (subtitleId?: string) => {
    console.log('[PlayerPage] 🎬 handleSubtitleChange called with ID:', subtitleId);
    setCurrentSubtitle(subtitleId);
    setSubtitlesEnabled(!!subtitleId);

    if (videoRef.current) {
      const tracks = videoRef.current.textTracks;
      const trackElements = Array.from(videoRef.current.querySelectorAll('track'));
      console.log('[PlayerPage] Total tracks:', tracks.length);

      // Disable ALL tracks first
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = 'hidden';
      }

      // Enable ONLY the selected track
      if (subtitleId) {
        for (let i = 0; i < trackElements.length; i++) {
          const trackElement = trackElements[i] as HTMLTrackElement;
          const trackId = trackElement.id;
          
          if (trackId === subtitleId) {
            tracks[i].mode = 'showing';
            console.log(`[PlayerPage] ✅ Enabled subtitle: ${tracks[i].label} (ID: ${trackId})`);
            break;
          }
        }
      } else {
        console.log('[PlayerPage] Subtitles turned OFF');
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

  // Audio track change
  const handleAudioTrackChange = (trackId: string) => {
    if (!engineRef.current) return;
    const idNum = parseInt(trackId, 10);
    setAudioTrack(engineRef.current, idNum);
    setCurrentAudioTrack(idNum);
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

      {/* Loading Screen */}
      <PlayerLoadingScreen
        poster={poster}
        title={title}
        isBuffering={isBuffering}
        show={loading || (!currentStream && !error)}
      />

      {showIncompatibleSheet && (
        <IncompatibleSourceSheet
          streams={classifiedStreams}
          onClose={handleExit}
        />
      )}

      {/* Audio warning removed - handled silently by stream classifier */}

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
            availableAudioTracks={availableAudioTracks.map(t => ({ id: String(t.id), language: t.language, label: t.label }))}
            currentAudioTrack={currentAudioTrack !== undefined ? String(currentAudioTrack) : undefined}
            onClose={() => setSettingsVisible(false)}
            onQualityChange={handleQualityChange}
            onStreamChange={handleStreamChange}
            onSpeedChange={handleSpeedChange}
            onSubtitleChange={handleSubtitleChange}
            onAudioTrackChange={handleAudioTrackChange}
          />
        </>
      )}
    </div>
  );
}
