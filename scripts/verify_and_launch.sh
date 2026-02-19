#!/bin/bash

echo "🚀 Starting Verification & Launch Cycle..."

# 1. Kill existing processes to ensure clean state
echo "🧹 Cleaning up old processes..."
pkill -f "proxy.ts|vite preview" || true

# 2. Build the application
echo "🏗️  Building application..."
npm run build:app || { echo "❌ Build failed"; exit 1; }

# 2.5 Run Playwright GUI tests against the build
echo "🧪 Running Playwright GUI tests..."
npm run test:gui || { echo "⚠️  Playwright tests failed. Review the report: npx playwright show-report"; }

# 3. Start API Server (Detached)
echo "🔌 Starting API Server..."
nohup npm run server > dev_server.log 2>&1 &
SERVER_PID=$!
echo "   PID: $SERVER_PID"

# 4. Start Production Preview (Detached)
echo "🌐 Starting Preview Server..."
nohup npx vite preview --port 3000 --host 0.0.0.0 > dev_preview.log 2>&1 &
PREVIEW_PID=$!
echo "   PID: $PREVIEW_PID"

# 5. Wait for servers to stabilize
echo "⏳ Waiting for services to be ready..."
sleep 3

# 6. Open in Browser
echo "👀 Opening http://localhost:3000 ..."
open http://localhost:3000

echo "✅ Done! Logs are in dev_server.log and dev_preview.log"
