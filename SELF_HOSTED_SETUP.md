# Supabase Self-Hosted Setup Guide

## Overzicht
Deze guide helpt je om Supabase zelf te hosten op je mini PC server voor ARFLIX streaming app.

**Kosten:** €0/maand (alleen elektriciteit mini PC)  
**Vereisten:** Mini PC met 2GB+ RAM, Docker, 20GB+ storage

---

## Stap 1: Docker Installeren op Mini PC

### Check of Docker al geïnstalleerd is:
```bash
ssh user@mini-pc-ip
docker --version
docker-compose --version
```

### Als Docker NIET geïnstalleerd is:

#### Voor Ubuntu/Debian:
```bash
# Update packages
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Test installation
sudo docker run hello-world
```

#### Voor andere systemen:
- **Raspberry Pi OS:** Zelfde als Ubuntu/Debian
- **Arch Linux:** `sudo pacman -S docker docker-compose`
- **Fedora:** `sudo dnf install docker docker-compose`

### Docker zonder sudo (optioneel):
```bash
sudo usermod -aG docker $USER
# Log uit en weer in om group membership te activeren
```

---

## Stap 2: Supabase Self-Hosted Downloaden

```bash
# SSH naar je mini PC
ssh user@mini-pc-ip

# Clone Supabase
cd ~
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Kopieer example env
cp .env.example .env
```

---

## Stap 3: Configuratie Aanpassen

### Edit .env file:
```bash
nano .env
```

### Belangrijke settings te wijzigen:

```bash
############
# Secrets
############
# WIJZIG DEZE! Genereer met: openssl rand -base64 32
POSTGRES_PASSWORD=your-super-secret-postgres-password
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
ANON_KEY=your-anon-key  # Wordt automatisch gegenereerd
SERVICE_ROLE_KEY=your-service-key  # Wordt automatisch gegenereerd

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############
# API Proxy
############
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

############
# Dashboard
############
STUDIO_PORT=3000

############
# Optional: Email (voor password reset)
############
# Gmail setup:
SMTP_ADMIN_EMAIL=your-email@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password  # https://myaccount.google.com/apppasswords
SMTP_SENDER_NAME=ARFLIX

# Of skip email voor nu:
MAILER_AUTOCONFIRM=true  # Auto-confirm nieuwe accounts
```

### Genereer JWT secrets:
```bash
# Genereer sterke secrets
openssl rand -base64 32  # Voor JWT_SECRET
openssl rand -base64 32  # Voor POSTGRES_PASSWORD
```

---

## Stap 4: Supabase Starten

```bash
cd ~/supabase/docker

# Start alle services
docker compose up -d

# Check status
docker compose ps

# Bekijk logs (optioneel)
docker compose logs -f
```

**Services die nu draaien:**
- Kong (API Gateway): http://mini-pc-ip:8000
- Studio (Dashboard): http://mini-pc-ip:3000
- PostgreSQL Database: localhost:5432
- Auth service
- Storage service
- Realtime service

---

## Stap 5: Supabase Dashboard Openen

1. Open browser: `http://mini-pc-ip:3000`
2. Login met default credentials:
   - Email: (wordt getoond in terminal bij eerste start)
   - Of check logs: `docker compose logs studio`

3. **Haal je API keys op:**
   - Ga naar Project Settings → API
   - Kopieer:
     - **Project URL**: `http://mini-pc-ip:8000`
     - **anon/public key**: (lange string)

---

## Stap 6: Database Migrations Uitvoeren

### Op je development machine (niet mini PC):

```bash
cd /workspaces/ARFLIX1

# Installeer Supabase CLI (als je die nog niet hebt)
npm install -g supabase

# Of met brew (Mac):
brew install supabase/tap/supabase

# Link naar je self-hosted instance
supabase link --project-ref your-project --password your-postgres-password
# Gebruik: http://mini-pc-ip:5432

# Push alle migrations
supabase db push

# Of handmatig via psql:
psql postgresql://postgres:your-password@mini-pc-ip:5432/postgres < supabase/migrations/*.sql
```

**Migrations die worden uitgevoerd:**
1. `20251009094636_create_arflix_schema.sql` - Users, watchlist, history tables
2. `20251009095803_remove_rd_fields.sql` - Schema cleanup
3. `20251009105741_update_addons_schema.sql` - Addons support
4. `20251009110709_create_user_on_signup.sql` - Auto user creation
5. `20251009114219_add_id_prefixes_to_addons.sql` - ID prefixes
6. `20251009120000_add_subtitle_preferences.sql` - Subtitle prefs
7. `20251009130957_add_subtitle_preferences.sql` - Updated prefs
8. `20251015100000_fix_watch_history_rls.sql` - RLS policies fix

---

## Stap 7: Edge Functions Deployen

### Optie A: Handmatig deployen met Supabase CLI

```bash
cd /workspaces/ARFLIX1

# Deploy elke function apart
supabase functions deploy tmdb-proxy
supabase functions deploy catalog-home
supabase functions deploy catalog-meta
supabase functions deploy catalog-streams
supabase functions deploy catalog-search
supabase functions deploy catalog-subtitles
supabase functions deploy fetch-subtitles
supabase functions deploy proxy-subtitle
supabase functions deploy proxy-video
supabase functions deploy addon-catalog
supabase functions deploy addon-register
supabase functions deploy addon-manage

# Set secrets voor functions
supabase secrets set TMDB_API_KEY=080380c1ad7b3967af3def25159e4374
```

### Optie B: Docker volume mount (eenvoudiger)

In je mini PC:
```bash
cd ~/supabase/docker
nano docker-compose.yml

# Voeg toe onder 'functions' service:
volumes:
  - /path/to/ARFLIX1/supabase/functions:/home/deno/functions:ro
```

---

## Stap 8: ARFLIX .env Updaten

Update `/workspaces/ARFLIX1/.env`:

```bash
# Supabase Self-Hosted Configuration
VITE_SUPABASE_URL=http://mini-pc-ip:8000
VITE_SUPABASE_ANON_KEY=your-anon-key-from-dashboard

# TMDB API (blijft hetzelfde)
VITE_TMDB_API_KEY=080380c1ad7b3967af3def25159e4374
```

**Voor productie met domein:**
```bash
VITE_SUPABASE_URL=https://supabase.yourdomain.com
```

---

## Stap 9: Netwerk Setup (Optioneel)

### Voor toegang van buitenaf:

#### Optie A: DynDNS (dynamisch IP)
```bash
# Installeer DynDNS client (bijv. ddclient)
sudo apt install ddclient

# Configureer met je DynDNS provider:
# - No-IP (gratis)
# - DuckDNS (gratis)
# - DynDNS
```

#### Optie B: Reverse Proxy met SSL (aanbevolen)
```bash
# Installeer Caddy (automatische SSL)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Configureer Caddyfile
sudo nano /etc/caddy/Caddyfile
```

**Caddyfile:**
```caddy
supabase.yourdomain.com {
    reverse_proxy localhost:8000
}

studio.yourdomain.com {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl reload caddy
```

#### Optie C: Port Forwarding (router)
Router settings:
- External port 80 → Mini PC:8000
- External port 443 → Mini PC:8443
- External port 3000 → Mini PC:3000

---

## Stap 10: Testen

### Test Authentication:
```bash
cd /workspaces/ARFLIX1
npm run dev

# Open browser: http://localhost:5176
# Probeer signup → login
```

### Test Database:
```bash
# Check database connectivity
psql postgresql://postgres:your-password@mini-pc-ip:5432/postgres

# Query users table
SELECT * FROM auth.users;
SELECT * FROM public.user_profiles;
```

### Test Edge Functions:
```bash
# Test TMDB proxy
curl http://mini-pc-ip:8000/functions/v1/tmdb-proxy?path=/movie/popular

# Test catalog
curl http://mini-pc-ip:8000/functions/v1/catalog-home
```

---

## Maintenance & Backups

### Database Backup:
```bash
# Automatische backup (cron job)
0 2 * * * docker exec supabase-db pg_dump -U postgres postgres > /backups/arflix_$(date +\%Y\%m\%d).sql
```

### Update Supabase:
```bash
cd ~/supabase/docker
docker compose pull
docker compose up -d
```

### Monitor Logs:
```bash
docker compose logs -f --tail=100
```

### Stop Services:
```bash
docker compose down  # Stop
docker compose down -v  # Stop + delete volumes (WIST DATA!)
```

---

## Troubleshooting

### Port al in gebruik:
```bash
# Check welke service draait op port 8000
sudo lsof -i :8000
sudo netstat -tulpn | grep 8000

# Kill process of wijzig port in .env
```

### Database connectie issues:
```bash
# Check PostgreSQL logs
docker compose logs db

# Reset database
docker compose down
docker volume rm docker_db-data
docker compose up -d
```

### Edge Functions 404:
```bash
# Check functions container
docker compose logs functions

# Verify function deployment
curl http://mini-pc-ip:8000/functions/v1/
```

### Memory issues (mini PC):
```bash
# Reduce services in docker-compose.yml
# Disable: realtime, storage, imgproxy (niet nodig voor ARFLIX)
```

---

## Security Checklist

- [ ] Sterke POSTGRES_PASSWORD gebruikt
- [ ] JWT_SECRET gewijzigd (min. 32 chars)
- [ ] Firewall regels ingesteld
- [ ] Alleen noodzakelijke ports open (8000, 3000)
- [ ] Database backups geconfigureerd
- [ ] SSL certificaat (Let's Encrypt) als publiek toegankelijk
- [ ] .env file permissions: `chmod 600 .env`
- [ ] Docker containers up-to-date houden

---

## Kosten Schatting

- **Hardware:** €0 (je hebt al mini PC)
- **Supabase software:** €0 (open-source)
- **Domein (optioneel):** €10/jaar
- **SSL (Let's Encrypt):** €0
- **Elektriciteit:** ~€2-5/maand (15W mini PC @ €0.30/kWh)

**Totaal: ~€2-5/maand** 🎉

---

## Next Steps

1. Start met Docker installatie op mini PC
2. Clone Supabase repository
3. Update .env met sterke passwords
4. Start services met `docker compose up -d`
5. Run migrations vanuit development environment
6. Update ARFLIX .env met nieuwe URL
7. Test de app!

**Hulp nodig?** Check:
- Supabase Self-Hosted Docs: https://supabase.com/docs/guides/self-hosting
- Docker Docs: https://docs.docker.com
- Of vraag het mij! 🚀
