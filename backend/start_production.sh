#!/bin/bash

echo "🚀 Starting Production Backend with Enhanced Configuration"
echo "=========================================================="

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
else
    echo "❌ .env file not found!"
    exit 1
fi

# Start with uvicorn with production settings
python -m uvicorn app:app \
    --host 0.0.0.0 \
    --port ${PORT:-5002} \
    --timeout-keep-alive 75 \
    --timeout-graceful-shutdown 30 \
    --limit-concurrency 1000 \
    --limit-max-requests 10000 \
    --log-level info \
    --access-log \
    --use-colors \
    --proxy-headers \
    --forwarded-allow-ips='*'

# For production with SSL:
# --ssl-keyfile=/path/to/key.pem \
# --ssl-certfile=/path/to/cert.pem \
