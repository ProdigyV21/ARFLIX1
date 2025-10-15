#!/bin/bash

# ARFLIX Supabase Setup Script
# This script runs all database migrations and sets up edge functions

set -e

echo "🚀 ARFLIX Supabase Setup"
echo "========================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Load environment variables
source .env

if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}❌ Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set in .env${NC}"
    exit 1
fi

echo -e "${BLUE}📍 Supabase URL: $VITE_SUPABASE_URL${NC}"
echo ""

# Step 1: Run migrations manually via SQL Editor
echo -e "${YELLOW}⚠️  Manual Step Required:${NC}"
echo ""
echo "Please follow these steps to set up your database:"
echo ""
echo "1. Open Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/guzjdzntmqglaxripphb"
echo ""
echo "2. Go to: SQL Editor → New Query"
echo ""
echo "3. Copy and paste each migration file from 'supabase/migrations/' in order:"
echo ""
for migration in supabase/migrations/*.sql; do
    filename=$(basename "$migration")
    echo "   - $filename"
done
echo ""
echo "4. Run each migration by clicking 'Run' (or Ctrl+Enter)"
echo ""
echo -e "${GREEN}✅ Once done, your database schema will be ready!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 2: Set up Edge Functions
echo -e "${YELLOW}📦 Edge Functions Setup${NC}"
echo ""
echo "Edge functions need to be deployed via Supabase CLI or manually."
echo ""
echo "Option A: Use Supabase CLI (requires login)"
echo "  npx supabase functions deploy tmdb-proxy"
echo "  npx supabase functions deploy catalog-home"
echo "  # etc..."
echo ""
echo "Option B: Copy functions manually in Supabase Dashboard"
echo "  1. Go to: Edge Functions → Create a new function"
echo "  2. Copy code from: supabase/functions/[function-name]/index.ts"
echo "  3. Deploy"
echo ""
echo "Functions to deploy:"
ls -1 supabase/functions/ | grep -v "_shared" | while read func; do
    echo "  - $func"
done
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 3: Set secrets
echo -e "${YELLOW}🔐 Edge Function Secrets${NC}"
echo ""
echo "Set the TMDB API key as a secret:"
echo ""
echo "1. Go to: Edge Functions → Settings → Secrets"
echo "2. Add new secret:"
echo "   Name: TMDB_API_KEY"
echo "   Value: 080380c1ad7b3967af3def25159e4374"
echo ""
echo -e "${GREEN}✅ This allows edge functions to access TMDB API securely${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Final message
echo -e "${GREEN}🎉 Setup Instructions Complete!${NC}"
echo ""
echo "After completing the manual steps above, your ARFLIX app will be ready!"
echo ""
echo "Test by running:"
echo "  npm run dev"
echo ""
echo "Then try to sign up / login at: http://localhost:5176"
echo ""
