"""Auth route - handles user registration, login, and logout."""

import hashlib
import hmac
import json
import os
import secrets
from functools import wraps
from pathlib import Path

import config
from flask import (
    Blueprint,
    render_template,
    request,
    jsonify,
    redirect,
    url_for,
    session,
    flash,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


# ======================================================
# User store helpers
# ======================================================

def _ensure_user_store():
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not config.USERS_FILE.exists():
        config.USERS_FILE.write_text("{}", encoding="utf-8")


def _read_users():
    _ensure_user_store()
    try:
        return json.loads(config.USERS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _write_users(users):
    _ensure_user_store()
    config.USERS_FILE.write_text(
        json.dumps(users, indent=4, ensure_ascii=False),
        encoding="utf-8",
    )


def _hash_password(password, salt=None):
    """Return (salt, hash) using PBKDF2 via hashlib."""
    if salt is None:
        salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000,
    )
    return salt, digest.hex()


def _verify_password(password, salt, expected_hash):
    _, actual = _hash_password(password, salt)
    return hmac.compare_digest(actual, expected_hash)


# ======================================================
# Auth decorator
# ======================================================

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("user"):
            # If it's an API request, return JSON; else redirect to login
            if request.path.startswith("/api") or (
                request.is_json or request.headers.get("X-Requested-With") == "XMLHttpRequest"
            ):
                return jsonify({"success": False, "error": "Authentication required"}), 401
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return decorated


# ======================================================
# Current user helper
# ======================================================

def get_current_user():
    """Return the logged-in user dict or None."""
    username = session.get("user")
    if not username:
        return None
    users = _read_users()
    return users.get(username)


# ======================================================
# Routes
# ======================================================

@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        data = request.get_json(silent=True) or request.form
        username = (data.get("username") or "").strip()
        email = (data.get("email") or "").strip()
        password = data.get("password") or ""

        if not username or not email or not password:
            return jsonify({"success": False, "error": "All fields are required"}), 400
        if len(password) < 6:
            return jsonify({"success": False, "error": "Password must be at least 6 characters"}), 400

        users = _read_users()
        if username in users:
            return jsonify({"success": False, "error": "Username already exists"}), 409
        if any(u.get("email") == email for u in users.values()):
            return jsonify({"success": False, "error": "Email already registered"}), 409

        salt, pwd_hash = _hash_password(password)
        users[username] = {
            "username": username,
            "email": email,
            "password_hash": pwd_hash,
            "salt": salt,
            "created_at": None,
        }
        _write_users(users)

        session["user"] = username
        return jsonify({"success": True, "username": username})

    return render_template("register.html")


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        data = request.get_json(silent=True) or request.form
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""

        users = _read_users()
        user = users.get(username)
        if not user:
            return jsonify({"success": False, "error": "Invalid username or password"}), 401

        if not _verify_password(password, user["salt"], user["password_hash"]):
            return jsonify({"success": False, "error": "Invalid username or password"}), 401

        session["user"] = username
        return jsonify({"success": True, "username": username})

    return render_template("login.html")


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.pop("user", None)
    return jsonify({"success": True})


@auth_bp.route("/me", methods=["GET"])
def me():
    user = get_current_user()
    if not user:
        return jsonify({"success": False, "authenticated": False})
    return jsonify({
        "success": True,
        "authenticated": True,
        "username": user["username"],
        "email": user["email"],
    })
