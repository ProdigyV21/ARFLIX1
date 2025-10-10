import { useRef, useCallback } from 'react';
import Hls from 'hls.js';
import dashjs from 'dashjs';

export type Engine = "native" | "hls" | "dash";

export type AttachResult = {
  engine: Engine;
  destroy: () => void;
  hls?: Hls;
  dash?: dashjs.MediaPlayerClass;
};

export type StreamKind = "hls" | "dash" | "mp4" | "unknown";

export async function attachSource(
  video: HTMLVideoElement,
  url: string,
  kind: StreamKind,
  onError?: (error: Error) => void
): Promise<AttachResult> {
  console.log(`[MediaEngine] Attaching source: ${kind}`, url.substring(0, 100));

  video.removeAttribute("src");
  video.load();
  video.crossOrigin = "anonymous";

  const canNativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";
  const isAndroid = /Android/i.test(navigator.userAgent);

  console.log(`[MediaEngine] canNativeHls: ${canNativeHls}, isAndroid: ${isAndroid}, HLS.isSupported: ${Hls.isSupported()}`);

  if (kind === "hls") {
    if (canNativeHls && !isAndroid) {
      video.src = url;
      return {
        engine: "native",
        destroy: () => {
          video.removeAttribute("src");
          video.load();
        },
      };
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        fragLoadingTimeOut: 15000,
        manifestLoadingTimeOut: 15000,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });

      hls.attachMedia(video);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(url);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', data);
        if (data.fatal) {
          const error = new Error(`HLS Fatal: ${data.type} - ${data.details}`);
          onError?.(error);
          window.dispatchEvent(new CustomEvent("player:fatal", { detail: data }));
        }
      });

      return {
        engine: "hls",
        destroy: () => {
          hls.destroy();
        },
        hls,
      };
    }
  }

  if (kind === "dash") {
    const dash = dashjs.MediaPlayer().create();
    dash.initialize(video, url, false);
    dash.setAutoPlay(false);

    dash.on(dashjs.MediaPlayer.events.ERROR, (e: any) => {
      console.error('DASH Error:', e);
      const error = new Error(`DASH Error: ${e.error}`);
      onError?.(error);
      window.dispatchEvent(new CustomEvent("player:fatal", { detail: e }));
    });

    return {
      engine: "dash",
      destroy: () => {
        dash.reset();
      },
      dash,
    };
  }

  console.log(`[MediaEngine] Falling back to native playback for kind: ${kind}`);
  video.src = url;
  video.load();

  return {
    engine: "native",
    destroy: () => {
      video.removeAttribute("src");
      video.load();
    },
  };
}

export function useMediaEngine() {
  const engineRef = useRef<AttachResult | null>(null);

  const attach = useCallback(
    async (
      video: HTMLVideoElement,
      url: string,
      kind: StreamKind,
      onError?: (error: Error) => void
    ) => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }

      const result = await attachSource(video, url, kind, onError);
      engineRef.current = result;
      return result;
    },
    []
  );

  const destroy = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
  }, []);

  return { engineRef, attach, destroy };
}

export function getAvailableQualities(engine: AttachResult): number[] {
  if (engine.engine === "hls" && engine.hls) {
    return engine.hls.levels.map(level => level.height).filter(Boolean);
  }

  if (engine.engine === "dash" && engine.dash) {
    const bitrateList = engine.dash.getBitrateInfoListFor("video");
    return bitrateList?.map((b: any) => b.height).filter(Boolean) || [];
  }

  return [];
}

export function setQuality(engine: AttachResult, qualityHeight: number | "auto") {
  if (engine.engine === "hls" && engine.hls) {
    if (qualityHeight === "auto") {
      engine.hls.currentLevel = -1;
    } else {
      const levelIndex = engine.hls.levels.findIndex(l => l.height === qualityHeight);
      if (levelIndex !== -1) {
        engine.hls.currentLevel = levelIndex;
      }
    }
  }

  if (engine.engine === "dash" && engine.dash) {
    if (qualityHeight === "auto") {
      engine.dash.updateSettings({
        streaming: {
          abr: { autoSwitchBitrate: { video: true } },
        },
      });
    } else {
      const bitrateList = engine.dash.getBitrateInfoListFor("video");
      const quality = bitrateList?.find((b: any) => b.height === qualityHeight);
      if (quality) {
        engine.dash.updateSettings({
          streaming: {
            abr: { autoSwitchBitrate: { video: false } },
          },
        });
        engine.dash.setQualityFor("video", quality.qualityIndex);
      }
    }
  }
}

export function getCurrentQuality(engine: AttachResult): number | "auto" | null {
  if (engine.engine === "hls" && engine.hls) {
    return engine.hls.currentLevel === -1 ? "auto" : (engine.hls.levels[engine.hls.currentLevel]?.height || null);
  }

  if (engine.engine === "dash" && engine.dash) {
    const settings = engine.dash.getSettings();
    if (settings.streaming?.abr?.autoSwitchBitrate?.video) {
      return "auto";
    }
    const currentQuality = engine.dash.getQualityFor("video");
    const bitrateList = engine.dash.getBitrateInfoListFor("video");
    return bitrateList?.[currentQuality]?.height || null;
  }

  return null;
}

export function getAudioTracks(engine: AttachResult): Array<{ id: number; label: string; language: string }> {
  if (engine.engine === "hls" && engine.hls) {
    return engine.hls.audioTracks.map((track, idx) => ({
      id: idx,
      label: track.name || `Track ${idx + 1}`,
      language: track.lang || "unknown",
    }));
  }

  if (engine.engine === "dash" && engine.dash) {
    const tracks = engine.dash.getBitrateInfoListFor("audio");
    return tracks?.map((track: any, idx: number) => ({
      id: idx,
      label: track.label || `Track ${idx + 1}`,
      language: track.lang || "unknown",
    })) || [];
  }

  return [];
}

export function setAudioTrack(engine: AttachResult, trackId: number) {
  if (engine.engine === "hls" && engine.hls) {
    engine.hls.audioTrack = trackId;
  }

  if (engine.engine === "dash" && engine.dash) {
    engine.dash.setCurrentTrack(engine.dash.getTracksFor("audio")[trackId]);
  }
}
