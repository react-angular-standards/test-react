import base64
import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import requests
import uvicorn
from authlib.jose import jwt
from dotenv import load_dotenv
from fastapi import Body, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

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
FRONTEND_URL = os.getenv("FRONTEND_URL")
SESSION_SECRET = os.getenv("SESSION_SECRET")
AUTH_SECRET = os.getenv("AUTH_SECRET")
PORT = int(os.getenv("PORT", 5002))
IS_PRODUCTION = os.getenv("NODE_ENV") == "production"

# Validate environment variables
required_env_vars = [
    "SSO_ID",
    "SSO_SECRET",
    "OIDC_BASE",
    "OIDC_ISSUER",
    "CALLBACK_URL",
    "FRONTEND_URL",
    "SESSION_SECRET",
    "AUTH_SECRET",
]
missing_env_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_env_vars:
    logger.error(f"Missing environment variables: {', '.join(missing_env_vars)}")
    raise ValueError(f"Missing environment variables: {', '.join(missing_env_vars)}")

app = FastAPI(
    title="WSSO Proxy Backend for TAS SSO",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Add SessionMiddleware for authlib OAuth state
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, same_site="lax")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Cookie"],
    expose_headers=["Set-Cookie"],
)

# In-memory PKCE store (use Redis in production)
pkce_store = {}

# In-memory user store with roles (use database in production)
# Structure: {user_id: {"id": str, "name": str, "email": str, "role": "admin" | "user"}}
users_store: Dict[str, Dict[str, Any]] = {}


# Pydantic models for request/response
class UserResponse(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    role: str


class PermissionChangeRequest(BaseModel):
    role: str  # "admin" or "user"


class UsersListResponse(BaseModel):
    users: List[UserResponse]
    total: int


# Helper to get user role from store
def get_user_role(user_id: str) -> str:
    if user_id in users_store:
        return users_store[user_id].get("role", "user")
    return "user"


# Dependency to check if current user is admin
def require_admin(request: Request) -> Dict[str, Any]:
    user_info = get_current_user(request)
    user_id = user_info.get("sub")
    role = get_user_role(user_id)
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_info


# PKCE helpers
def generate_code_verifier():
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("utf-8").rstrip("=")


def generate_code_challenge(verifier: str) -> str:
    hashed = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(hashed).decode("utf-8").rstrip("=")


def get_current_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get("auth_session")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, AUTH_SECRET)
        payload.validate()
        user_info = payload.get("userInfo", {})
        if not user_info:
            raise HTTPException(status_code=401, detail="No user info in session")
        return user_info
    except Exception as e:
        logger.error(f"Invalid session token: {e}")
        raise HTTPException(status_code=401, detail="Invalid session")


@app.get("/auth/discovery")
async def auth_discovery():
    try:
        response = requests.get(
            f"{OIDC_BASE}/.well-known/openid-configuration", verify=IS_PRODUCTION
        )
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
    try:
        response = requests.get(f"{OIDC_BASE}/token_keys", verify=IS_PRODUCTION)
        return JSONResponse(response.json())
    except Exception as e:
        logger.error(f"JWKS failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch JWKS")


@app.get("/auth/authorize")
async def authorize(request: Request):
    """
    Initiate OIDC login flow with PKCE (matching Node.js implementation).
    """
    try:
        # Generate PKCE parameters
        code_verifier = generate_code_verifier()
        code_challenge = generate_code_challenge(code_verifier)
        state = (
            base64.urlsafe_b64encode(secrets.token_bytes(16))
            .decode("utf-8")
            .rstrip("=")
        )

        # Store PKCE data
        pkce_store[state] = {
            "code_verifier": code_verifier,
            "created_at": datetime.utcnow().timestamp(),
        }

        logger.info(f"Authorize - state: {state}, code_challenge: {code_challenge}")

        # Build authorization URL manually (like Node.js version)
        auth_params = {
            "client_id": SSO_ID,
            "response_type": "code",
            "scope": "openid profile",
            "redirect_uri": CALLBACK_URL,
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }

        auth_url = f"{OIDC_BASE}/oauth/authorize?{urlencode(auth_params)}"
        logger.info(f"Authorize - Redirecting to: {auth_url}")

        return RedirectResponse(url=auth_url, status_code=302)
    except Exception as e:
        logger.error(f"Authorize failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate sign-in")


@app.get("/login")
async def login(request: Request):
    """
    Legacy login endpoint. Redirect to /auth/authorize.
    """
    logger.info(f"Login - redirecting to /auth/authorize")
    return RedirectResponse(url="/auth/authorize")


@app.get("/callback")
async def callback(request: Request):
    """
    Handle OIDC callback from authservice/TAS SSO (matching Node.js implementation).
    """
    code = request.query_params.get("code")
    state = request.query_params.get("state")

    logger.info(f"Callback - Incoming state: {state}, Code: {code}")

    stored = pkce_store.get(state)
    if not stored:
        logger.error(f"Callback - Invalid or expired state: {state}")
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    try:
        code_verifier = stored["code_verifier"]
        logger.info(f"Callback - Using code_verifier: {code_verifier}")

        # Step 1: Token exchange (matching Node.js implementation)
        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": SSO_ID,
            "client_secret": SSO_SECRET,
            "redirect_uri": CALLBACK_URL,
            "code_verifier": code_verifier,
        }

        token_response = requests.post(
            f"{OIDC_BASE}/oauth/token",
            data=token_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            verify=IS_PRODUCTION,
        )

        if token_response.status_code != 200:
            logger.error(f"Token exchange failed: {token_response.text}")
            raise HTTPException(
                status_code=400, detail=f"Token exchange failed: {token_response.text}"
            )

        token_json = token_response.json()
        id_token = token_json.get("id_token")
        access_token = token_json.get("access_token")

        logger.info(
            f"Callback - Access token received: {access_token[:20] if access_token else 'None'}..."
        )

        # Step 2: Fetch user info
        user_info = None
        try:
            userinfo_response = requests.get(
                f"{OIDC_BASE}/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                verify=IS_PRODUCTION,
            )
            if userinfo_response.status_code == 200:
                user_info = userinfo_response.json()
                logger.info(f"Callback - UserInfo: {user_info}")
        except Exception as e:
            logger.warning(f"Userinfo fetch failed: {e}")
            # Fallback: decode id_token (simplified - you may need jwks validation)
            try:
                from authlib.jose import jwt as jose_jwt

                # Note: In production, validate with JWKS
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
                logger.info(f"Callback - UserInfo from id_token: {user_info}")
            except Exception as id_error:
                logger.error(f"ID token decode failed: {id_error}")
                user_info = {}

        # Step 3: Register user in store if not exists (first user becomes admin)
        if user_info and user_info.get("sub"):
            user_id = user_info.get("sub")
            if user_id not in users_store:
                # First user becomes admin, others are regular users
                role = "admin" if len(users_store) == 0 else "user"
                users_store[user_id] = {
                    "id": user_id,
                    "name": user_info.get("name", "Unknown User"),
                    "email": user_info.get("email"),
                    "role": role,
                }
                logger.info(f"Callback - New user registered: {user_id}, role: {role}")

        # Step 4: Create signed session JWT with user info
        payload = {
            "accessToken": access_token,
            "idToken": id_token,
            "userInfo": user_info or {},
            "iat": int(datetime.utcnow().timestamp()),
            "exp": int((datetime.utcnow() + timedelta(hours=1)).timestamp()),
        }

        header = {"alg": "HS256"}
        session_token = jwt.encode(header, payload, AUTH_SECRET).decode("utf-8")

        logger.info(f"Callback - Session token created")

        # Step 5: Build redirect URL with user info
        redirect_params = {"authorized": "true"}
        if user_info:
            redirect_params.update(
                {
                    "id": user_info.get("sub", ""),
                    "name": user_info.get("name", "Unknown User"),
                    "email": user_info.get("email", ""),
                    "givenName": user_info.get("given_name", ""),
                    "familyName": user_info.get("family_name", ""),
                    "bemsid": user_info.get("bemsid", ""),
                }
            )

        redirect_url = f"{FRONTEND_URL}?{urlencode(redirect_params)}"
        logger.info(f"Callback - Redirecting to: {redirect_url}")

        # Step 6: Set cookie and redirect
        response = RedirectResponse(url=redirect_url, status_code=302)
        response.set_cookie(
            key="auth_session",
            value=session_token,
            httponly=True,
            secure=False,  # Set to True in production with HTTPS
            samesite="lax",
            path="/",
            max_age=24 * 60 * 60,
        )

        return response

    except Exception as e:
        logger.error(f"Callback error: {str(e)}")
        raise HTTPException(status_code=500, detail="Token exchange failed")
    finally:
        # Clean up PKCE store
        if state in pkce_store:
            del pkce_store[state]


@app.get("/auth/userinfo")
async def auth_userinfo(request: Request):
    token = request.cookies.get("auth_session")
    logger.info(f"Userinfo - token present: {bool(token)}")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, AUTH_SECRET)
        user_info = payload.get("userInfo", {})
        if user_info and len(user_info) > 0:
            logger.info(f"Userinfo - Using cached userInfo")
            return {
                "id": user_info.get("sub"),
                "name": user_info.get("name"),
                "email": user_info.get("email"),
                "givenName": user_info.get("given_name"),
                "familyName": user_info.get("family_name"),
                "bemsid": user_info.get("bemsid"),
                "profile": user_info,
            }

        # Fallback: fetch from OIDC
        access_token = payload.get("accessToken")
        response = requests.get(
            f"{OIDC_BASE}/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            verify=IS_PRODUCTION,
        )
        data = response.json()
        return {
            "id": data.get("sub"),
            "name": data.get("name"),
            "email": data.get("email"),
            "givenName": data.get("given_name"),
            "familyName": data.get("family_name"),
            "bemsid": data.get("bemsid"),
            "profile": data,
        }
    except Exception as e:
        logger.error(f"Userinfo failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid session")


@app.get("/auth/status")
async def auth_status(
    request: Request, current_user: Dict[str, Any] = Depends(get_current_user)
):
    logger.info(f"Status - User: {current_user.get('sub')}")
    return {"authenticated": True, "user": current_user}


@app.get("/auth/session")
async def auth_session(request: Request):
    token = request.cookies.get("auth_session")
    logger.info(f"Session - token present: {bool(token)}")
    if not token:
        return {"user": None}
    try:
        payload = jwt.decode(token, AUTH_SECRET)
        user_info = payload.get("userInfo", {})

        if not user_info or len(user_info) == 0:
            # Try fetching from OIDC
            try:
                access_token = payload.get("accessToken")
                response = requests.get(
                    f"{OIDC_BASE}/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"},
                    verify=IS_PRODUCTION,
                )
                if response.status_code == 200:
                    user_info = response.json()
            except Exception as e:
                logger.warning(f"Userinfo fetch failed in session: {e}")
                return {"user": None}

        logger.info(f"Session - User found: {user_info.get('sub')}")
        return {
            "user": {
                "id": user_info.get("sub"),
                "name": user_info.get("name", "Unknown User"),
                "email": user_info.get("email"),
                "givenName": user_info.get("given_name"),
                "familyName": user_info.get("family_name"),
                "bemsid": user_info.get("bemsid"),
            },
            "accessToken": payload.get("accessToken"),
            "idToken": payload.get("idToken"),
        }
    except Exception as e:
        logger.error(f"Session validation failed: {e}")
        resp = JSONResponse(content={"user": None})
        resp.delete_cookie("auth_session", path="/")
        return resp


@app.post("/auth/signout")
async def auth_signout():
    resp = JSONResponse(content={"success": True})
    resp.delete_cookie("auth_session", path="/")
    return resp


@app.get("/lock")
async def transparent_lock(request: Request):
    try:
        get_current_user(request)
        return JSONResponse({"status": "unlocked", "message": "Session active"})
    except HTTPException:
        return RedirectResponse(url="/auth/authorize")


@app.get("/proxy/{path:path}")
async def proxy_endpoint(
    path: str,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    return {
        "path": path,
        "user": current_user.get("sub"),
        "message": "Protected proxy response",
    }


# User Management Endpoints (Admin Only)


@app.get("/users", response_model=UsersListResponse)
async def list_users(
    request: Request, admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    List all users with their roles. Admin access required.
    """
    logger.info(f"List users - requested by admin: {admin_user.get('sub')}")
    users_list = [
        UserResponse(
            id=user["id"], name=user["name"], email=user.get("email"), role=user["role"]
        )
        for user in users_store.values()
    ]
    return UsersListResponse(users=users_list, total=len(users_list))


@app.post("/users/{user_id}/permission")
async def change_user_permission(
    user_id: str,
    request: Request,
    permission_request: PermissionChangeRequest,
    admin_user: Dict[str, Any] = Depends(require_admin),
):
    """
    Change user permission (admin to user or user to admin). Admin access required.
    """
    new_role = permission_request.role.lower()
    if new_role not in ["admin", "user"]:
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'")

    if user_id not in users_store:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = users_store[user_id]["role"]
    users_store[user_id]["role"] = new_role

    logger.info(
        f"Permission changed - user: {user_id}, from: {old_role}, to: {new_role}, by admin: {admin_user.get('sub')}"
    )

    return {
        "success": True,
        "user_id": user_id,
        "old_role": old_role,
        "new_role": new_role,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
