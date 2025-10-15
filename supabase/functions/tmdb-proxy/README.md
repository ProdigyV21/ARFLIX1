# TMDB Proxy - Deployment Guide

## Waarom een Proxy?

De TMDB API key wordt verplaatst naar een Supabase Edge Function om:
- ✅ **Security**: API key is niet zichtbaar in frontend code
- ✅ **Rate Limiting**: Centraal beheer van API calls
- ✅ **Caching**: Mogelijk om responses te cachen
- ✅ **Monitoring**: Logs van alle TMDB requests

## Deployment Stappen

### 1. Installeer Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Linux/Windows WSL
curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh
```

### 2. Login bij Supabase

```bash
supabase login
```

### 3. Link je project

```bash
cd /workspaces/ARFLIX1
supabase link --project-ref your-project-ref
```

### 4. Deploy de Edge Function

```bash
supabase functions deploy tmdb-proxy
```

### 5. Stel TMDB_API_KEY Secret in

```bash
supabase secrets set TMDB_API_KEY=your_actual_tmdb_api_key_here
```

Of via de Supabase Dashboard:
1. Ga naar https://app.supabase.com/project/_/settings/functions
2. Klik op "Edge Function Secrets"
3. Voeg toe: `TMDB_API_KEY` met je API key

### 6. Test de Function

```bash
curl -X POST https://your-project.supabase.co/functions/v1/tmdb-proxy \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"endpoint": "/trending/movie/week?language=en-US"}'
```

## Frontend Configuratie

In `src/lib/tmdb.ts`:
```typescript
const USE_PROXY = true; // Gebruik proxy (production)
// const USE_PROXY = false; // Direct API calls (local development)
```

## Local Development

Voor local development kun je de Edge Function lokaal draaien:

```bash
# Start local Supabase
supabase start

# Deploy function locally
supabase functions serve tmdb-proxy --env-file .env
```

Of zet `USE_PROXY = false` in tmdb.ts en gebruik de fallback.

## Monitoring

Check logs in Supabase Dashboard:
- https://app.supabase.com/project/_/logs/edge-functions

## Rollback

Als er problemen zijn, zet `USE_PROXY = false` in tmdb.ts om terug te gaan naar directe API calls.

## Cost

Supabase Edge Functions zijn gratis tot:
- 500K invocations/month
- 2GB bandwidth/month

TMDB API is gratis met rate limit van 50 requests/second.
