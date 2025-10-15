# 🚀 ARFLIX Quick Setup Guide

## ✅ Step 1: .env Configured
Uw Supabase credentials zijn al ingevuld in `.env`:
- ✅ Project URL: `https://guzjdzntmqglaxripphb.supabase.co`
- ✅ Anon Key: Geconfigureerd

---

## 📊 Step 2: Database Setup (2 minuten)

### Optie A: Via Supabase Dashboard (Makkelijkst)

1. **Open SQL Editor:**
   ```
   https://supabase.com/dashboard/project/guzjdzntmqglaxripphb/sql/new
   ```

2. **Kopieer het complete SQL bestand:**
   - Open het bestand: `setup-database.sql` in deze workspace
   - Kopieer ALLES (Ctrl+A, Ctrl+C)

3. **Plak en Run:**
   - Plak in SQL Editor
   - Klik "Run" (of druk Ctrl+Enter)
   - ✅ Wacht tot het klaar is (~5 seconden)

### Optie B: Via Terminal

```bash
# Installeer psql (als je die nog niet hebt)
sudo apt install postgresql-client

# Run migrations (je hebt je database password nodig van Supabase)
psql "postgresql://postgres:[YOUR-DB-PASSWORD]@db.guzjdzntmqglaxripphb.supabase.co:5432/postgres" -f setup-database.sql
```

**Database password vinden:**
- Ga naar: Settings → Database → Connection string
- Kopieer het wachtwoord uit de connection string

---

## ⚡ Step 3: Edge Functions Setup (5 minuten)

We hebben 12 edge functions die gedeployed moeten worden. Dit kun je doen via:

### Optie A: Handmatig via Dashboard (Veiliger, geen CLI login nodig)

Voor elke function hieronder:

1. Ga naar: https://supabase.com/dashboard/project/guzjdzntmqglaxripphb/functions
2. Klik "Create a new function"
3. Voer function naam in (bijv. `tmdb-proxy`)
4. Kopieer code uit: `supabase/functions/[naam]/index.ts`
5. Plak en klik "Deploy"

**Functions om te deployen:**
1. ✅ `tmdb-proxy` - TMDB API proxy
2. ✅ `catalog-home` - Home page catalog
3. ✅ `catalog-meta` - Content metadata
4. ✅ `catalog-streams` - Stream links
5. ✅ `catalog-search` - Search functionality
6. ✅ `catalog-subtitles` - Subtitle fetching
7. ✅ `catalog-seasons` - TV show seasons
8. ✅ `catalog-episodes` - TV show episodes
9. ✅ `fetch-subtitles` - Subtitle downloader
10. ✅ `proxy-subtitle` - Subtitle proxy
11. ✅ `proxy-video` - Video proxy
12. ✅ `addon-catalog` - Addon catalog
13. ✅ `addon-register` - Addon registration
14. ✅ `addon-manage` - Addon management

**Shared libraries worden automatisch geïmporteerd via relative paths.**

### Optie B: Via Supabase CLI (Sneller als login werkt)

```bash
# Login (opent browser - kan issues geven in Codespaces)
npx supabase login

# Link project
npx supabase link --project-ref guzjdzntmqglaxripphb

# Deploy alle functions
npx supabase functions deploy tmdb-proxy
npx supabase functions deploy catalog-home
npx supabase functions deploy catalog-meta
npx supabase functions deploy catalog-streams
npx supabase functions deploy catalog-search
npx supabase functions deploy catalog-subtitles
npx supabase functions deploy catalog-seasons
npx supabase functions deploy catalog-episodes
npx supabase functions deploy fetch-subtitles
npx supabase functions deploy proxy-subtitle
npx supabase functions deploy proxy-video
npx supabase functions deploy addon-catalog
npx supabase functions deploy addon-register
npx supabase functions deploy addon-manage
```

---

## 🔐 Step 4: Set Edge Function Secrets

1. **Open Secrets Settings:**
   ```
   https://supabase.com/dashboard/project/guzjdzntmqglaxripphb/settings/functions
   ```

2. **Add Secret:**
   - Name: `TMDB_API_KEY`
   - Value: `080380c1ad7b3967af3def25159e4374`
   - Klik "Add secret"

✅ Dit geeft al je edge functions toegang tot de TMDB API!

---

## 🧪 Step 5: Test de App!

```bash
# Start development server
npm run dev
```

Open browser: http://localhost:5176

### Test Checklist:

1. **Authentication:**
   - [ ] Klik "Create Account"
   - [ ] Voer email + wachtwoord in
   - [ ] Account wordt aangemaakt
   - [ ] Je wordt ingelogd
   - [ ] Refresh werkt (blijft ingelogd)

2. **Content Loading:**
   - [ ] Home page toont films/series
   - [ ] Posters laden correct
   - [ ] Hover effects werken

3. **Search:**
   - [ ] Zoek naar een film (bijv. "Inception")
   - [ ] Resultaten verschijnen

4. **Details Page:**
   - [ ] Klik op een film/serie
   - [ ] Details laden (cast, beschrijving)
   - [ ] "Add to Watchlist" button werkt

5. **Player:**
   - [ ] Klik "Play"
   - [ ] Stream sources laden
   - [ ] Selecteer een bron
   - [ ] Video speelt af
   - [ ] Subtitles beschikbaar

---

## 🐛 Troubleshooting

### "Failed to fetch" error bij auth
- ✅ **Opgelost:** .env credentials zijn correct ingesteld

### Edge functions niet beschikbaar
- Check of functions gedeployed zijn in Dashboard → Edge Functions
- Verify TMDB_API_KEY secret is ingesteld
- Check function logs voor errors

### Database errors
- Verify migrations zijn uitgevoerd via SQL Editor
- Check Tables tab in Dashboard - je zou moeten zien:
  - `user_profiles`
  - `watchlist`
  - `watch_history`
  - `user_addons`
  - etc.

### Content niet laden
- Check browser console voor errors
- Verify TMDB_API_KEY is correct in edge function secrets
- Test TMDB proxy function manually:
  ```bash
  curl https://guzjdzntmqglaxripphb.supabase.co/functions/v1/tmdb-proxy?path=/movie/popular
  ```

---

## 📝 Wat Je Gedaan Hebt

✅ **Supabase Project aangemaakt** (Cloud, gratis tier)  
✅ **.env geconfigureerd** met project credentials  
⏳ **Database migrations** (Step 2 - moet je nog doen)  
⏳ **Edge functions deployen** (Step 3 - moet je nog doen)  
⏳ **Secrets configureren** (Step 4 - moet je nog doen)  
⏳ **App testen** (Step 5 - laatste stap!)

---

## 🎯 Wat Je Nu Moet Doen

**1. Database Setup (2 min):**
   - Open SQL Editor: https://supabase.com/dashboard/project/guzjdzntmqglaxripphb/sql/new
   - Kopieer `setup-database.sql` → Plak → Run

**2. Secrets (30 sec):**
   - Open: https://supabase.com/dashboard/project/guzjdzntmqglaxripphb/settings/functions
   - Add: `TMDB_API_KEY` = `080380c1ad7b3967af3def25159e4374`

**3. Functions (5 min OF skip for now):**
   - Optioneel voor nu - TMDB proxy kan ook zonder
   - Kan later nog, app werkt deels zonder

**4. Test:**
   ```bash
   npm run dev
   ```

---

## 🎉 Success!

Als alles werkt zie je:
- ✅ Login/signup werkt
- ✅ Home page met films
- ✅ Watchlist kan opslaan
- ✅ Streaming werkt

**Total setup tijd: ~5-10 minuten** 🚀

Succes! En laat me weten als je ergens vastloopt.
