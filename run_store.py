#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Persistent run store with state machine.
Runs are stored in SQLite; logs remain in files (log_file path stored, tail read on demand).
"""

from __future__ import annotations

import json
import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, List, Optional

# State machine: queued -> running -> (succeeded | failed | cancelled)
#                               -> cancelling -> cancelled
VALID_STATUSES = frozenset({"queued", "running", "cancelling", "succeeded", "failed", "cancelled"})
TERMINAL_STATUSES = frozenset({"succeeded", "failed", "cancelled"})

# Allowed transitions: from_status -> set(of to_status)
ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    "queued": frozenset({"running", "cancelled"}),
    "running": frozenset({"succeeded", "failed", "cancelling", "cancelled"}),
    "cancelling": frozenset({"cancelled"}),
    "succeeded": frozenset(),
    "failed": frozenset(),
    "cancelled": frozenset(),
}

_DB_PATH: Optional[Path] = None
_LOCK = threading.Lock()


def init_run_store(db_path: Optional[Path] = None) -> Path:
    """Initialize the run store DB. Call once at app startup."""
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
                CREATE TABLE IF NOT EXISTS runs (
                    run_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    started_at TEXT,
                    finished_at TEXT,
                    exit_code INTEGER,
                    display_command TEXT,
                    owner_user_id TEXT,
                    owner_user_email TEXT,
                    log_file TEXT NOT NULL,
                    cancel_requested INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_runs_owner_user_id
                ON runs(owner_user_id)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_runs_created_at
                ON runs(created_at DESC)
            """)
            conn.commit()
        finally:
            conn.close()
    return _DB_PATH


def _get_conn() -> sqlite3.Connection:
    if _DB_PATH is None:
        init_run_store()
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _check_transition(from_status: str, to_status: str) -> None:
    if to_status not in VALID_STATUSES:
        raise ValueError(f"Invalid status: {to_status}")
    allowed = ALLOWED_TRANSITIONS.get(from_status, frozenset())
    if to_status not in allowed:
        raise ValueError(f"Invalid transition: {from_status} -> {to_status}")


@dataclass
class StoredRun:
    run_id: str
    status: str
    created_at: str
    started_at: Optional[str]
    finished_at: Optional[str]
    exit_code: Optional[int]
    display_command: List[str]
    owner_user_id: Optional[str]
    owner_user_email: Optional[str]
    log_file: str
    cancel_requested: bool
    updated_at: str
    pid: Optional[int] = None  # Only set when run is live in memory


def insert_run(
    run_id: str,
    status: str,
    created_at: str,
    display_command: List[str],
    log_file: str,
    owner_user_id: Optional[str] = None,
    owner_user_email: Optional[str] = None,
) -> None:
    """Insert a new run in state 'queued' (or 'running' if caller starts immediately)."""
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status: {status}")
    updated_at = created_at
    with _LOCK:
        conn = _get_conn()
        try:
            conn.execute(
                """
                INSERT INTO runs (
                    run_id, status, created_at, started_at, finished_at, exit_code,
                    display_command, owner_user_id, owner_user_email, log_file,
                    cancel_requested, updated_at
                ) VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, 0, ?)
                """,
                (
                    run_id,
                    status,
                    created_at,
                    json.dumps(display_command),
                    owner_user_id,
                    owner_user_email,
                    log_file,
                    updated_at,
                ),
            )
            conn.commit()
        finally:
            conn.close()


def update_run_status(
    run_id: str,
    new_status: str,
    *,
    started_at: Optional[str] = None,
    finished_at: Optional[str] = None,
    exit_code: Optional[int] = None,
    cancel_requested: Optional[bool] = None,
) -> None:
    """Update run state. Enforces state machine transitions."""
    with _LOCK:
        conn = _get_conn()
        try:
            row = conn.execute(
                "SELECT status, updated_at FROM runs WHERE run_id = ?", (run_id,)
            ).fetchone()
            if row is None:
                conn.close()
                raise KeyError(f"Run not found: {run_id}")
            from_status = row["status"]
            _check_transition(from_status, new_status)
            updated_at = finished_at or started_at or row["updated_at"]

            updates: List[str] = ["status = ?", "updated_at = ?"]
            args: List[Any] = [new_status, updated_at]
            if started_at is not None:
                updates.append("started_at = ?")
                args.append(started_at)
            if finished_at is not None:
                updates.append("finished_at = ?")
                args.append(finished_at)
            if exit_code is not None:
                updates.append("exit_code = ?")
                args.append(exit_code)
            if cancel_requested is not None:
                updates.append("cancel_requested = ?")
                args.append(1 if cancel_requested else 0)
            args.append(run_id)
            conn.execute(
                f"UPDATE runs SET {', '.join(updates)} WHERE run_id = ?", args
            )
            conn.commit()
        finally:
            conn.close()


def _utc_now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def set_cancel_requested(run_id: str) -> None:
    """Set cancel_requested=1 and transition to cancelling if currently running."""
    with _LOCK:
        conn = _get_conn()
        try:
            row = conn.execute(
                "SELECT status FROM runs WHERE run_id = ?", (run_id,)
            ).fetchone()
            if row is None:
                conn.close()
                raise KeyError(f"Run not found: {run_id}")
            status = row["status"]
            if status in TERMINAL_STATUSES:
                conn.close()
                return
            now = _utc_now_iso()
            if status == "running":
                _check_transition("running", "cancelling")
                conn.execute(
                    "UPDATE runs SET status = 'cancelling', cancel_requested = 1, updated_at = ? WHERE run_id = ?",
                    (now, run_id),
                )
            else:
                conn.execute(
                    "UPDATE runs SET cancel_requested = 1, updated_at = ? WHERE run_id = ?",
                    (now, run_id),
                )
            conn.commit()
        finally:
            conn.close()


def get_run_by_id(run_id: str) -> Optional[StoredRun]:
    """Load a run from the store. Returns None if not found."""
    with _LOCK:
        conn = _get_conn()
        try:
            row = conn.execute(
                "SELECT run_id, status, created_at, started_at, finished_at, exit_code,"
                " display_command, owner_user_id, owner_user_email, log_file,"
                " cancel_requested, updated_at FROM runs WHERE run_id = ?",
                (run_id,),
            ).fetchone()
            if row is None:
                return None
            cmd = row["display_command"]
            if isinstance(cmd, str):
                cmd = json.loads(cmd) if cmd else []
            return StoredRun(
                run_id=row["run_id"],
                status=row["status"],
                created_at=row["created_at"],
                started_at=row["started_at"],
                finished_at=row["finished_at"],
                exit_code=row["exit_code"],
                display_command=cmd,
                owner_user_id=row["owner_user_id"],
                owner_user_email=row["owner_user_email"],
                log_file=row["log_file"],
                cancel_requested=bool(row["cancel_requested"]),
                updated_at=row["updated_at"],
            )
        finally:
            conn.close()


def list_runs(
    owner_user_id: Optional[str] = None,
    limit: int = 20,
) -> List[StoredRun]:
    """List runs, most recent first. Optionally filter by owner_user_id."""
    with _LOCK:
        conn = _get_conn()
        try:
            if owner_user_id:
                cursor = conn.execute(
                    """
                    SELECT run_id, status, created_at, started_at, finished_at, exit_code,
                           display_command, owner_user_id, owner_user_email, log_file,
                           cancel_requested, updated_at
                    FROM runs
                    WHERE owner_user_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (owner_user_id, limit),
                )
            else:
                cursor = conn.execute(
                    """
                    SELECT run_id, status, created_at, started_at, finished_at, exit_code,
                           display_command, owner_user_id, owner_user_email, log_file,
                           cancel_requested, updated_at
                    FROM runs
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (limit,),
                )
            rows = cursor.fetchall()
            out: List[StoredRun] = []
            for row in rows:
                cmd = row["display_command"]
                if isinstance(cmd, str):
                    cmd = json.loads(cmd) if cmd else []
                out.append(
                    StoredRun(
                        run_id=row["run_id"],
                        status=row["status"],
                        created_at=row["created_at"],
                        started_at=row["started_at"],
                        finished_at=row["finished_at"],
                        exit_code=row["exit_code"],
                        display_command=cmd,
                        owner_user_id=row["owner_user_id"],
                        owner_user_email=row["owner_user_email"],
                        log_file=row["log_file"],
                        cancel_requested=bool(row["cancel_requested"]),
                        updated_at=row["updated_at"],
                    )
                )
            return out
        finally:
            conn.close()


def read_log_tail(log_file_path: str, tail: int) -> List[str]:
    """Read last `tail` lines from a run log file. Returns [] if file missing or unreadable."""
    path = Path(log_file_path)
    if not path.is_absolute():
        path = Path(__file__).resolve().parent / path
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        lines = [line.rstrip("\n") for line in lines]
        return lines[-tail:] if len(lines) > tail else lines
    except OSError:
        return []
