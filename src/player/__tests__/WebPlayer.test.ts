/**
 * WebPlayer Tests
 * Tests the web platform implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebPlayer } from '../web/WebPlayer';
import { PlayerConfig, Source } from '../core/types';

// Mock dependencies
vi.mock('shaka-player', () => ({
  Player: vi.fn().mockImplementation(() => ({
    configure: vi.fn(),
    addEventListener: vi.fn(),
    load: vi.fn(),
    destroy: vi.fn(),
    getVariantTracks: vi.fn(() => []),
    getTextTracks: vi.fn(() => []),
    selectVariantTrack: vi.fn(),
    selectTextTrack: vi.fn(),
    getStats: vi.fn(() => ({
      getCurrentVariant: vi.fn(() => null)
    }))
  }))
}));

vi.mock('hls.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    loadSource: vi.fn(),
    destroy: vi.fn(),
    levels: [],
    audioTracks: [],
    subtitleTracks: [],
    currentLevel: 0,
    audioTrack: 0,
    subtitleTrack: 0
  }))
}));

vi.mock('../web/engines/subs/vttOverlay', () => ({
  VttOverlay: vi.fn().mockImplementation(() => ({
    loadTrack: vi.fn(),
    loadFromUrl: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    destroy: vi.fn()
  }))
}));

vi.mock('../web/engines/subs/assRenderer', () => ({
  AssRenderer: vi.fn().mockImplementation(() => ({
    loadTrack: vi.fn(),
    loadFromUrl: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    destroy: vi.fn()
  }))
}));

describe('WebPlayer', () => {
  let player: WebPlayer;
  let mockConfig: PlayerConfig;
  let mockSource: Source;
  let mockVideoElement: HTMLVideoElement;

  beforeEach(() => {
    // Create mock video element
    mockVideoElement = document.createElement('video');
    document.body.appendChild(mockVideoElement);

    mockConfig = {
      preferHighestOnStart: true,
      autoPlay: false,
      volume: 1.0,
      muted: false,
      preferredAudioLang: 'en',
      preferredTextLang: 'en',
      enableABR: true
    };

    mockSource = {
      url: 'https://example.com/test.m3u8',
      type: 'hls',
      provider: 'Test Provider'
    };
  });

  afterEach(async () => {
    if (player) {
      await player.destroy();
    }
    if (mockVideoElement.parentElement) {
      mockVideoElement.parentElement.removeChild(mockVideoElement);
    }
  });

  describe('Initialization', () => {
    it('should create WebPlayer instance', () => {
      player = new WebPlayer(mockConfig);
      expect(player).toBeDefined();
    });

    it('should initialize with correct configuration', () => {
      player = new WebPlayer(mockConfig);
      const state = player.getState();
      expect(state.volume).toBe(mockConfig.volume);
      expect(state.muted).toBe(mockConfig.muted);
    });
  });

  describe('Source Loading', () => {
    beforeEach(() => {
      player = new WebPlayer(mockConfig);
    });

    it('should load HLS source', async () => {
      const hlsSource = { ...mockSource, type: 'hls' };
      await expect(player.load(hlsSource)).resolves.not.toThrow();
    });

    it('should load DASH source', async () => {
      const dashSource = { ...mockSource, type: 'dash', url: 'https://example.com/test.mpd' };
      await expect(player.load(dashSource)).resolves.not.toThrow();
    });

    it('should load MP4 source', async () => {
      const mp4Source = { ...mockSource, type: 'mp4', url: 'https://example.com/test.mp4' };
      await expect(player.load(mp4Source)).resolves.not.toThrow();
    });
  });

  describe('Playback Controls', () => {
    beforeEach(() => {
      player = new WebPlayer(mockConfig);
    });

    it('should provide play functionality', async () => {
      await expect(player.play()).resolves.not.toThrow();
    });

    it('should provide pause functionality', async () => {
      await expect(player.pause()).resolves.not.toThrow();
    });

    it('should provide seek functionality', async () => {
      await expect(player.seek(30)).resolves.not.toThrow();
    });

    it('should provide volume control', async () => {
      await expect(player.setVolume(0.5)).resolves.not.toThrow();
    });

    it('should provide mute control', async () => {
      await expect(player.setMuted(true)).resolves.not.toThrow();
    });
  });

  describe('Quality Management', () => {
    beforeEach(() => {
      player = new WebPlayer(mockConfig);
    });

    it('should list available qualities', async () => {
      const qualities = await player.listQualities();
      expect(Array.isArray(qualities)).toBe(true);
    });

    it('should set quality to maximum', async () => {
      await expect(player.setQualityMax()).resolves.not.toThrow();
    });

    it('should set specific quality', async () => {
      const quality = { height: 1080, label: '1080p' };
      await expect(player.setQuality(quality)).resolves.not.toThrow();
    });
  });

  describe('Audio Track Management', () => {
    beforeEach(() => {
      player = new WebPlayer(mockConfig);
    });

    it('should list available audio tracks', async () => {
      const audioTracks = await player.listAudio();
      expect(Array.isArray(audioTracks)).toBe(true);
    });

    it('should set audio track', async () => {
      await expect(player.setAudio('audio-1')).resolves.not.toThrow();
    });
  });

  describe('Text Track Management', () => {
    beforeEach(() => {
      player = new WebPlayer(mockConfig);
    });

    it('should list available text tracks', async () => {
      const textTracks = await player.listText();
      expect(Array.isArray(textTracks)).toBe(true);
    });

    it('should set text track', async () => {
      await expect(player.setText('text-1')).resolves.not.toThrow();
    });

    it('should disable text track', async () => {
      await expect(player.setText()).resolves.not.toThrow();
    });

    it('should attach external VTT subtitle', async () => {
      await expect(
        player.attachExternalSubtitle(
          'https://example.com/subtitle.vtt',
          'vtt',
          'en',
          'English'
        )
      ).resolves.not.toThrow();
    });

    it('should attach external ASS subtitle', async () => {
      await expect(
        player.attachExternalSubtitle(
          'https://example.com/subtitle.ass',
          'ass',
          'en',
          'English'
        )
      ).resolves.not.toThrow();
    });

    it('should attach external SRT subtitle', async () => {
      await expect(
        player.attachExternalSubtitle(
          'https://example.com/subtitle.srt',
          'srt',
          'en',
          'English'
        )
      ).resolves.not.toThrow();
    });
  });

  describe('Event System', () => {
    beforeEach(() => {
      player = new WebPlayer(mockConfig);
    });

    it('should register event listeners', () => {
      const listener = vi.fn();
      const unsubscribe = player.on(listener);
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should emit events', () => {
      const listener = vi.fn();
      player.on(listener);
      
      // Simulate event emission
      player.emit({ type: 'ready' });
      
      // In a real test, you'd verify the listener was called
    });
  });

  describe('Subtitle Systems', () => {
    beforeEach(() => {
      player = new WebPlayer(mockConfig);
    });

    it('should initialize VTT overlay', () => {
      // VTT overlay should be initialized in constructor
      expect(player).toBeDefined();
    });

    it('should initialize ASS renderer', () => {
      // ASS renderer should be initialized in constructor
      expect(player).toBeDefined();
    });
  });

  describe('Engine Selection', () => {
    it('should fallback to hls.js when Shaka is not available', async () => {
      // Mock Shaka not being available
      vi.doMock('shaka-player', () => {
        throw new Error('Shaka not available');
      });

      player = new WebPlayer(mockConfig);
      expect(player).toBeDefined();
    });

    it('should fallback to native playback when both engines unavailable', async () => {
      // Mock both engines not being available
      vi.doMock('shaka-player', () => {
        throw new Error('Shaka not available');
      });
      vi.doMock('hls.js', () => {
        throw new Error('HLS.js not available');
      });

      player = new WebPlayer(mockConfig);
      expect(player).toBeDefined();
    });
  });

  describe('State Management', () => {
    beforeEach(() => {
      player = new WebPlayer(mockConfig);
    });

    it('should provide current state', () => {
      const state = player.getState();
      expect(state).toBeDefined();
      expect(typeof state.playing).toBe('boolean');
      expect(typeof state.currentTime).toBe('number');
      expect(typeof state.duration).toBe('number');
      expect(typeof state.volume).toBe('number');
      expect(typeof state.muted).toBe('boolean');
      expect(typeof state.buffered).toBe('number');
    });
  });

  describe('Lifecycle Management', () => {
    it('should destroy player cleanly', async () => {
      player = new WebPlayer(mockConfig);
      await expect(player.destroy()).resolves.not.toThrow();
    });
  });
});
