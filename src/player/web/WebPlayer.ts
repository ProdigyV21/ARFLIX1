/**
 * WebPlayer - Web platform implementation using Shaka Player + hls.js fallback
 * Handles DASH/HLS streams with subtitle overlay and ASS rendering
 */

import { PlayerEngine, PlayerEvents, PlayerConfig, Source, Quality, AudioTrack, TextTrack, PlayerState } from '../core/types';

export class WebPlayer implements PlayerEngine {
  private video: HTMLVideoElement;
  private shakaPlayer?: any;
  private hlsPlayer?: any;
  private currentEngine: 'shaka' | 'hls' | 'native' = 'native';
  private config: PlayerConfig;
  private listeners: Set<(e: PlayerEvents) => void> = new Set();
  private state: PlayerState;
  private subtitleOverlay?: any;
  private assRenderer?: any;
  private externalSubtitles: Map<string, TextTrack> = new Map();

  constructor(config: PlayerConfig) {
    this.config = config;
    this.state = {
      playing: false,
      currentTime: 0,
      duration: 0,
      volume: config.volume || 1.0,
      muted: config.muted || false,
      buffered: 0
    };

    this.video = this.createVideoElement();
    this.setupVideoEvents();
    this.initializeEngines();
  }

  private createVideoElement(): HTMLVideoElement {
    const video = document.createElement('video');
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    video.controls = false;
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    return video;
  }

  private async initializeEngines(): Promise<void> {
    try {
      // Try to load Shaka Player
      const shaka = await import('shaka-player');
      this.shakaPlayer = new shaka.Player(this.video);
      this.setupShakaPlayer();
      this.currentEngine = 'shaka';
    } catch (error) {
      console.warn('Shaka Player not available, falling back to hls.js');
      try {
        // Try to load hls.js
        const Hls = await import('hls.js');
        this.hlsPlayer = new Hls.default({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 30
        });
        this.setupHlsPlayer();
        this.currentEngine = 'hls';
      } catch (error) {
        console.warn('hls.js not available, using native playback');
        this.currentEngine = 'native';
      }
    }

    // Initialize subtitle systems
    this.initializeSubtitleSystems();
  }

  private setupShakaPlayer(): void {
    if (!this.shakaPlayer) return;

    this.shakaPlayer.configure({
      streaming: {
        bufferingGoal: this.config.maxBufferLength || 30,
        rebufferingGoal: 2,
        bufferBehind: 30,
        useNativeHlsOnSafari: true,
        forceHTTPS: false
      },
      abr: {
        enabled: this.config.enableABR !== false,
        useNetworkInformation: true
      }
    });

    this.shakaPlayer.addEventListener('error', (event: any) => {
      this.emit({ type: 'error', error: event.detail });
    });

    this.shakaPlayer.addEventListener('adaptation', () => {
      const tracks = this.shakaPlayer.getVariantTracks();
      const current = this.shakaPlayer.getStats().getCurrentVariant();
      if (current) {
        this.state.quality = this.mapShakaQuality(current);
        this.emit({ type: 'qualityChanged', quality: this.state.quality });
      }
    });
  }

  private setupHlsPlayer(): void {
    if (!this.hlsPlayer) return;

    this.hlsPlayer.on(Hls.Events.ERROR, (event: any, data: any) => {
      if (data.fatal) {
        this.emit({ type: 'error', error: data });
      }
    });

    this.hlsPlayer.on(Hls.Events.LEVEL_SWITCHED, (event: any, data: any) => {
      const level = this.hlsPlayer.levels[data.level];
      if (level) {
        this.state.quality = this.mapHlsQuality(level);
        this.emit({ type: 'qualityChanged', quality: this.state.quality });
      }
    });
  }

  private setupVideoEvents(): void {
    this.video.addEventListener('loadstart', () => this.emit({ type: 'loadstart' }));
    this.video.addEventListener('canplay', () => this.emit({ type: 'canplay' }));
    this.video.addEventListener('ended', () => this.emit({ type: 'ended' }));
    this.video.addEventListener('seeking', () => this.emit({ type: 'seeking' }));
    this.video.addEventListener('seeked', () => this.emit({ type: 'seeked' }));

    this.video.addEventListener('timeupdate', () => {
      this.state.currentTime = this.video.currentTime;
      this.state.duration = this.video.duration;
      this.emit({ type: 'time', current: this.state.currentTime, duration: this.state.duration });
    });

    this.video.addEventListener('progress', () => {
      if (this.video.buffered.length > 0) {
        const buffered = this.video.buffered.end(this.video.buffered.length - 1);
        this.state.buffered = (buffered / this.video.duration) * 100;
        this.emit({ type: 'buffer', percent: this.state.buffered });
      }
    });

    this.video.addEventListener('play', () => {
      this.state.playing = true;
      this.emit({ type: 'stateChanged', state: this.state });
    });

    this.video.addEventListener('pause', () => {
      this.state.playing = false;
      this.emit({ type: 'stateChanged', state: this.state });
    });

    this.video.addEventListener('volumechange', () => {
      this.state.volume = this.video.volume;
      this.state.muted = this.video.muted;
      this.emit({ type: 'stateChanged', state: this.state });
    });
  }

  private initializeSubtitleSystems(): void {
    // Initialize VTT overlay
    this.subtitleOverlay = new (require('./engines/subs/vttOverlay').VttOverlay)(this.video);
    
    // Initialize ASS renderer (will be loaded on demand)
    this.loadAssRenderer();
  }

  private async loadAssRenderer(): Promise<void> {
    try {
      const { AssRenderer } = await import('./engines/subs/assRenderer');
      this.assRenderer = new AssRenderer(this.video);
    } catch (error) {
      console.warn('ASS renderer not available:', error);
    }
  }

  // Core playback methods
  async load(src: Source): Promise<void> {
    this.video.src = src.url;
    
    if (src.headers) {
      // Set custom headers if supported
      Object.entries(src.headers).forEach(([key, value]) => {
        this.video.setAttribute(`data-${key}`, value);
      });
    }

    if (this.currentEngine === 'shaka' && this.shakaPlayer) {
      await this.shakaPlayer.load(src.url);
    } else if (this.currentEngine === 'hls' && this.hlsPlayer) {
      this.hlsPlayer.loadSource(src.url);
    }

    // Load external subtitles if any
    if (src.type === 'hls' || src.type === 'dash') {
      await this.loadEmbeddedTracks();
    }

    this.emit({ type: 'ready' });
  }

  async play(): Promise<void> {
    await this.video.play();
  }

  async pause(): Promise<void> {
    this.video.pause();
  }

  async seek(seconds: number): Promise<void> {
    this.video.currentTime = seconds;
  }

  async setVolume(vol: number): Promise<void> {
    this.video.volume = vol;
  }

  async setMuted(muted: boolean): Promise<void> {
    this.video.muted = muted;
  }

  // Quality management
  async listQualities(): Promise<Quality[]> {
    if (this.currentEngine === 'shaka' && this.shakaPlayer) {
      const tracks = this.shakaPlayer.getVariantTracks();
      return tracks.map((track: any) => this.mapShakaQuality(track));
    } else if (this.currentEngine === 'hls' && this.hlsPlayer) {
      return this.hlsPlayer.levels.map((level: any) => this.mapHlsQuality(level));
    }
    return [];
  }

  async setQualityMax(): Promise<void> {
    if (this.currentEngine === 'shaka' && this.shakaPlayer) {
      const tracks = this.shakaPlayer.getVariantTracks();
      const highest = tracks.reduce((max: any, track: any) => 
        (track.height || 0) > (max.height || 0) ? track : max, tracks[0]);
      if (highest) {
        this.shakaPlayer.selectVariantTrack(highest, true);
      }
    } else if (this.currentEngine === 'hls' && this.hlsPlayer) {
      const levels = this.hlsPlayer.levels;
      const highest = levels.reduce((max: any, level: any) => 
        (level.height || 0) > (max.height || 0) ? level : max, levels[0]);
      if (highest) {
        this.hlsPlayer.currentLevel = highest.level;
      }
    }
  }

  async setQuality(q: Quality): Promise<void> {
    if (this.currentEngine === 'shaka' && this.shakaPlayer) {
      const tracks = this.shakaPlayer.getVariantTracks();
      const track = tracks.find((t: any) => t.height === q.height);
      if (track) {
        this.shakaPlayer.selectVariantTrack(track, true);
      }
    } else if (this.currentEngine === 'hls' && this.hlsPlayer) {
      const level = this.hlsPlayer.levels.find((l: any) => l.height === q.height);
      if (level) {
        this.hlsPlayer.currentLevel = level.level;
      }
    }
  }

  // Audio track management
  async listAudio(): Promise<AudioTrack[]> {
    const tracks: AudioTrack[] = [];
    
    if (this.currentEngine === 'shaka' && this.shakaPlayer) {
      const shakaTracks = this.shakaPlayer.getVariantTracks();
      const audioTracks = new Map();
      
      shakaTracks.forEach((track: any) => {
        if (track.audioId && !audioTracks.has(track.audioId)) {
          audioTracks.set(track.audioId, {
            id: track.audioId,
            lang: track.language,
            channels: track.channelsCount,
            codec: track.codecs,
            label: track.label || `${track.language} (${track.channelsCount}ch)`,
            embedded: true
          });
        }
      });
      
      tracks.push(...Array.from(audioTracks.values()));
    } else if (this.currentEngine === 'hls' && this.hlsPlayer) {
      const audioTracks = this.hlsPlayer.audioTracks;
      audioTracks.forEach((track: any, index: number) => {
        tracks.push({
          id: `audio-${index}`,
          lang: track.lang,
          label: track.name || track.lang,
          embedded: true
        });
      });
    }

    // Add native audio tracks
    for (let i = 0; i < this.video.audioTracks.length; i++) {
      const track = this.video.audioTracks[i];
      tracks.push({
        id: `native-audio-${i}`,
        lang: track.language,
        label: track.label || track.language,
        embedded: true
      });
    }

    return tracks;
  }

  async setAudio(trackId: string): Promise<void> {
    if (this.currentEngine === 'shaka' && this.shakaPlayer) {
      const tracks = this.shakaPlayer.getVariantTracks();
      const track = tracks.find((t: any) => t.audioId === trackId);
      if (track) {
        this.shakaPlayer.selectVariantTrack(track, true);
      }
    } else if (this.currentEngine === 'hls' && this.hlsPlayer) {
      const audioTracks = this.hlsPlayer.audioTracks;
      const index = audioTracks.findIndex((t: any) => `audio-${audioTracks.indexOf(t)}` === trackId);
      if (index >= 0) {
        this.hlsPlayer.audioTrack = index;
      }
    }
  }

  // Text track management
  async listText(): Promise<TextTrack[]> {
    const tracks: TextTrack[] = [];

    // Add embedded tracks
    for (let i = 0; i < this.video.textTracks.length; i++) {
      const track = this.video.textTracks[i];
      if (track.kind === 'subtitles' || track.kind === 'captions') {
        tracks.push({
          id: `native-text-${i}`,
          lang: track.language,
          kind: track.kind as any,
          format: 'vtt',
          label: track.label || track.language,
          embedded: true
        });
      }
    }

    // Add external tracks
    tracks.push(...Array.from(this.externalSubtitles.values()));

    return tracks;
  }

  async setText(trackId?: string): Promise<void> {
    // Disable all tracks first
    for (let i = 0; i < this.video.textTracks.length; i++) {
      this.video.textTracks[i].mode = 'hidden';
    }

    if (trackId) {
      if (trackId.startsWith('native-text-')) {
        const index = parseInt(trackId.replace('native-text-', ''));
        if (this.video.textTracks[index]) {
          this.video.textTracks[index].mode = 'showing';
        }
      } else if (this.externalSubtitles.has(trackId)) {
        const track = this.externalSubtitles.get(trackId)!;
        if (track.format === 'vtt') {
          this.subtitleOverlay?.loadTrack(track);
        } else if (track.format === 'ass' && this.assRenderer) {
          this.assRenderer?.loadTrack(track);
        }
      }
    }
  }

  async attachExternalSubtitle(url: string, format: 'vtt'|'ass'|'srt', lang?: string, label?: string): Promise<void> {
    const trackId = `external-${Date.now()}`;
    const track: TextTrack = {
      id: trackId,
      lang: lang || 'unknown',
      format,
      label: label || lang || 'External',
      embedded: false
    };

    this.externalSubtitles.set(trackId, track);

    if (format === 'vtt') {
      await this.subtitleOverlay?.loadFromUrl(url, track);
    } else if (format === 'ass' && this.assRenderer) {
      await this.assRenderer?.loadFromUrl(url, track);
    }

    this.emit({ type: 'tracks', audio: await this.listAudio(), text: await this.listText(), qualities: await this.listQualities() });
  }

  // Event system
  on(listener: (e: PlayerEvents) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  off(listener: (e: PlayerEvents) => void): void {
    this.listeners.delete(listener);
  }

  emit(event: PlayerEvents): void {
    this.listeners.forEach(listener => listener(event));
  }

  // Lifecycle
  async destroy(): Promise<void> {
    if (this.shakaPlayer) {
      await this.shakaPlayer.destroy();
    }
    if (this.hlsPlayer) {
      this.hlsPlayer.destroy();
    }
    if (this.subtitleOverlay) {
      this.subtitleOverlay.destroy();
    }
    if (this.assRenderer) {
      this.assRenderer.destroy();
    }
    
    this.video.remove();
    this.listeners.clear();
  }

  getState(): PlayerState {
    return { ...this.state };
  }

  // Utility methods
  getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  private async loadEmbeddedTracks(): Promise<void> {
    // Wait for tracks to be loaded
    await new Promise(resolve => {
      const checkTracks = () => {
        if (this.video.textTracks.length > 0) {
          resolve(void 0);
        } else {
          setTimeout(checkTracks, 100);
        }
      };
      checkTracks();
    });

    this.emit({ type: 'tracks', audio: await this.listAudio(), text: await this.listText(), qualities: await this.listQualities() });
  }

  private mapShakaQuality(track: any): Quality {
    return {
      height: track.height,
      width: track.width,
      bandwidth: track.bandwidth,
      codec: track.codecs,
      label: track.label || `${track.height}p`
    };
  }

  private mapHlsQuality(level: any): Quality {
    return {
      height: level.height,
      width: level.width,
      bandwidth: level.bitrate,
      codec: level.codecs,
      label: level.name || `${level.height}p`
    };
  }
}
