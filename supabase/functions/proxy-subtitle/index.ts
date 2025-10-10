import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function convertSrtToVtt(srt: string): string {
  let vtt = "WEBVTT\n\n";
  const lines = srt.split("\n");
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (/^\d+$/.test(line)) {
      continue;
    }
    
    if (line.includes("-->")) {
      vtt += line.replace(/,/g, ".") + "\n";
    } else if (line) {
      vtt += line + "\n";
    } else {
      vtt += "\n";
    }
  }
  
  return vtt;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let subtitleUrl = url.searchParams.get("url");
    const fileId = url.searchParams.get("file_id");
    const apiKey = url.searchParams.get("api_key");

    if (!subtitleUrl) {
      return new Response(
        JSON.stringify({ error: "Missing url parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle OpenSubtitles API download
    if (subtitleUrl.includes('opensubtitles.com') && fileId && apiKey) {
      console.log('[proxy-subtitle] Downloading from OpenSubtitles API, file_id:', fileId);

      const downloadResponse = await fetch(subtitleUrl, {
        method: 'POST',
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'ArFlix/1.0',
        },
        body: JSON.stringify({ file_id: parseInt(fileId) }),
      });

      if (!downloadResponse.ok) {
        console.error('[proxy-subtitle] OpenSubtitles download failed:', downloadResponse.status);
        return new Response(
          JSON.stringify({ error: `OpenSubtitles download failed: ${downloadResponse.status}` }),
          { status: downloadResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const downloadData = await downloadResponse.json();
      const downloadLink = downloadData.link;

      if (!downloadLink) {
        return new Response(
          JSON.stringify({ error: "No download link returned" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log('[proxy-subtitle] Got download link:', downloadLink);
      subtitleUrl = downloadLink;
    }

    // Force HTTPS for all subtitle URLs
    if (subtitleUrl.startsWith('http://')) {
      console.log('[proxy-subtitle] Converting HTTP to HTTPS:', subtitleUrl);
      subtitleUrl = subtitleUrl.replace('http://', 'https://');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(subtitleUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ArFlix/1.0",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch subtitle: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    const isGzipped = contentType.includes("gzip") || subtitleUrl.toLowerCase().endsWith(".gz");

    let content: string;

    if (isGzipped) {
      const arrayBuffer = await response.arrayBuffer();
      const decompressed = new DecompressionStream("gzip");
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(arrayBuffer));
          controller.close();
        }
      });

      const decompressedStream = stream.pipeThrough(decompressed);
      const reader = decompressedStream.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      content = new TextDecoder().decode(result);
    } else {
      content = await response.text();
    }

    const isSrt = subtitleUrl.toLowerCase().includes(".srt") || (content.includes("-->") && !content.startsWith("WEBVTT"));

    if (isSrt) {
      content = convertSrtToVtt(content);
    }

    return new Response(content, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/vtt; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("Subtitle proxy error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
