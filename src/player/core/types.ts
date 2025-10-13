/**
 * Multi-platform media player types
 * Shared across all platform implementations
 */

export type Quality = { 
  height?: number; 
  bandwidth?: number; 
  label?: string;
  width?: number;
  bitrate?: number;
  codec?: string;
};

export type AudioTrack = { 
  id: string; 
  lang?: string; 
  channels?: number; 
  codec?: string; 
  label?: string;
  embedded?: boolean;
  default?: boolean;
};

export type TextTrack = { 
  id: string; 
  lang?: string; 
  kind?: 'sub'|'cc'|'captions'|'descriptions'|'chapters'|'metadata'; 
  format?: 'vtt'|'ass'|'srt'|'ttml'|'dfxp'; 
  label?: string; 
  embedded?: boolean;
  default?: boolean;
  forced?: boolean;
};

export type Source = { 
  url: string; 
  type?: 'dash'|'hls'|'mp4'|'m3u8'|'mpd'; 
  drm?: any; 
  provider?: string; 
  sizeBytes?: number; 
  codec?: string; 
  resolution?: string;
  headers?: Record<string, string>;
  startTime?: number;
};

export type PlayerState = {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  buffered: number;
  quality?: Quality;
  audioTrack?: AudioTrack;
  textTrack?: TextTrack;
};

export type PlayerEvents =
  | { type: 'ready' }
  | { type: 'error'; error: any }
  | { type: 'tracks'; audio: AudioTrack[]; text: TextTrack[]; qualities: Quality[] }
  | { type: 'time'; current: number; duration: number }
  | { type: 'buffer'; percent: number }
  | { type: 'qualityChanged'; quality?: Quality }
  | { type: 'audioChanged'; audio?: AudioTrack }
  | { type: 'textChanged'; text?: TextTrack }
  | { type: 'stateChanged'; state: PlayerState }
  | { type: 'loadstart' }
  | { type: 'canplay' }
  | { type: 'ended' }
  | { type: 'seeking' }
  | { type: 'seeked' };

export type PlayerConfig = {
  preferHighestOnStart?: boolean;
  autoPlay?: boolean;
  startTime?: number;
  volume?: number;
  muted?: boolean;
  preferredAudioLang?: string;
  preferredTextLang?: string;
  enableABR?: boolean;
  maxBufferSize?: number;
  maxBufferLength?: number;
};

export type Platform = 'web' | 'android' | 'ios' | 'electron';

export interface PlayerEngine {
  load(src: Source): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(seconds: number): Promise<void>;
  setVolume(vol: number): Promise<void>; // 0..1
  setMuted(muted: boolean): Promise<void>;

  // Quality management
  listQualities(): Promise<Quality[]>;
  setQualityMax(): Promise<void>;
  setQuality(q: Quality): Promise<void>;

  // Audio track management
  listAudio(): Promise<AudioTrack[]>;
  setAudio(trackId: string): Promise<void>;

  // Text track management
  listText(): Promise<TextTrack[]>;
  setText(trackId?: string): Promise<void>;
  attachExternalSubtitle(url: string, format: 'vtt'|'ass'|'srt', lang?: string, label?: string): Promise<void>;

  // Event system
  on(listener: (e: PlayerEvents) => void): () => void;
  off(listener: (e: PlayerEvents) => void): void;
  emit(event: PlayerEvents): void;

  // Lifecycle
  destroy(): Promise<void>;
  getState(): PlayerState;
}
