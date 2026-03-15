#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Candidature tracking: draft_created, sent, relance, reponse_positive, reponse_negative, no_reponse.
Stored in SQLite (same DB as runs or dedicated). Used for suivi candidatures and analytics.
"""

from __future__ import annotations

import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

CANDIDATURE_STATUSES = frozenset({
    "draft_created",
    "sent",
    "relance",
    "reponse_positive",
    "reponse_negative",
    "no_reponse",
})

_DB_PATH: Optional[Path] = None
_LOCK = threading.Lock()


def init_candidature_store(db_path: Optional[Path] = None) -> Path:
    """Initialize candidatures table. Call once at app startup."""
    global _DB_PATH
    if db_path is None:
        db_path = Path(__file__).resolve().parent / "data" / "runs.db"
    db_path = db_path.resolve()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    _DB_PATH = db_path
    with _LOCK:
        conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS candidatures (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_key TEXT NOT NULL,
                    run_id TEXT,
                    company TEXT NOT NULL,
                    email TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'draft_created',
                    draft_id TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_candidatures_user_key
                ON candidatures(user_key)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_candidatures_status
                ON candidatures(user_key, status)
            """)
            conn.commit()
        finally:
            conn.close()
    return _DB_PATH


def _get_conn() -> sqlite3.Connection:
    if _DB_PATH is None:
        init_candidature_store()
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


@dataclass
class Candidature:
    id: int
    user_key: str
    run_id: Optional[str]
    company: str
    email: str
    status: str
    draft_id: Optional[str]
    created_at: str
    updated_at: str


def _row_to_candidature(row: sqlite3.Row) -> Candidature:
    return Candidature(
        id=row["id"],
        user_key=row["user_key"],
        run_id=row["run_id"],
        company=row["company"] or "",
        email=row["email"] or "",
        status=row["status"] or "draft_created",
        draft_id=row["draft_id"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _utc_now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def list_candidatures(
    user_key: str,
    status_filter: Optional[str] = None,
    limit: int = 500,
) -> List[Candidature]:
    """List candidatures for a user, optionally filtered by status."""
    if status_filter and status_filter not in CANDIDATURE_STATUSES:
        status_filter = None
    with _LOCK:
        conn = _get_conn()
        try:
            if status_filter:
                cursor = conn.execute(
                    """
                    SELECT id, user_key, run_id, company, email, status, draft_id, created_at, updated_at
                    FROM candidatures
                    WHERE user_key = ? AND status = ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    (user_key, status_filter, limit),
                )
            else:
                cursor = conn.execute(
                    """
                    SELECT id, user_key, run_id, company, email, status, draft_id, created_at, updated_at
                    FROM candidatures
                    WHERE user_key = ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    (user_key, limit),
                )
            rows = cursor.fetchall()
            return [_row_to_candidature(r) for r in rows]
        finally:
            conn.close()


def get_counts_by_status(user_key: str) -> Dict[str, int]:
    """Return count of candidatures per status for a user. Includes 'total'."""
    with _LOCK:
        conn = _get_conn()
        try:
            cursor = conn.execute(
                """
                SELECT status, COUNT(*) AS cnt
                FROM candidatures
                WHERE user_key = ?
                GROUP BY status
                """,
                (user_key,),
            )
            rows = cursor.fetchall()
            counts: Dict[str, int] = {s: 0 for s in CANDIDATURE_STATUSES}
            total = 0
            for row in rows:
                status = (row[0] or "").strip()
                cnt = row[1] or 0
                if status in CANDIDATURE_STATUSES:
                    counts[status] = cnt
                total += cnt
            counts["total"] = total
            return counts
        finally:
            conn.close()


def insert_candidature(
    user_key: str,
    company: str,
    email: str,
    status: str = "draft_created",
    run_id: Optional[str] = None,
    draft_id: Optional[str] = None,
) -> Candidature:
    """Insert a new candidature."""
    if status not in CANDIDATURE_STATUSES:
        status = "draft_created"
    now = _utc_now_iso()
    with _LOCK:
        conn = _get_conn()
        try:
            cursor = conn.execute(
                """
                INSERT INTO candidatures (user_key, run_id, company, email, status, draft_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (user_key, run_id or "", company, email, status, draft_id or "", now, now),
            )
            conn.commit()
            row = conn.execute(
                "SELECT id, user_key, run_id, company, email, status, draft_id, created_at, updated_at FROM candidatures WHERE id = ?",
                (cursor.lastrowid,),
            ).fetchone()
            return _row_to_candidature(row)
        finally:
            conn.close()


def update_candidature_status(
    candidature_id: int,
    user_key: str,
    new_status: str,
) -> Optional[Candidature]:
    """Update status of a candidature. Returns updated row or None if not found / wrong user."""
    if new_status not in CANDIDATURE_STATUSES:
        return None
    now = _utc_now_iso()
    with _LOCK:
        conn = _get_conn()
        try:
            conn.execute(
                "UPDATE candidatures SET status = ?, updated_at = ? WHERE id = ? AND user_key = ?",
                (new_status, now, candidature_id, user_key),
            )
            conn.commit()
            if conn.total_changes == 0:
                return None
            row = conn.execute(
                "SELECT id, user_key, run_id, company, email, status, draft_id, created_at, updated_at FROM candidatures WHERE id = ?",
                (candidature_id,),
            ).fetchone()
            return _row_to_candidature(row) if row else None
        finally:
            conn.close()


def get_candidature(candidature_id: int, user_key: str) -> Optional[Candidature]:
    """Get a single candidature by id and user_key."""
    with _LOCK:
        conn = _get_conn()
        try:
            row = conn.execute(
                "SELECT id, user_key, run_id, company, email, status, draft_id, created_at, updated_at FROM candidatures WHERE id = ? AND user_key = ?",
                (candidature_id, user_key),
            ).fetchone()
            return _row_to_candidature(row) if row else None
        finally:
            conn.close()


def get_candidature_by_contact_email(user_key: str, contact_email: str) -> Optional[Candidature]:
    """Find a candidature by user_key and contact email (the person we sent the application to).
    Returns the most recently updated one if several match."""
    if not (user_key and (contact_email or "").strip()):
        return None
    email_normalized = contact_email.strip().lower()
    with _LOCK:
        conn = _get_conn()
        try:
            row = conn.execute(
                """SELECT id, user_key, run_id, company, email, status, draft_id, created_at, updated_at
                   FROM candidatures WHERE user_key = ? AND LOWER(TRIM(email)) = ?
                   ORDER BY updated_at DESC LIMIT 1""",
                (user_key, email_normalized),
            ).fetchone()
            return _row_to_candidature(row) if row else None
        finally:
            conn.close()


def _exists_candidature(user_key: str, company: str, email: str) -> bool:
    with _LOCK:
        conn = _get_conn()
        try:
            row = conn.execute(
                "SELECT 1 FROM candidatures WHERE user_key = ? AND company = ? AND email = ? LIMIT 1",
                (user_key, company, email),
            ).fetchone()
            return row is not None
        finally:
            conn.close()


def upsert_candidatures_from_draft_log(
    user_key: str,
    run_id: str,
    entries: List[dict],
) -> int:
    """
    Insert candidatures from draft log entries; skip if already exists (same user_key, company, email).
    entries: list of { "company", "to", "status", "draft_id" }.
    Returns number of new rows inserted.
    """
    inserted = 0
    for e in entries:
        company = (e.get("company") or "").strip()
        email = (e.get("to") or "").strip()
        if not company or not email:
            continue
        if _exists_candidature(user_key, company, email):
            continue
        status = "draft_created" if (e.get("status") or "").strip().upper() == "OK" else "draft_created"
        draft_id = (e.get("draft_id") or "").strip()
        insert_candidature(
            user_key=user_key,
            company=company,
            email=email,
            status=status,
            run_id=run_id,
            draft_id=draft_id or None,
        )
        inserted += 1
    return inserted
