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
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const params = new URLSearchParams({ id: contentId });
  if (season !== undefined) params.set('season', season.toString());
  if (episode !== undefined) params.set('episode', episode.toString());

  const url = `${supabaseUrl}/functions/v1/catalog-subtitles?${params}`;
  console.log('[fetchSubtitles] Requesting:', url);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error('Failed to fetch subtitles:', response.status);
    return [];
  }

  const data = await response.json();
  console.log('[fetchSubtitles] Response:', data);
  console.log('[fetchSubtitles] First subtitle URL:', data.subtitles?.[0]?.url);
  return data.subtitles || [];
}

export function getSubtitleProxyUrl(subtitleUrl: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/proxy-subtitle?url=${encodeURIComponent(subtitleUrl)}`;
}
