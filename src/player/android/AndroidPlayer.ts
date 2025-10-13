/**
 * AndroidPlayer - Android platform implementation using ExoPlayer
 * Bridges React Native with native ExoPlayer functionality
 */

import { NativeModules, NativeEventEmitter } from 'react-native';
import { PlayerEngine, PlayerEvents, PlayerConfig, Source, Quality, AudioTrack, TextTrack, PlayerState } from '../core/types';

const { ExoPlayerModule } = NativeModules;
const eventEmitter = new NativeEventEmitter(ExoPlayerModule);

export class AndroidPlayer implements PlayerEngine {
  private playerId: string;
  private config: PlayerConfig;
  private listeners: Set<(e: PlayerEvents) => void> = new Set();
  private state: PlayerState;
  private eventSubscription?: any;

  constructor(config: PlayerConfig) {
    this.playerId = `android_player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.config = config;
    this.state = {
      playing: false,
      currentTime: 0,
      duration: 0,
      volume: config.volume || 1.0,
      muted: config.muted || false,
      buffered: 0
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await ExoPlayerModule.createPlayer(this.playerId, {
        minBufferMs: 2500,
        maxBufferMs: 5000,
        bufferForPlaybackMs: 2500,
        bufferForPlaybackAfterRebufferMs: 5000
      });

      this.setupEventListeners();
      this.emit({ type: 'ready' });
    } catch (error) {
      this.emit({ type: 'error', error });
    }
  }

  private setupEventListeners(): void {
    this.eventSubscription = eventEmitter.addListener('onPlayerEvent', (event: any) => {
      switch (event.type) {
        case 'stateChanged':
          this.handleStateChange(event.state);
          break;
        case 'playingChanged':
          this.state.playing = event.playing;
          this.emit({ type: 'stateChanged', state: this.state });
          break;
        case 'error':
          this.emit({ type: 'error', error: event.error });
          break;
        case 'timeUpdate':
          this.state.currentTime = event.currentTime;
          this.state.duration = event.duration;
          this.emit({ type: 'time', current: this.state.currentTime, duration: this.state.duration });
          break;
        case 'bufferUpdate':
          this.state.buffered = event.buffered;
          this.emit({ type: 'buffer', percent: this.state.buffered });
          break;
        case 'tracksLoaded':
          this.emit({ 
            type: 'tracks', 
            audio: event.audio || [], 
            text: event.text || [], 
            qualities: event.qualities || [] 
          });
          break;
        case 'qualityChanged':
          this.state.quality = event.quality;
          this.emit({ type: 'qualityChanged', quality: this.state.quality });
          break;
        case 'audioChanged':
          this.state.audioTrack = event.audio;
          this.emit({ type: 'audioChanged', audio: this.state.audioTrack });
          break;
        case 'textChanged':
          this.state.textTrack = event.text;
          this.emit({ type: 'textChanged', text: this.state.textTrack });
          break;
      }
    });
  }

  private handleStateChange(state: string): void {
    switch (state) {
      case 'ready':
        this.emit({ type: 'ready' });
        break;
      case 'buffering':
        this.emit({ type: 'buffer', percent: 0 });
        break;
      case 'ended':
        this.emit({ type: 'ended' });
        break;
    }
  }

  // Core playback methods
  async load(src: Source): Promise<void> {
    try {
      await ExoPlayerModule.loadSource(this.playerId, {
        url: src.url,
        type: src.type,
        headers: src.headers
      });

      // Load tracks after source is loaded
      setTimeout(async () => {
        try {
          const [audio, text, qualities] = await Promise.all([
            this.listAudio(),
            this.listText(),
            this.listQualities()
          ]);

          this.emit({ type: 'tracks', audio, text, qualities });
        } catch (error) {
          console.warn('Failed to load tracks:', error);
        }
      }, 1000);
    } catch (error) {
      this.emit({ type: 'error', error });
      throw error;
    }
  }

  async play(): Promise<void> {
    try {
      await ExoPlayerModule.play(this.playerId);
    } catch (error) {
      this.emit({ type: 'error', error });
      throw error;
    }
  }

  async pause(): Promise<void> {
    try {
      await ExoPlayerModule.pause(this.playerId);
    } catch (error) {
      this.emit({ type: 'error', error });
      throw error;
    }
  }

  async seek(seconds: number): Promise<void> {
    try {
      await ExoPlayerModule.seekTo(this.playerId, seconds * 1000);
    } catch (error) {
      this.emit({ type: 'error', error });
      throw error;
    }
  }

  async setVolume(vol: number): Promise<void> {
    try {
      await ExoPlayerModule.setVolume(this.playerId, vol);
      this.state.volume = vol;
    } catch (error) {
      this.emit({ type: 'error', error });
      throw error;
    }
  }

  async setMuted(muted: boolean): Promise<void> {
    try {
      await ExoPlayerModule.setMuted(this.playerId, muted);
      this.state.muted = muted;
    } catch (error) {
      this.emit({ type: 'error', error });
      throw error;
    }
  }

  // Quality management
  async listQualities(): Promise<Quality[]> {
    try {
      const qualities = await ExoPlayerModule.getQualities(this.playerId);
      return qualities.map((q: any) => ({
        height: q.height,
        width: q.width,
        bandwidth: q.bitrate,
        codec: q.codec,
        label: q.label
      }));
    } catch (error) {
      console.error('Failed to get qualities:', error);
      return [];
    }
  }

  async setQualityMax(): Promise<void> {
    try {
      await ExoPlayerModule.setQualityMax(this.playerId);
    } catch (error) {
      this.emit({ type: 'error', error });
      throw error;
    }
  }

  async setQuality(q: Quality): Promise<void> {
    try {
      await ExoPlayerModule.setQuality(this.playerId, {
        height: q.height,
        width: q.width,
        bitrate: q.bandwidth,
        codec: q.codec
      });
      this.state.quality = q;
    } catch (error) {
      this.emit({ type: 'error', error });
      throw error;
    }
  }

  // Audio track management
  async listAudio(): Promise<AudioTrack[]> {
    try {
      const audioTracks = await ExoPlayerModule.getAudioTracks(this.playerId);
      return audioTracks.map((track: any) => ({
        id: track.id,
        lang: track.lang,
        channels: track.channels,
        codec: track.codec,
        label: track.label,
        embedded: track.embedded
      }));
    } catch (error) {
      console.error('Failed to get audio tracks:', error);
      return [];
    }
  }

  async setAudio(trackId: string): Promise<void> {
    try {
      await ExoPlayerModule.setAudioTrack(this.playerId, trackId);
      const audioTracks = await this.listAudio();
      const selectedTrack = audioTracks.find(t => t.id === trackId);
      if (selectedTrack) {
        this.state.audioTrack = selectedTrack;
        this.emit({ type: 'audioChanged', audio: selectedTrack });
      }
    } catch (error) {
      this.emit({ type: 'error', error });
      throw error;
    }
  }

  // Text track management
  async listText(): Promise<TextTrack[]> {
    try {
      const textTracks = await ExoPlayerModule.getTextTracks(this.playerId);
      return textTracks.map((track: any) => ({
        id: track.id,
        lang: track.lang,
        kind: track.kind,
        format: track.format,
        label: track.label,
        embedded: track.embedded
      }));
    } catch (error) {
      console.error('Failed to get text tracks:', error);
      return [];
    }
  }

  async setText(trackId?: string): Promise<void> {
    try {
      await ExoPlayerModule.setTextTrack(this.playerId, trackId || null);
      if (trackId) {
        const textTracks = await this.listText();
        const selectedTrack = textTracks.find(t => t.id === trackId);
        if (selectedTrack) {
          this.state.textTrack = selectedTrack;
          this.emit({ type: 'textChanged', text: selectedTrack });
        }
      } else {
        this.state.textTrack = undefined;
        this.emit({ type: 'textChanged', text: undefined });
      }
    } catch (error) {
      this.emit({ type: 'error', error });
      throw error;
    }
  }

  async attachExternalSubtitle(url: string, format: 'vtt'|'ass'|'srt', lang?: string, label?: string): Promise<void> {
    // Note: External subtitle attachment would need to be implemented in the native module
    // For now, we'll add it to the text tracks list
    const externalTrack: TextTrack = {
      id: `external-${Date.now()}`,
      lang: lang || 'unknown',
      format,
      label: label || lang || 'External',
      embedded: false
    };

    // This would typically involve downloading the subtitle file and adding it to ExoPlayer
    // Implementation depends on ExoPlayer's subtitle handling capabilities
    console.warn('External subtitle attachment not yet implemented for Android');
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
    if (this.eventSubscription) {
      this.eventSubscription.remove();
    }
    
    try {
      await ExoPlayerModule.destroy(this.playerId);
    } catch (error) {
      console.error('Error destroying player:', error);
    }
    
    this.listeners.clear();
  }

  getState(): PlayerState {
    return { ...this.state };
  }
}
