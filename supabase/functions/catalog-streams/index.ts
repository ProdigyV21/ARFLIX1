import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY") || "";
const TMDB_BASE = "https://api.themoviedb.org/3";

type ExternalIds = {
  tmdbMovieId?: number;
  tmdbTvId?: number;
  imdbId?: string;
  tvdbId?: number;
  anilistId?: number;
};

type StreamKind = "hls" | "dash" | "mp4" | "unknown";

type NormalizedStream = {
  url: string;
  kind: StreamKind;
  quality?: number;
  codec?: string;
  hdr?: "dolby_vision" | "hdr10" | "none";
  captions?: Array<{ lang: string; url: string; mime?: string }>;
  host?: string;
  label?: string;
  sourceName?: string;
  infoHash?: string;
  fileIdx?: number;
  fileSize?: string;
  audioCodec?: string;
  seeds?: number;
  peers?: number;
};

type StreamsResponse = {
  items: NormalizedStream[];
  best: NormalizedStream | null;
  message?: string;
};

async function getExternalIds(type: string, sourceId: string): Promise<ExternalIds> {
  const result: ExternalIds = {};

  if (type === "movie" && sourceId.startsWith("tmdb:movie:")) {
    const tmdbId = parseInt(sourceId.split(":")[2]);
    result.tmdbMovieId = tmdbId;

    try {
      const res = await fetch(`${TMDB_BASE}/movie/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
      if (res.ok) {
        const data = await res.json();
        if (data.imdb_id) result.imdbId = data.imdb_id;
        if (data.tvdb_id) result.tvdbId = data.tvdb_id;
      }
    } catch {}
  }

  if ((type === "series" || type === "anime") && sourceId.startsWith("tmdb:tv:")) {
    const tmdbId = parseInt(sourceId.split(":")[2]);
    result.tmdbTvId = tmdbId;

    try {
      const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
      if (res.ok) {
        const data = await res.json();
        if (data.imdb_id) result.imdbId = data.imdb_id;
        if (data.tvdb_id) result.tvdbId = data.tvdb_id;
      }
    } catch {}
  }

  if (type === "anime" && sourceId.startsWith("anilist:")) {
    result.anilistId = parseInt(sourceId.split(":")[1]);
  }

  return result;
}

function buildMovieCandidates(ext: ExternalIds, prefixes: string[]): string[] {
  const candidates: string[] = [];

  // ALWAYS try IMDb first if available (most compatible)
  if (ext.imdbId) {
    candidates.push(ext.imdbId);
  }

  // Then try addon-specific prefixes
  if (prefixes.includes("tmdb") && ext.tmdbMovieId && !ext.imdbId) {
    candidates.push(`tmdb:${ext.tmdbMovieId}`);
  }

  if (prefixes.includes("tvdb") && ext.tvdbId && !ext.imdbId) {
    candidates.push(`tvdb:${ext.tvdbId}`);
  }

  return candidates;
}

function buildSeriesCandidates(
  ext: ExternalIds,
  season: number,
  episode: number,
  prefixes: string[]
): string[] {
  const candidates: string[] = [];

  // ALWAYS try IMDb first if available (most compatible)
  if (ext.imdbId) {
    candidates.push(`${ext.imdbId}:${season}:${episode}`);
  }

  // Then try addon-specific prefixes
  if (prefixes.includes("tmdb") && ext.tmdbTvId && !ext.imdbId) {
    candidates.push(`tmdb:${ext.tmdbTvId}:${season}:${episode}`);
  }

  if (prefixes.includes("tvdb") && ext.tvdbId && !ext.imdbId) {
    candidates.push(`tvdb:${ext.tvdbId}:${season}:${episode}`);
  }

  if (prefixes.includes("anilist") && ext.anilistId) {
    candidates.push(`anilist:${ext.anilistId}:${season}:${episode}`);
  }

  return candidates;
}

function detectStreamKind(url: string): StreamKind {
  const lower = url.toLowerCase();
  // Check file extensions first (more specific)
  if (lower.includes(".mp4") || lower.includes(".mkv") || lower.includes(".avi") || lower.includes(".webm")) return "mp4";
  if (lower.includes(".m3u8") || lower.includes("m3u8")) return "hls";
  if (lower.includes(".mpd") || lower.includes("dash")) return "dash";
  // /playback/ could be either HLS or direct file, but default to HLS for streaming endpoints
  if (lower.includes("/playback/")) return "hls";
  console.log(`[detectStreamKind] Unknown kind for URL: ${url.substring(url.length - 50)}`);
  return "unknown";
}

function parseQuality(title: string, url: string): number | undefined {
  const text = `${title} ${url}`.toLowerCase();
  if (text.includes("2160") || text.includes("4k")) return 2160;
  if (text.includes("1440")) return 1440;
  if (text.includes("1080")) return 1080;
  if (text.includes("720")) return 720;
  if (text.includes("480")) return 480;
  if (text.includes("360")) return 360;
  return undefined;
}

function parseCodec(title: string): string | undefined {
  const codecMatch = title.match(/\b(HEVC|H\.?265|AVC|H\.?264|VP9|AV1)\b/i);
  if (!codecMatch) return undefined;
  const codec = codecMatch[0].toUpperCase().replace(".", "");
  if (codec === "H265" || codec === "HEVC") return "h265";
  if (codec === "H264" || codec === "AVC") return "h264";
  return codec.toLowerCase();
}

function parseHDR(title: string): "dolby_vision" | "hdr10" | "none" {
  const lower = title.toLowerCase();
  if (lower.includes("dolby") && lower.includes("vision")) return "dolby_vision";
  if (lower.includes("hdr10") || lower.includes("hdr")) return "hdr10";
  return "none";
}

function parseFileSize(title: string): string | undefined {
  const sizeMatch = title.match(/(\d+(?:\.\d+)?)\s?(GB|MB|TB)/i);
  if (sizeMatch) {
    return `${sizeMatch[1]} ${sizeMatch[2].toUpperCase()}`;
  }
  return undefined;
}

function parseAudioCodec(title: string): string | undefined {
  const lower = title.toLowerCase();
  if (lower.includes("atmos")) return "Atmos";
  if (lower.includes("truehd")) return "TrueHD";
  if (lower.includes("dts-hd") || lower.includes("dts hd")) return "DTS-HD";
  if (lower.includes("dts")) return "DTS";
  if (lower.includes("eac3") || lower.includes("e-ac3") || lower.includes("dd+") || lower.includes("ddp")) return "EAC3";
  if (lower.includes("ac3") || lower.includes("dd ") || lower.includes("dolby digital")) return "AC3";
  if (lower.includes("aac")) return "AAC";
  if (lower.includes("opus")) return "Opus";
  if (lower.includes("flac")) return "FLAC";
  return undefined;
}

function parseSeedsAndPeers(title: string): { seeds?: number; peers?: number } {
  const seedsMatch = title.match(/👤\s*(\d+)/);
  const seeds = seedsMatch ? parseInt(seedsMatch[1]) : undefined;
  return { seeds };
}

function extractHost(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, "");
    if (hostname.includes("real-debrid") || hostname.includes("debrid")) return "Real-Debrid";
    if (hostname.includes("alldebrid")) return "AllDebrid";
    if (hostname.includes("premiumize")) return "Premiumize";
    if (hostname.includes("torbox")) return "TorBox";
    if (hostname.includes("easynews")) return "Easynews";
    return hostname;
  } catch {
    return "Unknown";
  }
}

async function fetchStreamsFromAddon(
  addonUrl: string,
  type: string,
  candidates: string[],
  addonName: string,
  timeout: number = 8000
): Promise<NormalizedStream[]> {
  const allStreams: NormalizedStream[] = [];

  for (const candidate of candidates) {
    try {
      const streamType = type === "anime" ? "series" : type;
      const streamUrl = `${addonUrl}/stream/${streamType}/${encodeURIComponent(candidate)}.json`;
      console.log(`Trying: ${streamUrl}`);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000); // Increased to 10 seconds for AIOStreams

      const response = await fetch(streamUrl, {
        headers: { "Accept": "application/json", "User-Agent": "ArFlix/1.0" },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        console.log(`HTTP ${response.status} for ${streamUrl}`);
        continue;
      }

      const data: any = await response.json();
      const streams = data.streams || [];
      console.log(`[STREAMS] ${addonName} returned ${streams.length} streams for ${candidate}`);

      for (const stream of streams) {
        // Skip error streams
        if (stream.streamData?.type === "error" || !stream.url) {
          const errorMsg = stream.description || stream.streamData?.error?.description || "Unknown error";
          console.log(`[STREAMS] Skipping error stream from ${addonName}: ${errorMsg}`);
          continue;
        }

        const kind = detectStreamKind(stream.url);
        console.log(`[STREAMS] Stream URL: ${stream.url.substring(stream.url.length - 80)} => kind: ${kind}`);
        const quality = parseQuality(stream.name || stream.title || "", stream.url);
        const codec = parseCodec(stream.name || stream.title || "");
        const hdr = parseHDR(stream.name || stream.title || "");
        const host = extractHost(stream.url);

        let label = "";
        if (quality) label += `${quality}p`;
        if (codec) label += ` ${codec.toUpperCase()}`;
        if (hdr !== "none") label += ` ${hdr === "dolby_vision" ? "DV" : "HDR10"}`;
        if (host && host !== "Unknown") label += ` (${host})`;
        if (!label) label = stream.name || stream.title || "Stream";

        const captions = stream.subtitles?.map((sub: any) => ({
          lang: sub.lang || "unknown",
          url: sub.url,
          mime: sub.url.endsWith(".vtt") ? "text/vtt" : undefined,
        }));

        // For Torrentio URLs, just proxy them - the proxy will handle redirects
        // Don't skip streams, let the user try them all
        let finalUrl = stream.url;
        
        // Proxy URLs that need CORS handling or redirect resolution
        const shouldProxy = 
          stream.url.includes("real-debrid.com") || 
          stream.url.includes("torrentio.strem.fun/resolve/");
        
        if (shouldProxy) {
          const proxyBase = Deno.env.get("SUPABASE_URL") || "";
          finalUrl = `${proxyBase}/functions/v1/proxy-video?url=${encodeURIComponent(stream.url)}`;
          console.log(`[STREAMS] Proxying URL: ${stream.url.substring(0, 60)}...`);
        }

        // Parse file size and audio codec from the ORIGINAL stream title/name, not the constructed label
        const originalText = stream.name || stream.title || "";
        const fileSize = parseFileSize(originalText);
        const audioCodec = parseAudioCodec(originalText);
        const { seeds } = parseSeedsAndPeers(originalText);

        allStreams.push({
          url: finalUrl,
          kind,
          quality,
          codec,
          hdr,
          host,
          label,
          sourceName: addonName,
          captions,
          infoHash: stream.infoHash,
          fileIdx: stream.fileIdx,
          fileSize,
          audioCodec,
          seeds,
        });
      }

      if (allStreams.length > 0) break;
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log(`Timeout fetching ${candidate} from ${addonName}`);
      } else {
        console.log(`Error fetching ${candidate} from ${addonName}:`, error.message);
      }
    }
  }

  return allStreams;
}

function selectBest(items: NormalizedStream[]): NormalizedStream | null {
  if (items.length === 0) return null;

  // Prioritize direct streaming URLs (MediaFusion, Comet, etc. - these are cached)
  const directStreams = items.filter(s =>
    (s.kind === "hls" || s.kind === "dash" || s.kind === "mp4") &&
    (s.url.includes("mediafusion") || s.url.includes("comet") || s.url.includes("/playback/"))
  );

  const candidates = directStreams.length > 0 ? directStreams : items;

  candidates.sort((a, b) => {
    // Prioritize by quality (higher is better)
    if ((a.quality || 0) !== (b.quality || 0)) {
      return (b.quality || 0) - (a.quality || 0);
    }

    // Prefer HLS/DASH over others
    const aIsAdaptive = a.kind === "hls" || a.kind === "dash";
    const bIsAdaptive = b.kind === "hls" || b.kind === "dash";
    if (aIsAdaptive && !bIsAdaptive) return -1;
    if (!aIsAdaptive && bIsAdaptive) return 1;

    // Prefer HLS over DASH
    if (a.kind === "hls" && b.kind !== "hls") return -1;
    if (b.kind === "hls" && a.kind !== "hls") return 1;

    return 0;
  });

  return candidates[0] || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      authHeader ? { global: { headers: { Authorization: authHeader } } } : {}
    );

    // Get or create anonymous user for addons
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    let userId: string;
    
    if (authUser) {
      // Authenticated user - get or create user record
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", authUser.id)
        .maybeSingle();
      
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const { data: newUser, error: createError } = await supabase
          .from("users")
          .insert({ auth_id: authUser.id })
          .select("id")
          .single();
        
        if (createError || !newUser) {
          throw new Error("Failed to create user record");
        }
        userId = newUser.id;
      }
    } else {
      // Anonymous user - use anonymous user record
      const ANONYMOUS_USER_ID = "00000000-0000-0000-0000-000000000000";
      userId = ANONYMOUS_USER_ID;
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const type = pathParts[pathParts.length - 2];
    const id = pathParts[pathParts.length - 1];
    const season = url.searchParams.get("season");
    const episode = url.searchParams.get("episode");

    if (!type || !id) {
      return new Response(
        JSON.stringify({ error: "Missing type or id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: addons, error: addonsError } = await supabase
      .from("addons")
      .select("*")
      .eq("user_id", userId)
      .eq("enabled", true)
      .order("order_position", { ascending: true });

    if (addonsError) throw addonsError;

    if (!addons || addons.length === 0) {
      return new Response(
        JSON.stringify({ items: [], best: null, message: "No enabled add-ons" } satisfies StreamsResponse),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[STREAMS] Request: type=${type}, id=${id}, season=${season}, episode=${episode}`);
    console.log(`[STREAMS] Found ${addons.length} enabled add-ons`);

    // Cinemeta provides IMDB IDs directly
    let externalIds: ExternalIds = {};

    if (id.startsWith('tt')) {
      // Already an IMDB ID from Cinemeta
      externalIds.imdbId = id;
    } else if (id.startsWith('tmdb:')) {
      // Convert tmdb:ID to tmdb:movie:ID or tmdb:tv:ID format
      const tmdbIdOnly = id.replace('tmdb:', '');
      let formattedId = id;
      
      // If it's just tmdb:NUMBER, add the type prefix
      if (!id.includes(':movie:') && !id.includes(':tv:')) {
        if (type === 'movie') {
          formattedId = `tmdb:movie:${tmdbIdOnly}`;
        } else if (type === 'series' || type === 'anime') {
          formattedId = `tmdb:tv:${tmdbIdOnly}`;
        }
      }
      
      externalIds = await getExternalIds(type, formattedId);
    } else {
      externalIds.imdbId = id;
    }

    console.log("[STREAMS] External IDs:", JSON.stringify(externalIds));

    if (!externalIds.imdbId && !externalIds.tmdbMovieId && !externalIds.tmdbTvId && !externalIds.anilistId) {
      console.error("[STREAMS] No external IDs found!");
      return new Response(
        JSON.stringify({
          items: [],
          best: null,
          message: "Could not resolve content IDs."
        } satisfies StreamsResponse),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const items: NormalizedStream[] = [];

    for (const addon of addons) {
      const prefixes = (addon.id_prefixes as string[]) || ["tt", "tmdb", "tvdb"];
      console.log(`[STREAMS] Add-on "${addon.name}" supports:`, prefixes);

      let candidates: string[];
      if ((type === "series" || type === "anime") && season && episode) {
        candidates = buildSeriesCandidates(externalIds, parseInt(season), parseInt(episode), prefixes);
      } else if (type === "movie") {
        candidates = buildMovieCandidates(externalIds, prefixes);
      } else {
        console.log(`[STREAMS] Skipping ${addon.name}: missing season/episode for series/anime`);
        continue;
      }

      console.log(`[STREAMS] Candidates for ${addon.name}:`, candidates);
      console.log(`[STREAMS] External IDs resolved:`, {
        imdbId: externalIds.imdbId,
        tmdbTvId: externalIds.tmdbTvId,
        tmdbMovieId: externalIds.tmdbMovieId
      });

      if (candidates.length === 0) {
        console.log(`No candidates generated for ${addon.name} - skipping`);
        continue;
      }

      let baseUrl = addon.url;
      if (baseUrl.endsWith("/manifest.json")) {
        baseUrl = baseUrl.replace(/\/manifest\.json$/, "");
      }
      
      console.log(`[STREAMS] Base URL for ${addon.name}: ${baseUrl}`);

      const addonStreams = await fetchStreamsFromAddon(baseUrl, type, candidates, addon.name);
      console.log(`[STREAMS] Found ${addonStreams.length} streams from ${addon.name}`);
      items.push(...addonStreams);
    }

    console.log(`[STREAMS] Total streams found: ${items.length}`);

    if (items.length === 0) {
      const errorMessage = addons.length === 0
        ? "No add-ons configured. Go to Settings > Add-ons to add streaming sources."
        : "No streams found. Your add-on may not have this content, or it may require additional configuration (e.g., Real-Debrid API key).";

      return new Response(
        JSON.stringify({
          items: [],
          best: null,
          message: errorMessage
        } satisfies StreamsResponse),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    items.sort((a, b) => {
      if ((a.quality || 0) !== (b.quality || 0)) {
        return (b.quality || 0) - (a.quality || 0);
      }
      return 0;
    });

    const best = selectBest(items);

    return new Response(
      JSON.stringify({ items, best } satisfies StreamsResponse),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Streams error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error", items: [], best: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
