#!/bin/bash

echo "🔍 Production Authentication Diagnostic Tool"
echo "=============================================="
echo ""

# Check if .env exists
if [ -f ".env" ]; then
    echo "✅ .env file found"
    echo ""
    echo "📋 Critical Environment Variables:"
    echo "-----------------------------------"
    grep -E "NODE_ENV|FRONTEND_URL|CALLBACK_URL|SSO_ID" .env | sed 's/=.*/=***HIDDEN***/'
    echo ""
    
    # Check NODE_ENV
    NODE_ENV=$(grep "^NODE_ENV=" .env | cut -d'=' -f2)
    if [ "$NODE_ENV" == "production" ]; then
        echo "✅ NODE_ENV=production (HTTPS cookies enabled)"
    else
        echo "⚠️  NODE_ENV=$NODE_ENV (Development mode)"
    fi
    
    # Check FRONTEND_URL
    FRONTEND_URL=$(grep "^FRONTEND_URL=" .env | cut -d'=' -f2)
    if [[ $FRONTEND_URL == https://* ]]; then
        echo "✅ FRONTEND_URL uses HTTPS: $FRONTEND_URL"
    elif [[ $FRONTEND_URL == http://* ]]; then
        echo "❌ FRONTEND_URL uses HTTP: $FRONTEND_URL (Production requires HTTPS!)"
    else
        echo "⚠️  FRONTEND_URL not set or invalid"
    fi
    
else
    echo "❌ .env file NOT found!"
    echo "   Create .env file from .env.production.example"
fi

echo ""
echo "🌐 Network Tests:"
echo "-----------------"

# Check if backend is running
if command -v curl &> /dev/null; then
    echo "Testing backend health endpoint..."
    curl -s http://localhost:5002/health > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Backend is running on port 5002"
    else
        echo "❌ Backend is NOT responding on port 5002"
    fi
else
    echo "⚠️  curl not installed, skipping network tests"
fi

echo ""
echo "📝 Next Steps:"
echo "--------------"
echo "1. Check backend logs: tail -f logs/app.log"
echo "2. Test OAuth flow: Open browser to /auth/authorize"
echo "3. Check browser DevTools for cookies and CORS errors"
echo "4. Read PRODUCTION_AUTH_TROUBLESHOOTING.md for detailed guide"
echo ""
