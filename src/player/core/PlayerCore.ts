/**
 * PlayerCore - Unified API for multi-platform media playback
 * Abstracts platform-specific implementations behind a common interface
 */

import { PlayerEngine, PlayerEvents, PlayerConfig, Source, Platform } from './types';

export class PlayerCore {
  private engine: PlayerEngine;
  private config: PlayerConfig;
  private listeners: Set<(e: PlayerEvents) => void> = new Set();
  private state: any = {};

  constructor(platform: Platform, config: PlayerConfig = {}) {
    this.config = {
      preferHighestOnStart: true,
      autoPlay: false,
      volume: 1.0,
      muted: false,
      preferredAudioLang: 'en',
      preferredTextLang: 'en',
      enableABR: true,
      maxBufferSize: 60 * 1000 * 1000, // 60MB
      maxBufferLength: 30, // 30 seconds
      ...config
    };

    this.engine = this.createEngine(platform);
    this.setupEventForwarding();
  }

  private createEngine(platform: Platform): PlayerEngine {
    switch (platform) {
      case 'web':
        // Dynamic import to avoid bundling issues
        return new (require('../web/WebPlayer').WebPlayer)(this.config);
      case 'android':
        return new (require('../android/AndroidPlayer').AndroidPlayer)(this.config);
      case 'ios':
        return new (require('../ios/IOSPlayer').IOSPlayer)(this.config);
      case 'electron':
        return new (require('../electron/MpvPlayer').MpvPlayer)(this.config);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private setupEventForwarding(): void {
    this.engine.on((event: PlayerEvents) => {
      this.listeners.forEach(listener => listener(event));
    });
  }

  // Core playback methods
  async load(src: Source): Promise<void> {
    await this.engine.load(src);
    
    if (this.config.preferHighestOnStart) {
      await this.setQualityMax();
    }
    
    if (this.config.autoPlay) {
      await this.play();
    }
  }

  async play(): Promise<void> {
    await this.engine.play();
  }

  async pause(): Promise<void> {
    await this.engine.pause();
  }

  async seek(seconds: number): Promise<void> {
    await this.engine.seek(seconds);
  }

  async setVolume(vol: number): Promise<void> {
    await this.engine.setVolume(Math.max(0, Math.min(1, vol)));
  }

  async setMuted(muted: boolean): Promise<void> {
    await this.engine.setMuted(muted);
  }

  // Quality management
  async listQualities(): Promise<any[]> {
    return this.engine.listQualities();
  }

  async setQualityMax(): Promise<void> {
    await this.engine.setQualityMax();
  }

  async setQuality(q: any): Promise<void> {
    await this.engine.setQuality(q);
  }

  // Audio track management
  async listAudio(): Promise<any[]> {
    return this.engine.listAudio();
  }

  async setAudio(trackId: string): Promise<void> {
    await this.engine.setAudio(trackId);
  }

  // Text track management
  async listText(): Promise<any[]> {
    return this.engine.listText();
  }

  async setText(trackId?: string): Promise<void> {
    await this.engine.setText(trackId);
  }

  async attachExternalSubtitle(url: string, format: 'vtt'|'ass'|'srt', lang?: string, label?: string): Promise<void> {
    await this.engine.attachExternalSubtitle(url, format, lang, label);
  }

  // Event system
  on(listener: (e: PlayerEvents) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  off(listener: (e: PlayerEvents) => void): void {
    this.listeners.delete(listener);
  }

  // Lifecycle
  async destroy(): Promise<void> {
    this.listeners.clear();
    await this.engine.destroy();
  }

  getState(): any {
    return this.engine.getState();
  }

  // Utility methods
  getConfig(): PlayerConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<PlayerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Factory function for easy instantiation
export function createPlayer(platform: Platform, config?: PlayerConfig): PlayerCore {
  return new PlayerCore(platform, config);
}

// Platform detection utility
export function detectPlatform(): Platform {
  if (typeof window !== 'undefined') {
    // Web environment
    if (window.navigator.userAgent.includes('Electron')) {
      return 'electron';
    }
    return 'web';
  }
  
  // React Native environment
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    const Platform = require('react-native').Platform;
    return Platform.OS === 'android' ? 'android' : 'ios';
  }
  
  // Default to web
  return 'web';
}
