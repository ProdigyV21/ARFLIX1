/**
 * PlayerUI Tests
 * Tests the React UI component integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlayerUI } from '../ui/PlayerUI';
import { Source, PlayerConfig } from '../core/types';

// Mock the PlayerCore
vi.mock('../core/PlayerCore', () => ({
  createPlayer: vi.fn(() => ({
    load: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setQuality: vi.fn(),
    setQualityMax: vi.fn(),
    setAudio: vi.fn(),
    setText: vi.fn(),
    attachExternalSubtitle: vi.fn(),
    on: vi.fn(() => vi.fn()), // Return unsubscribe function
    destroy: vi.fn(),
    getState: vi.fn(() => ({
      playing: false,
      currentTime: 0,
      duration: 0,
      volume: 1.0,
      muted: false,
      buffered: 0
    }))
  })),
  detectPlatform: vi.fn(() => 'web')
}));

describe('PlayerUI', () => {
  let mockSource: Source;
  let mockConfig: PlayerConfig;
  let mockOnReady: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;
  let mockOnTimeUpdate: ReturnType<typeof vi.fn>;
  let mockOnStateChange: ReturnType<typeof vi.fn>;
  let mockOnTracksLoaded: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSource = {
      url: 'https://example.com/test.m3u8',
      type: 'hls',
      provider: 'Test Provider'
    };

    mockConfig = {
      preferHighestOnStart: true,
      autoPlay: false,
      volume: 1.0,
      muted: false
    };

    mockOnReady = vi.fn();
    mockOnError = vi.fn();
    mockOnTimeUpdate = vi.fn();
    mockOnStateChange = vi.fn();
    mockOnTracksLoaded = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
          onReady={mockOnReady}
          onError={mockOnError}
        />
      );

      expect(screen.getByText('Loading player...')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
          className="custom-player"
        />
      );

      const container = screen.getByText('Loading player...').closest('.custom-player');
      expect(container).toBeInTheDocument();
    });

    it('should render with custom style', () => {
      const customStyle = { backgroundColor: 'red' };
      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
          style={customStyle}
        />
      );

      const container = screen.getByText('Loading player...').closest('.player-loading');
      expect(container).toHaveStyle('background-color: red');
    });
  });

  describe('Player Initialization', () => {
    it('should call onReady when player is ready', async () => {
      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
          onReady={mockOnReady}
        />
      );

      // Simulate player ready event
      await waitFor(() => {
        expect(mockOnReady).toHaveBeenCalled();
      });
    });

    it('should call onError when player fails', async () => {
      const mockError = new Error('Player failed');
      vi.mocked(require('../core/PlayerCore').createPlayer).mockImplementation(() => ({
        ...require('../core/PlayerCore').createPlayer(),
        load: vi.fn().mockRejectedValue(mockError)
      }));

      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
          onError={mockOnError}
        />
      );

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(mockError);
      });
    });
  });

  describe('Playback Controls', () => {
    it('should render play button when not playing', async () => {
      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
        />
      );

      // Wait for player to be ready
      await waitFor(() => {
        expect(screen.getByText('Video player initialized')).toBeInTheDocument();
      });

      const playButton = screen.getByRole('button', { name: /play/i });
      expect(playButton).toBeInTheDocument();
    });

    it('should call play when play button is clicked', async () => {
      const mockPlay = vi.fn();
      vi.mocked(require('../core/PlayerCore').createPlayer).mockImplementation(() => ({
        ...require('../core/PlayerCore').createPlayer(),
        play: mockPlay
      }));

      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Video player initialized')).toBeInTheDocument();
      });

      const playButton = screen.getByRole('button', { name: /play/i });
      fireEvent.click(playButton);

      expect(mockPlay).toHaveBeenCalled();
    });

    it('should call pause when pause button is clicked', async () => {
      const mockPause = vi.fn();
      vi.mocked(require('../core/PlayerCore').createPlayer).mockImplementation(() => ({
        ...require('../core/PlayerCore').createPlayer(),
        pause: mockPause,
        getState: vi.fn(() => ({
          playing: true,
          currentTime: 0,
          duration: 0,
          volume: 1.0,
          muted: false,
          buffered: 0
        }))
      }));

      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Video player initialized')).toBeInTheDocument();
      });

      const pauseButton = screen.getByRole('button', { name: /pause/i });
      fireEvent.click(pauseButton);

      expect(mockPause).toHaveBeenCalled();
    });
  });

  describe('Volume Controls', () => {
    it('should render volume slider', async () => {
      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Video player initialized')).toBeInTheDocument();
      });

      const volumeSlider = screen.getByRole('slider');
      expect(volumeSlider).toBeInTheDocument();
    });

    it('should call setVolume when slider is changed', async () => {
      const mockSetVolume = vi.fn();
      vi.mocked(require('../core/PlayerCore').createPlayer).mockImplementation(() => ({
        ...require('../core/PlayerCore').createPlayer(),
        setVolume: mockSetVolume
      }));

      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Video player initialized')).toBeInTheDocument();
      });

      const volumeSlider = screen.getByRole('slider');
      fireEvent.change(volumeSlider, { target: { value: '0.5' } });

      expect(mockSetVolume).toHaveBeenCalledWith(0.5);
    });

    it('should call setMuted when mute button is clicked', async () => {
      const mockSetMuted = vi.fn();
      vi.mocked(require('../core/PlayerCore').createPlayer).mockImplementation(() => ({
        ...require('../core/PlayerCore').createPlayer(),
        setMuted: mockSetMuted
      }));

      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Video player initialized')).toBeInTheDocument();
      });

      const muteButton = screen.getByRole('button', { name: /mute/i });
      fireEvent.click(muteButton);

      expect(mockSetMuted).toHaveBeenCalledWith(true);
    });
  });

  describe('Quality Selection', () => {
    it('should render quality selector when multiple qualities available', async () => {
      vi.mocked(require('../core/PlayerCore').createPlayer).mockImplementation(() => ({
        ...require('../core/PlayerCore').createPlayer(),
        listQualities: vi.fn().mockResolvedValue([
          { height: 1080, label: '1080p' },
          { height: 720, label: '720p' }
        ])
      }));

      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Video player initialized')).toBeInTheDocument();
      });

      // Quality selector should be present
      const qualitySelect = screen.getByDisplayValue('Auto');
      expect(qualitySelect).toBeInTheDocument();
    });

    it('should not render quality selector when only one quality available', async () => {
      vi.mocked(require('../core/PlayerCore').createPlayer).mockImplementation(() => ({
        ...require('../core/PlayerCore').createPlayer(),
        listQualities: vi.fn().mockResolvedValue([
          { height: 1080, label: '1080p' }
        ])
      }));

      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Video player initialized')).toBeInTheDocument();
      });

      // Quality selector should not be present
      const qualitySelect = screen.queryByDisplayValue('Auto');
      expect(qualitySelect).not.toBeInTheDocument();
    });
  });

  describe('Audio Track Selection', () => {
    it('should render audio track selector when multiple tracks available', async () => {
      vi.mocked(require('../core/PlayerCore').createPlayer).mockImplementation(() => ({
        ...require('../core/PlayerCore').createPlayer(),
        listAudio: vi.fn().mockResolvedValue([
          { id: 'audio-1', label: 'English' },
          { id: 'audio-2', label: 'Spanish' }
        ])
      }));

      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Video player initialized')).toBeInTheDocument();
      });

      // Audio track selector should be present
      const audioSelect = screen.getByDisplayValue('English');
      expect(audioSelect).toBeInTheDocument();
    });
  });

  describe('Text Track Selection', () => {
    it('should render text track selector when tracks available', async () => {
      vi.mocked(require('../core/PlayerCore').createPlayer).mockImplementation(() => ({
        ...require('../core/PlayerCore').createPlayer(),
        listText: vi.fn().mockResolvedValue([
          { id: 'text-1', label: 'English' },
          { id: 'text-2', label: 'Spanish' }
        ])
      }));

      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Video player initialized')).toBeInTheDocument();
      });

      // Text track selector should be present
      const textSelect = screen.getByDisplayValue('Off');
      expect(textSelect).toBeInTheDocument();
    });
  });

  describe('Time Display', () => {
    it('should format time correctly', async () => {
      vi.mocked(require('../core/PlayerCore').createPlayer).mockImplementation(() => ({
        ...require('../core/PlayerCore').createPlayer(),
        getState: vi.fn(() => ({
          playing: false,
          currentTime: 125, // 2:05
          duration: 3600, // 1:00:00
          volume: 1.0,
          muted: false,
          buffered: 0
        }))
      }));

      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Video player initialized')).toBeInTheDocument();
      });

      // Time should be formatted as MM:SS
      expect(screen.getByText('2:05')).toBeInTheDocument();
      expect(screen.getByText('1:00:00')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should render error state when player fails', async () => {
      const mockError = new Error('Player failed');
      vi.mocked(require('../core/PlayerCore').createPlayer).mockImplementation(() => ({
        ...require('../core/PlayerCore').createPlayer(),
        load: vi.fn().mockRejectedValue(mockError)
      }));

      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Playback Error')).toBeInTheDocument();
        expect(screen.getByText('Player failed')).toBeInTheDocument();
      });
    });

    it('should retry when retry button is clicked', async () => {
      const mockError = new Error('Player failed');
      const mockLoad = vi.fn().mockRejectedValue(mockError);
      vi.mocked(require('../core/PlayerCore').createPlayer).mockImplementation(() => ({
        ...require('../core/PlayerCore').createPlayer(),
        load: mockLoad
      }));

      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Playback Error')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      // Error should be cleared
      expect(screen.queryByText('Playback Error')).not.toBeInTheDocument();
    });
  });

  describe('Event Callbacks', () => {
    it('should call onTimeUpdate when time changes', async () => {
      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
          onTimeUpdate={mockOnTimeUpdate}
        />
      );

      // Simulate time update event
      await waitFor(() => {
        expect(mockOnTimeUpdate).toHaveBeenCalled();
      });
    });

    it('should call onStateChange when playing state changes', async () => {
      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
          onStateChange={mockOnStateChange}
        />
      );

      // Simulate state change event
      await waitFor(() => {
        expect(mockOnStateChange).toHaveBeenCalled();
      });
    });

    it('should call onTracksLoaded when tracks are available', async () => {
      render(
        <PlayerUI
          source={mockSource}
          config={mockConfig}
          onTracksLoaded={mockOnTracksLoaded}
        />
      );

      // Simulate tracks loaded event
      await waitFor(() => {
        expect(mockOnTracksLoaded).toHaveBeenCalled();
      });
    });
  });
});
