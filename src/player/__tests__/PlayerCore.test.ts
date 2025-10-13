/**
 * PlayerCore Acceptance Tests
 * Tests the unified player API across all platforms
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlayerCore, createPlayer, detectPlatform } from '../core/PlayerCore';
import { PlayerConfig, Source, Quality, AudioTrack, TextTrack } from '../core/types';

// Mock platform detection
vi.mock('../core/PlayerCore', async () => {
  const actual = await vi.importActual('../core/PlayerCore');
  return {
    ...actual,
    detectPlatform: vi.fn(() => 'web')
  };
});

describe('PlayerCore', () => {
  let player: PlayerCore;
  let mockConfig: PlayerConfig;
  let mockSource: Source;

  beforeEach(() => {
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
      provider: 'Test Provider',
      sizeBytes: 1000000,
      codec: 'h264',
      resolution: '1080p'
    };
  });

  afterEach(async () => {
    if (player) {
      await player.destroy();
    }
  });

  describe('Player Creation', () => {
    it('should create a player instance', () => {
      player = createPlayer('web', mockConfig);
      expect(player).toBeDefined();
      expect(player.getConfig()).toEqual(mockConfig);
    });

    it('should detect platform correctly', () => {
      const platform = detectPlatform();
      expect(platform).toBe('web');
    });

    it('should handle invalid platform gracefully', () => {
      expect(() => createPlayer('invalid' as any, mockConfig)).toThrow();
    });
  });

  describe('Source Loading', () => {
    beforeEach(() => {
      player = createPlayer('web', mockConfig);
    });

    it('should load a valid source', async () => {
      const loadPromise = player.load(mockSource);
      expect(loadPromise).toBeInstanceOf(Promise);
      // Note: In real tests, you'd mock the underlying engine
    });

    it('should handle invalid source gracefully', async () => {
      const invalidSource = { url: '' } as Source;
      await expect(player.load(invalidSource)).rejects.toThrow();
    });
  });

  describe('Playback Controls', () => {
    beforeEach(() => {
      player = createPlayer('web', mockConfig);
    });

    it('should provide play/pause controls', async () => {
      expect(player.play).toBeDefined();
      expect(player.pause).toBeDefined();
      expect(typeof player.play).toBe('function');
      expect(typeof player.pause).toBe('function');
    });

    it('should provide seek functionality', async () => {
      expect(player.seek).toBeDefined();
      expect(typeof player.seek).toBe('function');
    });

    it('should provide volume controls', async () => {
      expect(player.setVolume).toBeDefined();
      expect(player.setMuted).toBeDefined();
      expect(typeof player.setVolume).toBe('function');
      expect(typeof player.setMuted).toBe('function');
    });
  });

  describe('Quality Management', () => {
    beforeEach(() => {
      player = createPlayer('web', mockConfig);
    });

    it('should list available qualities', async () => {
      const qualities = await player.listQualities();
      expect(Array.isArray(qualities)).toBe(true);
    });

    it('should set quality to maximum', async () => {
      await expect(player.setQualityMax()).resolves.not.toThrow();
    });

    it('should set specific quality', async () => {
      const quality: Quality = { height: 1080, label: '1080p' };
      await expect(player.setQuality(quality)).resolves.not.toThrow();
    });
  });

  describe('Audio Track Management', () => {
    beforeEach(() => {
      player = createPlayer('web', mockConfig);
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
      player = createPlayer('web', mockConfig);
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

    it('should attach external subtitle', async () => {
      await expect(
        player.attachExternalSubtitle(
          'https://example.com/subtitle.vtt',
          'vtt',
          'en',
          'English'
        )
      ).resolves.not.toThrow();
    });
  });

  describe('Event System', () => {
    beforeEach(() => {
      player = createPlayer('web', mockConfig);
    });

    it('should register event listeners', () => {
      const listener = vi.fn();
      const unsubscribe = player.on(listener);
      expect(typeof unsubscribe).toBe('function');
      
      // Cleanup
      unsubscribe();
    });

    it('should unregister event listeners', () => {
      const listener = vi.fn();
      player.on(listener);
      player.off(listener);
      // In a real test, you'd verify the listener is no longer called
    });
  });

  describe('State Management', () => {
    beforeEach(() => {
      player = createPlayer('web', mockConfig);
    });

    it('should provide current state', () => {
      const state = player.getState();
      expect(state).toBeDefined();
      expect(typeof state).toBe('object');
    });

    it('should update configuration', () => {
      const newConfig = { volume: 0.5 };
      player.updateConfig(newConfig);
      const updatedConfig = player.getConfig();
      expect(updatedConfig.volume).toBe(0.5);
    });
  });

  describe('Lifecycle Management', () => {
    it('should destroy player cleanly', async () => {
      player = createPlayer('web', mockConfig);
      await expect(player.destroy()).resolves.not.toThrow();
    });
  });
});

describe('Platform-Specific Tests', () => {
  describe('Web Platform', () => {
    it('should create web player', () => {
      const player = createPlayer('web', {});
      expect(player).toBeDefined();
    });
  });

  describe('Android Platform', () => {
    it('should create android player', () => {
      const player = createPlayer('android', {});
      expect(player).toBeDefined();
    });
  });

  describe('iOS Platform', () => {
    it('should create ios player', () => {
      const player = createPlayer('ios', {});
      expect(player).toBeDefined();
    });
  });

  describe('Electron Platform', () => {
    it('should create electron player', () => {
      const player = createPlayer('electron', {});
      expect(player).toBeDefined();
    });
  });
});

describe('Integration Tests', () => {
  let player: PlayerCore;

  beforeEach(() => {
    player = createPlayer('web', {
      preferHighestOnStart: true,
      autoPlay: false
    });
  });

  afterEach(async () => {
    if (player) {
      await player.destroy();
    }
  });

  it('should handle complete playback workflow', async () => {
    // Load source
    await player.load(mockSource);
    
    // Get tracks
    const [audioTracks, textTracks, qualities] = await Promise.all([
      player.listAudio(),
      player.listText(),
      player.listQualities()
    ]);
    
    expect(Array.isArray(audioTracks)).toBe(true);
    expect(Array.isArray(textTracks)).toBe(true);
    expect(Array.isArray(qualities)).toBe(true);
    
    // Set quality to max
    await player.setQualityMax();
    
    // Play
    await player.play();
    
    // Pause
    await player.pause();
    
    // Seek
    await player.seek(30);
    
    // Set volume
    await player.setVolume(0.5);
    
    // Mute
    await player.setMuted(true);
    
    // Unmute
    await player.setMuted(false);
  });

  it('should handle subtitle attachment workflow', async () => {
    await player.load(mockSource);
    
    // Attach external subtitle
    await player.attachExternalSubtitle(
      'https://example.com/subtitle.vtt',
      'vtt',
      'en',
      'English'
    );
    
    // List text tracks (should include external)
    const textTracks = await player.listText();
    expect(textTracks.length).toBeGreaterThan(0);
    
    // Set text track
    if (textTracks.length > 0) {
      await player.setText(textTracks[0].id);
    }
    
    // Disable subtitles
    await player.setText();
  });
});
