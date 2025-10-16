import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StremioManifest {
  id: string;
  name: string;
  version: string;
  resources: string[];
  types: string[];
  logo?: string;
  behaviorHints?: {
    idPrefixes?: string[];
    [key: string]: any;
  };
  catalogs?: Array<{
    id?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

function detectIdPrefixes(manifest: StremioManifest): string[] {
  const prefixes = new Set<string>();

  if (manifest.behaviorHints?.idPrefixes) {
    return manifest.behaviorHints.idPrefixes;
  }

  if (manifest.catalogs) {
    for (const catalog of manifest.catalogs) {
      if (catalog.id) {
        const catalogId = catalog.id.toLowerCase();
        if (catalogId.includes('imdb') || catalogId.includes('tt')) {
          prefixes.add('tt');
        }
        if (catalogId.includes('tmdb')) {
          prefixes.add('tmdb');
        }
        if (catalogId.includes('tvdb')) {
          prefixes.add('tvdb');
        }
        if (catalogId.includes('anilist')) {
          prefixes.add('anilist');
        }
        if (catalogId.includes('kitsu')) {
          prefixes.add('kitsu');
        }
      }
    }
  }

  if (manifest.id) {
    const manifestId = manifest.id.toLowerCase();
    if (manifestId.includes('imdb')) prefixes.add('tt');
    if (manifestId.includes('tmdb')) prefixes.add('tmdb');
    if (manifestId.includes('tvdb')) prefixes.add('tvdb');
    if (manifestId.includes('anilist')) prefixes.add('anilist');
    if (manifestId.includes('kitsu')) prefixes.add('kitsu');
  }

  if (prefixes.size === 0) {
    return ['tt', 'tmdb', 'tvdb'];
  }

  return Array.from(prefixes);
}

function normalizeUrl(url: string): string {
  url = url.trim();
  
  if (url.startsWith("stremio://")) {
    url = url.replace(/^stremio:\/\//, "https://");
  }
  
  return url;
}

function isConfigureUrl(url: string): boolean {
  return url.includes("/configure") || url.includes("/stremio/configure");
}

async function fetchWithRedirects(url: string, maxRedirects = 5): Promise<Response> {
  let currentUrl = url;
  let redirectCount = 0;
  
  while (redirectCount < maxRedirects) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    try {
      const response = await fetch(currentUrl, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "ArFlix/1.0",
        },
        signal: controller.signal,
        redirect: "manual",
      });
      
      clearTimeout(timeout);
      
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("Location");
        if (!location) break;
        
        currentUrl = new URL(location, currentUrl).href;
        redirectCount++;
        continue;
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }
  
  throw new Error("Too many redirects");
}

async function probeManifest(baseUrl: string): Promise<{ url: string; manifest: StremioManifest }> {
  const probes: string[] = [];
  
  if (baseUrl.endsWith(".json") || baseUrl.includes("manifest.json") || baseUrl.includes("?")) {
    probes.push(baseUrl);
  } else {
    probes.push(`${baseUrl}/manifest.json`, baseUrl);
  }
  
  const errors: string[] = [];
  
  for (const probeUrl of probes) {
    try {
      const response = await fetchWithRedirects(probeUrl);
      
      if (!response.ok) {
        if (response.status === 404) {
          errors.push(`404 at ${probeUrl}`);
          continue;
        }
        if (response.status === 403) {
          errors.push(`403 Forbidden at ${probeUrl}`);
          continue;
        }
        errors.push(`HTTP ${response.status} at ${probeUrl}`);
        continue;
      }
      
      const contentType = response.headers.get("Content-Type") || "";
      if (!contentType.includes("json")) {
        errors.push(`Not JSON (${contentType}) at ${probeUrl}`);
        continue;
      }
      
      const data = await response.json();
      
      if (!data.id || !data.name || !data.version || !Array.isArray(data.resources) || !Array.isArray(data.types)) {
        errors.push(`Invalid manifest structure at ${probeUrl}`);
        continue;
      }
      
      return { url: probeUrl, manifest: data };
    } catch (error: any) {
      if (error.name === "AbortError") {
        errors.push(`Timeout at ${probeUrl}`);
      } else {
        errors.push(`${error.message} at ${probeUrl}`);
      }
    }
  }
  
  throw new Error(`Failed all probes: ${errors.join("; ")}`);
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
      // Anonymous user - create or use anonymous user record
      const ANONYMOUS_USER_ID = "00000000-0000-0000-0000-000000000000";
      
      const { data: anonUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", ANONYMOUS_USER_ID)
        .maybeSingle();
      
      if (!anonUser) {
        const { data: newAnon, error: createError } = await supabase
          .from("users")
          .insert({ id: ANONYMOUS_USER_ID, auth_id: null })
          .select("id")
          .single();
        
        if (createError || !newAnon) {
          throw new Error("Failed to create anonymous user");
        }
        userId = newAnon.id;
      } else {
        userId = anonUser.id;
      }
    }
    
    const { url } = await req.json();
    
    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const normalizedUrl = normalizeUrl(url);
    
    if (isConfigureUrl(normalizedUrl)) {
      return new Response(
        JSON.stringify({
          error: "You pasted a configuration page. Complete setup there and paste the final Stremio add-on URL that returns a manifest.json.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    let canonicalUrl: string;
    let manifest: StremioManifest;
    
    try {
      const result = await probeManifest(normalizedUrl);
      canonicalUrl = result.url;
      manifest = result.manifest;
    } catch (error: any) {
      const message = error.message || "Unknown error";
      
      if (message.includes("Timeout") || message.includes("DNS") || message.includes("network")) {
        return new Response(
          JSON.stringify({
            error: "Couldn't reach the add-on (timeout/network). Check the URL and try again.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (message.includes("404") || message.includes("403")) {
        return new Response(
          JSON.stringify({
            error: `This URL returned ${message.includes("404") ? "404" : "403"}. Paste the final Stremio add-on URL (the one that returns manifest.json).`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (message.includes("Not JSON")) {
        return new Response(
          JSON.stringify({
            error: "That address didn't return a Stremio manifest.json.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (message.includes("Invalid manifest")) {
        return new Response(
          JSON.stringify({
            error: "This doesn't look like a Stremio add-on (missing id/name/resources/types).",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Failed to validate add-on: ${message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { data: existingAddon } = await supabase
      .from("addons")
      .select("*")
      .eq("user_id", userId)
      .eq("url", canonicalUrl)
      .maybeSingle();
    
    const idPrefixes = detectIdPrefixes(manifest);

    if (existingAddon) {
      const { error: updateError } = await supabase
        .from("addons")
        .update({
          name: manifest.name,
          version: manifest.version,
          addon_id: manifest.id,
          icon: manifest.logo || null,
          id_prefixes: idPrefixes,
          last_health: "ok",
          last_health_check: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAddon.id);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({
          ...existingAddon,
          name: manifest.name,
          version: manifest.version,
          addon_id: manifest.id,
          icon: manifest.logo || null,
          id_prefixes: idPrefixes,
          last_health: "ok",
          message: "Add-on updated successfully",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { data: maxOrder } = await supabase
      .from("addons")
      .select("order_position")
      .eq("user_id", userId)
      .order("order_position", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const newOrder = (maxOrder?.order_position || 0) + 1;
    
    const { data: newAddon, error: insertError } = await supabase
      .from("addons")
      .insert({
        user_id: userId,
        addon_id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        url: canonicalUrl,
        icon: manifest.logo || null,
        id_prefixes: idPrefixes,
        enabled: true,
        order_position: newOrder,
        last_health: "ok",
        last_health_check: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;
    
    return new Response(
      JSON.stringify(newAddon),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Register error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});