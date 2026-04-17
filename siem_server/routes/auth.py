"""
routes/auth.py
Authentication endpoints for CyberX SIEM.

POST /api/auth/register  — create new account (admin only in production)
POST /api/auth/login     — get JWT token
GET  /api/auth/me        — get current user profile
POST /api/auth/logout    — client-side token discard (no server state)
GET  /api/auth/users     — list all users (admin only)
"""

import hashlib
import os
import sqlite3
from datetime import datetime, timedelta

import jwt
from flask import Blueprint, jsonify, request, current_app
from database import get_db
from middleware.auth import require_auth, require_admin, get_current_user

auth_bp = Blueprint("auth", __name__)


def _hash_password(password: str) -> str:
    """SHA-256 hash with a random salt, returned as salt:hash hex string."""
    salt = os.urandom(16).hex()
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{hashed}"


def _verify_password(password: str, stored_hash: str) -> bool:
    """Verify a plain-text password against the stored salt:hash."""
    try:
        salt, hashed = stored_hash.split(":", 1)
    except ValueError:
        return False
    return hashlib.sha256((salt + password).encode()).hexdigest() == hashed


def _generate_token(user_id: int, username: str, role: str) -> str:
    """Create a signed JWT that expires in JWT_EXPIRY_HOURS."""
    payload = {
        "user_id":  user_id,
        "username": username,
        "role":     role,
        "exp":      datetime.utcnow() + timedelta(hours=current_app.config["JWT_EXPIRY_HOURS"]),
        "iat":      datetime.utcnow(),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET_KEY"], algorithm="HS256")


# ── Register ──────────────────────────────────────────────────────────────────

@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    """
    Create a new user account.
    Body: { username, email, password, role? }
    Role defaults to 'analyst'. First registered user is automatically admin.
    """
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role     = data.get("role", "analyst")

    if not username or not email or not password:
        return jsonify({"error": "username, email, and password are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if role not in ("admin", "analyst"):
        return jsonify({"error": "role must be 'admin' or 'analyst'"}), 400

    conn = get_db()

    # First user ever becomes admin automatically
    count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if count == 0:
        role = "admin"

    # Check for duplicate username/email
    existing = conn.execute(
        "SELECT id FROM users WHERE username = ? OR email = ?", (username, email)
    ).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "Username or email already registered"}), 409

    password_hash = _hash_password(password)
    conn.execute(
        "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
        (username, email, password_hash, role),
    )
    conn.commit()
    user_id = conn.execute(
        "SELECT id FROM users WHERE username = ?", (username,)
    ).fetchone()["id"]
    conn.close()

    token = _generate_token(user_id, username, role)
    return jsonify({
        "message": "Account created successfully",
        "token": token,
        "user": {"id": user_id, "username": username, "email": email, "role": role},
    }), 201


# ── Login ─────────────────────────────────────────────────────────────────────

@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    """
    Authenticate with username + password, receive a JWT.
    Body: { username, password }
    """
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    conn = get_db()
    user = conn.execute(
        "SELECT * FROM users WHERE username = ? AND is_active = 1", (username,)
    ).fetchone()

    if not user or not _verify_password(password, user["password_hash"]):
        conn.close()
        return jsonify({"error": "Invalid username or password"}), 401

    # Update last_login timestamp
    try:
        conn.execute(
            "UPDATE users SET last_login = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), user["id"]),
        )
        conn.commit()
    except sqlite3.OperationalError as e:
        # Don't fail successful auth because of a transient DB lock.
        if "locked" not in str(e).lower():
            conn.close()
            raise
    conn.close()

    token = _generate_token(user["id"], user["username"], user["role"])
    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {
            "id":       user["id"],
            "username": user["username"],
            "email":    user["email"],
            "role":     user["role"],
        },
    })


# ── Current user profile ──────────────────────────────────────────────────────

@auth_bp.route("/api/auth/me", methods=["GET"])
@require_auth
def me():
    """Return the profile of the currently authenticated user."""
    user = get_current_user()
    return jsonify(user)


# ── Logout (client-side) ──────────────────────────────────────────────────────

@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    """
    Logout is handled client-side by discarding the token.
    This endpoint exists for completeness / audit logging.
    """
    return jsonify({"message": "Logged out successfully"})


# ── Admin: list users ─────────────────────────────────────────────────────────

@auth_bp.route("/api/auth/users", methods=["GET"])
@require_admin
def list_users():
    """Return all user accounts (admin only)."""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, username, email, role, is_active, created_at, last_login FROM users ORDER BY created_at"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])
