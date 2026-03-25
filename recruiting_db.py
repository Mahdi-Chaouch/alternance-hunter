#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Postgres persistence for recruiting data extracted by alternance_hunter.py.

Tables created from `recruiting_schema.sql`.
Upserts are designed to keep the highest confidence and to deduplicate on unique constraints.
"""

from __future__ import annotations

import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None  # type: ignore[assignment]


def get_database_url() -> str:
    db_url = (os.getenv("DATABASE_URL") or "").strip()
    if not db_url:
        raise RuntimeError("Missing DATABASE_URL environment variable.")
    return db_url


def normalize_domain(website_or_domain: str) -> str:
    v = (website_or_domain or "").strip().lower()
    if not v:
        return ""
    if "://" not in v:
        # Might be a raw domain
        return v.replace("www.", "")
    try:
        p = urlparse(v)
        host = (p.netloc or "").lower().replace("www.", "")
        return host
    except Exception:
        return v.replace("www.", "")


class RecruitingDB:
    def __init__(self, database_url: Optional[str] = None) -> None:
        if psycopg is None:  # pragma: no cover
            raise RuntimeError(
                "psycopg is not installed. Add `psycopg[binary]` to requirements.txt."
            )
        self._database_url = (database_url or "").strip() or get_database_url()
        self._local = threading.local()
        self._schema_lock = threading.Lock()
        self._schema_ensured = False

    def _conn(self):
        conn = getattr(self._local, "conn", None)
        if conn is None or getattr(conn, "closed", False):
            # Autocommit is off by default; we commit in each method.
            self._local.conn = psycopg.connect(self._database_url)
            conn = self._local.conn
        return conn

    def ensure_schema(self) -> None:
        if self._schema_ensured:
            return
        with self._schema_lock:
            if self._schema_ensured:
                return
            schema_path = Path(__file__).resolve().parent / "recruiting_schema.sql"
            sql = schema_path.read_text(encoding="utf-8")
            conn = self._conn()
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()
            self._schema_ensured = True

    def upsert_company(
        self,
        *,
        user_key: str,
        name: str,
        website: str,
        domain: str,
    ) -> int:
        self.ensure_schema()
        domain = normalize_domain(domain)
        website_norm = (website or "").strip() or None
        name_norm = (name or "").strip()
        conn = self._conn()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO companies (user_key, name, website, domain)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_key, domain)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    website = EXCLUDED.website,
                    last_seen_at = NOW()
                RETURNING id
                """,
                (user_key, name_norm, website_norm, domain),
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError("upsert_company: missing RETURNING row")
            company_id = int(row[0])
        conn.commit()
        return company_id

    def insert_scrape_run(
        self,
        *,
        user_key: str,
        run_id: Optional[str] = None,
        zone: Optional[str] = None,
        focus: Optional[str] = None,
        sector: Optional[str] = None,
        mode: Optional[str] = None,
    ) -> int:
        """
        Insert one scrape run row.
        We keep it simple (no upsert) because alternance_hunter runs are typically distinct.
        """
        self.ensure_schema()
        conn = self._conn()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO scrape_runs (
                    run_id, user_key, zone, focus, sector, mode
                ) VALUES (%s,%s,%s,%s,%s,%s)
                RETURNING id
                """,
                (
                    run_id,
                    user_key,
                    zone,
                    focus,
                    sector,
                    mode,
                ),
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError("insert_scrape_run: missing RETURNING row")
            scrape_run_db_id = int(row[0])
        conn.commit()
        return scrape_run_db_id

    def upsert_job_post(
        self,
        *,
        user_key: str,
        company_id: int,
        title: str,
        location: Optional[str],
        job_url: str,
        source_url: Optional[str],
        posted_date,  # date | None
        scraped_date,  # datetime | None
        status: str = "open",
        confidence: float = 0.0,
    ) -> int:
        self.ensure_schema()
        conn = self._conn()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO job_posts (
                    user_key, company_id, title, location, job_url, source_url,
                    posted_date, scraped_date, status, confidence
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (user_key, company_id, job_url)
                DO UPDATE SET
                    title = EXCLUDED.title,
                    location = EXCLUDED.location,
                    source_url = EXCLUDED.source_url,
                    posted_date = EXCLUDED.posted_date,
                    scraped_date = EXCLUDED.scraped_date,
                    status = EXCLUDED.status,
                    confidence = GREATEST(job_posts.confidence, EXCLUDED.confidence)
                RETURNING id
                """,
                (
                    user_key,
                    company_id,
                    (title or "").strip(),
                    location,
                    (job_url or "").strip(),
                    source_url,
                    posted_date,
                    scraped_date,
                    status,
                    float(confidence or 0.0),
                ),
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError("upsert_job_post: missing RETURNING row")
            job_post_id = int(row[0])
        conn.commit()
        return job_post_id

    def upsert_contact(
        self,
        *,
        user_key: str,
        company_id: int,
        email: str,
        contact_kind: str = "unknown",
        is_hr: bool = False,
        source_url: Optional[str] = None,
        scraped_date=None,
        confidence: float = 0.0,
        raw_context: Optional[str] = None,
    ) -> int:
        self.ensure_schema()
        conn = self._conn()
        email_norm = (email or "").strip().lower()
        with conn.cursor() as cur:
            # Keep the highest confidence and prefer raw_context when confidence increases.
            cur.execute(
                """
                INSERT INTO contacts (
                    user_key, company_id, email, contact_kind, is_hr, source_url,
                    scraped_date, confidence, raw_context
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (user_key, company_id, email)
                DO UPDATE SET
                    contact_kind = EXCLUDED.contact_kind,
                    is_hr = contacts.is_hr OR EXCLUDED.is_hr,
                    source_url = EXCLUDED.source_url,
                    scraped_date = EXCLUDED.scraped_date,
                    confidence = GREATEST(contacts.confidence, EXCLUDED.confidence),
                    raw_context = CASE
                        WHEN EXCLUDED.confidence >= contacts.confidence THEN EXCLUDED.raw_context
                        ELSE contacts.raw_context
                    END
                RETURNING id
                """,
                (
                    user_key,
                    company_id,
                    email_norm,
                    (contact_kind or "unknown").strip(),
                    bool(is_hr),
                    source_url,
                    scraped_date,
                    float(confidence or 0.0),
                    raw_context,
                ),
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError("upsert_contact: missing RETURNING row")
            contact_id = int(row[0])
        conn.commit()
        return contact_id

    def list_companies(self, *, user_key: str, limit: int = 50, offset: int = 0) -> list[dict]:
        self.ensure_schema()
        conn = self._conn()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, website, domain, first_seen_at, last_seen_at
                FROM companies
                WHERE user_key = %s
                ORDER BY last_seen_at DESC
                LIMIT %s OFFSET %s
                """,
                (user_key, int(limit), int(offset)),
            )
            rows = cur.fetchall()
        conn.commit()
        out: list[dict] = []
        for r in rows:
            out.append(
                {
                    "id": int(r[0]),
                    "name": r[1],
                    "website": r[2],
                    "domain": r[3],
                    "first_seen_at": r[4].isoformat() if r[4] else None,
                    "last_seen_at": r[5].isoformat() if r[5] else None,
                }
            )
        return out

    def list_job_posts_by_company_domain(
        self,
        *,
        user_key: str,
        domain: str,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict]:
        self.ensure_schema()
        domain_norm = normalize_domain(domain)
        conn = self._conn()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT jp.id, jp.title, jp.location, jp.job_url, jp.source_url,
                       jp.posted_date, jp.scraped_date, jp.status, jp.confidence
                FROM job_posts jp
                JOIN companies c ON c.id = jp.company_id
                WHERE c.user_key = %s AND c.domain = %s
                ORDER BY jp.scraped_date DESC
                LIMIT %s OFFSET %s
                """,
                (user_key, domain_norm, int(limit), int(offset)),
            )
            rows = cur.fetchall()
        conn.commit()
        out: list[dict] = []
        for r in rows:
            out.append(
                {
                    "id": int(r[0]),
                    "title": r[1],
                    "location": r[2],
                    "job_url": r[3],
                    "source_url": r[4],
                    "posted_date": r[5].isoformat() if r[5] else None,
                    "scraped_date": r[6].isoformat() if r[6] else None,
                    "status": r[7],
                    "confidence": float(r[8] or 0.0),
                }
            )
        return out

    def list_contacts_by_company_domain(
        self,
        *,
        user_key: str,
        domain: str,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        self.ensure_schema()
        domain_norm = normalize_domain(domain)
        conn = self._conn()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ct.id, ct.email, ct.contact_kind, ct.is_hr, ct.source_url,
                       ct.scraped_date, ct.confidence, ct.raw_context
                FROM contacts ct
                JOIN companies c ON c.id = ct.company_id
                WHERE c.user_key = %s AND c.domain = %s
                ORDER BY ct.scraped_date DESC
                LIMIT %s OFFSET %s
                """,
                (user_key, domain_norm, int(limit), int(offset)),
            )
            rows = cur.fetchall()
        conn.commit()
        out: list[dict] = []
        for r in rows:
            out.append(
                {
                    "id": int(r[0]),
                    "email": r[1],
                    "contact_kind": r[2],
                    "is_hr": bool(r[3]),
                    "source_url": r[4],
                    "scraped_date": r[5].isoformat() if r[5] else None,
                    "confidence": float(r[6] or 0.0),
                    "raw_context": r[7],
                }
            )
        return out

