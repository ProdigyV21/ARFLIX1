import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY');
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

interface TMDBProxyRequest {
  endpoint: string;
  method?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate API key
    if (!TMDB_API_KEY) {
      throw new Error('TMDB_API_KEY not configured');
    }

    const { endpoint, method = 'GET' } = await req.json() as TMDBProxyRequest;

    // Validate endpoint
    if (!endpoint || !endpoint.startsWith('/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid endpoint' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Build TMDB URL
    const separator = endpoint.includes('?') ? '&' : '?';
    const tmdbUrl = `${TMDB_BASE_URL}${endpoint}${separator}api_key=${TMDB_API_KEY}`;

    console.log(`Proxying TMDB request: ${endpoint}`);

    // Forward request to TMDB
    const tmdbResponse = await fetch(tmdbUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!tmdbResponse.ok) {
      throw new Error(`TMDB API error: ${tmdbResponse.status} ${tmdbResponse.statusText}`);
    }

    const data = await tmdbResponse.json();

    return new Response(
      JSON.stringify(data),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('TMDB Proxy error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
