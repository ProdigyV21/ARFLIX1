import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const subtitleUrl = url.searchParams.get('url');

    if (!subtitleUrl) {
      return new Response('Missing url parameter', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    console.log('[ProxySubtitle] Fetching subtitle from:', subtitleUrl);

    // Fetch the subtitle file
    const response = await fetch(subtitleUrl, {
      headers: {
        'User-Agent': 'ArFlix/1.0',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.log('[ProxySubtitle] Fetch failed:', response.status);
      return new Response(`Failed to fetch subtitle: ${response.status}`, {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    let content = await response.text();
    console.log('[ProxySubtitle] Fetched subtitle, length:', content.length);

    // Convert SRT to WebVTT if needed
    if (!content.startsWith('WEBVTT')) {
      console.log('[ProxySubtitle] Converting SRT to WebVTT');
      content = convertSrtToVtt(content);
    }

    return new Response(content, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });
  } catch (error: any) {
    console.error('[ProxySubtitle] Error:', error.message);
    return new Response(`Proxy error: ${error.message}`, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }
});

function convertSrtToVtt(srt: string): string {
  // Add WEBVTT header
  let vtt = 'WEBVTT\n\n';

  // Convert SRT timestamp format (00:00:02,300) to WebVTT format (00:00:02.300)
  vtt += srt
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2') // Replace comma with period in timestamps
    .trim();

  return vtt;
}
