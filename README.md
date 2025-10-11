# ArFlix - Streaming Catalog PWA

A modern, TV-optimized Progressive Web App featuring **live catalogs from TMDB, Trakt, and AniList** with Stremio add-on integration for playback.

## Features

- **Live Catalogs**: Real movies, series, and anime from TMDB, Trakt, and AniList APIs
- **10 Curated Collections**: Trending, Top Rated, New Releases, Genres, Critics' Picks
- **OLED-First Design**: True black backgrounds with high-contrast text
- **TV Remote Navigation**: Full D-pad and keyboard navigation with smart focus manager
- **Stremio Add-ons for Playback**: Browse free catalogs, add add-ons like AIOStreams to watch
- **Netflix-Style UI**: Hero sections, horizontal carousels, smooth animations
- **PWA Support**: Installable on any device
- **Multi-Source Search**: Search across TMDB and AniList simultaneously

## How It Works

1. **Browse**: Home page shows real content from TMDB/Trakt/AniList (no add-ons needed)
2. **Details**: View metadata, cast, genres for any title
3. **Add Stremio Add-on**: To watch, connect an add-on like AIOStreams (with your own debrid keys)
4. **Stream**: Add-on provides playable streams, ArFlix displays them beautifully

**ArFlix surfaces catalogs publicly and lets users bring their own streaming sources.**

## Setup

### Prerequisites

- Node.js 18+ and npm
- **TMDB API Key** (required) - Get free at themoviedb.org/settings/api
- **Trakt Client ID** (optional) - Get at trakt.tv/oauth/applications
- Supabase account (database already configured)

### Environment Variables

Create a `.env` file in the root directory with your API keys:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# TMDB API Key (for metadata and images)
VITE_TMDB_API_KEY=your_tmdb_api_key_here
```

### Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env`
   - Add your Supabase URL and keys
   - Add your TMDB API key

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Access the app:**
   - Open http://localhost:5173 in your browser
   - Sign up for an account or sign in
   - Browse the demo content (works without addons)
   - Add Stremio addons in Settings > Add-ons to enable streaming

### Demo Mode

The app includes demo content that works without any configuration. You can:
- Browse popular movies and TV shows
- View details and metadata
- See the interface and navigation
- Add addons later for actual streaming

## Legal Notice

ArFlix displays public metadata from TMDB, Trakt, and AniList. Users connect their own Stremio add-ons for streaming. ArFlix does not host or provide video content.

## License

MIT License

---

Built for TV enthusiasts | Browse publicly, stream privately
