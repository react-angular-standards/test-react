# Unified Authentication Service

**WSSO (Keycloak/OIDC) + Transparent Screen Lock** in one service

## 🎯 Features

### Dual Authentication Strategy
- **Localhost** (http://localhost:3000) → Transparent Screen Lock (Windows Event Log)
- **Remote** (https://app.example.com) → WSSO/OIDC (Keycloak, Auth0, etc.)
- Automatic detection based on `FRONTEND_URL`

### Production-Ready
- ✅ Redis session storage
- ✅ JWT signature verification
- ✅ Rate limiting
- ✅ Security headers
- ✅ Token refresh
- ✅ PKCE flow
- ✅ Cross-platform (Windows-specific features auto-disabled on Linux/Mac)

## 🚀 Quick Start

### 1. Fix pywin32 DLL Error (Windows Only)

```powershell
# Run in PowerShell as Administrator
pip uninstall pywin32
pip install pywin32==306
python .venv\Scripts\pywin32_postinstall.py -install

# Verify
python -c "import win32api; print('Success!')"
```

If still failing, install Visual C++ Redistributable:
https://aka.ms/vs/17/release/vc_redist.x64.exe

### 2. Install Dependencies

```bash
pip install -r requirements_unified.txt
```

### 3. Setup Redis

```bash
# Windows (download from: https://github.com/microsoftarchive/redis/releases)
redis-server.exe

# Linux/Mac
brew install redis && brew services start redis
# or
sudo apt install redis-server && sudo systemctl start redis
```

### 4. Configure

```bash
cp .env.unified.example .env
# Edit .env with your values
```

### 5. Run

```bash
python unified_auth_service.py
```

## 🔐 Authentication Flow

### Scenario 1: Localhost Development (Transparent Lock)

```
User accesses: http://localhost:3000
    ↓
GET /auth/authorize
    ↓
Detects localhost → Checks Windows Event Log
    ↓
If Transparent Screen Lock event exists:
    → Creates session with event data
    → Redirects: http://localhost:3000?authorized=true&method=transparent_lock
    ↓
Frontend calls /auth/session → Gets user info
```

**User Info from Transparent Lock:**
```json
{
  "sub": "S-1-5-21-...",
  "name": "User unlocked screen at 2025-10-01...",
  "auth_method": "transparent_lock"
}
```

### Scenario 2: Remote Access (WSSO)

```
User accesses: https://app.example.com
    ↓
GET /auth/authorize
    ↓
Detects remote → Initiates OIDC flow
    ↓
Redirects to Keycloak → User logs in → Returns to /callback
    ↓
Token exchange → Verify ID token → Create session
    ↓
Redirects: https://app.example.com?authorized=true&method=wsso
    ↓
Frontend calls /auth/session → Gets user info
```

**User Info from WSSO:**
```json
{
  "sub": "user-uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "auth_method": "wsso"
}
```

## 📋 API Endpoints

### Health & Discovery
- `GET /health` - Health check (shows auth methods available)
- `GET /auth/discovery` - OIDC discovery
- `GET /auth/jwks` - JWKS

### Authentication (Unified)
- `GET /auth/authorize` - **Smart login** (chooses method based on origin)
- `GET /callback` - OIDC callback (WSSO only)
- `GET /auth/session` - Get current session
- `GET /auth/userinfo` - Get user info (requires auth)
- `POST /auth/refresh` - Refresh token (WSSO only)
- `POST /auth/signout` - Sign out (clears session)
- `GET /auth/logout` - Full logout

### Transparent Lock Specific (Windows)
- `GET /transparent/current-user` - Get current user from Event Log
- `GET /transparent/events` - Get all captured events

## 🖥️ Frontend Integration

### React Example

```javascript
// On app mount
useEffect(() => {
  async function checkAuth() {
    const response = await fetch('http://localhost:5002/auth/session', {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (data.user) {
      setUser(data.user);
      console.log('Auth method:', data.authMethod); // 'wsso' or 'transparent_lock'
    } else {
      // Redirect to login
      window.location.href = 'http://localhost:5002/auth/authorize';
    }
  }
  
  checkAuth();
}, []);

// Handle API calls with token refresh
async function apiCall(url) {
  let response = await fetch(url, { credentials: 'include' });
  
  if (response.status === 401) {
    // Try refresh (only works for WSSO)
    const refreshResponse = await fetch('http://localhost:5002/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    
    if (refreshResponse.ok) {
      response = await fetch(url, { credentials: 'include' });
    } else {
      window.location.href = 'http://localhost:5002/auth/authorize';
    }
  }
  
  return response.json();
}

// Logout
async function logout() {
  await fetch('http://localhost:5002/auth/signout', {
    method: 'POST',
    credentials: 'include'
  });
  window.location.href = '/';
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSPARENT_LOCK_ENABLED` | `true` | Enable/disable Transparent Lock auth |
| `TRANSPARENT_LOCK_SOURCE` | `Transparent Screen Lock` | Event log source name |
| `TRANSPARENT_LOCK_LOG_TYPE` | `Application` | Windows event log type |
| `FRONTEND_URL` | `http://localhost:3000` | Frontend URL (determines auth method) |

### Localhost Detection

The service checks if `FRONTEND_URL` hostname is:
- `localhost`
- `127.0.0.1`
- `::1`

If yes → Use Transparent Lock (if available)  
If no → Use WSSO/OIDC

### Force WSSO for Localhost

If you want to test WSSO on localhost:

```python
# In unified_auth_service.py, modify is_localhost_request():
def is_localhost_request(frontend_url: str) -> bool:
    return False  # Force WSSO
```

Or set environment variable:
```bash
TRANSPARENT_LOCK_ENABLED=false
```

## 🐛 Troubleshooting

### pywin32 DLL Error

**Error:** `ImportError: DLL load failed while importing win32api`

**Solution:**
1. Run as Administrator:
   ```powershell
   pip uninstall pywin32
   pip install pywin32==306
   python .venv\Scripts\pywin32_postinstall.py -install
   ```
2. Install VC++ Redistributable: https://aka.ms/vs/17/release/vc_redist.x64.exe
3. Restart terminal/IDE

### Transparent Lock Not Working

**Check:**
1. Windows only (auto-disabled on Linux/Mac)
2. `TRANSPARENT_LOCK_ENABLED=true` in `.env`
3. Transparent Screen Lock app is running
4. Events are being logged: `Event Viewer → Windows Logs → Application`

**Test Manually:**
```python
import win32evtlog
hand = win32evtlog.OpenEventLog('localhost', 'Application')
events = win32evtlog.ReadEventLog(hand, win32evtlog.EVENTLOG_FORWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ, 0)
print([e.SourceName for e in events[:10]])
```

### No Session After Login

**Check:**
1. Cookies enabled in browser
2. CORS allows credentials
3. Redis is running: `redis-cli ping`
4. Check logs for errors

### Both Auth Methods Failing

**Check:**
```bash
# Health check
curl http://localhost:5002/health

# Should return:
{
  "status": "healthy",
  "redis": "connected",
  "wsso": "enabled",
  "transparent_lock": true  # or false
}
```

## 📊 Monitoring

### Check Active Sessions

```bash
redis-cli
KEYS session:*
GET session:SESSION_ID_HERE
```

### Monitor Transparent Lock Events

```bash
curl http://localhost:5002/transparent/events
```

### Logs

```bash
# View logs
python unified_auth_service.py 2>&1 | tee app.log

# Filter by auth method
grep "Transparent Lock" app.log
grep "WSSO" app.log
```

## 🔄 Migration from Separate Services

### From Old Flask Service (Windows Event Log)

**Old:**
```python
# Separate Flask app
app.run(port=8888)
```

**New:**
```python
# Integrated into unified service
# Runs on port 5002
# Endpoint: /transparent/current-user (instead of /currentLoginUser)
```

### From Separate WSSO Service

**Old:**
```python
# app.py or app_production.py
# Port 5002
```

**New:**
```python
# unified_auth_service.py
# Same port 5002
# Same endpoints, but with smart auth method selection
```

## 🎯 Use Cases

### Use Case 1: Corporate Network + Remote Access
- **Office network (localhost):** Employees use Transparent Screen Lock
- **Remote/VPN:** Employees use WSSO with Keycloak

### Use Case 2: Development + Production
- **Development (localhost:3000):** Quick auth with Transparent Lock
- **Production (app.example.com):** Secure WSSO with 2FA

### Use Case 3: Hybrid Auth
- **Windows machines:** Transparent Lock available
- **Linux/Mac machines:** Automatically fallback to WSSO

## 📝 License

MIT