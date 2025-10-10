export type Platform = 'web' | 'android_tv' | 'desktop' | 'ios';

export type DeviceCapabilities = {
  platform: Platform;
  maxHeight: number;
  supportsHDR: boolean;
  supportsPiP: boolean;
  supportsCast: boolean;
  supportsWakeLock: boolean;
  supportsMediaSession: boolean;
  containerWhitelist: string[];
  audioCodecs: {
    allowed: string[];
    disallowed: string[];
  };
  videoCodecs: {
    allowed: string[];
    disallowed: string[];
  };
  supportsHLS: boolean;
  supportsDASH: boolean;
};

let cachedCapabilities: DeviceCapabilities | null = null;

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('electron')) return 'desktop';
  if (ua.includes('androidtv') || (ua.includes('android') && ua.includes('tv'))) return 'android_tv';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';

  return 'web';
}

function isChromiumBrowser(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('chrome') || ua.includes('edge') || ua.includes('chromium');
}

function isSafariBrowser(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('safari') && !ua.includes('chrome');
}

export async function getDeviceCapabilities(): Promise<DeviceCapabilities> {
  if (cachedCapabilities) {
    return cachedCapabilities;
  }

  const platform = detectPlatform();
  const isChrome = isChromiumBrowser();
  const isSafari = isSafariBrowser();

  const caps: DeviceCapabilities = {
    platform,
    maxHeight: 2160,
    supportsHDR: false,
    supportsPiP: 'pictureInPictureEnabled' in document,
    supportsCast: false,
    supportsWakeLock: 'wakeLock' in navigator,
    supportsMediaSession: 'mediaSession' in navigator,
    containerWhitelist: ['mp4', 'm4v', 'm3u8', 'application/vnd.apple.mpegurl', 'application/x-mpegurl'],
    audioCodecs: {
      allowed: ['aac', 'mp3', 'opus', 'vorbis'],
      disallowed: ['ac3', 'eac3', 'e-ac3', 'dd+', 'ddp', 'truehd', 'dts', 'dts-hd', 'dtshd', 'dts-ma', 'atmos', 'flac']
    },
    videoCodecs: {
      allowed: ['h264', 'h.264', 'avc', 'avc1', 'vp9', 'av1'],
      disallowed: isChrome ? ['hevc', 'h265', 'h.265', 'hvc1'] : []
    },
    supportsHLS: true,
    supportsDASH: true
  };

  if (platform === 'android_tv') {
    caps.containerWhitelist = ['mp4', 'mkv', 'm3u8', 'ts', 'm4v'];
    caps.audioCodecs.allowed = ['aac', 'mp3', 'ac3', 'eac3', 'e-ac3', 'dts', 'truehd', 'opus'];
    caps.audioCodecs.disallowed = [];
    caps.videoCodecs.allowed = ['h264', 'h.264', 'avc', 'hevc', 'h265', 'h.265', 'vp9', 'av1'];
    caps.videoCodecs.disallowed = [];
  } else if (platform === 'desktop') {
    caps.containerWhitelist = ['*'];
    caps.audioCodecs.allowed = ['*'];
    caps.audioCodecs.disallowed = [];
    caps.videoCodecs.allowed = ['*'];
    caps.videoCodecs.disallowed = [];
  } else if (platform === 'ios') {
    caps.containerWhitelist = ['m3u8', 'mp4', 'm4v', 'mov'];
    caps.audioCodecs.allowed = ['aac', 'eac3', 'e-ac3', 'mp3'];
    caps.audioCodecs.disallowed = ['ac3', 'dts', 'truehd', 'dts-hd', 'flac'];
    caps.videoCodecs.allowed = ['h264', 'h.264', 'avc', 'hevc', 'h265', 'h.265'];
  } else if (isSafari) {
    caps.audioCodecs.allowed.push('eac3', 'e-ac3');
  }

  if ('mediaCapabilities' in navigator) {
    try {
      const supports4K = await navigator.mediaCapabilities.decodingInfo({
        type: 'file',
        video: {
          contentType: 'video/mp4; codecs="avc1.64002a"',
          width: 3840,
          height: 2160,
          bitrate: 20000000,
          framerate: 30,
        },
      });

      if (!supports4K.supported) {
        const supports1080 = await navigator.mediaCapabilities.decodingInfo({
          type: 'file',
          video: {
            contentType: 'video/mp4; codecs="avc1.640028"',
            width: 1920,
            height: 1080,
            bitrate: 8000000,
            framerate: 30,
          },
        });

        caps.maxHeight = supports1080.supported ? 1080 : 720;
      }

      const supportsHDR10 = await navigator.mediaCapabilities.decodingInfo({
        type: 'file',
        video: {
          contentType: 'video/mp4; codecs="hev1.2.4.L153.B0"',
          width: 1920,
          height: 1080,
          bitrate: 10000000,
          framerate: 30,
          transferFunction: 'pq',
        },
      });

      caps.supportsHDR = supportsHDR10.supported;
    } catch (error) {
      console.log('MediaCapabilities check failed:', error);
    }
  }

  if ('chrome' in window && 'cast' in (window as any).chrome) {
    caps.supportsCast = true;
  }

  cachedCapabilities = caps;
  return caps;
}

export function isCapabilitySupported(capability: string, caps: DeviceCapabilities, type: 'container' | 'audio' | 'video'): boolean {
  const normalized = capability.toLowerCase().trim();

  if (type === 'container') {
    if (caps.containerWhitelist.includes('*')) return true;
    return caps.containerWhitelist.some(c => normalized.includes(c));
  }

  if (type === 'audio') {
    if (caps.audioCodecs.allowed.includes('*')) return true;
    const isDisallowed = caps.audioCodecs.disallowed.some(c => normalized.includes(c));
    if (isDisallowed) return false;
    return caps.audioCodecs.allowed.some(c => normalized.includes(c));
  }

  if (type === 'video') {
    if (caps.videoCodecs.allowed.includes('*')) return true;
    const isDisallowed = caps.videoCodecs.disallowed.some(c => normalized.includes(c));
    if (isDisallowed) return false;
    return caps.videoCodecs.allowed.some(c => normalized.includes(c));
  }

  return false;
}
