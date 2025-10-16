import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, Range",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
  "Access-Control-Allow-Credentials": "true",
};

Deno.serve(async (req: Request) => {
  // Allow OPTIONS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  
  // Allow anonymous access for video proxying
  // Video players can't send auth headers, so we need to allow anonymous requests

  try {
    const url = new URL(req.url);
    const videoUrl = url.searchParams.get("url");
    const isHeadRequest = url.searchParams.get("head") === "1";

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: "Missing url parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  console.log('[proxy-video] Proxying:', videoUrl.substring(0, 100), isHeadRequest ? '(HEAD)' : '');

    const rangeHeader = req.headers.get("range");
    const ifRangeHeader = req.headers.get("if-range");
    const acceptHeader = req.headers.get("accept");
    const originHeader = req.headers.get("origin");

    const headers: Record<string, string> = {
      "User-Agent": req.headers.get("user-agent") || "ArFlix/1.0",
    };

    if (rangeHeader) {
      headers["Range"] = rangeHeader;
      console.log('[proxy-video] Range request:', rangeHeader);
    }

    if (ifRangeHeader) {
      headers["If-Range"] = ifRangeHeader;
    }

    if (acceptHeader) {
      headers["Accept"] = acceptHeader;
    }

    if (originHeader) {
      headers["Origin"] = originHeader;
    }

    let currentUrl = videoUrl;
    let response = await fetch(currentUrl, {
      method: isHeadRequest ? "HEAD" : "GET",
      headers,
      redirect: "manual",
    });

    console.log('[proxy-video] Initial response status:', response.status);

    // Manually follow redirects to keep them server-side
    let redirectCount = 0;
    while ((response.status === 301 || response.status === 302 || response.status === 303 || response.status === 307 || response.status === 308) && redirectCount < 5) {
      const location = response.headers.get("location");
      if (!location) break;

      currentUrl = new URL(location, currentUrl).toString();
      console.log('[proxy-video] Following redirect to:', currentUrl.substring(0, 100));

      response = await fetch(currentUrl, {
        method: isHeadRequest ? "HEAD" : "GET",
        headers,
        redirect: "manual",
      });

      redirectCount++;
    }

    console.log('[proxy-video] Final response status:', response.status);

    if (!response.ok && response.status !== 206) {
      console.error('[proxy-video] Failed:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: `Upstream ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const responseHeaders = new Headers(corsHeaders);

    const headersToForward = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "last-modified",
      "etag",
    ];

    for (const header of headersToForward) {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    }

    if (!responseHeaders.has("Accept-Ranges")) {
      responseHeaders.set("Accept-Ranges", "bytes");
    }

    responseHeaders.set("Cache-Control", "private, max-age=0");
    responseHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("matroska")) {
      responseHeaders.set("X-Compat", "audio-unknown");
      console.log('[proxy-video] Warning: MKV container detected');
    }

    if (isHeadRequest) {
      console.log('[proxy-video] Returning HEAD response with Content-Type:', contentType);
      return new Response(null, {
        status: 200,
        headers: responseHeaders,
      });
    }

    console.log('[proxy-video] Streaming response');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error("[proxy-video] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});