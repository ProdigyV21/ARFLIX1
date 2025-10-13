export interface Subtitle {
  id: string;
  language: string;
  languageCode: string;
  url: string;
  label: string;
  format: string;
}

export async function fetchSubtitles(
  contentId: string,
  season?: number,
  episode?: number
): Promise<Subtitle[]> {
  try {
    // Fetch directly from OpenSubtitles REST API (client-side fetching works!)
    const imdbId = contentId.startsWith('tt') ? contentId.replace('tt', '') : contentId;

    const osUrl = (season && episode)
      ? `https://rest.opensubtitles.org/search/episode-${episode}/imdbid-${imdbId}/season-${season}/sublanguageid-all`
      : `https://rest.opensubtitles.org/search/imdbid-${imdbId}/sublanguageid-all`;

    console.log('[fetchSubtitles] Fetching from OpenSubtitles (client-side):', osUrl);

    const response = await fetch(osUrl, {
      headers: {
        'User-Agent': 'Arflix v1.0'
      }
    });

    if (!response.ok) {
      console.warn('[fetchSubtitles] OpenSubtitles response not OK:', response.status);
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.info('[fetchSubtitles] No subtitles available');
      return [];
    }

    console.log('[fetchSubtitles] Found', data.length, 'subtitles from OpenSubtitles');

    // Take up to 10 unique language subtitles
    const seen = new Set<string>();
    const subtitles: Subtitle[] = [];

    for (const sub of data) {
      const langCode = getLangCode(sub.SubLanguageID || sub.ISO639 || '');
      const key = `${langCode}-${sub.SubFormat}`;

      if (!seen.has(key) && sub.SubDownloadLink) {
        seen.add(key);

        subtitles.push({
          id: sub.IDSubtitleFile || sub.IDSubtitle,
          language: getLangLabel(langCode),
          languageCode: langCode,
          url: sub.SubDownloadLink,
          label: `${getLangLabel(langCode)} (${sub.SubFormat || 'srt'})`,
          format: sub.SubFormat || 'srt'
        });

        if (subtitles.length >= 10) break;
      }
    }

    // Cache results in-memory for 1h to avoid repeated fetches
    try {
      const key = `subs:${contentId}:${season || ''}:${episode || ''}`;
      const payload = { ts: Date.now(), items: subtitles };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {}

    return subtitles;
  } catch (error: any) {
    console.error('[fetchSubtitles] Error fetching subtitles:', error);
    return [];
  }
}

export async function fetchSubtitlesWithCache(
  contentId: string,
  season?: number,
  episode?: number
): Promise<Subtitle[]> {
  const key = `subs:${contentId}:${season || ''}:${episode || ''}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const { ts, items } = JSON.parse(raw);
      if (Date.now() - ts < 3600_000 && Array.isArray(items)) return items;
    }
  } catch {}
  return fetchSubtitles(contentId, season, episode);
}

function getLangCode(osLang: string): string {
  const map: Record<string, string> = {
    'eng': 'en', 'spa': 'es', 'fre': 'fr', 'ger': 'de',
    'ita': 'it', 'por': 'pt', 'jpn': 'ja', 'kor': 'ko',
    'chi': 'zh', 'ara': 'ar',
  };
  return map[osLang] || osLang;
}

function getLangLabel(langCode: string): string {
  const map: Record<string, string> = {
    'en': 'English', 'es': 'Español', 'fr': 'Français', 'de': 'Deutsch',
    'it': 'Italiano', 'pt': 'Português', 'ja': '日本語', 'ko': '한국어',
    'zh': '中文', 'ar': 'العربية',
  };
  return map[langCode] || langCode.toUpperCase();
}

export function getSubtitleProxyUrl(subtitleUrl: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/proxy-subtitle?url=${encodeURIComponent(subtitleUrl)}`;
}
