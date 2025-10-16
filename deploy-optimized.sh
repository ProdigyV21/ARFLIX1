#!/bin/bash

# ARFLIX Optimized Supabase Deployment
# This script deploys only essential functions (NO video/subtitle proxy)

set -e

echo "🚀 ARFLIX Optimized Deployment"
echo "================================"
echo ""

# Check if SUPABASE_PROJECT_ID is set
if [ -z "$SUPABASE_PROJECT_ID" ]; then
  echo "❌ Error: SUPABASE_PROJECT_ID not set"
  echo "Run: export SUPABASE_PROJECT_ID=your_new_project_id"
  exit 1
fi

echo "📦 Project ID: $SUPABASE_PROJECT_ID"
echo ""

# Essential functions only (NO proxy-video, NO proxy-subtitle)
ESSENTIAL_FUNCTIONS=(
  "catalog-home"
  "catalog-meta"
  "catalog-search"
  "catalog-streams"
  "catalog-episodes"
  "catalog-seasons"
  "catalog-subtitles"
  "tmdb-proxy"
  "fetch-subtitles"
  "addon-catalog"
  "addon-manage"
  "addon-register"
)

echo "✅ Deploying ${#ESSENTIAL_FUNCTIONS[@]} essential functions"
echo "❌ Skipping: proxy-video, proxy-subtitle (bandwidth hogs)"
echo ""

for func in "${ESSENTIAL_FUNCTIONS[@]}"; do
  if [ -d "supabase/functions/$func" ]; then
    echo "📤 Deploying: $func"
    supabase functions deploy "$func" --project-ref "$SUPABASE_PROJECT_ID"
  else
    echo "⚠️  Skipping: $func (not found)"
  fi
done

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Expected bandwidth usage:"
echo "   - Before: ~7000 GB/month (with proxy-video)"
echo "   - After:  <1 GB/month (metadata only)"
echo ""
echo "🔧 Next steps:"
echo "   1. Update .env with new VITE_SUPABASE_URL"
echo "   2. Update .env with new VITE_SUPABASE_ANON_KEY"
echo "   3. Run: npm run dev"
