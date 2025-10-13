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

    // Fetch subtitles from backend (which uses Stremio addons)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const params = new URLSearchParams();
    params.set('id', imdbId);
    params.set('type', contentType);
    if (season !== undefined) params.set('season', season.toString());
    if (episode !== undefined) params.set('episode', episode.toString());

          const url = `${supabaseUrl}/functions/v1/catalog-subtitles?${params}`;
          console.log('[fetchSubtitles] Fetching from backend:', url);

          // Get auth session for backend request
          const { data: { session } } = await supabase.auth.getSession();
          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };
          
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }

          const response = await fetch(url, { headers });

    if (!response.ok) {
      console.warn('[fetchSubtitles] Backend response not OK:', response.status);
      return [];
    }

    const data = await response.json();

    if (!data.subtitles || !Array.isArray(data.subtitles) || data.subtitles.length === 0) {
      console.info('[fetchSubtitles] No subtitles available');
      return [];
    }

    console.log('[fetchSubtitles] Found', data.subtitles.length, 'subtitles from backend');

    // Cache results in-memory for 1h to avoid repeated fetches
    try {
      const key = `subs:${contentId}:${season || ''}:${episode || ''}`;
      const payload = { ts: Date.now(), items: data.subtitles };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {}

    return data.subtitles;
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
