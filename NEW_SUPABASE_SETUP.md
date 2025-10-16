# 🚀 ARFLIX Nieuw Supabase Project Setup

## Waarom Nieuw Project?

**Huidig probleem:**
- ✅ Project: 7030 GB verbruikt (limiet: 5 GB)
- 💰 Kost: ~$630/maand bij doorgang
- 🐌 Resultaat: Throttling/restricties

**Na optimalisatie:**
- ✅ Verwacht: <1 GB/maand
- 💰 Besparing: 99.9%
- 🚀 Geen throttling meer!

---

## Stap 1: Maak Nieuw Supabase Project

1. **Ga naar:** https://supabase.com/dashboard
2. **Klik:** "New Project" button
3. **Vul in:**
   - Name: `arflix-optimized`
   - Database Password: Genereer en **BEWAAR** deze!
   - Region: `Europe West (London)` (dichtst bij NL)
   - Pricing Plan: `Free` (5 GB included)
4. **Wacht:** ~2 minuten tot project ready is

---

## Stap 2: Setup Database

1. **Open:** Nieuw project → SQL Editor (linker menu)
2. **Klik:** "New Query"
3. **Kopieer en plak:** Hele inhoud van `setup-database-optimized.sql`
4. **Run:** Klik op "Run" of druk Ctrl+Enter
5. **Verify:** Zie "Success" message

Dit creëert:
- ✅ Users table (auth)
- ✅ Watchlist table
- ✅ Progress tracking table
- ✅ Row Level Security policies

---

## Stap 3: Deploy Essentiële Functions

### A. Login bij Supabase CLI

```bash
supabase login
```

Volg de browser flow om in te loggen.

### B. Link Project

```bash
cd /workspaces/ARFLIX1
supabase link --project-ref JOUW_NIEUWE_PROJECT_ID
```

**Waar vind je PROJECT_ID?**
- Supabase Dashboard → Settings → General → Reference ID

### C. Deploy Functions

```bash
export SUPABASE_PROJECT_ID=jouw_nieuwe_project_id
./deploy-optimized.sh
```

Dit deployt **alleen**:
- ✅ catalog-* (metadata)
- ✅ tmdb-proxy (posters)
- ✅ fetch-subtitles (klein)
- ✅ addon-* (management)

Dit deployt **NIET** (bandwidth hogs):
- ❌ proxy-video
- ❌ proxy-subtitle

---

## Stap 4: Update Environment Variables

### A. Haal nieuwe credentials op

1. Ga naar: Nieuw project → Settings → API
2. Kopieer:
   - **Project URL:** `https://NIEUWE_ID.supabase.co`
   - **Anon/Public Key:** `eyJh...` (lange key)

### B. Update .env file

```bash
cd /workspaces/ARFLIX1
nano .env
```

Vervang:
```bash
# OUDE (7000 GB)
VITE_SUPABASE_URL=https://guzjdzntmqglaxripphb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...oud...

# NIEUWE (optimized)
VITE_SUPABASE_URL=https://NIEUWE_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...nieuw...
```

Bewaar: `Ctrl+X`, dan `Y`, dan `Enter`

---

## Stap 5: Test Nieuwe Setup

```bash
# Stop oude server
# Ctrl+C in terminal waar npm run dev draait

# Start nieuwe server
npm run dev
```

Open: http://localhost:5176

**Test:**
1. ✅ Homepage laadt (catalog werkt)
2. ✅ Posters zichtbaar (tmdb-proxy werkt)
3. ✅ Click op content → Details pagina (catalog-meta werkt)
4. ✅ Play video → Streams laden (catalog-streams werkt)
5. ✅ Video speelt (direct streaming, geen proxy!)
6. ✅ Subtitles laden (fetch-subtitles werkt)

---

## Stap 6: Verwijder Oude Project (Optioneel)

**Wacht eerst 1 week** om zeker te zijn dat nieuwe setup werkt!

Dan:
1. Ga naar: Oud project → Settings → General
2. Scroll naar beneden: "Pause Project" of "Delete Project"
3. Bevestig

---

## Verwacht Resultaat

### Bandwidth Usage

| Functie | Voor | Na | Besparing |
|---------|------|-----|-----------|
| Video Streaming | 7000 GB | 0 GB | 100% |
| Subtitle Proxy | 20 GB | 0 GB | 100% |
| Metadata API | 10 GB | 0.5 GB | 95% |
| **TOTAAL** | **7030 GB** | **<1 GB** | **99.9%** |

### Kosten

- **Voor:** $630/maand (bij $0.09/GB)
- **Na:** $0/maand (binnen free tier)
- **Besparing:** $7,560/jaar! 💰

---

## Troubleshooting

### "supabase: command not found"

```bash
npm install -g supabase
```

### "Failed to link project"

Check project ID in Supabase Dashboard → Settings → General

### "Functions deployment failed"

Zorg dat je bent ingelogd:
```bash
supabase login
supabase projects list
```

### "CORS errors"

Edge functions hebben al CORS headers. Check of VITE_SUPABASE_URL correct is in .env

---

## Hulp Nodig?

1. Check Supabase logs: Dashboard → Logs
2. Check browser console: F12 → Console
3. Check function logs: Dashboard → Edge Functions → Select function → Logs

---

✅ **Na deze stappen heb je:**
- Nieuw Supabase project zonder bandwidth problemen
- Dezelfde functionaliteit als voor
- 99.9% minder bandwidth verbruik
- Geen throttling meer
- Gratis blijven binnen 5 GB limiet

🎉 **Succes!**
