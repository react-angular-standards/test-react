"""
Unified Authentication Service
- WSSO (Keycloak/OIDC) for production/remote access
- Transparent Screen Lock for localhost development
"""

import os
import sys
from typing import Dict, Any, Optional
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from authlib.jose import jwt, JsonWebKey, KeySet
from datetime import datetime, timedelta
import uvicorn
from dotenv import load_dotenv
import logging
import requests
import secrets
import base64
import hashlib
from urllib.parse import urlencode, urlparse
import redis
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic_settings import BaseSettings
from pydantic import Field
import threading
import time

# Platform-specific imports
if sys.platform == 'win32':
    try:
        import win32evtlog
        import win32evtlogutil
        WINDOWS_EVENT_LOG_AVAILABLE = True
    except ImportError:
        WINDOWS_EVENT_LOG_AVAILABLE = False
        logging.warning("win32evtlog not available. Transparent Screen Lock authentication disabled.")
else:
    WINDOWS_EVENT_LOG_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

# Settings
class Settings(BaseSettings):
    SSO_ID: str
    SSO_SECRET: str
    OIDC_BASE: str
    OIDC_ISSUER: str
    CALLBACK_URL: str
    FRONTEND_URL: str
    SESSION_SECRET: str = Field(min_length=32)
    AUTH_SECRET: str = Field(min_length=32)
    PORT: int = 5002
    NODE_ENV: str = "development"

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None

    # Session
    SESSION_TIMEOUT_HOURS: int = 1
    PKCE_TIMEOUT_MINUTES: int = 10

    # SSL
    SSL_VERIFY: bool = True
    SSL_CERT_PATH: Optional[str] = None

    # Transparent Screen Lock (Windows)
    TRANSPARENT_LOCK_ENABLED: bool = True
    TRANSPARENT_LOCK_SOURCE: str = "Transparent Screen Lock"
    TRANSPARENT_LOCK_LOG_TYPE: str = "Application"

    class Config:
        env_file = ".env"

try:
    settings = Settings()
except Exception as e:
    logger.error(f"Configuration error: {e}")
    raise

IS_PRODUCTION = settings.NODE_ENV == "production"

# Initialize FastAPI
app = FastAPI(
    title="Unified Authentication Service (WSSO + Transparent Lock)",
    docs_url="/docs" if not IS_PRODUCTION else None,
    redoc_url="/redoc" if not IS_PRODUCTION else None,
    openapi_url="/openapi.json" if not IS_PRODUCTION else None
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Session middleware
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET,
    same_site="lax",
    https_only=IS_PRODUCTION
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Cookie"],
    expose_headers=["Set-Cookie"],
)

# Redis connection
try:
    redis_client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        password=settings.REDIS_PASSWORD,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_keepalive=True,
        health_check_interval=30
    )
    redis_client.ping()
    logger.info("✅ Redis connected")
except Exception as e:
    logger.error(f"❌ Redis connection failed: {e}")
    raise

# Global storage for Transparent Screen Lock events
transparent_lock_current_user = {}
transparent_lock_events = []

# JWKS cache
jwks_cache = {"keys": None, "expires_at": 0}

# ============================================================================
# HELPER FUNCTIONS - WSSO
# ============================================================================

def is_localhost_request(frontend_url: str) -> bool:
    """Check if frontend URL is localhost"""
    parsed = urlparse(frontend_url)
    hostname = parsed.hostname or parsed.netloc.split(':')[0]
    return hostname in ['localhost', '127.0.0.1', '::1']

def generate_code_verifier() -> str:
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')

def generate_code_challenge(verifier: str) -> str:
    hashed = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(hashed).decode('utf-8').rstrip('=')

def generate_session_id() -> str:
    return secrets.token_urlsafe(32)

def get_jwks() -> KeySet:
    global jwks_cache
    if jwks_cache["keys"] and time.time() < jwks_cache["expires_at"]:
        return jwks_cache["keys"]

    try:
        ssl_verify = settings.SSL_VERIFY
        if settings.SSL_CERT_PATH:
            ssl_verify = settings.SSL_CERT_PATH

        response = requests.get(
            f"{settings.OIDC_BASE}/protocol/openid-connect/certs",
            timeout=10,
            verify=ssl_verify
        )
        response.raise_for_status()
        jwks_data = response.json()
        keys = KeySet([JsonWebKey.import_key(key) for key in jwks_data.get("keys", [])])
        jwks_cache["keys"] = keys
        jwks_cache["expires_at"] = time.time() + 3600
        return keys
    except Exception as e:
        logger.error(f"Failed to fetch JWKS: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch JWKS")

def verify_id_token(id_token: str) -> Dict[str, Any]:
    try:
        jwks = get_jwks()
        claims = jwt.decode(id_token, jwks)
        claims.validate()

        if claims.get("iss") != settings.OIDC_ISSUER:
            raise ValueError(f"Invalid issuer: {claims.get('iss')}")
        if settings.SSO_ID not in claims.get("aud", []):
            raise ValueError(f"Invalid audience")
        if claims.get("exp", 0) < time.time():
            raise ValueError("Token expired")

        return dict(claims)
    except Exception as e:
        logger.error(f"ID token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid ID token")

def store_session(session_id: str, data: Dict[str, Any], ttl_hours: int = None) -> None:
    if ttl_hours is None:
        ttl_hours = settings.SESSION_TIMEOUT_HOURS
    try:
        import json
        redis_client.setex(
            f"session:{session_id}",
            timedelta(hours=ttl_hours),
            json.dumps(data)
        )
    except Exception as e:
        logger.error(f"Failed to store session: {e}")
        raise HTTPException(status_code=500, detail="Session storage failed")

def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    try:
        import json
        data = redis_client.get(f"session:{session_id}")
        if data:
            redis_client.expire(f"session:{session_id}", timedelta(hours=settings.SESSION_TIMEOUT_HOURS))
            return json.loads(data)
        return None
    except Exception as e:
        logger.error(f"Failed to get session: {e}")
        return None

def delete_session(session_id: str) -> None:
    try:
        redis_client.delete(f"session:{session_id}")
    except Exception as e:
        logger.error(f"Failed to delete session: {e}")

def store_pkce_data(state: str, data: Dict[str, Any]) -> None:
    try:
        import json
        redis_client.setex(
            f"pkce:{state}",
            timedelta(minutes=settings.PKCE_TIMEOUT_MINUTES),
            json.dumps(data)
        )
    except Exception as e:
        logger.error(f"Failed to store PKCE data: {e}")
        raise HTTPException(status_code=500, detail="PKCE storage failed")

def get_pkce_data(state: str) -> Optional[Dict[str, Any]]:
    try:
        import json
        data = redis_client.get(f"pkce:{state}")
        if data:
            redis_client.delete(f"pkce:{state}")
            return json.loads(data)
        return None
    except Exception as e:
        logger.error(f"Failed to get PKCE data: {e}")
        return None

def get_current_user(request: Request) -> Dict[str, Any]:
    session_id = request.cookies.get("session_id")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = get_session(session_id)
    if not session_data:
        raise HTTPException(status_code=401, detail="Session expired")

    return session_data.get("user_info", {})

# ============================================================================
# TRANSPARENT SCREEN LOCK - Windows Event Log Listener
# ============================================================================

def listen_event_logs():
    """Background thread to monitor Windows Event Log for Transparent Screen Lock events"""
    global transparent_lock_current_user

    if not WINDOWS_EVENT_LOG_AVAILABLE:
        logger.warning("Windows Event Log monitoring not available on this platform")
        return

    if not settings.TRANSPARENT_LOCK_ENABLED:
        logger.info("Transparent Screen Lock authentication disabled")
        return

    server = 'localhost'
    log_type = settings.TRANSPARENT_LOCK_LOG_TYPE
    target_source = settings.TRANSPARENT_LOCK_SOURCE

    try:
        hand = win32evtlog.OpenEventLog(server, log_type)
        logger.info(f"🔒 Listening for Transparent Screen Lock events from: {target_source}")

        while True:
            events = win32evtlog.ReadEventLog(
                hand,
                win32evtlog.EVENTLOG_FORWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ,
                0
            )

            if events:
                for event in events:
                    if event.SourceName == target_source:
                        description = win32evtlogutil.SafeFormatMessage(event, log_type)
                        event_details = {
                            'EventID': event.EventID,
                            'Description': description,
                            'SourceName': event.SourceName,
                            'TimeGenerated': str(event.TimeGenerated),
                            'EventType': event.EventType,
                            'User': str(event.Sid) if event.Sid else None,
                            'RawEventData': event.StringInserts
                        }

                        # Update current user
                        transparent_lock_current_user = event_details
                        transparent_lock_events.append(event_details)

                        logger.info(f"🔒 Transparent Lock Event: {description[:100]}")
            else:
                time.sleep(1)

    except Exception as e:
        logger.error(f"Event log listener error: {e}")
    finally:
        if 'hand' in locals():
            win32evtlog.CloseEventLog(hand)

# ============================================================================
# SECURITY HEADERS MIDDLEWARE
# ============================================================================

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# ============================================================================
# ROUTES - HEALTH & DISCOVERY
# ============================================================================

@app.get("/health")
async def health():
    try:
        redis_client.ping()
        return {
            "status": "healthy",
            "redis": "connected",
            "wsso": "enabled",
            "transparent_lock": WINDOWS_EVENT_LOG_AVAILABLE and settings.TRANSPARENT_LOCK_ENABLED
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "redis": "disconnected",
                "error": str(e)
            }
        )

@app.get("/auth/discovery")
@limiter.limit("10/minute")
async def auth_discovery(request: Request):
    try:
        ssl_verify = settings.SSL_VERIFY
        if settings.SSL_CERT_PATH:
            ssl_verify = settings.SSL_CERT_PATH
        response = requests.get(
            f"{settings.OIDC_BASE}/.well-known/openid-configuration",
            timeout=10,
            verify=ssl_verify
        )
        response.raise_for_status()
        return JSONResponse(response.json())
    except Exception as e:
        logger.error(f"Discovery failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch discovery")

@app.get("/auth/jwks")
@limiter.limit("10/minute")
async def auth_jwks(request: Request):
    try:
        ssl_verify = settings.SSL_VERIFY
        if settings.SSL_CERT_PATH:
            ssl_verify = settings.SSL_CERT_PATH
        response = requests.get(
            f"{settings.OIDC_BASE}/protocol/openid-connect/certs",
            timeout=10,
            verify=ssl_verify
        )
        response.raise_for_status()
        return JSONResponse(response.json())
    except Exception as e:
        logger.error(f"JWKS failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch JWKS")

# ============================================================================
# ROUTES - UNIFIED AUTHENTICATION (WSSO + Transparent Lock)
# ============================================================================

@app.get("/auth/authorize")
@limiter.limit("5/minute")
async def authorize(request: Request):
    """
    Unified authorization endpoint:
    - Localhost: Use Transparent Screen Lock (if available)
    - Remote: Use WSSO/OIDC
    """
    frontend_url = request.query_params.get("redirect_uri") or settings.FRONTEND_URL

    # Check if request is from localhost
    if is_localhost_request(frontend_url) and WINDOWS_EVENT_LOG_AVAILABLE and settings.TRANSPARENT_LOCK_ENABLED:
        logger.info("🔒 Localhost detected - Using Transparent Screen Lock authentication")

        # Check if we have a current user from event log
        if transparent_lock_current_user:
            # Create session for transparent lock user
            session_id = generate_session_id()
            session_data = {
                "user_info": {
                    "sub": transparent_lock_current_user.get('User', 'local-user'),
                    "name": transparent_lock_current_user.get('Description', 'Local User'),
                    "email": None,
                    "auth_method": "transparent_lock"
                },
                "auth_method": "transparent_lock",
                "created_at": datetime.utcnow().isoformat(),
            }
            store_session(session_id, session_data)

            # Redirect back to frontend with session
            redirect_url = f"{frontend_url}?authorized=true&method=transparent_lock"
            response = RedirectResponse(url=redirect_url, status_code=302)
            response.set_cookie(
                key="session_id",
                value=session_id,
                httponly=True,
                secure=IS_PRODUCTION,
                samesite="lax",
                path="/",
                max_age=settings.SESSION_TIMEOUT_HOURS * 3600
            )
            return response
        else:
            # No transparent lock user available yet
            return JSONResponse(
                status_code=401,
                content={
                    "error": "No Transparent Screen Lock session available",
                    "hint": "Please unlock your screen using Transparent Screen Lock application"
                }
            )

    # Otherwise, use WSSO/OIDC flow
    logger.info("🌐 Remote access detected - Using WSSO/OIDC authentication")

    try:
        code_verifier = generate_code_verifier()
        code_challenge = generate_code_challenge(code_verifier)
        state = base64.urlsafe_b64encode(secrets.token_bytes(16)).decode('utf-8').rstrip('=')

        store_pkce_data(state, {
            "code_verifier": code_verifier,
            "created_at": datetime.utcnow().timestamp()
        })

        auth_params = {
            'client_id': settings.SSO_ID,
            'response_type': 'code',
            'scope': 'openid profile email',
            'redirect_uri': settings.CALLBACK_URL,
            'state': state,
            'code_challenge': code_challenge,
            'code_challenge_method': 'S256'
        }

        auth_url = f"{settings.OIDC_BASE}/protocol/openid-connect/auth?{urlencode(auth_params)}"
        return RedirectResponse(url=auth_url, status_code=302)

    except Exception as e:
        logger.error(f"Authorize failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate sign-in")

@app.get("/callback")
@limiter.limit("10/minute")
async def callback(request: Request):
    """Handle OIDC callback (WSSO only)"""
    code = request.query_params.get("code")
    state = request.query_params.get("state")

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    pkce_data = get_pkce_data(state)
    if not pkce_data:
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    try:
        code_verifier = pkce_data["code_verifier"]

        ssl_verify = settings.SSL_VERIFY
        if settings.SSL_CERT_PATH:
            ssl_verify = settings.SSL_CERT_PATH

        token_data = {
            'grant_type': 'authorization_code',
            'code': code,
            'client_id': settings.SSO_ID,
            'client_secret': settings.SSO_SECRET,
            'redirect_uri': settings.CALLBACK_URL,
            'code_verifier': code_verifier
        }

        token_response = requests.post(
            f"{settings.OIDC_BASE}/protocol/openid-connect/token",
            data=token_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=10,
            verify=ssl_verify
        )

        if token_response.status_code != 200:
            logger.error(f"Token exchange failed: {token_response.text}")
            raise HTTPException(status_code=400, detail="Token exchange failed")

        token_json = token_response.json()
        id_token = token_json.get("id_token")
        access_token = token_json.get("access_token")
        refresh_token = token_json.get("refresh_token")

        id_token_claims = verify_id_token(id_token)

        userinfo_response = requests.get(
            f"{settings.OIDC_BASE}/protocol/openid-connect/userinfo",
            headers={'Authorization': f"Bearer {access_token}"},
            timeout=10,
            verify=ssl_verify
        )

        if userinfo_response.status_code == 200:
            user_info = userinfo_response.json()
        else:
            user_info = {
                "sub": id_token_claims.get("sub"),
                "name": id_token_claims.get("name"),
                "email": id_token_claims.get("email"),
                "given_name": id_token_claims.get("given_name"),
                "family_name": id_token_claims.get("family_name"),
                "preferred_username": id_token_claims.get("preferred_username"),
            }

        user_info["auth_method"] = "wsso"

        session_id = generate_session_id()
        session_data = {
            "user_info": user_info,
            "access_token": access_token,
            "id_token": id_token,
            "refresh_token": refresh_token,
            "auth_method": "wsso",
            "created_at": datetime.utcnow().isoformat(),
        }
        store_session(session_id, session_data)

        logger.info(f"✅ WSSO session created for: {user_info.get('sub')}")

        redirect_url = f"{settings.FRONTEND_URL}?authorized=true&method=wsso"
        response = RedirectResponse(url=redirect_url, status_code=302)
        response.set_cookie(
            key="session_id",
            value=session_id,
            httponly=True,
            secure=IS_PRODUCTION,
            samesite="lax",
            path="/",
            max_age=settings.SESSION_TIMEOUT_HOURS * 3600
        )
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Callback error: {str(e)}")
        raise HTTPException(status_code=500, detail="Authentication failed")

# ============================================================================
# ROUTES - SESSION MANAGEMENT
# ============================================================================

@app.get("/auth/userinfo")
@limiter.limit("30/minute")
async def auth_userinfo(request: Request, current_user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "id": current_user.get("sub"),
        "name": current_user.get("name"),
        "email": current_user.get("email"),
        "givenName": current_user.get("given_name"),
        "familyName": current_user.get("family_name"),
        "username": current_user.get("preferred_username"),
        "authMethod": current_user.get("auth_method"),
        "profile": current_user,
    }

@app.get("/auth/session")
@limiter.limit("30/minute")
async def auth_session(request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return {"user": None}

    session_data = get_session(session_id)
    if not session_data:
        return {"user": None}

    user_info = session_data.get("user_info", {})
    return {
        "user": {
            "id": user_info.get("sub"),
            "name": user_info.get("name", "Unknown User"),
            "email": user_info.get("email"),
            "givenName": user_info.get("given_name"),
            "familyName": user_info.get("family_name"),
            "username": user_info.get("preferred_username"),
            "authMethod": user_info.get("auth_method"),
        },
        "authMethod": session_data.get("auth_method")
    }

@app.post("/auth/refresh")
@limiter.limit("10/minute")
async def auth_refresh(request: Request):
    """Refresh access token (WSSO only)"""
    session_id = request.cookies.get("session_id")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_data = get_session(session_id)
    if not session_data:
        raise HTTPException(status_code=401, detail="Session expired")

    if session_data.get("auth_method") == "transparent_lock":
        return {"success": True, "message": "Transparent lock session does not require refresh"}

    refresh_token = session_data.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=400, detail="No refresh token available")

    try:
        ssl_verify = settings.SSL_VERIFY
        if settings.SSL_CERT_PATH:
            ssl_verify = settings.SSL_CERT_PATH

        token_data = {
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'client_id': settings.SSO_ID,
            'client_secret': settings.SSO_SECRET,
        }

        token_response = requests.post(
            f"{settings.OIDC_BASE}/protocol/openid-connect/token",
            data=token_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=10,
            verify=ssl_verify
        )

        if token_response.status_code != 200:
            delete_session(session_id)
            raise HTTPException(status_code=401, detail="Token refresh failed")

        token_json = token_response.json()
        session_data["access_token"] = token_json.get("access_token")
        session_data["id_token"] = token_json.get("id_token")
        if token_json.get("refresh_token"):
            session_data["refresh_token"] = token_json.get("refresh_token")

        store_session(session_id, session_data)
        return {"success": True, "message": "Token refreshed"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Refresh error: {str(e)}")
        raise HTTPException(status_code=500, detail="Token refresh failed")

@app.post("/auth/signout")
async def auth_signout(request: Request):
    session_id = request.cookies.get("session_id")
    if session_id:
        delete_session(session_id)

    response = JSONResponse(content={"success": True})
    response.delete_cookie("session_id", path="/")
    return response

@app.get("/auth/logout")
async def auth_logout(request: Request):
    """Full logout"""
    session_id = request.cookies.get("session_id")
    session_data = None

    if session_id:
        session_data = get_session(session_id)
        delete_session(session_id)

    response = RedirectResponse(url=settings.FRONTEND_URL, status_code=302)
    response.delete_cookie("session_id", path="/")

    # If WSSO session, redirect to OIDC logout
    if session_data and session_data.get("auth_method") == "wsso":
        logout_params = {'post_logout_redirect_uri': settings.FRONTEND_URL}
        if session_data.get("id_token"):
            logout_params['id_token_hint'] = session_data.get("id_token")
        logout_url = f"{settings.OIDC_BASE}/protocol/openid-connect/logout?{urlencode(logout_params)}"
        response = RedirectResponse(url=logout_url, status_code=302)
        response.delete_cookie("session_id", path="/")

    return response

# ============================================================================
# ROUTES - TRANSPARENT LOCK SPECIFIC
# ============================================================================

@app.get("/transparent/current-user")
@limiter.limit("30/minute")
async def get_transparent_current_user(request: Request):
    """Get current Transparent Screen Lock user"""
    if not WINDOWS_EVENT_LOG_AVAILABLE:
        raise HTTPException(status_code=503, detail="Transparent Lock not available")

    return JSONResponse(transparent_lock_current_user or {})

@app.get("/transparent/events")
@limiter.limit("30/minute")
async def get_transparent_events(request: Request):
    """Get all Transparent Screen Lock events"""
    if not WINDOWS_EVENT_LOG_AVAILABLE:
        raise HTTPException(status_code=503, detail="Transparent Lock not available")

    return JSONResponse(transparent_lock_events)

# ============================================================================
# STARTUP
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Start background threads on startup"""
    if WINDOWS_EVENT_LOG_AVAILABLE and settings.TRANSPARENT_LOCK_ENABLED:
        listener_thread = threading.Thread(target=listen_event_logs, daemon=True)
        listener_thread.start()
        logger.info("🔒 Transparent Screen Lock listener started")
    else:
        logger.info("🔒 Transparent Screen Lock disabled or not available")

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=settings.PORT,
        ssl_keyfile="./key.pem" if IS_PRODUCTION else None,
        ssl_certfile="./cert.pem" if IS_PRODUCTION else None
    )
