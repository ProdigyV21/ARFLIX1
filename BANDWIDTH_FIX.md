# 🚨 Bandwidth Fix - 7000 GB → 0 GB

## Probleem
Je Supabase project verbruikt 7030 GB omdat alle video streams door de `proxy-video` functie gaan.

## Oplossing: Direct Streaming

### Stap 1: Verwijder Proxy Usage

De app gebruikt al direct streaming! De proxy wordt alleen gebruikt voor:
1. HEAD requests (file size check) - al geskipped
2. CORS workaround (niet meer nodig)

### Stap 2: Maak Nieuw Supabase Project

1. Ga naar https://supabase.com/dashboard
2. Klik op "New Project"
3. Naam: `arflix-optimized`
4. Regio: Kies dichtstbijzijnde (Europe West voor NL)
5. Database Password: Genereer sterk wachtwoord (bewaar deze!)

### Stap 3: Deploy Alleen Essentiële Functions

Behoud:
- ✅ `catalog-*` (metadata)
- ✅ `tmdb-proxy` (posters/info)
- ✅ `fetch-subtitles` (klein)
- ✅ `addon-*` (management)

Verwijder:
- ❌ `proxy-video` (7000+ GB verbruik!)
- ❌ `proxy-subtitle` (nog steeds MB's per request)

### Stap 4: Database Setup

```sql
-- Run dit in je nieuwe Supabase SQL Editor
-- Kopieer van setup-database.sql maar zonder onnodige tables
```

### Stap 5: Update Environment Variables

```bash
# Oude (7000 GB verbruikt)
VITE_SUPABASE_URL=https://guzjdzntmqglaxripphb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...oude key...

# Nieuw (fresh start)
VITE_SUPABASE_URL=https://NIEUWE_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=nieuwe_anon_key
```

### Verwacht Resultaat

**Voor:** 7030 GB/maand (video proxy)
**Na:** <1 GB/maand (alleen metadata + subtitles)

**Besparing:** 99.99% minder bandwidth! 🎉
