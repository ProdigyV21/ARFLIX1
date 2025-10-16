# ✨ ARFLIX - Schoon Nieuw Supabase Project Setup

## 🎯 Doel
Een nieuw Supabase project opzetten met **alleen essentiële functies** die minimale bandwidth gebruiken.

### ❌ WAT WE NIET DEPLOYEN (Bandwidth killers)
- `proxy-video` - Proxied alle video streams (7000+ GB verbruik!)
- `proxy-subtitle` - Proxied subtitle downloads (onnodige bandwidth)

### ✅ WAT WE WEL DEPLOYEN (Lichtgewicht essentials)
- `catalog-*` functies - Metadata ophalen (KB's per request)
- `addon-*` functies - Addon management (KB's per request)
- `fetch-subtitles` - Subtitle discovery (geen proxy, alleen metadata)
- `tmdb-proxy` - (Optioneel) TMDB API proxy als je key wilt beschermen

---

## 📋 Stap 1: Maak Nieuw Supabase Project

1. Ga naar https://supabase.com/dashboard
2. Klik **New Project**
3. Naam: `ARFLIX-Clean` (of eigen keuze)
4. Database password: genereer sterke wachtwoord (bewaar veilig!)
5. Region: Kies dichtsbij (Europe West voor NL)
6. Plan: **Free tier** (5 GB bandwidth/maand = genoeg!)
7. Klik **Create new project**
8. Wacht ~2 minuten tot project klaar is

---

## 📋 Stap 2: Haal Project Credentials Op

In je nieuwe Supabase project dashboard:

1. Ga naar **Settings** → **API**
2. Kopieer:
   - **Project URL**: `https://xxxxxxxxx.supabase.co`
   - **anon/public key**: `eyJhbG...` (lange string)

---

## 📋 Stap 3: Update Je Lokale .env

In je ARFLIX project root:

```bash
# Maak/update .env bestand
cat > .env << 'EOF'
# Nieuw Supabase Project
VITE_SUPABASE_URL=https://JOUW_NIEUWE_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=JOUW_NIEUWE_ANON_KEY

# TMDB API (verplicht voor metadata)
VITE_TMDB_API_KEY=080380c1ad7b3967af3def25159e4374

# Proxy uitgeschakeld (direct streaming)
# VITE_USE_PROXY=false  # (default, hoeft niet expliciet)
EOF
```

**Vervang** `JOUW_NIEUWE_PROJECT_ID` en `JOUW_NIEUWE_ANON_KEY` met je echte waarden!

---

## 📋 Stap 4: Setup Database Schema

In Supabase dashboard → **SQL Editor** → **New query**, plak:

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (voor addons en preferences)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  preferred_subtitle_language TEXT DEFAULT 'en',
  UNIQUE(auth_id)
);

-- User addons table
CREATE TABLE IF NOT EXISTS public.user_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  addon_url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, addon_url)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_addons_user_id ON public.user_addons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addons_enabled ON public.user_addons(enabled);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_addons ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own data"
  ON public.users FOR SELECT
  USING (auth.uid() = auth_id);

CREATE POLICY "Users can update own data"
  ON public.users FOR UPDATE
  USING (auth.uid() = auth_id);

CREATE POLICY "Users can insert own data"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = auth_id);

-- User addons policies
CREATE POLICY "Users can view own addons"
  ON public.user_addons FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can insert own addons"
  ON public.user_addons FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update own addons"
  ON public.user_addons FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can delete own addons"
  ON public.user_addons FOR DELETE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- Function to create user on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_id)
  VALUES (NEW.id)
  ON CONFLICT (auth_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

Klik **Run** (of F5). Als alles groen is ✅, ga door naar volgende stap.

---

## 📋 Stap 5: Deploy Essentiële Edge Functions

**Belangrijk:** We deployen ALLEEN lichtgewicht functies!

### 5a. Install Supabase CLI (als je dat nog niet hebt)

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Of via npm (Windows/Linux/macOS)
npm install -g supabase
```

### 5b. Login bij Supabase

```bash
supabase login
```

### 5c. Link je project

```bash
# In je ARFLIX project directory
cd /workspaces/ARFLIX1

# Link naar je nieuwe project
supabase link --project-ref JOUW_NIEUWE_PROJECT_ID
```

Vervang `JOUW_NIEUWE_PROJECT_ID` met je project ID (het deel voor `.supabase.co`).

### 5d. Set TMDB API Key Secret

```bash
# Zet TMDB key als Supabase secret (voor tmdb-proxy function)
supabase secrets set TMDB_API_KEY=080380c1ad7b3967af3def25159e4374
```

### 5e. Deploy ALLEEN Essentiële Functions

```bash
# Deploy catalog functions (metadata, lightweight)
supabase functions deploy catalog-home
supabase functions deploy catalog-meta
supabase functions deploy catalog-search
supabase functions deploy catalog-streams
supabase functions deploy catalog-seasons
supabase functions deploy catalog-episodes
supabase functions deploy catalog-subtitles

# Deploy addon management
supabase functions deploy addon-catalog
supabase functions deploy addon-manage
supabase functions deploy addon-register

# Deploy subtitle discovery (geen proxy!)
supabase functions deploy fetch-subtitles

# OPTIONEEL: TMDB proxy (alleen als je API key wilt verbergen)
# supabase functions deploy tmdb-proxy
```

**LET OP:** We deployen **NIET**:
- ❌ `proxy-video` (bandwidth killer!)
- ❌ `proxy-subtitle` (niet nodig, app gebruikt direct endpoints)

---

## 📋 Stap 6: Test Je Nieuwe Setup

### 6a. Start lokale dev server

```bash
npm run dev
```

### 6b. Open browser

Ga naar http://localhost:5176/

### 6c. Check Network tab (F12 → Network)

**Wat je MOET zien:**
- ✅ Requests naar `api.themoviedb.org` (direct TMDB)
- ✅ Requests naar `JOUW_PROJECT.supabase.co/functions/v1/catalog-*`
- ✅ Requests naar `opensubtitles-v3.strem.io` (direct subtitles)
- ✅ Requests naar `torrentio.strem.fun` (direct streams)

**Wat je NIET MAG zien:**
- ❌ `proxy-video` requests
- ❌ `proxy-subtitle` requests

Als je alleen ✅ ziet = **SUCCESS!** 🎉

---

## 📋 Stap 7: Enable Authentication (Optioneel)

Als je wilt dat users accounts maken:

1. Supabase dashboard → **Authentication** → **Providers**
2. Enable **Email** provider
3. (Optioneel) Enable **Google/GitHub** OAuth

---

## 📊 Verwacht Bandwidth Gebruik

| Service | Oud (met proxy) | Nieuw (zonder) | Besparing |
|---------|-----------------|----------------|-----------|
| Video Streams | 7000 GB | 0 GB | 100% |
| Subtitles | 20 GB | 0 GB | 100% |
| Catalog API | 0.5 GB | 0.5 GB | 0% |
| TMDB Proxy | 0.1 GB | 0 GB* | 100%* |
| **TOTAAL** | **7020 GB** | **0.5 GB** | **99.9%** |

*Als je `tmdb-proxy` niet deployed (aanbevolen), is TMDB ook 0 GB Supabase bandwidth.

---

## ⚙️ Production Deployment (Vercel/Netlify)

Voor productie:

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY  
# - VITE_TMDB_API_KEY
```

### Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod

# Set environment variables in Netlify dashboard
```

---

## 🔒 Security Best Practices

1. **Nooit** proxy-video/subtitle herenablen zonder goed nadenken
2. **Altijd** Row Level Security (RLS) enabled houden
3. **Nooit** je `.env` file committen naar Git
4. **Altijd** je anon key in environment variables stoppen (niet hardcoded)

---

## 🆘 Troubleshooting

### "Failed to fetch streams"
- Check of addon-manage function gedeployed is
- Check of user addons heeft toegevoegd in Settings

### "No subtitles found"
- Check of fetch-subtitles function gedeployed is
- Check of IMDb ID conversie werkt (console logs)

### "CORS error"
- Check of VITE_SUPABASE_URL correct is in .env
- Edge functions hebben automatisch CORS headers

### "Authentication failed"
- Check of users table bestaat (SQL stap 4)
- Check of trigger `handle_new_user` actief is

---

## ✅ Checklist

- [ ] Nieuw Supabase project aangemaakt
- [ ] Database schema uitgevoerd (SQL)
- [ ] .env file updated met nieuwe credentials
- [ ] Supabase CLI geïnstalleerd en ingelogd
- [ ] Project gelinkt via `supabase link`
- [ ] TMDB secret ingesteld
- [ ] Essentiële functions gedeployed (catalog-*, addon-*, fetch-subtitles)
- [ ] proxy-video/subtitle NIET gedeployed
- [ ] Lokaal getest - geen proxy calls in Network tab
- [ ] Bandwidth gebruik daalt naar <1 GB/maand

---

## 🎉 Klaar!

Je hebt nu een schoon Supabase project met **99.9% minder bandwidth verbruik**!

Je oude project kun je pauzeren of verwijderen in Supabase dashboard → Settings → General → Pause/Delete project.
