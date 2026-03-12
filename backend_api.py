#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import os
import signal
import subprocess
import sys
import threading
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Deque, Dict, List, Literal, Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from pydantic import BaseModel, Field


PROJECT_ROOT = Path(__file__).resolve().parent
PIPELINE_PATH = PROJECT_ROOT / "pipeline.py"
RUN_LOG_DIR = PROJECT_ROOT / "outputs" / "logs" / "api_runs"
RUN_LOG_DIR.mkdir(parents=True, exist_ok=True)
MAX_IN_MEMORY_LOG_LINES = 500

API_TOKEN = os.getenv("PIPELINE_API_TOKEN") or os.getenv("API_TOKEN")
if not API_TOKEN:
    raise RuntimeError(
        "Missing API token. Set PIPELINE_API_TOKEN (or API_TOKEN) before starting the API."
    )


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class RunRequest(BaseModel):
    mode: Literal["pipeline", "hunter", "generate", "drafts"] = "pipeline"
    zone: Literal["paris", "cannes", "auxerre", "fontainebleau", "all"] = "all"
    dry_run: bool = False
    python: Optional[str] = None

    # hunter
    max_minutes: int = 30
    max_sites: int = 1500
    target_found: int = 100
    workers: int = 20
    focus: Literal["web", "it", "all"] = "web"
    enable_sitemap: bool = False
    insecure: bool = False
    rh_only: bool = False

    # generate
    draft_file: str = "data/exports/draft_emails.txt"
    template: str = "assets/template_LM.docx"
    out_dir: str = "outputs/letters"
    use_ai: bool = False
    ai_model: str = "gpt-4o-mini"

    # drafts
    cv: str = "assets/CV.pdf"
    lm_suffix: str = "docx"
    no_lm: bool = False
    lm: str = ""
    credentials: str = "secrets/credentials.json"
    token: str = "secrets/token.json"
    sleep: float = 1.0
    max: int = 999999
    console_auth: bool = False
    resume_log: str = "outputs/logs/drafts_created_log.csv"


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
    log_file: str
    logs_tail: List[str]


@dataclass
class RunState:
    run_id: str
    command: List[str]
    log_file: Path
    status: str = "queued"
    created_at: str = field(default_factory=utc_now_iso)
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    exit_code: Optional[int] = None
    pid: Optional[int] = None
    cancel_requested: bool = False
    process: Optional[subprocess.Popen[str]] = None
    logs_tail: Deque[str] = field(
        default_factory=lambda: deque(maxlen=MAX_IN_MEMORY_LOG_LINES)
    )

    def append_log(self, line: str) -> None:
        clean = line.rstrip("\n")
        self.logs_tail.append(clean)
        with self.log_file.open("a", encoding="utf-8") as fh:
            fh.write(clean + "\n")


app = FastAPI(title="Alternance Pipeline API", version="1.0.0")

RUNS: Dict[str, RunState] = {}
RUNS_LOCK = threading.Lock()


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


def build_pipeline_command(payload: RunRequest) -> List[str]:
    cmd = [payload.python or sys.executable, str(PIPELINE_PATH)]
    cmd += ["--mode", payload.mode, "--zone", payload.zone]
    cmd += ["--max-minutes", str(payload.max_minutes)]
    cmd += ["--max-sites", str(payload.max_sites)]
    cmd += ["--target-found", str(payload.target_found)]
    cmd += ["--workers", str(payload.workers)]
    cmd += ["--focus", payload.focus]
    cmd += ["--draft-file", payload.draft_file]
    cmd += ["--template", payload.template]
    cmd += ["--out-dir", payload.out_dir]
    cmd += ["--ai-model", payload.ai_model]
    cmd += ["--cv", payload.cv]
    cmd += ["--lm-suffix", payload.lm_suffix]
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
    if payload.use_ai:
        cmd.append("--use-ai")
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

    run.append_log(f"[{utc_now_iso()}] Starting command: {' '.join(run.command)}")

    popen_kwargs = {
        "cwd": str(PROJECT_ROOT),
        "stdout": subprocess.PIPE,
        "stderr": subprocess.STDOUT,
        "text": True,
        "bufsize": 1,
    }
    if sys.platform.startswith("win"):
        popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        popen_kwargs["start_new_session"] = True

    process = subprocess.Popen(run.command, **popen_kwargs)
    with RUNS_LOCK:
        run.process = process
        run.pid = process.pid

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

    run.append_log(f"[{utc_now_iso()}] Run finished with exit code {exit_code}.")


def get_run_or_404(run_id: str) -> RunState:
    with RUNS_LOCK:
        run = RUNS.get(run_id)
        if run is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Run '{run_id}' not found.",
            )
        return run


@app.get("/healthz")
def healthcheck() -> dict:
    return {"ok": True}


@app.post(
    "/runs",
    response_model=RunCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(verify_token)],
)
def create_run(payload: RunRequest) -> RunCreateResponse:
    run_id = uuid4().hex
    command = build_pipeline_command(payload)
    log_file = RUN_LOG_DIR / f"{run_id}.log"
    run = RunState(run_id=run_id, command=command, log_file=log_file)

    with RUNS_LOCK:
        RUNS[run_id] = run

    thread = threading.Thread(target=run_in_background, args=(run_id,), daemon=True)
    thread.start()

    return RunCreateResponse(run_id=run_id, status="running")


@app.get(
    "/runs/{run_id}",
    response_model=RunStatusResponse,
    dependencies=[Depends(verify_token)],
)
def get_run_status(
    run_id: str,
    tail: int = Query(default=200, ge=1, le=2000),
) -> RunStatusResponse:
    run = get_run_or_404(run_id)
    logs = list(run.logs_tail)[-tail:]
    return RunStatusResponse(
        run_id=run.run_id,
        status=run.status,
        created_at=run.created_at,
        started_at=run.started_at,
        finished_at=run.finished_at,
        exit_code=run.exit_code,
        command=run.command,
        pid=run.pid,
        cancel_requested=run.cancel_requested,
        log_file=str(run.log_file),
        logs_tail=logs,
    )


@app.post(
    "/runs/{run_id}/cancel",
    dependencies=[Depends(verify_token)],
)
def cancel_run(run_id: str) -> dict:
    run = get_run_or_404(run_id)
    with RUNS_LOCK:
        if run.status in {"succeeded", "failed", "cancelled"}:
            return {"run_id": run_id, "status": run.status, "message": "Run already ended."}
        run.cancel_requested = True
        process = run.process

    if process and process.pid:
        kill_process_tree(process.pid)
        run.append_log(f"[{utc_now_iso()}] Cancellation requested.")
        return {"run_id": run_id, "status": "cancelling"}

    return {"run_id": run_id, "status": run.status, "message": "Run not started yet."}


@app.get("/runs", dependencies=[Depends(verify_token)])
def list_runs(limit: int = Query(default=20, ge=1, le=200)) -> dict:
    with RUNS_LOCK:
        items = list(RUNS.values())[-limit:]
    serialized = [
        {
            "run_id": run.run_id,
            "status": run.status,
            "created_at": run.created_at,
            "started_at": run.started_at,
            "finished_at": run.finished_at,
            "exit_code": run.exit_code,
            "pid": run.pid,
            "cancel_requested": run.cancel_requested,
            "log_file": str(run.log_file),
        }
        for run in items
    ]
    return {"runs": serialized}
