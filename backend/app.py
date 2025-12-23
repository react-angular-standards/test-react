import base64
import getpass
import hashlib
import logging
import os
import re
import secrets
import sys
import threading
import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from urllib.parse import urlencode, urlparse

import requests
import uvicorn
from authlib.jose import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from graph_db_config import get_graphdb
from starlette.middleware.sessions import SessionMiddleware

# Import user management
from user_manager import UserRole, get_user_manager

# Platform-specific imports for Windows Event Log
if sys.platform == "win32":
    try:
        import win32evtlog
        import win32evtlogutil

        WINDOWS_EVENT_LOG_AVAILABLE = True
    except ImportError:
        WINDOWS_EVENT_LOG_AVAILABLE = False
        logging.warning("win32evtlog not available. Transparent Screen Lock disabled.")
else:
    WINDOWS_EVENT_LOG_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

load_dotenv()

# Load environment variables
SSO_ID = os.getenv("SSO_ID")
SSO_SECRET = os.getenv("SSO_SECRET")
OIDC_BASE = os.getenv("OIDC_BASE")
OIDC_ISSUER = os.getenv("OIDC_ISSUER")
CALLBACK_URL = os.getenv("CALLBACK_URL")
FRONTEND_URL = os.getenv(
    "FRONTEND_URL", "http://localhost:3000"
)  # Optional with default
SESSION_SECRET = os.getenv("SESSION_SECRET")
AUTH_SECRET = os.getenv("AUTH_SECRET")
PORT = int(os.getenv("PORT", 5002))
IS_PRODUCTION = os.getenv("NODE_ENV") == "production"

# Session timeout configuration (in hours)
SESSION_TIMEOUT_HOURS = int(
    os.getenv("SESSION_TIMEOUT_HOURS", 24)
)  # Default 24 hours (1 day)

# Transparent Screen Lock settings
TRANSPARENT_LOCK_ENABLED = (
    os.getenv("TRANSPARENT_LOCK_ENABLED", "true").lower() == "true"
)
TRANSPARENT_LOCK_SOURCE = os.getenv(
    "TRANSPARENT_LOCK_SOURCE", "Transparent Screen Lock"
)
TRANSPARENT_LOCK_LOG_TYPE = os.getenv("TRANSPARENT_LOCK_LOG_TYPE", "Application")

# Validate environment variables (FRONTEND_URL is now optional)
required_env_vars = [
    "SSO_ID",
    "SSO_SECRET",
    "OIDC_BASE",
    "OIDC_ISSUER",
    "CALLBACK_URL",
    "SESSION_SECRET",
    "AUTH_SECRET",
    "NEO4J_URI",
    "NEO4J_USERNAME",
    "NEO4J_PASSWORD",
]
missing_env_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_env_vars:
    logger.error(f"Missing environment variables: {', '.join(missing_env_vars)}")
    raise ValueError(f"Missing environment variables: {', '.join(missing_env_vars)}")

app = FastAPI(
    title="WSSO Proxy Backend with User Management",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Add SessionMiddleware
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, same_site="lax")

# Add CORS middleware - Automatically allow common localhost and detect domains
allowed_origins = []

# Always allow common localhost variations for development
if not IS_PRODUCTION:
    allowed_origins.extend(
        [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
        ]
    )
    logger.info(f"Development mode: Allowing localhost CORS origins")

# Add FRONTEND_URL if specified and not already in list
if FRONTEND_URL and FRONTEND_URL not in allowed_origins:
    allowed_origins.append(FRONTEND_URL)
    # Also add wildcard for same domain different ports
    parsed = urlparse(FRONTEND_URL)
    if parsed.hostname and parsed.hostname not in ["localhost", "127.0.0.1"]:
        # Add origin pattern for same host different ports
        origin_pattern = f"{parsed.scheme}://{parsed.hostname}"
        if origin_pattern not in allowed_origins:
            allowed_origins.append(origin_pattern)

# Allow all origins in development if using hostnames (more permissive for internal networks)
cors_config = {
    "allow_credentials": True,
    "allow_methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization", "Cookie"],
    "expose_headers": ["Set-Cookie"],
}

if not IS_PRODUCTION:
    # In development, be more permissive with CORS
    cors_config["allow_origin_regex"] = r"http://.*"  # Allow any HTTP origin in dev
else:
    cors_config["allow_origins"] = allowed_origins

app.add_middleware(CORSMiddleware, **cors_config)

# In-memory PKCE store
pkce_store = {}

# Transparent Screen Lock events
transparent_lock_current_user = {}
transparent_lock_events = []

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def generate_code_verifier():
    """Generate PKCE code verifier"""
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("utf-8").rstrip("=")


def generate_code_challenge(verifier: str) -> str:
    """Generate PKCE code challenge"""
    hashed = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(hashed).decode("utf-8").rstrip("=")


def get_windows_full_name():
    """
    Get the full name of the current Windows user from Active Directory.
    Returns tuple: (full_name, username, email)
    """
    try:
        import ctypes
        from ctypes import byref, create_unicode_buffer, windll, wintypes

        # Get current username
        username = getpass.getuser()

        # Try to get full name from Windows API
        try:
            # GetUserNameEx with NameDisplay format (3) returns full name
            GetUserNameEx = windll.secur32.GetUserNameExW
            NameDisplay = 3  # Display name format

            size = wintypes.DWORD(0)
            GetUserNameEx(NameDisplay, None, byref(size))

            if size.value > 0:
                name_buffer = create_unicode_buffer(size.value)
                if GetUserNameEx(NameDisplay, name_buffer, byref(size)):
                    full_name = name_buffer.value
                    logger.info(f"✅ Windows full name retrieved: {full_name}")

                    # Parse full name
                    name_parts = full_name.split()
                    if len(name_parts) >= 2:
                        given_name = name_parts[0]
                        family_name = " ".join(name_parts[1:])
                    else:
                        given_name = full_name
                        family_name = ""

                    email = f"{username}@local"
                    return (full_name, given_name, family_name, username, email)
        except Exception as e:
            logger.warning(f"GetUserNameEx failed: {e}")

        # Fallback: Try to get from environment variables
        full_name = os.environ.get("USERNAME", username)

        # Last resort: format username nicely
        if "." in username:
            parts = username.split(".")
            given_name = parts[0].capitalize()
            family_name = parts[1].capitalize() if len(parts) > 1 else ""
            full_name = f"{given_name} {family_name}".strip()
        else:
            given_name = username.capitalize()
            family_name = ""
            full_name = given_name

        email = f"{username}@local"
        return (full_name, given_name, family_name, username, email)

    except Exception as e:
        logger.error(f"Failed to get Windows user info: {e}")
        username = "local-user"
        return ("Local User", "Local", "User", username, f"{username}@local")


def is_ip_address(hostname: str) -> bool:
    """Check if hostname is an IP address"""
    # IPv4 pattern
    ipv4_pattern = r"^(\d{1,3}\.){3}\d{1,3}$"
    # IPv6 pattern (simplified)
    ipv6_pattern = r"^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$"

    return bool(re.match(ipv4_pattern, hostname) or re.match(ipv6_pattern, hostname))


def is_machine_hostname(hostname: str) -> bool:
    """
    Detect if hostname is a laptop/machine ID rather than a shared server.

    Machine hostname patterns:
    - a6374718.nos.boeing.com (laptop ID)
    - pc1234.corp.company.com (desktop ID)
    - ws5678.internal.net (workstation ID)

    Shared server patterns:
    - api.boeing.com (service name)
    - server.company.com (server name)
    - production.example.com (environment name)
    """
    parts = hostname.split(".")
    if len(parts) < 2:
        return False

    first_part = parts[0].lower()

    # Machine ID characteristics:
    # 1. Relatively short (≤ 10 chars typically)
    # 2. Contains BOTH letters AND numbers (alphanumeric)
    # 3. Often starts with letter(s) followed by numbers

    if len(first_part) > 10:
        return False

    has_letter = any(c.isalpha() for c in first_part)
    has_digit = any(c.isdigit() for c in first_part)

    # If it has both letters and numbers, likely a machine ID
    if has_letter and has_digit:
        return True

    return False


def get_cookie_domain(frontend_url: str) -> Optional[str]:
    """
    Get appropriate cookie domain based on frontend URL.

    Returns None for:
    - localhost (standard localhost)
    - IP addresses (192.168.1.100, 127.0.0.1)
    - Laptop/machine hostnames (a6374718.nos.boeing.com)

    Returns domain for:
    - Shared servers (api.boeing.com → .boeing.com)
    - Production domains (app.company.com → .company.com)
    """
    parsed = urlparse(frontend_url)
    hostname = parsed.hostname or parsed.netloc.split(":")[0]

    # For standard localhost, don't set domain
    if hostname in ["localhost", "127.0.0.1", "::1"]:
        logger.info(f"Standard localhost detected: {hostname}")
        return None

    # For IP addresses, don't set domain
    if is_ip_address(hostname):
        logger.info(f"IP address detected: {hostname} - no domain")
        return None

    # For laptop/machine hostnames, treat as localhost
    if is_machine_hostname(hostname):
        logger.info(
            f"Laptop/machine hostname detected: {hostname} - treating as localhost (no domain)"
        )
        return None

    # For actual shared servers/domains, extract base domain
    parts = hostname.split(".")
    if len(parts) >= 2:
        base_domain = "." + ".".join(parts[-2:])
        logger.info(
            f"Shared server/domain detected: {hostname} → cookie domain: {base_domain}"
        )
        return base_domain

    return None


def create_session_token(
    access_token: Optional[str], id_token: Optional[str], user_info: Dict[str, Any]
) -> str:
    """Create signed JWT session token with configurable timeout"""
    now = datetime.utcnow()
    payload = {
        "accessToken": access_token,
        "idToken": id_token,
        "userInfo": user_info,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=SESSION_TIMEOUT_HOURS)).timestamp()),
    }
    header = {"alg": "HS256"}
    token = jwt.encode(header, payload, AUTH_SECRET).decode("utf-8")
    logger.info(
        f"🔑 Session token created with {SESSION_TIMEOUT_HOURS} hour(s) timeout"
    )
    return token


def set_auth_cookie(response, token: str, frontend_url: Optional[str] = None):
    """
    Set authentication cookie with environment and domain-appropriate settings.

    Modern Browser Rules:
    - SameSite=None REQUIRES Secure=True (HTTPS only)
    - For HTTP, must use SameSite=Lax

    Cookie Strategies:

    1. Localhost / Machine hostname (e.g., a6374718.nos.boeing.com):
       - domain=None (browser handles as exact hostname)
       - secure=False (HTTP allowed)
       - samesite="lax" (works for same-host different ports)
       Result: Cookies work across :3000 and :5002 on same machine

    2. Shared server HTTP (internal network):
       - domain=.company.com (cross-subdomain)
       - secure=False (HTTP allowed)
       - samesite="lax" (same-site requests)
       Result: Cookies work across subdomains on HTTP

    3. Production HTTPS:
       - domain=.company.com (cross-subdomain)
       - secure=True (HTTPS required)
       - samesite="none" (allows cross-origin)
       Result: Full cross-origin support with security
    """
    cookie_params = {
        "key": "auth_session",
        "value": token,
        "httponly": True,
        "path": "/",
        "max_age": SESSION_TIMEOUT_HOURS * 3600,  # Convert hours to seconds
    }

    # Determine cookie domain
    cookie_domain = None
    if frontend_url:
        cookie_domain = get_cookie_domain(frontend_url)

    # Set security parameters based on environment
    if IS_PRODUCTION:
        # Production: HTTPS with SameSite=None for cross-origin
        cookie_params.update(
            {
                "secure": True,
                "samesite": "none",  # Requires Secure=True
            }
        )
    else:
        # Development/Internal HTTP: Must use SameSite=Lax
        # (Modern browsers reject SameSite=None without Secure=True)
        cookie_params.update(
            {
                "secure": False,
                "samesite": "lax",  # Works with HTTP
            }
        )

    # Set domain if extracted (for cross-subdomain cookies)
    if cookie_domain:
        cookie_params["domain"] = cookie_domain

    logger.info(
        f"🍪 Setting cookie: secure={cookie_params['secure']}, samesite={cookie_params['samesite']}, domain={cookie_params.get('domain', 'auto')}, max_age={cookie_params['max_age']}s ({SESSION_TIMEOUT_HOURS}h)"
    )
    response.set_cookie(**cookie_params)


async def get_current_user(request: Request) -> Dict[str, Any]:
    """Dependency to get current authenticated user"""
    token = request.cookies.get("auth_session")

    if not token:
        logger.warning("No auth_session cookie found")
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, AUTH_SECRET)
        payload.validate()
        user_info = payload.get("userInfo", {})

        if not user_info:
            logger.warning("No user info in session token")
            raise HTTPException(status_code=401, detail="No user info in session")

        return user_info
    except Exception as e:
        logger.error(f"Invalid session token: {e}")
        raise HTTPException(status_code=401, detail="Invalid session")


async def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Dependency to require admin role - extracts role from session token"""
    user_role = current_user.get("role")

    if not user_role:
        logger.warning(
            f"No role found in session token for user: {current_user.get('sub')}"
        )
        raise HTTPException(status_code=401, detail="Invalid user session")

    if user_role != UserRole.ADMIN:
        logger.warning(
            f"Access denied: User {current_user.get('sub')} has role '{user_role}', requires '{UserRole.ADMIN}'"
        )
        raise HTTPException(status_code=403, detail="Admin access required")

    return current_user


# ============================================================================
# TRANSPARENT SCREEN LOCK
# ============================================================================


def listen_event_logs():
    """Background thread to monitor Windows Event Log"""
    global transparent_lock_current_user, transparent_lock_events

    if not WINDOWS_EVENT_LOG_AVAILABLE or not TRANSPARENT_LOCK_ENABLED:
        return

    server = "localhost"
    log_type = TRANSPARENT_LOCK_LOG_TYPE
    target_source = TRANSPARENT_LOCK_SOURCE

    try:
        hand = win32evtlog.OpenEventLog(server, log_type)
        logger.info(f"🔒 Listening for events from: {target_source}")

        while True:
            events = win32evtlog.ReadEventLog(
                hand,
                win32evtlog.EVENTLOG_FORWARDS_READ
                | win32evtlog.EVENTLOG_SEQUENTIAL_READ,
                0,
            )

            if events:
                for event in events:
                    if event.SourceName == target_source:
                        description = win32evtlogutil.SafeFormatMessage(event, log_type)

                        # Enhanced user info extraction from TSL event
                        user_email = None
                        user_name = None

                        # Method 1: Extract from Description field
                        if description:
                            # Try multiple patterns for user email/name
                            patterns = [
                                r"User Name:\s*(\S+@\S+)",  # Email with domain
                                r"User Name:\s*(\S+)",  # Username without domain
                                r"User:\s*(\S+@\S+)",  # Alternate format
                                r"User:\s*(\S+)",
                                r"Email:\s*(\S+@\S+)",
                            ]

                            for pattern in patterns:
                                match = re.search(pattern, description, re.IGNORECASE)
                                if match:
                                    user_email = match.group(1).strip()
                                    break

                        # Method 2: Check StringInserts (raw event data)
                        if not user_email and event.StringInserts:
                            for insert in event.StringInserts:
                                if insert and "@" in insert:
                                    user_email = insert.strip()
                                    break
                                elif insert and len(insert) > 2 and not user_name:
                                    # Potential username without @
                                    user_name = insert.strip()

                        # Method 3: Try to resolve SID to username (Windows only)
                        if not user_email and not user_name and event.Sid:
                            try:
                                import win32security

                                sid_string = str(event.Sid)
                                # Try to lookup account from SID
                                account, domain, _ = win32security.LookupAccountSid(
                                    None, event.Sid
                                )
                                if account and account != "SYSTEM":
                                    user_name = account
                                    logger.info(
                                        f"Resolved SID to username: {account} (Domain: {domain})"
                                    )
                            except Exception as sid_error:
                                logger.debug(f"Could not resolve SID: {sid_error}")

                        event_details = {
                            "EventID": event.EventID,
                            "Description": description,
                            "SourceName": event.SourceName,
                            "TimeGenerated": str(event.TimeGenerated),
                            "EventType": event.EventType,
                            "User": str(event.Sid) if event.Sid else None,
                            "user_email": user_email,
                            "user_name": user_name,
                            "RawEventData": event.StringInserts,
                        }

                        transparent_lock_current_user = event_details
                        transparent_lock_events.append(event_details)

                        if len(transparent_lock_events) > 100:
                            transparent_lock_events = transparent_lock_events[-100:]

                        logger.info(
                            f"🔒 Event: {description[:100] if description else 'N/A'}"
                        )
                        if user_email:
                            logger.info(f"    User: {user_email}")
            else:
                time.sleep(1)

    except Exception as e:
        logger.error(f"Event log listener error: {e}")
    finally:
        if "hand" in locals():
            win32evtlog.CloseEventLog(hand)


# ============================================================================
# AUTHENTICATION ROUTES
# ============================================================================


@app.get("/auth/discovery")
async def auth_discovery():
    """OIDC discovery endpoint"""
    try:
        response = requests.get(
            f"{OIDC_BASE}/.well-known/openid-configuration",
            verify=IS_PRODUCTION,
            timeout=10,
        )
        response.raise_for_status()
        metadata = response.json()
        metadata.update(
            {
                "authorization_endpoint": f"{FRONTEND_URL}/auth/authorize",
                "token_endpoint": f"http://localhost:{PORT}/auth/token",
                "userinfo_endpoint": f"http://localhost:{PORT}/auth/userinfo",
                "jwks_uri": f"http://localhost:{PORT}/auth/jwks",
            }
        )
        return JSONResponse(metadata)
    except Exception as e:
        logger.error(f"Discovery failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch discovery")


@app.get("/auth/jwks")
async def auth_jwks():
    """JWKS endpoint"""
    try:
        response = requests.get(
            f"{OIDC_BASE}/token_keys", verify=IS_PRODUCTION, timeout=10
        )
        response.raise_for_status()
        return JSONResponse(response.json())
    except Exception as e:
        logger.error(f"JWKS failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch JWKS")


@app.get("/auth/authorize")
async def authorize(request: Request):
    """Unified authorization endpoint - Auto-detects frontend URL from Referer"""

    # Auto-detect frontend URL from headers
    frontend_url = request.headers.get("referer") or request.headers.get("origin")

    # Fallback to query parameter if provided
    if not frontend_url:
        frontend_url = request.query_params.get("redirect_uri")

    # Final fallback to environment variable
    if not frontend_url:
        frontend_url = FRONTEND_URL

    # Remove trailing slash
    frontend_url = frontend_url.rstrip("/")

    # Generate state for PKCE
    state = (
        base64.urlsafe_b64encode(secrets.token_bytes(16)).decode("utf-8").rstrip("=")
    )

    logger.info(f"🔐 Authorization request detected")
    logger.info(f"   Referer: {request.headers.get('referer', 'None')}")
    logger.info(f"   Origin: {request.headers.get('origin', 'None')}")
    logger.info(f"   Detected frontend URL: {frontend_url}")

    # Extract hostname for TSL check
    parsed = urlparse(frontend_url)
    hostname = parsed.hostname or parsed.netloc.split(":")[0]

    # ✅ PRIORITY: Check for Transparent Screen Lock FIRST for localhost
    # Only check TSL for actual localhost, NOT for laptop hostnames
    if (
        (hostname in ["localhost", "127.0.0.1", "::1"])
        and WINDOWS_EVENT_LOG_AVAILABLE
        and TRANSPARENT_LOCK_ENABLED
    ):
        logger.info("🔒 Standard localhost detected - Checking Transparent Screen Lock")

        if transparent_lock_current_user:
            # Enhanced: Get user info from TSL event (now with better extraction)
            user_email = transparent_lock_current_user.get("user_email")
            user_name = transparent_lock_current_user.get("user_name")

            # If we have email, use it
            if user_email:
                logger.info(f"✅ TSL provided email: {user_email}")
            # If we have username but no email, construct email
            elif user_name:
                user_email = f"{user_name}@local"
                logger.info(f"✅ TSL provided username: {user_name} → {user_email}")
            # Fallback: try to get Windows username
            else:
                try:
                    windows_user = getpass.getuser()
                    user_email = f"{windows_user}@local"
                    user_name = windows_user
                    logger.info(
                        f"⚠️ TSL did not provide user info, using Windows username: {windows_user}"
                    )
                except:
                    user_email = "local-user@local"
                    user_name = "local-user"
                    logger.warning(
                        "❌ Could not detect any user information, using default"
                    )

            # Extract display name from email
            display_user_name = (
                user_email.split("@")[0] if "@" in user_email else user_email
            )

            # Use email as user_id for consistency across logins
            user_id = user_email

            # Parse name into first and last
            name_parts = display_user_name.split(".")
            given_name = name_parts[0] if len(name_parts) > 0 else display_user_name
            family_name = name_parts[1] if len(name_parts) > 1 else ""

            # Capitalize names properly
            given_name = given_name.capitalize()
            family_name = family_name.capitalize()
            display_name = (
                f"{given_name} {family_name}".strip() if family_name else given_name
            )

            user_info = {
                "sub": user_id,
                "name": display_name,
                "email": user_email,
                "given_name": given_name,
                "family_name": family_name,
                "auth_method": "transparent_lock",
                "authenticated_at": transparent_lock_current_user.get(
                    "TimeGenerated", str(datetime.utcnow())
                ),
            }

            # Save user to Neo4j and get role
            user_mgr = get_user_manager()
            user_mgr.save_user(user_info)

            # Get updated user with role
            saved_user = user_mgr.get_user(user_id)
            if saved_user:
                user_info["role"] = saved_user.get("role", UserRole.NON_ADMIN)

            # Create session token
            session_token = create_session_token(None, None, user_info)

            # Redirect with cookie
            response = RedirectResponse(url=frontend_url, status_code=302)
            set_auth_cookie(response, session_token, frontend_url)

            logger.info(
                f"✅ TSL authentication successful for {display_name} ({user_email})"
            )
            logger.info(f"✅ Redirecting to: {frontend_url}")
            return response
        else:
            logger.warning("⚠️ No TSL session available - falling back to WSSO")

    # WSSO/OIDC flow
    logger.info("🌐 Using WSSO/OIDC authentication")

    try:
        code_verifier = generate_code_verifier()
        code_challenge = generate_code_challenge(code_verifier)

        # Store both code_verifier AND frontend_url for callback
        pkce_store[state] = {
            "code_verifier": code_verifier,
            "frontend_url": frontend_url,
            "created_at": datetime.utcnow().timestamp(),
        }

        auth_params = {
            "client_id": SSO_ID,
            "response_type": "code",
            "scope": "openid profile email",
            "redirect_uri": CALLBACK_URL,
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }

        auth_url = f"{OIDC_BASE}/oauth/authorize?{urlencode(auth_params)}"
        logger.info(f"Redirecting to OIDC provider: {OIDC_BASE}")
        return RedirectResponse(url=auth_url, status_code=302)
    except Exception as e:
        logger.error(f"Authorize failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate sign-in")


@app.get("/callback")
async def callback(request: Request):
    """Handle OIDC callback - Redirect to original frontend URL"""
    code = request.query_params.get("code")
    state = request.query_params.get("state")

    logger.info(f"📞 Callback received - state: {state[:10]}...")

    stored = pkce_store.get(state)
    if not stored:
        logger.error("❌ Invalid or expired state")
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    # Retrieve the original frontend URL
    frontend_url = stored.get("frontend_url", FRONTEND_URL)
    logger.info(f"📍 Original frontend URL: {frontend_url}")

    try:
        code_verifier = stored["code_verifier"]

        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": SSO_ID,
            "client_secret": SSO_SECRET,
            "redirect_uri": CALLBACK_URL,
            "code_verifier": code_verifier,
        }

        logger.info("🔄 Exchanging code for tokens...")
        token_response = requests.post(
            f"{OIDC_BASE}/oauth/token",
            data=token_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            verify=IS_PRODUCTION,
            timeout=10,
        )

        if token_response.status_code != 200:
            logger.error(f"❌ Token exchange failed: {token_response.status_code}")
            logger.error(f"Response: {token_response.text}")
            raise HTTPException(status_code=400, detail="Token exchange failed")

        token_json = token_response.json()
        id_token = token_json.get("id_token")
        access_token = token_json.get("access_token")

        logger.info("✅ Tokens received, fetching user info...")

        # Fetch user info
        user_info = None
        try:
            userinfo_response = requests.get(
                f"{OIDC_BASE}/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                verify=IS_PRODUCTION,
                timeout=10,
            )
            if userinfo_response.status_code == 200:
                user_info = userinfo_response.json()
                logger.info(f"✅ User info retrieved: {user_info.get('email', 'N/A')}")
        except Exception as e:
            logger.warning(f"⚠️ Userinfo fetch failed, decoding ID token: {e}")
            try:
                from authlib.jose import jwt as jose_jwt

                claims = jose_jwt.decode(
                    id_token, AUTH_SECRET, claims_options={"verify_signature": False}
                )
                user_info = {
                    "sub": claims.get("sub"),
                    "name": claims.get("name"),
                    "email": claims.get("email"),
                    "given_name": claims.get("given_name"),
                    "family_name": claims.get("family_name"),
                    "bemsid": claims.get("bemsid"),
                }
            except Exception as id_error:
                logger.error(f"❌ ID token decode failed: {id_error}")
                user_info = {}

        if user_info:
            user_info["auth_method"] = "wsso"
            user_info["authenticated_at"] = datetime.utcnow().isoformat()

            # Save user to Neo4j and get role
            user_mgr = get_user_manager()
            user_mgr.save_user(user_info)

            # Get updated user with role
            saved_user = user_mgr.get_user(user_info.get("sub"))
            if saved_user:
                user_info["role"] = saved_user.get("role", UserRole.NON_ADMIN)

        # Create session token
        session_token = create_session_token(access_token, id_token, user_info or {})

        # Redirect with cookie
        response = RedirectResponse(url=frontend_url, status_code=302)
        set_auth_cookie(response, session_token, frontend_url)

        logger.info(
            f"✅ WSSO authentication successful for {user_info.get('name', 'unknown')}"
        )
        logger.info(f"✅ Redirecting to: {frontend_url}")
        return response

    except Exception as e:
        logger.error(f"❌ Callback error: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Token exchange failed")
    finally:
        if state in pkce_store:
            del pkce_store[state]


@app.get("/auth/userinfo")
async def auth_userinfo(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get current user info with role from session token"""
    return {
        "id": current_user.get("sub"),
        "name": current_user.get("name"),
        "email": current_user.get("email"),
        "givenName": current_user.get("given_name"),
        "familyName": current_user.get("family_name"),
        "bemsid": current_user.get("bemsid"),
        "authMethod": current_user.get("auth_method"),
        "authenticatedAt": current_user.get("authenticated_at"),
        "role": current_user.get("role", UserRole.NON_ADMIN),
        "profile": current_user,
    }


@app.get("/auth/session")
async def auth_session(request: Request):
    """Get current session info with role"""
    token = request.cookies.get("auth_session")

    # Enhanced logging for debugging
    client_host = request.client.host if request.client else "unknown"
    request_host = request.headers.get("host", "unknown")
    all_cookies = list(request.cookies.keys())

    logger.info(f"📋 Session check")
    logger.info(f"   Client: {client_host}")
    logger.info(f"   Host: {request_host}")
    logger.info(f"   Cookie present: {bool(token)}")
    logger.info(f"   All cookies: {all_cookies}")

    if not token:
        logger.info("⚠️ No auth_session cookie found")
        return JSONResponse({"authenticated": False, "user": None})

    try:
        payload = jwt.decode(token, AUTH_SECRET)
        payload.validate()
        user_info = payload.get("userInfo", {})

        logger.info(f"✅ Valid session token - User: {user_info.get('name', 'N/A')}")

        if not user_info or len(user_info) == 0:
            access_token = payload.get("accessToken")
            if access_token:
                try:
                    response = requests.get(
                        f"{OIDC_BASE}/userinfo",
                        headers={"Authorization": f"Bearer {access_token}"},
                        verify=IS_PRODUCTION,
                        timeout=10,
                    )
                    if response.status_code == 200:
                        user_info = response.json()
                        user_info["auth_method"] = "wsso"
                except Exception as e:
                    logger.warning(f"Userinfo fetch failed: {e}")

        if not user_info:
            logger.warning("⚠️ No user info in session")
            return JSONResponse({"authenticated": False, "user": None})

        # Role is already in session token, no DB query needed
        return JSONResponse(
            {
                "authenticated": True,
                "user": {
                    "id": user_info.get("sub"),
                    "name": user_info.get("name", "Unknown User"),
                    "email": user_info.get("email"),
                    "givenName": user_info.get("given_name"),
                    "familyName": user_info.get("family_name"),
                    "bemsid": user_info.get("bemsid"),
                    "authMethod": user_info.get("auth_method", "wsso"),
                    "authenticatedAt": user_info.get("authenticated_at"),
                    "role": user_info.get("role", UserRole.NON_ADMIN),
                },
                "accessToken": payload.get("accessToken"),
                "idToken": payload.get("idToken"),
            }
        )
    except Exception as e:
        logger.error(f"❌ Session validation failed: {e}")
        resp = JSONResponse(content={"authenticated": False, "user": None})
        resp.delete_cookie("auth_session", path="/")
        return resp


@app.post("/auth/signout")
async def auth_signout(request: Request):
    """Sign out and clear session"""
    logger.info("🚪 Sign out requested")
    resp = JSONResponse(content={"success": True, "message": "Signed out successfully"})

    # Get frontend URL to determine cookie domain
    frontend_url = request.headers.get("referer") or FRONTEND_URL
    cookie_domain = get_cookie_domain(frontend_url)

    # Clear cookie with same settings as when it was set
    delete_params = {"key": "auth_session", "path": "/"}

    if IS_PRODUCTION:
        delete_params.update({"secure": True, "samesite": "none"})
    else:
        delete_params.update({"secure": False, "samesite": "lax"})

    if cookie_domain:
        delete_params["domain"] = cookie_domain

    resp.delete_cookie(**delete_params)
    logger.info(f"🍪 Cleared cookie with domain={cookie_domain or 'auto'}")

    return resp


# ============================================================================
# USER MANAGEMENT ROUTES (Admin Only)
# ============================================================================


@app.get("/api/users")
async def get_all_users(admin_user: Dict[str, Any] = Depends(require_admin)):
    """Get all users (admin only)"""
    try:
        user_mgr = get_user_manager()
        users = user_mgr.get_all_users()
        return JSONResponse({"success": True, "users": users})
    except Exception as e:
        logger.error(f"Failed to get users: {e}")
        raise HTTPException(status_code=500, detail="Failed to get users")


@app.get("/api/users/{user_id}")
async def get_user_by_id(
    user_id: str, admin_user: Dict[str, Any] = Depends(require_admin)
):
    """Get specific user by ID (admin only)"""
    try:
        user_mgr = get_user_manager()
        user = user_mgr.get_user(user_id)

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return JSONResponse({"success": True, "user": user})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get user: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user")


@app.put("/api/users/{user_id}/role")
async def update_user_role(
    user_id: str, request: Request, admin_user: Dict[str, Any] = Depends(require_admin)
):
    """Update user role (admin only)"""
    try:
        body = await request.json()
        new_role = body.get("role")

        if not new_role:
            raise HTTPException(status_code=400, detail="Role is required")

        if not UserRole.is_valid(new_role):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role. Must be '{UserRole.ADMIN}' or '{UserRole.NON_ADMIN}'",
            )

        user_mgr = get_user_manager()

        # Prevent admin from demoting themselves if they're the last admin
        if user_id == admin_user.get("sub") and new_role == UserRole.NON_ADMIN:
            admins = user_mgr.get_users_by_role(UserRole.ADMIN)
            if len(admins) <= 1:
                raise HTTPException(
                    status_code=400, detail="Cannot remove last admin user"
                )

        success = user_mgr.update_user_role(user_id, new_role)

        if not success:
            raise HTTPException(status_code=400, detail="Failed to update user role")

        return JSONResponse(
            {
                "success": True,
                "message": f"User role updated to {new_role}",
                "user_id": user_id,
                "role": new_role,
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update user role: {e}")
        raise HTTPException(status_code=500, detail="Failed to update user role")


@app.delete("/api/users/{user_id}")
async def delete_user(
    user_id: str, admin_user: Dict[str, Any] = Depends(require_admin)
):
    """Delete user (admin only)"""
    try:
        # Prevent admin from deleting themselves
        if user_id == admin_user.get("sub"):
            raise HTTPException(
                status_code=400, detail="Cannot delete your own account"
            )

        user_mgr = get_user_manager()
        success = user_mgr.delete_user(user_id)

        if not success:
            raise HTTPException(status_code=400, detail="Failed to delete user")

        return JSONResponse(
            {
                "success": True,
                "message": "User deleted successfully",
                "user_id": user_id,
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete user: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete user")


@app.get("/api/users/role/{role}")
async def get_users_by_role(
    role: str, admin_user: Dict[str, Any] = Depends(require_admin)
):
    """Get users by role (admin only)"""
    try:
        if not UserRole.is_valid(role):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role. Must be '{UserRole.ADMIN}' or '{UserRole.NON_ADMIN}'",
            )

        user_mgr = get_user_manager()
        users = user_mgr.get_users_by_role(role)

        return JSONResponse(
            {"success": True, "role": role, "users": users, "count": len(users)}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get users by role: {e}")
        raise HTTPException(status_code=500, detail="Failed to get users by role")


# ============================================================================
# CURRENT USER ROUTES (Any authenticated user)
# ============================================================================


@app.get("/api/me")
async def get_current_user_info(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get current user information from session token"""
    return JSONResponse({"success": True, "user": current_user})


@app.get("/api/me/is-admin")
async def check_is_admin(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Check if current user is admin - extracts from session token"""
    user_role = current_user.get("role", UserRole.NON_ADMIN)
    is_admin = user_role == UserRole.ADMIN

    return JSONResponse(
        {
            "success": True,
            "isAdmin": is_admin,
            "role": user_role,
        }
    )


# ============================================================================
# TRANSPARENT LOCK ENDPOINTS
# ============================================================================


@app.get("/currentLoginUser")
async def get_current_login_user():
    """Get current TSL user"""
    if not WINDOWS_EVENT_LOG_AVAILABLE:
        return JSONResponse(content={"error": "TSL not available"}, status_code=503)
    return JSONResponse(transparent_lock_current_user or {})


@app.get("/events")
async def get_all_events():
    """Get all TSL events"""
    if not WINDOWS_EVENT_LOG_AVAILABLE:
        return JSONResponse(content={"error": "TSL not available"}, status_code=503)
    return JSONResponse(transparent_lock_events)


@app.get("/health")
async def health():
    """Health check"""
    return JSONResponse(
        {
            "status": "ok",
            "wsso_enabled": True,
            "transparent_lock_enabled": WINDOWS_EVENT_LOG_AVAILABLE
            and TRANSPARENT_LOCK_ENABLED,
            "neo4j_connected": True,
            "environment": "production" if IS_PRODUCTION else "development",
            "session_timeout_hours": SESSION_TIMEOUT_HOURS,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )


# ============================================================================
# STARTUP
# ============================================================================


@app.on_event("startup")
async def startup_event():
    """Start background threads"""
    logger.info("=" * 80)
    logger.info("🚀 Starting Auth Service with User Management")
    logger.info("=" * 80)
    logger.info(f"   Environment: {'Production' if IS_PRODUCTION else 'Development'}")
    logger.info(f"   Frontend URL (fallback): {FRONTEND_URL}")
    logger.info(f"   Backend Port: {PORT}")
    logger.info(f"   Session Timeout: {SESSION_TIMEOUT_HOURS} hour(s)")
    logger.info(f"   WSSO: Enabled")
    logger.info(
        f"   TSL: {'Enabled (Priority for localhost)' if WINDOWS_EVENT_LOG_AVAILABLE and TRANSPARENT_LOCK_ENABLED else 'Disabled'}"
    )
    logger.info(
        f"   Cookie Mode: {'Secure (HTTPS)' if IS_PRODUCTION else 'Development (HTTP/SameSite=Lax)'}"
    )
    logger.info(
        f"   CORS: {'Strict whitelist' if IS_PRODUCTION else 'Permissive (regex pattern for HTTP)'}"
    )
    logger.info("=" * 80)

    # Initialize Neo4j Graph Database
    try:
        get_graphdb()
        logger.info("✅ Neo4j Graph Database connected")
    except Exception as e:
        logger.error(f"❌ Neo4j connection failed: {e}")
        raise

    # Initialize User Manager
    try:
        get_user_manager()
        logger.info("✅ User Manager initialized")
    except Exception as e:
        logger.error(f"❌ User Manager initialization failed: {e}")
        raise

    # Start TSL listener
    if WINDOWS_EVENT_LOG_AVAILABLE and TRANSPARENT_LOCK_ENABLED:
        listener_thread = threading.Thread(target=listen_event_logs, daemon=True)
        listener_thread.start()
        logger.info("🔒 TSL listener started")

    # Start PKCE cleanup
    def cleanup_pkce():
        while True:
            time.sleep(3600)
            now = datetime.utcnow().timestamp()
            expired = [
                k for k, v in pkce_store.items() if now - v.get("created_at", 0) > 600
            ]
            for key in expired:
                del pkce_store[key]
            if expired:
                logger.info(f"🧹 Cleaned up {len(expired)} expired PKCE entries")

    cleanup_thread = threading.Thread(target=cleanup_pkce, daemon=True)
    cleanup_thread.start()

    logger.info("=" * 80)
    logger.info("✅ Auth Service Ready")
    logger.info("=" * 80)


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 Shutting down Auth Service...")
    try:
        graph_db = get_graphdb()
        graph_db.close()
        logger.info("✅ Neo4j connection closed")
    except:
        pass


if __name__ == "__main__":
    # SSL/TLS Configuration
    ssl_keyfile = os.getenv("SSL_KEYFILE", "cert/key.pem")
    ssl_certfile = os.getenv("SSL_CERTFILE", "cert/cert.pem")

    # Check if SSL certificates exist
    use_ssl = os.path.exists(ssl_keyfile) and os.path.exists(ssl_certfile)

    if use_ssl:
        logger.info(f"🔒 Starting server with HTTPS (SSL enabled)")
        logger.info(f"   Certificate: {ssl_certfile}")
        logger.info(f"   Key: {ssl_keyfile}")
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=PORT,
            ssl_keyfile=ssl_keyfile,
            ssl_certfile=ssl_certfile,
        )
    else:
        logger.warning(f"⚠️  SSL certificates not found. Starting without HTTPS")
        logger.warning(f"   Expected key: {ssl_keyfile}")
        logger.warning(f"   Expected cert: {ssl_certfile}")
        logger.warning(
            f"   To enable HTTPS, place your certificates in the 'cert' directory"
        )
        uvicorn.run(app, host="0.0.0.0", port=PORT)
