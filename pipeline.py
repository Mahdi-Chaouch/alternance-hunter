#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
CLI unifiee pour piloter le pipeline alternance:
1) alternance_hunter.py
2) generate_lm.py
3) create_gmail_drafts.py

Usage rapide:
  python pipeline.py --mode pipeline --zone all
  python pipeline.py --mode hunter --zone paris --max-sites 400
  python pipeline.py --mode generate --use-ai
  python pipeline.py --mode drafts --dry-run
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path
from typing import List


ZONE_MAP = {
    "paris": "Paris",
    "cannes": "Cannes",
    "auxerre": "Auxerre",
    "fontainebleau": "Fontainebleau",
    "all": "",
}


def _project_root() -> Path:
    return Path(__file__).resolve().parent


def _script_path(name: str) -> Path:
    path = _project_root() / name
    if not path.exists():
        raise SystemExit(f"Script introuvable: {path}")
    return path


def _run(cmd: List[str], dry_run: bool) -> int:
    printable = " ".join(cmd)
    print(f"\n>>> {printable}", flush=True)
    if dry_run:
        return 0
    result = subprocess.run(
        cmd,
        cwd=str(_project_root()),
        check=False,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )
    return int(result.returncode)


def _python_cmd(python_executable: str) -> List[str]:
    return [python_executable, "-u"]


def _zone_to_hunter_filter(zone: str) -> str:
    normalized = (zone or "all").strip().lower()
    if normalized not in ZONE_MAP:
        valid = ", ".join(ZONE_MAP.keys())
        raise SystemExit(f"Zone invalide '{zone}'. Zones supportees: {valid}")
    return ZONE_MAP[normalized]


def build_hunter_cmd(args: argparse.Namespace) -> List[str]:
    cmd = [
        *_python_cmd(args.python),
        str(_script_path("alternance_hunter.py")),
        "--max-minutes",
        str(args.max_minutes),
        "--max-sites",
        str(args.max_sites),
        "--target-found",
        str(args.target_found),
        "--workers",
        str(args.workers),
        "--focus",
        args.focus,
    ]

    zone_filter = _zone_to_hunter_filter(args.zone)
    if zone_filter:
        cmd.extend(["--zones", zone_filter])
    if args.enable_sitemap:
        cmd.append("--enable-sitemap")
    if args.insecure:
        cmd.append("--insecure")
    if args.rh_only:
        cmd.append("--rh-only")
    return cmd


def build_generate_cmd(args: argparse.Namespace) -> List[str]:
    cmd = [
        *_python_cmd(args.python),
        str(_script_path("generate_lm.py")),
        "--draft-file",
        args.draft_file,
        "--template",
        args.template,
        "--out-dir",
        args.out_dir,
        "--ai-model",
        args.ai_model,
    ]
    if args.use_ai:
        cmd.append("--use-ai")
    return cmd


def build_drafts_cmd(args: argparse.Namespace) -> List[str]:
    cmd = [
        *_python_cmd(args.python),
        str(_script_path("create_gmail_drafts.py")),
        "--draft-file",
        args.draft_file,
        "--cv",
        args.cv,
        "--letters-dir",
        args.out_dir,
        "--lm-suffix",
        args.lm_suffix,
        "--credentials",
        args.credentials,
        "--token",
        args.token,
        "--sleep",
        str(args.sleep),
        "--max",
        str(args.max),
        "--resume-log",
        args.resume_log,
    ]
    if args.no_lm:
        cmd.append("--no-lm")
    if args.lm:
        cmd.extend(["--lm", args.lm])
    if args.console_auth:
        cmd.append("--console-auth")
    if args.dry_run:
        cmd.append("--dry-run")
    return cmd


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Orchestrateur unique: pipeline complet ou etapes separees."
    )

    parser.add_argument(
        "--mode",
        choices=["pipeline", "hunter", "generate", "drafts"],
        default="pipeline",
        help="pipeline=3 etapes, sinon execution d'une etape unique.",
    )
    parser.add_argument(
        "--zone",
        choices=["paris", "cannes", "auxerre", "fontainebleau", "all"],
        default="all",
        help="Zone cible pour l'etape hunter. 'all' = toutes les zones.",
    )
    parser.add_argument(
        "--python",
        default=sys.executable,
        help="Interpreteur Python a utiliser (defaut: Python courant).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Affiche les commandes sans les executer (et passe dry-run a l'etape drafts).",
    )

    # Hunter
    parser.add_argument("--max-minutes", type=int, default=30)
    parser.add_argument("--max-sites", type=int, default=1500)
    parser.add_argument("--target-found", type=int, default=100)
    parser.add_argument("--workers", type=int, default=20)
    parser.add_argument("--focus", choices=["web", "it", "all"], default="web")
    parser.add_argument("--enable-sitemap", action="store_true")
    parser.add_argument("--insecure", action="store_true")
    parser.add_argument("--rh-only", action="store_true")

    # Generate LM
    parser.add_argument("--draft-file", default="data/exports/draft_emails.txt")
    parser.add_argument("--template", default="assets/template_LM.docx")
    parser.add_argument("--out-dir", default="outputs/letters")
    parser.add_argument("--use-ai", action="store_true")
    parser.add_argument("--ai-model", default="gpt-4o-mini")

    # Drafts Gmail
    parser.add_argument("--cv", default="assets/CV.pdf")
    parser.add_argument("--lm-suffix", default="docx")
    parser.add_argument("--no-lm", action="store_true")
    parser.add_argument("--lm", default="")
    parser.add_argument("--credentials", default="secrets/credentials.json")
    parser.add_argument("--token", default="secrets/token.json")
    parser.add_argument("--sleep", type=float, default=1.0)
    parser.add_argument("--max", type=int, default=999999)
    parser.add_argument("--console-auth", action="store_true")
    parser.add_argument("--resume-log", default="outputs/logs/drafts_created_log.csv")

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    pipeline_steps = {
        "hunter": build_hunter_cmd(args),
        "generate": build_generate_cmd(args),
        "drafts": build_drafts_cmd(args),
    }

    if args.mode == "pipeline":
        order = ["hunter", "generate", "drafts"]
    else:
        order = [args.mode]

    for step in order:
        print(f"\n=== ETAPE: {step} ===", flush=True)
        exit_code = _run(pipeline_steps[step], dry_run=args.dry_run)
        if exit_code != 0:
            raise SystemExit(exit_code)

    print("\nPipeline termine.", flush=True)


if __name__ == "__main__":
    main()
