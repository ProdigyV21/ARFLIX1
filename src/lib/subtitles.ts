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
  // OpenSubtitles API is not accessible from Supabase Edge Functions due to DNS/network restrictions
  // Subtitles will be loaded from embedded tracks in the video streams
  console.info('[fetchSubtitles] External subtitle API unavailable - using embedded subtitles from video streams');
  return [];
}

export function getSubtitleProxyUrl(subtitleUrl: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/proxy-subtitle?url=${encodeURIComponent(subtitleUrl)}`;
}
