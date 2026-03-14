#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
alternance_hunter.py (v6 - QUALITÉ EMAILS RH vs SUPPORT)

Objectifs:
- Collecter des entreprises via OSM/Overpass autour de Paris / Fontainebleau / Cannes
- Extraire un email (si possible) OU a minima des URLs contact / recrutement
- Générer: targets_auto.csv, emails_found.csv, draft_emails.txt

Améliorations v6:
- Emails support/help/service exclus par défaut (souvent non-RH, ne fonctionnent pas pour recrutement)
- Priorité forte aux emails RH (recrut@, rh@, jobs@, career@, etc.)
- Option --rh-only : n'écrit un brouillon que si un email RH est trouvé (sinon FORM_ONLY)
- BAD_LOCAL: newsletter, unsubscribe, bounce, mailer-daemon

Exemples:
  python3 alternance_hunter.py
  python3 alternance_hunter.py --max-minutes 30 --max-sites 1500 --workers 20 --target-found 120 --insecure
  python3 alternance_hunter.py --focus web
  python3 alternance_hunter.py --focus all
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
import time
import threading
from dataclasses import dataclass
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse, urljoin

import requests
from bs4 import BeautifulSoup


def configure_safe_stdio() -> None:
    """
    Avoid UnicodeEncodeError on Windows terminals (cp1252) when printing emoji.
    Unsupported characters are replaced instead of crashing the script.
    """
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(errors="replace")
            except Exception:
                pass


configure_safe_stdio()


# ============================================================
# USER CONFIG
# ============================================================
LINKEDIN = ""

DEFAULT_TARGETS_AUTO_CSV = "data/exports/targets_auto.csv"
DEFAULT_EMAILS_FOUND_CSV = "data/exports/emails_found.csv"
DEFAULT_DRAFT_EMAILS_TXT = "data/exports/draft_emails.txt"

SEP = "=============================="

INSECURE_SSL = False


# ============================================================
# HTTP CONFIG
# ============================================================
HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) alternance_hunter/5.0",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}
HEADERS_WEB = {
    **HTTP_HEADERS,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

TIMEOUT_NOMINATIM = 15
TIMEOUT_OVERPASS = 60
TIMEOUT_HTML = (6, 18)  # (connect, read)

MAX_BYTES = 900_000  # limite de taille page (évite de télécharger 20MB)
SLEEP_BETWEEN_REQUESTS_SEC = 0.0  # si tu veux ralentir un peu : 0.05

# si ton Python/requests a un bug SSL -> flag runtime
def rq_get(url: str, **kwargs):
    if INSECURE_SSL:
        kwargs["verify"] = False
    return requests.get(url, **kwargs)

def rq_post(url: str, **kwargs):
    if INSECURE_SSL:
        kwargs["verify"] = False
    return requests.post(url, **kwargs)


# ============================================================
# OSM / OVERPASS CONFIG
# ============================================================
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]

# v5: filtre élargi web/digital/software + agences + ESN + consulting IT
OVERPASS_FILTER = r"""
(
  node(around:RADIUS, LAT, LON)["office"~"it|software|telecommunication|digital|consulting|marketing|advertising|company"];
  way(around:RADIUS, LAT, LON)["office"~"it|software|telecommunication|digital|consulting|marketing|advertising|company"];
  relation(around:RADIUS, LAT, LON)["office"~"it|software|telecommunication|digital|consulting|marketing|advertising|company"];

  node(around:RADIUS, LAT, LON)["company"~"it|it_service|software|web|digital|agency|studio|dev|development"];
  way(around:RADIUS, LAT, LON)["company"~"it|it_service|software|web|digital|agency|studio|dev|development"];
  relation(around:RADIUS, LAT, LON)["company"~"it|it_service|software|web|digital|agency|studio|dev|development"];

  node(around:RADIUS, LAT, LON)["craft"~"web_design|graphic_design"];
  way(around:RADIUS, LAT, LON)["craft"~"web_design|graphic_design"];
  relation(around:RADIUS, LAT, LON)["craft"~"web_design|graphic_design"];

  node(around:RADIUS, LAT, LON)["shop"~"computer|electronics"];
  way(around:RADIUS, LAT, LON)["shop"~"computer|electronics"];
  relation(around:RADIUS, LAT, LON)["shop"~"computer|electronics"];
);
"""

OVERPASS_RETRIES_PER_ENDPOINT = 2
OVERPASS_BACKOFF_SECONDS = [2, 6, 12]

PARIS_CENTERS = [
    ("Paris-Centre", 48.8566, 2.3522, 8.0, 140),
    ("Paris-LaDefense", 48.8919, 2.2370, 7.0, 110),
    ("Paris-Bercy", 48.8347, 2.3860, 7.0, 100),
    ("Paris-Montparnasse", 48.8422, 2.3212, 7.0, 100),
]

# Villes / zones recherchées : Paris (voir PARIS_CENTERS) + Cannes, Auxerre, Fontainebleau.
# Tu peux limiter avec --zones "Cannes, Fontainebleau" si besoin.
ZONES = [
    {"name": "Fontainebleau, France", "radius_km": 25.0, "limit": 150},
    {"name": "Cannes, France", "radius_km": 20.0, "limit": 150},
    {"name": "Auxerre, France", "radius_km": 25.0, "limit": 150},
]


# ============================================================
# EMAIL FINDER CONFIG
# ============================================================
# Préfixes typiques des boîtes mail (générique = contact ou RH)
GENERIC_PREFIXES = (
    "recrut", "rh", "hr", "jobs", "job", "career", "carriere", "talent",
    "contact", "hello", "info", "recruit", "recrutement", "stage", "alternance",
    "team", "people", "hiring"
)
# Emails RH/recrutement : priorité maximale (évite support / technique)
HR_PREFIXES = (
    "recrut", "rh", "hr", "jobs", "job", "career", "carriere", "talent",
    "recruit", "recrutement", "stage", "alternance", "hiring", "people", "candidature"
)
# Emails souvent support technique / commercial : à éviter pour candidatures
SUPPORT_LIKE_PREFIXES = ("support", "help", "service", "admin", "newsletter", "marketing", "commercial", "sales")

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

FAST_PATHS = [
    "/", "/contact", "/contact/", "/nous-contacter", "/nous-contacter/",
    "/recrutement", "/recrutement/", "/carriere", "/carriere/", "/carrieres", "/carrieres/",
    "/careers", "/careers/", "/jobs", "/jobs/", "/alternance", "/alternance/",
    "/stages", "/stages/", "/mentions-legales", "/mentions-legales/",
]

ATS_HINTS = (
    "teamtailor", "lever.co", "greenhouse.io", "smartrecruiters", "workable",
    "welcometothejungle", "welcome to the jungle", "taleez", "flatchr",
    "myworkdayjobs", "jobs.", "career.", "apply.", "ashbyhq", "recruitee"
)

# anti faux emails (images / assets / placeholders / non-RH)
BAD_LOCAL_SUBSTRINGS = (
    "@2x", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".ico",
    "example", "your@", "you@", "noreply", "no-reply", "donotreply", "do-not-reply",
    "sentry", "wixpress", "cloudflare", "cdn", "static", "assets",
    "newsletter", "unsubscribe", "bounce", "mailer-daemon"
)

BAD_DOMAINS = (
    "example.com",
    "email.com",
    "domain.com",
    "wixpress.com",
    "sentry-next.wixpress.com",
    "envato.com",
)

WEB_DEV_KEYWORDS = (
    "web", "digital", "dev", "development", "développement", "agence", "agency",
    "studio", "logiciel", "software", "saas", "it", "tech", "app", "mobile",
    "ecommerce", "e-commerce", "ux", "ui", "product"
)

# v5: blacklist légère pour éviter beaucoup de bruit
NAME_BLACKLIST = (
    "parti", "politique", "fédération", "association politique",
    "lycée", "college", "université", "universite", "ufr",
    "mairie", "commune", "prefecture", "minist", "police", "gendarmerie",
)


def zone_to_ville(zone: str) -> str:
    """Extrait le nom de la ville depuis la zone (ex: 'Paris (Paris-Centre)' -> 'Paris', 'Cannes, France' -> 'Cannes')."""
    if not zone:
        return ""
    if "Paris" in zone or zone.strip().lower().startswith("paris"):
        return "Paris"
    return zone.split(",")[0].strip()


@dataclass
class Target:
    entreprise: str
    site: str
    zone: str
    ville: str = ""  # ville principale (Paris, Fontainebleau, Cannes, Auxerre, etc.)
    score: int = 0


# ============================================================
# RESUME UTILS
# ============================================================
def ensure_csv_header(path: str, fieldnames: List[str]) -> None:
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()

def load_done_sites(csv_path: str) -> Set[str]:
    done = set()
    if not os.path.exists(csv_path):
        return done
    try:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                site = (row.get("site") or "").strip()
                if site:
                    done.add(site)
    except Exception:
        return done
    return done


# ============================================================
# OSM HELPERS
# ============================================================
def geocode_place(place: str) -> Tuple[float, float]:
    params = {"q": place, "format": "json", "limit": 1}
    r = rq_get(NOMINATIM_URL, params=params, headers=HTTP_HEADERS, timeout=TIMEOUT_NOMINATIM)
    r.raise_for_status()
    data = r.json()
    if not data:
        raise RuntimeError(f"Nominatim: lieu introuvable: {place}")
    return float(data[0]["lat"]), float(data[0]["lon"])

def _build_overpass_query(lat: float, lon: float, radius_km: float) -> bytes:
    radius_m = int(radius_km * 1000)
    q = f"""
[out:json][timeout:40];
{OVERPASS_FILTER.replace("RADIUS", str(radius_m)).replace("LAT", str(lat)).replace("LON", str(lon))}
out tags center;
"""
    return q.encode("utf-8")

def overpass_search(lat: float, lon: float, radius_km: float) -> List[dict]:
    query = _build_overpass_query(lat, lon, radius_km)

    last_error = None
    for endpoint in OVERPASS_ENDPOINTS:
        for attempt in range(OVERPASS_RETRIES_PER_ENDPOINT):
            backoff = OVERPASS_BACKOFF_SECONDS[min(attempt, len(OVERPASS_BACKOFF_SECONDS) - 1)]
            try:
                r = rq_post(endpoint, data=query, headers=HTTP_HEADERS, timeout=TIMEOUT_OVERPASS)
                if r.status_code == 200:
                    data = r.json()
                    return data.get("elements", [])
                last_error = f"{endpoint} -> HTTP {r.status_code}"
                time.sleep(backoff)
            except requests.RequestException as e:
                last_error = f"{endpoint} -> {e.__class__.__name__}"
                time.sleep(backoff)

    raise RuntimeError(f"Overpass KO. Last: {last_error}")

def pick_website(tags: Dict[str, str]) -> Optional[str]:
    for k in ("website", "contact:website", "url", "contact:url"):
        v = tags.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None

def normalize_site(u: str) -> Optional[str]:
    u = (u or "").strip()
    if not u:
        return None
    if u.startswith("//"):
        u = "https:" + u
    if not u.startswith(("http://", "https://")):
        u = "https://" + u
    try:
        parsed = urlparse(u)
        if not parsed.netloc:
            return None
        if parsed.scheme not in ("http", "https"):
            return None
        return u
    except Exception:
        return None

def should_exclude_company(name: str) -> bool:
    n = (name or "").strip().lower()
    if not n:
        return True
    return any(x in n for x in NAME_BLACKLIST)

def score_company(name: str, website: str, focus: str) -> int:
    """
    focus: web | it | all
    Renvoie un score pour trier/prioriser.
    """
    n = (name or "").lower()
    s = (website or "").lower()
    base = 0

    # bonus si ressemble à du web/digital
    if any(k in n for k in WEB_DEV_KEYWORDS):
        base += 3
    if any(k in s for k in ("web", "digital", "dev", "studio", "agence", "agency", "software", "tech")):
        base += 2

    # focus
    if focus == "web":
        # pénalise un peu les trucs trop "formation/école/association" si ça passe
        if any(x in n for x in ("ecole", "école", "formation", "asso", "association")):
            base -= 3
    elif focus == "it":
        if any(k in n for k in ("informatique", "it", "software", "tech")):
            base += 2

    # petit bonus domain propre
    try:
        dom = urlparse(website).netloc.lower()
        if dom and "." in dom and not dom.endswith((".blogspot.com", ".wordpress.com")):
            base += 1
    except Exception:
        pass

    return base


def build_targets(max_sites: int, focus: str, zones_filter: str = "") -> List[Target]:
    """
    zones_filter: si non vide, liste de noms séparés par des virgules (ex: "Lyon, Marseille").
    Seules les zones dont le nom contient l'un de ces mots sont utilisées. Vide = toutes.
    """
    targets: List[Target] = []
    seen = set()  # (name_lower, domain)

    filter_parts = [p.strip().lower() for p in zones_filter.split(",") if p.strip()] if zones_filter else []
    include_paris = not filter_parts or any("paris" in p for p in filter_parts)

    if include_paris:
        print("\n==> ZONE: Paris (multi-centres)")
    for cname, lat, lon, radius_km, local_limit in PARIS_CENTERS:
        if not include_paris:
            continue
        if len(targets) >= max_sites:
            break
        print(f"  -> {cname} | rayon={radius_km}km")
        try:
            elements = overpass_search(lat, lon, radius_km)
        except RuntimeError as e:
            print(f"     ⚠️  Overpass skip: {e}")
            continue

        batch: List[Target] = []
        for el in elements:
            tags = el.get("tags") or {}
            name = tags.get("name")
            if not isinstance(name, str) or not name.strip():
                continue
            name = name.strip()
            if should_exclude_company(name):
                continue

            website = pick_website(tags)
            if not website:
                continue
            site = normalize_site(website)
            if not site:
                continue

            domain = urlparse(site).netloc.replace("www.", "").lower()
            key = (name.lower(), domain)
            if key in seen:
                continue
            seen.add(key)

            sc = score_company(name, site, focus)
            batch.append(Target(entreprise=name, site=site, zone=f"Paris ({cname})", ville="Paris", score=sc))

        # trie par score descendant (meilleur d’abord)
        batch.sort(key=lambda t: t.score, reverse=True)
        batch = batch[:local_limit]

        targets.extend(batch)
        print(f"     ajoutés: {len(batch)}")

    for z in ZONES:
        if len(targets) >= max_sites:
            break
        if filter_parts:
            name_lower = z["name"].lower()
            if not any(fp in name_lower for fp in filter_parts):
                continue
        place = z["name"]
        radius_km = float(z["radius_km"])
        limit = int(z["limit"])
        print(f"\n==> ZONE: {place} (rayon {radius_km} km)")

        try:
            lat, lon = geocode_place(place)
        except Exception as e:
            print(f"     ⚠️  Nominatim skip: {e.__class__.__name__}")
            continue

        try:
            elements = overpass_search(lat, lon, radius_km)
        except RuntimeError as e:
            print(f"     ⚠️  Overpass skip: {e}")
            continue

        batch: List[Target] = []
        for el in elements:
            tags = el.get("tags") or {}
            name = tags.get("name")
            if not isinstance(name, str) or not name.strip():
                continue
            name = name.strip()
            if should_exclude_company(name):
                continue

            website = pick_website(tags)
            if not website:
                continue
            site = normalize_site(website)
            if not site:
                continue

            domain = urlparse(site).netloc.replace("www.", "").lower()
            key = (name.lower(), domain)
            if key in seen:
                continue
            seen.add(key)

            sc = score_company(name, site, focus)
            ville = zone_to_ville(place)
            batch.append(Target(entreprise=name, site=site, zone=place, ville=ville, score=sc))

        batch.sort(key=lambda t: t.score, reverse=True)
        batch = batch[:limit]
        targets.extend(batch)
        print(f"     ajoutés: {len(batch)}")

    # cap global
    return targets[:max_sites]


def write_targets_csv(targets: List[Target], targets_csv: str) -> None:
    parent = os.path.dirname(targets_csv)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(targets_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["entreprise", "site", "zone", "ville", "score"])
        w.writeheader()
        for t in targets:
            w.writerow({"entreprise": t.entreprise, "site": t.site, "zone": t.zone, "ville": t.ville, "score": t.score})


# ============================================================
# EMAIL UTILS
# ============================================================
def normalize_email(e: str) -> str:
    return (e or "").strip().lower().rstrip(".,;:)]}>\"'")

def is_generic_email(e: str) -> bool:
    local = e.split("@")[0]
    return any(local.startswith(p) for p in GENERIC_PREFIXES)

def is_hr_email(e: str) -> bool:
    """True si l'email ressemble à un contact RH/recrutement (priorité pour candidatures)."""
    local = normalize_email(e).split("@")[0]
    return any(local.startswith(p) for p in HR_PREFIXES) or any(
        k in local for k in ("rh", "recrut", "recruit", "job", "career", "talent", "hiring", "alternance", "stage")
    )

def is_support_like_email(e: str) -> bool:
    """True si l'email est typiquement support / technique / commercial (à éviter pour candidatures)."""
    local = normalize_email(e).split("@")[0]
    return any(local.startswith(p) for p in SUPPORT_LIKE_PREFIXES) or local in ("support", "help", "service", "admin")

def host_no_www(u: str) -> str:
    try:
        return urlparse(u).netloc.replace("www.", "").lower()
    except Exception:
        return ""

def is_ats_domain(u: str) -> bool:
    low = (u or "").lower()
    return any(h in low for h in ATS_HINTS)

def allowed_source_domain(site: str, source_url: str) -> bool:
    if not source_url:
        return False
    if is_ats_domain(source_url):
        return False
    sdom = host_no_www(site)
    udom = host_no_www(source_url)
    if not sdom or not udom:
        return False
    return (udom == sdom) or udom.endswith("." + sdom)

def deobfuscate_text(s: str) -> str:
    s = s.replace("[at]", "@").replace("(at)", "@").replace(" at ", "@")
    s = s.replace("[dot]", ".").replace("(dot)", ".").replace(" dot ", ".")
    return s

def looks_like_fake_email(e: str) -> bool:
    """
    Filtre les emails foireux repérés dans ton log:
    - assets d'images: xxx@2x.png, etc.
    - placeholders: you@example.com, your@email.com
    - emails CDN/monitoring/envato
    """
    e = normalize_email(e)
    if not e or "@" not in e:
        return True

    local, domain = e.split("@", 1)
    if not local or not domain:
        return True

    if any(bad in e for bad in BAD_LOCAL_SUBSTRINGS):
        return True

    if domain in BAD_DOMAINS:
        return True

    # extension image dans le "domain" ou le local
    if any(ext in local for ext in (".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif")):
        return True
    if any(ext in domain for ext in (".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif")):
        return True

    # évite des trucs ultra courts genre a@b.co
    if len(local) < 2:
        return True

    return False

def extract_emails_from_text(text: str) -> List[str]:
    if not text:
        return []
    text = deobfuscate_text(text)
    found = [normalize_email(x) for x in EMAIL_REGEX.findall(text)]
    out, seen = [], set()
    for e in found:
        if not e:
            continue
        if looks_like_fake_email(e):
            continue
        if e not in seen:
            seen.add(e)
            out.append(e)
    return out

def extract_mailtos_from_html(html: str) -> List[str]:
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")
    out, seen = [], set()
    for a in soup.select("a[href]"):
        href = (a.get("href") or "").strip()
        if href.lower().startswith("mailto:"):
            mail = href.split(":", 1)[1].split("?", 1)[0].strip()
            mail = normalize_email(mail)
            if not mail:
                continue
            if looks_like_fake_email(mail):
                continue
            if mail not in seen:
                seen.add(mail)
                out.append(mail)
    return out

def safe_urljoin(base_url: str, href: str) -> Optional[str]:
    if not href:
        return None
    href = str(href).strip()
    if not href:
        return None

    low = href.lower()
    if low.startswith(("javascript:", "mailto:", "tel:")):
        return None
    if low.startswith("#"):
        return None

    # ignore values like "lang_path"
    if "://" not in href and not href.startswith(("/", "./", "../", "?")):
        return None

    try:
        u = urljoin(base_url, href)
        p = urlparse(u)
        if p.scheme not in ("http", "https"):
            return None
        if not p.netloc:
            return None
        return u
    except Exception:
        return None

def find_contact_like_urls(html: str, base_url: str) -> List[str]:
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")
    candidates: List[str] = []

    keywords = (
        "contact", "nous-contacter", "contactez-nous", "contact-us",
        "recrut", "career", "carriere", "carrieres", "jobs", "join",
        "alternance", "stage", "stages", "mentions-legales", "legal", "privacy",
        "postuler", "candidature"
    )

    for a in soup.select("a[href]"):
        href = (a.get("href") or "").strip()
        u = safe_urljoin(base_url, href)
        if not u:
            continue
        low = u.lower()
        if any(k in low for k in keywords):
            candidates.append(u)

    # unique + cap
    out, seen = [], set()
    for u in candidates:
        if u not in seen:
            seen.add(u)
            out.append(u)
        if len(out) >= 25:
            break
    return out

def pick_best_email(emails: List[str], reject_support_like: bool = True) -> Optional[str]:
    """
    Choisit le meilleur email pour une candidature.
    - Exclut les emails support/help/service (souvent non-RH, ne fonctionnent pas pour recrutement).
    - Priorise fortement les emails RH (recrut@, rh@, jobs@, etc.), puis contact/info.
    """
    if not emails:
        return None

    emails2 = [e for e in emails if e and not looks_like_fake_email(e)]
    if not emails2:
        return None

    # Ne jamais sélectionner support@, help@, service@, etc. pour une candidature
    if reject_support_like:
        candidates = [e for e in emails2 if not is_support_like_email(e)]
        if not candidates:
            return None  # que des emails support → on considère comme NOT_FOUND (FORM_ONLY si URLs)
        emails2 = candidates

    def score_email(e: str) -> int:
        e = normalize_email(e)
        local = e.split("@")[0]
        s = 0
        # Priorité maximale : email clairement RH/recrutement
        if is_hr_email(e):
            s += 10
        elif is_generic_email(e):
            s += 4
        # bonus supplémentaire pour RH explicite dans le local
        if any(k in local for k in ("rh", "recrut", "recruit", "job", "jobs", "career", "talent", "hiring", "alternance", "stage")):
            s += 2
        # malus si prénom.nom sans être générique (moins prioritaire que recrut@)
        if "." in local and not is_generic_email(e):
            s -= 1
        return s

    emails2.sort(key=score_email, reverse=True)
    return emails2[0]


# ============================================================
# FETCH / PARSE
# ============================================================
def fetch_html(url: str) -> Tuple[Optional[str], Optional[int]]:
    try:
        if SLEEP_BETWEEN_REQUESTS_SEC > 0:
            time.sleep(SLEEP_BETWEEN_REQUESTS_SEC)

        r = rq_get(url, headers=HEADERS_WEB, timeout=TIMEOUT_HTML, allow_redirects=True, stream=True)
        status = r.status_code
        ct = (r.headers.get("Content-Type") or "").lower()

        if status in (403, 429):
            return None, status
        if status >= 400:
            return None, status

        if ("text/html" not in ct) and ("application/xhtml+xml" not in ct) and ("application/xml" not in ct) and ("text/xml" not in ct):
            return None, status

        chunks = []
        total = 0
        for chunk in r.iter_content(chunk_size=8192):
            if not chunk:
                break
            chunks.append(chunk)
            total += len(chunk)
            if total > MAX_BYTES:
                return None, status

        html = b"".join(chunks).decode(r.encoding or "utf-8", errors="ignore")
        if len(html) < 120:
            return None, status
        return html, status

    except requests.RequestException:
        return None, None
    except Exception:
        return None, None


# ============================================================
# DRAFT TEMPLATE
# ============================================================
def render_template(text: str, variables: Dict[str, str]) -> str:
    out = text
    for key, value in variables.items():
        out = out.replace(f"{{{{{key}}}}}", value)
    return out


def build_email_draft(
    company: str,
    sender_first_name: str,
    sender_last_name: str,
    sender_linkedin_url: str,
    sender_portfolio_url: str,
    custom_subject_template: str,
    custom_body_template: str,
) -> Tuple[str, str]:
    full_name = " ".join(part for part in [sender_first_name.strip(), sender_last_name.strip()] if part).strip()
    display_name = full_name or "Candidat"
    variables = {
        "ENTREPRISE": company,
        "PRENOM": sender_first_name.strip(),
        "NOM": sender_last_name.strip(),
        "NOM_COMPLET": display_name,
        "LINKEDIN": sender_linkedin_url.strip(),
        "PORTFOLIO": sender_portfolio_url.strip(),
        "DATE": "Septembre 2026",
    }

    default_subject = "Candidature spontanee - Alternance Developpeur Web - {{DATE}} - {{ENTREPRISE}}"

    footer_lines = [
        "Cordialement,",
        "{{NOM_COMPLET}}",
    ]
    if variables["LINKEDIN"]:
        footer_lines.append("LinkedIn : {{LINKEDIN}}")
    if variables["PORTFOLIO"]:
        footer_lines.append("Portfolio : {{PORTFOLIO}}")

    footer = "\n".join(footer_lines)

    default_body = f"""Madame, Monsieur,

Je suis a la recherche d'une alternance en developpement web a partir de {{DATE}}.

Je souhaite rejoindre {{ENTREPRISE}} afin de contribuer a des projets concrets et progresser au contact d'une equipe.

Je vous joins mon CV et ma lettre de motivation en pieces jointes.

{footer}
"""
    subject_template = custom_subject_template.strip() or default_subject
    body_template = custom_body_template.strip() or default_body
    subject = render_template(subject_template, variables).strip() or render_template(default_subject, variables)
    body = render_template(body_template, variables).strip() or render_template(default_body, variables)
    return subject, body


# ============================================================
# PER SITE
# ============================================================
def try_urls_for_site(site: str, enable_sitemap: bool = False) -> Tuple[Optional[str], Optional[str], List[str], str]:
    """
    Retourne: (email, source_url, contact_urls, reason)
    reason: FOUND | NOT_FOUND | BLOCKED | UNSTABLE
    """
    html0, st0 = fetch_html(site)
    if st0 in (403, 429):
        return None, None, [], "BLOCKED"
    if html0 is None:
        return None, None, [], "UNSTABLE"

    contact_urls = find_contact_like_urls(html0, site)

    emails = extract_mailtos_from_html(html0) + extract_emails_from_text(html0)
    best = pick_best_email(emails)
    if best:
        return best, site, contact_urls[:20], "FOUND"

    # fast paths
    for p in FAST_PATHS[1:]:
        url = urljoin(site, p)
        html, st = fetch_html(url)
        if st in (403, 429):
            continue
        if not html:
            continue

        more = find_contact_like_urls(html, url)
        for u in more:
            if u not in contact_urls:
                contact_urls.append(u)

        emails = extract_mailtos_from_html(html) + extract_emails_from_text(html)
        best = pick_best_email(emails)
        if best:
            return best, url, contact_urls[:25], "FOUND"

    # sitemap (optionnel et léger)
    if enable_sitemap:
        for sm in ("/sitemap.xml", "/sitemap_index.xml"):
            sm_url = urljoin(site, sm)
            xml, st = fetch_html(sm_url)
            if not xml:
                continue
            urls = []
            for m in re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml):
                low = m.lower()
                if any(k in low for k in ("contact", "recrut", "career", "carriere", "jobs", "join", "alternance", "stage", "postuler")):
                    urls.append(m.strip())
                if len(urls) >= 20:
                    break
            for u in urls:
                html, st = fetch_html(u)
                if not html:
                    continue
                emails = extract_mailtos_from_html(html) + extract_emails_from_text(html)
                best = pick_best_email(emails)
                if best:
                    if u not in contact_urls:
                        contact_urls.append(u)
                    return best, u, contact_urls[:30], "FOUND"

    if contact_urls:
        return None, None, contact_urls[:30], "NOT_FOUND"

    return None, None, [], "NOT_FOUND"


# ============================================================
# RUN (PARALLEL)
# ============================================================
def run_email_finder(
    targets: List[Target],
    emails_found_csv: str,
    drafts_txt: str,
    max_minutes: int,
    enable_sitemap: bool,
    workers: int,
    target_found: int,
    focus: str,
    sender_first_name: str,
    sender_last_name: str,
    sender_linkedin_url: str,
    mail_subject_template: str,
    mail_body_template: str,
    sender_portfolio_url: str,
    rh_only: bool = False,
) -> None:
    fieldnames = ["entreprise", "zone", "ville", "site", "score", "status", "email", "source_url", "contact_urls", "reason"]

    done_sites = load_done_sites(emails_found_csv)
    if done_sites:
        print(f"\n⏩ RESUME: {len(done_sites)} sites déjà présents dans {emails_found_csv} -> skip")

    ensure_csv_header(emails_found_csv, fieldnames)

    if not os.path.exists(drafts_txt):
        parent = os.path.dirname(drafts_txt)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(drafts_txt, "w", encoding="utf-8") as f:
            f.write("")

    deadline = time.time() + max_minutes * 60
    lock = threading.Lock()

    processed = 0
    found = 0
    blocked = 0
    unstable = 0
    form_only = 0

    pending = [t for t in targets if t.site not in done_sites]

    # v5: priorise aussi par score
    pending.sort(key=lambda t: t.score, reverse=True)

    def job(t: Target):
        try:
            email, source_url, contact_urls, reason = try_urls_for_site(t.site, enable_sitemap)
        except Exception:
            email, source_url, contact_urls, reason = None, None, [], "ERROR"
        return t, email, source_url, contact_urls, reason

    with open(emails_found_csv, "a", newline="", encoding="utf-8") as fcsv, \
         open(drafts_txt, "a", encoding="utf-8") as fdraft:

        writer = csv.DictWriter(fcsv, fieldnames=fieldnames)

        from concurrent.futures import ThreadPoolExecutor, as_completed

        with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
            futures = {}
            for t in pending:
                if time.time() >= deadline:
                    break
                futures[ex.submit(job, t)] = t

            for fut in as_completed(futures):
                if time.time() >= deadline:
                    print("\n⏱️  STOP: limite de temps atteinte (max-minutes).")
                    break

                t, email, source_url, contact_urls, reason = fut.result()

                with lock:
                    processed += 1
                    status = "NOT_FOUND"

                    if reason == "BLOCKED":
                        blocked += 1
                    elif reason == "UNSTABLE":
                        unstable += 1

                    # v6: email propre + même domaine ; option --rh-only : brouillon seulement si email RH
                    if email and source_url and allowed_source_domain(t.site, source_url):
                        if not looks_like_fake_email(email):
                            write_draft = True
                            if rh_only and not is_hr_email(email):
                                status = "FORM_ONLY"
                                form_only += 1
                                write_draft = False
                            else:
                                status = "FOUND"
                                found += 1

                            if write_draft:
                                subj, body = build_email_draft(
                                    company=t.entreprise,
                                    sender_first_name=sender_first_name,
                                    sender_last_name=sender_last_name,
                                    sender_linkedin_url=sender_linkedin_url,
                                    sender_portfolio_url=sender_portfolio_url,
                                    custom_subject_template=mail_subject_template,
                                    custom_body_template=mail_body_template,
                                )
                                fdraft.write(
                                    f"{SEP}\n"
                                    f"Entreprise: {t.entreprise}\n"
                                    f"Zone: {t.zone}\n"
                                    f"Ville: {t.ville}\n"
                                    f"Site: {t.site}\n"
                                    f"Score: {t.score}\n"
                                    f"Email: {email}\n"
                                    f"Source: {source_url}\n"
                                    f"Sujet: {subj}\n\n"
                                    f"{body}\n"
                                )
                                fdraft.flush()
                        else:
                            # email rejeté => on garde plutôt les urls de contact
                            if contact_urls:
                                status = "FORM_ONLY"
                                form_only += 1
                            else:
                                status = "NOT_FOUND"

                    elif contact_urls:
                        status = "FORM_ONLY"
                        form_only += 1

                    row = {
                        "entreprise": t.entreprise,
                        "zone": t.zone,
                        "ville": t.ville,
                        "site": t.site,
                        "score": str(t.score),
                        "status": status,
                        "email": email or "",
                        "source_url": source_url or "",
                        "contact_urls": " | ".join(contact_urls) if contact_urls else "",
                        "reason": reason,
                    }
                    writer.writerow(row)
                    fcsv.flush()
                    done_sites.add(t.site)

                    # log
                    print(f"\n[+] {t.entreprise} ({t.zone}) -> {t.site} [score={t.score}]")
                    if status == "FOUND":
                        print(f"    ✅ FOUND {email} (source: {source_url})")
                    elif status == "FORM_ONLY":
                        print(f"    📨 FORM_ONLY ({len(contact_urls)} url(s) contact/career)")
                    else:
                        print(f"    ❌ NOT_FOUND (reason={reason})")

                    if found >= target_found:
                        print(f"\n🎯 STOP: target-found atteint ({found}/{target_found}).")
                        break

    print("\n===== STATS SESSION =====")
    print(f"Focus:      {focus}")
    print(f"Traités:    {processed}")
    print(f"FOUND:      {found}")
    print(f"FORM_ONLY:  {form_only}")
    print(f"BLOCKED:    {blocked}")
    print(f"UNSTABLE:   {unstable}")
    print("=========================")


# ============================================================
# MAIN
# ============================================================
def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--max-minutes", type=int, default=30, help="Limite globale en minutes (défaut: 30)")
    p.add_argument("--max-sites", type=int, default=1500, help="Nombre max d'entreprises à collecter (défaut: 1500)")
    p.add_argument("--target-found", type=int, default=100, help="Stop dès que FOUND atteint (défaut: 100)")
    p.add_argument("--workers", type=int, default=20, help="Threads scraping (défaut: 20)")
    p.add_argument("--enable-sitemap", action="store_true", help="Active le crawl sitemap (plus lent)")
    p.add_argument("--insecure", action="store_true", help="Désactive la vérification SSL (temporaire)")
    p.add_argument("--focus", choices=["web", "it", "all"], default="web",
                   help="Filtre/priorité entreprises: web (défaut), it, all")
    p.add_argument("--rh-only", action="store_true",
                   help="N'écrire un brouillon que si l'email trouvé est RH/recrutement (recrut@, rh@, jobs@, etc.)")
    p.add_argument("--zones", type=str, default="",
                   help="Limiter aux zones voulues, séparées par des virgules (ex: Lyon, Marseille, Toulouse). Vide = toutes les zones.")
    p.add_argument("--targets-csv", type=str, default=DEFAULT_TARGETS_AUTO_CSV,
                   help="Chemin du CSV de cibles collectées.")
    p.add_argument("--emails-found-csv", type=str, default=DEFAULT_EMAILS_FOUND_CSV,
                   help="Chemin du CSV des emails trouvés.")
    p.add_argument("--drafts-txt", type=str, default=DEFAULT_DRAFT_EMAILS_TXT,
                   help="Chemin du fichier de brouillons générés.")
    p.add_argument("--sender-first-name", type=str, default="", help="Prenom du candidat.")
    p.add_argument("--sender-last-name", type=str, default="", help="Nom du candidat.")
    p.add_argument("--sender-linkedin-url", type=str, default="", help="Profil LinkedIn du candidat.")
    p.add_argument("--sender-portfolio-url", type=str, default="", help="URL de portfolio du candidat (optionnel).")
    p.add_argument("--mail-subject-template", type=str, default="",
                   help="Template de sujet avec placeholders (ex: {{ENTREPRISE}}, {{NOM_COMPLET}}).")
    p.add_argument("--mail-body-template", type=str, default="",
                   help="Template complet du corps de mail avec placeholders.")
    return p.parse_args()

def main():
    global INSECURE_SSL
    args = parse_args()
    INSECURE_SSL = bool(args.insecure)

    if INSECURE_SSL:
        try:
            requests.packages.urllib3.disable_warnings()  # type: ignore[attr-defined]
        except Exception:
            pass
        print("⚠️  MODE --insecure activé: vérification SSL désactivée (temporaire).")

    print("==> 1) Génération des entreprises (OSM Overpass) [WEB FOCUS]")
    targets = build_targets(max_sites=args.max_sites, focus=args.focus, zones_filter=args.zones)
    write_targets_csv(targets, args.targets_csv)
    print(f"✅ targets: {args.targets_csv} ({len(targets)} lignes)")

    print("\n==> 2) Recherche emails (FAST + RESUME + cap temps + anti-faux emails, priorité RH)")
    print(f"    max_minutes={args.max_minutes} | workers={args.workers} | target_found={args.target_found} | sitemap={args.enable_sitemap} | focus={args.focus} | rh_only={args.rh_only}")
    run_email_finder(
        targets=targets,
        emails_found_csv=args.emails_found_csv,
        drafts_txt=args.drafts_txt,
        max_minutes=args.max_minutes,
        enable_sitemap=args.enable_sitemap,
        workers=args.workers,
        target_found=args.target_found,
        focus=args.focus,
        sender_first_name=args.sender_first_name,
        sender_last_name=args.sender_last_name,
        sender_linkedin_url=args.sender_linkedin_url or LINKEDIN,
        sender_portfolio_url=args.sender_portfolio_url,
        mail_subject_template=args.mail_subject_template,
        mail_body_template=args.mail_body_template,
        rh_only=args.rh_only,
    )

    print(f"\n✅ emails: {args.emails_found_csv}")
    print(f"✅ drafts: {args.drafts_txt}")
    print("\n🎯 Terminé.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⛔ Interrompu par l'utilisateur.")
        sys.exit(1)
    except Exception as e:
        # jamais de crash silencieux
        print(f"\n❌ ERREUR FATALE (rare): {e.__class__.__name__}: {e}")
        sys.exit(1)