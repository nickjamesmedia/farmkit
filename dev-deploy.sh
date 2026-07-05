#!/bin/bash
# Build the frontend against the DEV Supabase project and refresh what the
# farmkit_dev container serves at 10.0.0.148:8789 (dev.farmkit.app).
# Env comes from frontend/.env.devfarm.local (gitignored).
set -e
cd "$(dirname "$0")/frontend"
npm run build:dev
echo "dev build served — hard-refresh dev.farmkit.app"
