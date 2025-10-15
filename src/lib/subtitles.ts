export interface Subtitle {
  id: string;
  language: string;
  languageCode: string;
  url: string;
  label: string;
  format: string;
}

// Built-in subtitle addon manifests (always enabled)
const BUILTIN_SUBTITLE_ADDONS = [
  'https://opensubtitles-v3.strem.io/manifest.json',
  'https://subscene.strem.io/manifest.json'
];

export async function fetchSubtitles(
  contentId: string,
  contentType: string,
  season?: number,
  episode?: number
): Promise<Subtitle[]> {
  try {
    // Convert TMDB ID to IMDb ID if needed
    let imdbId = contentId;
    if (contentId.startsWith('tmdb:')) {
      const tmdbId = contentId.replace('tmdb:', '');
      const { getExternalIds } = await import('./externalIds');
      const externalIds = await getExternalIds({
        type: contentType === 'series' ? 'series' : 'movie',
        tmdbId: parseInt(tmdbId)
      });
      
      if (externalIds.imdbId) {
        imdbId = externalIds.imdbId;
        console.log('[fetchSubtitles] Converted TMDB ID to IMDb ID:', imdbId);
      } else {
        console.warn('[fetchSubtitles] No IMDb ID found for TMDB ID:', contentId);
        return [];
      }
    }

    // Build video ID for Stremio addons
    let videoId = imdbId;
    if (contentType === 'series' && season && episode) {
      videoId = `${imdbId}:${season}:${episode}`;
    }

    const allSubtitles: Subtitle[] = [];

    // Query built-in subtitle addons directly
    for (const manifestUrl of BUILTIN_SUBTITLE_ADDONS) {
      try {
        const addonName = manifestUrl.includes('opensubtitles') ? 'OpenSubtitles' : 'Subscene';
        console.log(`[fetchSubtitles] Fetching from ${addonName}...`);

        // Build subtitles URL
        const subtitlesUrl = manifestUrl.replace("/manifest.json", "") + 
          `/subtitles/${contentType}/${videoId}.json`;
        
        console.log(`[fetchSubtitles] ${addonName} URL:`, subtitlesUrl);

        const response = await fetch(subtitlesUrl, {
          headers: {
            'User-Agent': 'ArFlix v1.0'
          }
        });

        if (!response.ok) {
          console.warn(`[fetchSubtitles] ${addonName} returned ${response.status}`);
          continue;
        }

        const data = await response.json();
        
        if (data.subtitles && Array.isArray(data.subtitles)) {
          console.log(`[fetchSubtitles] Found ${data.subtitles.length} subtitles from ${addonName}`);
          
          // Filter for English subtitles and add to results
          for (const sub of data.subtitles) {
            const langCode = sub.lang?.toLowerCase() || '';
            
            // Only add English subtitles
            if (langCode === 'en' || langCode === 'eng' || langCode === 'english') {
              allSubtitles.push({
                id: sub.id || `${addonName}-${allSubtitles.length}`,
                language: 'English',
                languageCode: 'en',
                url: sub.url,
                label: `English (${addonName})`,
                format: 'srt'
              });
            }
          }
        }
      } catch (addonError: any) {
        console.error(`[fetchSubtitles] Error fetching from addon:`, addonError.message);
      }
    }

    if (allSubtitles.length === 0) {
      console.info('[fetchSubtitles] No English subtitles available');
      return [];
    }

    console.log(`[fetchSubtitles] Total English subtitles found: ${allSubtitles.length}`);

    // Cache results in-memory for 1h to avoid repeated fetches
    try {
      const key = `subs:${contentId}:${season || ''}:${episode || ''}`;
      const payload = { ts: Date.now(), items: allSubtitles };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {}

    return allSubtitles;
  } catch (error: any) {
    console.error('[fetchSubtitles] Error fetching subtitles:', error);
    return [];
  }
}

export async function fetchSubtitlesWithCache(
  contentId: string,
  contentType: string,
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
  return fetchSubtitles(contentId, contentType, season, episode);
}

export function getLangCode(osLang: string): string {
  const map: Record<string, string> = {
    'eng': 'en', 'spa': 'es', 'fre': 'fr', 'ger': 'de',
    'ita': 'it', 'por': 'pt', 'jpn': 'ja', 'kor': 'ko',
    'chi': 'zh', 'ara': 'ar',
  };
  return map[osLang] || osLang;
}

export function getLangLabel(langCode: string): string {
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
