# 🚨 Production Authentication Troubleshooting Guide

## Error: "OPTIONS /auth/session - 400 Bad Request"

---

## ✅ CHECKLIST: Fix Production Auth Issues

### 1. Environment Variables (CRITICAL)

Check your production `.env` file has:

```bash
# Must be set to "production" for HTTPS cookie behavior
NODE_ENV=production

# Must be your ACTUAL frontend URL (with https://)
FRONTEND_URL=https://your-actual-frontend-domain.com

# Must match OAuth provider callback configuration
CALLBACK_URL=https://your-backend-domain.com/auth/callback
```

**Test:**
```bash
# On production server
echo $NODE_ENV
echo $FRONTEND_URL
echo $CALLBACK_URL
```

---

### 2. HTTPS Requirements (CRITICAL in Production)

**Production cookies REQUIRE:**
- ✅ Both frontend AND backend must use HTTPS
- ✅ `Secure=True` flag (automatically set when NODE_ENV=production)
- ✅ `SameSite=None` for cross-origin (automatically set when NODE_ENV=production)

**Check:**
```bash
# Frontend URL must start with https://
curl -I https://your-frontend.com

# Backend URL must start with https://
curl -I https://your-backend.com/health
```

**If using HTTP in production:**
Your cookies will NOT work! Modern browsers block insecure cookies.

---

### 3. CORS Configuration

**Problem:** Backend not allowing your frontend origin

**Check backend startup logs:**
```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:5002
```

**Should see:**
```python
# In production, allowed_origins should include your FRONTEND_URL
allowed_origins = ['https://your-frontend.com']
```

**Fix:** Make sure `FRONTEND_URL` in `.env` exactly matches your frontend domain:
```bash
# Wrong ❌
FRONTEND_URL=http://your-frontend.com  # HTTP in production!
FRONTEND_URL=https://your-frontend.com/  # Extra trailing slash!

# Correct ✅
FRONTEND_URL=https://your-frontend.com
```

---

### 4. Cookie Domain Settings

**The backend automatically detects cookie domain from FRONTEND_URL**

**Examples:**

| FRONTEND_URL | Cookie Domain | Works For |
|--------------|---------------|-----------|
| `https://app.company.com` | `.company.com` | All *.company.com |
| `https://192.168.1.100` | `None` (IP-based) | Only that IP |
| `https://server.local` | `.local` | All *.local |

**Check backend logs on callback:**
```
✅ Setting cookie: secure=True, samesite=none, domain=.company.com
```

**Common Issues:**

❌ **Frontend and backend on different domains:**
```
Frontend: https://frontend.company.com
Backend:  https://api.different.com
Cookie domain: .different.com

Result: Browser won't send cookie to different.com from frontend.company.com
```

✅ **Solution:** Use subdomain pattern:
```
Frontend: https://app.company.com
Backend:  https://api.company.com
Cookie domain: .company.com

Result: Cookie shared across all *.company.com subdomains
```

---

### 5. Proxy/Reverse Proxy Configuration

**If using nginx, Apache, or cloud load balancer:**

#### nginx Example:
```nginx
server {
    listen 443 ssl;
    server_name api.company.com;

    # CRITICAL: Pass original scheme/host to backend
    location / {
        proxy_pass http://localhost:5002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;  # ← CRITICAL!
        
        # CORS headers (if not handled by FastAPI)
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Credentials true always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, Cookie" always;
    }
}
```

**Common proxy issues:**
- ❌ Backend receives HTTP requests even though client uses HTTPS
- ❌ Backend doesn't know original hostname
- ❌ Cookies set for wrong domain

---

## 🔧 DEBUGGING STEPS

### Step 1: Check Backend Health
```bash
curl https://your-backend.com/health
```

**Expected:**
```json
{
  "status": "healthy",
  "timestamp": "...",
  "auth": {
    "oidc_configured": true,
    "session_timeout": "24 hours"
  }
}
```

---

### Step 2: Test CORS Preflight
```bash
curl -X OPTIONS https://your-backend.com/auth/session \
  -H "Origin: https://your-frontend.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

**Expected response headers:**
```
Access-Control-Allow-Origin: https://your-frontend.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

**If you get 400 or missing headers:**
- ❌ CORS not configured
- ❌ FRONTEND_URL mismatch

---

### Step 3: Test OAuth Flow Manually

1. **Start OAuth flow:**
```bash
# Open in browser
https://your-backend.com/auth/authorize?frontend_url=https://your-frontend.com
```

2. **After login, check backend logs:**
```
✅ Callback received
✅ Tokens received
✅ Setting cookie: secure=True, samesite=none, domain=.company.com
✅ Redirecting to: https://your-frontend.com
```

3. **Check browser DevTools:**
```
Application → Cookies → https://your-frontend.com
Should see: auth_session cookie
```

**If no cookie:**
- ❌ Domain mismatch
- ❌ Secure flag issue (HTTP instead of HTTPS)
- ❌ SameSite=None without Secure=True

---

### Step 4: Check Frontend Request
```javascript
// In browser console (DevTools)
fetch('https://your-backend.com/auth/session', {
  method: 'GET',
  credentials: 'include'  // ← CRITICAL!
})
.then(r => r.json())
.then(console.log)
```

**Expected:**
```json
{
  "authenticated": true,
  "user": {
    "name": "...",
    "email": "..."
  }
}
```

**If 400 error:**
- ❌ Cookie not sent (check `credentials: 'include'`)
- ❌ CORS origin not allowed
- ❌ Cookie expired or invalid

---

## 🚀 QUICK FIXES

### Fix 1: Update Environment Variables
```bash
# On production server
nano .env

# Update these:
NODE_ENV=production
FRONTEND_URL=https://your-actual-frontend.com
CALLBACK_URL=https://your-backend.com/auth/callback

# Restart backend
systemctl restart your-backend-service
# or
pm2 restart backend
```

---

### Fix 2: Add Explicit CORS Origin (Temporary Debug)

Edit `backend/app.py` line ~140:

```python
# Temporarily allow all origins for testing (NOT for production!)
if IS_PRODUCTION:
    cors_config["allow_origin_regex"] = r"https://.*"  # Allow any HTTPS
    # cors_config["allow_origins"] = allowed_origins  # Comment out
```

**Restart and test.** If this works, the issue is `allowed_origins` list.

---

### Fix 3: Frontend Must Send Credentials

**React (fetch):**
```typescript
fetch('https://backend.com/auth/session', {
  credentials: 'include'  // ← Add this
})
```

**Axios:**
```typescript
axios.get('https://backend.com/auth/session', {
  withCredentials: true  // ← Add this
})
```

---

## 📊 COMMON PRODUCTION SCENARIOS

### Scenario 1: Corporate Proxy/Firewall
**Symptoms:**
- Works on local network
- Fails from outside

**Fix:** Check firewall rules, add backend domain to allowed list

---

### Scenario 2: Load Balancer Stripping Headers
**Symptoms:**
- Direct backend access works
- Through load balancer fails

**Fix:** Configure load balancer to preserve headers:
- Host
- X-Forwarded-For
- X-Forwarded-Proto

---

### Scenario 3: Different Ports on Same Host
**Example:**
- Frontend: `https://server.com:3000`
- Backend: `https://server.com:5002`

**Issue:** Cookies set for `server.com` work, but SameSite=None requires ports match

**Fix:** Use reverse proxy to serve both on standard ports (443)

---

## 📝 ENVIRONMENT CHECKLIST

Before production deployment:

- [ ] `NODE_ENV=production` is set
- [ ] `FRONTEND_URL` matches actual frontend (with https://)
- [ ] `CALLBACK_URL` matches OAuth provider configuration
- [ ] Both frontend and backend use HTTPS
- [ ] Frontend sends `credentials: 'include'` with fetch
- [ ] OAuth provider callback URL is whitelisted
- [ ] Network/firewall allows traffic between frontend and backend
- [ ] Cookie domain is correct for your setup
- [ ] Backend logs show successful cookie setting
- [ ] Browser DevTools shows auth_session cookie

---

## 🆘 STILL NOT WORKING?

### Collect Debug Info:

1. **Backend logs on callback:**
```bash
tail -f /var/log/your-backend.log | grep -E "Callback|Cookie|Session"
```

2. **Browser DevTools:**
- Network tab: Check `/auth/session` request headers
- Application tab: Check cookies
- Console: Check for CORS errors

3. **Environment:**
```bash
# On server
env | grep -E "NODE_ENV|FRONTEND_URL|CALLBACK_URL"
```

4. **Test HTTPS:**
```bash
openssl s_client -connect your-backend.com:443 -servername your-backend.com
```

Share this information for further debugging!

---

## 📞 Need Help?

Provide:
1. Backend logs (callback + session check)
2. Browser DevTools screenshots (Network + Application tabs)
3. Environment variables (sanitized)
4. Frontend and backend URLs
5. Hosting setup (nginx/docker/cloud provider)
