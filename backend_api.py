#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import base64
import json
import os
import queue
import re
import signal
import subprocess
import sys
import threading
import time
from collections import deque
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Deque, Dict, List, Literal, Optional, Union
from uuid import uuid4

import run_store
import candidature_store

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field


PROJECT_ROOT = Path(__file__).resolve().parent
PIPELINE_PATH = PROJECT_ROOT / "pipeline.py"
RUN_LOG_DIR = PROJECT_ROOT / "outputs" / "logs" / "api_runs"
RUN_LOG_DIR.mkdir(parents=True, exist_ok=True)
MAX_IN_MEMORY_LOG_LINES = 500
USER_ASSETS_DIR = PROJECT_ROOT / "data" / "user_assets"
UPLOAD_QUOTA_FILE = PROJECT_ROOT / "data" / "upload_quota.json"

# Upload guards: size (bytes), MIME allowlist, daily quota per user
MAX_CV_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_TEMPLATE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_CV_MIME_TYPES = frozenset({"application/pdf"})
ALLOWED_TEMPLATE_MIME_TYPES = frozenset({
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
})
UPLOAD_QUOTA_PER_USER_PER_DAY = 20
UPLOAD_QUOTA_LOCK = threading.Lock()

REDACTED_VALUE = "[REDACTED]"
SENSITIVE_CLI_FLAGS = {
    "--oauth-access-token",
    "--oauth-refresh-token",
    "--oauth-client-secret",
}
SENSITIVE_LOG_PATTERNS = [
    re.compile(r'("access_token"\s*:\s*")[^"]+(")', flags=re.IGNORECASE),
    re.compile(r'("refresh_token"\s*:\s*")[^"]+(")', flags=re.IGNORECASE),
    re.compile(r'("client_secret"\s*:\s*")[^"]+(")', flags=re.IGNORECASE),
    re.compile(r"(authorization\s*:\s*bearer\s+)(\S+)", flags=re.IGNORECASE),
    re.compile(r"(oauth_access_token\s*[=:]\s*)(\S+)", flags=re.IGNORECASE),
    re.compile(r"(oauth_refresh_token\s*[=:]\s*)(\S+)", flags=re.IGNORECASE),
    re.compile(r"(oauth_client_secret\s*[=:]\s*)(\S+)", flags=re.IGNORECASE),
    # API keys; never log or display
    re.compile(r"(sk-[a-zA-Z0-9_-]{20,})"),
]


def _is_production() -> bool:
    return os.getenv("ENV") == "production" or os.getenv("PRODUCTION", "").lower() in ("1", "true", "yes")


def _read_token_from_env_file(path: Path) -> Optional[str]:
    if not path.exists():
        return None
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() in {"PIPELINE_API_TOKEN", "API_TOKEN"}:
            cleaned = value.strip().strip('"').strip("'")
            if cleaned:
                return cleaned
    return None


if _is_production():
    API_TOKEN = (os.getenv("PIPELINE_API_TOKEN") or os.getenv("API_TOKEN") or "").strip()
    if not API_TOKEN:
        raise RuntimeError(
            "In production, API token must be set via environment: "
            "PIPELINE_API_TOKEN or API_TOKEN. Do not rely on .env files."
        )
else:
    API_TOKEN = (
        os.getenv("PIPELINE_API_TOKEN")
        or os.getenv("API_TOKEN")
        or _read_token_from_env_file(PROJECT_ROOT / ".env")
        or _read_token_from_env_file(PROJECT_ROOT / "web" / ".env.local")
        or ""
    ).strip()
    if not API_TOKEN:
        raise RuntimeError(
            "Missing API token. Set PIPELINE_API_TOKEN/API_TOKEN or define it in .env or web/.env.local."
        )


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def redact_command(command: List[str]) -> List[str]:
    redacted: List[str] = []
    idx = 0
    while idx < len(command):
        part = command[idx]
        if "=" in part:
            maybe_flag, value = part.split("=", 1)
            if maybe_flag in SENSITIVE_CLI_FLAGS and value:
                redacted.append(f"{maybe_flag}={REDACTED_VALUE}")
                idx += 1
                continue
        redacted.append(part)
        if part in SENSITIVE_CLI_FLAGS and idx + 1 < len(command):
            redacted.append(REDACTED_VALUE)
            idx += 2
            continue
        idx += 1
    return redacted


def extract_command_secrets(command: List[str]) -> List[str]:
    secrets: List[str] = []
    for idx, part in enumerate(command):
        if "=" in part:
            maybe_flag, value = part.split("=", 1)
            if maybe_flag in SENSITIVE_CLI_FLAGS and value:
                secrets.append(value)
            continue
        if part in SENSITIVE_CLI_FLAGS and idx + 1 < len(command):
            value = command[idx + 1]
            if value:
                secrets.append(value)
    return secrets


def sanitize_log_line(line: str, secrets: List[str]) -> str:
    masked = line
    for secret in secrets:
        if secret:
            masked = masked.replace(secret, REDACTED_VALUE)
    for pattern in SENSITIVE_LOG_PATTERNS:
        if pattern.groups == 1 and "sk-" in pattern.pattern:
            masked = pattern.sub(REDACTED_VALUE, masked)
        else:
            masked = pattern.sub(rf"\1{REDACTED_VALUE}\2", masked)
    return masked


class RunRequest(BaseModel):
    mode: Literal["pipeline", "hunter", "generate", "drafts"] = "pipeline"
    # Zone libre saisie depuis le dashboard (ex: "Paris", "Lyon, Marseille" ou "all").
    # On ne restreint plus la valeur ici : la logique d'interprétation se fait côté pipeline.
    zone: str = "all"
    dry_run: bool = False
    python: Optional[str] = None

    # hunter
    max_minutes: int = 30
    max_sites: int = 1500
    target_found: int = 100
    workers: int = 20
    focus: Literal["web", "it", "all"] = "web"
    sector: str = "it"
    specialty: str = ""
    enable_sitemap: bool = False
    insecure: bool = False
    rh_only: bool = False

    # generate (template: upload via web UI or pass explicit path)
    draft_file: str = "data/exports/draft_emails.txt"
    template: str = ""
    out_dir: str = "outputs/letters"
    sender_first_name: str = ""
    sender_last_name: str = ""
    sender_linkedin_url: str = ""
    sender_portfolio_url: str = ""
    mail_subject_template: str = ""
    mail_body_template: str = ""

    # drafts (cv: upload via web UI or pass explicit path)
    cv: str = ""
    lm_suffix: str = "docx"
    no_lm: bool = False
    lm: str = ""
    credentials: str = "secrets/credentials.json"
    token: str = "secrets/token.json"
    sleep: float = 0.3
    max: int = 999999
    console_auth: bool = False
    resume_log: str = "outputs/logs/drafts_created_log.csv"
    oauth_access_token: Optional[str] = None
    oauth_refresh_token: Optional[str] = None
    oauth_client_id: Optional[str] = None
    oauth_client_secret: Optional[str] = None
    oauth_token_uri: Optional[str] = None
    oauth_scope: Optional[str] = None
    oauth_access_token_expires_at: Optional[str] = None
    oauth_account_id: Optional[str] = None

    class Config:
        extra = "forbid"


class RunCreateResponse(BaseModel):
    run_id: str
    status: str


class RunStatusResponse(BaseModel):
    run_id: str
    status: str
    created_at: str
    started_at: Optional[str]
    finished_at: Optional[str]
    exit_code: Optional[int]
    command: List[str]
    pid: Optional[int]
    cancel_requested: bool
    owner_user_id: Optional[str]
    owner_user_email: Optional[str]
    log_file: str
    logs_tail: List[str]


@dataclass
class RunState:
    run_id: str
    command: List[str]
    display_command: List[str]
    log_file: Path
    redaction_secrets: List[str] = field(default_factory=list)
    status: str = "queued"
    created_at: str = field(default_factory=utc_now_iso)
    started_monotonic: Optional[float] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    exit_code: Optional[int] = None
    pid: Optional[int] = None
    cancel_requested: bool = False
    process: Optional[subprocess.Popen[str]] = None
    owner_user_id: Optional[str] = None
    owner_user_email: Optional[str] = None
    logs_tail: Deque[str] = field(
        default_factory=lambda: deque(maxlen=MAX_IN_MEMORY_LOG_LINES)
    )
    last_output_monotonic: float = field(default_factory=time.monotonic)

    def append_log(self, line: str) -> None:
        clean = sanitize_log_line(line.rstrip("\n"), self.redaction_secrets)
        self.logs_tail.append(clean)
        self.last_output_monotonic = time.monotonic()
        with self.log_file.open("a", encoding="utf-8") as fh:
            fh.write(clean + "\n")


@asynccontextmanager
async def _lifespan(app: FastAPI):
    """Start run-queue workers on startup; stop them gracefully on shutdown."""
    for _ in range(NUM_WORKERS):
        t = threading.Thread(target=_run_worker, daemon=False)
        t.start()
        _worker_threads.append(t)
    yield
    for _ in range(NUM_WORKERS):
        RUN_QUEUE.put(RUN_QUEUE_SENTINEL)
    for t in _worker_threads:
        t.join(timeout=10)
    _worker_threads.clear()


app = FastAPI(title="Alternance Pipeline API", version="1.0.0", lifespan=_lifespan)

RUNS: Dict[str, RunState] = {}
RUNS_LOCK = threading.Lock()

# Persistent run store (SQLite); init at startup so runs survive restarts
run_store.init_run_store(PROJECT_ROOT / "data" / "runs.db")
candidature_store.init_candidature_store(PROJECT_ROOT / "data" / "runs.db")

# Job queue + workers for asynchronous run execution
RUN_QUEUE: "queue.Queue[Optional[str]]" = queue.Queue()
RUN_QUEUE_SENTINEL: Optional[str] = None  # None = stop worker
def _default_api_run_workers() -> int:
    """Plusieurs runs en file : défaut lié au CPU, plafonné pour éviter la surcharge."""
    try:
        cpu = os.cpu_count() or 2
        return max(2, min(6, max(1, cpu // 2)))
    except Exception:
        return 2


NUM_WORKERS = max(1, min(8, int(os.getenv("RUN_WORKER_COUNT", str(_default_api_run_workers())))))
_worker_threads: List[threading.Thread] = []


def verify_token(
    authorization: Optional[str] = Header(default=None),
    x_api_token: Optional[str] = Header(default=None),
) -> None:
    supplied = None
    if x_api_token:
        supplied = x_api_token.strip()
    elif authorization and authorization.lower().startswith("bearer "):
        supplied = authorization[7:].strip()

    if supplied != API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API token.",
        )


def build_pipeline_command(
    payload: RunRequest,
    owner_user_id: Optional[str] = None,
    owner_user_email: Optional[str] = None,
) -> List[str]:
    cmd = [payload.python or sys.executable, "-u", str(PIPELINE_PATH)]
    cmd += ["--mode", payload.mode, "--zone", payload.zone]
    user_key = sanitize_user_key(owner_user_id, owner_user_email)
    user_cv, user_template = resolve_user_assets(user_key)
    template_path = (payload.template or user_template or "").strip()
    cv_path = (payload.cv or user_cv or "").strip()
    if user_key:
        cmd += ["--user-key", user_key]
    cmd += ["--max-minutes", str(payload.max_minutes)]
    cmd += ["--max-sites", str(payload.max_sites)]
    cmd += ["--target-found", str(payload.target_found)]
    cmd += ["--workers", str(payload.workers)]
    cmd += ["--focus", payload.focus]
    cmd += ["--sector", payload.sector]
    cmd += ["--specialty", payload.specialty or ""]
    cmd += ["--draft-file", payload.draft_file]
    cmd += ["--template", template_path]
    cmd += ["--out-dir", payload.out_dir]
    if payload.sender_first_name:
        cmd += ["--sender-first-name", payload.sender_first_name]
    if payload.sender_last_name:
        cmd += ["--sender-last-name", payload.sender_last_name]
    if payload.sender_linkedin_url:
        cmd += ["--sender-linkedin-url", payload.sender_linkedin_url]
    if payload.sender_portfolio_url:
        cmd += ["--sender-portfolio-url", payload.sender_portfolio_url]
    if payload.mail_subject_template:
        cmd += ["--mail-subject-template", payload.mail_subject_template]
    if payload.mail_body_template:
        cmd += ["--mail-body-template", payload.mail_body_template]
    cmd += ["--cv", cv_path]
    cmd += ["--lm-suffix", payload.lm_suffix]
    if payload.oauth_access_token:
        cmd += ["--oauth-access-token", payload.oauth_access_token]
        if payload.oauth_refresh_token:
            cmd += ["--oauth-refresh-token", payload.oauth_refresh_token]
        if payload.oauth_client_id:
            cmd += ["--oauth-client-id", payload.oauth_client_id]
        if payload.oauth_client_secret:
            cmd += ["--oauth-client-secret", payload.oauth_client_secret]
        if payload.oauth_token_uri:
            cmd += ["--oauth-token-uri", payload.oauth_token_uri]
        if payload.oauth_scope:
            cmd += ["--oauth-scope", payload.oauth_scope]
        if payload.oauth_access_token_expires_at:
            cmd += ["--oauth-access-token-expires-at", payload.oauth_access_token_expires_at]
        if payload.oauth_account_id:
            cmd += ["--oauth-account-id", payload.oauth_account_id]
    else:
        cmd += ["--credentials", payload.credentials]
        cmd += ["--token", payload.token]
    cmd += ["--sleep", str(payload.sleep)]
    cmd += ["--max", str(payload.max)]
    cmd += ["--resume-log", payload.resume_log]

    if payload.dry_run:
        cmd.append("--dry-run")
    if payload.enable_sitemap:
        cmd.append("--enable-sitemap")
    if payload.insecure:
        cmd.append("--insecure")
    if payload.rh_only:
        cmd.append("--rh-only")
    if payload.no_lm:
        cmd.append("--no-lm")
    if payload.lm:
        cmd += ["--lm", payload.lm]
    if payload.console_auth:
        cmd.append("--console-auth")
    return cmd


def kill_process_tree(pid: int) -> None:
    if sys.platform.startswith("win"):
        subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return

    try:
        os.killpg(pid, signal.SIGTERM)
    except ProcessLookupError:
        return


def run_in_background(run_id: str) -> None:
    with RUNS_LOCK:
        run = RUNS[run_id]
        run.status = "running"
        run.started_at = utc_now_iso()
        run.started_monotonic = time.monotonic()
    try:
        run_store.update_run_status(
            run_id, "running", started_at=run.started_at
        )
    except (ValueError, KeyError):
        pass  # already terminal or not in store

    # Avoid leaking sensitive CLI arguments (OAuth tokens/secrets) into run logs.
    run.append_log(f"[{utc_now_iso()}] Starting run.")

    env = {**os.environ, "PYTHONUNBUFFERED": "1"}
    popen_kwargs = {
        "cwd": str(PROJECT_ROOT),
        "stdout": subprocess.PIPE,
        "stderr": subprocess.STDOUT,
        "text": True,
        "bufsize": 1,
        "env": env,
    }
    if sys.platform.startswith("win"):
        popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        popen_kwargs["start_new_session"] = True

    process = subprocess.Popen(run.command, **popen_kwargs)
    with RUNS_LOCK:
        run.process = process
        run.pid = process.pid

    def heartbeat_worker() -> None:
        while True:
            time.sleep(15)
            with RUNS_LOCK:
                current = RUNS.get(run_id)
                if current is None or current.status != "running":
                    return
                silence = time.monotonic() - current.last_output_monotonic
                started_mono = current.started_monotonic
                pid = current.pid

            if silence < 15:
                continue
            elapsed = int(time.monotonic() - (started_mono or time.monotonic()))
            run.append_log(
                f"[{utc_now_iso()}] Still running... {elapsed}s elapsed (pid={pid}). Waiting for next output."
            )

    threading.Thread(target=heartbeat_worker, daemon=True).start()

    if process.stdout:
        for line in process.stdout:
            run.append_log(line)

    exit_code = process.wait()
    with RUNS_LOCK:
        run.exit_code = int(exit_code)
        run.finished_at = utc_now_iso()
        if run.cancel_requested:
            run.status = "cancelled"
        elif exit_code == 0:
            run.status = "succeeded"
        else:
            run.status = "failed"
        run.process = None
        run.pid = None

    try:
        run_store.update_run_status(
            run_id,
            run.status,
            finished_at=run.finished_at,
            exit_code=run.exit_code,
        )
    except (ValueError, KeyError):
        pass

    run.append_log(f"[{utc_now_iso()}] Run finished with exit code {exit_code}.")


def _run_worker() -> None:
    """Worker thread: consume run_id from queue and execute run_in_background, or stop on sentinel."""
    while True:
        run_id = RUN_QUEUE.get()
        if run_id is RUN_QUEUE_SENTINEL:
            RUN_QUEUE.task_done()
            return
        try:
            with RUNS_LOCK:
                run = RUNS.get(run_id)
            if run is None:
                RUN_QUEUE.task_done()
                continue
            if run.status != "queued":
                RUN_QUEUE.task_done()
                continue
            if run.cancel_requested:
                run.status = "cancelled"
                run.finished_at = utc_now_iso()
                run.append_log(f"[{utc_now_iso()}] Run cancelled before start.")
                try:
                    run_store.update_run_status(
                        run_id, "cancelled", finished_at=run.finished_at
                    )
                except (ValueError, KeyError):
                    pass
                RUN_QUEUE.task_done()
                continue
            run_in_background(run_id)
        finally:
            RUN_QUEUE.task_done()


def enqueue_run(run_id: str) -> None:
    """Enqueue a run for execution by a worker. Run must already be in RUNS with status 'queued'."""
    RUN_QUEUE.put(run_id)


def get_run_or_404(run_id: str) -> Union[RunState, run_store.StoredRun]:
    """Return live RunState if in memory, else StoredRun from DB. 404 if not found."""
    with RUNS_LOCK:
        run = RUNS.get(run_id)
        if run is not None:
            return run
    stored = run_store.get_run_by_id(run_id)
    if stored is not None:
        return stored
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Run '{run_id}' not found.",
    )


def normalize_user_identifier(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def sanitize_user_key(user_id: Optional[str], user_email: Optional[str]) -> Optional[str]:
    source = normalize_user_identifier(user_id) or normalize_user_identifier(user_email)
    if not source:
        return None
    lowered = source.lower()
    cleaned = re.sub(r"[^a-z0-9._-]+", "-", lowered).strip("-._")
    return cleaned[:80] or "anonymous"


def resolve_user_assets(user_key: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if not user_key:
        return None, None
    base_dir = USER_ASSETS_DIR / user_key
    if not base_dir.exists():
        return None, None

    cv_path: Optional[str] = None
    template_path: Optional[str] = None

    for candidate in sorted(base_dir.glob("cv.*")):
        if candidate.is_file():
            cv_path = str(candidate.relative_to(PROJECT_ROOT))
            break
    for candidate in sorted(base_dir.glob("template_lm.*")):
        if candidate.is_file():
            template_path = str(candidate.relative_to(PROJECT_ROOT))
            break

    return cv_path, template_path


def _upload_quota_today() -> Dict[str, Dict[str, int]]:
    """Load quota file: { "YYYY-MM-DD": { "user_key": count } }."""
    if not UPLOAD_QUOTA_FILE.exists():
        return {}
    try:
        data = json.loads(UPLOAD_QUOTA_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def _upload_quota_check_and_inc(user_key: str) -> None:
    """Raise HTTP 429 if user has exceeded daily upload quota; otherwise increment."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with UPLOAD_QUOTA_LOCK:
        data = _upload_quota_today()
        day_data = data.setdefault(today, {})
        count = day_data.get(user_key, 0)
        if count >= UPLOAD_QUOTA_PER_USER_PER_DAY:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Quota upload atteint ({UPLOAD_QUOTA_PER_USER_PER_DAY} par jour). Reessayez demain.",
            )
        day_data[user_key] = count + 1
        UPLOAD_QUOTA_FILE.parent.mkdir(parents=True, exist_ok=True)
        UPLOAD_QUOTA_FILE.write_text(json.dumps(data, indent=0), encoding="utf-8")


async def _read_upload_with_size_limit(
    file: UploadFile, max_bytes: int, label: str
) -> bytes:
    """Read file in chunks; raise HTTP 400 if size exceeds max_bytes."""
    chunk_size = 256 * 1024  # 256 KB
    buf = b""
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        buf += chunk
        if len(buf) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{label} trop volumineux (max {max_bytes // (1024*1024)} Mo).",
            )
    return buf


def _check_mime_or_extension(
    content_type: Optional[str],
    allowed_mimes: frozenset[str],
    allowed_suffixes: set[str],
    filename: str,
    label: str,
) -> None:
    """Raise HTTP 400 if content_type (when set) or file extension is not allowed."""
    suffix = (Path((filename or "").lower()).suffix or "").lower()
    if content_type and content_type.split(";")[0].strip().lower() not in allowed_mimes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label}: type MIME non autorise. Types acceptes: {', '.join(sorted(allowed_mimes))}.",
        )
    if suffix not in allowed_suffixes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label}: extension non autorisee. Extensions acceptees: {', '.join(sorted(allowed_suffixes))}.",
        )


def assert_run_access(
    run: Union[RunState, run_store.StoredRun], actor_user_id: Optional[str]
) -> None:
    if not run.owner_user_id:
        return
    if not actor_user_id or actor_user_id != run.owner_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden. This run belongs to another user.",
        )


@app.get("/")
def root() -> dict:
    """Répond 200 pour les health checks (ex. Render) qui interrogent la racine."""
    return {"status": "ok", "service": "alternance-pipeline-api"}


@app.get("/healthz")
def healthcheck() -> dict:
    return {"ok": True}


@app.post(
    "/runs",
    response_model=RunCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(verify_token)],
)
def create_run(
    payload: RunRequest,
    x_run_user_id: Optional[str] = Header(default=None),
    x_run_user_email: Optional[str] = Header(default=None),
) -> RunCreateResponse:
    owner_user_id = normalize_user_identifier(x_run_user_id)
    owner_user_email = normalize_user_identifier(x_run_user_email)
    user_key = sanitize_user_key(owner_user_id, owner_user_email)
    user_cv, user_template = resolve_user_assets(user_key)
    template_path = (payload.template or user_template or "").strip()
    cv_path = (payload.cv or user_cv or "").strip()

    if payload.mode in ("pipeline", "generate") and not template_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Template LM requis. Uploadez un template (.docx) depuis l'onglet « Vos documents ».",
        )
    if payload.mode in ("pipeline", "drafts") and not payload.no_lm and not cv_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CV requis pour créer les brouillons. Uploadez un CV (PDF) depuis l'onglet « Vos documents ».",
        )

    run_id = uuid4().hex
    command = build_pipeline_command(payload, owner_user_id, owner_user_email)
    log_file = RUN_LOG_DIR / f"{run_id}.log"

    display_command = redact_command(command)
    run_store.insert_run(
        run_id=run_id,
        status="queued",
        created_at=utc_now_iso(),
        display_command=display_command,
        log_file=str(log_file),
        owner_user_id=owner_user_id,
        owner_user_email=owner_user_email,
    )

    run = RunState(
        run_id=run_id,
        command=command,
        display_command=display_command,
        log_file=log_file,
        redaction_secrets=extract_command_secrets(command),
        owner_user_id=owner_user_id,
        owner_user_email=owner_user_email,
    )

    with RUNS_LOCK:
        RUNS[run_id] = run

    enqueue_run(run_id)

    return RunCreateResponse(run_id=run_id, status="queued")


@app.post("/uploads", dependencies=[Depends(verify_token)])
async def upload_user_assets(
    cv: Optional[UploadFile] = File(default=None),
    template: Optional[UploadFile] = File(default=None),
    x_run_user_id: Optional[str] = Header(default=None),
    x_run_user_email: Optional[str] = Header(default=None),
) -> dict:
    user_key = sanitize_user_key(x_run_user_id, x_run_user_email)
    if not user_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing user identity headers for upload.",
        )
    if cv is None and template is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided. Upload cv and/or template.",
        )

    _upload_quota_check_and_inc(user_key)

    target_dir = USER_ASSETS_DIR / user_key
    target_dir.mkdir(parents=True, exist_ok=True)
    uploaded: dict[str, str] = {}

    if cv is not None:
        _check_mime_or_extension(
            cv.content_type,
            ALLOWED_CV_MIME_TYPES,
            {".pdf"},
            cv.filename or "",
            "CV",
        )
        cv_suffix = Path((cv.filename or "").lower()).suffix or ".pdf"
        cv_path = target_dir / f"cv{cv_suffix}"
        content = await _read_upload_with_size_limit(cv, MAX_CV_SIZE_BYTES, "CV")
        cv_path.write_bytes(content)
        uploaded["cv"] = str(cv_path.relative_to(PROJECT_ROOT))

    if template is not None:
        _check_mime_or_extension(
            template.content_type,
            ALLOWED_TEMPLATE_MIME_TYPES,
            {".docx", ".doc"},
            template.filename or "",
            "Template LM",
        )
        template_suffix = Path((template.filename or "").lower()).suffix or ".docx"
        template_path = target_dir / f"template_lm{template_suffix}"
        content = await _read_upload_with_size_limit(
            template, MAX_TEMPLATE_SIZE_BYTES, "Template LM"
        )
        template_path.write_bytes(content)
        uploaded["template"] = str(template_path.relative_to(PROJECT_ROOT))

    return {"ok": True, "user_key": user_key, "uploaded": uploaded}


@app.get("/uploads/status", dependencies=[Depends(verify_token)])
def get_upload_status(
    x_run_user_id: Optional[str] = Header(default=None),
    x_run_user_email: Optional[str] = Header(default=None),
) -> dict:
    user_key = sanitize_user_key(x_run_user_id, x_run_user_email)
    if not user_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing user identity headers.",
        )

    target_dir = USER_ASSETS_DIR / user_key
    cv_path, template_path = resolve_user_assets(user_key)

    # Presence d'un draft_emails.txt pour ce compte
    user_exports_dir = PROJECT_ROOT / "data" / "exports" / "users" / user_key
    draft_path_obj = user_exports_dir / "draft_emails.txt"
    draft_path: Optional[str] = None
    if draft_path_obj.exists():
        draft_path = str(draft_path_obj.relative_to(PROJECT_ROOT))

    return {
        "ok": True,
        "user_key": user_key,
        "assets_dir_exists": target_dir.exists(),
        "cv_uploaded": bool(cv_path),
        "template_uploaded": bool(template_path),
        "cv_path": cv_path,
        "template_path": template_path,
        "draft_uploaded": bool(draft_path),
        "draft_path": draft_path,
    }


@app.get(
    "/runs/{run_id}",
    response_model=RunStatusResponse,
    dependencies=[Depends(verify_token)],
)
def get_run_status(
    run_id: str,
    tail: int = Query(default=200, ge=1, le=2000),
    x_run_user_id: Optional[str] = Header(default=None),
) -> RunStatusResponse:
    actor_user_id = normalize_user_identifier(x_run_user_id)
    run = get_run_or_404(run_id)
    assert_run_access(run, actor_user_id)
    if isinstance(run, RunState):
        logs = list(run.logs_tail)[-tail:]
        log_file_str = str(run.log_file)
        pid = run.pid
    else:
        logs = run_store.read_log_tail(run.log_file, tail)
        log_file_str = run.log_file
        pid = getattr(run, "pid", None)
    return RunStatusResponse(
        run_id=run.run_id,
        status=run.status,
        created_at=run.created_at,
        started_at=run.started_at,
        finished_at=run.finished_at,
        exit_code=run.exit_code,
        command=run.display_command,
        pid=pid,
        cancel_requested=run.cancel_requested,
        owner_user_id=run.owner_user_id,
        owner_user_email=run.owner_user_email,
        log_file=log_file_str,
        logs_tail=logs,
    )


@app.post(
    "/runs/{run_id}/cancel",
    dependencies=[Depends(verify_token)],
)
def cancel_run(
    run_id: str,
    x_run_user_id: Optional[str] = Header(default=None),
) -> dict:
    actor_user_id = normalize_user_identifier(x_run_user_id)
    run = get_run_or_404(run_id)
    assert_run_access(run, actor_user_id)
    if run.status in {"succeeded", "failed", "cancelled"}:
        return {"run_id": run_id, "status": run.status, "message": "Run already ended."}

    try:
        run_store.set_cancel_requested(run_id)
    except KeyError:
        pass

    if isinstance(run, RunState):
        with RUNS_LOCK:
            run.cancel_requested = True
            process = run.process
        if process and process.pid:
            kill_process_tree(process.pid)
            run.append_log(f"[{utc_now_iso()}] Cancellation requested.")
            return {"run_id": run_id, "status": "cancelling"}
        return {"run_id": run_id, "status": run.status, "message": "Run not started yet."}

    # Persisted-only run (no live process): DB already updated to cancelling if was running
    return {"run_id": run_id, "status": "cancelling"}


def _serialize_run_for_list(
    run: Union[RunState, run_store.StoredRun],
) -> dict:
    """Build list-run dict from either live RunState or StoredRun."""
    log_file = str(run.log_file) if hasattr(run.log_file, "__fspath__") else run.log_file
    return {
        "run_id": run.run_id,
        "status": run.status,
        "created_at": run.created_at,
        "started_at": run.started_at,
        "finished_at": run.finished_at,
        "exit_code": run.exit_code,
        "pid": getattr(run, "pid", None),
        "cancel_requested": run.cancel_requested,
        "owner_user_id": run.owner_user_id,
        "owner_user_email": run.owner_user_email,
        "log_file": log_file,
    }


@app.get("/runs", dependencies=[Depends(verify_token)])
def list_runs(
    limit: int = Query(default=20, ge=1, le=200),
    x_run_user_id: Optional[str] = Header(default=None),
) -> dict:
    actor_user_id = normalize_user_identifier(x_run_user_id)
    stored_list = run_store.list_runs(owner_user_id=actor_user_id, limit=limit)
    serialized = []
    with RUNS_LOCK:
        runs_snapshot = dict(RUNS)
    for stored in stored_list:
        live = runs_snapshot.get(stored.run_id)
        run = live if live is not None else stored
        serialized.append(_serialize_run_for_list(run))
    return {"runs": serialized}


# ---------------------------------------------------------------------------
# Candidatures & analytics (Phase 4 product)
# ---------------------------------------------------------------------------

def _get_user_key_from_headers(
    x_run_user_id: Optional[str] = Header(default=None),
    x_run_user_email: Optional[str] = Header(default=None),
) -> Optional[str]:
    uid = normalize_user_identifier(x_run_user_id)
    uem = normalize_user_identifier(x_run_user_email)
    return sanitize_user_key(uid, uem)


class CandidatureCreate(BaseModel):
    company: str
    email: str
    status: str = "draft_created"
    run_id: Optional[str] = None
    draft_id: Optional[str] = None

    class Config:
        extra = "forbid"


class CandidatureUpdateStatus(BaseModel):
    status: str

    class Config:
        extra = "forbid"


class CandidatureSyncBody(BaseModel):
    run_id: Optional[str] = None
    oauth_access_token: Optional[str] = None
    oauth_refresh_token: Optional[str] = None
    oauth_client_id: Optional[str] = None
    oauth_client_secret: Optional[str] = None
    oauth_token_uri: Optional[str] = None
    oauth_scope: Optional[str] = None
    oauth_access_token_expires_at: Optional[str] = None
    oauth_account_id: Optional[str] = None

    class Config:
        extra = "forbid"


class CandidatureAnalyzeInboxBody(BaseModel):
    """Same OAuth fields as sync, for Gmail inbox read."""
    oauth_access_token: Optional[str] = None
    oauth_refresh_token: Optional[str] = None
    oauth_client_id: Optional[str] = None
    oauth_client_secret: Optional[str] = None
    oauth_token_uri: Optional[str] = None
    oauth_scope: Optional[str] = None
    oauth_access_token_expires_at: Optional[str] = None
    oauth_account_id: Optional[str] = None

    class Config:
        extra = "forbid"


class QuickDraftBody(BaseModel):
    """Body for POST /recruiting/quick-draft — create a single Gmail draft for one company."""
    company_name: str
    contact_email: str
    # Sender info (from user profile)
    sender_first_name: str = ""
    sender_last_name: str = ""
    sender_linkedin_url: str = ""
    sender_portfolio_url: str = ""
    # Email content templates (placeholders: {ENTREPRISE}, {DATE})
    mail_subject_template: str = ""
    mail_body_template: str = ""
    # OAuth tokens for Gmail
    oauth_access_token: str
    oauth_refresh_token: Optional[str] = None
    oauth_client_id: Optional[str] = None
    oauth_client_secret: Optional[str] = None
    oauth_token_uri: Optional[str] = None
    oauth_scope: Optional[str] = None
    oauth_access_token_expires_at: Optional[str] = None

    class Config:
        extra = "forbid"


def _classify_reply_sentiment(text: str) -> Optional[str]:
    """Classify email body as reponse_positive, reponse_negative, or None (unknown).
    Uses French keywords typical of recruitment replies."""
    if not (text or "").strip():
        return None
    t = text.lower().strip()
    negative_phrases = [
        "refus", "ne retenons pas", "non retenue", "non retenu", "malheureusement",
        "pas retenu", "candidature non retenue", "ne pouvons pas", "ne sera pas",
        "n'avons pas retenu", "n’avons pas retenu", "candidature non acceptée",
        "ne correspond pas", "pas retenue", "décline", "décliner",
    ]
    positive_phrases = [
        "entretien", "convocation", "retenons", "favorable", "acceptée", "accepté",
        "bien reçu", "étudier votre candidature", "vous convier", "rendez-vous",
        "candidature retenue", "vous invitons", "candidature a retenu notre attention",
        "prochaine étape", "vous contacterons", "vous recontacterons",
    ]
    for phrase in negative_phrases:
        if phrase in t:
            return "reponse_negative"
    for phrase in positive_phrases:
        if phrase in t:
            return "reponse_positive"
    return None


def _extract_sender_email_from_header(from_header: str) -> str:
    """Extract first email address from From header (e.g. 'Name <a@b.com>' or 'a@b.com')."""
    email_re = re.compile(r"[A-Za-z0-9._%+\-']+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
    if not from_header:
        return ""
    m = email_re.search(from_header)
    if m:
        return m.group(0).lower().strip()
    for token in from_header.replace(",", " ").split():
        m = email_re.search(token)
        if m:
            return m.group(0).lower().strip()
    return ""


def _analyze_inbox_from_gmail(
    body: CandidatureAnalyzeInboxBody,
    user_key: str,
) -> tuple[dict, Optional[str]]:
    """List INBOX messages, match to candidatures by sender email, classify and update. Returns (stats, error)."""
    at = (body.oauth_access_token or "").strip()
    if not at:
        return {"analyzed": 0, "updated": 0, "positive": 0, "negative": 0}, None
    try:
        from create_gmail_drafts import get_gmail_service_from_oauth_tokens
    except ImportError as e:
        return {"analyzed": 0, "updated": 0, "positive": 0, "negative": 0}, f"Module Gmail: {e}"
    try:
        service = get_gmail_service_from_oauth_tokens(
            access_token=at,
            refresh_token=(body.oauth_refresh_token or "").strip(),
            client_id=(body.oauth_client_id or "").strip(),
            client_secret=(body.oauth_client_secret or "").strip(),
            token_uri=(body.oauth_token_uri or "https://oauth2.googleapis.com/token").strip(),
            scope=(body.oauth_scope or "https://www.googleapis.com/auth/gmail.readonly").strip(),
            access_token_expires_at=(body.oauth_access_token_expires_at or "").strip(),
        )
    except Exception as e:
        return {"analyzed": 0, "updated": 0, "positive": 0, "negative": 0}, f"Connexion Gmail: {e!s}"

    try:
        from googleapiclient.errors import HttpError
    except ImportError:
        HttpError = Exception  # type: ignore[misc, assignment]

    analyzed = 0
    updated = 0
    positive = 0
    negative = 0
    seen_candidature_ids: set = set()  # avoid updating same candidature twice (multiple emails from same sender)
    max_messages = 150
    page_token: Optional[str] = None

    try:
        while max_messages > 0:
            list_params: Dict[str, Union[str, int]] = {
                "userId": "me",
                "labelIds": ["INBOX"],
                "maxResults": min(50, max_messages),
            }
            if page_token:
                list_params["pageToken"] = page_token
            result = service.users().messages().list(**list_params).execute()
            messages = result.get("messages") or []
            if not messages:
                break
            for msg_ref in messages:
                if max_messages <= 0:
                    break
                max_messages -= 1
                msg_id = msg_ref.get("id")
                if not msg_id:
                    continue
                try:
                    msg = service.users().messages().get(userId="me", id=msg_id, format="full").execute()
                    payload = msg.get("payload") or {}
                    from_header = _get_header(msg, "From")
                    sender_email = _extract_sender_email_from_header(from_header)
                    if not sender_email:
                        continue
                    body_text = _get_message_body_text(payload)
                    if not body_text and msg.get("snippet"):
                        body_text = (msg.get("snippet") or "").strip()
                    analyzed += 1
                    cand = candidature_store.get_candidature_by_contact_email(user_key, sender_email)
                    if not cand or cand.id in seen_candidature_ids:
                        continue
                    if cand.status not in ("sent", "relance"):
                        continue
                    sentiment = _classify_reply_sentiment(body_text)
                    if not sentiment:
                        continue
                    seen_candidature_ids.add(cand.id)
                    candidature_store.update_candidature_status(cand.id, user_key, sentiment)
                    updated += 1
                    if sentiment == "reponse_positive":
                        positive += 1
                    else:
                        negative += 1
                except Exception:
                    continue
            page_token = result.get("nextPageToken")
            if not page_token:
                break
        return (
            {"analyzed": analyzed, "updated": updated, "positive": positive, "negative": negative},
            None,
        )
    except HttpError as e:
        err_msg = "Permissions Gmail insuffisantes."
        is_403 = getattr(e, "resp", None) and getattr(e.resp, "status", None) == 403
        if is_403:
            err_msg = (
                "Autorisations Gmail insuffisantes. Déconnectez puis reconnectez votre compte Google "
                "et acceptez toutes les autorisations demandées (notamment « Voir vos e-mails »)."
            )
        if not is_403:
            try:
                err_content = getattr(e, "content", b"")
                if err_content:
                    err_data = json.loads(err_content.decode("utf-8", errors="replace"))
                    err_inner = (err_data.get("error") or {}).get("message", err_msg)
                    if err_inner:
                        err_msg = err_inner
            except Exception:
                pass
        return {"analyzed": 0, "updated": 0, "positive": 0, "negative": 0}, err_msg
    except Exception as e:
        return {"analyzed": 0, "updated": 0, "positive": 0, "negative": 0}, f"Erreur: {e!s}"


@app.get("/analytics", dependencies=[Depends(verify_token)])
def get_analytics(
    x_run_user_id: Optional[str] = Header(default=None),
    x_run_user_email: Optional[str] = Header(default=None),
) -> dict:
    """Product analytics: taux drafts créés, taux contacts valides, conversion réponse."""
    user_key = _get_user_key_from_headers(x_run_user_id, x_run_user_email)
    if not user_key:
        return {
            "total_targets": 0,
            "contacts_valides": 0,
            "taux_contacts_valides": 0.0,
            "drafts_crees": 0,
            "taux_drafts_crees": 0.0,
            "candidatures_sent": 0,
            "reponses_positives": 0,
            "reponses_negatives": 0,
            "taux_conversion_reponse": 0.0,
        }
    total_targets = 0
    contacts_valides = 0
    companies_data: List[dict] = []
    product_path = PROJECT_ROOT / "data" / "exports" / "users" / user_key / "product_companies.json"
    if product_path.exists():
        try:
            data = json.loads(product_path.read_text(encoding="utf-8"))
            companies_data = data.get("companies") or []
        except (json.JSONDecodeError, OSError):
            pass
    for c in companies_data:
        total_targets += 1
        if (c.get("status") or "").strip().upper() == "FOUND":
            contacts_valides += 1
    taux_contacts = (contacts_valides / total_targets * 100) if total_targets else 0.0

    drafts_crees = 0
    draft_log_path = PROJECT_ROOT / "outputs" / "logs" / user_key / "drafts_created_log.csv"
    if draft_log_path.exists():
        try:
            import csv
            with draft_log_path.open("r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if (row.get("status") or "").strip().upper() == "OK":
                        drafts_crees += 1
        except (OSError, Exception):
            pass
    taux_drafts = (drafts_crees / contacts_valides * 100) if contacts_valides else 0.0

    all_cand = candidature_store.list_candidatures(user_key, status_filter=None, limit=2000)
    candidatures_sent = sum(1 for c in all_cand if c.status in ("sent", "relance", "reponse_positive", "reponse_negative", "no_reponse"))
    reponses_positives = sum(1 for c in all_cand if c.status == "reponse_positive")
    reponses_negatives = sum(1 for c in all_cand if c.status == "reponse_negative")
    taux_conversion = (reponses_positives / candidatures_sent * 100) if candidatures_sent else 0.0

    return {
        "total_targets": total_targets,
        "contacts_valides": contacts_valides,
        "taux_contacts_valides": round(taux_contacts, 1),
        "drafts_crees": drafts_crees,
        "taux_drafts_crees": round(taux_drafts, 1),
        "candidatures_sent": candidatures_sent,
        "reponses_positives": reponses_positives,
        "reponses_negatives": reponses_negatives,
        "taux_conversion_reponse": round(taux_conversion, 1),
    }


# ---------------------------------------------------------------------------
# Recruiting database (companies/jobs/contacts)
# ---------------------------------------------------------------------------

@app.get("/recruiting/companies", dependencies=[Depends(verify_token)])
def recruiting_search_companies_api(
    q: Optional[str] = Query(default=None),
    sector: Optional[str] = Query(default=None),
    zone: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=10000),
) -> dict:
    """Search the shared company database with optional filters."""
    try:
        from recruiting_db import RecruitingDB

        db = RecruitingDB()
        result = db.search_companies(q=q or None, sector=sector or None, zone=zone or None, limit=limit, offset=offset)
        return result
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Postgres error: {e!s}")


@app.get("/recruiting/companies/{domain}/jobs", dependencies=[Depends(verify_token)])
def recruiting_list_company_jobs_api(
    domain: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=5000),
) -> dict:
    """List job posts for one company domain (shared DB)."""
    try:
        from recruiting_db import RecruitingDB

        db = RecruitingDB()
        jobs = db.list_job_posts_by_company_domain(domain=domain, limit=limit, offset=offset)
        return {"jobs": jobs}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Postgres error: {e!s}")


@app.get("/recruiting/companies/{domain}/contacts", dependencies=[Depends(verify_token)])
def recruiting_list_company_contacts_api(
    domain: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0, le=5000),
) -> dict:
    """List contacts (RH/support) for one company domain (shared DB)."""
    try:
        from recruiting_db import RecruitingDB

        db = RecruitingDB()
        contacts = db.list_contacts_by_company_domain(domain=domain, limit=limit, offset=offset)
        return {"contacts": contacts}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Postgres error: {e!s}")


@app.post("/recruiting/quick-draft", dependencies=[Depends(verify_token)], status_code=status.HTTP_201_CREATED)
def recruiting_quick_draft(
    body: QuickDraftBody,
    x_run_user_id: Optional[str] = Header(default=None),
    x_run_user_email: Optional[str] = Header(default=None),
) -> dict:
    """
    Create a single Gmail draft for one company contact, using the user's uploaded CV and template.
    Records the candidature automatically.
    """
    user_key = _get_user_key_from_headers(x_run_user_id, x_run_user_email)
    if not user_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User key required.")

    # Resolve CV file (attachment)
    cv_path_str, _ = resolve_user_assets(user_key)
    cv_path = (PROJECT_ROOT / cv_path_str) if cv_path_str else None

    # Build email content from templates
    try:
        from create_gmail_drafts import replace_draft_placeholders, get_gmail_service_from_oauth_tokens, make_message, create_draft
    except ImportError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Module Gmail manquant: {e}")

    # Subject
    default_subject = f"Candidature alternance — {body.company_name}"
    subject_tpl = (body.mail_subject_template or "").strip() or default_subject
    subject = replace_draft_placeholders(subject_tpl, body.company_name)

    # Body
    full_name = f"{body.sender_first_name} {body.sender_last_name}".strip()
    linkedin_line = f"\nLinkedIn : {body.sender_linkedin_url}" if body.sender_linkedin_url else ""
    portfolio_line = f"\nPortfolio : {body.sender_portfolio_url}" if body.sender_portfolio_url else ""
    default_body = (
        f"Bonjour,\n\nJe me permets de vous contacter dans le cadre de ma recherche d'alternance.\n"
        f"Je suis très intéressé(e) par une opportunité au sein de {body.company_name}.\n\n"
        f"Cordialement,\n{full_name}{linkedin_line}{portfolio_line}"
    )
    body_tpl = (body.mail_body_template or "").strip() or default_body
    # Replace {NOM_COMPLET} if present
    body_tpl = body_tpl.replace("{NOM_COMPLET}", full_name).replace("{{NOM_COMPLET}}", full_name)
    if body.sender_linkedin_url:
        body_tpl = body_tpl.replace("{LINKEDIN}", body.sender_linkedin_url).replace("{{LINKEDIN}}", body.sender_linkedin_url)
    if body.sender_portfolio_url:
        body_tpl = body_tpl.replace("{PORTFOLIO}", body.sender_portfolio_url).replace("{{PORTFOLIO}}", body.sender_portfolio_url)
    email_body = replace_draft_placeholders(body_tpl, body.company_name)

    # Build Gmail service
    try:
        service = get_gmail_service_from_oauth_tokens(
            access_token=body.oauth_access_token,
            refresh_token=(body.oauth_refresh_token or "").strip(),
            client_id=(body.oauth_client_id or "").strip(),
            client_secret=(body.oauth_client_secret or "").strip(),
            token_uri=(body.oauth_token_uri or "https://oauth2.googleapis.com/token").strip(),
            scope=(body.oauth_scope or "https://www.googleapis.com/auth/gmail.compose").strip(),
            access_token_expires_at=(body.oauth_access_token_expires_at or "").strip(),
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Connexion Gmail échouée: {e!s}")

    # Prepare attachments
    attachments = []
    if cv_path and cv_path.exists():
        attachments.append(cv_path)

    # Create the draft
    try:
        attachment_cache: dict = {}
        draft_body = make_message(
            to_email=body.contact_email,
            subject=subject,
            body=email_body,
            attachments=attachments,
            attachment_cache=attachment_cache,
        )
        draft_result = create_draft(service, draft_body)
        draft_id = draft_result.get("id") or ""
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Erreur création brouillon Gmail: {e!s}")

    # Record the candidature
    cand = candidature_store.insert_candidature(
        user_key=user_key,
        company=body.company_name,
        email=body.contact_email,
        status="draft_created",
        run_id=None,
        draft_id=draft_id,
    )

    return {"ok": True, "draft_id": draft_id, "candidature_id": cand.id}


@app.get("/candidatures/counts", dependencies=[Depends(verify_token)])
def get_candidature_counts_api(
    x_run_user_id: Optional[str] = Header(default=None),
    x_run_user_email: Optional[str] = Header(default=None),
) -> dict:
    """Return counts per status (draft_created, sent, relance, reponse_positive, reponse_negative, no_reponse) and total."""
    user_key = _get_user_key_from_headers(x_run_user_id, x_run_user_email)
    if not user_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User key required.")
    return candidature_store.get_counts_by_status(user_key)


@app.get("/candidatures", dependencies=[Depends(verify_token)])
def list_candidatures_api(
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    x_run_user_id: Optional[str] = Header(default=None),
    x_run_user_email: Optional[str] = Header(default=None),
) -> dict:
    user_key = _get_user_key_from_headers(x_run_user_id, x_run_user_email)
    if not user_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User key required.")
    status_filter = status if status and status in candidature_store.CANDIDATURE_STATUSES else None
    items = candidature_store.list_candidatures(user_key, status_filter=status_filter, limit=limit)
    return {
        "candidatures": [
            {
                "id": c.id,
                "run_id": c.run_id,
                "company": c.company,
                "email": c.email,
                "status": c.status,
                "draft_id": c.draft_id,
                "created_at": c.created_at,
                "updated_at": c.updated_at,
            }
            for c in items
        ],
    }


@app.post("/candidatures", dependencies=[Depends(verify_token)], status_code=status.HTTP_201_CREATED)
def create_candidature(
    body: CandidatureCreate,
    x_run_user_id: Optional[str] = Header(default=None),
    x_run_user_email: Optional[str] = Header(default=None),
) -> dict:
    user_key = _get_user_key_from_headers(x_run_user_id, x_run_user_email)
    if not user_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User key required.")
    status_val = body.status if body.status in candidature_store.CANDIDATURE_STATUSES else "draft_created"
    c = candidature_store.insert_candidature(
        user_key=user_key,
        company=(body.company or "").strip()[:500],
        email=(body.email or "").strip()[:320],
        status=status_val,
        run_id=body.run_id,
        draft_id=body.draft_id,
    )
    return {
        "id": c.id,
        "run_id": c.run_id,
        "company": c.company,
        "email": c.email,
        "status": c.status,
        "draft_id": c.draft_id,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


@app.patch("/candidatures/{candidature_id}", dependencies=[Depends(verify_token)])
def update_candidature_status_api(
    candidature_id: int,
    body: CandidatureUpdateStatus,
    x_run_user_id: Optional[str] = Header(default=None),
    x_run_user_email: Optional[str] = Header(default=None),
) -> dict:
    user_key = _get_user_key_from_headers(x_run_user_id, x_run_user_email)
    if not user_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User key required.")
    if body.status not in candidature_store.CANDIDATURE_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status.")
    updated = candidature_store.update_candidature_status(candidature_id, user_key, body.status)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidature not found.")
    return {
        "id": updated.id,
        "run_id": updated.run_id,
        "company": updated.company,
        "email": updated.email,
        "status": updated.status,
        "draft_id": updated.draft_id,
        "created_at": updated.created_at,
        "updated_at": updated.updated_at,
    }


def _get_message_body_text(payload: Optional[dict]) -> str:
    """Extract plain text body from Gmail message payload (single or multipart)."""
    if not payload:
        return ""
    body = payload.get("body") or {}
    data = body.get("data")
    if data:
        try:
            return base64.urlsafe_b64decode(data.encode("ASCII")).decode("utf-8", errors="replace")
        except Exception:
            pass
    for part in payload.get("parts") or []:
        if (part.get("mimeType") or "").startswith("text/plain"):
            part_data = (part.get("body") or {}).get("data")
            if part_data:
                try:
                    return base64.urlsafe_b64decode(part_data.encode("ASCII")).decode("utf-8", errors="replace")
                except Exception:
                    pass
    return ""


def _get_header(msg: dict, name: str) -> str:
    headers = (msg.get("payload") or {}).get("headers") or []
    for h in headers:
        if (h.get("name") or "").lower() == name.lower():
            return (h.get("value") or "").strip()
    return ""


def _fetch_draft_entries_from_gmail(body: CandidatureSyncBody) -> tuple[List[dict], Optional[str]]:
    """List Gmail drafts via API. Returns (entries, error_message). error_message is set on API failure."""
    at = (body.oauth_access_token or "").strip()
    if not at:
        return [], None
    try:
        from create_gmail_drafts import get_gmail_service_from_oauth_tokens
    except ImportError as e:
        return [], f"Module Gmail indisponible: {e}"
    try:
        service = get_gmail_service_from_oauth_tokens(
            access_token=at,
            refresh_token=(body.oauth_refresh_token or "").strip(),
            client_id=(body.oauth_client_id or "").strip(),
            client_secret=(body.oauth_client_secret or "").strip(),
            token_uri=(body.oauth_token_uri or "https://oauth2.googleapis.com/token").strip(),
            scope=(body.oauth_scope or "https://www.googleapis.com/auth/gmail.compose").strip(),
            access_token_expires_at=(body.oauth_access_token_expires_at or "").strip(),
        )
    except Exception as e:
        return [], f"Connexion Gmail impossible: {e!s}"

    entries: List[dict] = []
    page_token: Optional[str] = None
    entreprise_re = re.compile(r"Entreprise\s*:\s*(.+?)(?:\n|$)", re.IGNORECASE | re.DOTALL)
    email_re = re.compile(r"[A-Za-z0-9._%+\-']+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")

    try:
        from googleapiclient.errors import HttpError
    except ImportError:
        HttpError = Exception  # type: ignore[misc, assignment]

    while True:
        list_params: Dict[str, Union[str, int]] = {"userId": "me", "maxResults": 500}
        if page_token:
            list_params["pageToken"] = page_token
        try:
            result = service.users().drafts().list(**list_params).execute()
        except HttpError as e:
            err_msg = "Permissions Gmail insuffisantes."
            is_403 = getattr(e, "resp", None) and getattr(e.resp, "status", None) == 403
            if is_403:
                err_msg = (
                    "Autorisations Gmail insuffisantes. Déconnectez puis reconnectez votre compte Google "
                    "et acceptez toutes les autorisations demandées (notamment « Voir vos e-mails »)."
                )
            if not is_403:
                try:
                    err_content = getattr(e, "content", b"")
                    if err_content:
                        err_data = json.loads(err_content.decode("utf-8", errors="replace"))
                        err_inner = (err_data.get("error") or {}).get("message", err_msg)
                        if err_inner:
                            err_msg = err_inner
                except Exception:
                    pass
            return [], err_msg
        except Exception as e:
            return [], f"Erreur Gmail: {e!s}"
        drafts = result.get("drafts") or []
        if not drafts:
            break
        for d in drafts:
            draft_id = d.get("id")
            if not draft_id:
                continue
            try:
                draft = service.users().drafts().get(userId="me", id=draft_id, format="full").execute()
                msg = draft.get("message") or {}
                to_raw = _get_header(msg, "To")
                subject = _get_header(msg, "Subject")
                body_text = _get_message_body_text(msg.get("payload"))
                company = ""
                m = entreprise_re.search(body_text)
                if m:
                    company = m.group(1).strip()[:200]
                if not company and subject:
                    company = subject.strip()[:200] or "Inconnu"
                if not company:
                    company = "Inconnu"
                to_email = ""
                if email_re.search(to_raw):
                    to_email = email_re.search(to_raw).group(0)
                else:
                    for token in to_raw.replace(",", " ").split():
                        if email_re.search(token):
                            to_email = email_re.search(token).group(0)
                            break
                if not to_email:
                    continue
                entries.append({
                    "company": company,
                    "to": to_email,
                    "status": "OK",
                    "draft_id": draft_id,
                })
            except Exception:
                continue
        page_token = result.get("nextPageToken")
        if not page_token:
            break
    return entries, None


@app.post("/candidatures/sync", dependencies=[Depends(verify_token)])
def sync_candidatures_from_draft_log(
    body: Optional[CandidatureSyncBody] = None,
    x_run_user_id: Optional[str] = Header(default=None),
    x_run_user_email: Optional[str] = Header(default=None),
) -> dict:
    """Sync candidatures from Gmail drafts (if OAuth provided) or from drafts_created_log.csv."""
    user_key = _get_user_key_from_headers(x_run_user_id, x_run_user_email)
    if not user_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User key required.")
    run_id = (body.run_id if body else None) or ""
    entries: List[dict] = []
    message: Optional[str] = None

    if body and (body.oauth_access_token or "").strip():
        entries, gmail_error = _fetch_draft_entries_from_gmail(body)
        if gmail_error:
            inserted = candidature_store.upsert_candidatures_from_draft_log(user_key, run_id, [])
            return {"synced": 0, "run_id": run_id or None, "message": gmail_error}
        if not entries:
            message = "Aucun brouillon trouvé dans votre boîte Gmail."
    if not entries:
        draft_log_path = PROJECT_ROOT / "outputs" / "logs" / user_key / "drafts_created_log.csv"
        if draft_log_path.exists():
            try:
                import csv as csv_module
                with draft_log_path.open("r", encoding="utf-8") as f:
                    reader = csv_module.DictReader(f)
                    for row in reader:
                        if (row.get("status") or "").strip().upper() == "OK":
                            entries.append({
                                "company": row.get("company"),
                                "to": row.get("to"),
                                "status": "OK",
                                "draft_id": row.get("draft_id"),
                            })
            except (OSError, Exception):
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not read draft log.")
        if not entries and not message:
            message = (
                "Connectez votre compte Google (paramètres du compte) pour importer les brouillons depuis Gmail. "
                "Sinon, lancez d'abord une recherche depuis le dashboard pour créer des brouillons."
            )

    inserted = candidature_store.upsert_candidatures_from_draft_log(user_key, run_id, entries)
    out: dict = {"synced": inserted, "run_id": run_id or None}
    if message:
        out["message"] = message
    return out


@app.post("/candidatures/analyze-inbox", dependencies=[Depends(verify_token)])
def analyze_inbox_replies(
    body: Optional[CandidatureAnalyzeInboxBody] = None,
    x_run_user_id: Optional[str] = Header(default=None),
    x_run_user_email: Optional[str] = Header(default=None),
) -> dict:
    """Read INBOX via Gmail API, match replies to candidatures by sender email, classify positive/negative and update status."""
    user_key = _get_user_key_from_headers(x_run_user_id, x_run_user_email)
    if not user_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User key required.")
    if not body or not (body.oauth_access_token or "").strip():
        return {
            "analyzed": 0,
            "updated": 0,
            "positive": 0,
            "negative": 0,
            "message": "Connectez votre compte Google pour analyser les réponses reçues.",
        }
    stats, err = _analyze_inbox_from_gmail(body, user_key)
    if err:
        return {**stats, "message": err}
    return stats
