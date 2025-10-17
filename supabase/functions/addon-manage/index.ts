import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function checkHealth(url: string): Promise<{ status: string; message?: string; name?: string; version?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "ArFlix/1.0",
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      return { status: "error", message: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    
    if (!data.id || !data.name || !data.version) {
      return { status: "error", message: "Invalid manifest" };
    }
    
    return { status: "ok", name: data.name, version: data.version };
  } catch (error: any) {
    if (error.name === "AbortError") {
      return { status: "error", message: "Timeout" };
    }
    return { status: "error", message: error.message || "Unknown error" };
  }
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
      // Anonymous user - use fixed UUID (should already exist in database)
      const ANONYMOUS_USER_ID = "00000000-0000-0000-0000-000000000000";
      userId = ANONYMOUS_USER_ID;
    }
    
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    
    if (req.method === "GET") {
      if (action === "health") {
        const addonUrl = url.searchParams.get("url");
        if (!addonUrl) {
          return new Response(
            JSON.stringify({ error: "URL parameter required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const health = await checkHealth(addonUrl);
        return new Response(
          JSON.stringify(health),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { data: addons, error } = await supabase
        .from("addons")
        .select("*")
        .eq("user_id", userId)
        .order("order_position", { ascending: true });
      
      if (error) throw error;
      
      // Auto-setup: If user has no addons, copy from anonymous user
      if (!addons || addons.length === 0) {
        console.log('[addon-manage] User has no addons, copying from anonymous user...');
        const ANONYMOUS_USER_ID = "00000000-0000-0000-0000-000000000000";
        
        const { data: anonymousAddons } = await supabase
          .from("addons")
          .select("*")
          .eq("user_id", ANONYMOUS_USER_ID)
          .eq("enabled", true);
        
        if (anonymousAddons && anonymousAddons.length > 0) {
          console.log(`[addon-manage] Found ${anonymousAddons.length} anonymous addons, copying to user ${userId}...`);
          
          // Copy addons to new user
          const newAddons = anonymousAddons.map(addon => ({
            user_id: userId,
            addon_id: addon.addon_id,
            name: addon.name,
            version: addon.version,
            url: addon.url,
            icon: addon.icon,
            enabled: true,
            order_position: addon.order_position,
            last_health: addon.last_health,
            id_prefixes: addon.id_prefixes,
          }));
          
          const { data: insertedAddons, error: insertError } = await supabase
            .from("addons")
            .insert(newAddons)
            .select("*");
          
          if (!insertError && insertedAddons) {
            console.log(`[addon-manage] Successfully copied ${insertedAddons.length} addons to new user`);
            return new Response(
              JSON.stringify({ addons: insertedAddons }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
      
      return new Response(
        JSON.stringify({ addons: addons || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (req.method === "POST") {
      const body = await req.json();
      
      if (action === "toggle") {
        const { url: addonUrl, enabled } = body;
        
        if (!addonUrl || typeof enabled !== "boolean") {
          return new Response(
            JSON.stringify({ error: "url and enabled (boolean) required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const { error } = await supabase
          .from("addons")
          .update({ enabled, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("url", addonUrl);
        
        if (error) throw error;
        
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (action === "reorder") {
        const { urls } = body;
        
        if (!Array.isArray(urls)) {
          return new Response(
            JSON.stringify({ error: "urls array required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        for (let i = 0; i < urls.length; i++) {
          await supabase
            .from("addons")
            .update({ order_position: i })
            .eq("user_id", userId)
            .eq("url", urls[i]);
        }
        
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (action === "health-check") {
        const { url: addonUrl } = body;
        
        if (!addonUrl) {
          return new Response(
            JSON.stringify({ error: "url required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const health = await checkHealth(addonUrl);
        
        await supabase
          .from("addons")
          .update({
            last_health: health.status,
            last_health_check: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("url", addonUrl);
        
        return new Response(
          JSON.stringify(health),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (req.method === "DELETE") {
      const { url: addonUrl } = await req.json();
      
      if (!addonUrl) {
        return new Response(
          JSON.stringify({ error: "url required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const { error } = await supabase
        .from("addons")
        .delete()
        .eq("user_id", userId)
        .eq("url", addonUrl);
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Manage error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});