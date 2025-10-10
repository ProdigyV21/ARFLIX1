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
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!contentId) {
      console.warn('[fetchSubtitles] No content ID provided');
      return [];
    }

    const params = new URLSearchParams({ id: contentId });
    if (season !== undefined && season > 0) params.set('season', season.toString());
    if (episode !== undefined && episode > 0) params.set('episode', episode.toString());

    const url = `${supabaseUrl}/functions/v1/catalog-subtitles?${params}`;
    console.log('[fetchSubtitles] Requesting:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('[fetchSubtitles] HTTP', response.status);
      return [];
    }

    const data = await response.json();
    const subtitles = (data?.subtitles || []).filter(
      (sub: any) => sub?.url && (sub.language || sub.languageCode || sub.label)
    );

    if (subtitles.length === 0) {
      console.info('[fetchSubtitles] No subtitles available for this content');
    } else {
      console.log('[fetchSubtitles] Found', subtitles.length, 'subtitles');
    }

    return subtitles;
  } catch (error: any) {
    console.warn('[fetchSubtitles] Error:', error.message);
    return [];
  }
}

export function getSubtitleProxyUrl(subtitleUrl: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/proxy-subtitle?url=${encodeURIComponent(subtitleUrl)}`;
}
