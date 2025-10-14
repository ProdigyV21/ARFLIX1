import { DeviceCapabilities, isCapabilitySupported } from './deviceCapabilities';

export function isBrowserPlayableAudio(label?: string, codec?: string): boolean {
  if (!label && !codec) return true;

  const text = `${label || ''} ${codec || ''}`.toLowerCase();

  // Block known passthrough-only audio codecs
  if (text.includes('ec-3') || text.includes('eac3') || text.includes('ac-3') ||
      text.includes('ac3') || text.includes('dts') || text.includes('atmos') ||
      text.includes('truehd')) {
    return false;
  }

  // Prefer AAC/MP4A
  return text.includes('aac') || text.includes('mp4a') || text.includes('mp3') || !codec;
}

export interface StreamClassification {
  container?: string;
  audioCodec?: string;
  videoCodec?: string;
  resolution?: string;
  isHDR?: boolean;
  contentType?: string;
  isPlayable: boolean;
  incompatibilityReasons: string[];
  score: number;
}

export interface StreamWithClassification {
  url: string;
  title: string;
  quality?: string;
  kind: 'hls' | 'dash' | 'mp4' | 'unknown';
  classification: StreamClassification;
}

const CODEC_PATTERNS = {
  audio: {
    aac: /\b(aac|mp4a)\b/i,
    mp3: /\bmp3\b/i,
    ac3: /\b(ac-?3|dolby\s*digital(?!\s*plus))\b/i,
    eac3: /\b(e-?ac-?3|eac3|dd\+|ddp|dolby\s*digital\s*plus)\b/i,
    truehd: /\b(truehd|true-?hd)\b/i,
    dts: /\b(dts(?![-.]hd)?|dts-?ma)\b/i,
    dtshd: /\b(dts[-.]hd|dts-?hd)\b/i,
    atmos: /\batmos\b/i,
    flac: /\bflac\b/i,
    opus: /\bopus\b/i,
    vorbis: /\bvorbis\b/i
  },
  video: {
    h264: /\b(h\.?264|avc1?|x264)\b/i,
    hevc: /\b(h\.?265|hevc|hvc1|x265)\b/i,
    vp9: /\bvp9\b/i,
    av1: /\bav1\b/i
  },
  container: {
    mkv: /\.mkv\b|matroska/i,
    mp4: /\.mp4\b|\.m4v\b/i,
    m3u8: /\.m3u8\b|application\/vnd\.apple\.mpegurl|application\/x-mpegurl/i,
    ts: /\.ts\b/i
  },
  resolution: {
    '4K': /\b(2160p|4k|uhd)\b/i,
    '1080p': /\b1080p?\b/i,
    '720p': /\b720p?\b/i,
    '480p': /\b480p?\b/i
  },
  hdr: /\b(hdr|hdr10|dolby\s*vision|dv|hlg)\b/i,
  lowQuality: /\b(cam|camrip|cam-rip|hdcam|ts|telesync|tele-sync|r5|dvdscr|screener|workprint|telecine)\b/i,
  ads: /\b(ad|ads|advertisement|advertisements|promo|sponsor)\b/i
};

export function classifyStream(
  url: string,
  title: string,
  caps: DeviceCapabilities,
  contentType?: string
): StreamClassification {
  const text = `${url} ${title}`.toLowerCase();
  const classification: StreamClassification = {
    isPlayable: true,
    incompatibilityReasons: [],
    score: 0
  };

  if (contentType) {
    classification.contentType = contentType;

    if (contentType.includes('matroska')) {
      classification.container = 'mkv';
    } else if (contentType.includes('mp4')) {
      classification.container = 'mp4';
    } else if (contentType.includes('mpegurl')) {
      classification.container = 'm3u8';
    }
  }

  for (const [codec, pattern] of Object.entries(CODEC_PATTERNS.audio)) {
    if (pattern.test(text)) {
      classification.audioCodec = codec;
      break;
    }
  }

  for (const [codec, pattern] of Object.entries(CODEC_PATTERNS.video)) {
    if (pattern.test(text)) {
      classification.videoCodec = codec;
      break;
    }
  }

  // Check URL directly for m3u8 (HLS)
  if (url.includes('.m3u8') || url.includes('m3u8')) {
    classification.container = 'm3u8';
  }

  if (!classification.container) {
    for (const [container, pattern] of Object.entries(CODEC_PATTERNS.container)) {
      if (pattern.test(text)) {
        classification.container = container;
        break;
      }
    }
  }

  for (const [res, pattern] of Object.entries(CODEC_PATTERNS.resolution)) {
    if (pattern.test(text)) {
      classification.resolution = res;
      break;
    }
  }

  classification.isHDR = CODEC_PATTERNS.hdr.test(text);

  classification.score = calculateCompatibilityScore(classification, caps);

  // Apply penalties for bad quality indicators
  const qualityPenalty = hasBadQualityIndicators(url, title);
  classification.score -= qualityPenalty;

  const incompatibilities = checkIncompatibilities(classification, caps);
  if (incompatibilities.length > 0) {
    classification.isPlayable = false;
    classification.incompatibilityReasons = incompatibilities;
  }

  return classification;
}

function calculateCompatibilityScore(
  classification: StreamClassification,
  caps: DeviceCapabilities
): number {
  let score = 0;

  // Container compatibility check (required)
  if (classification.container) {
    const containerOk = isCapabilitySupported(classification.container, caps, 'container');
    score += containerOk ? 100 : -1000;
  }

  // Audio codec compatibility - minimal penalty for MKV since they're proxied
  if (classification.audioCodec) {
    const audioOk = isCapabilitySupported(classification.audioCodec, caps, 'audio');

    if (audioOk) {
      score += 50;
      
      // Small bonus for AAC/MP3 but don't prioritize it heavily
      if (classification.audioCodec === 'aac' || classification.audioCodec === 'mp3') {
        score += 10;
      }
    } else {
      // Small penalty for incompatible audio since backend will handle it
      score -= 50; // Was -500, now much smaller
    }
  }

  // Video codec compatibility
  if (classification.videoCodec) {
    const videoOk = isCapabilitySupported(classification.videoCodec, caps, 'video');
    score += videoOk ? 50 : -500;
  }

  // Container format preferences - HEAVILY prefer MKV for embedded subtitles
  if (classification.container === 'mkv') {
    score += 1000; // MASSIVE bonus for MKV (embedded subtitle support)
    console.log('[StreamClassifier] 🎯 MKV container bonus: +1000 points');
  } else if (classification.container === 'm3u8') {
    score += 500; // HLS for subtitle support
  } else if (classification.container === 'mp4') {
    score += 15; // MP4 is playable but no embedded subs
  }

  // Resolution scoring - High priority but LESS than container preference
  // We want MKV to win even if it's lower resolution
  const resolutionValue = {
    '4K': 2160,
    '1080p': 1080,
    '720p': 720,
    '480p': 480
  }[classification.resolution || ''] || 1080;

  // Reduced multiplier from 20 to 5 so MKV bonus (1000) beats resolution difference
  // A 1080p MKV gets: base + 1000 (mkv) + 540 (resolution) = 1540
  // A 4K MP4 gets: base + 15 (mp4) + 1080 (resolution) = 1095
  // So MKV wins!
  score += (resolutionValue / 10) * 5;

  return score;
}

function hasBadQualityIndicators(url: string, title: string): number {
  const text = `${url} ${title}`.toLowerCase();
  let penalty = 0;

  // Heavily penalize cam/low quality releases
  if (CODEC_PATTERNS.lowQuality.test(text)) {
    penalty += 5000;
  }

  // Penalize streams with ads
  if (CODEC_PATTERNS.ads.test(text)) {
    penalty += 3000;
  }

  return penalty;
}

function checkIncompatibilities(
  classification: StreamClassification,
  caps: DeviceCapabilities
): string[] {
  const reasons: string[] = [];

  // MKV files are proxied by the backend, so they're playable
  // No need to check MKV compatibility anymore

  if (classification.audioCodec) {
    // Allow all audio codecs since they'll be transcoded by the proxy if needed
    // Only warn about truly incompatible ones
    const incompatibleAudioCodecs = ['truehd', 'atmos', 'dtshd'];
    if (incompatibleAudioCodecs.includes(classification.audioCodec)) {
      const audioName = classification.audioCodec.toUpperCase();
      reasons.push(`${audioName} audio may require transcoding`);
    }
  }

  if (classification.videoCodec) {
    // Most video codecs are supported or will be transcoded
    // Only check for truly problematic ones
    if (!isCapabilitySupported(classification.videoCodec, caps, 'video')) {
      const videoName = classification.videoCodec.toUpperCase();
      // Don't mark as incompatible, just log
      console.log(`[StreamClassifier] ${videoName} video codec may require transcoding`);
    }
  }

  if (classification.resolution) {
    const resolutionValue = {
      '4K': 2160,
      '1080p': 1080,
      '720p': 720,
      '480p': 480
    }[classification.resolution] || 0;

    // No resolution caps - allow all resolutions
  }

  return reasons;
}

export async function classifyStreamWithContentType(
  url: string,
  title: string,
  caps: DeviceCapabilities,
  proxyUrl: string
): Promise<StreamClassification> {
  let contentType: string | undefined;

  try {
    const headUrl = `${proxyUrl}?url=${encodeURIComponent(url)}&head=1`;
    const response = await fetch(headUrl, { method: 'GET' });
    contentType = response.headers.get('content-type') || undefined;
    console.log('[StreamClassifier] Content-Type for', url.substring(0, 80), ':', contentType);
  } catch (e) {
    console.warn('[StreamClassifier] Failed to fetch content-type:', e);
  }

  return classifyStream(url, title, caps, contentType);
}

export function selectPlayableSource(
  streams: Array<{ url: string; title: string; quality?: string; kind: 'hls' | 'dash' | 'mp4' | 'unknown'; sizeBytes?: number }>,
  caps: DeviceCapabilities
): StreamWithClassification | null {
  const classified = streams.map(stream => ({
    ...stream,
    classification: classifyStream(stream.url, stream.title, caps)
  }));

  console.log('[StreamClassifier] Classified streams:', classified.map(s => ({
    title: s.title,
    isPlayable: s.classification.isPlayable,
    score: s.classification.score,
    audio: s.classification.audioCodec,
    video: s.classification.videoCodec,
    container: s.classification.container,
    reasons: s.classification.incompatibilityReasons
  })));

  let playable = classified.filter(s => s.classification.isPlayable);

  if (playable.length === 0) {
    console.warn('[StreamClassifier] No playable sources found!');
    return null;
  }

  // Filter out trailers/samples (streams with "trailer", "sample", "preview" in title)
  const filtered = playable.filter(s => {
    if (!s.title) return true;
    const lower = s.title.toLowerCase();
    return !lower.includes('trailer') && !lower.includes('sample') && !lower.includes('preview');
  });

  if (filtered.length > 0) {
    playable = filtered;
  }

  // ONLY use MKV streams if available (for embedded subtitles!)
  const mkvStreams = playable.filter(s =>
    s.classification.container === 'mkv' || s.url.toLowerCase().includes('.mkv')
  );

  console.log('[StreamClassifier] 🎬 MKV streams found:', mkvStreams.length);
  console.log('[StreamClassifier] Total playable streams:', playable.length);
  
  if (mkvStreams.length > 0) {
    console.log('[StreamClassifier] Sample MKV streams:', mkvStreams.slice(0, 5).map(s => ({
      title: s.title?.substring(0, 60),
      score: s.classification.score,
      audio: s.classification.audioCodec,
      container: s.classification.container,
      resolution: s.classification.resolution
    })));
  } else {
    console.log('[StreamClassifier] ⚠️ NO MKV streams available - falling back to MP4');
    console.log('[StreamClassifier] Sample streams:', playable.slice(0, 10).map(s => ({
      title: s.title?.substring(0, 60),
      score: s.classification.score,
      audio: s.classification.audioCodec,
      container: s.classification.container
    })));
  }

  // Use MKV ONLY if available, otherwise fallback to any playable
  let candidates: typeof playable;

  if (mkvStreams.length > 0) {
    console.log('[StreamClassifier] 🎯 USING MKV STREAMS ONLY (embedded subtitles!)');
    candidates = mkvStreams;
  } else {
    console.log('[StreamClassifier] ⚠️ No MKV streams - using fallback (no embedded subs)');
    candidates = playable;
  }

  // Filter out non-English content (foreign language audio tracks)
  const foreignLanguageKeywords = ['FRENCH', 'SPANISH', 'GERMAN', 'ITALIAN', 'PORTUGUESE', 'RUSSIAN', 'JAPANESE', 'CHINESE', 'KOREAN', 'HINDI', 'ARABIC', 'TURKISH', 'POLISH', 'DUTCH', 'SWEDISH', 'NORWEGIAN', 'DANISH', 'FINNISH'];
  const englishCandidates = candidates.filter(c => {
    const title = c.title?.toUpperCase() || '';
    return !foreignLanguageKeywords.some(lang => title.includes(lang));
  });

  // Use English candidates if available, otherwise fall back to all candidates
  const finalCandidates = englishCandidates.length > 0 ? englishCandidates : candidates;

  // Sort by size first (bigger is better), then by score, then by resolution height in title
  finalCandidates.sort((a, b) => {
    const sizeA = (a as any).sizeBytes || 0;
    const sizeB = (b as any).sizeBytes || 0;
    const bySize = sizeB - sizeA;
    if (bySize !== 0) return bySize;
    const byScore = b.classification.score - a.classification.score;
    if (byScore !== 0) return byScore;
    const height = (t?: string) => {
      const m = (t || '').match(/(2160|1080|720|480)p/i);
      return m ? parseInt(m[1], 10) : 0;
    };
    return height(b.title) - height(a.title);
  });

  console.log('[StreamClassifier] Top 5 candidates:', finalCandidates.slice(0, 5).map(c => ({
    title: c.title?.substring(0, 60),
    score: c.classification.score,
    audio: c.classification.audioCodec
  })));

  console.log('[StreamClassifier] Best source:', {
    title: finalCandidates[0].title,
    score: finalCandidates[0].classification.score,
    audio: finalCandidates[0].classification.audioCodec,
    container: finalCandidates[0].classification.container
  });

  return finalCandidates[0];
}

export function getCodecBadge(classification: StreamClassification): { text: string; compatible: boolean } {
  if (classification.audioCodec === 'aac') {
    return { text: 'AAC ✅', compatible: true };
  }

  if (classification.audioCodec && ['ac3', 'eac3', 'dts', 'dtshd', 'truehd', 'atmos'].includes(classification.audioCodec)) {
    const name = classification.audioCodec.toUpperCase();
    return { text: `${name} 🚫 Web`, compatible: false };
  }

  if (classification.container === 'mkv') {
    return { text: 'MKV 🎬 (Subs)', compatible: true }; // MKV is proxied and has embedded subs!
  }

  if (classification.container === 'm3u8') {
    return { text: 'HLS ✅', compatible: true };
  }

  if (classification.container === 'mp4') {
    return { text: 'MP4 ✅', compatible: true };
  }

  return { text: 'Unknown', compatible: false };
}
