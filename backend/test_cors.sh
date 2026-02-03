#!/bin/bash

echo "🧪 Testing CORS Configuration"
echo "=============================="
echo ""

# Get backend URL
BACKEND_URL="${1:-http://localhost:5002}"
FRONTEND_URL="${2:-http://localhost:3000}"

echo "Backend: $BACKEND_URL"
echo "Frontend Origin: $FRONTEND_URL"
echo ""

echo "Test 1: OPTIONS Preflight Request"
echo "----------------------------------"
curl -X OPTIONS "$BACKEND_URL/auth/session" \
  -H "Origin: $FRONTEND_URL" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type, Cookie" \
  -v \
  2>&1 | grep -E "< HTTP|< Access-Control"

echo ""
echo ""
echo "Test 2: GET Request with Origin"
echo "--------------------------------"
curl -X GET "$BACKEND_URL/auth/session" \
  -H "Origin: $FRONTEND_URL" \
  -v \
  2>&1 | grep -E "< HTTP|< Access-Control|authenticated"

echo ""
echo ""
echo "Test 3: Health Check"
echo "--------------------"
curl -s "$BACKEND_URL/health" | head -5

echo ""
echo ""
echo "📋 Check backend logs for detailed output:"
echo "   tail -f backend.log"
