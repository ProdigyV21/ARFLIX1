import Hls from 'hls.js';
import * as dashjs from 'dashjs';

export type StreamKind = "hls" | "dash" | "mp4" | "unknown";

export type NormalizedStream = {
  url: string;
  kind: StreamKind;
  quality?: number;
  bitrateKbps?: number;
  codec?: string;
  hdr?: "dolby_vision" | "hdr10" | "none";
  audioLang?: string;
  captions?: Array<{ lang: string; url: string; mime?: string }>;
  host?: string;
  label?: string;
  sourceName?: string;
  infoHash?: string;
  fileIdx?: number;
};

export type StreamsResponse = {
  items: NormalizedStream[];
  best: NormalizedStream | null;
  message?: string;
};

export type PlayerInstance = {
  type: 'hls' | 'dash' | 'native';
  instance: Hls | dashjs.MediaPlayerClass | null;
  destroy: () => void;
};

export function createPlayer(
  videoElement: HTMLVideoElement,
  stream: NormalizedStream,
  onError?: (error: Error) => void
): PlayerInstance {
  if (stream.kind === 'hls') {
    if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = stream.url;
      return {
        type: 'native',
        instance: null,
        destroy: () => {
          videoElement.src = '';
        },
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });

      hls.loadSource(stream.url);
      hls.attachMedia(videoElement);

      const selectHighestHls = () => {
        if (!hls.levels || hls.levels.length === 0) return;
        const bestIndex = hls.levels
          .map((l, i) => ({ h: l.height || 0, i }))
          .sort((a, b) => b.h - a.h)[0]?.i;
        if (bestIndex !== undefined) {
          hls.currentLevel = bestIndex;
        }
      };

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        selectHighestHls();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          onError?.(new Error(`HLS Error: ${data.type} - ${data.details}`));
        }
      });

      return {
        type: 'hls',
        instance: hls,
        destroy: () => {
          hls.destroy();
        },
      };
    }
  }

  if (stream.kind === 'dash') {
    const player = dashjs.MediaPlayer().create();
    player.initialize(videoElement, stream.url, true);
    player.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } });

    const selectHighestDash = () => {
      const tracks = player.getBitrateInfoListFor('video');
      if (!tracks || tracks.length === 0) return;
      const best = tracks.sort((a: any, b: any) => (b.height || 0) - (a.height || 0))[0];
      if (best && typeof best.qualityIndex === 'number') {
        player.setQualityFor('video', best.qualityIndex);
      }
    };

    player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, selectHighestDash);

    player.on(dashjs.MediaPlayer.events.ERROR, (e: any) => {
      onError?.(new Error(`DASH Error: ${e.error}`));
    });

    return {
      type: 'dash',
      instance: player,
      destroy: () => {
        player.reset();
      },
    };
  }

  videoElement.src = stream.url;
  return {
    type: 'native',
    instance: null,
    destroy: () => {
      videoElement.src = '';
    },
  };
}

export function getAvailableQualities(player: PlayerInstance): number[] {
  if (player.type === 'hls' && player.instance) {
    const hls = player.instance as Hls;
    return hls.levels.map(level => level.height).filter(Boolean);
  }

  if (player.type === 'dash') {
    return [];
  }

  return [];
}

export function setQuality(player: PlayerInstance, qualityHeight: number | 'auto') {
  if (player.type === 'hls' && player.instance) {
    const hls = player.instance as Hls;
    if (qualityHeight === 'auto') {
      hls.currentLevel = -1;
    } else {
      const levelIndex = hls.levels.findIndex(l => l.height === qualityHeight);
      if (levelIndex !== -1) {
        hls.currentLevel = levelIndex;
      }
    }
  }

  if (player.type === 'dash') {
    // Keep AUTO for DASH in this simplified implementation
  }
}

export function getCurrentQuality(player: PlayerInstance): number | 'auto' | null {
  if (player.type === 'hls' && player.instance) {
    const hls = player.instance as Hls;
    return hls.currentLevel === -1 ? 'auto' : (hls.levels[hls.currentLevel]?.height || null);
  }

  if (player.type === 'dash') {
    return 'auto';
  }

  return null;
}
