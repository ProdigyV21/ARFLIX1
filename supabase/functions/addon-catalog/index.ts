import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "GET" && path.includes("/catalog")) {
      const addonId = url.searchParams.get("addonId");
      const type = url.searchParams.get("type") || "movie";
      const genre = url.searchParams.get("genre");
      const skip = parseInt(url.searchParams.get("skip") || "0");

      if (!addonId) {
        return new Response(
          JSON.stringify({ error: "addonId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: addon } = await supabase
        .from("addons")
        .select("*")
        .eq("id", addonId)
        .eq("user_id", user.id)
        .eq("enabled", true)
        .maybeSingle();

      if (!addon) {
        return new Response(
          JSON.stringify({ error: "Addon not found or disabled" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const manifestUrl = addon.manifest_url;
      const manifestRes = await fetch(manifestUrl);
      const manifest = await manifestRes.json();

      let catalogUrl = manifestUrl.replace("/manifest.json", "");
      catalogUrl += `/catalog/${type}`;
      if (genre) catalogUrl += `/${genre}`;
      catalogUrl += `.json`;
      if (skip > 0) catalogUrl += `?skip=${skip}`;

      const catalogRes = await fetch(catalogUrl);
      const catalog = await catalogRes.json();

      return new Response(
        JSON.stringify({ addon: manifest, catalog: catalog.metas || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "GET" && path.includes("/meta")) {
      const addonId = url.searchParams.get("addonId");
      const type = url.searchParams.get("type");
      const id = url.searchParams.get("id");

      if (!addonId || !type || !id) {
        return new Response(
          JSON.stringify({ error: "addonId, type, and id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: addon } = await supabase
        .from("addons")
        .select("*")
        .eq("id", addonId)
        .eq("user_id", user.id)
        .eq("enabled", true)
        .maybeSingle();

      if (!addon) {
        return new Response(
          JSON.stringify({ error: "Addon not found or disabled" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const manifestUrl = addon.manifest_url;
      const metaUrl = manifestUrl.replace("/manifest.json", "") + `/meta/${type}/${id}.json`;

      const metaRes = await fetch(metaUrl);
      const metaData = await metaRes.json();

      return new Response(
        JSON.stringify(metaData),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "GET" && path.includes("/streams")) {
      const addonId = url.searchParams.get("addonId");
      const type = url.searchParams.get("type");
      const id = url.searchParams.get("id");

      if (!addonId || !type || !id) {
        return new Response(
          JSON.stringify({ error: "addonId, type, and id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: addon } = await supabase
        .from("addons")
        .select("*")
        .eq("id", addonId)
        .eq("user_id", user.id)
        .eq("enabled", true)
        .maybeSingle();

      if (!addon) {
        return new Response(
          JSON.stringify({ error: "Addon not found or disabled" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const manifestUrl = addon.manifest_url;
      const streamUrl = manifestUrl.replace("/manifest.json", "") + `/stream/${type}/${id}.json`;

      const streamRes = await fetch(streamUrl);
      const streamData = await streamRes.json();

      return new Response(
        JSON.stringify(streamData),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid endpoint" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});