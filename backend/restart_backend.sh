#!/bin/bash

echo "🔄 Restarting Backend Server"
echo "============================"

# Find and kill existing Python process running app.py
PID=$(ps aux | grep "[p]ython.*app.py" | awk '{print $2}')

if [ ! -z "$PID" ]; then
    echo "🛑 Stopping existing backend (PID: $PID)"
    kill -9 $PID
    sleep 2
else
    echo "ℹ️  No existing backend process found"
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "   Create .env file with your configuration"
    exit 1
fi

# Start backend
echo "🚀 Starting backend..."
nohup python app.py > backend.log 2>&1 &
NEW_PID=$!

sleep 3

# Check if it's running
if ps -p $NEW_PID > /dev/null; then
    echo "✅ Backend started successfully (PID: $NEW_PID)"
    echo "📝 Logs: tail -f backend.log"
    echo ""
    echo "Recent logs:"
    tail -20 backend.log
else
    echo "❌ Backend failed to start!"
    echo "Check backend.log for errors"
    cat backend.log
    exit 1
fi
