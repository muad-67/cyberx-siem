"""
middleware/auth.py
JWT authentication middleware for CyberX SIEM.

Provides:
  - @require_auth        — any authenticated user
  - @require_admin       — admin role only
  - get_current_user()   — decode token from request headers
"""

from functools import wraps
from datetime import datetime, timedelta
import jwt
from flask import request, jsonify, current_app
from database import get_db


def _decode_token(token: str) -> dict | None:
    """Decode and validate a JWT. Returns payload dict or None."""
    try:
        payload = jwt.decode(
            token,
            current_app.config["JWT_SECRET_KEY"],
            algorithms=["HS256"],
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_current_user():
    """
    Extract and validate the Bearer token from the Authorization header.
    Returns the user row dict, or None if missing / invalid.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]
    payload = _decode_token(token)
    if not payload:
        return None

    conn = get_db()
    user = conn.execute(
        "SELECT id, username, email, role, is_active FROM users WHERE id = ?",
        (payload.get("user_id"),),
    ).fetchone()
    conn.close()

    if not user or not user["is_active"]:
        return None
    return dict(user)


def require_auth(f):
    """Decorator — route requires a valid JWT token."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    """Decorator — route requires admin role."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        if user["role"] != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated
