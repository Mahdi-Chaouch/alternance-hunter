#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import base64
import csv
import mimetypes
import re
import sys
import time
from pathlib import Path
from email.message import EmailMessage
from datetime import date, datetime, timezone
from typing import Dict, Tuple

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build


# Scope minimal pour créer des brouillons
SCOPES = ["https://www.googleapis.com/auth/gmail.compose"]

BLOCK_SPLIT = "=============================="
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
EMAIL_EXTRACT_REGEX = re.compile(r"[A-Za-z0-9._%+\-']+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")


def safe_filename(name: str) -> str:
    name = name.strip()
    name = re.sub(r'[<>:"/\\|?*\n\r\t]', " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name[:120] if len(name) > 120 else name


def normalize_email(raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        return ""

    # Common noise from scraped content.
    value = value.replace("mailto:", "").strip()
    value = value.strip(" \t\r\n<>()[]{}\"'")

    # If wrappers or punctuation remain, extract first plausible email.
    match = EMAIL_EXTRACT_REGEX.search(value)
    if match:
        value = match.group(0)

    return value.strip(" \t\r\n<>()[]{}\"'")


def parse_blocks(text: str):
    """
    Parse un fichier draft_*.txt:
    ==============================
    Entreprise: ...
    Zone: ...
    Site: ...
    Email: ...
    Source: ...
    Sujet: ...

    <body...>
    """
    parts = text.split(BLOCK_SPLIT)
    for p in parts:
        p = p.strip()
        if not p:
            continue

        m_company = re.search(r"^Entreprise:\s*(.+)$", p, flags=re.MULTILINE)
        m_email = re.search(r"^Email:\s*(.+)$", p, flags=re.MULTILINE)
        m_subject = re.search(r"^Sujet:\s*(.+)$", p, flags=re.MULTILINE)

        if not (m_company and m_email and m_subject):
            continue

        company = m_company.group(1).strip()
        to_email = normalize_email(m_email.group(1))
        subject = m_subject.group(1).strip()

        if not EMAIL_REGEX.match(to_email):
            continue

        # Corps = tout ce qui suit la ligne "Sujet:"
        body_split = re.split(r"^Sujet:\s*.+$", p, maxsplit=1, flags=re.MULTILINE)
        body = body_split[1].strip() if len(body_split) == 2 else ""
        if not body:
            continue

        yield {"company": company, "to": to_email, "subject": subject, "body": body}


def get_gmail_service(credentials_json: Path, token_json: Path, prefer_console: bool):
    """
    Auth robuste:
    - utilise token.json si présent
    - sinon tente navigateur (run_local_server)
    - sinon fallback console manuel: authorization_url + fetch_token(code=...)
    """
    creds = None
    if token_json.exists():
        creds = Credentials.from_authorized_user_file(str(token_json), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("🔄 Refresh token...")
            creds.refresh(Request())
        else:
            if not credentials_json.exists():
                raise SystemExit(f"❌ credentials.json introuvable: {credentials_json}")

            flow = InstalledAppFlow.from_client_secrets_file(str(credentials_json), SCOPES)

            if not prefer_console:
                try:
                    print("🔐 OAuth navigateur (local server)...")
                    creds = flow.run_local_server(port=0)
                except Exception:
                    print("⚠️ OAuth navigateur impossible -> fallback console manuel")
                    prefer_console = True

            if prefer_console:
                print("🔐 OAuth console (manuel) ...")
                auth_url, _ = flow.authorization_url(
                    access_type="offline",
                    include_granted_scopes="true",
                    prompt="consent"
                )
                print("\n1) Ouvre ce lien dans ton navigateur :\n")
                print(auth_url)
                print("\n2) Connecte-toi, accepte, puis copie le CODE affiché.\n")
                code = input("Colle le code ici: ").strip()
                flow.fetch_token(code=code)
                creds = flow.credentials

        token_json.parent.mkdir(parents=True, exist_ok=True)
        token_json.write_text(creds.to_json(), encoding="utf-8")

    return build("gmail", "v1", credentials=creds)


def parse_iso_datetime(raw: str) -> datetime | None:
    value = (raw or "").strip()
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


def get_gmail_service_from_oauth_tokens(
    access_token: str,
    refresh_token: str,
    client_id: str,
    client_secret: str,
    token_uri: str,
    scope: str,
    access_token_expires_at: str,
):
    scopes = [s for s in scope.split(" ") if s.strip()] if scope else SCOPES
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token or None,
        token_uri=token_uri,
        client_id=client_id or None,
        client_secret=client_secret or None,
        scopes=scopes,
    )
    expiry = parse_iso_datetime(access_token_expires_at)
    if expiry is not None:
        creds.expiry = expiry
    if creds.expired and creds.refresh_token:
        print("🔄 Refresh token utilisateur...")
        creds.refresh(Request())
    return build("gmail", "v1", credentials=creds)


def guess_mime(path: Path):
    """
    Retourne (maintype, subtype) selon l'extension.
    """
    # Map rapide pour les types courants
    ext = path.suffix.lower()

    if ext == ".pdf":
        return ("application", "pdf")
    if ext == ".docx":
        return ("application", "vnd.openxmlformats-officedocument.wordprocessingml.document")
    if ext == ".doc":
        return ("application", "msword")
    if ext == ".txt":
        return ("text", "plain")

    mt, _ = mimetypes.guess_type(str(path))
    if mt and "/" in mt:
        a, b = mt.split("/", 1)
        return (a, b)

    return ("application", "octet-stream")


AttachmentPayload = Tuple[bytes, str, str, str]


def _resolve_attachment_payload(
    path: Path,
    cache: Dict[str, AttachmentPayload],
) -> AttachmentPayload | None:
    key = str(path.resolve())
    if key in cache:
        return cache[key]

    if not path.exists():
        print(f"⚠️ Pièce jointe introuvable (skip): {path}")
        return None

    data = path.read_bytes()
    maintype, subtype = guess_mime(path)
    payload = (data, maintype, subtype, path.name)
    cache[key] = payload
    return payload


def make_message(
    to_email: str,
    subject: str,
    body: str,
    attachments: list[Path],
    attachment_cache: Dict[str, AttachmentPayload],
) -> dict:
    msg = EmailMessage()
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    for path in attachments:
        payload = _resolve_attachment_payload(path, attachment_cache)
        if payload is None:
            continue
        data, maintype, subtype, filename = payload
        msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=filename)

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    return {"message": {"raw": raw}}


def create_draft(service, draft_body: dict):
    return service.users().drafts().create(userId="me", body=draft_body).execute()


def ensure_csv_header(path: Path, fieldnames: list[str]):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.stat().st_size == 0:
        with path.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()


def load_done_keys(log_csv: Path) -> set[str]:
    done = set()
    if not log_csv.exists():
        return done
    try:
        with log_csv.open("r", encoding="utf-8") as f:
            r = csv.DictReader(f)
            for row in r:
                k = (row.get("key") or "").strip()
                if k:
                    done.add(k)
    except Exception:
        pass
    return done


def find_company_lm(company: str, letters_dir: Path, lm_suffix: str) -> Path | None:
    """
    Cherche la LM générée:
    letters/<Entreprise>_LM.<suffix>
    """
    fname = safe_filename(company) + f"_LM.{lm_suffix.lstrip('.')}"
    p = letters_dir / fname
    if p.exists():
        return p
    return None


def main():
    ap = argparse.ArgumentParser()

    ap.add_argument("--draft-file", default="data/exports/draft_emails.txt",
                    help="ex: data/exports/draft_emails.txt")

    ap.add_argument("--cv", default="assets/CV.pdf", help="chemin vers ton CV.pdf")

    # Nouveau: LM auto depuis letters/
    ap.add_argument("--letters-dir", default="outputs/letters",
                    help="dossier où sont générées les LM (ex: letters/)")
    ap.add_argument("--lm-suffix", default="docx",
                    help="extension des LM générées (docx par défaut)")
    ap.add_argument("--no-lm", action="store_true",
                    help="désactive l'attachement automatique des LM")

    # optionnel: si tu veux forcer une LM unique pour tout le monde
    ap.add_argument("--lm", default="",
                    help="chemin LM unique (optionnel). Si défini, il sera attaché à tous les emails.")

    ap.add_argument("--credentials", default="secrets/credentials.json", help="OAuth client json")
    ap.add_argument("--token", default="secrets/token.json", help="token cache")
    ap.add_argument("--oauth-access-token", default="", help="OAuth access token utilisateur")
    ap.add_argument("--oauth-refresh-token", default="", help="OAuth refresh token utilisateur")
    ap.add_argument("--oauth-client-id", default="", help="OAuth client id")
    ap.add_argument("--oauth-client-secret", default="", help="OAuth client secret")
    ap.add_argument("--oauth-token-uri", default="https://oauth2.googleapis.com/token", help="OAuth token uri")
    ap.add_argument("--oauth-scope", default="", help="OAuth scopes separes par espaces")
    ap.add_argument("--oauth-access-token-expires-at", default="", help="Expiration ISO access token")
    ap.add_argument("--oauth-account-id", default="", help="Identifiant du compte OAuth")
    ap.add_argument("--sleep", type=float, default=1.0, help="pause entre drafts (sec)")
    ap.add_argument("--max", type=int, default=999999, help="max drafts à créer")
    ap.add_argument("--dry-run", action="store_true", help="ne crée rien, affiche juste")
    ap.add_argument("--console-auth", action="store_true",
                    help="force auth console (utile si navigateur/ssh)")
    ap.add_argument("--resume-log", default="outputs/logs/drafts_created_log.csv",
                    help="log pour reprise/anti-doublon")
    ap.add_argument("--progress-every", type=int, default=25,
                    help="affiche une progression toutes les N entrées analysées")

    args = ap.parse_args()

    draft_file = Path(args.draft_file)
    if not draft_file.exists():
        raise SystemExit(f"❌ Fichier draft introuvable: {draft_file} (cwd={Path.cwd()})")

    cv_path = Path(args.cv)
    if not cv_path.exists():
        print(f"⚠️ CV introuvable: {cv_path} (les drafts seront créés sans CV si tu continues)")

    letters_dir = Path(args.letters_dir)

    text = draft_file.read_text(encoding="utf-8", errors="ignore")
    items = list(parse_blocks(text))
    if not items:
        raise SystemExit("❌ Aucun bloc valide trouvé. Vérifie qu'il y a bien 'Entreprise:', 'Email:', 'Sujet:'.")

    log_csv = Path(args.resume_log)
    ensure_csv_header(log_csv, ["key", "company", "to", "subject", "status", "draft_id", "error", "lm_attached"])
    done = load_done_keys(log_csv)

    if args.dry_run:
        print(f"🧪 DRY RUN — blocs détectés: {len(items)}")
        for it in items[:10]:
            lm = None if args.no_lm else find_company_lm(it["company"], letters_dir, args.lm_suffix)
            lm_str = str(lm) if lm else "(LM missing)"
            if args.lm.strip():
                lm_str = f"(LM forced: {args.lm})"
            print(f"- {it['company']} -> {it['to']} | {it['subject']} | LM: {lm_str}")
        print("🧪 (Aucun draft créé)")
        return

    if args.oauth_access_token.strip():
        service = get_gmail_service_from_oauth_tokens(
            access_token=args.oauth_access_token.strip(),
            refresh_token=args.oauth_refresh_token.strip(),
            client_id=args.oauth_client_id.strip(),
            client_secret=args.oauth_client_secret.strip(),
            token_uri=args.oauth_token_uri.strip() or "https://oauth2.googleapis.com/token",
            scope=args.oauth_scope.strip(),
            access_token_expires_at=args.oauth_access_token_expires_at.strip(),
        )
        if args.oauth_account_id.strip():
            print(f"👤 Compte OAuth utilisateur: {args.oauth_account_id.strip()}")
    else:
        service = get_gmail_service(Path(args.credentials), Path(args.token),
                                   prefer_console=args.console_auth)

    created = 0
    skipped = 0
    scanned = 0
    attachment_cache: Dict[str, AttachmentPayload] = {}

    with log_csv.open("a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["key", "company", "to", "subject", "status", "draft_id", "error", "lm_attached"])

        for it in items:
            scanned += 1
            if created >= args.max:
                break

            # clé anti-doublon: email + subject
            key = f"{it['to']}|{it['subject']}"
            if key in done:
                skipped += 1
                if args.progress_every > 0 and scanned % args.progress_every == 0:
                    print(f"⏳ Progression: lus={scanned}/{len(items)} | créés={created} | skippés={skipped}")
                continue

            # Attachments: CV + LM (auto ou forcée)
            attachments = []
            if cv_path.exists():
                attachments.append(cv_path)

            lm_attached = "NO"
            if args.lm.strip():
                lm_path = Path(args.lm)
                if lm_path.exists():
                    attachments.append(lm_path)
                    lm_attached = "FORCED"
                else:
                    print(f"⚠️ LM forcée introuvable: {lm_path} (skip)")
            elif not args.no_lm:
                lm_path = find_company_lm(it["company"], letters_dir, args.lm_suffix)
                if lm_path:
                    attachments.append(lm_path)
                    lm_attached = "AUTO"
                else:
                    lm_attached = "MISSING"

            try:
                draft_body = make_message(
                    it["to"],
                    it["subject"],
                    it["body"],
                    attachments,
                    attachment_cache,
                )
                res = create_draft(service, draft_body)
                draft_id = res.get("id", "")

                created += 1
                done.add(key)

                print(f"✅ Draft OK [{created}] {it['company']} -> {it['to']} (id={draft_id}) | LM={lm_attached}")

                w.writerow({
                    "key": key,
                    "company": it["company"],
                    "to": it["to"],
                    "subject": it["subject"],
                    "status": "OK",
                    "draft_id": draft_id,
                    "error": "",
                    "lm_attached": lm_attached,
                })
            except Exception as e:
                print(f"❌ Draft FAIL {it['company']} -> {it['to']} | {type(e).__name__}: {e}")
                w.writerow({
                    "key": key,
                    "company": it["company"],
                    "to": it["to"],
                    "subject": it["subject"],
                    "status": "FAIL",
                    "draft_id": "",
                    "error": f"{type(e).__name__}: {e}",
                    "lm_attached": lm_attached,
                })

            f.flush()
            time.sleep(args.sleep)

    print(f"\n🎉 Terminé. Créés: {created} | Skippés (déjà faits): {skipped}")
    print("📬 Ouvre Gmail -> Brouillons.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⛔ Interrompu.")
        sys.exit(1)