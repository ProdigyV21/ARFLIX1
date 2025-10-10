import Hls from 'hls.js';
import dashjs from 'dashjs';

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

      hls.on(Hls.Events.ERROR, (event, data) => {
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

  if (player.type === 'dash' && player.instance) {
    const dash = player.instance as dashjs.MediaPlayerClass;
    const bitrateList = dash.getBitrateInfoListFor('video');
    return bitrateList?.map(b => b.height).filter(Boolean) || [];
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

  if (player.type === 'dash' && player.instance) {
    const dash = player.instance as dashjs.MediaPlayerClass;
    if (qualityHeight === 'auto') {
      dash.updateSettings({
        streaming: {
          abr: { autoSwitchBitrate: { video: true } },
        },
      });
    } else {
      const bitrateList = dash.getBitrateInfoListFor('video');
      const quality = bitrateList?.find(b => b.height === qualityHeight);
      if (quality) {
        dash.updateSettings({
          streaming: {
            abr: { autoSwitchBitrate: { video: false } },
          },
        });
        dash.setQualityFor('video', quality.qualityIndex);
      }
    }
  }
}

export function getCurrentQuality(player: PlayerInstance): number | 'auto' | null {
  if (player.type === 'hls' && player.instance) {
    const hls = player.instance as Hls;
    return hls.currentLevel === -1 ? 'auto' : (hls.levels[hls.currentLevel]?.height || null);
  }

  if (player.type === 'dash' && player.instance) {
    const dash = player.instance as dashjs.MediaPlayerClass;
    const settings = dash.getSettings();
    if (settings.streaming?.abr?.autoSwitchBitrate?.video) {
      return 'auto';
    }
    const currentQuality = dash.getQualityFor('video');
    const bitrateList = dash.getBitrateInfoListFor('video');
    return bitrateList?.[currentQuality]?.height || null;
  }

  return null;
}
