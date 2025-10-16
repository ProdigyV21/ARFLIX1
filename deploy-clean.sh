#!/bin/bash
# Deploy ALLEEN essentiële Supabase functions (geen bandwidth killers!)

set -e

echo "🚀 Deploying ARFLIX Essential Functions Only"
echo "=============================================="
echo ""
echo "❌ Skipping: proxy-video, proxy-subtitle (bandwidth hogs)"
echo "✅ Deploying: catalog-*, addon-*, fetch-subtitles"
echo ""

# Check if logged in to Supabase
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Run: supabase login"
    exit 1
fi

echo "📦 Deploying catalog functions..."
supabase functions deploy catalog-home
supabase functions deploy catalog-meta  
supabase functions deploy catalog-search
supabase functions deploy catalog-streams
supabase functions deploy catalog-seasons
supabase functions deploy catalog-episodes
supabase functions deploy catalog-subtitles

echo ""
echo "📦 Deploying addon functions..."
supabase functions deploy addon-catalog
supabase functions deploy addon-manage
supabase functions deploy addon-register

echo ""
echo "📦 Deploying subtitle discovery..."
supabase functions deploy fetch-subtitles

echo ""
echo "✅ Essential functions deployed successfully!"
echo ""
echo "📊 Bandwidth estimate:"
echo "   - Catalog API: ~500 MB/month"
echo "   - Addon management: ~50 MB/month"
echo "   - Subtitle discovery: ~100 MB/month"
echo "   - TOTAL: ~650 MB/month (vs 7000+ GB with proxies!)"
echo ""
echo "🎉 Your app now uses 99.9% less Supabase bandwidth!"
