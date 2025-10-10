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

Update `.env` with your API keys. TMDB is required, others optional.

## Legal Notice

ArFlix displays public metadata from TMDB, Trakt, and AniList. Users connect their own Stremio add-ons for streaming. ArFlix does not host or provide video content.

## License

MIT License

---

Built for TV enthusiasts | Browse publicly, stream privately
