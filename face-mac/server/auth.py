"""Auth blueprint for the iPhone client: username + password + taxi plate.

Endpoints (all JSON):
    POST /auth/register {username, password, plate} -> 201 {token, username, plate}
    POST /auth/login    {username, password}        -> 200 {token, username, plate}
    GET  /auth/me       (Authorization: Bearer ..)  -> 200 {username, plate}
    POST /auth/logout   (Authorization: Bearer ..)  -> 200 {ok: true}

Storage: SQLite at $USERS_DB_PATH (defaults to the same data/ dir as
embeddings.pkl so the existing /app/data Docker volume covers both files).

Tokens are 32-byte URL-safe strings, no expiry — fine for a thesis demo
with a tiny user table. Plate is normalised to upper-case with single
spaces and validated against the standard TR plate format (NN [L..LLL] NN[NN]).

Plate is intentionally NOT unique: the same taxi may have more than one
registered driver/account during testing.
"""
from __future__ import annotations

import os
import re
import secrets
import sqlite3
from contextlib import contextmanager
from typing import Optional

from flask import Blueprint, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

# Pick the same directory as DB_PATH (embeddings.pkl) so the existing
# /app/data Docker volume persists both files. Fallback to module dir
# for local dev runs.
_db_path_env = os.environ.get("DB_PATH", "")
_default_dir = os.path.dirname(_db_path_env) if _db_path_env else os.path.dirname(__file__)
USERS_DB_PATH = os.environ.get("USERS_DB_PATH", os.path.join(_default_dir, "users.db"))

# TR plate: 2 digits, 1-3 letters, 2-4 digits, single optional spaces.
PLATE_RE = re.compile(r"^\d{2}\s?[A-Z]{1,3}\s?\d{2,4}$")

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


def _init_db() -> None:
    parent = os.path.dirname(USERS_DB_PATH)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with sqlite3.connect(USERS_DB_PATH) as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                username      TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                plate         TEXT NOT NULL,
                created_at    REAL NOT NULL DEFAULT (strftime('%s', 'now'))
            );
            CREATE TABLE IF NOT EXISTS tokens (
                token      TEXT PRIMARY KEY,
                username   TEXT NOT NULL,
                created_at REAL NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
            );
            """
        )


@contextmanager
def _db():
    con = sqlite3.connect(USERS_DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def _normalize_plate(raw: str) -> str:
    return re.sub(r"\s+", " ", raw.strip().upper())


def _issue_token(username: str) -> str:
    token = secrets.token_urlsafe(32)
    with _db() as con:
        con.execute("INSERT INTO tokens(token, username) VALUES (?, ?)", (token, username))
    return token


def _bearer_token() -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    return auth[len("Bearer "):].strip() or None


def _user_for_token(token: str) -> Optional[sqlite3.Row]:
    with _db() as con:
        return con.execute(
            """SELECT u.username, u.plate
               FROM tokens t JOIN users u ON u.username = t.username
               WHERE t.token = ?""",
            (token,),
        ).fetchone()


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    plate_raw = (data.get("plate") or "").strip()

    if len(username) < 3 or len(username) > 32:
        return jsonify({"error": "bad_username", "message": "Kullanıcı adı 3-32 karakter olmalı."}), 400
    if len(password) < 6:
        return jsonify({"error": "bad_password", "message": "Şifre en az 6 karakter olmalı."}), 400
    plate = _normalize_plate(plate_raw)
    if not PLATE_RE.match(plate):
        return jsonify({"error": "bad_plate", "message": "Plaka formatı: 34 ABC 1234"}), 400

    pwd_hash = generate_password_hash(password)
    try:
        with _db() as con:
            con.execute(
                "INSERT INTO users(username, password_hash, plate) VALUES (?, ?, ?)",
                (username, pwd_hash, plate),
            )
    except sqlite3.IntegrityError:
        return jsonify({"error": "username_taken", "message": "Bu kullanıcı adı zaten alınmış."}), 409

    token = _issue_token(username)
    return jsonify({"token": token, "username": username, "plate": plate}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username or not password:
        return jsonify({"error": "missing_credentials", "message": "Kullanıcı adı ve şifre gerekli."}), 400

    with _db() as con:
        row = con.execute(
            "SELECT username, password_hash, plate FROM users WHERE username = ?",
            (username,),
        ).fetchone()
    if not row or not check_password_hash(row["password_hash"], password):
        return jsonify({"error": "invalid_credentials", "message": "Kullanıcı adı veya şifre yanlış."}), 401

    token = _issue_token(username)
    return jsonify({"token": token, "username": row["username"], "plate": row["plate"]}), 200


@auth_bp.route("/me", methods=["GET"])
def me():
    token = _bearer_token()
    if not token:
        return jsonify({"error": "missing_token"}), 401
    row = _user_for_token(token)
    if not row:
        return jsonify({"error": "invalid_token"}), 401
    return jsonify({"username": row["username"], "plate": row["plate"]})


@auth_bp.route("/logout", methods=["POST"])
def logout():
    token = _bearer_token()
    if not token:
        return jsonify({"error": "missing_token"}), 401
    with _db() as con:
        con.execute("DELETE FROM tokens WHERE token = ?", (token,))
    return jsonify({"ok": True})


# Initialise the schema when the module is imported (gunicorn worker boot).
_init_db()
